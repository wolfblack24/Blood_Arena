/**
 * Player.ts
 * ─────────────────────────────────────────────────────────
 * Entidade do jogador. Herda de Fighter.
 *
 * Responsabilidades:
 * - Controle de movimento 2.5D (WASD/setas)
 * - Sistema de combate (ataques, combos, hitboxes)
 * - Delega HP/vidas/score para PlayerState
 * - Gerencia i-frames e respawn
 *
 * NÃO contém lógica de HP/dano → delega para PlayerState.
 */

import Phaser from 'phaser';
import { Fighter, FighterState } from './Fighter';
import { PlayerState } from '../state/PlayerState';
import { AttackData, PLAYER_ATTACKS, PLAYER_AIR_ATTACK } from '../config/attacks';
import {
  PLAYER_SPEED,
  PLAYER_JUMP_FORCE,
  WALK_ZONE_TOP,
  WALK_ZONE_BOTTOM,
  STAMINA_REGEN_RATE,
  COMBO_WINDOW,
  INPUT_BUFFER,
  KNOCKDOWN_DURATION,
  HURT_STUN_DURATION,
  INVULNERABILITY_DURATION,
  EVENTS,
} from '../config/constants';

export class Player extends Fighter {
  // ── Estado do jogador (HP, vidas, score) ───────────────
  private _playerState: PlayerState;

  // ── Controles ──────────────────────────────────────────
  private _cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private _wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private _jumpKey!: Phaser.Input.Keyboard.Key;
  private _attackKey!: Phaser.Input.Keyboard.Key;
  private _debugKey!: Phaser.Input.Keyboard.Key;

  // ── Combate ────────────────────────────────────────────
  private _hitboxZone!: Phaser.GameObjects.Zone;
  private _hitboxBody!: Phaser.Physics.Arcade.Body;
  private _currentAttack?: AttackData;
  private _attackStartTime: number = 0;
  private _comboIndex: number = 0;
  private _lastAttackEndTime: number = 0;
  private _attackBufferTime: number = 0;
  private _hitTargets: Set<Fighter> = new Set();

