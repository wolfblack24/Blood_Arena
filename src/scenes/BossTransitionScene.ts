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
 * - Pode ser pulada com ENTER após 1.5s
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';

export class BossTransitionScene extends Phaser.Scene {
  private _canSkip: boolean = false;
  private _isFinished: boolean = false;
  private _safetyTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'BossTransitionScene' });
  }

  create(): void {
    this._canSkip = false;
    this._isFinished = false;

    // Fundo transparente
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5)
      .setDepth(5000);

    // Sequência de animação
    this.time.delayedCall(200, () => this._flashWhite());
    this.time.delayedCall(600, () => this._showShake());
    this.time.delayedCall(1000, () => this._showTransformation());
    this.time.delayedCall(3500, () => this._finish());

    // Permite pular após 1.5s
    this.time.delayedCall(1500, () => {
      this._canSkip = true;
      const skipText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'ENTER para pular', {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(5005);

      this.tweens.add({
        targets: skipText,
        alpha: 0,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    });

    // Timeout de segurança (6s) para garantir que a cutscene termine
    this._safetyTimer = this.time.delayedCall(6000, () => {
      if (!this._isFinished) {
        this._finish();
      }
    });

    // Input para pular
    this.input.keyboard?.on('keydown-ENTER', this._onSkip, this);
  }

  private _onSkip = (): void => {
    if (this._canSkip && !this._isFinished) {
      this._finish();
    }
  };

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
   * Finaliza a cutscene e retoma a GameScene.
   */
  private _finish(): void {
    if (this._isFinished) return;
    this._isFinished = true;

    // Remove listeners
    this.input.keyboard?.off('keydown-ENTER', this._onSkip, this);

    // Cancela timeout de segurança
    if (this._safetyTimer) {
      this._safetyTimer.remove(false);
      this._safetyTimer = undefined;
    }

    // Emite evento para a GameScene
    this.game.events.emit(EVENTS.BOSS_TRANSITION_COMPLETE);

    // Para a cena
    this.scene.stop();
  }

  shutdown(): void {
    // Cleanup
    this.input.keyboard?.off('keydown-ENTER', this._onSkip, this);
    if (this._safetyTimer) {
      this._safetyTimer.remove(false);
    }
  }
}
