/**
 * Player.ts
 * ─────────────────────────────────────────────────────────
 * Entidade do jogador. Estende Phaser.Physics.Arcade.Sprite.
 *
 * Responsabilidades:
 * - Controle de movimento 2.5D (WASD/setas)
 * - Eixo Z manual para pulo (posição visual vs. posição física)
 * - Sombra projetada no chão
 * - Máquina de estados simples (idle, run, jump)
 * - Ordenação de profundidade (depth = Y do chão)
 * - Hitbox ajustada (pequena nos pés) para o 2.5D funcionar
 *
 * NÃO contém lógica de HP/dano → delega para PlayerState.
 */

import Phaser from 'phaser';
import { PlayerState } from '../state/PlayerState';
import { playAnimation, AnimationName } from '../systems/AnimationManager';
import {
  PLAYER_SPEED,
  PLAYER_JUMP_FORCE,
  PLAYER_GRAVITY,
  PLAYER_DRAG,
  WALK_ZONE_TOP,
  WALK_ZONE_BOTTOM,
  WORLD_WIDTH,
} from '../config/constants';

/**
 * Estados possíveis do jogador (máquina de estados simples).
 * Preparada para receber 'attack', 'dash', 'hurt', 'fall' na Fase 2.
 */
export enum PlayerAnimState {
  Idle = 'idle',
  Run = 'run',
  Jump = 'jump',
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  // ── Estado ─────────────────────────────────────────────
  private _playerState: PlayerState;
  private _animState: PlayerAnimState = PlayerAnimState.Idle;
  private _facingRight: boolean = true;

  // ── Eixo Z (pulo manual) ──────────────────────────────
  private _jumpHeight: number = 0;        // altura atual (0 = no chão)
  private _jumpVelocity: number = 0;      // velocidade vertical do pulo
  private _isGrounded: boolean = true;

  // ── Posição base do chão (antes do offset visual) ──────
  private _groundY: number;

  // ── Sombra ─────────────────────────────────────────────
  private _shadow: Phaser.GameObjects.Image;

