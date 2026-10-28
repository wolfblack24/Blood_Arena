/**
 * PreloadScene.ts
 * ─────────────────────────────────────────────────────────
 * Segunda cena. Responsável por:
 * - Gerar todas as texturas placeholder por código
 *   (sem depender de assets externos)
 * - Criar as animações do jogador
 * - Mostrar progresso e transicionar para o MainMenu
 *
 * Quando houver assets reais (spritesheets, áudio),
 * eles serão carregados aqui com this.load.image(), etc.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { generatePlaceholderTextures, createAnimations } from '../systems/AnimationManager';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // ── Barra de progresso ───────────────────────────────
    const barWidth = 200;
    const barHeight = 10;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT / 2;

    this.add.rectangle(x, y, barWidth, barHeight, 0x222222)
      .setOrigin(0, 0.5);
    const fillBar = this.add.rectangle(x, y, 0, barHeight, 0xff4444)
      .setOrigin(0, 0.5);

    this.add.text(GAME_WIDTH / 2, y - 18, 'Preparando assets...', {
      fontSize: '10px',
      color: '#ff6666',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Atualiza a barra conforme o progresso
    this.load.on('progress', (value: number) => {
      fillBar.displayWidth = barWidth * value;
    });

    // ── Aqui entrariam os assets reais ───────────────────
    // Exemplo (quando houver):
    // this.load.spritesheet('player', 'assets/player.png', { frameWidth: 32, frameHeight: 48 });
    // this.load.audio('bgm', 'assets/bgm.ogg');
    //
    // Como não há assets externos, o preload completa instantaneamente.
    // A barra é animada no create() para dar feedback visual.
  }

  create(): void {
    // ── Gera texturas placeholder por código ─────────────
    generatePlaceholderTextures(this);

    // ── Cria animações globais ───────────────────────────
    createAnimations(this.anims);

    // ── Anima a barra de progresso (feedback visual) ─────
    const barWidth = 200;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT / 2;
    const fillBar = this.add.rectangle(x, y, 0, 10, 0xff4444)
      .setOrigin(0, 0.5);

    this.tweens.add({
      targets: fillBar,
      displayWidth: barWidth,
      duration: 400,
      ease: 'Linear',
    });

    // ── Transiciona para o menu ──────────────────────────
    // Delay para o jogador ver a tela de preload
    this.time.delayedCall(600, () => {
      this.scene.start('MainMenuScene');
    });
  }
}
