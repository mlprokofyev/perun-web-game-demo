import { Config } from './Config';
import { Camera } from '../rendering/Camera';
import { Renderer, RenderLayer } from '../rendering/Renderer';
import { PostProcessPipeline } from '../rendering/PostProcessPipeline';
import { InputSystem } from '../systems/InputSystem';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { Campfire } from '../entities/Campfire';
import { TileMap } from '../world/TileMap';
import { HUD } from '../ui/HUD';
import { DialogUI } from '../ui/DialogUI';
import { DialogState } from '../states/DialogState';
import { getDialogTree } from '../dialog/DialogData';
// Side-effect import: registers the sample dog dialog in the registry
import '../dialog/DialogData';
import { isoToScreen } from '../rendering/IsometricUtils';
import type { AnimationDef } from '../entities/AnimationController';
import { assetLoader } from '../core/AssetLoader';
import { CAMPFIRE_FRAME_W, CAMPFIRE_FRAME_H, CAMPFIRE_FRAMES } from '../assets/ProceduralAssets';
import { ALL_DIRECTIONS } from './Types';
import { EntityManager } from './EntityManager';
import { eventBus } from './EventBus';
import { InputManager, Action } from './InputManager';
import { GameState, GameStateManager } from './GameState';
import { FireLightEffect } from '../rendering/effects/FireLightEffect';
import { LightingProfile, NIGHT_PROFILE, DAY_PROFILE, lerpProfile } from '../rendering/LightingProfile';

/** Derived constants from Config — computed once at module load */
const TILE_IMG_W = Config.TILE_IMG_W;
const TILE_IMG_H = Config.TILE_IMG_H;
const CHAR_SRC_W = Config.CHAR_SRC_W;
const CHAR_SRC_H = Config.CHAR_SRC_H;
const CHAR_DRAW_H = Config.CHAR_DRAW_H;
const CHAR_SCALE = CHAR_DRAW_H / CHAR_SRC_H;
const CHAR_DRAW_W = CHAR_SRC_W * CHAR_SCALE;

/** Derive frame count from sprite sheet width / single frame width */
function frameCountOf(assetId: string, frameW: number): number {
  const size = assetLoader.getSize(assetId);
  if (!size) return 1;
  return Math.max(1, Math.floor(size.width / frameW));
}

export class Game {
  private camera: Camera;
  private renderer: Renderer;
  private postProcess: PostProcessPipeline;
  private input: InputSystem;
  private inputManager: InputManager;
  private physics: PhysicsSystem;
  private animationSystem: AnimationSystem;
  private entityManager: EntityManager;
  private stateManager: GameStateManager;
  private player: Player;
  private campfire: Campfire;
  private campfireFlicker: FireLightEffect;
  private tileMap: TileMap;
  private hud: HUD;
  private dialogUI: DialogUI;
  private interactPrompt: HTMLElement;

  private lastTimestamp: number = 0;
  private elapsed: number = 0;
  private running: boolean = false;

  /** Edge-triggered interaction tracking */
  private interactPrev: boolean = false;

