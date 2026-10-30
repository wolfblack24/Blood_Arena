/**
 * boss.ts
 * ─────────────────────────────────────────────────────────
 * Dados do boss, ataques e fases.
 * Centraliza todos os valores para facilitar balanceamento.
 */

// ── Identificação ──────────────────────────────────────────
export const BOSS_NAME = 'O AÇOUGUEIRO';
export const BOSS_TRIGGER_X = 1500; // Posição X para iniciar a luta

// ── Arena ──────────────────────────────────────────────────
export const BOSS_ARENA_X = 1400; // Início da arena
export const BOSS_ARENA_WIDTH = 384; // Largura da arena (1 tela)
export const BOSS_ARENA_Y_TOP = 140;
export const BOSS_ARENA_Y_BOTTOM = 210;

// ── HP e Poise ─────────────────────────────────────────────
export const BOSS_HP = 450;
export const BOSS_POISE_MAX = 100;
export const BOSS_POISE_REGEN_RATE = 5; // Poise recuperado por segundo
export const BOSS_STAGGER_DURATION = 2000; // Duração do stagger (ms)
export const BOSS_PHASE_TRANSITION_HP = 0.5; // 50% do HP

// ── Hurtboxes (partes do corpo) ────────────────────────────
export interface BossHurtboxData {
  name: string;
  offsetX: number; // Relativo ao facing
  zMin: number;
  zMax: number;
  width: number;
  height: number;
  damageMultiplier: number;
  durability?: number; // Para cauda
}

export const BOSS_HURTBOXES: BossHurtboxData[] = [
  {
    name: 'body',
    offsetX: 0,
    zMin: 0,
    zMax: 28,
    width: 24,
    height: 28,
    damageMultiplier: 1.0,
  },
  {
    name: 'head',
    offsetX: 0,
    zMin: 28,
    zMax: 48,
    width: 16,
    height: 20,
    damageMultiplier: 1.8,
  },
  {
    name: 'tail',
    offsetX: -20, // Atrás do boss
    zMin: 0,
    zMax: 12,
    width: 18,
    height: 12,
    damageMultiplier: 0.7,
    durability: 80,
  },
];

// ── Tolerâncias ────────────────────────────────────────────
export const BOSS_LANE_TOLERANCE = 20; // Maior que inimigos comuns

// ── Ataques ────────────────────────────────────────────────
export type BossAttackType = 'charge' | 'projectile' | 'aoe';

export interface BossAttackData {
  type: BossAttackType;
  telegraphDuration: number; // Tempo de telegraph (ms)
  activeDuration: number; // Tempo ativo (ms)
  recoveryDuration: number; // Tempo de recovery (ms)
  damage: number;
  hitboxWidth: number;
  hitboxHeight: number;
  speed?: number; // Para charge e projectile
  zTolerance: number;
}

export const BOSS_ATTACKS: Record<BossAttackType, BossAttackData> = {
  charge: {
    type: 'charge',
    telegraphDuration: 700,
    activeDuration: 600,
    recoveryDuration: 800,
    damage: 25,
    hitboxWidth: 30,
    hitboxHeight: 20,
    speed: 260,
    zTolerance: 15,
  },
  projectile: {
    type: 'projectile',
    telegraphDuration: 500,
    activeDuration: 100,
    recoveryDuration: 600,
    damage: 15,
    hitboxWidth: 12,
    hitboxHeight: 12,
    speed: 180,
    zTolerance: 10,
  },
  aoe: {
    type: 'aoe',
    telegraphDuration: 900,
    activeDuration: 200,
    recoveryDuration: 700,
    damage: 20,
    hitboxWidth: 60,
    hitboxHeight: 40,
    zTolerance: 20,
  },
};

// ── Fase 2 (multiplicadores) ───────────────────────────────
export const BOSS_PHASE2_PROJECTILE_MULT = 1.4;
export const BOSS_PHASE2_DECISION_DELAY = 2200; // ms (mais rápido)
export const BOSS_PHASE2_PROJECTILE_COUNT = 3; // Leque de 3 projéteis

// ── Metrônomo ──────────────────────────────────────────────
export const BOSS_DECISION_DELAY = 3000; // ms (fase 1)

// ── Projéteis ──────────────────────────────────────────────
export const BOSS_PROJECTILE_SPEED = 180; // pixels/seg
export const BOSS_PROJECTILE_POOL_SIZE = 10;

// ── Hazards (Fase 2) ──────────────────────────────────────
export const FALLING_HAZARD_INTERVAL = 1200; // ms
export const FALLING_HAZARD_POOL_SIZE = 8;
export const FALLING_HAZARD_WARNING_DURATION = 600; // ms
export const FALLING_HAZARD_FALL_SPEED = 300; // pixels/seg
export const FALLING_HAZARD_GRAVITY = 800; // pixels/seg²
export const FALLING_HAZARD_DAMAGE = 12;
export const FALLING_HAZARD_RADIUS = 20; // Raio de dano no impacto
export const FALLING_HAZARD_SAFE_HEIGHT = 12; // Jogador pulando acima disso não é atingido

// ── Lacaios (Fase 2) ──────────────────────────────────────
export const BOSS_MINION_INTERVAL = 20000; // ms
export const BOSS_MINION_COUNT = 2;
export const BOSS_MINION_MAX = 4; // Limite de lacaios simultâneos

// ── Esquiva do Jogador ─────────────────────────────────────
export const DASH_DURATION = 160; // ms
export const DASH_SPEED = 200; // pixels/seg
export const DASH_STAMINA_COST = 20;
export const DASH_COOLDOWN = 400; // ms
export const DASH_IFRAMES_DURATION = 200; // ms

// ── Bônus de Dano ──────────────────────────────────────────
export const STAGGER_DAMAGE_MULT = 1.25; // Bônus durante stagger

// ── Morte do Boss ──────────────────────────────────────────
export const BOSS_DEATH_SLOWMO_DURATION = 1000; // ms
export const BOSS_DEATH_EXPLOSION_PARTICLES = 50;
