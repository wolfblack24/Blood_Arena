/**
 * stage.ts
 * ─────────────────────────────────────────────────────────
 * Configuração das ondas de inimigos da fase.
 * Cada onda tem um triggerX, número de inimigos e flag de travar câmera.
 */

import { WORLD_WIDTH } from './constants';
import { BOSS_ARENA_WIDTH } from './boss';

/**
 * Configuração de uma onda de inimigos.
 */
export interface WaveConfig {
  /** Posição X do trigger (quando o jogador cruza, a onda inicia) */
  triggerX: number;
  /** Número de inimigos na onda */
  enemies: number;
  /** Se true, trava a câmera durante a onda */
  lockCamera: boolean;
}

/**
 * Ondas da fase (3 ondas antes do boss).
 * A última onda termina antes da arena do boss.
 */
export const STAGE_WAVES: WaveConfig[] = [
  {
    triggerX: 200,
    enemies: 3,
    lockCamera: true,
  },
  {
    triggerX: 650,
    enemies: 4,
    lockCamera: true,
  },
  {
    triggerX: 1050,
    enemies: 5,
    lockCamera: true,
  },
];

/**
 * Flag para modo demo com respawn infinito (apenas para debug).
 * Em produção, deve ser false.
 */
export const ENDLESS_RESPAWN = false;

/**
 * Posição X do gatilho do boss (deve ser após a última onda).
 * A arena começa em WORLD_WIDTH - BOSS_ARENA_WIDTH.
 */
export const BOSS_TRIGGER_X = WORLD_WIDTH - BOSS_ARENA_WIDTH - 16;

/**
 * Distância que o jogador precisa avançar após limpar uma onda
 * para a seta GO desaparecer e liberar o avanço.
 */
export const GO_ARROW_ADVANCE_DISTANCE = 80;
