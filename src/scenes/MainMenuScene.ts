/**
 * MainMenuScene.ts
 * ─────────────────────────────────────────────────────────
 * Tela principal do jogo.
 * Suporta parâmetro ?boss=1 na URL para pular direto para o boss.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, EVENTS } from '../config/constants';
import { setArenaBounds } from '../systems/LevelBounds';
import { BOSS_ARENA_X, BOSS_ARENA_WIDTH, BOSS_HP } from '../config/boss';
import { WALK_ZONE_TOP, WALK_ZONE_BOTTOM } from '../config/constants';

export class MainMenuScene extends Phaser.Scene {
  private _blinkEvent?: Phaser.Time.TimerEvent;
  private _skipToBoss: boolean = false;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  init(): void {
    // Verifica se deve pular para o boss
    const urlParams = new URLSearchParams(window.location.search);
    this._skipToBoss = urlParams.get('boss') === '1';
  }

  create(): void {
    // Se deve pular para o boss, vai direto para a GameScene
    if (this._skipToBoss) {
      this._startBossFight();
      return;
    }

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
    this.add.text(cx, cy + 80, 'WASD: Mover | ESPAÇO: Pular | J: Atacar | K: Esquivar', {
      fontSize: '7px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 90, 'H: Debug dano | F1: Hitboxes | F9: Pular ondas | F10: Matar inimigos', {
      fontSize: '7px', color: '#555555', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Input
    this.input.keyboard?.once('keydown-ENTER', () => {
      this._blinkEvent?.destroy();
      this.scene.start('GameScene');
    });
  }

  /**
   * Inicia direto na arena do boss (para ?boss=1).
   */
  private _startBossFight(): void {
    // Inicia a GameScene
    this.scene.start('GameScene');

    // Aguarda a GameScene criar e então força a transição para o boss
    this.time.delayedCall(100, () => {
      const gameScene = this.scene.get('GameScene') as any;
      if (gameScene) {
        // Marca todas as ondas como concluídas
        for (let i = 0; i < 10; i++) {
          gameScene._waveTriggered[i] = true;
        }
        gameScene._waveEnemiesRemaining = 0;
        gameScene._goArrowActive = false;

        // Move jogador para o gatilho do boss
        gameScene._player.setPosition(BOSS_ARENA_X - 50, (WALK_ZONE_TOP + WALK_ZONE_BOTTOM) / 2);

        // Dispara o boss diretamente
        gameScene._triggerBossArena();
      }
    });
  }
}
