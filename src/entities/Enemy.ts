/**
 * Enemy.ts
 * ─────────────────────────────────────────────────────────
 * Inimigo de teste (Dummy). Herda de Fighter.
 *
 * Funcionalidades:
 * - HP próprio (não usa PlayerState)
 * - Barra de vida sobre a cabeça
 * - Estados: idle, hurt, knockdown, dead
 * - Flag 'aggressive': quando ligada, ataca a cada ~2s
 * - Ao morrer, soma pontos via PlayerState.addScore
 */

import Phaser from 'phaser';
import { Fighter, FighterState } from './Fighter';
import { AttackData, ENEMY_ATTACK } from '../config/attacks';
import {
  ENEMY_HP_MAX,
  ENEMY_SCORE_VALUE,
  KNOCKDOWN_DURATION,
  HURT_STUN_DURATION,
  EVENTS,
} from '../config/constants';

export class Enemy extends Fighter {
  // ── Barra de vida ──────────────────────────────────────
  private _hpBarBg!: Phaser.GameObjects.Rectangle;
  private _hpBar!: Phaser.GameObjects.Rectangle;

  // ── Hitbox de ataque ───────────────────────────────────
  private _hitboxZone!: Phaser.GameObjects.Zone;
  private _hitboxBody!: Phaser.Physics.Arcade.Body;
  private _currentAttack?: AttackData;
  private _attackStartTime: number = 0;

  // ── IA ─────────────────────────────────────────────────
  private _aggressive: boolean = false;
  private _nextAttackTime: number = 0;

  // ── Timers de estado ───────────────────────────────────
  private _stateEndTime: number = 0;

