/**
 * FallingHazard.ts
 * ─────────────────────────────────────────────────────────
 * Hazard que cai do teto na fase 2 do boss.
 * 
 * Comportamento:
 * - Mostra sombra de aviso no chão
 * - Cai pelo eixo Z (altura)
 * - Causa dano no impacto
 * - Usa pool para performance
 */

import Phaser from 'phaser';
import {
  FALLING_HAZARD_WARNING_DURATION,
  FALLING_HAZARD_FALL_SPEED,
  FALLING_HAZARD_GRAVITY,
  FALLING_HAZARD_DAMAGE,
  FALLING_HAZARD_RADIUS,
  FALLING_HAZARD_SAFE_HEIGHT,
} from '../config/boss';

export class FallingHazard extends Phaser.GameObjects.Sprite {
  // ── Estado ───────────────────────────────────────────────
  private _isActive: boolean = false;
  private _z: number = 0; // Altura (eixo Z)
  private _zVelocity: number = 0;
  private _targetX: number = 0;
  private _targetY: number = 0;
  private _warningTime: number = 0;
  private _isWarning: boolean = false;
  private _isFalling: boolean = false;
  private _hasImpacted: boolean = false;

  // ── Visuais ──────────────────────────────────────────────
  private _shadow!: Phaser.GameObjects.Ellipse;
  private _damageArea!: number;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'hazard_falling');
    
    // Cria a sombra de aviso
    this._shadow = scene.add.ellipse(0, 0, 20, 10, 0xff0000, 0.3);
    this._shadow.setVisible(false);

    this.setVisible(false);
    this.setOrigin(0.5, 1);
  }

  // ═══════════════════════════════════════════════════════
  // POOL
  // ═══════════════════════════════════════════════════════

  /**
   * Ativa o hazard para uso do pool.
   */
  activate(x: number, y: number): void {
    this._isActive = true;
    this._targetX = x;
    this._targetY = y;
    this._z = 200; // Começa bem alto
    this._zVelocity = -FALLING_HAZARD_FALL_SPEED;
    this._isWarning = true;
    this._isFalling = false;
    this._hasImpacted = false;
    this._warningTime = this.scene.time.now;

    // Posiciona a sombra
    this._shadow.setPosition(x, y);
    this._shadow.setVisible(true);
    this._shadow.setScale(0.5);

    // Posiciona o hazard acima da tela
    this.setPosition(x, y - this._z);
    this.setVisible(true);
  }

  /**
   * Desativa o hazard para retorno ao pool.
   */
  deactivate(): void {
    this._isActive = false;
    this._isWarning = false;
    this._isFalling = false;
    this._hasImpacted = false;
    this._shadow.setVisible(false);
    this.setVisible(false);
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get hasImpacted(): boolean {
    return this._hasImpacted;
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════

  update(_time: number, delta: number): void {
    if (!this._isActive) return;

    const dt = delta / 1000;

    // Fase de aviso
    if (this._isWarning) {
      const elapsed = this.scene.time.now - this._warningTime;
      const progress = elapsed / FALLING_HAZARD_WARNING_DURATION;

      // Sombra cresce
      this._shadow.setScale(0.5 + progress * 0.5);

      // Terminou o aviso
      if (elapsed >= FALLING_HAZARD_WARNING_DURATION) {
        this._isWarning = false;
        this._isFalling = true;
      }
    }

    // Fase de queda
    if (this._isFalling) {
      // Aplica gravidade
      this._zVelocity += FALLING_HAZARD_GRAVITY * dt;
      this._z -= this._zVelocity * dt;

      // Atualiza posição visual
      this.setPosition(this._targetX, this._targetY - this._z);

      // Impacto
      if (this._z <= 0) {
        this._z = 0;
        this._isFalling = false;
        this._hasImpacted = true;
        this._onImpact();
      }
    }
  }

  /**
   * Chamado quando o hazard atinge o chão.
   */
  private _onImpact(): void {
    // Emite evento para a GameScene criar efeitos e verificar dano
    this.scene.game.events.emit('hazard:impact', {
      x: this._targetX,
      y: this._targetY,
      radius: FALLING_HAZARD_RADIUS,
      damage: FALLING_HAZARD_DAMAGE,
      safeHeight: FALLING_HAZARD_SAFE_HEIGHT,
    });

    // Cria efeito de impacto
    this._createImpactEffect();

    // Desativa após um tempo
    this.scene.time.delayedCall(500, () => {
      this.deactivate();
    });
  }

  /**
   * Cria efeito visual de impacto.
   */
  private _createImpactEffect(): void {
    // Cria uma explosão de partículas
    const particles = this.scene.add.particles(this._targetX, this._targetY, 'hazard_particle', {
      speed: { min: 50, max: 150 },
      angle: { min: 220, max: 320 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 400,
      quantity: 8,
      emitting: false,
    });

    particles.explode(8);

    // Remove após a animação
    this.scene.time.delayedCall(500, () => {
      particles.destroy();
    });
  }

  /**
   * Verifica se um ponto está dentro da área de dano.
   */
  isInDamageArea(x: number, y: number): boolean {
    if (!this._hasImpacted) return false;

    const dx = x - this._targetX;
    const dy = y - this._targetY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= FALLING_HAZARD_RADIUS;
  }

  /**
   * Retorna a área de dano.
   */
  getDamageArea(): { x: number; y: number; radius: number; damage: number; safeHeight: number } {
    return {
      x: this._targetX,
      y: this._targetY,
      radius: FALLING_HAZARD_RADIUS,
      damage: FALLING_HAZARD_DAMAGE,
      safeHeight: FALLING_HAZARD_SAFE_HEIGHT,
    };
  }

  /**
   * Cleanup ao destruir.
   */
  cleanup(): void {
    this._shadow.destroy();
    this.destroy();
  }
}
