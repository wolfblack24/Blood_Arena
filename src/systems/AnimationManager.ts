/**
 * AnimationManager.ts
 * ─────────────────────────────────────────────────────────
 * Centraliza a criação e gerenciamento de animações.
 * Usa placeholders gerados por código (retângulos coloridos).
 * A estrutura está pronta para trocar por arte real (spritesheets).
 *
 * Animações:
 * - Idle: parado
 * - Run: andando
 * - Jump: pulando
 * - Attack: atacando
 * - Hurt: recebendo dano
 * - Dash: esquivando (preparada para futuro)
 * - Fall: caindo (preparada para futuro)
 * - Knockdown: no chão
 */

import Phaser from 'phaser';

/** Nomes das animações (tipados para segurança) */
export type AnimationName = 'idle' | 'run' | 'jump' | 'attack' | 'dash' | 'hurt' | 'fall' | 'knockdown';

/**
 * Gera todas as texturas placeholder no cache do Phaser.
 * Deve ser chamado na PreloadScene.
 * Protegido contra geração duplicada (textures.exists).
 */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  // Protege contra geração duplicada
  if (scene.textures.exists('player_idle')) return;

  const w = 20;  // largura do sprite
  const h = 32;  // altura do sprite

  // ── Idle (1 frame) ─────────────────────────────────────
  const idleGfx = scene.add.graphics();
  idleGfx.fillStyle(0x228b22, 1);     // corpo verde
  idleGfx.fillRect(4, 0, 12, 18);     // tronco (origin bottom)
  idleGfx.fillStyle(0xf5deb3, 1);     // cabeça (pele)
  idleGfx.fillRect(6, -22, 8, 8);     // cabeça
  idleGfx.fillStyle(0x1a1a1a, 1);     // pernas
  idleGfx.fillRect(5, -4, 4, 4);      // perna esquerda
  idleGfx.fillRect(11, -4, 4, 4);     // perna direita
  idleGfx.generateTexture('player_idle', w, h);
  idleGfx.destroy();

  // ── Run (2 frames para simular caminhada) ──────────────
  for (let f = 0; f < 2; f++) {
    const runGfx = scene.add.graphics();
    runGfx.fillStyle(0x228b22, 1);
    runGfx.fillRect(4, 0, 12, 18);
    runGfx.fillStyle(0xf5deb3, 1);
    runGfx.fillRect(6, -22, 8, 8);
    // Pernas alternadas para simular corrida
    const legOffset = f === 0 ? -2 : 2;
    runGfx.fillStyle(0x1a1a1a, 1);
    runGfx.fillRect(5 + legOffset, -4, 4, 4);
    runGfx.fillRect(11 - legOffset, -4, 4, 4);
    runGfx.generateTexture(`player_run_${f}`, w, h);
    runGfx.destroy();
  }

  // ── Jump (1 frame - pernas encolhidas) ─────────────────
  const jumpGfx = scene.add.graphics();
  jumpGfx.fillStyle(0x228b22, 1);
  jumpGfx.fillRect(4, 0, 12, 16);
  jumpGfx.fillStyle(0xf5deb3, 1);
  jumpGfx.fillRect(6, -22, 8, 8);
  jumpGfx.fillStyle(0x1a1a1a, 1);
  jumpGfx.fillRect(5, -6, 5, 3);      // pernas encolhidas
  jumpGfx.fillRect(10, -6, 5, 3);
  jumpGfx.generateTexture('player_jump', w, h);
  jumpGfx.destroy();

  // ── Attack (2 frames - braço estendido) ────────────────
  for (let f = 0; f < 2; f++) {
    const atkGfx = scene.add.graphics();
    atkGfx.fillStyle(0x228b22, 1);
    atkGfx.fillRect(4, 0, 12, 18);
    atkGfx.fillStyle(0xf5deb3, 1);
    atkGfx.fillRect(6, -22, 8, 8);
    // Braço de ataque
    const armExtend = f === 0 ? 10 : 16;
    atkGfx.fillStyle(0xf5deb3, 1);
    atkGfx.fillRect(16, -12, armExtend, 4);
    atkGfx.fillStyle(0x1a1a1a, 1);
    atkGfx.fillRect(5, -4, 4, 4);
    atkGfx.fillRect(11, -4, 4, 4);
    atkGfx.generateTexture(`player_attack_${f}`, w + armExtend, h);
    atkGfx.destroy();
  }

  // ── Hurt (1 frame - piscando vermelho) ─────────────────
  const hurtGfx = scene.add.graphics();
  hurtGfx.fillStyle(0xff4444, 1);     // vermelho de dano
  hurtGfx.fillRect(4, 0, 12, 18);
  hurtGfx.fillStyle(0xffcccc, 1);
  hurtGfx.fillRect(6, -22, 8, 8);
  hurtGfx.fillStyle(0x1a1a1a, 1);
  hurtGfx.fillRect(5, -4, 4, 4);
  hurtGfx.fillRect(11, -4, 4, 4);
  hurtGfx.generateTexture('player_hurt', w, h);
  hurtGfx.destroy();

  // ── Knockdown (deitado) ────────────────────────────────
  const kdGfx = scene.add.graphics();
  kdGfx.fillStyle(0x228b22, 1);
  kdGfx.fillRect(0, -6, 20, 6);       // corpo deitado
  kdGfx.fillStyle(0xf5deb3, 1);
  kdGfx.fillRect(18, -8, 6, 6);       // cabeça
  kdGfx.generateTexture('player_knockdown', 24, 10);
  kdGfx.destroy();

  // ── Sombra (elipse escura no chão) ────────────────────
  const shadowGfx = scene.add.graphics();
  shadowGfx.fillStyle(0x000000, 0.4);
  shadowGfx.fillEllipse(8, 4, 16, 8);
  shadowGfx.generateTexture('shadow', 16, 8);
  shadowGfx.destroy();

  // ── Inimigo placeholder ────────────────────────────────
  const enemyGfx = scene.add.graphics();
  enemyGfx.fillStyle(0x8b0000, 1);
  enemyGfx.fillRect(4, 0, 14, 18);
  enemyGfx.fillStyle(0xcc9966, 1);
  enemyGfx.fillRect(5, -22, 10, 8);
  enemyGfx.fillStyle(0x1a1a1a, 1);
  enemyGfx.fillRect(5, -4, 5, 4);
  enemyGfx.fillRect(12, -4, 5, 4);
  enemyGfx.generateTexture('enemy_basic', 22, 32);
  enemyGfx.destroy();

  // ── Texturas de cenário (protegidas contra duplicação) ─
  if (!scene.textures.exists('bg_far_tex')) {
    _createFarBgTexture(scene);
  }
  if (!scene.textures.exists('bg_near_tex')) {
    _createNearBgTexture(scene);
  }
  if (!scene.textures.exists('ground_tex')) {
    _createGroundTexture(scene);
  }

  // ── Texturas do boss (protegidas contra duplicação) ─
  if (!scene.textures.exists('boss_idle')) {
    _createBossTexture(scene, 'boss_idle', 0x8b0000, 0xcc9966);
  }
  if (!scene.textures.exists('boss_phase2')) {
    _createBossTexture(scene, 'boss_phase2', 0x440044, 0xff4444);
  }
  if (!scene.textures.exists('hazard_falling')) {
    _createHazardTexture(scene);
  }
  if (!scene.textures.exists('hazard_particle')) {
    _createHazardParticleTexture(scene);
  }
  if (!scene.textures.exists('bg_boss_far')) {
    _createBossArenaFarTexture(scene);
  }
  if (!scene.textures.exists('bg_boss_near')) {
    _createBossArenaNearTexture(scene);
  }
  if (!scene.textures.exists('ground_boss')) {
    _createBossArenaGroundTexture(scene);
  }
}

