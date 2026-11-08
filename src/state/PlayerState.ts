/**
 * PlayerState.ts
 * ─────────────────────────────────────────────────────────
 * Estado puro do jogador, SEM nenhuma referência a sprites
 * ou objetos visuais do Phaser. Usa EventEmitter para
 * notificar mudanças (UIScene escuta esses eventos).
 *
 * Separação de responsabilidades:
 * - PlayerState → dados puros (HP, stamina, vidas, score)
 * - Player (entity) → sprite, física, animação
 * - UIScene → renderiza HUD baseado nos eventos
 */

import Phaser from 'phaser';
import {
  PLAYER_HP_MAX,
  PLAYER_STAMINA_MAX,
  PLAYER_LIVES,
  EVENTS,
} from '../config/constants';

/**
 * Classe de estado do jogador.
 * Emite eventos via EventEmitter global do Phaser (game.events)
 * para que a UIScene e outros sistemas reajam sem acoplamento.
 */
export class PlayerState {
  // ── Dados ──────────────────────────────────────────────
  private _hp: number;
  private _hpMax: number;
  private _stamina: number;
  private _staminaMax: number;
  private _lives: number;
  private _score: number;
  private _isAlive: boolean;

  // Referência ao emitter global do Phaser
  private _events: Phaser.Events.EventEmitter;

  constructor(events: Phaser.Events.EventEmitter) {
    this._events = events;
    this._hpMax = PLAYER_HP_MAX;
    this._hp = this._hpMax;
    this._staminaMax = PLAYER_STAMINA_MAX;
    this._stamina = this._staminaMax;
    this._lives = PLAYER_LIVES;
    this._score = 0;
    this._isAlive = true;
  }

  // ── Getters (somente leitura para o mundo externo) ─────
  get hp(): number { return this._hp; }
  get hpMax(): number { return this._hpMax; }
  get stamina(): number { return this._stamina; }
  get staminaMax(): number { return this._staminaMax; }
  get lives(): number { return this._lives; }
  get score(): number { return this._score; }
  get isAlive(): boolean { return this._isAlive; }

  // ── HP ─────────────────────────────────────────────────
  /**
   * Aplica dano ao jogador. Retorna true se morreu.
   */
  takeDamage(amount: number): boolean {
    if (!this._isAlive) return false;

    this._hp = Math.max(0, this._hp - amount);
    this._events.emit(EVENTS.HP_CHANGED, this._hp, this._hpMax);
    this._events.emit(EVENTS.PLAYER_DAMAGED, amount);

    if (this._hp <= 0) {
      this._handleDeath();
      return true;
    }
    return false;
  }

  /**
   * Cura o jogador (limitado ao HP máximo).
   */
  heal(amount: number): void {
    this._hp = Math.min(this._hpMax, this._hp + amount);
    this._events.emit(EVENTS.HP_CHANGED, this._hp, this._hpMax);
  }

  // ── Stamina ────────────────────────────────────────────
  /**
   * Gasta stamina (ex.: para dash, ataque especial).
   * Retorna true se conseguiu gastar.
   */
  spendStamina(amount: number): boolean {
    if (this._stamina < amount) return false;
    this._stamina -= amount;
    this._events.emit(EVENTS.STAMINA_CHANGED, this._stamina, this._staminaMax);
    return true;
  }

  /**
   * Recupera stamina ao longo do tempo.
   */
  recoverStamina(amount: number): void {
    this._stamina = Math.min(this._staminaMax, this._stamina + amount);
    this._events.emit(EVENTS.STAMINA_CHANGED, this._stamina, this._staminaMax);
  }

  // ── Vidas ──────────────────────────────────────────────
  loseLife(): void {
    this._lives = Math.max(0, this._lives - 1);
    this._events.emit(EVENTS.LIVES_CHANGED, this._lives);

    if (this._lives <= 0) {
      this._events.emit(EVENTS.GAME_OVER);
    }
  }

  // ── Score ──────────────────────────────────────────────
  addScore(points: number): void {
    this._score += points;
    this._events.emit(EVENTS.SCORE_CHANGED, this._score);
  }

  // ── Reset ──────────────────────────────────────────────
  /**
   * Reseta o estado para um novo jogo.
   */
  reset(): void {
    this._hp = this._hpMax;
    this._stamina = this._staminaMax;
    this._lives = PLAYER_LIVES;
    this._score = 0;
    this._isAlive = true;

    this._events.emit(EVENTS.HP_CHANGED, this._hp, this._hpMax);
    this._events.emit(EVENTS.STAMINA_CHANGED, this._stamina, this._staminaMax);
    this._events.emit(EVENTS.LIVES_CHANGED, this._lives);
    this._events.emit(EVENTS.SCORE_CHANGED, this._score);
  }

  /**
   * Revive o jogador após perder uma vida (reseta HP).
   */
  respawn(): void {
    this._hp = this._hpMax;
    this._stamina = this._staminaMax;
    this._isAlive = true;
    this._events.emit(EVENTS.HP_CHANGED, this._hp, this._hpMax);
    this._events.emit(EVENTS.STAMINA_CHANGED, this._stamina, this._staminaMax);
  }

  // ── Morte ──────────────────────────────────────────────
  private _handleDeath(): void {
    this._isAlive = false;
    this._events.emit(EVENTS.PLAYER_DIED);
    this.loseLife();
  }
}
