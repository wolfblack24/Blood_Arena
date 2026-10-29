/**
 * UIScene.ts
 * ─────────────────────────────────────────────────────────
 * Cena de interface (HUD). Roda em paralelo à GameScene.
 *
 * Exibe:
 * - Barra de HP
 * - Barra de Stamina
 * - Vidas restantes
 * - Pontuação
 * - Contador de combo
 *
 * Comunicação: escuta eventos do game.events.
 * Usa handlers nomeados e remove no shutdown.
 */

import Phaser from 'phaser';
import { PlayerState } from '../state/PlayerState';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  EVENTS,
} from '../config/constants';

export class UIScene extends Phaser.Scene {
  // ── Elementos visuais ──────────────────────────────────
  private _hpBar!: Phaser.GameObjects.Rectangle;
  private _hpBarBg!: Phaser.GameObjects.Rectangle;
  private _staminaBar!: Phaser.GameObjects.Rectangle;
  private _staminaBarBg!: Phaser.GameObjects.Rectangle;
  private _livesText!: Phaser.GameObjects.Text;
  private _scoreText!: Phaser.GameObjects.Text;
  private _comboText!: Phaser.GameObjects.Text;

  // ── Referência ao estado ───────────────────────────────
  private _playerState!: PlayerState;

  // ── Dimensões ──────────────────────────────────────────
  private readonly BAR_WIDTH = 80;
  private readonly BAR_HEIGHT = 8;
  private readonly MARGIN = 8;

