/**
 * Boss.ts
 * ─────────────────────────────────────────────────────────
 * Classe do Boss. Herda de Fighter.
 * 
 * Características:
 * - Múltiplas hurtboxes (corpo, cabeça, cauda)
 * - Sistema de poise (super armor)
 * - Padrões de ataque com telegraph
 * - Duas fases (50% HP)
 * - Estados: intro, idle, telegraph, attacking, recover, stagger, transition, dead
 */

import Phaser from 'phaser';
import { Fighter, FighterState } from './Fighter';
import {
  BOSS_HP,
  BOSS_POISE_MAX,
  BOSS_POISE_REGEN_RATE,
  BOSS_STAGGER_DURATION,
  BOSS_HURTBOXES,
  BossHurtboxData,
  BOSS_ATTACKS,
  BossAttackData,
  BossAttackType,
  BOSS_DECISION_DELAY,
  BOSS_PHASE2_DECISION_DELAY,
  BOSS_PHASE_TRANSITION_HP,
  BOSS_LANE_TOLERANCE,
  STAGGER_DAMAGE_MULT,
} from '../config/boss';
import { EVENTS } from '../config/constants';

/**
 * Estados específicos do boss.
 */
export enum BossState {
  Intro = 'intro',
  Idle = 'idle',
  Telegraph = 'telegraph',
  Attacking = 'attacking',
  Recover = 'recover',
  Stagger = 'stagger',
  Transition = 'transition',
  Dead = 'dead',
}

/**
 * Parte do corpo do boss (hurtbox).
 */
export class BossHurtbox {
  zone: Phaser.GameObjects.Zone;
  body: Phaser.Physics.Arcade.Body;
  data: BossHurtboxData;
  currentDurability?: number;
  isBroken: boolean = false;

  constructor(scene: Phaser.Scene, data: BossHurtboxData) {
    this.data = data;
    this.currentDurability = data.durability;

    // Cria a zone
    this.zone = scene.add.zone(0, 0, data.width, data.height);
    scene.physics.add.existing(this.zone);
    this.body = this.zone.body as Phaser.Physics.Arcade.Body;
    this.body.enable = false;
    this.body.setAllowGravity(false);
  }

  /**
   * Aplica dano à durabilidade (para cauda).
   */
  applyDurabilityDamage(amount: number): boolean {
    if (this.currentDurability === undefined) return false;
    
    this.currentDurability = Math.max(0, this.currentDurability - amount);
    if (this.currentDurability <= 0) {
      this.isBroken = true;
      return true; // Quebrou
    }
    return false;
  }

  /**
   * Atualiza a posição da hurtbox.
   */
  updatePosition(x: number, y: number, facingRight: boolean): void {
    const offsetX = facingRight ? this.data.offsetX : -this.data.offsetX;
    this.zone.setPosition(x + offsetX, y - this.data.zMax);
  }

  /**
   * Ativa/desativa a hurtbox.
   */
  setActive(active: boolean): void {
    this.body.enable = active;
    this.zone.setVisible(active);
  }

  destroy(): void {
    this.zone.destroy();
  }
}

/**
 * Classe do Boss.
 */
export class Boss extends Fighter {
  // ── Estado do Boss ───────────────────────────────────────
  private _bossState: BossState = BossState.Intro;
  private _phase: number = 1; // 1 ou 2

  // ── Poise ────────────────────────────────────────────────
  private _poise: number = BOSS_POISE_MAX;
  private _staggerEndTime: number = 0;

  // ── Hurtboxes ────────────────────────────────────────────
  private _hurtboxes: BossHurtbox[] = [];
  private _tailHurtbox?: BossHurtbox;

  // ── Ataques ──────────────────────────────────────────────
  private _currentAttack?: BossAttackData;
  private _attackTimers: Phaser.Time.TimerEvent[] = [];
  private _lastAttacks: BossAttackType[] = []; // Para evitar repetição
  private _decisionTimer?: Phaser.Time.TimerEvent;

  // ── Referência ao jogador ────────────────────────────────
  private _player?: Fighter;

  // ── Invulnerabilidade temporária ─────────────────────────
  private _isInvulnerable: boolean = false;

