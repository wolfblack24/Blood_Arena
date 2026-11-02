/**
 * gameplay.ts
 * ─────────────────────────────────────────────────────────
 * Constantes de gameplay estilo Final Fight.
 * Centraliza valores para agarrão, especial, itens, etc.
 */

// ── Agarrão e Arremesso ────────────────────────────────────
export const GRAB_RANGE = 30; // Distância para agarrar (pixels)
export const GRAB_DURATION = 2500; // Duração máxima do agarrão (ms)
export const KNEE_DAMAGE = 6; // Dano da joelhada
export const KNEE_MAX_HITS = 3; // Máximo de joelhadas seguidas
export const THROW_DAMAGE = 12; // Dano do arremesso
export const THROW_SPEED = 200; // Velocidade do arremesso (pixels/seg)
export const THROW_KNOCKDOWN = true; // Arremesso derruba quem estiver no caminho

// ── Golpe Especial ─────────────────────────────────────────
export const SPECIAL_HP_COST_PERCENT = 0.1; // 10% do HP máximo
export const SPECIAL_COOLDOWN = 1500; // Cooldown do especial (ms)
export const SPECIAL_RADIUS = 50; // Raio do especial (pixels)
export const SPECIAL_DAMAGE = 20; // Dano do especial
export const SPECIAL_IFRAMES_DURATION = 500; // I-frames durante o especial (ms)

// ── Itens e Quebráveis ─────────────────────────────────────
export const BREAKABLE_HP = 2; // HP do barril/caixa
export const FOOD_HEAL_SMALL = 25; // Cura da comida pequena
export const FOOD_HEAL_LARGE = 50; // Cura da comida grande
export const KNIFE_DAMAGE_MULT = 1.5; // Multiplicador de dano da faca
export const KNIFE_RANGE_MULT = 0.7; // Multiplicador de alcance da faca
export const STICK_DAMAGE_MULT = 1.0; // Multiplicador de dano do bastão
export const STICK_RANGE_MULT = 1.5; // Multiplicador de alcance do bastão
export const WEAPON_DURABILITY = 10; // Durabilidade da arma (número de hits)
export const ITEM_DROP_CHANCE = 0.3; // Chance de drop (30%)

// ── Token de Ataque ────────────────────────────────────────
export const ENEMY_MAX_ATTACKERS = 2; // Máximo de inimigos atacando ao mesmo tempo
export const ENEMY_MIN_DISTANCE = 40; // Distância mínima entre inimigos (pixels)
export const ENEMY_CIRCLE_DISTANCE = 80; // Distância para circular ao redor do jogador

// ── Variantes de Inimigo ───────────────────────────────────
export const GRUNT_HP = 40;
export const GRUNT_SPEED = 80;
export const GRUNT_DAMAGE = 10;

export const FAST_HP = 25;
export const FAST_SPEED = 120;
export const FAST_DAMAGE = 8;
export const FAST_TELEGRAPH_MULT = 0.6; // Telegraph 40% mais curto

export const HEAVY_HP = 80;
export const HEAVY_SPEED = 50;
export const HEAVY_DAMAGE = 15;
export const HEAVY_SUPER_ARMOR_HITS = 1; // Super armor no primeiro golpe
export const HEAVY_KNOCKBACK_MULT = 0.5; // Recebe metade do knockback
