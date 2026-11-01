/**
 * LevelBounds.ts
 * ─────────────────────────────────────────────────────────
 * Módulo simples para gerenciar limites dinâmicos do nível.
 * Permite alternar entre fase normal, ondas e arena do boss.
 */

import { WORLD_WIDTH, WALK_ZONE_TOP, WALK_ZONE_BOTTOM, GAME_WIDTH } from '../config/constants';
import { BOSS_ARENA_X, BOSS_ARENA_WIDTH } from '../config/boss';

/** Estado atual dos limites do nível */
let _currentMinX = 0;
let _currentMaxX = WORLD_WIDTH;
let _currentMinY = WALK_ZONE_TOP;
let _currentMaxY = WALK_ZONE_BOTTOM;
let _isArenaMode = false;
let _isWaveLocked = false;

/**
 * Define os limites para a fase normal (mundo inteiro).
 */
export function setStageBounds(): void {
  _currentMinX = 0;
  _currentMaxX = WORLD_WIDTH;
  _currentMinY = WALK_ZONE_TOP;
  _currentMaxY = WALK_ZONE_BOTTOM;
  _isArenaMode = false;
  _isWaveLocked = false;
}

/**
 * Define os limites para a arena do boss (1 tela de largura).
 */
export function setArenaBounds(): void {
  _currentMinX = BOSS_ARENA_X;
  _currentMaxX = BOSS_ARENA_X + BOSS_ARENA_WIDTH;
  _currentMinY = WALK_ZONE_TOP;
  _currentMaxY = WALK_ZONE_BOTTOM;
  _isArenaMode = true;
  _isWaveLocked = false;
}

/**
 * Trava os limites na tela atual (para ondas).
 * O jogador fica confinado a uma região de GAME_WIDTH.
 */
export function lockToCurrentScreen(playerX: number): void {
  // Centraliza a tela no jogador, mas respeita os limites do mundo
  const halfScreen = GAME_WIDTH / 2;
  let minX = playerX - halfScreen;
  let maxX = playerX + halfScreen;

  // Garante que não saia do mundo
  if (minX < 0) {
    minX = 0;
    maxX = GAME_WIDTH;
  }
  if (maxX > WORLD_WIDTH) {
    maxX = WORLD_WIDTH;
    minX = WORLD_WIDTH - GAME_WIDTH;
  }

  _currentMinX = minX;
  _currentMaxX = maxX;
  _currentMinY = WALK_ZONE_TOP;
  _currentMaxY = WALK_ZONE_BOTTOM;
  _isWaveLocked = true;
}

/**
 * Destrava os limites (após onda concluída).
 */
export function unlockBounds(): void {
  _currentMinX = 0;
  _currentMaxX = WORLD_WIDTH;
  _currentMinY = WALK_ZONE_TOP;
  _currentMaxY = WALK_ZONE_BOTTOM;
  _isWaveLocked = false;
}

/**
 * Retorna o minX atual.
 */
export function getMinX(): number {
  return _currentMinX;
}

/**
 * Retorna o maxX atual.
 */
export function getMaxX(): number {
  return _currentMaxX;
}

/**
 * Retorna o minY atual.
 */
export function getMinY(): number {
  return _currentMinY;
}

/**
 * Retorna o maxY atual.
 */
export function getMaxY(): number {
  return _currentMaxY;
}

/**
 * Verifica se está no modo arena.
 */
export function isArenaMode(): boolean {
  return _isArenaMode;
}

/**
 * Verifica se os limites estão travados (onda ativa).
 */
export function isWaveLocked(): boolean {
  return _isWaveLocked;
}
