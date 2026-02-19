import { Camera } from './Camera';
import { isoToScreen, depthOf } from './IsometricUtils';
import { assetLoader } from '../core/AssetLoader';
import { Config } from '../core/Config';
import type { Entity } from '../entities/Entity';
import { SnowfallEffect } from './effects/SnowfallEffect';
import { FogEffect } from './effects/FogEffect';

export const enum RenderLayer {
  GROUND = 0,
  OBJECT = 1,
}

export interface RenderItem {
  /** Render layer: ground tiles first, then objects/entities */
  layer: RenderLayer;
  /** World-pixel position (already iso-projected) */
  screenX: number;
  screenY: number;
  /** Depth for sorting within the same layer */
  depth: number;
  /** Asset id to draw */
  assetId: string;
  /** Source rect inside the asset (for sprite sheets) */
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  /** Destination offset from screenX/Y */
  offsetX: number;
  offsetY: number;
  /** Destination draw size */
  drawW: number;
  drawH: number;
  /** Draw opacity (0–1). Defaults to 1. */
  opacity: number;
  /** Rotation in radians around the anchor point. Defaults to 0. */
  rotation: number;
  /** When set, called instead of drawing the asset. Draws in screen space. */
  drawFn?: (ctx: CanvasRenderingContext2D) => void;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Camera;

  private renderQueue: RenderItem[] = [];

  /** Extracted visual effects */
  private snowfallEffect = new SnowfallEffect();
  private fogEffect = new FogEffect();

  constructor(container: HTMLElement, camera: Camera) {
    this.camera = camera;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const dpr = 1; // keep 1:1 for pixel art
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.camera.setViewport(this.canvas.width, this.canvas.height);
    // Pixel-perfect rendering
    this.ctx.imageSmoothingEnabled = false;
  }

  private bgColor = '#060812';

  /** Set background color (hex string or CSS color). */
  setBackgroundColor(color: string): void {
    this.bgColor = color;
  }

  /** Clear the canvas for a new frame */
  clear(): void {
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderQueue.length = 0;
  }

  /** Push a tile to the render queue (srcW/srcH = image pixels, drawW/drawH = grid-scaled size) */
  enqueueTile(col: number, row: number, assetId: string, srcW: number, srcH: number, drawW: number, drawH: number): void {
    const world = isoToScreen(col, row);
    this.renderQueue.push({
      layer: RenderLayer.GROUND,
      screenX: world.x,
      screenY: world.y,
      depth: depthOf(col, row, 0),
      assetId,
      srcX: 0, srcY: 0, srcW, srcH,
      // Tiles: anchor at top-center of diamond
      offsetX: -drawW / 2,
      offsetY: 0,
      drawW,
      drawH,
      opacity: 1,
      rotation: 0,
    });
  }

  /** Push an entity to the render queue (requires animController) */
  enqueueEntity(entity: Entity): void {
    const anim = entity.animController;
    if (!anim) return; // can't render without animation data

    const t = entity.transform;
    const world = isoToScreen(t.x, t.y);
    const frame = anim.getCurrentFrame();
    const assetId = anim.getCurrentAssetId();
    const s = entity.drawScale;

    const drawW = frame.width * s;
    const drawH = frame.height * s;

    this.renderQueue.push({
      layer: RenderLayer.OBJECT,
      screenX: world.x,
      screenY: world.y,
      depth: depthOf(t.x, t.y, 0),
      assetId,
      srcX: frame.x,
      srcY: frame.y,
      srcW: frame.width,
      srcH: frame.height,
      // Entities: anchor at center-bottom
      offsetX: -drawW / 2,
      offsetY: -drawH + Config.TILE_HEIGHT / 2 - t.z,
      drawW,
      drawH,
      opacity: entity.opacity,
      rotation: 0,
    });
  }

