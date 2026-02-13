import { Config } from './Config';
import { Camera } from '../rendering/Camera';
import { Renderer, RenderLayer } from '../rendering/Renderer';
import { PostProcessPipeline } from '../rendering/PostProcessPipeline';
import { InputSystem } from '../systems/InputSystem';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { Player } from '../entities/Player';
import { TileMap } from '../world/TileMap';
import { HUD } from '../ui/HUD';
import { isoToScreen } from '../rendering/IsometricUtils';
import type { AnimationDef } from '../entities/AnimationController';
import { assetLoader } from '../core/AssetLoader';

/** Tile image dimensions (matches PNG asset) */
const TILE_IMG_W = 218;
const TILE_IMG_H = 125;

/** Character sprite source dimensions (must match the actual PNG frame size) */
const CHAR_SRC_W = 113;
const CHAR_SRC_H = 218;

/** Desired on-screen draw height in world pixels.
 *  Adjust this to make the character bigger or smaller on the map. */
const CHAR_DRAW_H = 128;

/** Derived scale: source pixels → draw pixels */
const CHAR_SCALE = CHAR_DRAW_H / CHAR_SRC_H;
const CHAR_DRAW_W = CHAR_SRC_W * CHAR_SCALE;

export class Game {
  private camera: Camera;
  private renderer: Renderer;
  private postProcess: PostProcessPipeline;
  private input: InputSystem;
  private physics: PhysicsSystem;
  private animationSystem: AnimationSystem;
  private player: Player;
  private tileMap: TileMap;
  private hud: HUD;

  private lastTimestamp: number = 0;
  private running: boolean = false;

  constructor(container: HTMLElement, tileMap: TileMap) {
    this.tileMap = tileMap;
    this.camera = new Camera();
    this.renderer = new Renderer(container, this.camera);
    this.postProcess = new PostProcessPipeline(container, this.renderer.canvas);
    this.postProcess.enabled = Config.LIGHTING_ENABLED;
    this.postProcess.setAmbient(
      Config.LIGHT_AMBIENT_R,
      Config.LIGHT_AMBIENT_G,
      Config.LIGHT_AMBIENT_B,
    );
    this.input = new InputSystem(this.renderer.canvas, this.camera);
    this.physics = new PhysicsSystem(tileMap);
    this.animationSystem = new AnimationSystem();
    this.hud = new HUD();

    // Create player
    this.player = new Player();
    this.player.drawScale = CHAR_SCALE;
    this.player.transform.set(
      Math.floor(tileMap.cols / 2),
      Math.floor(tileMap.rows / 2)
    );

    // Determine if we have a real character sprite loaded
    const hasRealChar = assetLoader.has('char_idle');

    // All 8 directions (4 cardinal + 4 diagonal)
    const directions = [
      'south', 'north', 'east', 'west',
      'south_east', 'south_west', 'north_east', 'north_west',
    ];

    // Register player animations (frameWidth/Height = source pixel size)
    for (const dir of directions) {
      if (hasRealChar) {
        // Idle: use real idle sprite for all directions (single pose for now)
        const idleDef: AnimationDef = {
          assetId: 'char_idle',
          frameWidth: CHAR_SRC_W,
          frameHeight: CHAR_SRC_H,
          frameCount: 1,
          frameRate: 1,
          loop: true,
        };
        this.player.animController.addAnimation(`idle_${dir}`, idleDef);

        // Walk: use direction-specific asset if loaded, otherwise fall back to idle
        const walkAssetId = `char_walk_${dir}`;
        const walkAsset = assetLoader.has(walkAssetId) ? walkAssetId : 'char_idle';
        const walkDef: AnimationDef = {
          assetId: walkAsset,
          frameWidth: CHAR_SRC_W,
          frameHeight: CHAR_SRC_H,
          frameCount: 1,
          frameRate: 8,
          loop: true,
        };
        this.player.animController.addAnimation(`walk_${dir}`, walkDef);
      } else {
        // Fallback to procedural assets (only 4 cardinal directions available)
        const procDir = dir.includes('_') ? dir.split('_')[0] : dir; // diagonal → nearest cardinal
        const walkDef: AnimationDef = {
          assetId: `char_walk_${procDir}`,
          frameWidth: 32,
          frameHeight: 48,
          frameCount: 4,
          frameRate: 8,
          loop: true,
        };
        this.player.animController.addAnimation(`walk_${dir}`, walkDef);
        const idleDef: AnimationDef = {
          assetId: `char_idle_${procDir}`,
          frameWidth: 32,
          frameHeight: 48,
          frameCount: 1,
          frameRate: 1,
          loop: true,
        };
        this.player.animController.addAnimation(`idle_${dir}`, idleDef);
      }
    }
    this.player.animController.play('idle_south');

    // Snap camera to player
    const playerWorld = isoToScreen(this.player.transform.x, this.player.transform.y);
    this.camera.follow(playerWorld.x, playerWorld.y);
    this.camera.snap();
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

    this.update(dt);
    this.render(dt);

    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.player.handleInput(this.input);
    this.physics.update(dt, [this.player]);
    this.animationSystem.update(dt, [this.player]);

    const pw = isoToScreen(this.player.transform.x, this.player.transform.y);
    this.camera.follow(pw.x, pw.y);
    this.camera.update(dt);

    this.hud.update(dt, this.player, this.camera, this.tileMap);
  }