  // ── Referência ao PlayerState (para score) ─────────────
  private _playerState?: { addScore: (points: number) => void };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerState?: { addScore: (points: number) => void }
  ) {
    super(scene, x, y, 'enemy_basic', ENEMY_HP_MAX);

    this._playerState = playerState;

    // ── Barra de vida ────────────────────────────────────
    this._hpBarBg = scene.add.rectangle(x, y - 38, 24, 3, 0x440000);
    this._hpBarBg.setOrigin(0.5, 0.5);
    this._hpBar = scene.add.rectangle(x, y - 38, 24, 3, 0xff2222);
    this._hpBar.setOrigin(0.5, 0.5);

    // ── Hitbox de ataque ─────────────────────────────────
    this._hitboxZone = scene.add.zone(0, 0, 1, 1);
    scene.physics.add.existing(this._hitboxZone);
    this._hitboxBody = this._hitboxZone.body as Phaser.Physics.Arcade.Body;
    this._hitboxBody.enable = false;
    this._hitboxBody.setAllowGravity(false);

    // ── Agendamento de primeiro ataque ───────────────────
    this._nextAttackTime = scene.time.now + 2000;
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════

  update(_time: number, delta: number): void {
    if (this._fighterState === FighterState.Dead) return;

    // Atualiza eixo Z
    this._updateJumpAxis(delta);

    // Atualiza timers de estado
    this._updateStateTimers();

    // IA agressiva
    if (this._aggressive && this._fighterState === FighterState.Idle) {
      this._tryAttack();
    }

    // Atualiza profundidade
    this._updateDepth();

    // Atualiza barra de vida
    this._updateHPBar();
  }

  /**
   * Chamado no postupdate da GameScene.
   */
  postPhysicsUpdate(): void {
    this.clampToWalkZone();
    this.applyJumpVisualOffset();
    this._updateHitboxPosition();
    this._updateHPBarPosition();
  }

  // ═══════════════════════════════════════════════════════
  // IA
  // ═══════════════════════════════════════════════════════

  /**
   * Liga/desliga modo agressivo.
   */
  setAggressive(value: boolean): void {
    this._aggressive = value;
    this._nextAttackTime = this.scene.time.now + 2000;
  }

  get aggressive(): boolean { return this._aggressive; }

  private _tryAttack(): void {
    const now = this.scene.time.now;
    if (now < this._nextAttackTime) return;

    this._startAttack();
    this._nextAttackTime = now + 2000; // próximo ataque em 2s
  }

  private _startAttack(): void {
    this._currentAttack = ENEMY_ATTACK;
    this._attackStartTime = this.scene.time.now;
    this.changeState(FighterState.Attack);

    const totalTime = ENEMY_ATTACK.startup + ENEMY_ATTACK.active + ENEMY_ATTACK.recovery;

    // Ativa hitbox
    this.scene.time.delayedCall(ENEMY_ATTACK.startup, () => {
      this._hitboxBody.enable = true;
      this._hitboxBody.setSize(ENEMY_ATTACK.hitboxWidth, ENEMY_ATTACK.hitboxHeight);
    });

    // Desativa hitbox
    this.scene.time.delayedCall(ENEMY_ATTACK.startup + ENEMY_ATTACK.active, () => {
      this._hitboxBody.enable = false;
    });

    // Fim do ataque
    this.scene.time.delayedCall(totalTime, () => {
      this._endAttack();
    });
  }

  private _endAttack(): void {
    this._currentAttack = undefined;
    this._hitboxBody.enable = false;
    this.changeState(FighterState.Idle);
  }

  private _updateHitboxPosition(): void {
    if (!this._hitboxBody.enable || !this._currentAttack) return;
    const offsetX = this._facingRight ? 15 : -15;
    this._hitboxZone.setPosition(this.x + offsetX, this.y - 10);
  }

  /**
   * Retorna o ataque atual.
   */
  getCurrentAttack(): AttackData | undefined {
    return this._currentAttack;
  }

  /**
   * Retorna a hitbox.
   */
  getHitboxZone(): Phaser.GameObjects.Zone {
    return this._hitboxZone;
  }

  // ═══════════════════════════════════════════════════════
  // DANO
  // ═══════════════════════════════════════════════════════

  /**
   * Aplica dano ao inimigo.
   */
  takeEnemyDamage(amount: number, knockbackX: number = 0, knockdown: boolean = false): boolean {
    if (this.isInvulnerable()) return false;
    if (this._fighterState === FighterState.Dead) return false;

    const died = this.takeDamage(amount, knockbackX, knockdown);

    // Emite evento
    this.scene.game.events.emit(EVENTS.ENEMY_DAMAGED, this, amount);

    if (died) {
      this._handleDeath();
    } else {
      // Timer de estado
      if (knockdown) {
        this._stateEndTime = this.scene.time.now + KNOCKDOWN_DURATION;
      } else {
        this._stateEndTime = this.scene.time.now + HURT_STUN_DURATION;
      }
    }

    return died;
  }

  private _handleDeath(): void {
    this.changeState(FighterState.Dead);
    this._hitboxBody.enable = false;

    // Soma pontos
    if (this._playerState) {
      this._playerState.addScore(ENEMY_SCORE_VALUE);
    }

    // Emite evento
    this.scene.game.events.emit(EVENTS.ENEMY_DIED, this);

    // Remove após animação
    this.scene.time.delayedCall(1000, () => {
      this.cleanup();
      this.destroy();
    });
  }

  // ═══════════════════════════════════════════════════════
  // TIMERS
  // ═══════════════════════════════════════════════════════

  private _updateStateTimers(): void {
    const now = this.scene.time.now;

    if ((this._fighterState === FighterState.Hurt || this._fighterState === FighterState.Knockdown) && now >= this._stateEndTime) {
      this.changeState(FighterState.Idle);
    }
  }

  // ═══════════════════════════════════════════════════════
  // BARRA DE VIDA
  // ═══════════════════════════════════════════════════════

  private _updateHPBar(): void {
    const ratio = this._hp / this._hpMax;
    this._hpBar.displayWidth = 24 * ratio;
  }

  private _updateHPBarPosition(): void {
    this._hpBarBg.setPosition(this.x, this.y - 38 - this._jumpHeight);
    this._hpBar.setPosition(this.x, this.y - 38 - this._jumpHeight);
    this._hpBarBg.setDepth(this.y + 1);
    this._hpBar.setDepth(this.y + 1);
  }

  // ═══════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════

  cleanup(): void {
    super.cleanup();
    this._hpBarBg.destroy();
    this._hpBar.destroy();
    this._hitboxZone.destroy();
  }
}