  // ── Flag de debug ────────────────────────────────────────
  private _aiFrozen: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'boss_idle', BOSS_HP);

    // Cria as hurtboxes
    this._createHurtboxes();

    // Inicia no estado intro
    this._bossState = BossState.Intro;
  }

  // ═══════════════════════════════════════════════════════
  // HURTBOXES
  // ═══════════════════════════════════════════════════════

  private _createHurtboxes(): void {
    for (const data of BOSS_HURTBOXES) {
      const hurtbox = new BossHurtbox(this.scene, data);
      this._hurtboxes.push(hurtbox);

      if (data.name === 'tail') {
        this._tailHurtbox = hurtbox;
      }
    }
  }

  /**
   * Atualiza a posição de todas as hurtboxes.
   */
  private _updateHurtboxPositions(): void {
    for (const hurtbox of this._hurtboxes) {
      if (!hurtbox.isBroken) {
        hurtbox.updatePosition(this.x, this.y, this._facingRight);
      }
    }
  }

  /**
   * Ativa/desativa todas as hurtboxes.
   */
  private _setAllHurtboxesActive(active: boolean): void {
    for (const hurtbox of this._hurtboxes) {
      if (!hurtbox.isBroken) {
        hurtbox.setActive(active);
      }
    }
  }

  /**
   * Retorna todas as hurtboxes ativas.
   */
  getActiveHurtboxes(): BossHurtbox[] {
    return this._hurtboxes.filter(h => !h.isBroken);
  }

  // ═══════════════════════════════════════════════════════
  // POISE E STAGGER
  // ═══════════════════════════════════════════════════════

  /**
   * Reduz o poise e verifica stagger.
   */
  private _reducePoise(amount: number): void {
    this._poise = Math.max(0, this._poise - amount);
    this.scene.game.events.emit(EVENTS.BOSS_POISE_CHANGED, this._poise, BOSS_POISE_MAX);

    if (this._poise <= 0) {
      this._enterStagger();
    }
  }

  /**
   * Regenera o poise ao longo do tempo.
   */
  private _regenPoise(delta: number): void {
    if (this._bossState === BossState.Stagger) return;
    if (this._poise >= BOSS_POISE_MAX) return;

    this._poise = Math.min(BOSS_POISE_MAX, this._poise + BOSS_POISE_REGEN_RATE * (delta / 1000));
    this.scene.game.events.emit(EVENTS.BOSS_POISE_CHANGED, this._poise, BOSS_POISE_MAX);
  }

  /**
   * Entra em stagger.
   */
  private _enterStagger(): void {
    if (this._bossState === BossState.Dead || this._bossState === BossState.Transition) return;

    this._bossState = BossState.Stagger;
    this._staggerEndTime = this.scene.time.now + BOSS_STAGGER_DURATION;
    this._cancelAttack();
    this._setAllHurtboxesActive(true);

    this.scene.game.events.emit(EVENTS.BOSS_STAGGER);
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════

  update(_time: number, delta: number): void {
    if (this._bossState === BossState.Dead) return;

    // Atualiza eixo Z
    this._updateJumpAxis(delta);

    // Regenera poise
    this._regenPoise(delta);

    // Atualiza timers de estado
    this._updateStateTimers();

    // Atualiza hurtboxes
    this._updateHurtboxPositions();

    // Atualiza profundidade
    this._updateDepth();

    // IA (se não estiver congelada)
    if (!this._aiFrozen) {
      this._updateAI();
    }
  }

  /**
   * Chamado no postupdate da GameScene.
   */
  postPhysicsUpdate(): void {
    this.undoJumpVisualOffset();
    this.clampToWalkZone();
    this.applyJumpVisualOffset();
  }

  // ═══════════════════════════════════════════════════════
  // IA
  // ═══════════════════════════════════════════════════════

  private _updateAI(): void {
    // Não decide se estiver ocupado
    if (this._bossState === BossState.Telegraph ||
        this._bossState === BossState.Attacking ||
        this._bossState === BossState.Stagger ||
        this._bossState === BossState.Transition) {
      return;
    }

    // Se não tem decision timer, cria um
    if (!this._decisionTimer) {
      const delay = this._phase === 1 ? BOSS_DECISION_DELAY : BOSS_PHASE2_DECISION_DELAY;
      this._decisionTimer = this.scene.time.addEvent({
        delay,
        loop: true,
        callback: () => this._makeDecision(),
      });
    }
  }

  /**
   * Decide qual ataque usar.
   */
  private _makeDecision(): void {
    if (!this._player) return;
    if (this._bossState !== BossState.Idle && this._bossState !== BossState.Recover) return;

    // Escolhe ataque aleatório ponderado
    const attackType = this._chooseAttack();
    this._startAttack(attackType);
  }

  /**
   * Escolhe um ataque evitando repetição.
   */
  private _chooseAttack(): BossAttackType {
    const types: BossAttackType[] = ['charge', 'projectile', 'aoe'];
    
    // Filtra ataques que não foram usados nas últimas 2 vezes
    const available = types.filter(t => {
      const recentUses = this._lastAttacks.filter(a => a === t).length;
      return recentUses < 2;
    });

    // Se todos foram usados recentemente, escolhe qualquer um
    const pool = available.length > 0 ? available : types;
    const chosen = Phaser.Utils.Array.GetRandom(pool);

    // Atualiza histórico
    this._lastAttacks.push(chosen);
    if (this._lastAttacks.length > 2) {
      this._lastAttacks.shift();
    }

    return chosen;
  }

  // ═══════════════════════════════════════════════════════
  // ATAQUES
  // ═══════════════════════════════════════════════════════

  private _startAttack(type: BossAttackType): void {
    const attackData = BOSS_ATTACKS[type];
    this._currentAttack = attackData;

    // Telegraph
    this._bossState = BossState.Telegraph;
    this._setAllHurtboxesActive(false); // Invulnerável durante telegraph

    // Agenda o ataque ativo
    const telegraphTimer = this.scene.time.delayedCall(attackData.telegraphDuration, () => {
      this._executeAttack(type);
    });
    this._attackTimers.push(telegraphTimer);
  }

  private _executeAttack(type: BossAttackType): void {
    if (this._bossState === BossState.Dead || this._bossState === BossState.Transition) return;

    this._bossState = BossState.Attacking;
    this._setAllHurtboxesActive(true); // Vulnerável durante o ataque

    const attackData = this._currentAttack!;

    // Executa o ataque específico
    switch (type) {
      case 'charge':
        this._executeCharge();
        break;
      case 'projectile':
        this._executeProjectile();
        break;
      case 'aoe':
        this._executeAoE();
        break;
    }

    // Agenda o recovery
    const activeTimer = this.scene.time.delayedCall(attackData.activeDuration, () => {
      this._enterRecovery();
    });
    this._attackTimers.push(activeTimer);
  }

  private _executeCharge(): void {
    if (!this._player) return;

    const attackData = this._currentAttack!;
    const speed = attackData.speed!;
    const direction = this._facingRight ? 1 : -1;

    // Move o boss
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(speed * direction);

    // Para após a duração
    const stopTimer = this.scene.time.delayedCall(attackData.activeDuration, () => {
      body.setVelocityX(0);
    });
    this._attackTimers.push(stopTimer);
  }

  private _executeProjectile(): void {
    // Emite evento para a GameScene criar o projétil
    const count = this._phase === 1 ? 1 : 3;
    const speedMult = this._phase === 1 ? 1 : 1.4;

    this.scene.game.events.emit('boss:projectile', {
      x: this.x,
      y: this.y,
      count,
      speedMult,
      facingRight: this._facingRight,
    });
  }

  private _executeAoE(): void {
    // Emite evento para a GameScene criar a área de dano
    this.scene.game.events.emit('boss:aoe', {
      x: this.x,
      y: this.y,
      width: this._currentAttack!.hitboxWidth,
      height: this._currentAttack!.hitboxHeight,
    });
  }

  private _enterRecovery(): void {
    if (this._bossState === BossState.Dead || this._bossState === BossState.Transition) return;

    this._bossState = BossState.Recover;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);

    // Agenda volta ao idle
    const recoverTimer = this.scene.time.delayedCall(this._currentAttack!.recoveryDuration, () => {
      if (this._bossState !== BossState.Dead && this._bossState !== BossState.Transition) {
        this._bossState = BossState.Idle;
        this._setAllHurtboxesActive(true);
      }
    });
    this._attackTimers.push(recoverTimer);
  }

  private _cancelAttack(): void {
    // Cancela todos os timers
    for (const timer of this._attackTimers) {
      if (timer && !timer.hasDispatched) {
        timer.remove(false);
      }
    }
    this._attackTimers = [];

    // Para o movimento
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);

    this._currentAttack = undefined;
  }

  // ═══════════════════════════════════════════════════════
  // DANO
  // ═══════════════════════════════════════════════════════

  /**
   * Aplica dano ao boss em uma hurtbox específica.
   */
  takeBossDamage(hurtbox: BossHurtbox, baseDamage: number, knockbackX: number = 0): boolean {
    if (this._isInvulnerable) return false;
    if (this._bossState === BossState.Dead || this._bossState === BossState.Transition) return false;
    if (this._bossState === BossState.Telegraph) return false; // Invulnerável durante telegraph

    // Calcula dano final
    let damage = baseDamage * hurtbox.data.damageMultiplier;

    // Bônus durante stagger
    if (this._bossState === BossState.Stagger) {
      damage *= STAGGER_DAMAGE_MULT;
    }

    // Aplica dano ao HP
    this._hp = Math.max(0, this._hp - damage);
    this.scene.game.events.emit(EVENTS.BOSS_HP_CHANGED, this._hp, BOSS_HP);

    // Aplica dano à durabilidade (se tiver)
    if (hurtbox.data.durability && !hurtbox.isBroken) {
      const broke = hurtbox.applyDurabilityDamage(damage);
      if (broke) {
        // Cauda quebrou
        hurtbox.setActive(false);
        this._enterStagger();
        this.scene.game.events.emit('boss:tail:broken');
      }
    }

    // Reduz poise (super armor)
    this._reducePoise(damage * 0.5);

    // Emite evento de dano
    this.scene.game.events.emit(EVENTS.BOSS_HP_CHANGED, this._hp, BOSS_HP);

    // Verifica morte
    if (this._hp <= 0) {
      this._handleDeath();
      return true;
    }

    // Verifica transição de fase
    if (this._phase === 1 && this._hp <= BOSS_HP * BOSS_PHASE_TRANSITION_HP) {
      this._startPhaseTransition();
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════
  // FASES
  // ═══════════════════════════════════════════════════════

  private _startPhaseTransition(): void {
    this._bossState = BossState.Transition;
    this._isInvulnerable = true;
    this._cancelAttack();
    this._setAllHurtboxesActive(false);

    // Emite evento para a GameScene iniciar a cutscene
    this.scene.game.events.emit('boss:phase:transition');
  }

  /**
   * Chamado pela GameScene após a cutscene.
   */
  enterPhase2(): void {
    this._phase = 2;
    this._isInvulnerable = false;
    this._bossState = BossState.Idle;
    this._poise = BOSS_POISE_MAX;
    this._setAllHurtboxesActive(true);

    // Troca textura para fase 2
    this.setTexture('boss_phase2');

    // Reinicia decision timer com delay menor
    if (this._decisionTimer) {
      this._decisionTimer.remove(false);
      this._decisionTimer = undefined;
    }

    this.scene.game.events.emit(EVENTS.BOSS_PHASE_CHANGED, 2);
  }

  // ═══════════════════════════════════════════════════════
  // MORTE
  // ═══════════════════════════════════════════════════════

  private _handleDeath(): void {
    this._bossState = BossState.Dead;
    this._cancelAttack();
    this._setAllHurtboxesActive(false);

    // Remove decision timer
    if (this._decisionTimer) {
      this._decisionTimer.remove(false);
      this._decisionTimer = undefined;
    }

    this.scene.game.events.emit(EVENTS.BOSS_DIED);
  }

  // ═══════════════════════════════════════════════════════
  // TIMERS DE ESTADO
  // ═══════════════════════════════════════════════════════

  private _updateStateTimers(): void {
    const now = this.scene.time.now;

    // Stagger
    if (this._bossState === BossState.Stagger && now >= this._staggerEndTime) {
      this._bossState = BossState.Idle;
      this._poise = BOSS_POISE_MAX;
      this._setAllHurtboxesActive(true);
    }
  }

  // ═══════════════════════════════════════════════════════
  // DEBUG
  // ═══════════════════════════════════════════════════════

  /**
   * Congela/descongela a IA.
   */
  toggleAIFreeze(): void {
    this._aiFrozen = !this._aiFrozen;
  }

  get aiFrozen(): boolean {
    return this._aiFrozen;
  }

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get bossState(): BossState {
    return this._bossState;
  }

  get phase(): number {
    return this._phase;
  }

  get poise(): number {
    return this._poise;
  }

  get poiseMax(): number {
    return BOSS_POISE_MAX;
  }

  get isStaggered(): boolean {
    return this._bossState === BossState.Stagger;
  }

  get currentAttack(): BossAttackData | undefined {
    return this._currentAttack;
  }

  /**
   * Define o jogador alvo.
   */
  setPlayer(player: Fighter): void {
    this._player = player;
  }

  /**
   * Inicia a luta (sai do intro).
   */
  startFight(): void {
    this._bossState = BossState.Idle;
    this._setAllHurtboxesActive(true);
  }

  /**
   * Cleanup ao destruir.
   */
  cleanup(): void {
    super.cleanup();
    this._cancelAttack();
    
    if (this._decisionTimer) {
      this._decisionTimer.remove(false);
    }

    for (const hurtbox of this._hurtboxes) {
      hurtbox.destroy();
    }
  }
}