/**
 * Gera textura procedural para o fundo distante.
 */
function _createFarBgTexture(scene: Phaser.Scene): void {
  const texW = 384;
  const texH = 224;
  const gfx = scene.add.graphics();

  gfx.fillStyle(0x0d0d1a, 1);
  gfx.fillRect(0, 0, texW, texH);

  // Silhueta de prédios/ruínas
  gfx.fillStyle(0x15102a, 1);
  for (let x = 0; x < texW; x += 30) {
    const h = Phaser.Math.Between(40, 100);
    const w = Phaser.Math.Between(15, 28);
    gfx.fillRect(x, texH - 80 - h, w, h + 80);
  }

  // Janelas iluminadas
  gfx.fillStyle(0x664400, 0.5);
  for (let i = 0; i < 20; i++) {
    const wx = Phaser.Math.Between(10, texW - 10);
    const wy = Phaser.Math.Between(80, texH - 90);
    gfx.fillRect(wx, wy, 3, 3);
  }

  gfx.generateTexture('bg_far_tex', texW, texH);
  gfx.destroy();
}

/**
 * Gera textura procedural para o fundo próximo.
 */
function _createNearBgTexture(scene: Phaser.Scene): void {
  const texW = 384;
  const texH = 224;
  const gfx = scene.add.graphics();

  gfx.fillStyle(0x1a1a2e, 0.3);
  gfx.fillRect(0, 0, texW, texH);

  // Postes/árvores destruídas
  gfx.fillStyle(0x2a1a1a, 0.8);
  for (let x = 0; x < texW; x += 50) {
    const h = Phaser.Math.Between(30, 70);
    const w = Phaser.Math.Between(3, 6);
    gfx.fillRect(x + Phaser.Math.Between(-5, 5), texH - 60 - h, w, h);
    gfx.fillRect(x + w, texH - 60 - h + 10, Phaser.Math.Between(5, 15), 2);
  }

  gfx.generateTexture('bg_near_tex', texW, texH);
  gfx.destroy();
}

