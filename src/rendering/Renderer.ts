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

  /** Push a static object (tree, rock, building) to the render queue.
   *  srcW/srcH override the source-rect size (for high-res assets drawn at smaller world size). */
  enqueueObject(
    col: number, row: number,
    assetId: string,
    w: number, h: number,
    anchorY: number = 0.9,
    srcW?: number, srcH?: number,
  ): void {
    const world = isoToScreen(col, row);
    this.renderQueue.push({
      layer: RenderLayer.OBJECT,
      screenX: world.x,
      screenY: world.y,
      depth: depthOf(col, row, 0),
      assetId,
      srcX: 0, srcY: 0, srcW: srcW ?? w, srcH: srcH ?? h,
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
   * Draw dark fog around map boundaries using radial vignette + edge gradients.
   * @param side — 'back'  draws vignette + top/left gradients (behind objects)
   *               'front' draws bottom/right gradients (over objects)
   *               'all'   draws everything (legacy)
   */
  drawBoundaryFog(cols: number, rows: number, side: 'back' | 'front' | 'all' = 'all'): void {
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

    const st0 = cam.worldToScreen(topCorner.x, topCorner.y);
    const sr0 = cam.worldToScreen(rightCorner.x, rightCorner.y);
    const sb0 = cam.worldToScreen(bottomCorner.x, bottomCorner.y);
    const sl0 = cam.worldToScreen(leftCorner.x, leftCorner.y);

    // Apply padding — positive pushes fog edge inward toward map center
    const pad = Config.BOUNDARY_FOG_PADDING;
    const st = { x: st0.x,       y: st0.y + pad };   // top moves down
    const sb = { x: sb0.x,       y: sb0.y - pad };   // bottom moves up
    const sl = { x: sl0.x + pad, y: sl0.y };          // left moves right
    const sr = { x: sr0.x - pad, y: sr0.y };          // right moves left

    // Wide, soft fog — multiple overlapping passes for a smooth falloff
    const fogSize = 400;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    const backMult = Config.BOUNDARY_FOG_BACK_MULT;

    // --- Radial vignette centered on the map (back pass only) ---
    if (side === 'back' || side === 'all') {
      const cx = (sl.x + sr.x) / 2;
      const cy = (st.y + sb.y) / 2;
      const rx = Math.abs(sr.x - sl.x) / 2;
      const ry = Math.abs(sb.y - st.y) / 2;
      const maxR = Math.max(rx, ry, w, h);

      ctx.save();
      ctx.globalAlpha = backMult;
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
    }

    // --- Soft linear edge gradients (layered for extra softness) ---
    const drawTop    = side === 'back' || side === 'all';
    const drawLeft   = side === 'back' || side === 'all';
    const drawBottom = side === 'front' || side === 'all';
    const drawRight  = side === 'front' || side === 'all';

    const passes = [
      { size: fogSize, opacity: 0.7 },
      { size: fogSize * 0.7, opacity: 0.5 },
    ];

    for (const pass of passes) {
      const s = pass.size;

      // Top (back)
      if (drawTop) {
        const opT = pass.opacity * backMult;
        const aT = Math.round(opT * 255).toString(16).padStart(2, '0');
        const topY = st.y;
        const gT = ctx.createLinearGradient(0, topY - s, 0, topY + s);
        gT.addColorStop(0, bgColor + aT);
        gT.addColorStop(0.4, bgColor + aT);
        gT.addColorStop(1, 'transparent');
        ctx.fillStyle = gT;
        ctx.fillRect(0, 0, w, topY + s);
      }

      // Bottom (front)
      if (drawBottom) {
        const aB = Math.round(pass.opacity * 255).toString(16).padStart(2, '0');
        const botY = sb.y;
        const gB = ctx.createLinearGradient(0, botY - s, 0, botY + s);
        gB.addColorStop(0, 'transparent');
        gB.addColorStop(0.6, bgColor + aB);
        gB.addColorStop(1, bgColor + aB);
        ctx.fillStyle = gB;
        ctx.fillRect(0, botY - s, w, h - botY + s * 2);
      }

      // Left (back)
      if (drawLeft) {
        const opL = pass.opacity * backMult;
        const aL = Math.round(opL * 255).toString(16).padStart(2, '0');
        const leftX = sl.x;
        const gL = ctx.createLinearGradient(leftX - s, 0, leftX + s, 0);
        gL.addColorStop(0, bgColor + aL);
        gL.addColorStop(0.4, bgColor + aL);
        gL.addColorStop(1, 'transparent');
        ctx.fillStyle = gL;
        ctx.fillRect(0, 0, leftX + s, h);
      }

      // Right (front)
      if (drawRight) {
        const aR = Math.round(pass.opacity * 255).toString(16).padStart(2, '0');
        const rightX = sr.x;
        const gR = ctx.createLinearGradient(rightX - s, 0, rightX + s, 0);
        gR.addColorStop(0, 'transparent');
        gR.addColorStop(0.6, bgColor + aR);
        gR.addColorStop(1, bgColor + aR);
        ctx.fillStyle = gR;
        ctx.fillRect(rightX - s, 0, w - rightX + s * 2, h);
      }
    }

    ctx.restore();
  }

  /**
   * Animated fog wisps drifting near map edges.
   * @param side — 'back' draws only the far edges (top-right, left-top)
   *               'front' draws only the near edges (right-bottom, bottom-left)
   *               'all' draws everything (legacy)
   * Back wisps should be drawn BEFORE objects so they're occluded;
   * front wisps AFTER objects so they overlay the scene.
   */
  drawAnimatedEdgeFog(cols: number, rows: number, time: number, side: 'back' | 'front' | 'all' = 'all'): void {
    const cam = this.camera;
    const ctx = this.ctx;

    // Map corners → screen space (with fog padding)
    const iTop = isoToScreen(0, 0);
    const iRight = isoToScreen(cols, 0);
    const iBot = isoToScreen(cols, rows);
    const iLeft = isoToScreen(0, rows);
    const st0 = cam.worldToScreen(iTop.x, iTop.y);
    const sr0 = cam.worldToScreen(iRight.x, iRight.y);
    const sb0 = cam.worldToScreen(iBot.x, iBot.y);
    const sl0 = cam.worldToScreen(iLeft.x, iLeft.y);

    const pad = Config.BOUNDARY_FOG_PADDING;
    const st = { x: st0.x,       y: st0.y + pad };
    const sr = { x: sr0.x - pad, y: sr0.y };
    const sb = { x: sb0.x,       y: sb0.y - pad };
    const sl = { x: sl0.x + pad, y: sl0.y };

    const mcx = (sl.x + sr.x) / 2;
    const mcy = (st.y + sb.y) / 2;

    // All 4 edges clockwise: 0=top-right, 1=right-bottom, 2=bottom-left, 3=left-top
    const allEdges = [
      { sx: st.x, sy: st.y, ex: sr.x, ey: sr.y },  // 0 top-right  (back)
      { sx: sr.x, sy: sr.y, ex: sb.x, ey: sb.y },  // 1 right-bottom (front)
      { sx: sb.x, sy: sb.y, ex: sl.x, ey: sl.y },  // 2 bottom-left  (front)
      { sx: sl.x, sy: sl.y, ex: st.x, ey: st.y },  // 3 left-top     (back)
    ];

    // Pick which edges to draw based on side
    let edgeIndices: number[];
    if (side === 'back')       edgeIndices = [0, 3];
    else if (side === 'front') edgeIndices = [1, 2];
    else                       edgeIndices = [0, 1, 2, 3];

    const wispsPerEdge = Config.FOG_WISPS_PER_EDGE;
    const baseSize = Config.FOG_WISP_SIZE;
    const maxOp = Config.FOG_WISP_OPACITY;
    const backMult = Config.BOUNDARY_FOG_BACK_MULT;
    const driftSpd = Config.FOG_WISP_DRIFT_SPEED;
    const breathSpd = Config.FOG_WISP_BREATH_SPEED;
    const reach = Config.FOG_WISP_REACH;
    const backEdges = new Set([0, 3]);  // top-right, left-top

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';  // additive blend so wisps glow

    for (const ei of edgeIndices) {
      const e = allEdges[ei];
      const edx = e.ex - e.sx;
      const edy = e.ey - e.sy;
      const elen = Math.sqrt(edx * edx + edy * edy);
      const tx = edx / elen;
      const ty = edy / elen;

      for (let i = 0; i < wispsPerEdge; i++) {
        // Deterministic phase per wisp (golden ratio spread)
        const phase = (ei * wispsPerEdge + i) * 2.399;

        // Position along edge 0→1 (staggered)
        const along = (i + 0.5) / wispsPerEdge;
        const bx = e.sx + edx * along;
        const by = e.sy + edy * along;

        // Lateral drift along edge
        const drift = Math.sin(time * driftSpd + phase) * 50;

        // Inward oscillation toward map center
        const inX = mcx - bx;
        const inY = mcy - by;
        const inLen = Math.sqrt(inX * inX + inY * inY) || 1;
        const osc = Math.sin(time * driftSpd * 0.7 + phase * 2.1) * reach;

        const wx = bx + tx * drift + (inX / inLen) * osc;
        const wy = by + ty * drift + (inY / inLen) * osc;

        // Opacity breathing (back edges are dimmed by backMult)
        const breathe = 0.5 + 0.5 * Math.sin(time * breathSpd + phase * 3.7);
        const edgeMult = backEdges.has(ei) ? backMult : 1;
        const opacity = maxOp * edgeMult * (0.3 + 0.7 * breathe);

        // Size variation per wisp
        const sz = baseSize * (0.7 + 0.3 * Math.sin(phase * 5.3));

        // Stretch ellipse along the edge tangent for a wispy shape
        ctx.save();
        ctx.translate(wx, wy);
        const angle = Math.atan2(ty, tx);
        ctx.rotate(angle);
        ctx.scale(1.6, 1);   // elongate along edge

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, sz);
        grad.addColorStop(0,   `rgba(120,140,170,${opacity})`);
        grad.addColorStop(0.4, `rgba(80,100,130,${opacity * 0.5})`);
        grad.addColorStop(1,   'rgba(40,55,75,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
