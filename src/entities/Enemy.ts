/**
 * Enemy.ts
 * ─────────────────────────────────────────────────────────
 * Inimigo com IA completa. Herda de Fighter.
 *
 * Funcionalidades:
 * - FSM de IA: IDLE, PATROL, CHASE, ATTACK, HURT, DEAD
 * - Comportamento de Beat 'em Up (alinha na pista do jogador)
 * - Barra de vida sobre a cabeça
 * - Suporte a Object Pooling (resetEnemy)
 * - Ao morrer, emite evento com posição para partículas/loot
 */

import Phaser from 'phaser';
import { Fighter, FighterState } from './Fighter';
import { AttackData, ENEMY_ATTACK } from '../config/attacks';
import {
  ENEMY_HP_MAX,
  ENEMY_SCORE_VALUE,
  KNOCKDOWN_DURATION,
  HURT_STUN_DURATION,
  ENEMY_AGGRO_RADIUS,
  ENEMY_ATTACK_RADIUS,
  ENEMY_PATROL_SPEED,
  ENEMY_CHASE_SPEED,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_PATROL_CHANGE_TIME,
  ENEMY_LANE_ALIGN_TOLERANCE,
  WORLD_WIDTH,
  LANE_TOLERANCE,
  EVENTS,
} from '../config/constants';

/**
 * Estados da FSM de IA do inimigo.
 */
export enum EnemyAIState {
  IDLE = 'IDLE',
  PATROL = 'PATROL',
  CHASE = 'CHASE',
  ATTACK = 'ATTACK',
  HURT = 'HURT',
  DEAD = 'DEAD',
}

/**
 * Configuração do inimigo (para pooling).
 */
export interface EnemyConfig {
  hp?: number;
  aggroRadius?: number;
  attackRadius?: number;
  patrolSpeed?: number;
  chaseSpeed?: number;
  attackCooldown?: number;
}

export class Enemy extends Fighter {
  // ── Barra de vida ──────────────────────────────────────
  private _hpBarBg!: Phaser.GameObjects.Rectangle;
  private _hpBar!: Phaser.GameObjects.Rectangle;

  // ── Hitbox de ataque ───────────────────────────────────
  private _hitboxZone!: Phaser.GameObjects.Zone;
  private _hitboxBody!: Phaser.Physics.Arcade.Body;
  private _currentAttack?: AttackData;
  private _attackStartTime: number = 0;

  // ── FSM de IA ──────────────────────────────────────────
  private _aiState: EnemyAIState = EnemyAIState.IDLE;

  // ── Configuração de IA ─────────────────────────────────
  private _aggroRadius: number = ENEMY_AGGRO_RADIUS;
  private _attackRadius: number = ENEMY_ATTACK_RADIUS;
  private _patrolSpeed: number = ENEMY_PATROL_SPEED;
  private _chaseSpeed: number = ENEMY_CHASE_SPEED;
  private _attackCooldown: number = ENEMY_ATTACK_COOLDOWN;

  // ── Timers de IA ───────────────────────────────────────
  private _nextAttackTime: number = 0;
  private _patrolDirection: number = 1; // 1 = direita, -1 = esquerda
  private _patrolChangeTime: number = 0;
  private _stateEndTime: number = 0;

  // ── Timers de ataque ───────────────────────────────────
  private _attackTimers: Phaser.Time.TimerEvent[] = [];

  // ── Referência ao jogador ──────────────────────────────
  private _player?: Fighter;

  // ── Referência ao PlayerState (para score) ─────────────
  private _playerState?: { addScore: (points: number) => void };

  // ── Flag para Object Pooling ───────────────────────────
  private _isActive: boolean = true;

  // ── Flag para evitar overlaps duplicados ───────────────
  private _overlapRegistered: boolean = false;

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

