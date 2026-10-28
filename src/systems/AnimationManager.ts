/**
 * AnimationManager.ts
 * ─────────────────────────────────────────────────────────
 * Centraliza a criação e gerenciamento de animações.
 * Como ainda não há spritesheets, usa placeholders gerados
 * por código (retângulos coloridos). A estrutura está pronta
 * para trocar por arte real (spritesheets) sem alterar
 * a lógica do Player.
 *
 * Animações preparadas:
 * - Idle: parado
 * - Run: andando
 * - Jump: pulando
 * - Attack: atacando (preparada para Fase 2)
 * - Dash: esquivando (preparada para Fase 2)
 * - Hurt: recebendo dano (preparada para Fase 2)
 * - Fall: caindo (preparada para Fase 2)
 */

import Phaser from 'phaser';

/** Nomes das animações (tipados para segurança) */
export type AnimationName = 'idle' | 'run' | 'jump' | 'attack' | 'dash' | 'hurt' | 'fall';

/**
 * Gera todas as texturas placeholder no cache do Phaser.
 * Deve ser chamado na PreloadScene.
 */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const w = 20;  // largura do sprite
  const h = 32;  // altura do sprite

  // ── Idle (1 frame) ─────────────────────────────────────
  const idleGfx = scene.add.graphics();
  idleGfx.fillStyle(0x228b22, 1);     // corpo verde
  idleGfx.fillRect(4, 10, 12, 18);    // tronco
  idleGfx.fillStyle(0xf5deb3, 1);     // cabeça (pele)
  idleGfx.fillRect(6, 2, 8, 8);       // cabeça
  idleGfx.fillStyle(0x1a1a1a, 1);     // pernas
  idleGfx.fillRect(5, 28, 4, 4);      // perna esquerda
  idleGfx.fillRect(11, 28, 4, 4);     // perna direita
  idleGfx.generateTexture('player_idle', w, h);
  idleGfx.destroy();

  // ── Run (2 frames para simular caminhada) ──────────────
  for (let f = 0; f < 2; f++) {
    const runGfx = scene.add.graphics();
    runGfx.fillStyle(0x228b22, 1);
    runGfx.fillRect(4, 10, 12, 18);
    runGfx.fillStyle(0xf5deb3, 1);
    runGfx.fillRect(6, 2, 8, 8);
    // Pernas alternadas para simular corrida
    const legOffset = f === 0 ? -2 : 2;
    runGfx.fillStyle(0x1a1a1a, 1);
    runGfx.fillRect(5 + legOffset, 28, 4, 4);
    runGfx.fillRect(11 - legOffset, 28, 4, 4);
    runGfx.generateTexture(`player_run_${f}`, w, h);
    runGfx.destroy();
  }

  // ── Jump (1 frame - pernas encolhidas) ─────────────────
  const jumpGfx = scene.add.graphics();
  jumpGfx.fillStyle(0x228b22, 1);
  jumpGfx.fillRect(4, 10, 12, 16);
  jumpGfx.fillStyle(0xf5deb3, 1);
  jumpGfx.fillRect(6, 2, 8, 8);
  jumpGfx.fillStyle(0x1a1a1a, 1);
  jumpGfx.fillRect(5, 26, 5, 3);      // pernas encolhidas
  jumpGfx.fillRect(10, 26, 5, 3);
  jumpGfx.generateTexture('player_jump', w, h);
  jumpGfx.destroy();

  // ── Attack (2 frames - braço estendido) ────────────────
  for (let f = 0; f < 2; f++) {
    const atkGfx = scene.add.graphics();
    atkGfx.fillStyle(0x228b22, 1);
    atkGfx.fillRect(4, 10, 12, 18);
    atkGfx.fillStyle(0xf5deb3, 1);
    atkGfx.fillRect(6, 2, 8, 8);
    // Braço de ataque
    const armExtend = f === 0 ? 10 : 16;
    atkGfx.fillStyle(0xf5deb3, 1);
    atkGfx.fillRect(16, 12, armExtend, 4);
    atkGfx.fillStyle(0x1a1a1a, 1);
    atkGfx.fillRect(5, 28, 4, 4);
    atkGfx.fillRect(11, 28, 4, 4);
    atkGfx.generateTexture(`player_attack_${f}`, w + armExtend, h);
    atkGfx.destroy();
  }

  // ── Hurt (1 frame - piscando vermelho) ─────────────────
  const hurtGfx = scene.add.graphics();
  hurtGfx.fillStyle(0xff4444, 1);     // vermelho de dano
  hurtGfx.fillRect(4, 10, 12, 18);
  hurtGfx.fillStyle(0xffcccc, 1);
  hurtGfx.fillRect(6, 2, 8, 8);
  hurtGfx.fillStyle(0x1a1a1a, 1);
  hurtGfx.fillRect(5, 28, 4, 4);
  hurtGfx.fillRect(11, 28, 4, 4);
  hurtGfx.generateTexture('player_hurt', w, h);
  hurtGfx.destroy();

  // ── Sombra (elipse escura no chão) ────────────────────
  const shadowGfx = scene.add.graphics();
  shadowGfx.fillStyle(0x000000, 0.4);
  shadowGfx.fillEllipse(8, 4, 16, 8);
  shadowGfx.generateTexture('shadow', 16, 8);
  shadowGfx.destroy();

  // ── Inimigo placeholder ────────────────────────────────
  const enemyGfx = scene.add.graphics();
  enemyGfx.fillStyle(0x8b0000, 1);
  enemyGfx.fillRect(4, 10, 14, 18);
  enemyGfx.fillStyle(0xcc9966, 1);
  enemyGfx.fillRect(6, 2, 10, 8);
  enemyGfx.fillStyle(0x1a1a1a, 1);
  enemyGfx.fillRect(5, 28, 5, 4);
  enemyGfx.fillRect(12, 28, 5, 4);
  enemyGfx.generateTexture('enemy_basic', 22, 32);
  enemyGfx.destroy();
}

