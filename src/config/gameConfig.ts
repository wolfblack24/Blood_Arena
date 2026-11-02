/**
 * gameConfig.ts
 * ─────────────────────────────────────────────────────────
 * Configuração principal do Phaser 3.
 * WebGL forçado, pixel art, resolução fixa 384x224,
 * escala FIT centralizada, física Arcade sem gravidade global.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT } from './constants';

// Cenas importadas (serão criadas nos próximos passos)
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';
import { UIScene } from '../scenes/UIScene';
import { BossTransitionScene } from '../scenes/BossTransitionScene';

/**
 * Retorna a configuração completa do jogo Phaser.
 * Pode ser chamada em qualquer momento para instanciar o jogo.
 */
export function createGameConfig(parentElement: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,               // WebGL forçado
    pixelArt: true,                    // desabilita filtros de suavização
    roundPixels: true,                 // arredonda posições para evitar sub-pixel blur
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: parentElement,

    // ── Escala ───────────────────────────────────────────
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    // ── Física Arcade (sem gravidade global) ─────────────
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },      // gravidade zero (2.5D manual)
        debug: false,                   // mude para true para ver hitboxes
      },
    },

    // ── Cenas na ordem de execução ───────────────────────
    scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, BossTransitionScene],
  };
}
