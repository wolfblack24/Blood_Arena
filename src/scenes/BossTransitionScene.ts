/**
 * BossTransitionScene.ts
 * ─────────────────────────────────────────────────────────
 * Cena sobreposta para a cutscene de transição do boss (fase 1 → fase 2).
 * 
 * Sequência:
 * - Freeze-frame
 * - Flash branco
 * - Screen shake
 * - Transformação do boss (tween de escala/tint)
 * - Faixa com texto
 * - Emite evento para retomar a GameScene
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';

export class BossTransitionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BossTransitionScene' });
  }

  create(): void {
    // Fundo transparente
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setDepth(5000);

    // Sequência de animação
    this.time.delayedCall(200, () => this._flashWhite());
    this.time.delayedCall(600, () => this._showShake());
    this.time.delayedCall(1000, () => this._showTransformation());
    this.time.delayedCall(2500, () => this._showBanner());
    this.time.delayedCall(4000, () => this._finish());
  }

  /**
   * Flash branco.
   */
  private _flashWhite(): void {
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setDepth(5001);

    this.tweens.add({
      targets: flash,
      alpha: 1,
      duration: 200,
      yoyo: true,
    });
  }

  /**
   * Screen shake.
   */
  private _showShake(): void {
    this.cameras.main.shake(500, 0.01);
  }

  /**
   * Mostra a transformação do boss.
   */
  private _showTransformation(): void {
    // Faixa horizontal
    const bar = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, 40, 0x000000, 0.8)
      .setDepth(5002);

    // Texto
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'FASE 2', {
      fontSize: '24px',
      color: '#ff0000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#440000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5003);

    // Animação de entrada
    text.setAlpha(0);
    text.setScale(2);

    this.tweens.add({
      targets: text,
      alpha: 1,
      scale: 1,
      duration: 500,
      ease: 'Back.Out',
    });

    // Animação de saída
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: [bar, text],
        alpha: 0,
        duration: 500,
      });
    });
  }

  /**
   * Mostra banner com nome do boss.
   */
  private _showBanner(): void {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'O AÇOUGUEIRO', {
      fontSize: '16px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5004);

    banner.setAlpha(0);

    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 300,
    });

    this.time.delayedCall(1000, () => {
      this.tweens.add({
        targets: banner,
        alpha: 0,
        duration: 300,
      });
    });
  }

  /**
   * Finaliza a cutscene e retoma a GameScene.
   */
  private _finish(): void {
    // Emite evento para a GameScene
    this.game.events.emit('boss:transition:complete');

    // Para a cena
    this.scene.stop();
  }
}