/**
 * Cria todas as animações no AnimationManager global.
 * Deve ser chamado uma vez na PreloadScene após gerar texturas.
 */
export function createAnimations(anims: Phaser.Animations.AnimationManager): void {
  // Idle
  anims.create({
    key: 'idle',
    frames: [{ key: 'player_idle', frame: 0 }],
    frameRate: 1,
    repeat: -1,
  });

  // Run (2 frames alternados)
  anims.create({
    key: 'run',
    frames: [
      { key: 'player_run_0', frame: 0 },
      { key: 'player_run_1', frame: 0 },
    ],
    frameRate: 6,
    repeat: -1,
  });

  // Jump
  anims.create({
    key: 'jump',
    frames: [{ key: 'player_jump', frame: 0 }],
    frameRate: 1,
    repeat: 0,
  });

  // Attack (preparada para Fase 2)
  anims.create({
    key: 'attack',
    frames: [
      { key: 'player_attack_0', frame: 0 },
      { key: 'player_attack_1', frame: 0 },
    ],
    frameRate: 10,
    repeat: 0,
  });

  // Hurt (preparada para Fase 2)
  anims.create({
    key: 'hurt',
    frames: [{ key: 'player_hurt', frame: 0 }],
    frameRate: 8,
    repeat: 2,
  });

  // Dash (preparada para Fase 2)
  anims.create({
    key: 'dash',
    frames: [{ key: 'player_idle', frame: 0 }],
    frameRate: 1,
    repeat: 0,
  });

  // Fall (preparada para Fase 2)
  anims.create({
    key: 'fall',
    frames: [{ key: 'player_jump', frame: 0 }],
    frameRate: 1,
    repeat: 0,
  });
}

/**
 * Troca a animação do sprite, evitando restart desnecessário.
 */
export function playAnimation(
  sprite: Phaser.Physics.Arcade.Sprite,
  animKey: AnimationName
): void {
  if (sprite.anims.currentAnim?.key !== animKey) {
    sprite.play(animKey, true);
  }
}
