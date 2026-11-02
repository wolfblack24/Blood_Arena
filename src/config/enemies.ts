/**
 * enemies.ts
 * ─────────────────────────────────────────────────────────
 * Dados das variantes de inimigos.
 * Define as características de cada tipo de inimigo.
 */

import {
  GRUNT_HP, GRUNT_SPEED, GRUNT_DAMAGE,
  FAST_HP, FAST_SPEED, FAST_DAMAGE, FAST_TELEGRAPH_MULT,
  HEAVY_HP, HEAVY_SPEED, HEAVY_DAMAGE, HEAVY_SUPER_ARMOR_HITS, HEAVY_KNOCKBACK_MULT,
} from './gameplay';

/**
 * Tipo de inimigo.
 */
export type EnemyType = 'grunt' | 'fast' | 'heavy';

/**
 * Dados de um tipo de inimigo.
 */
export interface EnemyTypeData {
  type: EnemyType;
  hp: number;
  speed: number;
  damage: number;
  telegraphMult: number; // Multiplicador do tempo de telegraph
  superArmorHits: number; // Golpes com super armor
  knockbackMult: number; // Multiplicador de knockback recebido
  texture: string; // Nome da textura
}

/**
 * Dados dos tipos de inimigos.
 */
export const ENEMY_TYPES: Record<EnemyType, EnemyTypeData> = {
  grunt: {
    type: 'grunt',
    hp: GRUNT_HP,
    speed: GRUNT_SPEED,
    damage: GRUNT_DAMAGE,
    telegraphMult: 1.0,
    superArmorHits: 0,
    knockbackMult: 1.0,
    texture: 'enemy_basic',
  },
  fast: {
    type: 'fast',
    hp: FAST_HP,
    speed: FAST_SPEED,
    damage: FAST_DAMAGE,
    telegraphMult: FAST_TELEGRAPH_MULT,
    superArmorHits: 0,
    knockbackMult: 1.0,
    texture: 'enemy_fast',
  },
  heavy: {
    type: 'heavy',
    hp: HEAVY_HP,
    speed: HEAVY_SPEED,
    damage: HEAVY_DAMAGE,
    telegraphMult: 1.0,
    superArmorHits: HEAVY_SUPER_ARMOR_HITS,
    knockbackMult: HEAVY_KNOCKBACK_MULT,
    texture: 'enemy_heavy',
  },
};

/**
 * Composição de uma onda de inimigos.
 */
export interface WaveComposition {
  triggerX: number;
  enemies: { type: EnemyType; count: number }[];
  lockCamera: boolean;
}

/**
 * Composição das ondas (exemplo).
 * Pode ser expandido conforme necessário.
 */
export const WAVE_COMPOSITIONS: WaveComposition[] = [
  {
    triggerX: 200,
    enemies: [
      { type: 'grunt', count: 3 },
    ],
    lockCamera: true,
  },
  {
    triggerX: 650,
    enemies: [
      { type: 'grunt', count: 2 },
      { type: 'fast', count: 2 },
    ],
    lockCamera: true,
  },
  {
    triggerX: 1050,
    enemies: [
      { type: 'grunt', count: 2 },
      { type: 'fast', count: 1 },
      { type: 'heavy', count: 2 },
    ],
    lockCamera: true,
  },
];
