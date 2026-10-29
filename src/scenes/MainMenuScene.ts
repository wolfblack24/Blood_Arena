/**
 * MainMenuScene.ts
 * ─────────────────────────────────────────────────────────
 * Tela principal do jogo.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

export class MainMenuScene extends Phaser.Scene {
  private _blinkEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Fundo
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x0a0a0a);

    // Manchas decorativas
    for (let i = 0; i < 8; i++) {
      const bx = Phaser.Math.Between(20, GAME_WIDTH - 20);
      const by = Phaser.Math.Between(20, GAME_HEIGHT - 20);
      const bw = Phaser.Math.Between(4, 20);
      const bh = Phaser.Math.Between(2, 8);
      this.add.rectangle(bx, by, bw, bh, 0x440000, 0.5);
    }

    // Título
    this.add.text(cx, cy - 50, 'BLOOD', {
      fontSize: '32px', color: '#cc0000', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#440000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 20, 'ARENA', {
      fontSize: '24px', color: '#ff2222', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#440000', strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(cx, cy + 15, 'Splatter Beat-em-up', {
      fontSize: '8px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Instrução
    const startText = this.add.text(cx, cy + 50, 'PRESSIONE ENTER', {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this._blinkEvent = this.time.addEvent({
      delay: 500, loop: true,
      callback: () => { startText.visible = !startText.visible; },
    });

    // Controles
    this.add.text(cx, cy + 80, 'WASD: Mover | ESPAÇO: Pular | J: Atacar', {
      fontSize: '7px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 90, 'H: Debug dano | G: Inimigos agressivos | F1: Hitboxes', {
      fontSize: '7px', color: '#555555', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Input
    this.input.keyboard?.once('keydown-ENTER', () => {
      this._blinkEvent?.destroy();
      this.scene.start('GameScene');
    });
  }
}
