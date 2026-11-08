/**
 * Pickup.ts
 * ─────────────────────────────────────────────────────────
 * Item coletável (comida ou arma).
 * Pode ser pego pelo jogador com a tecla L.
 */

import Phaser from 'phaser';
import {
  FOOD_HEAL_SMALL, FOOD_HEAL_LARGE,
  KNIFE_DAMAGE_MULT, KNIFE_RANGE_MULT,
  STICK_DAMAGE_MULT, STICK_RANGE_MULT,
  WEAPON_DURABILITY,
} from '../config/gameplay';

export type PickupType = 'food_small' | 'food_large' | 'knife' | 'stick';

export class Pickup extends Phaser.Physics.Arcade.Sprite {
  // ── Estado ───────────────────────────────────────────────
  private _type: PickupType;
  private _isActive: boolean = true;
  private _shadow!: Phaser.GameObjects.Image;
  private _durability: number = WEAPON_DURABILITY; // Apenas para armas

  constructor(scene: Phaser.Scene, x: number, y: number, type: PickupType) {
    super(scene, x, y, `pickup_${type}`);
    
    this._type = type;
    
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
    this._shadow.setScale(0.6);
    
    // Define profundidade
    this.setDepth(y);
    this._shadow.setDepth(y - 0.1);
  }

  // ═══════════════════════════════════════════════════════
  // COLETA
  // ═══════════════════════════════════════════════════════

  /**
   * Coleta o item (chamado quando o jogador pega).
   */
  collect(): void {
    if (!this._isActive) return;
    
    this._isActive = false;
    
    // Remove após um tempo
    this.scene.time.delayedCall(100, () => {
      this.setVisible(false);
      this._shadow.setVisible(false);
    });
  }

  // ═══════════════════════════════════════════════════════
  // EFEITOS
  // ═══════════════════════════════════════════════════════

  /**
   * Aplica o efeito do item no jogador.
   */
  applyEffect(player: { heal: (amount: number) => void }): void {
    switch (this._type) {
      case 'food_small':
        player.heal(FOOD_HEAL_SMALL);
        break;
      case 'food_large':
        player.heal(FOOD_HEAL_LARGE);
        break;
      case 'knife':
      case 'stick':
        // Armas são equipadas, não aplicam efeito imediato
        break;
    }
  }

  // ═══════════════════════════════════════════════════════
  // ARMAS
  // ═══════════════════════════════════════════════════════

  /**
   * Usa a arma (reduz durabilidade).
   * Retorna true se a arma quebrou.
   */
  useWeapon(): boolean {
    if (!this.isWeapon()) return false;
    
    this._durability--;
    return this._durability <= 0;
  }

  /**
   * Verifica se é uma arma.
   */
  isWeapon(): boolean {
    return this._type === 'knife' || this._type === 'stick';
  }

  /**
   * Retorna o multiplicador de dano da arma.
   */
  getDamageMultiplier(): number {
    switch (this._type) {
      case 'knife':
        return KNIFE_DAMAGE_MULT;
      case 'stick':
        return STICK_DAMAGE_MULT;
      default:
        return 1.0;
    }
  }

  /**
   * Retorna o multiplicador de alcance da arma.
   */
  getRangeMultiplier(): number {
    switch (this._type) {
      case 'knife':
        return KNIFE_RANGE_MULT;
      case 'stick':
        return STICK_RANGE_MULT;
      default:
        return 1.0;
    }
  }

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get isActive(): boolean {
    return this._isActive;
  }

  get pickupType(): PickupType {
    return this._type;
  }

  get durability(): number {
    return this._durability;
  }

  // ═══════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════

  cleanup(): void {
    this._shadow.destroy();
    this.destroy();
  }
}
