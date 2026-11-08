/**
 * attacks.ts
 * ─────────────────────────────────────────────────────────
 * Dados dos ataques do jogador.
 * Cada ataque tem: startup, active, recovery (ms), dano,
 * hitstop, knockback, knockdown, dimensões da hitbox e
 * tolerância de profundidade (eixo Z).
 */

/** Dados de um ataque */
export interface AttackData {
  /** Tempo de startup antes da hitbox ativar (ms) */
  startup: number;
  /** Tempo em que a hitbox fica ativa (ms) */
  active: number;
  /** Tempo de recovery após a hitbox desativar (ms) */
  recovery: number;
  /** Dano causado ao acertar */
  damage: number;
  /** Frames de hitstop ao acertar */
  hitstop: number;
  /** Força do knockback (pixels/seg) */
  knockback: number;
  /** Se causa knockdown (derruba o alvo) */
  knockdown: boolean;
  /** Largura da hitbox (pixels) */
  hitboxWidth: number;
  /** Altura da hitbox (pixels) */
  hitboxHeight: number;
  /** Tolerância de profundidade Z para acertar (pixels) */
  zTolerance: number;
}

/**
 * Combo de 3 golpes do jogador.
 * O 3º golpe causa knockdown.
 */
export const PLAYER_ATTACKS: AttackData[] = [
  // Golpe 1: jab rápido
  {
    startup: 80,
    active: 200,      // Aumentado de 100 para 200 (mais tempo de hitbox ativa)
    recovery: 150,
    damage: 8,
    hitstop: 2,
    knockback: 80,
    knockdown: false,
    hitboxWidth: 30,  // Aumentado de 20 para 30 (hitbox maior)
    hitboxHeight: 20, // Aumentado de 12 para 20
    zTolerance: 25,   // Aumentado de 15 para 25
  },
  // Golpe 2: cruzado
  {
    startup: 100,
    active: 250,      // Aumentado de 120 para 250
    recovery: 180,
    damage: 8,
    hitstop: 3,
    knockback: 100,
    knockdown: false,
    hitboxWidth: 35,  // Aumentado
    hitboxHeight: 22,
    zTolerance: 25,
  },
  // Golpe 3: uppercut (causa knockdown)
  {
    startup: 120,
    active: 300,      // Aumentado de 140 para 300
    recovery: 250,
    damage: 14,
    hitstop: 4,
    knockback: 150,
    knockdown: true,
    hitboxWidth: 32,
    hitboxHeight: 25,
    zTolerance: 30,
  },
];

/**
 * Ataque aéreo (voadora).
 * Pode ser executado durante o pulo.
 */
export const PLAYER_AIR_ATTACK: AttackData = {
  startup: 60,
  active: 150,
  recovery: 100,
  damage: 10,
  hitstop: 3,
  knockback: 120,
  knockdown: false,
  hitboxWidth: 20,
  hitboxHeight: 16,
  zTolerance: 25,
};

/**
 * Ataque do inimigo (dummy agressivo).
 * Telegrafado e lento.
 */
export const ENEMY_ATTACK: AttackData = {
  startup: 400,
  active: 200,
  recovery: 300,
  damage: 12,
  hitstop: 2,
  knockback: 100,
  knockdown: false,
  hitboxWidth: 18,
  hitboxHeight: 14,
  zTolerance: 15,
};

/**
 * Rising Tackle (Dragon Punch).
 * Ataque especial vertical com hitbox ativa durante a subida.
 * Requer carregamento de 500ms e consome 30 de stamina.
 */
export const RISING_TACKLE: AttackData = {
  startup: 100,      // Tempo antes da hitbox ativar (invulnerável neste período)
  active: 250,       // Hitbox ativa durante a subida
  recovery: 300,     // Tempo caindo/aterrissando
  damage: 20,        // Dano alto
  hitstop: 4,        // Hitstop forte ao acertar
  knockback: 0,      // Sem knockback horizontal (é puramente vertical)
  knockdown: true,   // Sempre derruba o inimigo
  hitboxWidth: 24,   
  hitboxHeight: 40,  // Hitbox alta e estreita (vertical)
  zTolerance: 40,    // Alta tolerância Z para pegar inimigos acima ou em lanes diferentes
};
