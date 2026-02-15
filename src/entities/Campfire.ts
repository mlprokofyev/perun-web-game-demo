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

  /** Burst mode — temporarily boost spark generation */
  private burstTimer: number = 0;
  private burstDuration: number = 0;
  private savedMaxSparks: number = 30;
  private savedSpawnRate: number = 14;

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
   * Trigger a dramatic fire burst — temporarily increases spark rate and count.
   * @param duration How long the burst lasts in seconds (default 2.0).
   */
  burst(duration: number = 2.0): void {
    this.savedMaxSparks = this.maxSparks;
    this.savedSpawnRate = this.spawnRate;
    this.maxSparks = 120;
    this.spawnRate = 60;
    this.burstDuration = duration;
    this.burstTimer = 0;
  }

  /** Advance spark particles. Call every frame. */
  updateSparks(dt: number): void {
    // Handle burst cooldown
    if (this.burstDuration > 0) {
      this.burstTimer += dt;
      if (this.burstTimer >= this.burstDuration) {
        this.maxSparks = this.savedMaxSparks;
        this.spawnRate = this.savedSpawnRate;
        this.burstDuration = 0;
        this.burstTimer = 0;
      }
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
