/**
 * constants.ts
 * ─────────────────────────────────────────────────────────
 * Constantes globais do jogo. Centraliza valores mágicos
 * para facilitar ajuste fino e manutenção.
 */

// ── Resolução interna (pixel art) ──────────────────────────
export const GAME_WIDTH = 384;
export const GAME_HEIGHT = 224;

// ── Faixa de movimento 2.5D (eixo Y do chão) ──────────────
// O jogador só pode andar dentro desta faixa vertical.
export const WALK_ZONE_TOP = 130;
export const WALK_ZONE_BOTTOM = 210;

// ── Mundo (largura total do cenário) ───────────────────────
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = GAME_HEIGHT;

// ── Jogador ────────────────────────────────────────────────
export const PLAYER_SPEED = 120;       // pixels/seg
export const PLAYER_JUMP_FORCE = 220;  // velocidade inicial do pulo (eixo Z)
export const PLAYER_GRAVITY = 600;     // gravidade do eixo Z
export const PLAYER_DRAG = 800;        // drag para sensação de peso ao parar
export const PLAYER_HP_MAX = 100;
export const PLAYER_STAMINA_MAX = 100;
export const PLAYER_LIVES = 3;

// ── Profundidade / Ordenação ───────────────────────────────
// depth = Y do chão do sprite, garantindo que objetos mais
// "perto da câmera" (Y maior) fiquem na frente.
export const DEPTH_BASE = 0;

// ── Câmera ─────────────────────────────────────────────────
export const CAMERA_LERP = 0.1;        // suavidade do follow

// ── Cores placeholder (geradas por código) ─────────────────
export const COLOR_PLAYER_BODY = 0x228b22;    // verde (herói)
export const COLOR_PLAYER_HEAD = 0xf5deb3;    // pele
export const COLOR_ENEMY_BODY = 0x8b0000;     // vermelho escuro
export const COLOR_SHADOW = 0x000000;
export const COLOR_GROUND = 0x3a3a2a;
export const COLOR_SKY_TOP = 0x1a0a2e;
export const COLOR_SKY_BOTTOM = 0x3d1a5c;
export const COLOR_BG_FAR = 0x0d0d1a;
export const COLOR_BG_NEAR = 0x1a1a2e;

// ── Eventos customizados (GameScene ↔ UIScene) ────────────
export const EVENTS = {
  HP_CHANGED: 'hp:changed',
  STAMINA_CHANGED: 'stamina:changed',
  LIVES_CHANGED: 'lives:changed',
  SCORE_CHANGED: 'score:changed',
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_DIED: 'player:died',
  GAME_OVER: 'game:over',
} as const;
