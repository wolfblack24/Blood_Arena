/**
 * Fighter.ts
 * ─────────────────────────────────────────────────────────
 * Classe base para todos os lutadores (Player e Enemy).
 * Contém lógica compartilhada:
 * - Posição de chão (groundY) e eixo Z (pulo)
 * - Sombra projetada
 * - Facing (direção)
 * - HP próprio da entidade
 * - Máquina de estados
 * - Utilidades de dano/knockback
 * - Atrito de chão para knockback
 *
 * O Player usa PlayerState como fonte de verdade de HP/vidas/score.
 * O Enemy usa o HP próprio desta classe.
 */

import Phaser from 'phaser';
import { AnimationName } from '../systems/AnimationManager';
import {
  PLAYER_GRAVITY,
  WALK_ZONE_TOP,
  WALK_ZONE_BOTTOM,
  WORLD_WIDTH,
  KNOCKBACK_FRICTION,
} from '../config/constants';

/**
 * Estados possíveis de um lutador.
 */
export enum FighterState {
  Idle = 'idle',
  Walk = 'walk',
  Jump = 'jump',
  Attack = 'attack',
  Hurt = 'hurt',
  Knockdown = 'knockdown',
  Dead = 'dead',
}

/**
 * Classe base para lutadores.
 */
export abstract class Fighter extends Phaser.Physics.Arcade.Sprite {
  // ── Estado ─────────────────────────────────────────────
  protected _fighterState: FighterState = FighterState.Idle;
  protected _facingRight: boolean = true;

  // ── Eixo Z (pulo manual) ──────────────────────────────
  protected _jumpHeight: number = 0;        // altura atual (0 = no chão)
  protected _jumpVelocity: number = 0;      // velocidade vertical do pulo
  protected _isGrounded: boolean = true;

  // ── Offset visual do pulo aplicado ─────────────────────
  // Rastreia o deslocamento aplicado ao sprite para desfazer no próximo frame
  protected _appliedJumpOffset: number = 0;

  // ── HP próprio da entidade ─────────────────────────────
  protected _hp: number;
  protected _hpMax: number;

  // ── Sombra ─────────────────────────────────────────────
  protected _shadow: Phaser.GameObjects.Image;