    // ── Inicializa timers ────────────────────────────────
    this._nextAttackTime = scene.time.now + this._attackCooldown;
    this._patrolChangeTime = scene.time.now + ENEMY_PATROL_CHANGE_TIME;
  }

  // ═══════════════════════════════════════════════════════
  // OBJECT POOLING
  // ═══════════════════════════════════════════════════════

  /**
   * Reseta o inimigo para reutilização no pool.
   */
  resetEnemy(x: number, y: number, config?: EnemyConfig): void {
    // Aplica configuração customizada
    if (config) {
      if (config.hp !== undefined) this._hpMax = config.hp;
      if (config.aggroRadius !== undefined) this._aggroRadius = config.aggroRadius;
      if (config.attackRadius !== undefined) this._attackRadius = config.attackRadius;
      if (config.patrolSpeed !== undefined) this._patrolSpeed = config.patrolSpeed;
      if (config.chaseSpeed !== undefined) this._chaseSpeed = config.chaseSpeed;
      if (config.attackCooldown !== undefined) this._attackCooldown = config.attackCooldown;
    } else {
      // Reset para valores padrão
      this._hpMax = ENEMY_HP_MAX;
      this._aggroRadius = ENEMY_AGGRO_RADIUS;
      this._attackRadius = ENEMY_ATTACK_RADIUS;
      this._patrolSpeed = ENEMY_PATROL_SPEED;
      this._chaseSpeed = ENEMY_CHASE_SPEED;
      this._attackCooldown = ENEMY_ATTACK_COOLDOWN;
    }

    // Reset HP
    this._hp = this._hpMax;

    // Cancela qualquer ataque em andamento
    this._cancelAttackTimers();

    // Reset estado
    this._aiState = EnemyAIState.IDLE;
    this._fighterState = FighterState.Idle;
    this._isActive = true;
    this.setActive(true);

    // Reset posição
    this.setPosition(x, y);
    this._shadow.setPosition(x, y);

    // Reativa corpo físico
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(0, 0);

    // Reset eixo Z
    this._jumpHeight = 0;
    this._jumpVelocity = 0;
    this._isGrounded = true;
    this._appliedJumpOffset = 0;

    // Torna visível
    this.setVisible(true);
    this.setAlpha(1);

    // Mostra barra de vida e sombra
    this._hpBarBg.setVisible(true);
    this._hpBar.setVisible(true);
    this._shadow.setVisible(true);

    // Reset hitbox
    this._currentAttack = undefined;
    this._hitboxBody.enable = false;

    // Reset invulnerabilidade
    this._invulnerableUntil = 0;
    this._stopBlink();

    // Reset timers
    const now = this.scene.time.now;
    this._nextAttackTime = now + this._attackCooldown;
    this._patrolChangeTime = now + ENEMY_PATROL_CHANGE_TIME;
    this._patrolDirection = 1;

    // Atualiza animação
    this._updateAnimationFromState();

    // Atualiza barra de vida
    this._updateHPBar();
  }

  /**
   * Define o jogador para a IA perseguir.
   */
  setPlayer(player: Fighter): void {
    this._player = player;
  }

  /**
   * Define o PlayerState para somar pontos ao matar.
   */
  setPlayerState(playerState: { addScore: (points: number) => void }): void {
    this._playerState = playerState;
  }

  /**
   * Verifica se o inimigo está ativo (para pooling).
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Verifica se o overlap já foi registrado (para evitar duplicatas).
   */
  get overlapRegistered(): boolean {
    return this._overlapRegistered;
  }

  /**
   * Marca que o overlap foi registrado.
   */
  markOverlapRegistered(): void {
    this._overlapRegistered = true;
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════

  update(_time: number, delta: number): void {
    if (!this._isActive) return;

    // Atualiza eixo Z
    this._updateJumpAxis(delta);

    // FSM de IA
    this._updateAI(delta);

    // Atualiza timers de estado (hurt/knockdown)
    this._updateStateTimers();

    // Atualiza profundidade
    this._updateDepth();

    // Atualiza barra de vida
    this._updateHPBar();
  }

  /**
   * Chamado no postupdate da GameScene.
   */
  postPhysicsUpdate(): void {
    if (!this._isActive) return;

    // Desfaz o offset visual do frame anterior
    this.undoJumpVisualOffset();
    this.clampToWalkZone();
    this.applyJumpVisualOffset();
    this._updateHitboxPosition();
    this._updateHPBarPosition();
  }

  // ═══════════════════════════════════════════════════════
  // FSM DE IA
  // ═══════════════════════════════════════════════════════

  private _updateAI(delta: number): void {
    // DEAD: não faz nada
    if (this._aiState === EnemyAIState.DEAD) return;

    // HURT: aplica atrito no chão, não zera velocidade
    if (this._aiState === EnemyAIState.HURT) {
      this._applyGroundFriction(delta);
      return;
    }

    // ATTACK: aguarda fim do ataque
    if (this._aiState === EnemyAIState.ATTACK) {
      return;
    }

    // Se não tem jogador, fica em IDLE
    if (!this._player || this._player.fighterState === FighterState.Dead) {
      this._changeAIState(EnemyAIState.IDLE);
      return;
    }

    // Usa groundY do jogador (posição real do chão, sem offset visual)
    const playerGroundY = this._player.groundY;
    const dx = this._player.x - this.x;
    const dy = playerGroundY - this.groundY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Transições de estado baseadas em dx/dy separados
    if (absDx <= this._attackRadius && absDy <= LANE_TOLERANCE) {
      // Dentro do raio de ataque E alinhado na faixa
      if (this.scene.time.now >= this._nextAttackTime) {
        this._changeAIState(EnemyAIState.ATTACK);
      } else {
        this._changeAIState(EnemyAIState.IDLE);
      }
    } else if (absDx <= this._aggroRadius) {
      // Dentro do raio de aggro (mas não alinhado ou fora do raio de ataque)
      this._changeAIState(EnemyAIState.CHASE);
    } else {
      // Fora do raio de aggro
      if (this._aiState !== EnemyAIState.PATROL && this._aiState !== EnemyAIState.IDLE) {
        this._changeAIState(EnemyAIState.IDLE);
      }
    }

    // Comportamentos de estado
    if (this._aiState === EnemyAIState.IDLE) {
      this._behaviorIdle(delta);
    } else if (this._aiState === EnemyAIState.PATROL) {
      this._behaviorPatrol(delta);
    } else if (this._aiState === EnemyAIState.CHASE) {
      this._behaviorChase(delta);
    } else if (this._aiState === EnemyAIState.ATTACK) {
      this._behaviorAttack();
    }
  }

  private _changeAIState(newState: EnemyAIState): void {
    if (this._aiState === newState) return;
    this._aiState = newState;
  }

  // ═══════════════════════════════════════════════════════
  // COMPORTAMENTOS
  // ═══════════════════════════════════════════════════════

  private _behaviorIdle(_delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Transiciona para PATROL após um tempo
    if (this.scene.time.now >= this._patrolChangeTime) {
      this._changeAIState(EnemyAIState.PATROL);
      this._patrolChangeTime = this.scene.time.now + ENEMY_PATROL_CHANGE_TIME;
    }

    // Atualiza estado do Fighter
    if (this._fighterState !== FighterState.Idle) {
      this.changeState(FighterState.Idle);
    }
  }

  private _behaviorPatrol(_delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Move na direção da patrulha
    body.setVelocityX(this._patrolSpeed * this._patrolDirection);
    body.setVelocityY(0);

    // Atualiza facing
    this.setFacing(this._patrolDirection > 0);

    // Inverte direção ao bater nos limites ou após tempo
    if (this.x <= 20 || this.x >= WORLD_WIDTH - 20) {
      this._patrolDirection *= -1;
    } else if (this.scene.time.now >= this._patrolChangeTime) {
      this._patrolDirection *= -1;
      this._patrolChangeTime = this.scene.time.now + ENEMY_PATROL_CHANGE_TIME;
    }

    // Atualiza estado do Fighter
    if (this._fighterState !== FighterState.Walk) {
      this.changeState(FighterState.Walk);
    }
  }

  private _behaviorChase(_delta: number): void {
    if (!this._player) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const playerGroundY = this._player.groundY;
    const dx = this._player.x - this.x;
    const dy = playerGroundY - this.groundY;

    // Atualiza facing para olhar para o jogador
    this.setFacing(dx > 0);

    // Alinha na pista do jogador (eixo Y)
    if (Math.abs(dy) > ENEMY_LANE_ALIGN_TOLERANCE) {
      const yDir = dy > 0 ? 1 : -1;
      body.setVelocityY(this._chaseSpeed * yDir * 0.7); // mais lento no Y
    } else {
      body.setVelocityY(0);
    }

    // Move no eixo X em direção ao jogador
    const xDir = dx > 0 ? 1 : -1;
    body.setVelocityX(this._chaseSpeed * xDir);

    // Atualiza estado do Fighter
    if (this._fighterState !== FighterState.Walk) {
      this.changeState(FighterState.Walk);
    }
  }

  private _behaviorAttack(): void {
    if (!this._player) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Atualiza facing para olhar para o jogador
    const dx = this._player.x - this.x;
    this.setFacing(dx > 0);

    // Inicia o ataque
    this._startAttack();
  }

  // ═══════════════════════════════════════════════════════
  // ATAQUE
  // ═══════════════════════════════════════════════════════

  private _startAttack(): void {
    // Cancela timers anteriores
    this._cancelAttackTimers();

    this._currentAttack = ENEMY_ATTACK;
    this._attackStartTime = this.scene.time.now;
    this._aiState = EnemyAIState.ATTACK;
    this.changeState(FighterState.Attack, true);

    const totalTime = ENEMY_ATTACK.startup + ENEMY_ATTACK.active + ENEMY_ATTACK.recovery;

    // Ativa hitbox
    const t1 = this.scene.time.delayedCall(ENEMY_ATTACK.startup, () => {
      if (this._aiState === EnemyAIState.ATTACK && this._isActive) {
        this._hitboxBody.enable = true;
        this._hitboxBody.setSize(ENEMY_ATTACK.hitboxWidth, ENEMY_ATTACK.hitboxHeight);
      }
    });
    this._attackTimers.push(t1);

    // Desativa hitbox
    const t2 = this.scene.time.delayedCall(ENEMY_ATTACK.startup + ENEMY_ATTACK.active, () => {
      this._hitboxBody.enable = false;
    });
    this._attackTimers.push(t2);

    // Fim do ataque
    const t3 = this.scene.time.delayedCall(totalTime, () => {
      this._endAttack();
    });
    this._attackTimers.push(t3);
  }

  /**
   * Cancela todos os timers de ataque agendados.
   */
  private _cancelAttackTimers(): void {
    for (const timer of this._attackTimers) {
      if (timer && !timer.hasDispatched) {
        timer.remove(false);
      }
    }
    this._attackTimers = [];
  }

  /**
   * Cancela o ataque atual (chamado ao levar dano).
   */
  private _cancelAttack(): void {
    this._cancelAttackTimers();
    this._currentAttack = undefined;
    this._hitboxBody.enable = false;
  }

  private _endAttack(): void {
    // Só muda o estado se ainda estiver em ATTACK
    if (this._aiState !== EnemyAIState.ATTACK) {
      this._currentAttack = undefined;
      this._hitboxBody.enable = false;
      return;
    }

    this._currentAttack = undefined;
    this._hitboxBody.enable = false;
    this._nextAttackTime = this.scene.time.now + this._attackCooldown;
    this._aiState = EnemyAIState.IDLE;
    this.changeState(FighterState.Idle);
  }

  private _updateHitboxPosition(): void {
    if (!this._hitboxBody.enable || !this._currentAttack) return;
    const offsetX = this._facingRight ? 15 : -15;
    this._hitboxZone.setPosition(this.x + offsetX, this.groundY - 10);
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
    if (!this._isActive) return false;

    // Cancela o ataque atual antes de mudar o estado
    this._cancelAttack();

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

      // Muda estado da IA
      this._aiState = EnemyAIState.HURT;
    }

    return died;
  }

  private _handleDeath(): void {
    // Cancela qualquer ataque em andamento
    this._cancelAttack();

    this._aiState = EnemyAIState.DEAD;
    this.changeState(FighterState.Dead);
    this._hitboxBody.enable = false;

    // Desabilita corpo físico
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    // Soma pontos
    if (this._playerState) {
      this._playerState.addScore(ENEMY_SCORE_VALUE);
    }

    // Emite evento com posição para partículas
    this.scene.game.events.emit(EVENTS.ENEMY_DIED, this, this.x, this.groundY);

    // Marca como inativo para pooling
    this._isActive = false;
    this.setActive(false);

    // Esconde barra de vida e sombra explicitamente
    this._hpBarBg.setVisible(false);
    this._hpBar.setVisible(false);
    this._shadow.setVisible(false);

    // Torna invisível após animação
    this.scene.time.delayedCall(500, () => {
      this.setVisible(false);
    });
  }

  // ═══════════════════════════════════════════════════════
  // TIMERS
  // ═══════════════════════════════════════════════════════

  private _updateStateTimers(): void {
    const now = this.scene.time.now;

    // Hurt/Knockdown
    if ((this._fighterState === FighterState.Hurt || this._fighterState === FighterState.Knockdown) && now >= this._stateEndTime) {
      this._aiState = EnemyAIState.IDLE;
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
    this._hpBarBg.setPosition(this.x, this.y - 38);
    this._hpBar.setPosition(this.x, this.y - 38);
    this._hpBarBg.setDepth(this.groundY + 1);
    this._hpBar.setDepth(this.groundY + 1);
  }

  // ═══════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════

  cleanup(): void {
    super.cleanup();
    this._cancelAttackTimers();
    this._hpBarBg.destroy();
    this._hpBar.destroy();
    this._hitboxZone.destroy();
  }

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get aiState(): EnemyAIState {
    return this._aiState;
  }
}
