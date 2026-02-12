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
  private lastDirection: string = 'south';

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
  }

  /** Advance frame timer */
  update(dt: number): void {
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

  /** Automatically pick walk/idle animation from velocity */
  setFromVelocity(vx: number, vy: number): void {
    if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) {
      this.play('idle_' + this.lastDirection);
      return;
    }
    const dir = this.velocityToDirection(vx, vy);
    this.lastDirection = dir;
    this.play('walk_' + dir);
  }

  private velocityToDirection(vx: number, vy: number): string {
    const angle = ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360;
    // Map angles to 4 cardinal directions
    if (angle >= 315 || angle < 45) return 'east';
    if (angle >= 45 && angle < 135) return 'south';
    if (angle >= 135 && angle < 225) return 'west';
    return 'north';
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

  getDirection(): string {
    return this.lastDirection;
  }
}