  /** Track L-key toggle (edge-triggered, not held) */
  private lightTogglePrev = false;

  private render(dt: number): void {
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
        obj.anchorY
      );
    }

    // Enqueue player
    this.renderer.enqueueEntity(this.player);

    // 1) Draw ground tiles
    this.renderer.flushLayer(RenderLayer.GROUND);

    // 2) Fog on top of tiles only
    this.renderer.drawBoundaryFog(this.tileMap.cols, this.tileMap.rows);

    // 3) Draw objects & entities on top of fog
    this.renderer.flushLayer(RenderLayer.OBJECT);

    // Debug grid overlay (hold G)
    if (this.input.isDown('KeyG')) {
      this.renderer.drawGridOverlay(this.tileMap.cols, this.tileMap.rows);
    }

    // Toggle lighting with L (edge-triggered)
    const lDown = this.input.isDown('KeyL');
    if (lDown && !this.lightTogglePrev) {
      this.postProcess.enabled = !this.postProcess.enabled;
    }
    this.lightTogglePrev = lDown;

    // Post-process lighting pass
    if (this.postProcess.enabled) {
      this.postProcess.clearLights();
      this.postProcess.clearOccluders();
      this.postProcess.clearHeightFade();

      // Sky light — fixed world position offset from map center (moon / sun)
      const mapCenter = isoToScreen(
        this.tileMap.cols / 2,
        this.tileMap.rows / 2,
      );
      const skyWorldX = mapCenter.x + Config.SKY_LIGHT_OFFSET_X;
      const skyWorldY = mapCenter.y + Config.SKY_LIGHT_OFFSET_Y;
      const skyScreen = this.camera.worldToScreen(skyWorldX, skyWorldY);
      this.postProcess.addLight({
        x: skyScreen.x,
        y: skyScreen.y,
        radius: Config.SKY_LIGHT_RADIUS * this.camera.zoom,
        r: Config.SKY_LIGHT_R,
        g: Config.SKY_LIGHT_G,
        b: Config.SKY_LIGHT_B,
        intensity: Config.SKY_LIGHT_INTENSITY,
        flicker: 0,
      });

      // Register shadow-casting objects as occluders
      const zoom = this.camera.zoom;
      this.postProcess.setShadowLengthMult(Config.SHADOW_LENGTH_MULT);
      for (const obj of this.tileMap.objects) {
        const objH = obj.height * zoom;
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

      // Player shadow casting — register player as an occluder at visual feet
      const pIso = isoToScreen(this.player.transform.x, this.player.transform.y);
      const pScreen = this.camera.worldToScreen(pIso.x, pIso.y);
      const footOffset = Config.PLAYER_FOOT_OFFSET * zoom;
      const feetY = pScreen.y + Config.TILE_HEIGHT / 2 * zoom - footOffset;
      this.postProcess.addOccluder({ x: pScreen.x, y: feetY, radius: Config.PLAYER_SHADOW_RADIUS * zoom, height: CHAR_DRAW_H * zoom });

      // Height fade for player — head stays lit when feet enter shadow
      const spriteH = CHAR_DRAW_H * zoom;
      const spriteW = CHAR_DRAW_W * zoom;
      this.postProcess.setHeightFade(
        pScreen.x,
        feetY,
        spriteW,
        spriteH,
        Config.SHADOW_HEIGHT_FADE,
      );

      this.postProcess.render(dt);
    }
  }
}