  /** DOM markers for interactable NPCs (keyed by entity id) */
  private interactMarkers: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement, tileMap: TileMap) {
    this.tileMap = tileMap;
    this.camera = new Camera();
    this.renderer = new Renderer(container, this.camera);
    this.postProcess = new PostProcessPipeline(container, this.renderer.canvas);
    this.postProcess.enabled = Config.LIGHTING_ENABLED;
    // Ambient + shadows are now driven by applyLightingProfile() every frame
    this.postProcess.setAmbient(
      NIGHT_PROFILE.ambientR,
      NIGHT_PROFILE.ambientG,
      NIGHT_PROFILE.ambientB,
    );
    this.input = new InputSystem(this.renderer.canvas, this.camera);
    this.inputManager = new InputManager(this.input);
    this.physics = new PhysicsSystem(tileMap);
    this.animationSystem = new AnimationSystem();
    this.entityManager = new EntityManager();
    this.hud = new HUD();
    this.dialogUI = new DialogUI();
    this.interactPrompt = document.getElementById('interact-prompt')!;

    // ── Player ────────────────────────────────────────
    this.player = new Player();
    this.player.drawScale = CHAR_SCALE;
    this.player.transform.set(
      Config.PLAYER_START_COL,
      Config.PLAYER_START_ROW,
    );
    this.registerPlayerAnimations();
    this.player.animController.play('idle_south');
    this.entityManager.add(this.player);

    // ── Campfire ──────────────────────────────────────
    this.campfire = this.spawnCampfire();
    this.campfireFlicker = new FireLightEffect({
      baseR: Config.CAMPFIRE_LIGHT_R,
      baseG: Config.CAMPFIRE_LIGHT_G,
      baseB: Config.CAMPFIRE_LIGHT_B,
    });

    // ── Dog NPC ───────────────────────────────────────
    this.spawnDogNPC();

    // ── State manager ─────────────────────────────────
    this.stateManager = new GameStateManager();
    this.stateManager.push(new PlayingState(this));

    // Snap camera to player
    const playerWorld = isoToScreen(this.player.transform.x, this.player.transform.y);
    this.camera.follow(playerWorld.x, playerWorld.y);
    this.camera.snap();
  }

  // ─── Player animation registration ─────────────────────────

  private registerPlayerAnimations(): void {
    const hasRealChar = assetLoader.has('char_idle');
    for (const dir of ALL_DIRECTIONS) {
      if (hasRealChar) {
        const idleAsset = 'char_idle';
        const idleDef: AnimationDef = {
          assetId: idleAsset,
          frameWidth: CHAR_SRC_W,
          frameHeight: CHAR_SRC_H,
          frameCount: frameCountOf(idleAsset, CHAR_SRC_W),
          frameRate: 1,
          loop: true,
        };
        this.player.animController.addAnimation(`idle_${dir}`, idleDef);

        const walkAssetId = `char_walk_${dir}`;
        const walkAsset = assetLoader.has(walkAssetId) ? walkAssetId : idleAsset;
        const walkDef: AnimationDef = {
          assetId: walkAsset,
          frameWidth: CHAR_SRC_W,
          frameHeight: CHAR_SRC_H,
          frameCount: frameCountOf(walkAsset, CHAR_SRC_W),
          frameRate: 5,
          loop: true,
        };
        this.player.animController.addAnimation(`walk_${dir}`, walkDef);
      } else {
        const procDir = dir.includes('_') ? dir.split('_')[0] : dir;
        const procWalk = `char_walk_${procDir}`;
        const procIdle = `char_idle_${procDir}`;
        this.player.animController.addAnimation(`walk_${dir}`, {
          assetId: procWalk,
          frameWidth: 32, frameHeight: 48,
          frameCount: frameCountOf(procWalk, 32),
          frameRate: 8, loop: true,
        });
        this.player.animController.addAnimation(`idle_${dir}`, {
          assetId: procIdle,
          frameWidth: 32, frameHeight: 48,
          frameCount: frameCountOf(procIdle, 32),
          frameRate: 1, loop: true,
        });
      }
    }
  }

  // ─── Campfire creation ─────────────────────────────────────

  private spawnCampfire(): Campfire {
    const fire = new Campfire(Config.CAMPFIRE_COL, Config.CAMPFIRE_ROW);
    const scale = Config.CAMPFIRE_DRAW_H / CAMPFIRE_FRAME_H;
    fire.drawScale = scale;
    fire.blobShadow = { rx: 12, ry: 6, opacity: 0.18 };

    fire.animController.addAnimation('burn', {
      assetId: 'campfire_anim',
      frameWidth: CAMPFIRE_FRAME_W,
      frameHeight: CAMPFIRE_FRAME_H,
      frameCount: CAMPFIRE_FRAMES,
      frameRate: 6,
      loop: true,
    });
    fire.animController.play('burn');

    this.entityManager.add(fire);
    return fire;
  }

  // ─── Dog NPC creation ──────────────────────────────────────

  private spawnDogNPC(): void {
    const dog = new NPC('dog', {
      spawnCol: Config.DOG_SPAWN_COL,
      spawnRow: Config.DOG_SPAWN_ROW,
      targetCol: Config.DOG_TARGET_COL,
      targetRow: Config.DOG_TARGET_ROW,
      speed: Config.DOG_SPEED,
      fadeDuration: Config.DOG_FADE_DURATION,
      dialogId: 'dog_greeting',
    });

    // Draw scale based on idle frame height
    dog.drawScale = Config.DOG_DRAW_H / Config.DOG_IDLE_SRC_H;

    // Blob shadow (smaller than player)
    dog.blobShadow = { rx: 14, ry: 7, opacity: 0.3 };

    // Register all 8 directions → same walk/idle asset (dog only has one facing)
    const walkAsset = 'dog_walk_west';
    const idleAsset = 'dog_idle';
    for (const dir of ALL_DIRECTIONS) {
      if (assetLoader.has(walkAsset)) {
        dog.animController.addAnimation(`walk_${dir}`, {
          assetId: walkAsset,
          frameWidth: Config.DOG_WALK_SRC_W,
          frameHeight: Config.DOG_WALK_SRC_H,
          frameCount: frameCountOf(walkAsset, Config.DOG_WALK_SRC_W),
          frameRate: 6,
          loop: true,
        });
      }
      if (assetLoader.has(idleAsset)) {
        dog.animController.addAnimation(`idle_${dir}`, {
          assetId: idleAsset,
          frameWidth: Config.DOG_IDLE_SRC_W,
          frameHeight: Config.DOG_IDLE_SRC_H,
          frameCount: frameCountOf(idleAsset, Config.DOG_IDLE_SRC_W),
          frameRate: 2,
          loop: true,
        });
      }
    }
    dog.animController.play('walk_south_west');

    this.entityManager.add(dog);
  }

  start(): void {
    this.running = true;
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';

    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private loop = (timestamp: number): void => {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    this.stateManager.update(dt);
    this.stateManager.render(dt);

    requestAnimationFrame(this.loop);
  };

  /** @internal — called by PlayingState */
  _update(dt: number): void {
    this.player.handleInput(this.inputManager);
    const entities = this.entityManager.getAll();

    this.physics.update(dt, entities);

    // Update NPC behaviours (after physics for immediate arrival detection)
    for (const e of entities) {
      if (e instanceof NPC) e.update(dt);
    }

    // Campfire spark particles (only when fire has opacity)
    if (this.activeProfile.fireOpacity > 0.001) {
      this.campfire.updateSparks(dt);
    }

    this.animationSystem.update(dt, entities);

    // Camera
    const pw = isoToScreen(this.player.transform.x, this.player.transform.y);
    this.camera.follow(pw.x, pw.y);
    this.camera.update(dt);

    eventBus.emit('player:moved', { x: this.player.transform.x, y: this.player.transform.y });

    // NPC interaction (proximity prompt + E to talk)
    this.updateInteraction();

    this.hud.update(dt, this.player, this.camera, this.tileMap);
  }

  // ─── NPC interaction ──────────────────────────────────────

  private updateInteraction(): void {
    const px = this.player.transform.x;
    const py = this.player.transform.y;
    const radius = Config.NPC_INTERACT_RADIUS;

    // Find nearest interactable NPC within radius
    let nearest: NPC | null = null;
    let nearestDist = Infinity;

    for (const e of this.entityManager.getAll()) {
      if (!(e instanceof NPC) || !e.interactable) continue;
      const dx = e.transform.x - px;
      const dy = e.transform.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius && dist < nearestDist) {
        nearest = e;
        nearestDist = dist;
      }
    }

    // Show / hide "Press E to talk" prompt
    this.interactPrompt.style.display = nearest ? '' : 'none';

    // Edge-triggered E key → open dialog
    const eDown = this.inputManager.isActionDown(Action.INTERACT);
    if (eDown && !this.interactPrev && nearest) {
      this.openDialog(nearest);
    }
    this.interactPrev = eDown;
  }

  private openDialog(npc: NPC): void {
    const tree = getDialogTree(npc.dialogId);
    if (!tree) return;

    this.interactPrompt.style.display = 'none';

    const dialogState = new DialogState(tree, this.dialogUI, () => {
      this.stateManager.pop();
    });
    this.stateManager.push(dialogState);
  }

  // ─── Campfire spark rendering ──────────────────────────────────

  private drawCampfireSparks(): void {
    const sparks = this.campfire.sparks;
    if (sparks.length === 0) return;

    const cam = this.camera;
    const zoom = cam.zoom;
    const fireIso = isoToScreen(Config.CAMPFIRE_COL, Config.CAMPFIRE_ROW);
    const fireScreen = cam.worldToScreen(fireIso.x, fireIso.y);
    // Base screen Y at the fire's ground level
    const baseY = fireScreen.y + Config.TILE_HEIGHT / 2 * zoom;

    const ctx = this.renderer.ctx;
    const fireAlpha = this.activeProfile.fireOpacity;
    ctx.save();
    for (const s of sparks) {
      const t = s.life / s.maxLife; // 1 = just spawned, 0 = dying
      const alpha = Math.min(1, t * 1.2) * fireAlpha;
      const r = s.radius * zoom * Math.max(0.4, t);

      // Screen position: fire center + offset scaled by zoom
      const sx = fireScreen.x + s.ox * zoom;
      const sy = baseY + s.oy * zoom;

      // Color: interpolate orange → yellow based on hue
      const red = 255;
      const green = Math.floor(110 + s.hue * 145); // 110–255
      const blue = Math.floor(s.hue * 60);          // 0–60

      // Soft glow halo behind the spark (larger, lower opacity)
      const glowR = r * 3;
      ctx.globalAlpha = alpha * 0.3;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      grad.addColorStop(0, `rgba(${red},${green},${blue},0.6)`);
      grad.addColorStop(1, `rgba(${red},${green},0,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);

      // Solid bright spark pixel
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${red},${green},${blue})`;
      ctx.fillRect(Math.floor(sx - r / 2), Math.floor(sy - r / 2), Math.ceil(r), Math.ceil(r));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─── Lighting profile application ────────────────────────────

  private applyLightingProfile(): void {
    const p = this.activeProfile;

    // Background color
    const toHex = (r: number, g: number, b: number) =>
      '#' + [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
    this.renderer.setBackgroundColor(toHex(p.bgR, p.bgG, p.bgB));

    // Post-process ambient
    this.postProcess.setAmbient(p.ambientR, p.ambientG, p.ambientB);

    // Shadows
    this.postProcess.setShadowLengthMult(p.shadowLengthMult);
    this.postProcess.setShadowOpacity(p.shadowOpacity);

    // Campfire opacity (smooth fade)
    this.campfire.opacity = p.fireOpacity;
  }

  // ─── Interactable markers (DOM overlays) ─────────────────────

  private updateInteractMarkers(): void {
    const cam = this.camera;
    const zoom = cam.zoom;
    const active = new Set<string>();

    for (const e of this.entityManager.getAll()) {
      if (!(e instanceof NPC) || !e.interactable) continue;
      active.add(e.id);

      // Get or create the DOM element
      let el = this.interactMarkers.get(e.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'interact-marker';
        // Pixel-art downward arrow: 7×5 grid scaled up to 14×10
        el.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="10" viewBox="0 0 7 5" shape-rendering="crispEdges">' +
          '<rect x="1" y="0" width="5" height="1" fill="#ED8312"/>' +
          '<rect x="2" y="1" width="3" height="1" fill="#ED8312"/>' +
          '<rect x="3" y="2" width="1" height="1" fill="#ED8312"/>' +
          '<rect x="0" y="0" width="1" height="1" fill="#B5620D"/>' +
          '<rect x="6" y="0" width="1" height="1" fill="#B5620D"/>' +
          '<rect x="1" y="1" width="1" height="1" fill="#B5620D"/>' +
          '<rect x="5" y="1" width="1" height="1" fill="#B5620D"/>' +
          '<rect x="2" y="2" width="1" height="1" fill="#B5620D"/>' +
          '<rect x="4" y="2" width="1" height="1" fill="#B5620D"/>' +
          '<rect x="3" y="3" width="1" height="1" fill="#B5620D"/>' +
          '</svg>';
        document.getElementById('game-container')!.appendChild(el);
        this.interactMarkers.set(e.id, el);
      }

      // Position: world → screen, offset upward by sprite height
      const iso = isoToScreen(e.transform.x, e.transform.y);
      const screen = cam.worldToScreen(iso.x, iso.y);
      const spriteH = (e.animController?.getCurrentFrame().height ?? 0) * e.drawScale;
      const bob = Math.sin(this.elapsed * 3) * 3;

      // Scale marker proportionally with zoom, clamped to min/max
      const markerScale = Math.min(1.6, Math.max(0.6, zoom * 0.8));

      el.style.left = `${screen.x}px`;
      el.style.top = `${screen.y + (-spriteH + Config.TILE_HEIGHT / 2) * zoom - 8 + bob}px`;
      el.style.transform = `translateX(-50%) scale(${markerScale})`;
      el.style.display = '';
    }

    // Hide markers for entities that are no longer interactable
    for (const [id, el] of this.interactMarkers) {
      if (!active.has(id)) {
        el.style.display = 'none';
      }
    }
  }

  /** Track L-key toggle (edge-triggered, not held) */
  private lightTogglePrev = false;
  /** Track N-key toggle for snow */
  private snowTogglePrev = false;
  private snowEnabled = true;

  /** Day/night lighting profile system */
  private timeTogglePrev = false;
  private isNight = true;
  private activeProfile: LightingProfile = { ...NIGHT_PROFILE };
  private targetProfile: LightingProfile = NIGHT_PROFILE;
  private profileLerpT = 1;                // 1 = fully arrived at target
  private static readonly PROFILE_TRANSITION_SPEED = 1.5;  // seconds for full transition

  /** @internal — called by PlayingState */
  _render(dt: number): void {
    this.elapsed += dt;
    this.renderer.clear();

    // Enqueue ground tiles
    for (let r = 0; r < this.tileMap.rows; r++) {
      for (let c = 0; c < this.tileMap.cols; c++) {
        const def = this.tileMap.getTileDef(c, r);
        if (def) {
          this.renderer.enqueueTile(c, r, def.assetId, TILE_IMG_W, TILE_IMG_H, TILE_IMG_W, TILE_IMG_H);
        }
      }
    }

    // Enqueue static objects
    for (const obj of this.tileMap.objects) {
      this.renderer.enqueueObject(
        obj.col, obj.row,
        obj.assetId,
        obj.width, obj.height,
        obj.anchorY,
        obj.srcW, obj.srcH,
        obj.groundLayer ? RenderLayer.GROUND : RenderLayer.OBJECT,
        (obj.rotation ?? 0) * Math.PI / 180,
      );
    }

    // Enqueue all entities (player + NPCs)
    for (const entity of this.entityManager.getAll()) {
      this.renderer.enqueueEntity(entity);
    }

    // 1) Draw ground tiles
    this.renderer.flushLayer(RenderLayer.GROUND);

    // 2) Back boundary fog + back animated wisps — behind objects
    this.renderer.drawBoundaryFog(this.tileMap.cols, this.tileMap.rows, 'back');
    this.renderer.drawAnimatedEdgeFog(this.tileMap.cols, this.tileMap.rows, this.elapsed, 'back');

    // 3) Blob shadows for all entities that have them
    for (const entity of this.entityManager.getAll()) {
      const bs = entity.blobShadow;
      if (!bs) continue;
      const iso = isoToScreen(entity.transform.x, entity.transform.y);
      this.renderer.drawBlobShadow(
        iso.x, iso.y,
        bs.rx, bs.ry,
        bs.opacity * entity.opacity,
      );
    }

    // 4) Campfire spark particles — drawn before entities so the player covers them
    if (this.activeProfile.fireOpacity > 0.001) {
      this.drawCampfireSparks();
    }

    // 5) Draw objects & entities (depth-sorted, covers sparks)
    this.renderer.flushLayer(RenderLayer.OBJECT);

    // 5) Front boundary fog + front animated wisps — over objects
    this.renderer.drawBoundaryFog(this.tileMap.cols, this.tileMap.rows, 'front');
    this.renderer.drawAnimatedEdgeFog(this.tileMap.cols, this.tileMap.rows, this.elapsed, 'front');

    // 6) Snowfall — 3D world-space particles drawn over the scene, before post-process
    if (this.snowEnabled) {
      this.renderer.drawSnow(this.tileMap.cols, this.tileMap.rows, dt, this.elapsed);
    }

    // Debug grid overlay (hold action)
    if (this.inputManager.isActionDown(Action.DEBUG_GRID)) {
      this.renderer.drawGridOverlay(this.tileMap.cols, this.tileMap.rows);
    }

    // Toggle lighting (edge-triggered)
    const lDown = this.inputManager.isActionDown(Action.TOGGLE_LIGHT);
    if (lDown && !this.lightTogglePrev) {
      this.postProcess.enabled = !this.postProcess.enabled;
    }
    this.lightTogglePrev = lDown;

    // Toggle snow (edge-triggered)
    const nDown = this.inputManager.isActionDown(Action.TOGGLE_SNOW);
    if (nDown && !this.snowTogglePrev) {
      this.snowEnabled = !this.snowEnabled;
    }
    this.snowTogglePrev = nDown;

    // Toggle day/night (edge-triggered, smooth transition)
    const tDown = this.inputManager.isActionDown(Action.TOGGLE_TIME);
    if (tDown && !this.timeTogglePrev) {
      this.isNight = !this.isNight;
      this.targetProfile = this.isNight ? NIGHT_PROFILE : DAY_PROFILE;
      this.profileLerpT = 0; // start transition
    }
    this.timeTogglePrev = tDown;

    // Advance profile transition
    if (this.profileLerpT < 1) {
      this.profileLerpT = Math.min(1, this.profileLerpT + dt / Game.PROFILE_TRANSITION_SPEED);
      // Ease-in-out for smooth feel
      const ease = this.profileLerpT < 0.5
        ? 2 * this.profileLerpT * this.profileLerpT
        : 1 - Math.pow(-2 * this.profileLerpT + 2, 2) / 2;
      const from = this.isNight ? DAY_PROFILE : NIGHT_PROFILE;
      this.activeProfile = lerpProfile(from, this.targetProfile, ease);
    }
    this.applyLightingProfile();

    // Post-process lighting pass
    if (this.postProcess.enabled) {
      this.postProcess.clearLights();
      this.postProcess.clearOccluders();
      this.postProcess.clearHeightFade();

      // Sky light — position and color driven by active lighting profile
      const p = this.activeProfile;
      const mapCenter = isoToScreen(
        this.tileMap.cols / 2,
        this.tileMap.rows / 2,
      );
      const skyWorldX = mapCenter.x + p.skyLightOffsetX;
      const skyWorldY = mapCenter.y + p.skyLightOffsetY;
      const skyScreen = this.camera.worldToScreen(skyWorldX, skyWorldY);
      this.postProcess.addLight({
        x: skyScreen.x,
        y: skyScreen.y,
        radius: p.skyLightRadius * this.camera.zoom,
        r: p.skyLightR,
        g: p.skyLightG,
        b: p.skyLightB,
        intensity: p.skyLightIntensity,
        flicker: 0,
      });

      // Point lights — intensity scaled by profile opacity (smooth fade)
      if (p.pointLightOpacity > 0.001) {
        // House window light — warm orange glow
        const winWorld = isoToScreen(
          Config.WINDOW_LIGHT_COL,
          Config.WINDOW_LIGHT_ROW,
        );
        const winScreen = this.camera.worldToScreen(
          winWorld.x,
          winWorld.y + Config.TILE_HEIGHT / 2 - Config.WINDOW_LIGHT_HEIGHT,
        );
        this.postProcess.addLight({
          x: winScreen.x,
          y: winScreen.y,
          radius: Config.WINDOW_LIGHT_RADIUS * this.camera.zoom,
          r: Config.WINDOW_LIGHT_R,
          g: Config.WINDOW_LIGHT_G,
          b: Config.WINDOW_LIGHT_B,
          intensity: Config.WINDOW_LIGHT_INTENSITY * p.pointLightOpacity,
          flicker: Config.WINDOW_LIGHT_FLICKER,
        });
      }

      // Campfire light — modulated by FireLightEffect + profile fire opacity
      if (p.fireOpacity > 0.001) {
        this.campfireFlicker.update(dt);
        const fireWorld = isoToScreen(Config.CAMPFIRE_COL, Config.CAMPFIRE_ROW);
        const fireScreen = this.camera.worldToScreen(
          fireWorld.x,
          fireWorld.y + Config.TILE_HEIGHT / 2 - Config.CAMPFIRE_LIGHT_HEIGHT,
        );
        this.postProcess.addLight({
          x: fireScreen.x,
          y: fireScreen.y,
          radius: Config.CAMPFIRE_LIGHT_RADIUS * this.camera.zoom * this.campfireFlicker.radius,
          r: this.campfireFlicker.r,
          g: this.campfireFlicker.g,
          b: this.campfireFlicker.b,
          intensity: Config.CAMPFIRE_LIGHT_INTENSITY * this.campfireFlicker.intensity * p.fireOpacity,
          flicker: 0,
        });
      }

      // Register shadow-casting objects as occluders
      const zoom = this.camera.zoom;
      for (const obj of this.tileMap.objects) {
        const objH = (obj.shadowHeight ?? obj.height) * zoom;
        if (obj.shadowPoints) {
          // Complex shape: multiple shadow circles
          for (const sp of obj.shadowPoints) {
            const ow = isoToScreen(obj.col + sp.dx, obj.row + sp.dy);
            const os = this.camera.worldToScreen(ow.x, ow.y + Config.TILE_HEIGHT / 2);
            this.postProcess.addOccluder({ x: os.x, y: os.y, radius: sp.radius * zoom, height: objH });
          }
        } else {
          // Simple shape: single circle
          const sr = obj.shadowRadius ?? obj.width * 0.15;
          if (sr <= 0) continue;
          const ow = isoToScreen(obj.col, obj.row);
          const os = this.camera.worldToScreen(ow.x, ow.y + Config.TILE_HEIGHT / 2);
          this.postProcess.addOccluder({ x: os.x, y: os.y, radius: sr * zoom, height: objH });
        }
      }

      // Player shadow casting — register player as occluders at visual feet.
      // Use 3 overlapping circles for a softer, wider silhouette instead of a single point.
      const pIso = isoToScreen(this.player.transform.x, this.player.transform.y);
      const pScreen = this.camera.worldToScreen(pIso.x, pIso.y);
      const footOffset = Config.PLAYER_FOOT_OFFSET * zoom;
      const feetY = pScreen.y + Config.TILE_HEIGHT / 2 * zoom - footOffset;
      const pShadowR = Config.PLAYER_SHADOW_RADIUS * zoom;
      const pShadowH = CHAR_DRAW_H * zoom;
      // Center circle
      this.postProcess.addOccluder({ x: pScreen.x, y: feetY, radius: pShadowR, height: pShadowH });
      // Flanking circles — offset horizontally, slightly smaller
      const flankOff = pShadowR * 0.7;
      const flankR   = pShadowR * 0.7;
      this.postProcess.addOccluder({ x: pScreen.x - flankOff, y: feetY, radius: flankR, height: pShadowH * 0.8 });
      this.postProcess.addOccluder({ x: pScreen.x + flankOff, y: feetY, radius: flankR, height: pShadowH * 0.8 });

      // NPC shadow casting — register each NPC as an occluder + height-fade zone
      for (const e of this.entityManager.getAll()) {
        if (!(e instanceof NPC)) continue;
        if (e.opacity <= 0) continue; // skip fully transparent NPCs

        const nIso = isoToScreen(e.transform.x, e.transform.y);
        const nScreen = this.camera.worldToScreen(nIso.x, nIso.y);
        const nFootOffset = Config.DOG_FOOT_OFFSET * zoom;
        const nFeetY = nScreen.y + Config.TILE_HEIGHT / 2 * zoom - nFootOffset;

        // NPC occluder — single circle (adequate for small sprites)
        const nShadowR = Config.DOG_SHADOW_RADIUS * zoom;
        const nAnim = e.animController?.getCurrentFrame();
        const nDrawH = (nAnim?.height ?? Config.DOG_DRAW_H) * e.drawScale * zoom;
        this.postProcess.addOccluder({ x: nScreen.x, y: nFeetY, radius: nShadowR, height: nDrawH });

        // NPC height-fade — prevents uniform darkening when inside shadow
        const nDrawW = (nAnim?.width ?? Config.DOG_IDLE_SRC_W) * e.drawScale * zoom;
        this.postProcess.addHeightFade(
          nScreen.x,
          nFeetY,
          nDrawW,
          nDrawH,
          Config.SHADOW_HEIGHT_FADE * 0.7, // slightly less than player (shorter entity)
        );
      }

      // Height fade for player — head stays lit when feet enter shadow
      const spriteH = CHAR_DRAW_H * zoom;
      const spriteW = CHAR_DRAW_W * zoom;
      this.postProcess.addHeightFade(
        pScreen.x,
        feetY,
        spriteW,
        spriteH,
        Config.SHADOW_HEIGHT_FADE,
        true, // spriteAlphaOnly — no rectangular fallback, only actual sprite pixels
      );

      // Volumetric sprite shading — cylindrical diffuse + rim light
      if (Config.VOLUMETRIC_ENABLED) {
        const playerAnim = this.player.animController;
        const frame = playerAnim.getCurrentFrame();
        const assetId = playerAnim.getCurrentAssetId();
        const spriteImg = assetLoader.get(assetId);
        const sheetSize = assetLoader.getSize(assetId);

        if (spriteImg && sheetSize) {
          // Screen rect of the player sprite (top=0 convention, matching Renderer)
          const drawX = pScreen.x - CHAR_DRAW_W / 2 * zoom;
          const drawY = pScreen.y + (-CHAR_DRAW_H + Config.TILE_HEIGHT / 2) * zoom;
          const drawW = CHAR_DRAW_W * zoom;
          const drawH = CHAR_DRAW_H * zoom;

          // Source UV in the sprite-sheet texture (after UNPACK_FLIP_Y)
          const srcU  = frame.x / sheetSize.width;
          const srcV  = 1 - (frame.y + frame.height) / sheetSize.height;
          const srcUW = frame.width / sheetSize.width;
          const srcVH = frame.height / sheetSize.height;

          this.postProcess.setVolumetricSprite(
            spriteImg as TexImageSource,
            drawX, drawY, drawW, drawH,
            srcU, srcV, srcUW, srcVH,
          );
          this.postProcess.setVolumetricParams(
            Config.VOLUMETRIC_DIFFUSE,
            Config.VOLUMETRIC_RIM,
            this.activeProfile.volRimR,
            this.activeProfile.volRimG,
            this.activeProfile.volRimB,
          );
        }
      } else {
        this.postProcess.clearVolumetric();
      }

      this.postProcess.render(dt);
    }

    // Interactable markers — positioned as DOM overlays so they aren't dimmed by post-process
    this.updateInteractMarkers();
  }
}

// ─── PlayingState ───────────────────────────────────────────────
// Default state — delegates to Game's update/render.
// Future states (DialogState, PauseState, etc.) will implement their own logic.

class PlayingState extends GameState {
  constructor(private game: Game) {
    super();
  }

  update(dt: number): void {
    this.game._update(dt);
  }

  render(dt: number): void {
    this.game._render(dt);
  }
}