/**
 * Gera textura procedural para o chão.
 */
function _createGroundTexture(scene: Phaser.Scene): void {
  const texW = 128;
  const texH = 90;
  const gfx = scene.add.graphics();

  gfx.fillStyle(0x3a3a2a, 1);
  gfx.fillRect(0, 0, texW, texH);

  // Textura de sujeira
  gfx.fillStyle(0x2a2a1a, 0.5);
  for (let i = 0; i < 15; i++) {
    const sx = Phaser.Math.Between(0, texW);
    const sy = Phaser.Math.Between(0, texH);
    gfx.fillRect(sx, sy, Phaser.Math.Between(2, 8), Phaser.Math.Between(1, 3));
  }

  // Manchas escuras
  gfx.fillStyle(0x1a1a0a, 0.3);
  for (let i = 0; i < 5; i++) {
    const sx = Phaser.Math.Between(0, texW);
    const sy = Phaser.Math.Between(0, texH);
    gfx.fillCircle(sx, sy, Phaser.Math.Between(3, 8));
  }

  gfx.generateTexture('ground_tex', texW, texH);
  gfx.destroy();
}

/**
 * Gera textura procedural para o boss (fase 1).
 */
function _createBossTexture(scene: Phaser.Scene, key: string, bodyColor: number, headColor: number): void {
  const w = 40;
  const h = 56;
  const gfx = scene.add.graphics();

  // Corpo grande
  gfx.fillStyle(bodyColor, 1);
  gfx.fillRect(8, 0, 24, 36);

  // Cabeça
  gfx.fillStyle(headColor, 1);
  gfx.fillRect(12, -36, 16, 16);

  // Pernas
  gfx.fillStyle(0x1a1a1a, 1);
  gfx.fillRect(10, -6, 8, 6);
  gfx.fillRect(22, -6, 8, 6);

  // Braços
  gfx.fillStyle(bodyColor, 1);
  gfx.fillRect(0, 4, 8, 20);
  gfx.fillRect(32, 4, 8, 20);

  gfx.generateTexture(key, w, h);
  gfx.destroy();
}

/**
 * Gera textura para hazard caindo.
 */
function _createHazardTexture(scene: Phaser.Scene): void {
  const gfx = scene.add.graphics();
  gfx.fillStyle(0xff4400, 1);
  gfx.fillTriangle(0, 0, 12, 0, 6, 16);
  gfx.generateTexture('hazard_falling', 12, 16);
  gfx.destroy();
}

/**
 * Gera textura para partícula de hazard.
 */
function _createHazardParticleTexture(scene: Phaser.Scene): void {
  const gfx = scene.add.graphics();
  gfx.fillStyle(0xff6600, 1);
  gfx.fillRect(0, 0, 4, 4);
  gfx.generateTexture('hazard_particle', 4, 4);
  gfx.destroy();
}

/**
 * Gera textura para fundo da arena do boss (distante).
 */
