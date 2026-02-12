import { Config } from './Config';
import { Camera } from '../rendering/Camera';
import { Renderer, RenderLayer } from '../rendering/Renderer';
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

/** Character sprite dimensions */
const CHAR_W = 128;
const CHAR_H = 128;

export class Game {
  private camera: Camera;
  private renderer: Renderer;
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
    this.input = new InputSystem(this.renderer.canvas, this.camera);
    this.physics = new PhysicsSystem(tileMap);
    this.animationSystem = new AnimationSystem();
    this.hud = new HUD();

    // Create player
    this.player = new Player();
    this.player.transform.set(
      Math.floor(tileMap.cols / 2),
      Math.floor(tileMap.rows / 2)
    );

    // Determine if we have a real character sprite loaded
    const hasRealChar = assetLoader.has('char_idle');

    // Register player animations
    const directions = ['south', 'north', 'east', 'west'];
    for (const dir of directions) {
      if (hasRealChar) {
        // Use real idle sprite for all directions (single image, no walk sheet yet)
        const idleDef: AnimationDef = {
          assetId: 'char_idle',
          frameWidth: CHAR_W,
          frameHeight: CHAR_H,
          frameCount: 1,
          frameRate: 1,
          loop: true,
        };
        this.player.animController.addAnimation(`idle_${dir}`, idleDef);
        // Also use idle for walk until walk sheets are provided
        const walkDef: AnimationDef = {
          assetId: 'char_idle',
          frameWidth: CHAR_W,
          frameHeight: CHAR_H,
          frameCount: 1,
          frameRate: 8,
          loop: true,
        };
        this.player.animController.addAnimation(`walk_${dir}`, walkDef);
      } else {
        // Fallback to procedural assets
        const walkDef: AnimationDef = {
          assetId: `char_walk_${dir}`,
          frameWidth: 32,
          frameHeight: 48,
          frameCount: 4,
          frameRate: 8,
          loop: true,
        };
        this.player.animController.addAnimation(`walk_${dir}`, walkDef);
        const idleDef: AnimationDef = {
          assetId: `char_idle_${dir}`,
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
    this.render();

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

  private render(): void {
    this.renderer.clear();

    // Enqueue ground tiles (real tiles are 64×37)
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
  }
}