  // ── Game Over overlay ──────────────────────────────────
  private _gameOverActive: boolean = false;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: { playerState: PlayerState }): void {
    this._playerState = data.playerState;
    this._gameOverActive = false;
  }

  create(): void {
    // ── Fundo semi-transparente ──────────────────────────
    this.add.rectangle(GAME_WIDTH / 2, 12, GAME_WIDTH, 24, 0x000000, 0.5).setDepth(1000);

    // ── Barra de HP ──────────────────────────────────────
    const hpX = this.MARGIN;
    const hpY = 8;

    this._hpBarBg = this.add.rectangle(hpX, hpY, this.BAR_WIDTH, this.BAR_HEIGHT, 0x440000)
      .setOrigin(0, 0).setDepth(1001);

    this._hpBar = this.add.rectangle(hpX, hpY, this.BAR_WIDTH, this.BAR_HEIGHT, 0xff2222)
      .setOrigin(0, 0).setDepth(1002);

    this.add.text(hpX + this.BAR_WIDTH + 4, hpY - 1, 'HP', {
      fontSize: '7px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0, 0).setDepth(1001);

    // ── Barra de Stamina ─────────────────────────────────
    const stY = hpY + this.BAR_HEIGHT + 2;

    this._staminaBarBg = this.add.rectangle(hpX, stY, this.BAR_WIDTH, this.BAR_HEIGHT - 2, 0x002244)
      .setOrigin(0, 0).setDepth(1001);

    this._staminaBar = this.add.rectangle(hpX, stY, this.BAR_WIDTH, this.BAR_HEIGHT - 2, 0x44aaff)
      .setOrigin(0, 0).setDepth(1002);

    this.add.text(hpX + this.BAR_WIDTH + 4, stY - 1, 'ST', {
      fontSize: '7px', color: '#4488ff', fontFamily: 'monospace',
    }).setOrigin(0, 0).setDepth(1001);

    // ── Vidas ────────────────────────────────────────────
    this._livesText = this.add.text(GAME_WIDTH - this.MARGIN, 6, `♥ ${this._playerState.lives}`, {
      fontSize: '9px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(1, 0).setDepth(1001);

    // ── Score ────────────────────────────────────────────
    this._scoreText = this.add.text(GAME_WIDTH - this.MARGIN, 16, `SCORE: ${this._playerState.score}`, {
      fontSize: '7px', color: '#ffff44', fontFamily: 'monospace',
    }).setOrigin(1, 0).setDepth(1001);

    // ── Combo ────────────────────────────────────────────
    this._comboText = this.add.text(GAME_WIDTH / 2, 40, '', {
      fontSize: '14px', color: '#ffaa00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(1001);

    // ── Escuta eventos ───────────────────────────────────
    this._bindEvents();

    // ── Remove listeners no shutdown ─────────────────────
    this.events.on('shutdown', this._unbindEvents, this);
  }

  // ═══════════════════════════════════════════════════════
  // EVENTOS (handlers nomeados)
  // ═══════════════════════════════════════════════════════

  private _onHPChanged = (hp: number, hpMax: number): void => {
    this._updateHPBar(hp, hpMax);
  };

  private _onStaminaChanged = (stamina: number, staminaMax: number): void => {
    this._updateStaminaBar(stamina, staminaMax);
  };

  private _onLivesChanged = (lives: number): void => {
    this._livesText.setText(`♥ ${lives}`);
  };

  private _onScoreChanged = (score: number): void => {
    this._scoreText.setText(`SCORE: ${score}`);
  };

  private _onPlayerDamaged = (): void => {
    this._flashDamage();
  };

  private _onGameOver = (): void => {
    if (!this._gameOverActive) {
      this._gameOverActive = true;
      this._showGameOver();
    }
  };

  private _onComboChanged = (count: number): void => {
    if (count > 1) {
      this._comboText.setText(`${count} HIT COMBO!`);
      this._comboText.setAlpha(1);
      this.tweens.add({
        targets: this._comboText,
        alpha: 0,
        duration: 2000,
        delay: 500,
      });
    } else {
      this._comboText.setText('');
    }
  };

  private _bindEvents(): void {
    const events = this.game.events;
    events.on(EVENTS.HP_CHANGED, this._onHPChanged, this);
    events.on(EVENTS.STAMINA_CHANGED, this._onStaminaChanged, this);
    events.on(EVENTS.LIVES_CHANGED, this._onLivesChanged, this);
    events.on(EVENTS.SCORE_CHANGED, this._onScoreChanged, this);
    events.on(EVENTS.PLAYER_DAMAGED, this._onPlayerDamaged, this);
    events.on(EVENTS.GAME_OVER, this._onGameOver, this);
    events.on(EVENTS.COMBO_CHANGED, this._onComboChanged, this);
  }

  private _unbindEvents(): void {
    const events = this.game.events;
    events.off(EVENTS.HP_CHANGED, this._onHPChanged, this);
    events.off(EVENTS.STAMINA_CHANGED, this._onStaminaChanged, this);
    events.off(EVENTS.LIVES_CHANGED, this._onLivesChanged, this);
    events.off(EVENTS.SCORE_CHANGED, this._onScoreChanged, this);
    events.off(EVENTS.PLAYER_DAMAGED, this._onPlayerDamaged, this);
    events.off(EVENTS.GAME_OVER, this._onGameOver, this);
    events.off(EVENTS.COMBO_CHANGED, this._onComboChanged, this);
  }

  // ═══════════════════════════════════════════════════════
  // ATUALIZAÇÃO DA HUD
  // ═══════════════════════════════════════════════════════

  private _updateHPBar(hp: number, hpMax: number): void {
    const ratio = hp / hpMax;
    this._hpBar.displayWidth = this.BAR_WIDTH * ratio;

    if (ratio > 0.5) {
      this._hpBar.setFillStyle(0xff2222);
    } else if (ratio > 0.25) {
      this._hpBar.setFillStyle(0xff8800);
    } else {
      this._hpBar.setFillStyle(0xff0000);
    }
  }

  private _updateStaminaBar(stamina: number, staminaMax: number): void {
    const ratio = stamina / staminaMax;
    this._staminaBar.displayWidth = this.BAR_WIDTH * ratio;
  }

  private _flashDamage(): void {
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.3)
      .setDepth(2000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  private _showGameOver(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(3000);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, 'GAME OVER', {
      fontSize: '20px', color: '#ff0000', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#440000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(3001);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, 'Pressione ENTER para reiniciar', {
      fontSize: '8px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(3001);

    // Input para reiniciar
    const onEnter = (): void => {
      this.input.keyboard?.off('keydown-ENTER', onEnter);
      this._unbindEvents();
      this.scene.stop('GameScene');
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    };
    this.input.keyboard?.on('keydown-ENTER', onEnter);
  }
}
