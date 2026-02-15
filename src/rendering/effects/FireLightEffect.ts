/**
 * Realistic fire-light flicker effect.
 *
 * Produces per-frame modulated `intensity`, `radius`, and `color` values
 * by layering three noise components:
 *   1. **Breath** — slow sinusoidal pulse (fire surges)
 *   2. **Wobble** — medium-frequency irregular oscillation
 *   3. **Crackle** — fast stochastic jitter (sparks / air pops)
 *
 * Reusable for campfires, torches, candles, braziers, etc.
 * Each instance maintains its own phase so multiple fires don't sync.
 *
 * Usage:
 * ```ts
 * const flicker = new FireLightEffect({ ...overrides });
 * // every frame:
 * flicker.update(dt);
 * postProcess.addLight({
 *   ...baseLight,
 *   intensity: baseIntensity * flicker.intensity,
 *   radius:    baseRadius    * flicker.radius,
 *   r: flicker.r, g: flicker.g, b: flicker.b,
 * });
 * ```
 */

export interface FireLightConfig {
  // ── Breath (slow pulse) ──────────────────────────────
  /** Breath frequency in Hz (full cycles per second). Default 0.4 */
  breathFreq?: number;
  /** Breath amplitude — fraction of base intensity/radius. Default 0.12 */
  breathAmp?: number;

  // ── Wobble (medium irregularity) ─────────────────────
  /** Wobble frequency in Hz. Default 1.8 */
  wobbleFreq?: number;
  /** Wobble amplitude. Default 0.08 */
  wobbleAmp?: number;

  // ── Crackle (fast random jitter) ─────────────────────
  /** Crackle frequency — new random value this many times/s. Default 12 */
  crackleRate?: number;
  /** Crackle amplitude. Default 0.10 */
  crackleAmp?: number;

  // ── Radius modulation ────────────────────────────────
  /** How much the radius follows the intensity flicker (0 = fixed, 1 = same). Default 0.5 */
  radiusFollow?: number;

  // ── Color shift ──────────────────────────────────────
  /** Base RGB (0-1). Fire dims toward red, brightens toward yellow-white. */
  baseR?: number;
  baseG?: number;
  baseB?: number;
  /** How much the color shifts with intensity (0 = fixed, 1 = full shift). Default 0.3
   *  On dim: shifts toward red. On bright: shifts toward yellow-white. */
  colorShift?: number;
}

const DEFAULTS: Required<FireLightConfig> = {
  breathFreq: 0.4,
  breathAmp: 0.12,
  wobbleFreq: 1.8,
  wobbleAmp: 0.08,
  crackleRate: 12,
  crackleAmp: 0.10,
  radiusFollow: 0.5,
  baseR: 1.0,
  baseG: 0.55,
  baseB: 0.12,
  colorShift: 0.3,
};

export class FireLightEffect {
  private cfg: Required<FireLightConfig>;

  // Internal phase accumulators
  private time = 0;
  private crackleAccum = 0;
  private crackleValue = 0;
  private wobblePhase: number;

  // ── Public output — read after update() ──────────────
  /** Intensity multiplier (centered around 1.0). Multiply with your base intensity. */
  intensity = 1;
  /** Radius multiplier (centered around 1.0). Multiply with your base radius. */
  radius = 1;
  /** Modulated color components (0-1). Already includes color shift. */
  r = 1;
  g = 0.55;
  b = 0.12;

  constructor(config?: FireLightConfig) {
    this.cfg = { ...DEFAULTS, ...config };
    // Randomise initial phase so multiple instances don't pulse in sync
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.time = Math.random() * 100;
    this.crackleValue = (Math.random() - 0.5) * 2; // -1..1
  }

  /** Reconfigure on the fly (partial updates allowed). */
  configure(config: FireLightConfig): void {
    Object.assign(this.cfg, config);
  }

  /** Advance the effect. Call once per frame with delta-time in seconds. */
  update(dt: number): void {
    this.time += dt;
    const c = this.cfg;

    // 1. Breath — smooth sinusoidal
    const breath = Math.sin(this.time * c.breathFreq * Math.PI * 2) * c.breathAmp;

    // 2. Wobble — two offset sines for irregularity
    const wobble = (
      Math.sin(this.time * c.wobbleFreq * Math.PI * 2 + this.wobblePhase) * 0.6 +
      Math.sin(this.time * c.wobbleFreq * Math.PI * 2 * 1.7 + this.wobblePhase + 2.3) * 0.4
    ) * c.wobbleAmp;

    // 3. Crackle — sample-and-hold noise at crackleRate Hz
    this.crackleAccum += dt;
    const crackleInterval = 1 / c.crackleRate;
    if (this.crackleAccum >= crackleInterval) {
      this.crackleAccum -= crackleInterval;
      // Smooth toward new random target (not instant jump)
      this.crackleValue += ((Math.random() - 0.5) * 2 - this.crackleValue) * 0.6;
    }
    const crackle = this.crackleValue * c.crackleAmp;

    // Combined intensity modifier (centered at 1.0)
    const mod = 1 + breath + wobble + crackle;
    this.intensity = Math.max(0.3, mod);

    // Radius follows intensity partially
    this.radius = 1 + (mod - 1) * c.radiusFollow;

    // Color shift: brighter → yellow-white, dimmer → deeper red
    const shift = (mod - 1) * c.colorShift; // positive = brighter, negative = dimmer
    this.r = Math.min(1, c.baseR + shift * 0.05);
    this.g = Math.min(1, Math.max(0, c.baseG + shift * 0.4));
    this.b = Math.min(1, Math.max(0, c.baseB + shift * 0.3));
  }
}