  /** Push a static object (tree, rock, building) to the render queue.
   *  srcW/srcH override the source-rect size (for high-res assets drawn at smaller world size). */
  enqueueObject(
    col: number, row: number,
    assetId: string,
    w: number, h: number,
    anchorY: number = 0.9,
    srcW?: number, srcH?: number,
    layer: RenderLayer = RenderLayer.OBJECT,
    rotation: number = 0,
    depthBias: number = 0,
  ): void {
    const world = isoToScreen(col, row);
    // Ground-layer objects: push depth to the sprite's visual bottom edge so
    // they sort after all tiles they overlap (sprite extends below center).
    const bottomRowOffset = layer === RenderLayer.GROUND
      ? (h * (1 - anchorY)) / Config.TILE_HEIGHT  // how many rows the sprite extends below center
      : 0;
    this.renderQueue.push({
      layer,
      screenX: world.x,
      screenY: world.y,
      depth: depthOf(col, row + bottomRowOffset, 0) + 0.01 + depthBias,
      assetId,
      srcX: 0, srcY: 0, srcW: srcW ?? w, srcH: srcH ?? h,
      offsetX: -w / 2,
      offsetY: -h * anchorY + Config.TILE_HEIGHT / 2,
      drawW: w,
      drawH: h,
      opacity: 1,
      rotation,
    });
  }

  /** Push a custom draw callback into the render queue, depth-sorted with other items. */
  enqueueCustomDraw(layer: RenderLayer, depth: number, drawFn: (ctx: CanvasRenderingContext2D) => void): void {
    this.renderQueue.push({
      layer, depth, drawFn,
      screenX: 0, screenY: 0,
      assetId: '', srcX: 0, srcY: 0, srcW: 0, srcH: 0,
      offsetX: 0, offsetY: 0, drawW: 0, drawH: 0,
      opacity: 1, rotation: 0,
    });
  }

  /** Sort and draw a specific layer only */
  flushLayer(layer: RenderLayer): void {
    // Sort within the requested layer by depth
    this.renderQueue.sort((a, b) => a.layer - b.layer || a.depth - b.depth);

    const cam = this.camera;
    const zoom = cam.zoom;

    for (const item of this.renderQueue) {
      if (item.layer !== layer) continue;

      // Custom draw callback — handles its own screen-space positioning
      if (item.drawFn) {
        item.drawFn(this.ctx);
        continue;
      }

      const asset = assetLoader.get(item.assetId);
      if (!asset) continue;

      const screen = cam.worldToScreen(item.screenX, item.screenY);
      const dx = screen.x + item.offsetX * zoom;
      const dy = screen.y + item.offsetY * zoom;
      const dw = item.drawW * zoom;
      const dh = item.drawH * zoom;

      // Frustum cull
      if (dx + dw < 0 || dx > this.canvas.width) continue;
      if (dy + dh < 0 || dy > this.canvas.height) continue;

      if (item.opacity < 1) this.ctx.globalAlpha = item.opacity;

      if (item.rotation !== 0) {
        // Rotate around the sprite's center
        const cx = dx + dw / 2;
        const cy = dy + dh / 2;
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(item.rotation);
        this.ctx.drawImage(
          asset as CanvasImageSource,
          item.srcX, item.srcY, item.srcW, item.srcH,
          -dw / 2, -dh / 2, dw, dh
        );
        this.ctx.restore();
      } else {
        this.ctx.drawImage(
          asset as CanvasImageSource,
          item.srcX, item.srcY, item.srcW, item.srcH,
          dx, dy, dw, dh
        );
      }

      if (item.opacity < 1) this.ctx.globalAlpha = 1;
    }
  }

