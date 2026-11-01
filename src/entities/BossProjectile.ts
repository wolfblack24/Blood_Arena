/**
 * BossProjectile.ts
 * ─────────────────────────────────────────────────────────
 * Projétil do boss. Viaja pelo chão e causa dano ao jogador.
 * O jogador pulando (z > safeHeight) passa por cima.
 * Usa pool para performance.
 */

import Phaser from 'phaser';
import { Fighter } from './Fighter';
import { BOSS_PROJECTILE_SPEED } from '../config/boss';
import { LANE_TOLERANCE } from '../config/constants';

export class BossProjectile extends Phaser.Physics.Arcade.Sprite {
  // ── Estado ───────────────────────────────────────────────
  private _isActive: boolean = false;
  private _speed: number = BOSS_PROJECTILE_SPEED;
  private _damage: number = 15;
  private _direction: number = 1; // 1 = direita, -1 = esquerda
  private _hasHit: boolean = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'boss_projectile');
    
    // Adiciona ao display list
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Configura o corpo
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    
    this.setVisible(false);
    this.setOrigin(0.5, 1);
  }

  // ═══════════════════════════════════════════════════════
  // POOL
  // ═══════════════════════════════════════════════════════

  /**
   * Ativa o projétil para uso do pool.
   */
  activate(x: number, y: number, direction: number, speedMult: number = 1, damage: number = 15): void {
    this._isActive = true;
    this._hasHit = false;
    this._direction = direction;
    this._speed = BOSS_PROJECTILE_SPEED * speedMult;
    this._damage = damage;

    // Posiciona o projétil
    this.setPosition(x, y);
    this.setVisible(true);

    // Aplica velocidade
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(this._speed * this._direction, 0);
  }

  /**
   * Desativa o projétil para retorno ao pool.
   */
  deactivate(): void {
    this._isActive = false;
    this._hasHit = false;
    
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
    
    this.setVisible(false);
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get hasHit(): boolean {
    return this._hasHit;
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════

  update(_time: number, _delta: number): void {
    if (!this._isActive) return;

    // Verifica se saiu da tela
    if (this.x < 0 || this.x > 1600) {
      this.deactivate();
    }
  }

  /**
   * Verifica se o projétil pode atingir o jogador.
   * O jogador pulando (z > safeHeight) passa por cima.
   */
  canHitPlayer(player: Fighter, safeHeight: number = 12): boolean {
    if (this._hasHit) return false;
    if (player.isInvulnerable()) return false;
    
    // Verifica se o jogador está pulando alto o suficiente
    if (player.jumpHeight > safeHeight) {
      return false; // Passou por cima
    }
    
    // Verifica se está na mesma faixa
    const laneDiff = Math.abs(player.groundY - this.y);
    if (laneDiff > LANE_TOLERANCE) {
      return false;
    }
    
    // Verifica sobreposição em X
    const dx = Math.abs(player.x - this.x);
    if (dx > 15) { // Largura do projétil + hitbox do jogador
      return false;
    }
    
    return true;
  }

  /**
   * Marca que o projétil já atingiu algo.
   */
  markAsHit(): void {
    this._hasHit = true;
  }

  /**
   * Retorna o dano do projétil.
   */
  getDamage(): number {
    return this._damage;
  }

  /**
   * Cleanup ao destruir.
   */
  cleanup(): void {
    this.destroy();
  }
}
