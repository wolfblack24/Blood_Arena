/**
 * LevelBounds.ts
 * ─────────────────────────────────────────────────────────
 * Módulo simples para gerenciar limites dinâmicos do nível.
 * Permite alternar entre fase normal e arena do boss.
 */

import { WORLD_WIDTH, WALK_ZONE_TOP, WALK_ZONE_BOTTOM } from '../config/constants';
import { BOSS_ARENA_X, BOSS_ARENA_WIDTH } from '../config/boss';

/** Estado atual dos limites do nível */
let _currentMinX = 0;
let _currentMaxX = WORLD_WIDTH;
let _currentMinY = WALK_ZONE_TOP;
let _currentMaxY = WALK_ZONE_BOTTOM;
let _isArenaMode = false;

/**
 * Define os limites para a fase normal (mundo inteiro).
 */
export function setStageBounds(): void {
  _currentMinX = 0;
  _currentMaxX = WORLD_WIDTH;
  _currentMinY = WALK_ZONE_TOP;
  _currentMaxY = WALK_ZONE_BOTTOM;
  _isArenaMode = false;
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