function _createBossArenaFarTexture(scene: Phaser.Scene): void {
  const texW = 384;
  const texH = 224;
  const gfx = scene.add.graphics();

  // Fundo escuro avermelhado
  gfx.fillStyle(0x1a0a0a, 1);
  gfx.fillRect(0, 0, texW, texH);

  // Pilares
  gfx.fillStyle(0x2a1a1a, 1);
  for (let x = 40; x < texW; x += 80) {
    gfx.fillRect(x, 40, 20, 180);
  }

  // Símbolos nas paredes
  gfx.fillStyle(0x440000, 0.5);
  for (let i = 0; i < 10; i++) {
    const x = Phaser.Math.Between(20, texW - 20);
    const y = Phaser.Math.Between(60, 180);
    gfx.fillCircle(x, y, Phaser.Math.Between(3, 6));
  }

  gfx.generateTexture('bg_boss_far', texW, texH);
  gfx.destroy();
}

/**
 * Gera textura para fundo da arena do boss (próximo).
 */
function _createBossArenaNearTexture(scene: Phaser.Scene): void {
  const texW = 384;
  const texH = 224;
  const gfx = scene.add.graphics();

  gfx.fillStyle(0x0a0a0a, 0.3);
  gfx.fillRect(0, 0, texW, texH);

  // Correntes
  gfx.fillStyle(0x3a2a2a, 0.8);
  for (let x = 30; x < texW; x += 60) {
    gfx.fillRect(x, 0, 3, 100);
  }

  gfx.generateTexture('bg_boss_near', texW, texH);
  gfx.destroy();
}

/**
 * Gera textura para o chão da arena do boss.
 */
function _createBossArenaGroundTexture(scene: Phaser.Scene): void {
  const texW = 128;
  const texH = 90;
  const gfx = scene.add.graphics();

  // Chão escuro
  gfx.fillStyle(0x2a1a1a, 1);
  gfx.fillRect(0, 0, texW, texH);

  // Manchas de sangue
  gfx.fillStyle(0x440000, 0.6);
  for (let i = 0; i < 20; i++) {
    const x = Phaser.Math.Between(0, texW);
    const y = Phaser.Math.Between(0, texH);
    gfx.fillCircle(x, y, Phaser.Math.Between(2, 6));
  }

  // Símbolos ritualísticos
  gfx.fillStyle(0x660000, 0.4);
  gfx.strokeCircle(texW / 2, texH / 2, 30);
  gfx.strokeCircle(texW / 2, texH / 2, 20);

  gfx.generateTexture('ground_boss', texW, texH);
  gfx.destroy();
}

/**
 * Cria todas as animações no AnimationManager global.
 * Deve ser chamado uma vez na PreloadScene.
 */
export function createAnimations(anims: Phaser.Animations.AnimationManager): void {
  // Protege contra criação duplicada
  if (anims.exists('idle')) return;

  anims.create({
    key: 'idle',
    frames: [{ key: 'player_idle', frame: 0 }],
    frameRate: 1,
    repeat: -1,
  });

  anims.create({
    key: 'run',
    frames: [
      { key: 'player_run_0', frame: 0 },
      { key: 'player_run_1', frame: 0 },
    ],
    frameRate: 6,
    repeat: -1,
  });

  anims.create({
    key: 'jump',
    frames: [{ key: 'player_jump', frame: 0 }],
    frameRate: 1,
    repeat: 0,
  });

  anims.create({
    key: 'attack',
    frames: [
      { key: 'player_attack_0', frame: 0 },
      { key: 'player_attack_1', frame: 0 },
    ],
    frameRate: 10,
    repeat: 0,
  });

  anims.create({
    key: 'hurt',
    frames: [{ key: 'player_hurt', frame: 0 }],
    frameRate: 8,
    repeat: 0,
  });

  anims.create({
    key: 'knockdown',
    frames: [{ key: 'player_knockdown', frame: 0 }],
    frameRate: 1,
    repeat: 0,
  });

  anims.create({
    key: 'dash',
    frames: [{ key: 'player_idle', frame: 0 }],
    frameRate: 1,
    repeat: 0,
  });

  anims.create({
    key: 'fall',
    frames: [{ key: 'player_jump', frame: 0 }],
    frameRate: 1,
    repeat: 0,
  });
}
