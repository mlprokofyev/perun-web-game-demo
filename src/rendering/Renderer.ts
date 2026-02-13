import { Camera } from './Camera';
import { isoToScreen, depthOf } from './IsometricUtils';
import { assetLoader } from '../core/AssetLoader';
import { Config } from '../core/Config';
import type { Entity } from '../entities/Entity';

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
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Camera;

  private renderQueue: RenderItem[] = [];

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

  private static readonly BG_COLOR = '#060812';

  /** Clear the canvas for a new frame */
  clear(): void {
    this.ctx.fillStyle = Renderer.BG_COLOR;
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
    });
  }

  /** Push an entity to the render queue */
  enqueueEntity(entity: Entity): void {
    const t = entity.transform;
    const world = isoToScreen(t.x, t.y);
    const anim = entity.animController;
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
    });
  }

  /** Push a static object (tree, rock, building) to the render queue */
  enqueueObject(
    col: number, row: number,
    assetId: string,
    w: number, h: number,
    anchorY: number = 0.9
  ): void {
    const world = isoToScreen(col, row);
    this.renderQueue.push({
      layer: RenderLayer.OBJECT,
      screenX: world.x,
      screenY: world.y,
      depth: depthOf(col, row, 0),
      assetId,
      srcX: 0, srcY: 0, srcW: w, srcH: h,
      offsetX: -w / 2,
      offsetY: -h * anchorY + Config.TILE_HEIGHT / 2,
      drawW: w,
      drawH: h,
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

      this.ctx.drawImage(
        asset as CanvasImageSource,
        item.srcX, item.srcY, item.srcW, item.srcH,
        dx, dy, dw, dh
      );
    }
  }

  /** Draw dark fog around map boundaries using radial vignette + edge gradients */
  drawBoundaryFog(cols: number, rows: number): void {
    const cam = this.camera;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const bgColor = Renderer.BG_COLOR;

    // Compute screen-space center and extents of the map diamond
    const topCorner = isoToScreen(0, 0);
    const rightCorner = isoToScreen(cols, 0);
    const bottomCorner = isoToScreen(cols, rows);
    const leftCorner = isoToScreen(0, rows);

    const st = cam.worldToScreen(topCorner.x, topCorner.y);
    const sr = cam.worldToScreen(rightCorner.x, rightCorner.y);
    const sb = cam.worldToScreen(bottomCorner.x, bottomCorner.y);
    const sl = cam.worldToScreen(leftCorner.x, leftCorner.y);

    // Wide, soft fog — multiple overlapping passes for a smooth falloff
    const fogSize = 400;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // --- Radial vignette centered on the map ---
    const cx = (sl.x + sr.x) / 2;
    const cy = (st.y + sb.y) / 2;
    const rx = Math.abs(sr.x - sl.x) / 2;
    const ry = Math.abs(sb.y - st.y) / 2;
    const maxR = Math.max(rx, ry, w, h);

    // Elliptical vignette via scaling
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx || 1);
    const radGrad = ctx.createRadialGradient(0, 0, rx * 0.55, 0, 0, rx * 1.1);
    radGrad.addColorStop(0, 'transparent');
    radGrad.addColorStop(0.5, 'transparent');
    radGrad.addColorStop(0.75, bgColor + '80');
    radGrad.addColorStop(1, bgColor);
    ctx.fillStyle = radGrad;
    ctx.fillRect(-maxR, -maxR / (ry / rx || 1), maxR * 2, maxR * 2 / (ry / rx || 1));
    ctx.restore();

    // --- Soft linear edge gradients (layered for extra softness) ---
    const passes = [
      { size: fogSize, opacity: 0.7 },
      { size: fogSize * 0.6, opacity: 0.5 },
    ];

    for (const pass of passes) {
      const s = pass.size;
      const a = Math.round(pass.opacity * 255).toString(16).padStart(2, '0');
      const fogOuter = bgColor + a;

      // Top
      const topY = st.y;
      const gT = ctx.createLinearGradient(0, topY - s, 0, topY + s);
      gT.addColorStop(0, fogOuter);
      gT.addColorStop(0.4, fogOuter);
      gT.addColorStop(1, 'transparent');
      ctx.fillStyle = gT;
      ctx.fillRect(0, 0, w, topY + s);

      // Bottom
      const botY = sb.y;
      const gB = ctx.createLinearGradient(0, botY - s, 0, botY + s);
      gB.addColorStop(0, 'transparent');
      gB.addColorStop(0.6, fogOuter);
      gB.addColorStop(1, fogOuter);
      ctx.fillStyle = gB;
      ctx.fillRect(0, botY - s, w, h - botY + s * 2);

      // Left
      const leftX = sl.x;
      const gL = ctx.createLinearGradient(leftX - s, 0, leftX + s, 0);
      gL.addColorStop(0, fogOuter);
      gL.addColorStop(0.4, fogOuter);
      gL.addColorStop(1, 'transparent');
      ctx.fillStyle = gL;
      ctx.fillRect(0, 0, leftX + s, h);

      // Right
      const rightX = sr.x;
      const gR = ctx.createLinearGradient(rightX - s, 0, rightX + s, 0);
      gR.addColorStop(0, 'transparent');
      gR.addColorStop(0.6, fogOuter);
      gR.addColorStop(1, fogOuter);
      ctx.fillStyle = gR;
      ctx.fillRect(rightX - s, 0, w - rightX + s * 2, h);
    }

    ctx.restore();
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
