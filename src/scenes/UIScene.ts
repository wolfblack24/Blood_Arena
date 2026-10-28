/**
 * UIScene.ts
 * ─────────────────────────────────────────────────────────
 * Cena de interface (HUD). Roda em paralelo à GameScene
 * (via scene.launch), fixa na tela (scrollFactor 0).
 *
 * Exibe:
 * - Barra de HP
 * - Barra de Stamina
 * - Vidas restantes
 * - Pontuação
 *
 * Comunicação: escuta eventos do game.events (emitidos pelo
 * PlayerState). NUNCA acessa a GameScene ou Player diretamente.
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

  // ── Referência ao estado (recebida via init data) ──────
  private _playerState!: PlayerState;

  // ── Dimensões das barras ───────────────────────────────
  private readonly BAR_WIDTH = 80;
  private readonly BAR_HEIGHT = 8;
  private readonly MARGIN = 8;

  constructor() {
    super({ key: 'UIScene' });
  }

  /**
   * Recebe o PlayerState via dados da cena.
   * Isso é passado quando a GameScene faz scene.launch('UIScene', { playerState }).
   */
  init(data: { playerState: PlayerState }): void {
    this._playerState = data.playerState;
  }

  create(): void {
    // ── Fundo semi-transparente no topo (para legibilidade) ─
    this.add.rectangle(
      GAME_WIDTH / 2, 12,
      GAME_WIDTH, 24,
      0x000000, 0.5
    ).setDepth(1000);

    // ── Barra de HP ──────────────────────────────────────
    const hpX = this.MARGIN;
    const hpY = 8;

    // Fundo da barra (vermelho escuro)
    this._hpBarBg = this.add.rectangle(
      hpX, hpY,
      this.BAR_WIDTH, this.BAR_HEIGHT,
      0x440000
    ).setOrigin(0, 0).setDepth(1001);

    // Preenchimento da barra (vermelho)
    this._hpBar = this.add.rectangle(
      hpX, hpY,
      this.BAR_WIDTH, this.BAR_HEIGHT,
      0xff2222
    ).setOrigin(0, 0).setDepth(1002);

    // Label "HP"
    this.add.text(hpX + this.BAR_WIDTH + 4, hpY - 1, 'HP', {
      fontSize: '7px',
      color: '#ff4444',
      fontFamily: 'monospace',
    }).setOrigin(0, 0).setDepth(1001);

    // ── Barra de Stamina ─────────────────────────────────
    const stY = hpY + this.BAR_HEIGHT + 2;

    // Fundo da barra (azul escuro)
    this._staminaBarBg = this.add.rectangle(
      hpX, stY,
      this.BAR_WIDTH, this.BAR_HEIGHT - 2,
      0x002244
    ).setOrigin(0, 0).setDepth(1001);

    // Preenchimento da barra (azul/ciano)
    this._staminaBar = this.add.rectangle(
      hpX, stY,
      this.BAR_WIDTH, this.BAR_HEIGHT - 2,
      0x44aaff
    ).setOrigin(0, 0).setDepth(1002);

    // Label "ST"
    this.add.text(hpX + this.BAR_WIDTH + 4, stY - 1, 'ST', {
      fontSize: '7px',
      color: '#4488ff',
      fontFamily: 'monospace',
    }).setOrigin(0, 0).setDepth(1001);

    // ── Vidas ────────────────────────────────────────────
    this._livesText = this.add.text(
      GAME_WIDTH - this.MARGIN, 6,
      `♥ ${this._playerState.lives}`,
      {
        fontSize: '9px',
        color: '#ff4444',
        fontFamily: 'monospace',
      }
    ).setOrigin(1, 0).setDepth(1001);

    // ── Score ────────────────────────────────────────────
    this._scoreText = this.add.text(
      GAME_WIDTH - this.MARGIN, 16,
      `SCORE: ${this._playerState.score}`,
      {
        fontSize: '7px',
        color: '#ffff44',
        fontFamily: 'monospace',
      }
    ).setOrigin(1, 0).setDepth(1001);

    // ── Escuta eventos do PlayerState ────────────────────
    this._bindEvents();
  }

  // ═══════════════════════════════════════════════════════
  // EVENTOS (comunicação via game.events)
  // ═══════════════════════════════════════════════════════

  private _bindEvents(): void {
    const events = this.game.events;

    // HP mudou → atualiza barra
    events.on(EVENTS.HP_CHANGED, (hp: number, hpMax: number) => {
      this._updateHPBar(hp, hpMax);
    });

    // Stamina mudou → atualiza barra
    events.on(EVENTS.STAMINA_CHANGED, (stamina: number, staminaMax: number) => {
      this._updateStaminaBar(stamina, staminaMax);
    });

    // Vidas mudou → atualiza texto
    events.on(EVENTS.LIVES_CHANGED, (lives: number) => {
      this._livesText.setText(`♥ ${lives}`);
    });

    // Score mudou → atualiza texto
    events.on(EVENTS.SCORE_CHANGED, (score: number) => {
      this._scoreText.setText(`SCORE: ${score}`);
    });

    // Dano recebido → efeito visual (flash vermelho)
    events.on(EVENTS.PLAYER_DAMAGED, () => {
      this._flashDamage();
    });

    // Game Over
    events.on(EVENTS.GAME_OVER, () => {
      this._showGameOver();
    });
  }

  // ═══════════════════════════════════════════════════════
  // ATUALIZAÇÃO DA HUD
  // ═══════════════════════════════════════════════════════

  private _updateHPBar(hp: number, hpMax: number): void {
    const ratio = hp / hpMax;
    this._hpBar.displayWidth = this.BAR_WIDTH * ratio;

    // Muda de cor conforme HP diminui
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

  /**
   * Flash vermelho na tela quando o jogador toma dano.
   */
  private _flashDamage(): void {
    const flash = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0xff0000, 0.3
    ).setDepth(2000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Exibe tela de Game Over.
   */
  private _showGameOver(): void {
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setDepth(3000);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, 'GAME OVER', {
      fontSize: '20px',
      color: '#ff0000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#440000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(3001);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, 'Pressione ENTER para reiniciar', {
      fontSize: '8px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(3001);

    // Input para reiniciar
    this.input.keyboard?.once('keydown-ENTER', () => {
      this.game.events.off(EVENTS.HP_CHANGED);
      this.game.events.off(EVENTS.STAMINA_CHANGED);
      this.game.events.off(EVENTS.LIVES_CHANGED);
      this.game.events.off(EVENTS.SCORE_CHANGED);
      this.game.events.off(EVENTS.PLAYER_DAMAGED);
      this.game.events.off(EVENTS.GAME_OVER);

      this.scene.stop('GameScene');
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
  }
}