  // ── Invulnerabilidade ──────────────────────────────────
  protected _invulnerableUntil: number = 0;
  protected _blinkTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    hpMax: number
  ) {
    super(scene, x, y, texture);

    this._hpMax = hpMax;
    this._hp = hpMax;

    // ── Origem nos pés ───────────────────────────────────
    this.setOrigin(0.5, 1);

    // ── Adiciona ao cenário e à física ───────────────────
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // ── Hitbox ajustada (pequena, nos pés) ───────────────
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 8);              // hitbox pequena nos pés
    body.setOffset(-6, -8);           // centralizada horizontalmente, nos pés
    body.setCollideWorldBounds(false); // usamos clamp manual
    body.setDrag(0, 0);               // drag zero (controlado manualmente)
    body.setMaxVelocity(200, 200);

    // ── Sombra (fica no chão, independente do jumpHeight) ─
    this._shadow = scene.add.image(x, y, 'shadow');
    this._shadow.setOrigin(0.5, 0.5);
    this._shadow.setDepth(y - 0.1);

    // ── Profundidade inicial ─────────────────────────────
    this.setDepth(y);
  }

  // ═══════════════════════════════════════════════════════
  // MÁQUINA DE ESTADOS
  // ═══════════════════════════════════════════════════════

  /**
   * Verifica se pode transicionar de um estado para outro.
   */
  canTransition(from: FighterState, to: FighterState): boolean {
    // Não pode transicionar de dead para nada (exceto reset)
    if (from === FighterState.Dead && to !== FighterState.Idle) return false;

    // Não pode transicionar durante knockdown (exceto para idle ao levantar)
    if (from === FighterState.Knockdown && to !== FighterState.Idle) return false;

    // Pode transicionar de hurt para qualquer coisa
    if (from === FighterState.Hurt) return true;

    // Pode transicionar de attack para idle/walk/jump (fim do ataque) ou hurt/knockdown/dead (interrupção)
    // Também permite attack → attack para encadeamento de combo
    if (from === FighterState.Attack) {
      return to === FighterState.Idle || to === FighterState.Walk || to === FighterState.Jump ||
             to === FighterState.Hurt || to === FighterState.Knockdown || to === FighterState.Dead ||
             to === FighterState.Attack;
    }

    // Transições normais
    return true;
  }

  /**
   * Muda o estado do lutador.
   * @param forceRestart Se true e o estado for o mesmo, reinicia a animação
   */
  changeState(newState: FighterState, forceRestart: boolean = false): void {
    if (!this.canTransition(this._fighterState, newState)) return;

    // Se for o mesmo estado e forceRestart, reinicia a animação
    if (this._fighterState === newState && forceRestart) {
      const animMap: Record<FighterState, AnimationName> = {
        [FighterState.Idle]: 'idle',
        [FighterState.Walk]: 'run',
        [FighterState.Jump]: 'jump',
        [FighterState.Attack]: 'attack',
        [FighterState.Hurt]: 'hurt',
        [FighterState.Knockdown]: 'hurt',
        [FighterState.Dead]: 'hurt',
      };
      this.play(animMap[newState], false);
      return;
    }

    this._fighterState = newState;

    // Animação baseada no estado
    this._updateAnimationFromState();
  }

  /**
   * Atualiza a animação baseada no estado atual.
   */
  protected _updateAnimationFromState(): void {
    const animMap: Record<FighterState, AnimationName> = {
      [FighterState.Idle]: 'idle',
      [FighterState.Walk]: 'run',
      [FighterState.Jump]: 'jump',
      [FighterState.Attack]: 'attack',
      [FighterState.Hurt]: 'hurt',
      [FighterState.Knockdown]: 'hurt',
      [FighterState.Dead]: 'hurt',
    };

    const animKey = animMap[this._fighterState];
    if (this.anims.currentAnim?.key !== animKey) {
      this.play(animKey, true);
    }
  }

  // ═══════════════════════════════════════════════════════
  // EIXO Z (PULO)
  // ═══════════════════════════════════════════════════════

  /**
   * Inicia o pulo.
   */
  jump(force: number): void {
    if (!this._isGrounded) return;
    this._jumpVelocity = force;
    this._isGrounded = false;
    this.changeState(FighterState.Jump);
  }

  /**
   * Atualiza o eixo Z (altura do pulo).
   */
  protected _updateJumpAxis(delta: number): void {
    const wasGrounded = this._isGrounded;

    if (this._isGrounded) {
      this._jumpHeight = 0;
      this._jumpVelocity = 0;
      return;
    }

    // Delta time em segundos (limitado para evitar saltos grandes)
    const dt = Math.min(delta / 1000, 0.05);

    // Aplica gravidade ao eixo Z
    this._jumpVelocity -= PLAYER_GRAVITY * dt;
    this._jumpHeight += this._jumpVelocity * dt;

    // Tocou o chão
    if (this._jumpHeight <= 0) {
      this._jumpHeight = 0;
      this._jumpVelocity = 0;
      this._isGrounded = true;

      // Se estava pulando, volta ao Idle ao pousar
      if (!wasGrounded && this._fighterState === FighterState.Jump) {
        this.changeState(FighterState.Idle);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // VISUAIS (sprite + sombra)
  // ═══════════════════════════════════════════════════════

  /**
   * Desfaz o offset visual do pulo aplicado no frame anterior.
   * Deve ser chamado no início do postPhysicsUpdate.
   */
  undoJumpVisualOffset(): void {
    if (this._appliedJumpOffset !== 0) {
      this.y += this._appliedJumpOffset;
      this._appliedJumpOffset = 0;
    }
  }

  /**
   * Aplica o offset visual do pulo.
   * Chamado no postupdate da GameScene (após a física sincronizar).
   */
  applyJumpVisualOffset(): void {
    // Sombra sempre no chão (posição física do lutador)
    this._shadow.setPosition(this.x, this.y);

    // Escala da sombra diminui conforme sobe (perspectiva)
    const shadowScale = Math.max(0.3, 1 - (this._jumpHeight / 80));
    this._shadow.setScale(shadowScale);
    this._shadow.setAlpha(0.4 * shadowScale);

    // Sprite deslocado para cima pelo jumpHeight (visualmente)
    if (this._jumpHeight > 0) {
      this.y = this.y - this._jumpHeight;
      this._appliedJumpOffset = this._jumpHeight;
    } else {
      this._appliedJumpOffset = 0;
    }
  }

  // ═══════════════════════════════════════════════════════
  // LIMITES E PROFUNDIDADE
  // ═══════════════════════════════════════════════════════

  /**
   * Restringe o lutador à faixa de Y permitida e aos limites do mundo.
   */
  clampToWalkZone(): void {
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
   * Atualiza a profundidade (depth = Y do chão).
   */
  protected _updateDepth(): void {
    this.setDepth(this.groundY);
    this._shadow.setDepth(this.groundY - 0.1);
  }

  // ═══════════════════════════════════════════════════════
  // ATRITO DE CHÃO (para knockback)
  // ═══════════════════════════════════════════════════════

  /**
   * Aplica atrito no chão, reduzindo a velocidade linearmente até 0
   * sem inverter o sinal. Usado para desacelerar knockback.
   */
  protected _applyGroundFriction(delta: number): void {
    if (!this._isGrounded) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    const dt = Math.min(delta / 1000, 0.05);
    const friction = KNOCKBACK_FRICTION * dt;

    // Atrito no eixo X
    if (body.velocity.x > 0) {
      body.setVelocityX(Math.max(0, body.velocity.x - friction));
    } else if (body.velocity.x < 0) {
      body.setVelocityX(Math.min(0, body.velocity.x + friction));
    }

    // Atrito no eixo Y
    if (body.velocity.y > 0) {
      body.setVelocityY(Math.max(0, body.velocity.y - friction));
    } else if (body.velocity.y < 0) {
      body.setVelocityY(Math.min(0, body.velocity.y + friction));
    }
  }

  // ═══════════════════════════════════════════════════════
  // DANO E INVULNERABILIDADE
  // ═══════════════════════════════════════════════════════

  /**
   * Verifica se está invulnerável.
   */
  isInvulnerable(): boolean {
    return this.scene.time.now < this._invulnerableUntil;
  }

  /**
   * Concede invulnerabilidade por um tempo.
   */
  grantInvulnerability(duration: number): void {
    this._invulnerableUntil = this.scene.time.now + duration;
    this._startBlink();
  }

  /**
   * Inicia o efeito de piscar (invulnerabilidade visual).
   */
  protected _startBlink(): void {
    // Para o tween anterior se existir
    this._stopBlink();

    // Cria um novo tween de piscar
    this._blinkTween = this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.alpha = 1;
        this._blinkTween = undefined;
      },
    });
  }

  /**
   * Para o efeito de piscar.
   */
  protected _stopBlink(): void {
    if (this._blinkTween) {
      this._blinkTween.stop();
      this._blinkTween = undefined;
      this.alpha = 1;
    }
  }

  /**
   * Aplica dano ao lutador.
   * Retorna true se morreu.
   */
  takeDamage(amount: number, knockbackX: number = 0, knockdown: boolean = false): boolean {
    if (this.isInvulnerable()) return false;
    if (this._fighterState === FighterState.Dead || this._fighterState === FighterState.Knockdown) return false;

    this._hp = Math.max(0, this._hp - amount);

    // Knockback
    if (knockbackX !== 0) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(knockbackX);
    }

    // Estado
    if (knockdown) {
      this.changeState(FighterState.Knockdown);
    } else {
      this.changeState(FighterState.Hurt);
    }

    // Morte
    if (this._hp <= 0) {
      this.changeState(FighterState.Dead);
      this._stopBlink();
      return true;
    }

    return false;
  }

  /**
   * Cura o lutador.
   */
  heal(amount: number): void {
    this._hp = Math.min(this._hpMax, this._hp + amount);
  }

  // ═══════════════════════════════════════════════════════
  // FACING
  // ═══════════════════════════════════════════════════════

  /**
   * Define a direção do lutador.
   */
  setFacing(right: boolean): void {
    this._facingRight = right;
    this.setFlipX(!right);
  }

  // ═══════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════

  /**
   * Limpa recursos ao destruir.
   */
  cleanup(): void {
    this._stopBlink();
    this._shadow.destroy();
  }

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get fighterState(): FighterState { return this._fighterState; }
  get facingRight(): boolean { return this._facingRight; }
  get jumpHeight(): number { return this._jumpHeight; }
  get isGrounded(): boolean { return this._isGrounded; }
  get hp(): number { return this._hp; }
  get hpMax(): number { return this._hpMax; }

  /**
   * Retorna o Y do chão do lutador (sem o offset visual do pulo).
   * Use este valor para validação de faixa, hitboxes e IA.
   */
  get groundY(): number { return this.y + this._appliedJumpOffset; }
}
