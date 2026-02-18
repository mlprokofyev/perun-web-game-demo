import { Entity } from './Entity';
import { Collider } from './Components';
import { AnimationController } from './AnimationController';

/** Spark particle emitted by the campfire */
export interface Spark {
  /** Offset from fire center in world pixels */
  ox: number;
  oy: number;
  /** Velocity in world px/s */
  vx: number;
  vy: number;
  /** Remaining lifetime in seconds */
  life: number;
  /** Total lifetime (for fade calc) */
  maxLife: number;
  /** Pixel radius */
  radius: number;
  /** Colour hue shift (0-1 maps to orange→yellow) */
  hue: number;
}

/**
 * Static campfire entity with animated flames, glowing embers, and spark particles.
 * Placed at a grid position; does not move.
 */
export class Campfire extends Entity {
  declare animController: AnimationController;

  /** Spark particles — updated and drawn by Game._render */
  sparks: Spark[] = [];

  /** Maximum concurrent sparks */
  private maxSparks = 30;
  /** Accumulator for spawn timing */
  private spawnAccum = 0;
  /** Spawns per second */
  private spawnRate = 14;

  /** Burst envelope — smooth ramp up / hold / ramp down */
  private static readonly BURST_RAMP_UP = 0.3;
  private static readonly BURST_RAMP_DOWN = 0.5;

  private burstPhase: 'off' | 'up' | 'hold' | 'down' = 'off';
  private burstPhaseTimer: number = 0;
  private burstHoldDuration: number = 0;
  private burstT: number = 0;

  private savedMaxSparks: number = 30;
  private savedSpawnRate: number = 14;
  private burstPeakMaxSparks: number = 50;
  private burstPeakSpawnRate: number = 30;
  private burstPeakScaleMult: number = 1.25;
  private burstPeakLightMult: number = 1.2;

  /** Whether the campfire has been fed */
  private _fed: boolean = false;
  get fed(): boolean { return this._fed; }

  /** Base drawScale set during init (before any multiplier) */
  private baseDrawScale: number = 1;

  /** Active multipliers for scale and light — driven by state */
  private _scaleMult: number = 0.7;
  private _lightMult: number = 0.8;
  get scaleMult(): number { return this._scaleMult; }
  get lightMult(): number { return this._lightMult * this.currentBurstLightMult(); }

  private currentBurstLightMult(): number {
    return Campfire.lerp(1, this.burstPeakLightMult, this.burstT);
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  private static easeIn(t: number): number { return t * t; }
  private static easeOut(t: number): number { return 1 - (1 - t) * (1 - t); }

  constructor(col: number, row: number) {
    super('campfire');
    this.layer = 'object';
    this.solid = true;
    this.opacity = 1;
    this.drawScale = 1;

    this.transform.set(col, row);

    // Collider — small footprint so the player can't walk through the fire
    this.collider = new Collider();
    this.collider.hw = 0.1;
    this.collider.hh = 0.1;
    this.collider.solid = true;

    // Animation controller — will be configured by Game after asset registration
    this.animController = new AnimationController();
  }

  /**
   * Trigger a dramatic fire burst with smooth ramp-up, hold, and ramp-down.
   * @param duration Total burst duration in seconds (includes ramp phases).
   */
  burst(duration: number = 2.0): void {
    this.savedMaxSparks = this.maxSparks;
    this.savedSpawnRate = this.spawnRate;
    this.burstPeakMaxSparks = 50;
    this.burstPeakSpawnRate = 30;
    this.burstPeakScaleMult = 1.25;
    this.burstPeakLightMult = 1.2;
    this.burstHoldDuration = Math.max(0, duration - Campfire.BURST_RAMP_UP - Campfire.BURST_RAMP_DOWN);
    this.burstPhase = 'up';
    this.burstPhaseTimer = 0;
    this.burstT = 0;
  }

  /**
   * Permanently boost the campfire after feeding it sticks.
   * Fire grows from small/dim (0.7×/0.8×) to normal (1×/1×).
   */
  feed(): void {
    this._fed = true;
    this._scaleMult = 1.0;
    this._lightMult = 1.0;
    this.applyBurstDerived();
  }

  /** Store the base drawScale so multipliers can be re-applied cleanly. */
  setBaseScale(scale: number): void {
    this.baseDrawScale = scale;
    this.applyBurstDerived();
  }

  /** Derive all burst-dependent values from current burstT and apply. */
  private applyBurstDerived(): void {
    const t = this.burstT;
    const burstScaleMult = Campfire.lerp(1, this.burstPeakScaleMult, t);
    this.drawScale = this.baseDrawScale * this._scaleMult * burstScaleMult;
    this.spawnRate = Campfire.lerp(this.savedSpawnRate, this.burstPeakSpawnRate, t);
    this.maxSparks = Math.round(Campfire.lerp(this.savedMaxSparks, this.burstPeakMaxSparks, t));
  }

  /** Advance spark particles. Call every frame. */
  updateSparks(dt: number): void {
    // Advance burst envelope
    if (this.burstPhase !== 'off') {
      this.burstPhaseTimer += dt;
      switch (this.burstPhase) {
        case 'up':
          if (this.burstPhaseTimer >= Campfire.BURST_RAMP_UP) {
            this.burstT = 1;
            this.burstPhase = 'hold';
            this.burstPhaseTimer -= Campfire.BURST_RAMP_UP;
          } else {
            this.burstT = Campfire.easeIn(this.burstPhaseTimer / Campfire.BURST_RAMP_UP);
          }
          break;
        case 'hold':
          this.burstT = 1;
          if (this.burstPhaseTimer >= this.burstHoldDuration) {
            this.burstPhase = 'down';
            this.burstPhaseTimer -= this.burstHoldDuration;
          }
          break;
        case 'down':
          if (this.burstPhaseTimer >= Campfire.BURST_RAMP_DOWN) {
            this.burstT = 0;
            this.burstPhase = 'off';
            this.burstPhaseTimer = 0;
          } else {
            this.burstT = Campfire.easeOut(1 - this.burstPhaseTimer / Campfire.BURST_RAMP_DOWN);
          }
          break;
      }
      this.applyBurstDerived();
    }

    // Spawn new sparks
    this.spawnAccum += dt;
    const interval = 1 / this.spawnRate;
    while (this.spawnAccum >= interval && this.sparks.length < this.maxSparks) {
      this.spawnAccum -= interval;
      this.sparks.push(this.makeSpark());
    }

    // Update existing
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.ox += s.vx * dt;
      s.oy += s.vy * dt;
      // Sparks decelerate and drift
      s.vx *= 0.97;
      s.vy *= 0.98;
    }
  }

  private makeSpark(): Spark {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4; // mostly upward, wider spread
    const speed = 18 + Math.random() * 40;
    const life = 0.8 + Math.random() * 1.4;
    return {
      ox: (Math.random() - 0.5) * 14,
      oy: -4 - Math.random() * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      radius: 1.5 + Math.random() * 1.8,
      hue: Math.random(),
    };
  }
}
