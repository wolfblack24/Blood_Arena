/**
 * GameScene.ts
 * ─────────────────────────────────────────────────────────
 * Cena principal do jogo. Responsável por:
 * - Criar o cenário (parallax em 2 camadas)
 * - Instanciar o jogador (Player) e inimigos (Enemy)
 * - Sistema de ondas finitas
 * - Integração com boss (trigger, arena, transição)
 * - Configurar a câmera (follow horizontal, Y fixo)
 * - Definir os limites do mundo
 * - Lançar a UIScene em paralelo
 * - Gerenciar combate (hitstop, screen shake, detecção de dano)
 * - Debug (F1 para hitboxes, teclas para toggles)
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss, BossState, BossHurtbox } from '../entities/Boss';
import { FallingHazard } from '../entities/FallingHazard';
import { BossProjectile } from '../entities/BossProjectile';
import { FighterState } from '../entities/Fighter';
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
import {
  BOSS_HP,
  BOSS_NAME,
  BOSS_ARENA_X,
  BOSS_ARENA_WIDTH,
  FALLING_HAZARD_INTERVAL,
  FALLING_HAZARD_POOL_SIZE,
  BOSS_MINION_INTERVAL,
  BOSS_MINION_COUNT,
  BOSS_MINION_MAX,
  BOSS_DEATH_SLOWMO_DURATION,
  BOSS_DEATH_EXPLOSION_PARTICLES,
  BOSS_PROJECTILE_POOL_SIZE,
  BOSS_ATTACKS,
  BOSS_LANE_TOLERANCE,
} from '../config/boss';
import { STAGE_WAVES, ENDLESS_RESPAWN, GO_ARROW_ADVANCE_DISTANCE } from '../config/stage';
import { setStageBounds, setArenaBounds, lockToCurrentScreen, unlockBounds, isArenaMode } from '../systems/LevelBounds';
import { debugLog } from '../systems/debugLog';

export class GameScene extends Phaser.Scene {
  // ── Entidades ──────────────────────────────────────────
  private _player!: Player;
  private _playerState!: PlayerState;
  private _enemies: Enemy[] = [];
  private _enemyGroup!: Phaser.Physics.Arcade.Group;
  private _boss?: Boss;
  private _hazards: FallingHazard[] = [];
  private _projectiles: BossProjectile[] = [];

  // ── Parallax ───────────────────────────────────────────
  private _bgFar!: Phaser.GameObjects.TileSprite;
  private _bgNear!: Phaser.GameObjects.TileSprite;
  private _bgBossFar?: Phaser.GameObjects.TileSprite;
  private _bgBossNear?: Phaser.GameObjects.TileSprite;
  private _groundBoss?: Phaser.GameObjects.TileSprite;
  private _groundNormal?: Phaser.GameObjects.TileSprite;

  // ── Partículas de morte ────────────────────────────────
  private _deathParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  // ── Hitstop ────────────────────────────────────────────
  private _hitstopFrames: number = 0;

  // ── Debug ──────────────────────────────────────────────
  private _debugMode: boolean = false;
  private _debugGraphics!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private debugTimer: number = 0;

  // ── Combo ──────────────────────────────────────────────
  private _comboCount: number = 0;
  private _comboTimer: number = 0;

  // ── Sistema de Ondas ───────────────────────────────────
  private _currentWaveIndex: number = -1;
  private _waveEnemiesRemaining: number = 0;
  private _waveTriggered: boolean[] = [];
  private _goArrowActive: boolean = false;
  private _goArrowStartX: number = 0;
  private _lastWaveCleared: boolean = false;

  // ── Boss ───────────────────────────────────────────────
  private _bossTriggered: boolean = false;
  private _bossArenaActive: boolean = false;
  private _playerInputBlocked: boolean = false;
  private _hazardTimer?: Phaser.Time.TimerEvent;
  private _minionTimer?: Phaser.Time.TimerEvent;

  // ── Teclas de debug ────────────────────────────────────
  private _f1Key!: Phaser.Input.Keyboard.Key;
  private _f2Key!: Phaser.Input.Keyboard.Key;
  private _f3Key!: Phaser.Input.Keyboard.Key;
  private _f4Key!: Phaser.Input.Keyboard.Key;
  private _f5Key!: Phaser.Input.Keyboard.Key;
  private _f6Key!: Phaser.Input.Keyboard.Key;
  private _f9Key!: Phaser.Input.Keyboard.Key;
  private _f10Key!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // ── RESET DE ESTADO (para quando a cena é reutilizada) ─
    this._bossTriggered = false;
    this._bossArenaActive = false;
    this._boss = undefined;
    this._playerInputBlocked = false;
    this._goArrowActive = false;
    this._lastWaveCleared = false;
    this._enemies = [];
    this._hazards = [];
    this._projectiles = [];
    
    // Restaura timeScale
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;

    // ── Inicializa o estado do jogador ───────────────────
    this._playerState = new PlayerState(this.game.events);

    // ── Define limites do mundo ──────────────────────────
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    setStageBounds();

    // ── Cria o cenário ───────────────────────────────────
    this._createBackground();

    // ── Cria o jogador ───────────────────────────────────
    const startX = 100;
    const startY = (WALK_ZONE_TOP + WALK_ZONE_BOTTOM) / 2;
    this._player = new Player(this, startX, startY, this._playerState);

    // Cria texto de debug fixo na tela (ScrollFactor 0 = não mexe com a câmera)
    this.debugText = this.add.text(10, 10, 'DEBUG: Pronto', {
        fontSize: '14px',
        color: '#00ff00',
        backgroundColor: '#000000',
        padding: { x: 4, y: 4 }
    }).setScrollFactor(0).setDepth(9999);

    // ── Cria inimigos (Object Pool) ──────────────────────
    this._enemyGroup = this.physics.add.group({
      classType: Enemy,
      runChildUpdate: false,
      maxSize: 10,
    });

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
      this._f2Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
      this._f3Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
      this._f4Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F4);
      this._f5Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
      this._f6Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F6);
      this._f9Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
      this._f10Key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F10);
    }

    // ── Inicializa sistema de ondas ──────────────────────
    this._initWaveSystem();

    // ── Eventos ──────────────────────────────────────────
    this.game.events.on(EVENTS.ENEMY_DIED, this._onEnemyDied, this);
    this.game.events.on(EVENTS.BOSS_PHASE_TRANSITION, this._onBossPhaseTransition, this);
    this.game.events.on(EVENTS.BOSS_TRANSITION_COMPLETE, this._onBossTransitionComplete, this);
    this.game.events.on(EVENTS.BOSS_DIED, this._onBossDied, this);
    this.game.events.on(EVENTS.HAZARD_IMPACT, this._onHazardImpact, this);
    this.game.events.on(EVENTS.BOSS_PROJECTILE, this._onBossProjectile, this);
    this.game.events.on(EVENTS.BOSS_AOE, this._onBossAoE, this);
    this.events.on('postupdate', this._onPostUpdate, this);
    // Usa 'once' para evitar acúmulo de listeners
    this.events.once('shutdown', this._onShutdown, this);
  }

  // ═══════════════════════════════════════════════════════
  // SISTEMA DE ONDAS
  // ═══════════════════════════════════════════════════════

  private _initWaveSystem(): void {
    this._currentWaveIndex = -1;
    this._waveEnemiesRemaining = 0;
    this._waveTriggered = new Array(STAGE_WAVES.length).fill(false);
    this._goArrowActive = false;
  }

  private _checkWaveTriggers(): void {
    if (this._bossArenaActive || this._bossTriggered) return;
    if (this._goArrowActive) return; // Aguardando jogador avançar

    const playerX = this._player.x;

    for (let i = 0; i < STAGE_WAVES.length; i++) {
      if (this._waveTriggered[i]) continue;

      const wave = STAGE_WAVES[i];
      if (playerX >= wave.triggerX) {
        this._startWave(i);
        break;
      }
    }
  }

  private _startWave(waveIndex: number): void {
    const wave = STAGE_WAVES[waveIndex];
    this._currentWaveIndex = waveIndex;
    this._waveTriggered[waveIndex] = true;
    this._waveEnemiesRemaining = wave.enemies;

    // Trava câmera e limites
    if (wave.lockCamera) {
      lockToCurrentScreen(this._player.x);
      this.cameras.main.stopFollow();
    }

    // Spawna inimigos pelas bordas
    this._spawnWaveEnemies(wave.enemies);

    // Emite evento
    this.game.events.emit(EVENTS.WAVE_STARTED, waveIndex);
    this.game.events.emit(EVENTS.WAVE_ENEMIES_LEFT, this._waveEnemiesRemaining);
  }

  private _spawnWaveEnemies(count: number): void {
    const minX = this._player.x - GAME_WIDTH / 2 + 50;
    const maxX = this._player.x + GAME_WIDTH / 2 - 50;

    for (let i = 0; i < count; i++) {
      // Alterna entre borda esquerda e direita
      const fromLeft = i % 2 === 0;
      const spawnX = fromLeft ? minX : maxX;
      const spawnY = Phaser.Math.Between(WALK_ZONE_TOP + 10, WALK_ZONE_BOTTOM - 10);

      this._spawnEnemyAt(spawnX, spawnY);
    }
  }

  private _onWaveCleared(): void {
    // Destrava câmera e limites
    unlockBounds();
    this.cameras.main.startFollow(this._player, true, CAMERA_LERP, 0);

    // Ativa seta GO
    this._goArrowActive = true;
    this._goArrowStartX = this._player.x;
    this._lastWaveCleared = true;
    this.game.events.emit(EVENTS.GO_ARROW, true);
    this.game.events.emit(EVENTS.WAVE_CLEARED, this._currentWaveIndex);
  }

  private _checkGoArrowAdvance(): void {
    if (!this._goArrowActive) return;

    const advance = this._player.x - this._goArrowStartX;
    if (advance >= GO_ARROW_ADVANCE_DISTANCE) {
      this._goArrowActive = false;
      this.game.events.emit(EVENTS.GO_ARROW, false);

      // Verifica se deve ativar o boss
      this._checkBossTrigger();
    }
  }

  private _checkBossTrigger(): void {
    if (this._bossTriggered) return;

    // Verifica se a última onda foi concluída
    if (!this._lastWaveCleared) return;

    // Verifica se não há inimigos vivos
    const aliveEnemies = this._enemies.filter(e => e.isActive && e.fighterState !== FighterState.Dead);
    if (aliveEnemies.length > 0) return;

    // Verifica se o jogador está no gatilho do boss
    const bossTriggerX = BOSS_ARENA_X - 16;
    if (this._player.x >= bossTriggerX) {
      this._triggerBossArena();
    }
  }

  // ═══════════════════════════════════════════════════════
  // BOSS
  // ═══════════════════════════════════════════════════════

  private _triggerBossArena(): void {
    this._bossTriggered = true;
    this._playerInputBlocked = true;

    // Bloqueia input do jogador
    const body = this._player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Emite evento
    this.game.events.emit(EVENTS.BOSS_ARENA_ENTER);

    // Fade out
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this._setupBossArena();
      this.cameras.main.fadeIn(500, 0, 0, 0);
    });
  }

  private _setupBossArena(): void {
    this._bossArenaActive = true;

    // Esconde cenário da fase
    if (this._bgFar) this._bgFar.setVisible(false);
    if (this._bgNear) this._bgNear.setVisible(false);
    if (this._groundNormal) this._groundNormal.setVisible(false);

    // Mostra cenário da arena
    if (!this._bgBossFar) {
      this._bgBossFar = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_boss_far');
      this._bgBossFar.setOrigin(0, 0);
      this._bgBossFar.setScrollFactor(0);
      this._bgBossFar.setDepth(-90);
    }
    this._bgBossFar.setVisible(true);

    if (!this._bgBossNear) {
      this._bgBossNear = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_boss_near');
      this._bgBossNear.setOrigin(0, 0);
      this._bgBossNear.setScrollFactor(0);
      this._bgBossNear.setDepth(-80);
    }
    this._bgBossNear.setVisible(true);

    if (!this._groundBoss) {
      this._groundBoss = this.add.tileSprite(0, WALK_ZONE_TOP - 5, BOSS_ARENA_WIDTH, WALK_ZONE_BOTTOM - WALK_ZONE_TOP + 20, 'ground_boss');
      this._groundBoss.setOrigin(0, 0);
      this._groundBoss.setDepth(-1);
    }
    this._groundBoss.setVisible(true);

    // Define limites da arena
    setArenaBounds();

    // Configura câmera para arena (follow suave com limites restritivos)
    // Usa um lerp mais alto para seguir o jogador suavemente sem clipping em knockbacks
    this.cameras.main.setBounds(BOSS_ARENA_X, 0, BOSS_ARENA_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this._player, true, 0.15, 0);

    // Posiciona jogador à esquerda
    this._player.setPosition(BOSS_ARENA_X + 50, (WALK_ZONE_TOP + WALK_ZONE_BOTTOM) / 2);

    // Instancia o boss à direita
    this._boss = new Boss(this, BOSS_ARENA_X + BOSS_ARENA_WIDTH - 80, (WALK_ZONE_TOP + WALK_ZONE_BOTTOM) / 2);
    this._boss.setPlayer(this._player);

    // Mostra banner do boss
    this._showBossBanner();

    // Após 2s, inicia a luta
    this.time.delayedCall(2000, () => {
      if (this._boss) {
        this._boss.startFight();
        this._playerInputBlocked = false;
      }
    });
  }

  private _showBossBanner(): void {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, BOSS_NAME, {
      fontSize: '24px',
      color: '#ff0000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#440000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1000);

    banner.setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 500,
      delay: 500,
    });

    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: banner,
        alpha: 0,
        duration: 500,
        onComplete: () => banner.destroy(),
      });
    });
  }

  private _onBossPhaseTransition(): void {
    // Pausa a GameScene e lança a cutscene
    this.scene.pause();
    this.scene.launch('BossTransitionScene');
  }

  private _onBossTransitionComplete(): void {
    // Retoma a GameScene e atualiza o boss para fase 2
    this.scene.resume();
    if (this._boss) {
      this._boss.enterPhase2();
    }

    // Inicia hazards e lacaios
    this._startPhase2Hazards();
  }

  private _startPhase2Hazards(): void {
    // Timer de hazards
    this._hazardTimer = this.time.addEvent({
      delay: FALLING_HAZARD_INTERVAL,
      loop: true,
      callback: () => this._spawnHazard(),
    });

    // Timer de lacaios
    this._minionTimer = this.time.addEvent({
      delay: BOSS_MINION_INTERVAL,
      loop: true,
      callback: () => this._spawnMinions(),
    });
  }

  private _spawnHazard(): void {
    if (!this._bossArenaActive || !this._boss || this._boss.bossState === BossState.Dead) return;

    // Encontra hazard inativo no pool
    let hazard = this._hazards.find(h => !h.isActive);
    if (!hazard) {
      if (this._hazards.length >= FALLING_HAZARD_POOL_SIZE) return;
      hazard = new FallingHazard(this);
      this._hazards.push(hazard);
    }

    // Posição aleatória na arena, perto do jogador mas não exatamente sobre ele
    const playerX = this._player.x;
    const offsetX = Phaser.Math.Between(-80, 80);
    const hazardX = Phaser.Math.Clamp(playerX + offsetX, BOSS_ARENA_X + 20, BOSS_ARENA_X + BOSS_ARENA_WIDTH - 20);
    const hazardY = Phaser.Math.Between(WALK_ZONE_TOP + 10, WALK_ZONE_BOTTOM - 10);

    hazard.activate(hazardX, hazardY);
  }

  private _spawnMinions(): void {
    if (!this._bossArenaActive || !this._boss || this._boss.bossState === BossState.Dead) return;

    const aliveEnemies = this._enemies.filter(e => e.isActive && e.fighterState !== FighterState.Dead);
    if (aliveEnemies.length >= BOSS_MINION_MAX) return;

    const count = Math.min(BOSS_MINION_COUNT, BOSS_MINION_MAX - aliveEnemies.length);
    for (let i = 0; i < count; i++) {
      const spawnX = Phaser.Math.Between(BOSS_ARENA_X + 20, BOSS_ARENA_X + BOSS_ARENA_WIDTH - 20);
      const spawnY = Phaser.Math.Between(WALK_ZONE_TOP + 10, WALK_ZONE_BOTTOM - 10);
      this._spawnEnemyAt(spawnX, spawnY);
    }
  }

  private _onHazardImpact(data: { x: number; y: number; radius: number; damage: number; safeHeight: number }): void {
    if (!this._bossArenaActive) return;

    // Verifica se o jogador está na área de dano
    const playerX = this._player.x;
    const playerY = this._player.groundY;
    const playerZ = this._player.jumpHeight;

    const dx = playerX - data.x;
    const dy = playerY - data.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Verifica se está dentro do raio E não está pulando alto o suficiente
    if (distance <= data.radius && playerZ < data.safeHeight) {
      this._player.takePlayerDamage(data.damage, 0, false);
      this.cameras.main.shake(100, 0.005);
    }
  }

  // ═══════════════════════════════════════════════════════
  // PROJÉTEIS DO BOSS
  // ═══════════════════════════════════════════════════════

  private _onBossProjectile(data: { x: number; y: number; count: number; speedMult: number; facingRight: boolean }): void {
    if (!this._boss) return;

    for (let i = 0; i < data.count; i++) {
      // Encontra projétil inativo no pool
      let projectile = this._projectiles.find(p => !p.isActive);
      if (!projectile) {
        if (this._projectiles.length >= BOSS_PROJECTILE_POOL_SIZE) continue;
        projectile = new BossProjectile(this);
        this._projectiles.push(projectile);
      }

      // Calcula offset para leque (fase 2)
      let offsetY = 0;
      if (data.count > 1) {
        const spread = 15;
        offsetY = (i - (data.count - 1) / 2) * spread;
      }

      const direction = data.facingRight ? 1 : -1;
      projectile.activate(data.x + direction * 20, data.y + offsetY, direction, data.speedMult, BOSS_ATTACKS.projectile.damage);
    }
  }

  // ═══════════════════════════════════════════════════════
  // AOE DO BOSS
  // ═══════════════════════════════════════════════════════

  private _onBossAoE(data: { x: number; y: number; width: number; height: number }): void {
    if (!this._boss) return;

    // Cria telegraph visual (elipse)
    const telegraph = this.add.ellipse(data.x, data.y, data.width, data.height / 2, 0xff0000, 0.3);
    telegraph.setDepth(500);

    // Anima o telegraph
    this.tweens.add({
      targets: telegraph,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0.5,
      duration: BOSS_ATTACKS.aoe.telegraphDuration,
      ease: 'Sine.easeInOut',
    });

    // Após o telegraph, aplica dano
    this.time.delayedCall(BOSS_ATTACKS.aoe.telegraphDuration, () => {
      // Verifica se o jogador está na área de dano (elíptico)
      const playerX = this._player.x;
      const playerY = this._player.groundY;
      const playerZ = this._player.jumpHeight;

      const dx = (playerX - data.x) / (data.width / 2);
      const dy = (playerY - data.y) / (data.height / 4);
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Verifica se está dentro da elipse E não está pulando alto
      if (distance <= 1 && playerZ < 15) {
        this._player.takePlayerDamage(BOSS_ATTACKS.aoe.damage, 0, false);
        this.cameras.main.shake(200, 0.01);
      }

      // Remove o telegraph
      telegraph.destroy();
    });
  }

  // ═══════════════════════════════════════════════════════
  // DANO MANUAL DO JOGADOR NO BOSS
  // ═══════════════════════════════════════════════════════

  /**
   * Verifica dano do jogador no boss (resolução manual, sem overlap).
   * Para cada swing ativo, testa cada hurtbox e aplica dano à de maior multiplicador.
   */
  private _checkPlayerDamageToBoss(): void {
    if (!this._boss || !this._player.getCurrentAttack()) return;

    const attack = this._player.getCurrentAttack()!;
    const hitboxZone = this._player.getHitboxZone();
    const hitboxBody = hitboxZone.body as Phaser.Physics.Arcade.Body;

    if (!hitboxBody.enable) return;

    // Obtém hurtboxes ativas do boss
    const activeHurtboxes = this._boss.getActiveHurtboxes();
    let bestHurtbox: BossHurtbox | null = null;
    let bestMultiplier = 0;

    // Para cada hurtbox, verifica se está sendo atingida
    for (const hurtbox of activeHurtboxes) {
      if (!hurtbox.body.enable) continue;

      // (a) Diferença de faixa <= BOSS_LANE_TOLERANCE (usando groundY)
      const laneDiff = Math.abs(this._player.groundY - this._boss.groundY);
      if (laneDiff > BOSS_LANE_TOLERANCE) continue;

      // (b) Sobreposição em X entre a hitbox do golpe e a parte
      const hitboxLeft = hitboxZone.x - hitboxBody.width / 2;
      const hitboxRight = hitboxZone.x + hitboxBody.width / 2;
      const hurtboxLeft = hurtbox.zone.x - hurtbox.body.width / 2;
      const hurtboxRight = hurtbox.zone.x + hurtbox.body.width / 2;

      const xOverlap = hitboxRight > hurtboxLeft && hitboxLeft < hurtboxRight;
      if (!xOverlap) continue;

      // (c) Sobreposição do intervalo Z do golpe com [zMin, zMax] da parte
      const playerZ = this._player.jumpHeight;
      const zTolerance = attack.zTolerance;
      const hitZMin = playerZ - zTolerance;
      const hitZMax = playerZ + zTolerance;

      // Se o boss está em stagger, a cabeça desce para a altura do alcance do jogador
      let zMin = hurtbox.data.zMin;
      let zMax = hurtbox.data.zMax;
      if (hurtbox.data.name === 'head' && this._boss.isStaggered) {
        zMin = 0; // Cabeça desce para o alcance do jogador
        zMax = 28;
      }

      const zOverlap = hitZMax >= zMin && hitZMin <= zMax;
      if (!zOverlap) continue;

      // Verifica se já foi atingida neste swing
      if (this._player.canHitTarget(this._boss)) {
        // Escolhe a hurtbox com maior multiplicador
        if (hurtbox.data.damageMultiplier > bestMultiplier) {
          bestHurtbox = hurtbox;
          bestMultiplier = hurtbox.data.damageMultiplier;
        }
      }
    }

    // Aplica dano à hurtbox de maior multiplicador
    if (bestHurtbox) {
      this._player.registerHit(this._boss);
      const knockbackDir = this._player.facingRight ? 1 : -1;
      const knockbackX = knockbackDir * 50; // Knockback leve no boss

      const died = this._boss.takeBossDamage(bestHurtbox, attack.damage, knockbackX);

      // Hitstop, shake e flash
      (this as any)._hitstopFrames = attack.hitstop;
      this.cameras.main.shake(SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY / 1000);
      this._flashImpact(this._boss.x, this._boss.y - 16);

      // Combo
      (this as any)._comboCount++;
      (this as any)._comboTimer = this.time.now + 2000;
      this.game.events.emit(EVENTS.COMBO_CHANGED, (this as any)._comboCount);

      debugLog(`[Boss Damage] Parte: ${bestHurtbox.data.name}, Dano: ${attack.damage * bestMultiplier}, Multiplicador: ${bestMultiplier}`);
    }
  }

  private _onBossDied(): void {
    if (!this._boss) return;

    // Para timers
    if (this._hazardTimer) {
      this._hazardTimer.remove(false);
      this._hazardTimer = undefined;
    }
    if (this._minionTimer) {
      this._minionTimer.remove(false);
      this._minionTimer = undefined;
    }

    // Remove projéteis
    for (const projectile of this._projectiles) {
      if (projectile.isActive) {
        projectile.deactivate();
      }
    }

    // Remove lacaios
    for (const enemy of this._enemies) {
      if (enemy.isActive) {
        enemy.takeEnemyDamage(9999, 0, true);
      }
    }

    // Slow motion
    this.time.timeScale = 0.25;
    this.physics.world.timeScale = 0.25;

    // Explosão de partículas
    if (this._deathParticles && this._boss) {
      this._deathParticles.setPosition(this._boss.x, this._boss.y);
      this._deathParticles.explode(BOSS_DEATH_EXPLOSION_PARTICLES);
    }

    // Screen shake
    this.cameras.main.shake(500, 0.02);

    // Após slow motion (usando tempo real), mostra vitória
    // Divide a duração pelo timeScale para durar ~1s reais
    const realDuration = BOSS_DEATH_SLOWMO_DURATION / this.time.timeScale;
    this.time.delayedCall(realDuration, () => {
      this.time.timeScale = 1;
      this.physics.world.timeScale = 1;
      this.game.events.emit(EVENTS.BOSS_VICTORY);
    });
  }

  // ═══════════════════════════════════════════════════════
  // INIMIGOS
  // ═══════════════════════════════════════════════════════

  private _spawnEnemyAt(x: number, y: number): void {
    let enemy = this._findInactiveEnemy();

    if (enemy) {
      enemy.resetEnemy(x, y);
    } else if (this._enemies.length < 10) {
      enemy = new Enemy(this, x, y, this._playerState);
      this._enemyGroup.add(enemy);
      this._enemies.push(enemy);
    } else {
      return;
    }

    this._initEnemy(enemy);
  }

  private _findInactiveEnemy(): Enemy | null {
    for (const enemy of this._enemies) {
      if (!enemy.isActive) {
        return enemy;
      }
    }
    return null;
  }

  private _initEnemy(enemy: Enemy): void {
    enemy.setPlayer(this._player);
    enemy.setPlayerState(this._playerState);

    if (!enemy.overlapRegistered) {
      this.physics.add.overlap(
        enemy.getHitboxZone(),
        this._player,
        this._onEnemyHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this
      );
      enemy.markOverlapRegistered();
    }
  }

  // ═══════════════════════════════════════════════════════
  // COMBATE
  // ═══════════════════════════════════════════════════════

  private _setupCombatOverlaps(): void {
    console.log('🔧 [SETUP] Configurando overlaps...');
    
    this.physics.add.overlap(
      this._player.getHitboxZone(),
      this._enemyGroup,
      this._onPlayerHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    
    console.log('✅ [SETUP] Overlap configurado!');
    
    // Verifica se o grupo de inimigos tem membros
    console.log(`👥 [SETUP] Inimigos no grupo: ${this._enemyGroup.getLength()}`);
  }

  private _onPlayerHitEnemy(
    playerHitbox: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, 
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    const enemy = enemyObj as Enemy;
    const attack = this._player.getCurrentAttack();
    
    if (!attack) {
        this.showDebug('❌ OVERLAP: Sem ataque ativo');
        return;
    }
    
    if (!this._player.canHitTarget(enemy)) {
        // Feedback visual: mostra que está fora da lane
        const laneDiff = Math.abs(this._player.groundY - enemy.groundY);
        const dynamicTolerance = LANE_TOLERANCE + (attack.damage * 0.5);
        if (laneDiff > dynamicTolerance) {
            this.showDebug(`⚠️ Fora da lane! Diff: ${laneDiff.toFixed(0)}px (max: ${dynamicTolerance.toFixed(0)}px)`);
        } else {
            this.showDebug('❌ OVERLAP: canHitTarget falhou (invulnerabilidade/knockdown)');
        }
        return;
    }
    
    this._player.registerHit(enemy);
    const knockbackDir = this._player.facingRight ? 1 : -1;
    const knockbackX = knockbackDir * attack.knockback;
    
    const died = enemy.takeEnemyDamage(attack.damage, knockbackX, attack.knockdown);
    
    this.showDebug(`✅ DANO APLICADO! Dano: ${attack.damage} | HP Restante: ${enemy.hp} | Morto: ${died}`);
    
    // Efeitos visuais
    this._hitstopFrames = attack.hitstop;
    this.cameras.main.shake(SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY / 1000);
    this._flashImpact(enemy.x, enemy.y - 16);
    
    // Combo
    this._comboCount++;
    this._comboTimer = this.time.now + 2000;
    this.game.events.emit(EVENTS.COMBO_CHANGED, this._comboCount);
  }

  private showDebug(message: string): void {
    this.debugText.setText(message);
    this.debugTimer = this.time.now + 2000; // Mostra por 2 segundos
  }

  private _onEnemyHitPlayer(enemyHitbox: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile): void {
    const enemy = enemyHitbox as Enemy;
    const attack = enemy.getCurrentAttack();
    if (!attack) return;

    if (this._player.isInvulnerable()) return;
    if (this._player.fighterState === FighterState.Dead || this._player.fighterState === FighterState.Knockdown) return;

    const laneDiff = Math.abs(this._player.groundY - enemy.groundY);
    const zDiff = Math.abs(this._player.jumpHeight - enemy.jumpHeight);
    if (laneDiff > LANE_TOLERANCE || zDiff > attack.zTolerance) return;

    const knockbackDir = enemy.facingRight ? 1 : -1;
    const knockbackX = knockbackDir * attack.knockback;

    this._player.takePlayerDamage(attack.damage, knockbackX, attack.knockdown);

    this._hitstopFrames = attack.hitstop;
    this.cameras.main.shake(SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY / 1000);
    this._flashImpact(this._player.x, this._player.y - 16);
  }

  private _flashImpact(x: number, y: number): void {
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

  private _onEnemyDied(_enemy: Enemy, x: number, y: number): void {
    console.log('[DEBUG] _onEnemyDied - Evento recebido em', x, y);
    
    if (this._deathParticles) {
      this._deathParticles.setPosition(x, y);
      this._deathParticles.explode(10);
      console.log('[DEBUG] _onEnemyDied - Partículas de morte emitidas');
    }

    // Respawn infinito apenas se ENDLESS_RESPAWN estiver ativo (debug)
    if (ENDLESS_RESPAWN && !this._bossArenaActive) {
      this.time.delayedCall(ENEMY_RESPAWN_DELAY, () => {
        const randomX = Phaser.Math.Between(200, WORLD_WIDTH - 200);
        const randomY = Phaser.Math.Between(WALK_ZONE_TOP + 10, WALK_ZONE_BOTTOM - 10);
        this._spawnEnemyAt(randomX, randomY);
        console.log('[DEBUG] _onEnemyDied - Inimigo respawnado em', randomX, randomY);
      });
    }

    // Atualiza contador de onda
    console.log('[DEBUG] _onEnemyDied - currentWaveIndex:', this._currentWaveIndex, 'waveEnemiesRemaining:', this._waveEnemiesRemaining);
    
    if (this._currentWaveIndex >= 0 && this._waveEnemiesRemaining > 0) {
      this._waveEnemiesRemaining--;
      console.log('[DEBUG] _onEnemyDied - waveEnemiesRemaining decrementado para:', this._waveEnemiesRemaining);
      this.game.events.emit(EVENTS.WAVE_ENEMIES_LEFT, this._waveEnemiesRemaining);

      if (this._waveEnemiesRemaining <= 0) {
        console.log('[DEBUG] _onEnemyDied - Onda concluída! Chamando _onWaveCleared');
        this._onWaveCleared();
      }
    }

    // Reseta combo se não houver mais inimigos vivos
    const aliveEnemies = this._enemies.filter(e => e.isActive && e.fighterState !== FighterState.Dead);
    console.log('[DEBUG] _onEnemyDied - Inimigos vivos:', aliveEnemies.length);
    
    if (aliveEnemies.length === 0) {
      this._comboCount = 0;
      this.game.events.emit(EVENTS.COMBO_CHANGED, 0);
      console.log('[DEBUG] _onEnemyDied - Combo resetado');
    }
    
    console.log('[DEBUG] ✅ _onEnemyDied - Processamento concluído!');
  }

  private _createDeathParticles(): void {
    const particleGfx = this.add.graphics();
    particleGfx.fillStyle(0xff2222, 1);
    particleGfx.fillRect(0, 0, 4, 4);
    particleGfx.generateTexture('death_particle', 4, 4);
    particleGfx.destroy();

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
    const skyGfx = this.add.graphics();
    skyGfx.fillGradientStyle(COLOR_SKY_TOP, COLOR_SKY_TOP, COLOR_SKY_BOTTOM, COLOR_SKY_BOTTOM, 1);
    skyGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    skyGfx.setScrollFactor(0);
    skyGfx.setDepth(-100);

    this._bgFar = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_far_tex');
    this._bgFar.setOrigin(0, 0);
    this._bgFar.setScrollFactor(0);
    this._bgFar.setDepth(-90);

    this._bgNear = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_near_tex');
    this._bgNear.setOrigin(0, 0);
    this._bgNear.setScrollFactor(0);
    this._bgNear.setDepth(-80);

    this._groundNormal = this.add.tileSprite(0, WALK_ZONE_TOP - 5, WORLD_WIDTH, WALK_ZONE_BOTTOM - WALK_ZONE_TOP + 20, 'ground_tex');
    this._groundNormal.setOrigin(0, 0);
    this._groundNormal.setDepth(-1);
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
    if (this._hitstopFrames > 0) {
      this._hitstopFrames--;
      return;
    }

    // Atualiza entidades
    if (!this._playerInputBlocked) {
      this._player.update(time, delta);
    }

    for (const enemy of this._enemies) {
      if (enemy.isActive) {
        enemy.update(time, delta);
      }
    }

    if (this._boss) {
      this._boss.update(time, delta);
    }

    for (const hazard of this._hazards) {
      if (hazard.isActive) {
        hazard.update(time, delta);
      }
    }

    for (const projectile of this._projectiles) {
      if (projectile.isActive) {
        projectile.update(time, delta);
        // Verifica se o projétil atingiu o jogador
        if (projectile.canHitPlayer(this._player)) {
          this._player.takePlayerDamage(projectile.getDamage(), 0, false);
          projectile.markAsHit();
          projectile.deactivate();
          this.cameras.main.shake(100, 0.005);
        }
      }
    }

    // Dano manual do jogador no boss (resolução manual, sem overlap)
    if (this._boss && this._player.getCurrentAttack()) {
      this._checkPlayerDamageToBoss();
    }

    // Combo timer
    if (this.time.now > this._comboTimer && this._comboCount > 0) {
      this._comboCount = 0;
      this.game.events.emit(EVENTS.COMBO_CHANGED, 0);
    }

    // Parallax
    if (!this._bossArenaActive) {
      const camScrollX = this.cameras.main.scrollX;
      if (this._bgFar) this._bgFar.setTilePosition(camScrollX * 0.2, 0);
      if (this._bgNear) this._bgNear.setTilePosition(camScrollX * 0.5, 0);
    }

    // Sistema de ondas e Boss
    if (!this._bossArenaActive && !this._bossTriggered) {
      this._checkWaveTriggers();
      this._checkGoArrowAdvance();
      
      // O trigger do boss deve ser avaliado continuamente se as condições forem atendidas
      this._checkBossTrigger();
    }

    // Debug
    this._handleDebugInput();
    if (this._debugMode) {
      this._drawDebug();
    } else {
      this._debugGraphics.clear();
    }

    // Debug de estado do ataque
    const attack = this._player.getCurrentAttack();
    const isAttacking = this._player.fighterState === FighterState.Attack;
    const hitbox = this._player.getHitboxZone();
    const hitboxBody = hitbox.body as Phaser.Physics.Arcade.Body;
    
    if (this.time.now > this.debugTimer) {
        if (isAttacking && attack) {
            const isActive = hitboxBody.enable ? 'ATIVA ✅' : 'INATIVA ❌';
            this.debugText.setText(`👊 ATACANDO | Hitbox: ${isActive}\nPosição: (${Math.round(hitbox.x)}, ${Math.round(hitbox.y)})`);
        } else {
            this.debugText.setText('DEBUG: Pronto (Aperte J para testar)');
        }
    }
  }

  // ═══════════════════════════════════════════════════════
  // DEBUG
  // ═══════════════════════════════════════════════════════

  private _handleDebugInput(): void {
    if (!this.input.keyboard) return;

    if (Phaser.Input.Keyboard.JustDown(this._f1Key)) {
      this._debugMode = !this._debugMode;
    }

    // F2: reinicia a luta do boss
    if (Phaser.Input.Keyboard.JustDown(this._f2Key) && this._boss) {
      this._boss.cleanup();
      this._boss = new Boss(this, BOSS_ARENA_X + BOSS_ARENA_WIDTH - 80, (WALK_ZONE_TOP + WALK_ZONE_BOTTOM) / 2);
      this._boss.setPlayer(this._player);
      this._boss.startFight();
    }

    // F3: boss a 51% de HP
    if (Phaser.Input.Keyboard.JustDown(this._f3Key) && this._boss) {
      const targetHP = Math.floor(BOSS_HP * 0.51);
      (this._boss as any)._hp = targetHP;
      this.game.events.emit(EVENTS.BOSS_HP_CHANGED, targetHP, BOSS_HP);
    }

    // F4: congela IA do boss
    if (Phaser.Input.Keyboard.JustDown(this._f4Key) && this._boss) {
      this._boss.toggleAIFreeze();
    }

    // F9: pula todas as ondas e vai ao boss
    if (Phaser.Input.Keyboard.JustDown(this._f9Key) && !this._bossTriggered) {
      // Marca todas as ondas como triggeradas
      for (let i = 0; i < STAGE_WAVES.length; i++) {
        this._waveTriggered[i] = true;
      }
      this._waveEnemiesRemaining = 0;
      this._goArrowActive = false;

      // Move jogador para o gatilho do boss
      this._player.setPosition(BOSS_ARENA_X - 50, (WALK_ZONE_TOP + WALK_ZONE_BOTTOM) / 2);
      unlockBounds();
      this.cameras.main.startFollow(this._player, true, CAMERA_LERP, 0);
    }

    // F10: mata todos os inimigos da onda atual
    if (Phaser.Input.Keyboard.JustDown(this._f10Key)) {
      for (const enemy of this._enemies) {
        if (enemy.isActive && enemy.fighterState !== FighterState.Dead) {
          enemy.takeEnemyDamage(9999, 0, true);
        }
      }
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

    // Inimigos
    for (const enemy of this._enemies) {
      if (!enemy.isActive || enemy.fighterState === FighterState.Dead) continue;

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

      const enemyPhysBody = enemy.body as Phaser.Physics.Arcade.Body;
      this._debugGraphics.lineStyle(1, 0xff8800, 1);
      this._debugGraphics.strokeRect(
        enemy.x + enemyPhysBody.offset.x,
        enemy.y + enemyPhysBody.offset.y,
        enemyPhysBody.width,
        enemyPhysBody.height
      );
    }

    // Boss
    if (this._boss) {
      for (const hurtbox of this._boss.getActiveHurtboxes()) {
        const zone = hurtbox.zone;
        const body = hurtbox.body;
        if (body.enable) {
          this._debugGraphics.lineStyle(1, 0xff00ff, 1);
          this._debugGraphics.strokeRect(
            zone.x - body.width / 2,
            zone.y - body.height / 2,
            body.width,
            body.height
          );
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // POSTUPDATE
  // ═══════════════════════════════════════════════════════

  private _onPostUpdate = (): void => {
    this._player.postPhysicsUpdate();
    for (const enemy of this._enemies) {
      if (enemy.isActive) {
        enemy.postPhysicsUpdate();
      }
    }
    if (this._boss) {
      this._boss.postPhysicsUpdate();
    }
  };

  // ═══════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════

  private _onShutdown = (): void => {
    // Remove listeners
    this.game.events.off(EVENTS.ENEMY_DIED, this._onEnemyDied, this);
    this.game.events.off(EVENTS.BOSS_PHASE_TRANSITION, this._onBossPhaseTransition, this);
    this.game.events.off(EVENTS.BOSS_TRANSITION_COMPLETE, this._onBossTransitionComplete, this);
    this.game.events.off(EVENTS.BOSS_DIED, this._onBossDied, this);
    this.game.events.off(EVENTS.HAZARD_IMPACT, this._onHazardImpact, this);
    this.game.events.off(EVENTS.BOSS_PROJECTILE, this._onBossProjectile, this);
    this.game.events.off(EVENTS.BOSS_AOE, this._onBossAoE, this);
    this.events.off('postupdate', this._onPostUpdate, this);

    // Remove timers
    if (this._hazardTimer) {
      this._hazardTimer.remove(false);
      this._hazardTimer = undefined;
    }
    if (this._minionTimer) {
      this._minionTimer.remove(false);
      this._minionTimer = undefined;
    }

    // Restaura timeScale
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;

    // Cleanup de entidades
    this._player?.cleanup();
    for (const enemy of this._enemies) {
      enemy?.cleanup();
    }
    if (this._boss) {
      this._boss.cleanup();
    }
    for (const hazard of this._hazards) {
      hazard?.cleanup();
    }
    for (const projectile of this._projectiles) {
      projectile?.cleanup();
    }

    // Limpa arrays
    this._enemies = [];
    this._hazards = [];
    this._projectiles = [];

    // Limpa cenário do boss
    if (this._bgBossFar) {
      this._bgBossFar.destroy();
      this._bgBossFar = undefined;
    }
    if (this._bgBossNear) {
      this._bgBossNear.destroy();
      this._bgBossNear = undefined;
    }
    if (this._groundBoss) {
      this._groundBoss.destroy();
      this._groundBoss = undefined;
    }

    setStageBounds();
  };

  // ═══════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════

  get playerState(): PlayerState { return this._playerState; }
  get player(): Player { return this._player; }
}