  // ── Timers de estado ───────────────────────────────────
  private _stateTimer: number = 0;
  private _stateEndTime: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerState: PlayerState
  ) {
    super(scene, x, y, 'player_idle', playerState.hpMax);

    this._playerState = playerState;

    // ── Cria a hitbox de ataque (zone) ───────────────────
    this._hitboxZone = scene.add.zone(0, 0, 1, 1);
    scene.physics.add.existing(this._hitboxZone);
    this._hitboxBody = this._hitboxZone.body as Phaser.Physics.Arcade.Body;
    this._hitboxBody.enable = false; // desabilitada por padrão
    this._hitboxBody.setAllowGravity(false);

    // ── Controles ────────────────────────────────────────
    this._setupControls();
  }

  // ═══════════════════════════════════════════════════════
  // CONTROLES
  // ═══════════════════════════════════════════════════════

  private _setupControls(): void {
    if (!this.scene.input.keyboard) return;

    this._cursors = this.scene.input.keyboard.createCursorKeys();
    this._wasd = this.scene.input.keyboard.addKeys('W,A,S,D') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };
    this._jumpKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this._attackKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this._debugKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE (chamado todo frame pela GameScene)
  // ═══════════════════════════════════════════════════════

  update(_time: number, delta: number): void {
    // Se morto, não faz nada
    if (this._fighterState === FighterState.Dead) return;

    // Atualiza eixo Z
    this._updateJumpAxis(delta);

    // Atualiza timers de estado
    this._updateStateTimers();

    // Processa input baseado no estado
    this._processInput(delta);

    // Atualiza profundidade
    this._updateDepth();

    // Regenera stamina
    this._playerState.recoverStamina(STAMINA_REGEN_RATE * (delta / 1000));

    // Debug
    this._handleDebugInput();
  }

  /**
   * Chamado no postupdate da GameScene.
   */
  postPhysicsUpdate(): void {
    this.clampToWalkZone();
    this.applyJumpVisualOffset();
    this._updateHitboxPosition();
  }

  // ═══════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════

  private _processInput(delta: number): void {
    // Buffer de input para ataque
    if (Phaser.Input.Keyboard.JustDown(this._attackKey)) {
      this._attackBufferTime = this.scene.time.now + INPUT_BUFFER;
    }

    // Estados que bloqueiam input
    if (this._fighterState === FighterState.Hurt || 
        this._fighterState === FighterState.Knockdown ||
        this._fighterState === FighterState.Attack) {
      return;
    }

    // Movimento
    this._handleMovement();

    // Pulo
    this._handleJump();

    // Ataque
    this._handleAttack();
  }

  private _handleMovement(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Não permite mover no ar (mantém momentum)
    if (!this._isGrounded) return;

    // Lê input
    let vx = 0;
    let vy = 0;

    if (this._cursors.left?.isDown || this._wasd.A.isDown) vx -= 1;
    if (this._cursors.right?.isDown || this._wasd.D.isDown) vx += 1;
    if (this._cursors.up?.isDown || this._wasd.W.isDown) vy -= 1;
    if (this._cursors.down?.isDown || this._wasd.S.isDown) vy += 1;

    // Normaliza diagonal
    if (vx !== 0 && vy !== 0) {
      const norm = 1 / Math.SQRT2;
      vx *= norm;
      vy *= norm;
    }

    // Aplica velocidade
    body.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    // Facing
    if (vx > 0) {
      this.setFacing(true);
    } else if (vx < 0) {
      this.setFacing(false);
    }

    // Estado
    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1;
    if (isMoving && this._fighterState !== FighterState.Walk) {
      this.changeState(FighterState.Walk);
    } else if (!isMoving && this._fighterState === FighterState.Walk) {
      this.changeState(FighterState.Idle);
    }
  }

  private _handleJump(): void {
    if (!this._isGrounded) return;

    if (Phaser.Input.Keyboard.JustDown(this._jumpKey)) {
      this.jump(PLAYER_JUMP_FORCE);
    }
  }

  // ═══════════════════════════════════════════════════════
  // COMBATE
  // ═══════════════════════════════════════════════════════

  private _handleAttack(): void {
    const now = this.scene.time.now;

    // Verifica buffer de input
    if (now > this._attackBufferTime) return;

    // Verifica se pode atacar
    if (this._fighterState === FighterState.Attack) {
      // Verifica se está na janela de combo
      const totalTime = this._currentAttack!.startup + this._currentAttack!.active + this._currentAttack!.recovery;
      const elapsed = now - this._attackStartTime;
      if (elapsed < totalTime && elapsed > totalTime - COMBO_WINDOW) {
        // Pode encadear próximo golpe
        this._startAttack();
      }
      return;
    }

    // Verifica janela de combo
    if (now - this._lastAttackEndTime < COMBO_WINDOW) {
      this._comboIndex = Math.min(this._comboIndex + 1, PLAYER_ATTACKS.length - 1);
    } else {
      this._comboIndex = 0;
    }

    this._startAttack();
  }

  private _startAttack(): void {
    const now = this.scene.time.now;
    this._attackBufferTime = 0;

    // Escolhe o ataque
    let attackData: AttackData;
    if (!this._isGrounded) {
      attackData = PLAYER_AIR_ATTACK;
    } else {
      attackData = PLAYER_ATTACKS[this._comboIndex];
    }

    this._currentAttack = attackData;
    this._attackStartTime = now;
    this._hitTargets.clear();

    // Muda estado
    this.changeState(FighterState.Attack);

    // Agenda ativação da hitbox
    this.scene.time.delayedCall(attackData.startup, () => {
      this._activateHitbox();
    });

    // Agenda desativação da hitbox
    this.scene.time.delayedCall(attackData.startup + attackData.active, () => {
      this._deactivateHitbox();
    });

    // Agenda fim do ataque
    const totalTime = attackData.startup + attackData.active + attackData.recovery;
    this.scene.time.delayedCall(totalTime, () => {
      this._endAttack();
    });
  }

  private _activateHitbox(): void {
    if (!this._currentAttack) return;
    this._hitboxBody.enable = true;
    this._hitboxBody.setSize(this._currentAttack.hitboxWidth, this._currentAttack.hitboxHeight);
  }

  private _deactivateHitbox(): void {
    this._hitboxBody.enable = false;
  }

  private _endAttack(): void {
    this._currentAttack = undefined;
    this._lastAttackEndTime = this.scene.time.now;
    this._deactivateHitbox();

    // Volta ao estado idle ou walk
    if (this._isGrounded) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const isMoving = Math.abs(body.velocity.x) > 10 || Math.abs(body.velocity.y) > 10;
      this.changeState(isMoving ? FighterState.Walk : FighterState.Idle);
    } else {
      this.changeState(FighterState.Jump);
    }
  }

  private _updateHitboxPosition(): void {
    if (!this._hitboxBody.enable || !this._currentAttack) return;

    // Posiciona a hitbox na frente do jogador
    const offsetX = this._facingRight ? 15 : -15;
    this._hitboxZone.setPosition(this.x + offsetX, this.y - 10);
  }

  /**
   * Verifica se um alvo pode ser atingido por este ataque.
   */
  canHitTarget(target: Fighter): boolean {
    if (!this._currentAttack) return false;
    if (this._hitTargets.has(target)) return false;
    if (target.fighterState === FighterState.Dead || target.fighterState === FighterState.Knockdown) return false;
    if (target.isInvulnerable()) return false;

    // Valida profundidade
    const laneDiff = Math.abs(this.y - target.y);
    const zDiff = Math.abs(this._jumpHeight - target.jumpHeight);
    if (laneDiff > 15 || zDiff > this._currentAttack.zTolerance) return false;

    return true;
  }

  /**
   * Registra que um alvo foi atingido (para não acertar duas vezes).
   */
  registerHit(target: Fighter): void {
    this._hitTargets.add(target);
  }

  /**
   * Retorna o ataque atual (para a GameScene processar o dano).
   */
  getCurrentAttack(): AttackData | undefined {
    return this._currentAttack;
  }

  /**
   * Retorna a hitbox (para overlap na GameScene).
   */
  getHitboxZone(): Phaser.GameObjects.Zone {
    return this._hitboxZone;
  }

  // ═══════════════════════════════════════════════════════
  // DANO E RESPAWN
  // ═══════════════════════════════════════════════════════

  /**
   * Aplica dano ao jogador (delega para PlayerState).
   */
  takePlayerDamage(amount: number, knockbackX: number = 0, knockdown: boolean = false): boolean {
    if (this.isInvulnerable()) return false;
    if (this._fighterState === FighterState.Dead) return false;

    // Aplica dano no PlayerState
    const died = this._playerState.takeDamage(amount);

    if (died) {
      this._handleDeath();
    } else {
      // Aplica estado de hurt/knockdown
      if (knockdown) {
        this.changeState(FighterState.Knockdown);
        this._stateEndTime = this.scene.time.now + KNOCKDOWN_DURATION;
      } else {
        this.changeState(FighterState.Hurt);
        this._stateEndTime = this.scene.time.now + HURT_STUN_DURATION;
      }

      // Knockback
      if (knockbackX !== 0) {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX(knockbackX);
      }

      // Invulnerabilidade
      this.grantInvulnerability(INVULNERABILITY_DURATION);
    }

    return died;
  }

  private _handleDeath(): void {
    this.changeState(FighterState.Dead);
    this._stopBlink();

    // PLAYER_DIED já foi emitido pelo PlayerState._handleDeath()
    // Apenas agenda o respawn se ainda há vidas
    this.scene.time.delayedCall(1000, () => {
      if (this._playerState.lives > 0) {
        this._respawn();
      }
    });
  }

  private _respawn(): void {
    this._playerState.respawn();
    this._hp = this._hpMax;
    this.changeState(FighterState.Idle);
    this.grantInvulnerability(INVULNERABILITY_DURATION);

    // Emite evento
    this.scene.game.events.emit(EVENTS.PLAYER_RESPAWNED);
  }

  // ═══════════════════════════════════════════════════════
  // TIMERS DE ESTADO
  // ═══════════════════════════════════════════════════════

  private _updateStateTimers(): void {
    const now = this.scene.time.now;

    // Hurt/Knockdown
    if ((this._fighterState === FighterState.Hurt || this._fighterState === FighterState.Knockdown) && now >= this._stateEndTime) {
      if (this._isGrounded) {
        this.changeState(FighterState.Idle);
      } else {
        this.changeState(FighterState.Jump);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // DEBUG
  // ═══════════════════════════════════════════════════════

  private _handleDebugInput(): void {
    if (Phaser.Input.Keyboard.JustDown(this._debugKey)) {
      this.takePlayerDamage(15);
    }
  }

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get playerState(): PlayerState { return this._playerState; }
}