  // ── Controles ──────────────────────────────────────────
  private _cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private _wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private _jumpKey!: Phaser.Input.Keyboard.Key;
  private _debugKey!: Phaser.Input.Keyboard.Key;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerState: PlayerState
  ) {
    super(scene, x, y, 'player_idle');

    this._playerState = playerState;
    this._groundY = y;

    // ── Adiciona ao cenário e à física ───────────────────
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // ── Hitbox ajustada (pequena, nos pés) ───────────────
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 6);              // hitbox pequena nos pés
    body.setOffset(5, 26);            // posicionada na base do sprite
    body.setCollideWorldBounds(false); // usamos clamp manual

    // ── Drag para sensação de peso ───────────────────────
    body.setDrag(PLAYER_DRAG, PLAYER_DRAG);
    body.setMaxVelocity(PLAYER_SPEED, PLAYER_SPEED);

    // ── Sombra (fica no chão, independente do jumpHeight) ─
    this._shadow = scene.add.image(x, y + 2, 'shadow');
    this._shadow.setDepth(0);

    // ── Controles ────────────────────────────────────────
    this._setupControls();

    // ── Profundidade inicial ─────────────────────────────
    this.setDepth(y);
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
    this._debugKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE (chamado todo frame pela GameScene)
  // ═══════════════════════════════════════════════════════

  update(_time: number, _delta: number): void {
    if (!this._playerState.isAlive) return;

    // Antes de processar, restaura a posição do chão
    // (porque no frame anterior o postupdate pode ter deslocado o sprite)
    this.y = this._groundY;

    this._handleMovement();
    this._handleJump();
    this._updateJumpAxis();
    this._updateAnimation();
    this._updateDepth();
    this._handleDebugInput();
  }

  /**
   * Chamado no postupdate da GameScene (após a física sincronizar).
   * Faz o clamp da posição, salva o groundY e aplica o offset visual.
   */
  postPhysicsUpdate(): void {
    this._clampToWalkZone();
    this._saveGroundY();
    this.applyJumpVisualOffset();
  }

  // ═══════════════════════════════════════════════════════
  // MOVIMENTO 2.5D
  // ═══════════════════════════════════════════════════════

  private _handleMovement(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Não permite input de movimento no ar (mantém inércia)
    if (!this._isGrounded) return;

    // ── Lê input (WASD + setas) ─────────────────────────
    let vx = 0;
    let vy = 0;

    if (this._cursors.left?.isDown || this._wasd.A.isDown) vx -= 1;
    if (this._cursors.right?.isDown || this._wasd.D.isDown) vx += 1;
    if (this._cursors.up?.isDown || this._wasd.W.isDown) vy -= 1;
    if (this._cursors.down?.isDown || this._wasd.S.isDown) vy += 1;

    // ── Normaliza diagonal ──────────────────────────────
    if (vx !== 0 && vy !== 0) {
      const norm = 1 / Math.SQRT2;
      vx *= norm;
      vy *= norm;
    }

    // ── Aplica velocidade ───────────────────────────────
    body.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    // ── Flip do sprite (facing) ─────────────────────────
    if (vx > 0) {
      this._facingRight = true;
      this.setFlipX(false);
    } else if (vx < 0) {
      this._facingRight = false;
      this.setFlipX(true);
    }
  }

  // ═══════════════════════════════════════════════════════
  // PULO (eixo Z manual)
  // ═══════════════════════════════════════════════════════

  private _handleJump(): void {
    if (!this._isGrounded) return;

    if (Phaser.Input.Keyboard.JustDown(this._jumpKey)) {
      this._jumpVelocity = PLAYER_JUMP_FORCE;
      this._isGrounded = false;
    }
  }

  /**
   * Atualiza o eixo Z (altura do pulo).
   * Usa física manual: velocidade - gravidade * dt.
   */
  private _updateJumpAxis(): void {
    if (this._isGrounded) {
      this._jumpHeight = 0;
      this._jumpVelocity = 0;
      return;
    }

    // Delta time em segundos (limitado para evitar saltos grandes)
    const rawDt = this.scene.game.loop.delta / 1000;
    const dt = Math.min(rawDt, 0.05); // limita a 50ms (20fps mínimo)

    // Aplica gravidade ao eixo Z
    this._jumpVelocity -= PLAYER_GRAVITY * dt;
    this._jumpHeight += this._jumpVelocity * dt;

    // Tocou o chão
    if (this._jumpHeight <= 0) {
      this._jumpHeight = 0;
      this._jumpVelocity = 0;
      this._isGrounded = true;
    }
  }

  // ═══════════════════════════════════════════════════════
  // LIMITES E POSIÇÃO
  // ═══════════════════════════════════════════════════════

  /**
   * Restringe o jogador à faixa de Y permitida e aos limites do mundo.
   */
  private _clampToWalkZone(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    // Limite superior da faixa
    if (this.y < WALK_ZONE_TOP) {
      this.y = WALK_ZONE_TOP;
      body.setVelocityY(0);
    }
    // Limite inferior da faixa
    if (this.y > WALK_ZONE_BOTTOM) {
      this.y = WALK_ZONE_BOTTOM;
      body.setVelocityY(0);
    }

    // Limites horizontais do mundo
    if (this.x < 16) {
      this.x = 16;
      body.setVelocityX(0);
    }
    if (this.x > WORLD_WIDTH - 16) {
      this.x = WORLD_WIDTH - 16;
      body.setVelocityX(0);
    }
  }

  /**
   * Salva a posição Y do chão (após clamp, antes do offset visual).
   */
  private _saveGroundY(): void {
    this._groundY = this.y;
  }

  /**
   * Aplica o offset visual do pulo.
   * Chamado no postupdate da GameScene (após a física sincronizar).
   */
  applyJumpVisualOffset(): void {
    if (this._jumpHeight > 0) {
      this.y = this._groundY - this._jumpHeight;
    }
    // Atualiza a sombra
    this._shadow.setPosition(this.x, this._groundY + 2);
    const shadowScale = Math.max(0.3, 1 - (this._jumpHeight / 80));
    this._shadow.setScale(shadowScale);
    this._shadow.setAlpha(0.4 * shadowScale);
  }

  // ═══════════════════════════════════════════════════════
  // ANIMAÇÃO
  // ═══════════════════════════════════════════════════════

  private _updateAnimation(): void {
    let newState: PlayerAnimState;

    if (!this._isGrounded) {
      newState = PlayerAnimState.Jump;
    } else {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const isMoving = Math.abs(body.velocity.x) > 10 || Math.abs(body.velocity.y) > 10;
      newState = isMoving ? PlayerAnimState.Run : PlayerAnimState.Idle;
    }

    if (newState !== this._animState) {
      this._animState = newState;
      playAnimation(this, newState as AnimationName);
    }
  }

  // ═══════════════════════════════════════════════════════
  // PROFUNDIDADE
  // ═══════════════════════════════════════════════════════

  /**
   * Ordenação por profundidade: depth = Y do chão.
   * Objetos com Y maior (mais perto da câmera) ficam na frente.
   */
  private _updateDepth(): void {
    this.setDepth(this._groundY);
    this._shadow.setDepth(this._groundY - 0.1);
  }

  // ═══════════════════════════════════════════════════════
  // DEBUG
  // ═══════════════════════════════════════════════════════

  private _handleDebugInput(): void {
    // Tecla H: reduz HP para testar a HUD
    if (Phaser.Input.Keyboard.JustDown(this._debugKey)) {
      this._playerState.takeDamage(15);
    }
  }

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get isGrounded(): boolean { return this._isGrounded; }
  get jumpHeight(): number { return this._jumpHeight; }
  get groundY(): number { return this._groundY; }
  get facingRight(): boolean { return this._facingRight; }
  get animState(): PlayerAnimState { return this._animState; }
  get playerState(): PlayerState { return this._playerState; }
}
