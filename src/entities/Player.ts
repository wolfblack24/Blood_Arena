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
import { AttackData, PLAYER_ATTACKS, PLAYER_AIR_ATTACK, RISING_TACKLE } from '../config/attacks';
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
  SPECIAL_CHARGE_TIME,
  SPECIAL_STAMINA_COST,
  SPECIAL_COOLDOWN,
  RISING_TACKLE_JUMP_FORCE,
} from '../config/constants';
import {
  DASH_DURATION,
  DASH_SPEED,
  DASH_STAMINA_COST,
  DASH_COOLDOWN,
  DASH_IFRAMES_DURATION,
} from '../config/boss';

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
  private _dashKey!: Phaser.Input.Keyboard.Key;
  private _grabKey!: Phaser.Input.Keyboard.Key;
  private _specialKey!: Phaser.Input.Keyboard.Key;
  private _debugKey!: Phaser.Input.Keyboard.Key;

  // ── Combate ────────────────────────────────────────────
  private _hitboxZone!: Phaser.GameObjects.Zone;
  private _hitboxBody!: Phaser.Physics.Arcade.Body;
  private _currentAttack?: AttackData;
  private _attackStartTime: number = 0;
  private _comboIndex: number = 0;
  private _lastAttackEndTime: number = 0;
  private _hitTargets: Set<Fighter> = new Set();
  private _attackTimers?: Phaser.Time.TimerEvent[];

  // ── Buffer de input ────────────────────────────────────
  private _attackBufferTime: number = 0;

  // ── Esquiva (Dash) ─────────────────────────────────────
  private _isDashing: boolean = false;
  private _dashEndTime: number = 0;
  private _dashCooldownEnd: number = 0;

  // ── Rising Tackle (Ataque Especial) ────────────────────
  private _isChargingRisingTackle: boolean = false;
  private _chargeStartTime: number = 0;
  private _risingTackleCooldownEnd: number = 0;
  private _isRisingTackleActive: boolean = false;

  // ── Timers de estado ───────────────────────────────────
  private _stateEndTime: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerState: PlayerState
  ) {
    super(scene, x, y, 'player_idle', playerState.hpMax);

    // Ajuste o corpo físico do jogador também
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 32);
    body.setOffset(0, -32);

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
    this._dashKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this._specialKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K); // Rising Tackle usa a mesma tecla do dash
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

    // Atualiza dash
    this._updateDash();

    // Atualiza Rising Tackle
    this._updateRisingTackle();

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

    // Captura buffer de input para ataque
    if (Phaser.Input.Keyboard.JustDown(this._attackKey)) {
      this._attackBufferTime = this.scene.time.now + INPUT_BUFFER;
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
    this._handleDash();
    this._handleRisingTackle();
  }

  private _handleMovement(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Não permite mover no ar (mantém momentum)
    if (!this._isGrounded) return;

    // Não permite mover durante dash
    if (this._isDashing) return;

    // Não permite mover durante Rising Tackle
    if (this._isRisingTackleActive) return;

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
  // ESQUIVA (DASH)
  // ═══════════════════════════════════════════════════════

  private _handleDash(): void {
    // Não pode esquivar em estados restritivos
    if (this._fighterState === FighterState.Hurt ||
        this._fighterState === FighterState.Knockdown ||
        this._fighterState === FighterState.Dead ||
        this._fighterState === FighterState.Attack) {
      return;
    }

    // Não pode esquivar durante dash
    if (this._isDashing) return;

    // Verifica cooldown
    if (this.scene.time.now < this._dashCooldownEnd) return;

    // Verifica se a tecla foi pressionada
    if (!Phaser.Input.Keyboard.JustDown(this._dashKey)) return;

    // Verifica stamina
    if (!this._playerState.spendStamina(DASH_STAMINA_COST)) return;

    // Inicia dash
    this._startDash();
  }

  private _startDash(): void {
    this._isDashing = true;
    this._dashEndTime = this.scene.time.now + DASH_DURATION;
    this._dashCooldownEnd = this.scene.time.now + DASH_COOLDOWN;

    // Determina direção do dash
    let dashDirX = 0;
    let dashDirY = 0;

    if (this._cursors.left?.isDown || this._wasd.A.isDown) dashDirX -= 1;
    if (this._cursors.right?.isDown || this._wasd.D.isDown) dashDirX += 1;
    if (this._cursors.up?.isDown || this._wasd.W.isDown) dashDirY -= 1;
    if (this._cursors.down?.isDown || this._wasd.S.isDown) dashDirY += 1;

    // Se não houver direção, usa o facing
    if (dashDirX === 0 && dashDirY === 0) {
      dashDirX = this._facingRight ? 1 : -1;
    }

    // Normaliza
    if (dashDirX !== 0 && dashDirY !== 0) {
      const norm = 1 / Math.SQRT2;
      dashDirX *= norm;
      dashDirY *= norm;
    }

    // Calcula velocidade para percorrer ~64px em DASH_DURATION
    const dashDistance = 64; // pixels
    const dashSpeed = dashDistance / (DASH_DURATION / 1000); // pixels/seg

    // Aplica velocidade
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dashDirX * dashSpeed, dashDirY * dashSpeed);

    // Concede i-frames
    this.grantInvulnerability(DASH_IFRAMES_DURATION);
  }

  private _updateDash(): void {
    if (!this._isDashing) return;

    // Terminou o dash
    if (this.scene.time.now >= this._dashEndTime) {
      this._isDashing = false;
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
    }
  }

  // ═══════════════════════════════════════════════════════
  // RISING TACKLE (ATAQUE ESPECIAL)
  // ═══════════════════════════════════════════════════════

  private _handleRisingTackle(): void {
    // Verificação de segurança: _specialKey deve estar inicializado
    if (!this._specialKey) return;

    // Não pode carregar em estados restritivos
    if (this._fighterState === FighterState.Hurt ||
        this._fighterState === FighterState.Knockdown ||
        this._fighterState === FighterState.Dead ||
        this._fighterState === FighterState.Attack) {
      return;
    }

    // Não pode carregar durante dash ou Rising Tackle ativo
    if (this._isDashing || this._isRisingTackleActive) return;

    // Verifica cooldown
    if (this.scene.time.now < this._risingTackleCooldownEnd) return;

    // Detecta início do carregamento
    if (this._specialKey.isDown && !this._isChargingRisingTackle) {
      this._isChargingRisingTackle = true;
      this._chargeStartTime = this.scene.time.now;
    }

    // Detecta soltura da tecla após carregamento completo
    if (!this._specialKey.isDown && this._isChargingRisingTackle) {
      const chargeTime = this.scene.time.now - this._chargeStartTime;
      this._isChargingRisingTackle = false;

      // Verifica se carregou tempo suficiente
      if (chargeTime >= SPECIAL_CHARGE_TIME) {
        // Verifica stamina
        if (this._playerState.spendStamina(SPECIAL_STAMINA_COST)) {
          this._startRisingTackle();
        }
      }
    }
  }

  private _startRisingTackle(): void {
    // Verificação de segurança: RISING_TACKLE deve estar definido
    if (!RISING_TACKLE) {
      console.error('[CRITICAL ERROR] RISING_TACKLE is undefined!');
      return;
    }

    this._isRisingTackleActive = true;
    this._currentAttack = RISING_TACKLE;
    this._attackStartTime = this.scene.time.now;
    this._hitTargets.clear();

    // Muda estado para Attack
    this.changeState(FighterState.Attack);

    // Concede invulnerabilidade durante startup
    this.grantInvulnerability(RISING_TACKLE.startup);

    // Aplica pulo vertical
    this.jump(RISING_TACKLE_JUMP_FORCE);

    // Cancela velocidade horizontal
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);

    // Agenda ativação da hitbox (após startup)
    const activateTimer = this.scene.time.delayedCall(RISING_TACKLE.startup, () => {
      if (this._isRisingTackleActive) {
        this._activateHitbox();
      }
    });

    // Agenda desativação da hitbox (após active)
    const deactivateTimer = this.scene.time.delayedCall(
      RISING_TACKLE.startup + RISING_TACKLE.active,
      () => {
        this._deactivateHitbox();
      }
    );

    // Agenda fim do ataque (após recovery)
    const endTimer = this.scene.time.delayedCall(
      RISING_TACKLE.startup + RISING_TACKLE.active + RISING_TACKLE.recovery,
      () => {
        if (this._isRisingTackleActive) {
          this._endRisingTackle();
        }
      }
    );

    // Armazena timers
    this._attackTimers = [activateTimer, deactivateTimer, endTimer];
  }

  private _updateRisingTackle(): void {
    if (!this._isRisingTackleActive) return;

    // Atualiza posição da hitbox durante o pulo
    if (this._hitboxBody.enable) {
      this._updateHitboxPosition();
    }
  }

  private _endRisingTackle(): void {
    this._isRisingTackleActive = false;
    this._currentAttack = undefined;
    this._risingTackleCooldownEnd = this.scene.time.now + SPECIAL_COOLDOWN;

    // Volta ao estado idle ou walk
    if (this._isGrounded) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const isMoving = Math.abs(body.velocity.x) > 10 || Math.abs(body.velocity.y) > 10;
      this.changeState(isMoving ? FighterState.Walk : FighterState.Idle);
    } else {
      this.changeState(FighterState.Jump);
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

    // Verifica buffer de input
    if (now > this._attackBufferTime) return;

    // Se já está atacando, verifica se está na janela de combo
    if (this._fighterState === FighterState.Attack) {
        // Verifica se está na janela de combo
        const totalTime = this._currentAttack!.startup + this._currentAttack!.active + this._currentAttack!.recovery;
        const elapsed = now - this._attackStartTime;
        
        if (elapsed < totalTime && elapsed > totalTime - COMBO_WINDOW) {
            // Avança o combo com módulo (3º golpe volta ao 1º)
            this._comboIndex = (this._comboIndex + 1) % PLAYER_ATTACKS.length;
            // CANCELA OS TIMERS ANTERIORES antes de iniciar o próximo ataque
            this._cancelAttackTimers();
            this._startAttack();
        }
        return;
    }

    // Verifica janela de combo
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

    // Zera velocidade no chão (deslize zero), mantém momentum no ar
    if (this._isGrounded) {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);
    }

    // Agenda ativação da hitbox
    const activateTimer = this.scene.time.delayedCall(attackData.startup, () => {
        this._activateHitbox();
    });

    // Agenda desativação da hitbox
    const deactivateTimer = this.scene.time.delayedCall(attackData.startup + attackData.active, () => {
        this._deactivateHitbox();
    });

    // Agenda fim do ataque
    const totalTime = attackData.startup + attackData.active + attackData.recovery;
    const endTimer = this.scene.time.delayedCall(totalTime, () => {
        this._endAttack();
    });

    // Armazena os timers para poder cancelá-los
    this._attackTimers = [activateTimer, deactivateTimer, endTimer];
  }

  private _cancelAttackTimers(): void {
    if (this._attackTimers) {
        this._attackTimers.forEach(timer => {
            if (timer && !timer.hasDispatched) {
                timer.remove();
            }
        });
    }
    this._attackTimers = undefined;
  }

  private _endAttack(): void {
    this._currentAttack = undefined;
    this._lastAttackEndTime = this.scene.time.now;
    this._deactivateHitbox();
    this._cancelAttackTimers(); // Garante que todos os timers sejam limpos

    // Volta ao estado idle ou walk
    if (this._isGrounded) {
        const body = this.body as Phaser.Physics.Arcade.Body;
        const isMoving = Math.abs(body.velocity.x) > 10 || Math.abs(body.velocity.y) > 10;
        this.changeState(isMoving ? FighterState.Walk : FighterState.Idle);
    } else {
        this.changeState(FighterState.Jump);
    }
  }

  private _activateHitbox(): void {
    if (!this._currentAttack) return;
    
    this._hitboxBody.enable = true;
    this._hitboxBody.setSize(this._currentAttack.hitboxWidth, this._currentAttack.hitboxHeight);
    
    // Posiciona a hitbox na altura do tronco
    const offsetX = this._facingRight ? 15 : -15;
    const hitboxX = this.groundX + offsetX;
    const hitboxY = this.groundY - 25;
    
    this._hitboxZone.setPosition(hitboxX, hitboxY);
  }

  private _deactivateHitbox(): void {
    this._hitboxBody.enable = false;
  }

  /**
   * Cancela o ataque atual (chamado ao levar dano, morrer ou respawnar).
   */
  private _cancelAttack(): void {
    this._cancelAttackTimers();
    this._currentAttack = undefined;
    this._deactivateHitbox();
    this._hitTargets.clear();
    
    // Cancela Rising Tackle se estiver ativo
    if (this._isRisingTackleActive) {
      this._isRisingTackleActive = false;
      this._isChargingRisingTackle = false;
    }
  }

  private _updateHitboxPosition(): void {
    if (!this._hitboxBody.enable || !this._currentAttack) return;
    
    // Mesma altura do _activateHitbox
    const offsetX = this._facingRight ? 15 : -15;
    const hitboxX = this.groundX + offsetX;
    const hitboxY = this.groundY - 25;
    
    this._hitboxZone.setPosition(hitboxX, hitboxY);
  }

  /**
   * Verifica se um alvo pode ser atingido por este ataque.
   * Usa groundY para validação de faixa (posição real do chão).
   */
  canHitTarget(target: Fighter): boolean {
    if (!this._currentAttack) return false;
    if (this._hitTargets.has(target)) return false;
    if (target.fighterState === FighterState.Dead) return false;
    if (target.fighterState === FighterState.Knockdown) return false;
    if (target.isInvulnerable()) return false;
    
    // Valida profundidade usando groundY
    const laneDiff = Math.abs(this.groundY - target.groundY);
    const zDiff = Math.abs(this._jumpHeight - target.jumpHeight);
    
    if (laneDiff > LANE_TOLERANCE) return false;
    if (zDiff > this._currentAttack.zTolerance) return false;
    
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
