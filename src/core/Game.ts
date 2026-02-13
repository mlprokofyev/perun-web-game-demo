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
  private elapsed: number = 0;
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
      Config.PLAYER_START_COL,
      Config.PLAYER_START_ROW,
    );

    // Determine if we have a real character sprite loaded
    const hasRealChar = assetLoader.has('char_idle');

    // All 8 directions (4 cardinal + 4 diagonal)
    const directions = [
      'south', 'north', 'east', 'west',
      'south_east', 'south_west', 'north_east', 'north_west',
    ];

    // Helper: derive frame count from sheet width / frame width
    const frameCountOf = (assetId: string, frameW: number): number => {
      const size = assetLoader.getSize(assetId);
      if (!size) return 1;
      return Math.max(1, Math.floor(size.width / frameW));
    };

    // Register player animations (frameWidth/Height = source pixel size)
    for (const dir of directions) {
      if (hasRealChar) {
        // Idle: use real idle sprite for all directions (single pose for now)
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

        // Walk: use direction-specific asset if loaded, otherwise fall back to idle
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
        // Fallback to procedural assets (only 4 cardinal directions available)
        const procDir = dir.includes('_') ? dir.split('_')[0] : dir; // diagonal → nearest cardinal
        const procWalk = `char_walk_${procDir}`;
        const procIdle = `char_idle_${procDir}`;
        const walkDef: AnimationDef = {
          assetId: procWalk,
          frameWidth: 32,
          frameHeight: 48,
          frameCount: frameCountOf(procWalk, 32),
          frameRate: 8,
          loop: true,
        };
        this.player.animController.addAnimation(`walk_${dir}`, walkDef);
        const idleDef: AnimationDef = {
          assetId: procIdle,
          frameWidth: 32,
          frameHeight: 48,
          frameCount: frameCountOf(procIdle, 32),
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
      );
    }

    // Enqueue player
    this.renderer.enqueueEntity(this.player);

    // 1) Draw ground tiles
    this.renderer.flushLayer(RenderLayer.GROUND);

    // 2) Back boundary fog + back animated wisps — behind objects
    this.renderer.drawBoundaryFog(this.tileMap.cols, this.tileMap.rows, 'back');
    this.renderer.drawAnimatedEdgeFog(this.tileMap.cols, this.tileMap.rows, this.elapsed, 'back');

    // 3) Blob shadow under the player (on ground, before objects)
    const pIsoShadow = isoToScreen(this.player.transform.x, this.player.transform.y);
    this.renderer.drawBlobShadow(
      pIsoShadow.x, pIsoShadow.y,
      Config.PLAYER_BLOB_SHADOW_RX,
      Config.PLAYER_BLOB_SHADOW_RY,
      Config.PLAYER_BLOB_SHADOW_OPACITY,
    );

    // 4) Draw objects & entities
    this.renderer.flushLayer(RenderLayer.OBJECT);

    // 5) Front boundary fog + front animated wisps — over objects
    this.renderer.drawBoundaryFog(this.tileMap.cols, this.tileMap.rows, 'front');
    this.renderer.drawAnimatedEdgeFog(this.tileMap.cols, this.tileMap.rows, this.elapsed, 'front');

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
        intensity: Config.WINDOW_LIGHT_INTENSITY,
        flicker: Config.WINDOW_LIGHT_FLICKER,
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
            Config.VOLUMETRIC_RIM_R,
            Config.VOLUMETRIC_RIM_G,
            Config.VOLUMETRIC_RIM_B,
          );
        }
      } else {
        this.postProcess.clearVolumetric();
      }

      this.postProcess.render(dt);
    }
  }
}
