/**
 * GameScene.ts
 * ─────────────────────────────────────────────────────────
 * Cena principal do jogo. Responsável por:
 * - Criar o cenário (parallax em 2 camadas)
 * - Instanciar o jogador (Player)
 * - Configurar a câmera (follow horizontal, Y fixo)
 * - Definir os limites do mundo
 * - Lançar a UIScene em paralelo
 * - Gerenciar o loop de jogo (update)
 *
 * Comunicação com UIScene: somente via eventos (game.events)
 * e PlayerState. Nunca por referência direta.
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { PlayerState } from '../state/PlayerState';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WALK_ZONE_TOP,
  WALK_ZONE_BOTTOM,
  CAMERA_LERP,
  COLOR_SKY_TOP,
  COLOR_SKY_BOTTOM,
  COLOR_BG_FAR,
  COLOR_BG_NEAR,
  COLOR_GROUND,
} from '../config/constants';

export class GameScene extends Phaser.Scene {
  // ── Entidades ──────────────────────────────────────────
  private _player!: Player;
  private _playerState!: PlayerState;

  // ── Parallax (camadas de fundo) ────────────────────────
  private _bgFar!: Phaser.GameObjects.TileSprite;
  private _bgNear!: Phaser.GameObjects.TileSprite;
  private _ground!: Phaser.GameObjects.TileSprite;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // ── Inicializa o estado do jogador ───────────────────
    this._playerState = new PlayerState(this.game.events);

    // ── Define limites do mundo ──────────────────────────
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // ── Cria o cenário (parallax + chão) ─────────────────
    this._createBackground();

    // ── Cria o jogador ───────────────────────────────────
    const startX = 100;
    const startY = (WALK_ZONE_TOP + WALK_ZONE_BOTTOM) / 2;
    this._player = new Player(this, startX, startY, this._playerState);

    // ── Configura a câmera ───────────────────────────────
    this._setupCamera();

    // ── Marca indicadores visuais da zona de walk ────────
    this._createZoneIndicators();

    // ── Lança a UIScene em paralelo ──────────────────────
    // A UIScene roda sobre a GameScene, recebendo dados por eventos.
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene', { playerState: this._playerState });
    }

    // ── Postupdate: clamp + offset visual do pulo ────────
    // Após a física sincronizar sprite ↔ corpo:
    // 1. Restringe à faixa de walk (clamp)
    // 2. Salva a posição do chão (groundY)
    // 3. Aplica offset visual do pulo (sprite sobe pelo jumpHeight)
    this.events.on('postupdate', () => {
      this._player.postPhysicsUpdate();
    });

    // ── Comentários para futuro tilemap ──────────────────
    // Para adicionar um tilemap com obstáculos:
    // const map = this.add.tilemap({ key: 'level1' });
    // const tileset = map.addTilesetImage('tiles', 'tileset_img');
    // const walls = map.createLayer('walls', tileset);
    // walls.setCollisionByProperty({ collides: true });
    // this.physics.add.collider(this._player, walls);
  }

  // ═══════════════════════════════════════════════════════
  // CENÁRIO (parallax)
  // ═══════════════════════════════════════════════════════

  private _createBackground(): void {
    // ── Céu (gradiente estático) ─────────────────────────
    // Camada mais distante: não se move com a câmera
    const skyGfx = this.add.graphics();
    skyGfx.fillGradientStyle(COLOR_SKY_TOP, COLOR_SKY_TOP, COLOR_SKY_BOTTOM, COLOR_SKY_BOTTOM, 1);
    skyGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    skyGfx.setScrollFactor(0); // fixo na tela
    skyGfx.setDepth(-100);

    // ── Camada distante (prédios/ruínas silhueta) ────────
    // Gera uma textura procedural de silhueta
    this._createFarBgTexture();
    this._bgFar = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_far_tex');
    this._bgFar.setOrigin(0, 0);
    this._bgFar.setScrollFactor(0);
    this._bgFar.setDepth(-90);
    // Move lentamente (parallax 0.2x)
    this._bgFar.setTilePosition(0, 0);

    // ── Camada próxima (árvores/postes destruídos) ──────
    this._createNearBgTexture();
    this._bgNear = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_near_tex');
    this._bgNear.setOrigin(0, 0);
    this._bgNear.setScrollFactor(0);
    this._bgNear.setDepth(-80);

    // ── Chão (área de combate) ───────────────────────────
    this._createGroundTexture();
    this._ground = this.add.tileSprite(0, WALK_ZONE_TOP - 5, WORLD_WIDTH, WALK_ZONE_BOTTOM - WALK_ZONE_TOP + 20, 'ground_tex');
    this._ground.setOrigin(0, 0);
    this._ground.setDepth(-1);
  }

  /**
   * Gera textura procedural para o fundo distante.
   * Silhueta de prédios/ruínas em tons escuros.
   */
  private _createFarBgTexture(): void {
    const texW = 384;
    const texH = 224;
    const gfx = this.add.graphics();

    // Fundo escuro
    gfx.fillStyle(COLOR_BG_FAR, 1);
    gfx.fillRect(0, 0, texW, texH);

    // Silhueta de prédios/ruínas
    gfx.fillStyle(0x15102a, 1);
    for (let x = 0; x < texW; x += 30) {
      const h = Phaser.Math.Between(40, 100);
      const w = Phaser.Math.Between(15, 28);
      gfx.fillRect(x, texH - 80 - h, w, h + 80);
    }

    // Janelas iluminadas (pontinhos amarelos)
    gfx.fillStyle(0x664400, 0.5);
    for (let i = 0; i < 20; i++) {
      const wx = Phaser.Math.Between(10, texW - 10);
      const wy = Phaser.Math.Between(80, texH - 90);
      gfx.fillRect(wx, wy, 3, 3);
    }

    gfx.generateTexture('bg_far_tex', texW, texH);
    gfx.destroy();
  }

  /**
   * Gera textura procedural para o fundo próximo.
   * Silhueta de postes/árvores destruídas.
   */
  private _createNearBgTexture(): void {
    const texW = 384;
    const texH = 224;
    const gfx = this.add.graphics();

    // Transparente na maior parte
    gfx.fillStyle(COLOR_BG_NEAR, 0.3);
    gfx.fillRect(0, 0, texW, texH);

    // Postes/árvores destruídas
    gfx.fillStyle(0x2a1a1a, 0.8);
    for (let x = 0; x < texW; x += 50) {
      const h = Phaser.Math.Between(30, 70);
      const w = Phaser.Math.Between(3, 6);
      gfx.fillRect(x + Phaser.Math.Between(-5, 5), texH - 60 - h, w, h);
      // Galhos quebrados
      gfx.fillRect(x + w, texH - 60 - h + 10, Phaser.Math.Between(5, 15), 2);
    }

    gfx.generateTexture('bg_near_tex', texW, texH);
    gfx.destroy();
  }

  /**
   * Gera textura procedural para o chão (área de combate).
   */
  private _createGroundTexture(): void {
    const texW = 128;
    const texH = 90;
    const gfx = this.add.graphics();

    // Cor base do chão
    gfx.fillStyle(COLOR_GROUND, 1);
    gfx.fillRect(0, 0, texW, texH);

    // Textura de sujeira/sangue
    gfx.fillStyle(0x2a2a1a, 0.5);
    for (let i = 0; i < 15; i++) {
      const sx = Phaser.Math.Between(0, texW);
      const sy = Phaser.Math.Between(0, texH);
      gfx.fillRect(sx, sy, Phaser.Math.Between(2, 8), Phaser.Math.Between(1, 3));
    }

    // Manchas escuras
    gfx.fillStyle(0x1a1a0a, 0.3);
    for (let i = 0; i < 5; i++) {
      const sx = Phaser.Math.Between(0, texW);
      const sy = Phaser.Math.Between(0, texH);
      gfx.fillCircle(sx, sy, Phaser.Math.Between(3, 8));
    }

    gfx.generateTexture('ground_tex', texW, texH);
    gfx.destroy();
  }

  // ═══════════════════════════════════════════════════════
  // CÂMERA
  // ═══════════════════════════════════════════════════════

  private _setupCamera(): void {
    const cam = this.cameras.main;

    // Limites da câmera (mundo inteiro)
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Segue o jogador suavemente APENAS na horizontal.
    // O lerp Y = 0 significa que a câmera não segue no eixo vertical.
    // Como o mundo tem a mesma altura da câmera (224px),
    // não há espaço para a câmera se mover no Y de qualquer forma.
    cam.startFollow(this._player, true, CAMERA_LERP, 0);
  }

  // ═══════════════════════════════════════════════════════
  // INDICADORES VISUAIS (debug da zona de walk)
  // ═══════════════════════════════════════════════════════

  private _createZoneIndicators(): void {
    // Linha sutil no topo da zona de walk
    const topLine = this.add.rectangle(
      WORLD_WIDTH / 2, WALK_ZONE_TOP,
      WORLD_WIDTH, 1,
      0x444444, 0.3
    );
    topLine.setDepth(-0.5);

    // Linha sutil na base da zona de walk
    const bottomLine = this.add.rectangle(
      WORLD_WIDTH / 2, WALK_ZONE_BOTTOM,
      WORLD_WIDTH, 1,
      0x444444, 0.3
    );
    bottomLine.setDepth(-0.5);
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════

  update(time: number, delta: number): void {
    // Atualiza o jogador (inclui clamp e salvamento do groundY)
    this._player.update(time, delta);

    // ── Parallax: move as camadas conforme a câmera ──────
    const camScrollX = this.cameras.main.scrollX;
    this._bgFar.setTilePosition(camScrollX * 0.2, 0);
    this._bgNear.setTilePosition(camScrollX * 0.5, 0);
  }

  // ═══════════════════════════════════════════════════════
  // GETTERS (para outras cenas, se necessário)
  // ═══════════════════════════════════════════════════════

  get playerState(): PlayerState { return this._playerState; }
  get player(): Player { return this._player; }
}
