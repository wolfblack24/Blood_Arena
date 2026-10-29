/**
 * GameScene.ts
 * ─────────────────────────────────────────────────────────
 * Cena principal do jogo. Responsável por:
 * - Criar o cenário (parallax em 2 camadas)
 * - Instanciar o jogador (Player) e inimigos (Enemy)
 * - Configurar a câmera (follow horizontal, Y fixo)
 * - Definir os limites do mundo
 * - Lançar a UIScene em paralelo
 * - Gerenciar combate (hitstop, screen shake, detecção de dano)
 * - Debug (F1 para hitboxes, teclas para toggles)
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Fighter, FighterState } from '../entities/Fighter';
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
  HITSTOP_FRAMES,
  SCREEN_SHAKE_INTENSITY,
  SCREEN_SHAKE_DURATION,
  LANE_TOLERANCE,
  ENEMY_RESPAWN_DELAY,
  EVENTS,
} from '../config/constants';

export class GameScene extends Phaser.Scene {
  // ── Entidades ──────────────────────────────────────────
  private _player!: Player;
  private _playerState!: PlayerState;
  private _enemies: Enemy[] = [];
  private _enemyGroup!: Phaser.Physics.Arcade.Group;

  // ── Parallax ───────────────────────────────────────────
  private _bgFar!: Phaser.GameObjects.TileSprite;
  private _bgNear!: Phaser.GameObjects.TileSprite;

  // ── Partículas de morte ────────────────────────────────
  private _deathParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  // ── Hitstop ────────────────────────────────────────────
  private _hitstopFrames: number = 0;

  // ── Debug ──────────────────────────────────────────────
  private _debugMode: boolean = false;
  private _debugGraphics!: Phaser.GameObjects.Graphics;
  private _debugHitboxes: Phaser.GameObjects.Rectangle[] = [];

  // ── Combo ──────────────────────────────────────────────
  private _comboCount: number = 0;
  private _comboTimer: number = 0;

  // ── Teclas de debug ────────────────────────────────────
  private _f1Key!: Phaser.Input.Keyboard.Key;
  private _gKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // ── Inicializa o estado do jogador ───────────────────
    this._playerState = new PlayerState(this.game.events);

    // ── Define limites do mundo ──────────────────────────
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // ── Cria o cenário ───────────────────────────────────
    this._createBackground();

    // ── Cria o jogador ───────────────────────────────────
    const startX = 100;
    const startY = (WALK_ZONE_TOP + WALK_ZONE_BOTTOM) / 2;
    this._player = new Player(this, startX, startY, this._playerState);

    // ── Cria inimigos (Object Pool) ──────────────────────
    this._enemyGroup = this.physics.add.group({
      classType: Enemy,
      runChildUpdate: true,
      maxSize: 10,
    });
    this._spawnEnemies();

    // ── Sistema de partículas de morte ───────────────────
    this._createDeathParticles();

    // ── Configura overlaps de combate ────────────────────
    this._setupCombatOverlaps();

    // ── Configura a câmera ───────────────────────────────
    this._setupCamera();

    // ── Indicadores visuais ──────────────────────────────
    this._createZoneIndicators();

    // ── Debug graphics ───────────────────────────────────
    this._debugGraphics = this.add.graphics();
    this._debugGraphics.setDepth(9999);

    // ── Lança a UIScene ──────────────────────────────────
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene', { playerState: this._playerState });
    }

    // ── Teclas de debug ──────────────────────────────────
    if (this.input.keyboard) {
      this._f1Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
      this._gKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    }

    // ── Eventos ──────────────────────────────────────────
    this.game.events.on(EVENTS.ENEMY_DIED, this._onEnemyDied, this);
    this.events.on('postupdate', this._onPostUpdate, this);
    this.events.on('shutdown', this._onShutdown, this);
  }

  // ═══════════════════════════════════════════════════════
  // INIMIGOS
  // ═══════════════════════════════════════════════════════

  private _spawnEnemies(): void {
    const positions = [
      { x: 300, y: 160 },
      { x: 500, y: 180 },
      { x: 700, y: 150 },
    ];

    for (const pos of positions) {
      this._spawnEnemyAt(pos.x, pos.y);
    }
  }

  /**
   * Spawna um inimigo na posição especificada usando Object Pooling.
   */
  private _spawnEnemyAt(x: number, y: number): void {
    // Tenta obter um inimigo do pool
    let enemy = this._enemyGroup.get(x, y) as Enemy;

    if (enemy) {
      // Se o inimigo já existe no pool, reseta ele
      if (enemy.resetEnemy) {
        enemy.resetEnemy(x, y);
      }
      // Define o jogador para a IA
      enemy.setPlayer(this._player);
      
      // Adiciona ao array se não estiver lá
      if (!this._enemies.includes(enemy)) {
        this._enemies.push(enemy);
      }
    } else {
      // Se o pool está cheio, cria um novo inimigo
      enemy = new Enemy(this, x, y, this._playerState);
      enemy.setPlayer(this._player);
      this._enemyGroup.add(enemy);
      this._enemies.push(enemy);
    }
  }

  // ═══════════════════════════════════════════════════════
  // COMBATE
  // ═══════════════════════════════════════════════════════

  private _setupCombatOverlaps(): void {
    // Hitbox do jogador vs inimigos
    this.physics.add.overlap(
      this._player.getHitboxZone(),
      this._enemyGroup,
      this._onPlayerHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Hitbox dos inimigos vs jogador
    for (const enemy of this._enemies) {
      this.physics.add.overlap(
        enemy.getHitboxZone(),
        this._player,
        this._onEnemyHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this
      );
    }
  }

  private _onPlayerHitEnemy(playerHitbox: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile): void {
    const enemy = enemyObj as Enemy;
    const attack = this._player.getCurrentAttack();
    if (!attack) return;

    // Valida se pode atingir
    if (!this._player.canHitTarget(enemy)) return;

    // Registra hit
    this._player.registerHit(enemy);

    // Calcula knockback
    const knockbackDir = this._player.facingRight ? 1 : -1;
    const knockbackX = knockbackDir * attack.knockback;

    // Aplica dano
    const died = enemy.takeEnemyDamage(attack.damage, knockbackX, attack.knockdown);

    // Hitstop
    this._hitstopFrames = attack.hitstop;

    // Screen shake
    this.cameras.main.shake(SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY / 1000);

    // Flash de impacto
    this._flashImpact(enemy.x, enemy.y - 16);

    // Combo
    this._comboCount++;
    this._comboTimer = this.time.now + 2000;
    this.game.events.emit(EVENTS.COMBO_CHANGED, this._comboCount);

    // Som (placeholder)
    this._playSfx('hit');
  }

  private _onEnemyHitPlayer(enemyHitbox: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile): void {
    const enemy = enemyHitbox as Enemy;
    const attack = enemy.getCurrentAttack();
    if (!attack) return;

    // Valida se pode atingir
    if (this._player.isInvulnerable()) return;
    if (this._player.fighterState === FighterState.Dead || this._player.fighterState === FighterState.Knockdown) return;

    // Valida profundidade
    const laneDiff = Math.abs(this._player.y - enemy.y);
    const zDiff = Math.abs(this._player.jumpHeight - enemy.jumpHeight);
    if (laneDiff > LANE_TOLERANCE || zDiff > attack.zTolerance) return;

    // Calcula knockback
    const knockbackDir = enemy.facingRight ? 1 : -1;
    const knockbackX = knockbackDir * attack.knockback;

    // Aplica dano ao jogador
    this._player.takePlayerDamage(attack.damage, knockbackX, attack.knockdown);

    // Hitstop
    this._hitstopFrames = attack.hitstop;

    // Screen shake
    this.cameras.main.shake(SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY / 1000);

    // Flash
    this._flashImpact(this._player.x, this._player.y - 16);

    // Som
    this._playSfx('hurt');
  }

  private _flashImpact(x: number, y: number): void {
    // Cria uma faísca simples (retângulo branco)
    const spark = this.add.rectangle(x, y, 8, 8, 0xffffff);
    spark.setDepth(999);

    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 2,
      duration: 100,
      onComplete: () => spark.destroy(),
    });
  }

  private _playSfx(_name: string): void {
    // Placeholder para sons
    // Quando houver assets de áudio:
    // this.sound.play(name);
  }

  private _onEnemyDied(_enemy: Enemy, x: number, y: number): void {
    // Emite partículas de morte
    if (this._deathParticles) {
      this._deathParticles.setPosition(x, y);
      this._deathParticles.explode(10);
    }

    // Reseta combo se não houver mais inimigos vivos
    const aliveEnemies = this._enemies.filter(e => e.isActive && e.fighterState !== FighterState.Dead);
    if (aliveEnemies.length === 0) {
      this._comboCount = 0;
      this.game.events.emit(EVENTS.COMBO_CHANGED, 0);
    }

    // Ciclo de respawn (demonstra Object Pooling)
    this.time.delayedCall(ENEMY_RESPAWN_DELAY, () => {
      // Spawna em posição aleatória dentro da zona de walk
      const randomX = Phaser.Math.Between(200, WORLD_WIDTH - 200);
      const randomY = Phaser.Math.Between(WALK_ZONE_TOP + 10, WALK_ZONE_BOTTOM - 10);
      this._spawnEnemyAt(randomX, randomY);
    });
  }

  /**
   * Cria o sistema de partículas de morte.
   */
  private _createDeathParticles(): void {
    // Cria a textura da partícula (um pequeno quadrado vermelho)
    const particleGfx = this.add.graphics();
    particleGfx.fillStyle(0xff2222, 1);
    particleGfx.fillRect(0, 0, 4, 4);
    particleGfx.generateTexture('death_particle', 4, 4);
    particleGfx.destroy();

    // Cria o emitter de partículas
    this._deathParticles = this.add.particles(0, 0, 'death_particle', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      gravityY: 300,
      emitting: false,
    });
    this._deathParticles.setDepth(1000);
  }

  // ═══════════════════════════════════════════════════════
  // CENÁRIO
  // ═══════════════════════════════════════════════════════

  private _createBackground(): void {
    // Céu
    const skyGfx = this.add.graphics();
    skyGfx.fillGradientStyle(COLOR_SKY_TOP, COLOR_SKY_TOP, COLOR_SKY_BOTTOM, COLOR_SKY_BOTTOM, 1);
    skyGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    skyGfx.setScrollFactor(0);
    skyGfx.setDepth(-100);

    // Camada distante
    this._bgFar = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_far_tex');
    this._bgFar.setOrigin(0, 0);
    this._bgFar.setScrollFactor(0);
    this._bgFar.setDepth(-90);

    // Camada próxima
    this._bgNear = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_near_tex');
    this._bgNear.setOrigin(0, 0);
    this._bgNear.setScrollFactor(0);
    this._bgNear.setDepth(-80);

    // Chão
    const ground = this.add.tileSprite(0, WALK_ZONE_TOP - 5, WORLD_WIDTH, WALK_ZONE_BOTTOM - WALK_ZONE_TOP + 20, 'ground_tex');
    ground.setOrigin(0, 0);
    ground.setDepth(-1);
  }

  // ═══════════════════════════════════════════════════════
  // CÂMERA
  // ═══════════════════════════════════════════════════════

  private _setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    cam.startFollow(this._player, true, CAMERA_LERP, 0);
  }

  private _createZoneIndicators(): void {
    const topLine = this.add.rectangle(WORLD_WIDTH / 2, WALK_ZONE_TOP, WORLD_WIDTH, 1, 0x444444, 0.3);
    topLine.setDepth(-0.5);

    const bottomLine = this.add.rectangle(WORLD_WIDTH / 2, WALK_ZONE_BOTTOM, WORLD_WIDTH, 1, 0x444444, 0.3);
    bottomLine.setDepth(-0.5);
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════

  update(time: number, delta: number): void {
    // Hitstop: congela a simulação
    if (this._hitstopFrames > 0) {
      this._hitstopFrames--;
      return;
    }

    // Atualiza entidades
    this._player.update(time, delta);
    for (const enemy of this._enemies) {
      if (enemy.isActive) {
        enemy.update(time, delta);
      }
    }

    // Combo timer
    if (this.time.now > this._comboTimer && this._comboCount > 0) {
      this._comboCount = 0;
      this.game.events.emit(EVENTS.COMBO_CHANGED, 0);
    }

    // Parallax
    const camScrollX = this.cameras.main.scrollX;
    this._bgFar.setTilePosition(camScrollX * 0.2, 0);
    this._bgNear.setTilePosition(camScrollX * 0.5, 0);

    // Debug
    this._handleDebugInput();
    if (this._debugMode) {
      this._drawDebug();
    } else {
      this._debugGraphics.clear();
    }
  }

  // ═══════════════════════════════════════════════════════
  // DEBUG
  // ═══════════════════════════════════════════════════════

  private _handleDebugInput(): void {
    if (!this.input.keyboard) return;

    // F1: toggle debug
    if (Phaser.Input.Keyboard.JustDown(this._f1Key)) {
      this._debugMode = !this._debugMode;
    }

    // G: spawna um novo inimigo em posição aleatória (para testar pooling)
    if (Phaser.Input.Keyboard.JustDown(this._gKey)) {
      const randomX = Phaser.Math.Between(200, WORLD_WIDTH - 200);
      const randomY = Phaser.Math.Between(WALK_ZONE_TOP + 10, WALK_ZONE_BOTTOM - 10);
      this._spawnEnemyAt(randomX, randomY);
    }
  }

  private _drawDebug(): void {
    this._debugGraphics.clear();

    // Hitbox do jogador
    const playerHitbox = this._player.getHitboxZone();
    const playerBody = playerHitbox.body as Phaser.Physics.Arcade.Body;
    if (playerBody.enable) {
      this._debugGraphics.lineStyle(1, 0x00ff00, 1);
      this._debugGraphics.strokeRect(
        playerHitbox.x - playerBody.width / 2,
        playerHitbox.y - playerBody.height / 2,
        playerBody.width,
        playerBody.height
      );
    }

    // Hurtbox do jogador
    const playerPhysBody = this._player.body as Phaser.Physics.Arcade.Body;
    this._debugGraphics.lineStyle(1, 0x0088ff, 1);
    this._debugGraphics.strokeRect(
      this._player.x + playerPhysBody.offset.x,
      this._player.y + playerPhysBody.offset.y,
      playerPhysBody.width,
      playerPhysBody.height
    );

    // Hitboxes e hurtboxes dos inimigos
    for (const enemy of this._enemies) {
      if (!enemy.isActive || enemy.fighterState === FighterState.Dead) continue;

      // Hitbox
      const enemyHitbox = enemy.getHitboxZone();
      const enemyHitboxBody = enemyHitbox.body as Phaser.Physics.Arcade.Body;
      if (enemyHitboxBody.enable) {
        this._debugGraphics.lineStyle(1, 0xff0000, 1);
        this._debugGraphics.strokeRect(
          enemyHitbox.x - enemyHitboxBody.width / 2,
          enemyHitbox.y - enemyHitboxBody.height / 2,
          enemyHitboxBody.width,
          enemyHitboxBody.height
        );
      }

      // Hurtbox
      const enemyPhysBody = enemy.body as Phaser.Physics.Arcade.Body;
      this._debugGraphics.lineStyle(1, 0xff8800, 1);
      this._debugGraphics.strokeRect(
        enemy.x + enemyPhysBody.offset.x,
        enemy.y + enemyPhysBody.offset.y,
        enemyPhysBody.width,
        enemyPhysBody.height
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  // POSTUPDATE (via evento)
  // ═══════════════════════════════════════════════════════

  private _onPostUpdate = (): void => {
    this._player.postPhysicsUpdate();
    for (const enemy of this._enemies) {
      if (enemy.isActive) {
        enemy.postPhysicsUpdate();
      }
    }
  };

  // ═══════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════

  private _onShutdown = (): void => {
    // Remove listeners
    this.game.events.off(EVENTS.ENEMY_DIED, this._onEnemyDied, this);
    this.events.off('postupdate', this._onPostUpdate, this);

    // Limpa entidades
    this._player?.cleanup();
    for (const enemy of this._enemies) {
      enemy?.cleanup();
    }
  };

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get playerState(): PlayerState { return this._playerState; }
  get player(): Player { return this._player; }
}
