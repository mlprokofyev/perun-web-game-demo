import { Camera } from '../Camera';
import { isoToScreen } from '../IsometricUtils';
import { Config } from '../../core/Config';

type FogSide = 'back' | 'front' | 'all';

/** Convert 0-1 RGB to a CSS hex color string */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Two independent visual layers:
 *   1. **Boundary vignette** — static radial darkening + edge gradients (framing).
 *   2. **Animated edge fog** — drifting wisps simulating atmospheric fog (weather).
 *
 * Each has its own color, opacity, and (for wisps) blend mode, all driven
 * per-frame from the active LightingProfile.
 */
export class FogEffect {

  // ── Vignette state ──────────────────────────────
  private vignetteColor = '#060812';
  private vignetteOpacity = 1.0;

  // ── Wisp state ──────────────────────────────────
  private wispR255 = 6;
  private wispG255 = 8;
  private wispB255 = 18;
  private wispOpacity = 1.0;
  private wispAdditive = true;

  // ── Apply profile ───────────────────────────────

  /** Push vignette params from the active lighting profile. */
  applyVignetteProfile(r: number, g: number, b: number, opacity: number): void {
    this.vignetteColor = rgbToHex(r, g, b);
    this.vignetteOpacity = opacity;
  }

  /** Push wisp params from the active lighting profile. */
  applyWispProfile(r: number, g: number, b: number, opacity: number, additive: boolean): void {
    this.wispR255 = Math.round(r * 255);
    this.wispG255 = Math.round(g * 255);
    this.wispB255 = Math.round(b * 255);
    this.wispOpacity = opacity;
    this.wispAdditive = additive;
  }

  // ── 1. Boundary vignette ────────────────────────

  /**
   * Draw static vignette around map boundaries (radial + edge gradients).
   * @param side — 'back'  draws vignette + top/left gradients (behind objects)
   *               'front' draws bottom/right gradients (over objects)
   *               'all'   draws everything (legacy)
   */
  drawBoundaryVignette(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    canvasW: number,
    canvasH: number,
    cols: number,
    rows: number,
    side: FogSide = 'all',
  ): void {
    if (this.vignetteOpacity < 0.001) return;
    const w = canvasW;
    const h = canvasH;

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
    const color = this.vignetteColor;
    const op = this.vignetteOpacity;

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
      ctx.globalAlpha = backMult * op;
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx || 1);
      const radGrad = ctx.createRadialGradient(0, 0, rx * 0.55, 0, 0, rx * 1.1);
      radGrad.addColorStop(0, 'transparent');
      radGrad.addColorStop(0.5, 'transparent');
      radGrad.addColorStop(0.75, color + '80');
      radGrad.addColorStop(1, color);
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
        const opT = pass.opacity * backMult * op;
        const aT = Math.round(opT * 255).toString(16).padStart(2, '0');
        const topY = st.y;
        const gT = ctx.createLinearGradient(0, topY - s, 0, topY + s);
        gT.addColorStop(0, color + aT);
        gT.addColorStop(0.4, color + aT);
        gT.addColorStop(1, 'transparent');
        ctx.fillStyle = gT;
        ctx.fillRect(0, 0, w, topY + s);
      }

      // Bottom (front)
      if (drawBottom) {
        const aB = Math.round(pass.opacity * op * 255).toString(16).padStart(2, '0');
        const botY = sb.y;
        const gB = ctx.createLinearGradient(0, botY - s, 0, botY + s);
        gB.addColorStop(0, 'transparent');
        gB.addColorStop(0.6, color + aB);
        gB.addColorStop(1, color + aB);
        ctx.fillStyle = gB;
        ctx.fillRect(0, botY - s, w, h - botY + s * 2);
      }

      // Left (back)
      if (drawLeft) {
        const opL = pass.opacity * backMult * op;
        const aL = Math.round(opL * 255).toString(16).padStart(2, '0');
        const leftX = sl.x;
        const gL = ctx.createLinearGradient(leftX - s, 0, leftX + s, 0);
        gL.addColorStop(0, color + aL);
        gL.addColorStop(0.4, color + aL);
        gL.addColorStop(1, 'transparent');
        ctx.fillStyle = gL;
        ctx.fillRect(0, 0, leftX + s, h);
      }

      // Right (front)
      if (drawRight) {
        const aR = Math.round(pass.opacity * op * 255).toString(16).padStart(2, '0');
        const rightX = sr.x;
        const gR = ctx.createLinearGradient(rightX - s, 0, rightX + s, 0);
        gR.addColorStop(0, 'transparent');
        gR.addColorStop(0.6, color + aR);
        gR.addColorStop(1, color + aR);
        ctx.fillStyle = gR;
        ctx.fillRect(rightX - s, 0, w - rightX + s * 2, h);
      }
    }

    ctx.restore();
  }

  // ── 2. Animated edge fog ────────────────────────

  /**
   * Animated fog wisps drifting near map edges.
   * @param side — 'back' draws only the far edges (top-right, left-top)
   *               'front' draws only the near edges (right-bottom, bottom-left)
   *               'all' draws everything (legacy)
   */
  drawAnimatedEdgeFog(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    cols: number,
    rows: number,
    time: number,
    side: FogSide = 'all',
  ): void {
    if (this.wispOpacity < 0.001) return;

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
    const maxOp = Config.FOG_WISP_OPACITY * this.wispOpacity;
    const backMult = Config.BOUNDARY_FOG_BACK_MULT;
    const driftSpd = Config.FOG_WISP_DRIFT_SPEED;
    const breathSpd = Config.FOG_WISP_BREATH_SPEED;
    const reach = Config.FOG_WISP_REACH;
    const backEdges = new Set([0, 3]);  // top-right, left-top

    // Precompute wisp gradient colors from profile color
    const baseR = this.wispR255;
    const baseG = this.wispG255;
    const baseB = this.wispB255;

    // For additive mode: brighten from dark base → visible glow on dark bg
    // For normal mode:   use the color directly as semi-transparent fog patches
    const brightR = this.wispAdditive ? Math.min(255, baseR + 110) : baseR;
    const brightG = this.wispAdditive ? Math.min(255, baseG + 130) : baseG;
    const brightB = this.wispAdditive ? Math.min(255, baseB + 140) : baseB;
    const midR    = this.wispAdditive ? Math.min(255, baseR + 70)  : Math.max(0, baseR - 15);
    const midG    = this.wispAdditive ? Math.min(255, baseG + 90)  : Math.max(0, baseG - 15);
    const midB    = this.wispAdditive ? Math.min(255, baseB + 100) : Math.max(0, baseB - 15);
    const dimR    = this.wispAdditive ? Math.min(255, baseR + 35)  : Math.max(0, baseR - 30);
    const dimG    = this.wispAdditive ? Math.min(255, baseG + 45)  : Math.max(0, baseG - 30);
    const dimB    = this.wispAdditive ? Math.min(255, baseB + 55)  : Math.max(0, baseB - 30);

    ctx.save();
    ctx.globalCompositeOperation = this.wispAdditive ? 'lighter' : 'source-over';

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
        grad.addColorStop(0,   `rgba(${brightR},${brightG},${brightB},${opacity})`);
        grad.addColorStop(0.4, `rgba(${midR},${midG},${midB},${opacity * 0.5})`);
        grad.addColorStop(1,   `rgba(${dimR},${dimG},${dimB},0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
