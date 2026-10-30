/**
 * BootScene.ts
 * ─────────────────────────────────────────────────────────
 * Primeira cena do jogo. Responsável por:
 * - Mostrar uma barra de loading simples
 * - Iniciar a PreloadScene (que carrega os assets de verdade)
 */

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // ── Barra de loading visual (placeholder) ────────────
    const { width, height } = this.scale;
    const barWidth = 200;
    const barHeight = 12;
    const x = (width - barWidth) / 2;
    const y = height / 2;

    // Fundo da barra
    this.add.rectangle(x, y, barWidth, barHeight, 0x333333)
      .setOrigin(0, 0.5);

    // Texto "Carregando..."
    this.add.text(width / 2, y - 20, 'Carregando...', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Preenche a barra
    const bar = this.add.rectangle(x, y, 0, barHeight, 0x00ff00)
      .setOrigin(0, 0.5);

    // Anima a barra rapidamente
    this.tweens.add({
      targets: bar,
      displayWidth: barWidth,
      duration: 500,
      ease: 'Linear',
      onComplete: () => {
        this.scene.start('PreloadScene');
      },
    });
  }
}
