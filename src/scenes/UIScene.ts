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

  // ── Boss HUD ───────────────────────────────────────────
  private _bossHpBar!: Phaser.GameObjects.Rectangle;
  private _bossHpBarBg!: Phaser.GameObjects.Rectangle;
  private _bossHpMarker!: Phaser.GameObjects.Rectangle;
  private _bossNameText!: Phaser.GameObjects.Text;
  private _poiseBar!: Phaser.GameObjects.Rectangle;
  private _poiseBarBg!: Phaser.GameObjects.Rectangle;
  private _bossHudContainer!: Phaser.GameObjects.Container;

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

    // ── Boss HUD (inicialmente oculto) ───────────────────
    this._createBossHUD();

    // ── Escuta eventos ───────────────────────────────────
    this._bindEvents();

    // ── Remove listeners no shutdown ─────────────────────
    this.events.on('shutdown', this._unbindEvents, this);
  }

  /**
   * Cria a HUD do boss (inicialmente oculta).
   */
  private _createBossHUD(): void {
    const barWidth = 200;
    const barHeight = 10;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT - 30;

    // Container
    this._bossHudContainer = this.add.container(0, 0);
    this._bossHudContainer.setDepth(1000);
    this._bossHudContainer.setVisible(false);

    // Nome do boss
    this._bossNameText = this.add.text(GAME_WIDTH / 2, y - 20, 'O AÇOUGUEIRO', {
      fontSize: '12px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Fundo da barra
    this._bossHpBarBg = this.add.rectangle(x, y, barWidth, barHeight, 0x440000)
      .setOrigin(0, 0);

    // Barra de HP
    this._bossHpBar = this.add.rectangle(x, y, barWidth, barHeight, 0xff2222)
      .setOrigin(0, 0);

    // Marcador de 50%
    this._bossHpMarker = this.add.rectangle(x + barWidth / 2, y, 2, barHeight, 0xffff00)
      .setOrigin(0, 0);

    // Fundo da barra de poise
    const poiseY = y + barHeight + 2;
    this._poiseBarBg = this.add.rectangle(x, poiseY, barWidth, 4, 0x222244)
      .setOrigin(0, 0);

    // Barra de poise
    this._poiseBar = this.add.rectangle(x, poiseY, barWidth, 4, 0x4444ff)
      .setOrigin(0, 0);

    // Adiciona ao container
    this._bossHudContainer.add([
      this._bossNameText,
      this._bossHpBarBg,
      this._bossHpBar,
      this._bossHpMarker,
      this._poiseBarBg,
      this._poiseBar,
    ]);
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

  // ── Boss HUD handlers ──────────────────────────────────

  private _onBossArenaEnter = (): void => {
    this._bossHudContainer.setVisible(true);
    this._bossHudContainer.setAlpha(0);
    this.tweens.add({
      targets: this._bossHudContainer,
      alpha: 1,
      duration: 500,
    });
  };

  private _onBossHPChanged = (hp: number, hpMax: number): void => {
    const ratio = hp / hpMax;
    this._bossHpBar.displayWidth = 200 * ratio;
  };

  private _onBossPhaseChanged = (phase: number): void => {
    if (phase === 2) {
      this._bossHpMarker.setVisible(false);
      this._bossNameText.setText('O AÇOUGUEIRO - FASE 2');
      this._bossNameText.setColor('#ff0000');
    }
  };

  private _onBossPoiseChanged = (poise: number, poiseMax: number): void => {
    const ratio = poise / poiseMax;
    this._poiseBar.displayWidth = 200 * ratio;
  };

  private _onBossDied = (): void => {
    this.tweens.add({
      targets: this._bossHudContainer,
      alpha: 0,
      duration: 1000,
    });
  };

  private _onBossVictory = (): void => {
    // Mostra tela de vitória
    const victoryText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'VITÓRIA!', {
      fontSize: '32px',
      color: '#ffff00',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#884400',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2000);

    victoryText.setAlpha(0);
    this.tweens.add({
      targets: victoryText,
      alpha: 1,
      duration: 1000,
    });
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
    // Boss events
    events.on(EVENTS.BOSS_ARENA_ENTER, this._onBossArenaEnter, this);
    events.on(EVENTS.BOSS_HP_CHANGED, this._onBossHPChanged, this);
    events.on(EVENTS.BOSS_PHASE_CHANGED, this._onBossPhaseChanged, this);
    events.on(EVENTS.BOSS_POISE_CHANGED, this._onBossPoiseChanged, this);
    events.on(EVENTS.BOSS_DIED, this._onBossDied, this);
    events.on(EVENTS.BOSS_VICTORY, this._onBossVictory, this);
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
    // Boss events
    events.off(EVENTS.BOSS_ARENA_ENTER, this._onBossArenaEnter, this);
    events.off(EVENTS.BOSS_HP_CHANGED, this._onBossHPChanged, this);
    events.off(EVENTS.BOSS_PHASE_CHANGED, this._onBossPhaseChanged, this);
    events.off(EVENTS.BOSS_POISE_CHANGED, this._onBossPoiseChanged, this);
    events.off(EVENTS.BOSS_DIED, this._onBossDied, this);
    events.off(EVENTS.BOSS_VICTORY, this._onBossVictory, this);
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
