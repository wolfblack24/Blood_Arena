/**
 * Breakable.ts
 * ─────────────────────────────────────────────────────────
 * Objeto quebrável (barril/caixa).
 * Pode ser destruído pelo jogador e solta itens.
 */

import Phaser from 'phaser';
import { BREAKABLE_HP, ITEM_DROP_CHANCE } from '../config/gameplay';

export class Breakable extends Phaser.Physics.Arcade.Sprite {
  // ── Estado ───────────────────────────────────────────────
  private _hp: number = BREAKABLE_HP;
  private _isActive: boolean = true;
  private _shadow!: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string = 'breakable') {
    super(scene, x, y, texture);
    
    // Adiciona ao display list
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Configura o corpo
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    
    // Cria a sombra
    this._shadow = scene.add.image(x, y + 2, 'shadow');
    this._shadow.setOrigin(0.5, 0.5);
    this._shadow.setScale(0.8);
    
    // Define profundidade
    this.setDepth(y);
    this._shadow.setDepth(y - 0.1);
  }

  // ═══════════════════════════════════════════════════════
  // DANO
  // ═══════════════════════════════════════════════════════

  /**
   * Aplica dano ao quebrável.
   */
  takeDamage(amount: number): boolean {
    if (!this._isActive) return false;
    
    this._hp -= amount;
    
    if (this._hp <= 0) {
      this._destroy();
      return true;
    }
    
    return false;
  }

  /**
   * Destrói o quebrável e solta itens.
   */
  private _destroy(): void {
    this._isActive = false;
    
    // Efeito de destruição
    this._createDestroyEffect();
    
    // Chance de dropar item
    if (Math.random() < ITEM_DROP_CHANCE) {
      this._dropItem();
    }
    
    // Remove após um tempo
    this.scene.time.delayedCall(100, () => {
      this.setVisible(false);
      this._shadow.setVisible(false);
    });
  }

  /**
   * Cria efeito visual de destruição.
   */
  private _createDestroyEffect(): void {
    // Cria partículas de destruição
    const particles = this.scene.add.particles(this.x, this.y, 'breakable_particle', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
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
   * Solta um item (emite evento para o GameScene criar).
   */
  private _dropItem(): void {
    // Escolhe aleatoriamente entre comida e arma
    const itemType = Math.random() < 0.7 ? 'food' : 'weapon';
    this.scene.game.events.emit('breakable:drop', {
      x: this.x,
      y: this.y,
      type: itemType,
    });
  }

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get isActive(): boolean {
    return this._isActive;
  }

  get hp(): number {
    return this._hp;
  }

  // ═══════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════

  cleanup(): void {
    this._shadow.destroy();
    this.destroy();
  }
}
