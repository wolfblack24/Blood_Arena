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
  STAMINA_REGEN_RATE,
  COMBO_WINDOW,
  INPUT_BUFFER,
  KNOCKDOWN_DURATION,
  HURT_STUN_DURATION,
  INVULNERABILITY_DURATION,
  LANE_TOLERANCE,
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
  private _hitTargets: Set<Fighter> = new Set();
  private _canStartNewCombo: boolean = true;

  // ── Buffer de input ────────────────────────────────────
  private _attackBufferUntil: number = 0;

  // ── Timers de ataque ───────────────────────────────────
  private _attackTimers: Phaser.Time.TimerEvent[] = [];

  // ── Timers de estado ───────────────────────────────────
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

    // Aplica atrito no chão durante Hurt/Knockdown
    if (this._fighterState === FighterState.Hurt || this._fighterState === FighterState.Knockdown) {
      this._applyGroundFriction(delta);
    }

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
    // Desfaz o offset visual do frame anterior
    this.undoJumpVisualOffset();
    this.clampToWalkZone();
    this.applyJumpVisualOffset();
    this._updateHitboxPosition();
  }

  // ═══════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════

  private _processInput(_delta: number): void {
    if (this._fighterState === FighterState.Dead) return;

    // Resetar a permissão de novo combo se a tecla de ataque for solta
    if (!this._attackKey.isDown) {
      this._canStartNewCombo = true;
    }

    // Captura buffer de input para ataque
    if (Phaser.Input.Keyboard.JustDown(this._attackKey)) {
      this._attackBufferUntil = this.scene.time.now + INPUT_BUFFER;
    }

    // Processar ataque primeiro para permitir combos durante a animação
    this._handleAttack();

    // Bloquear movimento e outras ações durante estados restritivos
    if (this._fighterState === FighterState.Hurt ||
        this._fighterState === FighterState.Knockdown ||
        this._fighterState === FighterState.Attack) {
      return;
    }

    this._handleMovement();
    this._handleJump();
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

    // Não pode atacar em Hurt, Knockdown ou Dead
    if (this._fighterState === FighterState.Hurt ||
        this._fighterState === FighterState.Knockdown ||
        this._fighterState === FighterState.Dead) {
      return;
    }

    // Se já está atacando, verifica se pode encadear combo
    if (this._fighterState === FighterState.Attack && this._currentAttack) {
      const totalTime = this._currentAttack.startup + this._currentAttack.active + this._currentAttack.recovery;
      const elapsed = now - this._attackStartTime;

      // Só permite encadear se estiver na janela de combo no final da animação
      if (elapsed >= totalTime - COMBO_WINDOW && elapsed < totalTime) {
        // Avança o combo com módulo (3º golpe volta ao 1º)
        this._comboIndex = (this._comboIndex + 1) % PLAYER_ATTACKS.length;
        this._startAttack();
      }
      // Se não está na janela, ignora o input (evita spam)
      return;
    }

    // Se não está atacando, só inicia novo ataque se pode começar novo combo
    // (evita loop infinito quando a tecla está segurada)
    if (!this._canStartNewCombo) return;

    // Verifica buffer de input
    if (now > this._attackBufferUntil) return;

    // Limpa o buffer
    this._attackBufferUntil = 0;

    // Verifica janela de combo para incrementar o índice
    if (now - this._lastAttackEndTime < COMBO_WINDOW) {
      // Avança o combo com módulo (3º golpe volta ao 1º)
      this._comboIndex = (this._comboIndex + 1) % PLAYER_ATTACKS.length;
    } else {
      this._comboIndex = 0;
    }

    this._startAttack();
  }

  private _startAttack(): void {
    const now = this.scene.time.now;

    // Bloqueia novo combo até que a tecla seja solta
    this._canStartNewCombo = false;

    // Cancela timers anteriores (encadeamento de combo)
    this._cancelAttackTimers();

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

    // Muda estado (forceRestart=true para encadeamento de combo)
    this.changeState(FighterState.Attack, true);

    // Deslize: zera velocidade no chão, mantém momentum no ar
    if (this._isGrounded) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
    }

    // Agenda ativação da hitbox
    const t1 = this.scene.time.delayedCall(attackData.startup, () => {
      this._activateHitbox();
    });
    this._attackTimers.push(t1);

    // Agenda desativação da hitbox
    const t2 = this.scene.time.delayedCall(attackData.startup + attackData.active, () => {
      this._deactivateHitbox();
    });
    this._attackTimers.push(t2);

    // Agenda fim do ataque
    const totalTime = attackData.startup + attackData.active + attackData.recovery;
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
   * Cancela o ataque atual (chamado ao levar dano, morrer ou respawnar).
   */
  private _cancelAttack(): void {
    this._cancelAttackTimers();
    this._currentAttack = undefined;
    this._deactivateHitbox();
    this._hitTargets.clear();
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
    // Só muda o estado se ainda estiver em Attack
    // (pode ter sido interrompido por dano)
    if (this._fighterState !== FighterState.Attack) {
      this._currentAttack = undefined;
      this._deactivateHitbox();
      return;
    }

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

    // Posiciona a hitbox na frente do jogador, usando groundY (sem offset visual)
    const offsetX = this._facingRight ? 15 : -15;
    this._hitboxZone.setPosition(this.groundX + offsetX, this.groundY - 10);
  }

  /**
   * Verifica se um alvo pode ser atingido por este ataque.
   * Usa groundY para validação de faixa (posição real do chão).
   */
  canHitTarget(target: Fighter): boolean {
    if (!this._currentAttack) return false;
    if (this._hitTargets.has(target)) return false;
    if (target.fighterState === FighterState.Dead || target.fighterState === FighterState.Knockdown) return false;
    if (target.isInvulnerable()) return false;

    // Valida profundidade usando groundY (posição real do chão)
    const laneDiff = Math.abs(this.groundY - target.groundY);
    const zDiff = Math.abs(this._jumpHeight - target.jumpHeight);
    if (laneDiff > LANE_TOLERANCE || zDiff > this._currentAttack.zTolerance) return false;

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

    // Cancela o ataque atual antes de mudar o estado
    this._cancelAttack();

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
    // Cancela qualquer ataque em andamento
    this._cancelAttack();

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
    // Cancela qualquer ataque em andamento
    this._cancelAttack();

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

  /**
   * Retorna o X do chão do lutador (sem offset visual).
   */
  get groundX(): number { return this.x; }
}
