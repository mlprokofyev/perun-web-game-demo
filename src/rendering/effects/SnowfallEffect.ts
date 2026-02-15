import { Camera } from '../Camera';
import { isoToScreen } from '../IsometricUtils';
import { Config } from '../../core/Config';

/** Internal snowflake particle — lives in world space */
interface Snowflake {
  wx: number;      // world-pixel X (isometric projected ground position)
  wy: number;      // world-pixel Y (isometric projected ground position)
  z: number;       // height above the ground plane (world px, decreases as it falls)
  radius: number;  // screen-space visual radius (px, zoom-independent)
  speed: number;   // individual fall-speed multiplier (0.4–1.0)
  opacity: number; // peak opacity for this flake
  phase: number;   // wobble phase offset (radians)
}

/**
 * Self-contained snowfall particle system.
 * Snowflakes exist in world space and are projected through the Camera.
 */
export class SnowfallEffect {
  private snowflakes: Snowflake[] = [];
  private inited = false;
  /** Pre-rendered snowflake sprites (one per depth layer) for perf */
  private sprites: HTMLCanvasElement[] = [];
  /** World-space bounding box for snowflake spawning (cached on init) */
  private bounds = { minWx: 0, maxWx: 0, minWy: 0, maxWy: 0 };

  /** Opacity multiplier (0-1). Driven by the active LightingProfile. */
  opacity = 1.0;

  /** Initialise snowflake pool — positions are in world space. */
  init(cols: number, rows: number): void {
    const count = Config.SNOW_PARTICLE_COUNT;
    const layers = Config.SNOW_DEPTH_LAYERS;
    const minR = Config.SNOW_MIN_SIZE;
    const maxR = Config.SNOW_MAX_SIZE;
    const maxOp = Config.SNOW_OPACITY;
    const maxH = Config.SNOW_MAX_HEIGHT;
    const pad = Config.SNOW_SPAWN_PADDING;

    // Compute world-space bounding box of the map diamond + padding
    const topCorner    = isoToScreen(-pad, -pad);
    const rightCorner  = isoToScreen(cols + pad, -pad);
    const bottomCorner = isoToScreen(cols + pad, rows + pad);
    const leftCorner   = isoToScreen(-pad, rows + pad);

    const bounds = this.bounds;
    bounds.minWx = leftCorner.x;
    bounds.maxWx = rightCorner.x;
    bounds.minWy = topCorner.y;
    bounds.maxWy = bottomCorner.y;

    this.snowflakes.length = 0;

    for (let i = 0; i < count; i++) {
      const layer = i % layers;
      const t = layers > 1 ? layer / (layers - 1) : 1; // 0 = far, 1 = near

      const radius  = minR + (maxR - minR) * t;
      const speed   = 0.4 + 0.6 * t;                    // far = slow, near = fast
      const opacity = maxOp * (0.3 + 0.7 * t);          // far = dim, near = bright

      this.snowflakes.push({
        wx: bounds.minWx + Math.random() * (bounds.maxWx - bounds.minWx),
        wy: bounds.minWy + Math.random() * (bounds.maxWy - bounds.minWy),
        z: Math.random() * maxH,
        radius,
        speed,
        opacity,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Pre-render snowflake sprites — one per depth layer
    this.sprites.length = 0;
    for (let l = 0; l < layers; l++) {
      const lt = layers > 1 ? l / (layers - 1) : 1;
      const r = minR + (maxR - minR) * lt;
      const op = maxOp * (0.3 + 0.7 * lt);
      const size = Math.ceil(r * 2) + 2; // +2 for antialiasing margin
      const offscreen = document.createElement('canvas');
      offscreen.width = size;
      offscreen.height = size;
      const oc = offscreen.getContext('2d')!;
      const cx = size / 2;
      const grad = oc.createRadialGradient(cx, cx, 0, cx, cx, r);
      grad.addColorStop(0,   `rgba(255,255,255,${op})`);
      grad.addColorStop(0.5, `rgba(230,235,255,${op * 0.5})`);
      grad.addColorStop(1,   'rgba(200,210,230,0)');
      oc.fillStyle = grad;
      oc.beginPath();
      oc.arc(cx, cx, r, 0, Math.PI * 2);
      oc.fill();
      this.sprites.push(offscreen);
    }

    this.inited = true;
  }

  /**
   * Update physics and draw snowfall particles.
   * @param ctx    canvas 2D context to draw into
   * @param cam    camera for world→screen projection
   * @param canvasW canvas width (for frustum culling)
   * @param canvasH canvas height (for frustum culling)
   * @param cols   map columns
   * @param rows   map rows
   * @param dt     frame delta (seconds)
   * @param time   total elapsed time (seconds)
   */
  draw(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    canvasW: number,
    canvasH: number,
    cols: number,
    rows: number,
    dt: number,
    time: number,
  ): void {
    if (!Config.SNOW_ENABLED) return;
    if (this.opacity < 0.001) return;
    if (!this.inited) this.init(cols, rows);

    const layers = Config.SNOW_DEPTH_LAYERS;
    const baseFall  = Config.SNOW_FALL_SPEED;
    const wind      = Config.SNOW_WIND_SPEED;
    const wobbleSpd = Config.SNOW_WOBBLE_SPEED;
    const wobbleAmp = Config.SNOW_WOBBLE_AMP;
    const maxH      = Config.SNOW_MAX_HEIGHT;
    const bounds    = this.bounds;
    const bw = bounds.maxWx - bounds.minWx;
    const bh = bounds.maxWy - bounds.minWy;

    ctx.save();
    ctx.globalAlpha = this.opacity;

    for (const f of this.snowflakes) {
      // ── Physics update (world space) ──
      f.z  -= baseFall * f.speed * dt;
      f.wx += wind * f.speed * dt;
      f.wx += Math.sin(time * wobbleSpd + f.phase) * wobbleAmp * f.speed * dt;

      // Respawn at top when flake reaches ground
      if (f.z <= 0) {
        f.z = maxH + Math.random() * 50;
        f.wx = bounds.minWx + Math.random() * bw;
        f.wy = bounds.minWy + Math.random() * bh;
      }

      // Wrap horizontally when drifting out of bounds
      if (f.wx > bounds.maxWx) f.wx -= bw;
      else if (f.wx < bounds.minWx) f.wx += bw;

      // ── Project to screen ──
      const scr = cam.worldToScreen(f.wx, f.wy - f.z);

      // Frustum cull
      if (scr.x < -10 || scr.x > canvasW + 10 || scr.y < -10 || scr.y > canvasH + 10) continue;

      // ── Draw using pre-rendered sprite ──
      const layerIdx = Math.round(
        (f.radius - Config.SNOW_MIN_SIZE) /
        (Config.SNOW_MAX_SIZE - Config.SNOW_MIN_SIZE) *
        (layers - 1),
      );
      const sprite = this.sprites[Math.min(layerIdx, this.sprites.length - 1)];
      if (sprite) {
        ctx.drawImage(
          sprite,
          scr.x - sprite.width / 2,
          scr.y - sprite.height / 2,
        );
      }
    }

    ctx.restore();
  }
}