  /**
   * Draw a soft elliptical "blob" shadow on the ground at a world position.
   * rx/ry are world-pixel radii (unscaled by zoom); opacity is 0-1.
   */
  drawBlobShadow(worldX: number, worldY: number, rx: number, ry: number, opacity: number): void {
    const cam = this.camera;
    const zoom = cam.zoom;
    const s = cam.worldToScreen(worldX, worldY);

    const srx = rx * zoom;
    const sry = ry * zoom;

    const ctx = this.ctx;
    ctx.save();
    ctx.translate(s.x, s.y + Config.TILE_HEIGHT / 2 * zoom);
    ctx.scale(1, sry / srx);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, srx);
    grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${opacity * 0.6})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, srx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw a soft radial glow beneath an entity at a world position.
   * Rendered with 'lighter' composite so it adds light rather than covering.
   */
  drawGlow(
    worldX: number, worldY: number, z: number,
    radius: number, r: number, g: number, b: number, opacity: number,
  ): void {
    const cam = this.camera;
    const zoom = cam.zoom;
    const s = cam.worldToScreen(worldX, worldY);
    const sr = radius * zoom;
    const sy = s.y + (Config.TILE_HEIGHT / 2 - z) * zoom;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const grad = ctx.createRadialGradient(s.x, sy, 0, s.x, sy, sr);
    grad.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},${opacity * 0.5})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ───────── Profile-driven effects ─────────

  /** Push lighting profile values into vignette, fog wisps, and snow.
   *  Call once per frame before drawing. */
  applyEffectProfile(profile: {
    vignetteR: number; vignetteG: number; vignetteB: number; vignetteOpacity: number;
    fogWispR: number; fogWispG: number; fogWispB: number; fogWispOpacity: number; fogWispAdditive: boolean;
    snowOpacity: number;
  }): void {
    this.fogEffect.applyVignetteProfile(
      profile.vignetteR, profile.vignetteG, profile.vignetteB, profile.vignetteOpacity,
    );
    this.fogEffect.applyWispProfile(
      profile.fogWispR, profile.fogWispG, profile.fogWispB, profile.fogWispOpacity, profile.fogWispAdditive,
    );
    this.snowfallEffect.opacity = profile.snowOpacity;
  }

  // ───────── Vignette + Fog (delegated to FogEffect) ─────────

  drawBoundaryVignette(cols: number, rows: number, side: 'back' | 'front' | 'all' = 'all'): void {
    this.fogEffect.drawBoundaryVignette(this.ctx, this.camera, this.canvas.width, this.canvas.height, cols, rows, side);
  }

  drawAnimatedEdgeFog(cols: number, rows: number, time: number, side: 'back' | 'front' | 'all' = 'all'): void {
    this.fogEffect.drawAnimatedEdgeFog(this.ctx, this.camera, cols, rows, time, side);
  }

  // ───────── Snowfall (delegated to SnowfallEffect) ─────────

  drawSnow(cols: number, rows: number, dt: number, time: number): void {
    this.snowfallEffect.draw(this.ctx, this.camera, this.canvas.width, this.canvas.height, cols, rows, dt, time);
  }

  /** Optional: draw grid overlay for debugging */
  drawGridOverlay(cols: number, rows: number): void {
    const cam = this.camera;
    const zoom = cam.zoom;
    this.ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    this.ctx.lineWidth = 1;

    for (let c = 0; c <= cols; c++) {
      for (let r = 0; r <= rows; r++) {
        const world = isoToScreen(c, r);
        const s = cam.worldToScreen(world.x, world.y);
        // Draw diamond outline for tile (c,r)
        if (c < cols && r < rows) {
          const top = cam.worldToScreen(world.x, world.y);
          const right = cam.worldToScreen(
            world.x + Config.TILE_WIDTH / 2,
            world.y + Config.TILE_HEIGHT / 2
          );
          const bottom = cam.worldToScreen(world.x, world.y + Config.TILE_HEIGHT);
          const left = cam.worldToScreen(
            world.x - Config.TILE_WIDTH / 2,
            world.y + Config.TILE_HEIGHT / 2
          );

          this.ctx.beginPath();
          this.ctx.moveTo(top.x, top.y);
          this.ctx.lineTo(right.x, right.y);
          this.ctx.lineTo(bottom.x, bottom.y);
          this.ctx.lineTo(left.x, left.y);
          this.ctx.closePath();
          this.ctx.stroke();
        }
      }
    }
  }
}
