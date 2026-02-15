import type { Direction } from '../core/Types';

export interface AnimationDef {
  assetId: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
  loop: boolean;
}

/** Manages sprite-sheet animations for an entity */
export class AnimationController {
  private animations: Map<string, AnimationDef> = new Map();
  private currentKey: string = '';
  private currentFrame: number = 0;
  private elapsed: number = 0;
  private lastDirection: Direction = 'south';

  /** When true, frame advancement is paused (player stopped but not yet idle) */
  private frozen: boolean = false;
  /** Seconds since the player stopped moving */
  private idleTimer: number = 0;
  /** Seconds of inactivity before switching to the idle animation */
  static readonly IDLE_TIMEOUT: number = 10;

  /** Register an animation under a key like "walk_south" */
  addAnimation(key: string, def: AnimationDef): void {
    this.animations.set(key, def);
    if (!this.currentKey) this.currentKey = key;
  }

  /** Switch to a named animation; resets frame if switching */
  play(key: string): void {
    if (this.currentKey === key) return;
    if (!this.animations.has(key)) return;
    this.currentKey = key;
    this.currentFrame = 0;
    this.elapsed = 0;
    this.frozen = false;
  }

  /** Advance frame timer (skipped while frozen) */
  update(dt: number): void {
    if (this.frozen) return;
    const anim = this.animations.get(this.currentKey);
    if (!anim) return;
    this.elapsed += dt;
    const frameDur = 1 / anim.frameRate;
    if (this.elapsed >= frameDur) {
      this.elapsed -= frameDur;
      this.currentFrame++;
      if (this.currentFrame >= anim.frameCount) {
        this.currentFrame = anim.loop ? 0 : anim.frameCount - 1;
      }
    }
  }

  /** Automatically pick walk/idle animation from velocity.
   *  On stop: freeze on last walk frame → after IDLE_TIMEOUT switch to idle. */
  setFromVelocity(vx: number, vy: number, dt: number): void {
    const isMoving = Math.abs(vx) >= 0.001 || Math.abs(vy) >= 0.001;

    if (isMoving) {
      this.idleTimer = 0;
      this.frozen = false;
      const dir = this.velocityToDirection(vx, vy);
      this.lastDirection = dir;
      this.play('walk_' + dir);
      return;
    }

    // Not moving — snap to first frame (neutral stance) and freeze
    if (!this.frozen && this.currentKey.startsWith('walk_')) {
      this.currentFrame = 0;
      this.elapsed = 0;
      this.frozen = true;
      this.idleTimer = 0;
    }

    if (this.frozen) {
      this.idleTimer += dt;
      if (this.idleTimer >= AnimationController.IDLE_TIMEOUT) {
        this.frozen = false;
        this.play('idle_' + this.lastDirection);
      }
    }
  }

  private velocityToDirection(vx: number, vy: number): Direction {
    const angle = ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360;
    // Map angles to 8 directions (45° sectors)
    if (angle >= 337.5 || angle < 22.5) return 'east';
    if (angle >= 22.5 && angle < 67.5) return 'south_east';
    if (angle >= 67.5 && angle < 112.5) return 'south';
    if (angle >= 112.5 && angle < 157.5) return 'south_west';
    if (angle >= 157.5 && angle < 202.5) return 'west';
    if (angle >= 202.5 && angle < 247.5) return 'north_west';
    if (angle >= 247.5 && angle < 292.5) return 'north';
    return 'north_east';
  }

  getCurrentAssetId(): string {
    return this.animations.get(this.currentKey)?.assetId ?? '';
  }

  getCurrentFrame(): { x: number; y: number; width: number; height: number } {
    const anim = this.animations.get(this.currentKey);
    if (!anim) return { x: 0, y: 0, width: 64, height: 64 };
    return {
      x: this.currentFrame * anim.frameWidth,
      y: 0,
      width: anim.frameWidth,
      height: anim.frameHeight,
    };
  }

  getDirection(): Direction {
    return this.lastDirection;
  }
}
