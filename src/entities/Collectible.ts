import { Entity } from './Entity';
import { AnimationController } from './AnimationController';

/** State for the collectible pickup animation. */
export enum CollectibleState {
  IDLE = 'IDLE',
  /** Scale-up + fade-out pickup animation in progress */
  PICKING_UP = 'PICKING_UP',
  /** Animation done — ready for removal */
  DONE = 'DONE',
  /** Launching from a source to a destination along a parabolic arc. */
  LAUNCHING = 'LAUNCHING',
}

export interface CollectibleOptions {
  col: number;
  row: number;
  /** Item id to add to inventory on pickup */
  itemId: string;
  /** Asset id for the world sprite */
  assetId: string;
  /** Source frame width */
  srcW: number;
  /** Source frame height */
  srcH: number;
  /** Desired on-screen draw height (world pixels) */
  drawH: number;
  /** Number of frames (for animated collectibles, default 1) */
  frameCount?: number;
  /** Frame rate (only if animated, default 2) */
  frameRate?: number;
  /** Pickup radius in grid units (default 0.6) */
  pickupRadius?: number;
}

/**
 * A collectible item entity in the world.
 * Sits on the ground with a subtle bob animation.
 * When picked up: scales up, fades out, then marks itself DONE for removal.
 */
export class Collectible extends Entity {
  declare animController: AnimationController;

  readonly itemId: string;
  readonly pickupRadius: number;

  state: CollectibleState = CollectibleState.IDLE;

  /** Accumulated time for idle bob animation */
  private bobTime: number = 0;
  /** Random phase offset so multiple collectibles don't bob in sync */
  private bobPhase: number = Math.random() * Math.PI * 2;
  /** Base draw scale (before pickup animation) */
  private baseScale: number;

  /** Pickup animation progress (0 → 1) */
  private pickupT: number = 0;
  private static readonly PICKUP_DURATION = 0.35; // seconds

  /** Launch arc parameters */
  private launchFrom: { x: number; y: number } = { x: 0, y: 0 };
  private launchTo: { x: number; y: number } = { x: 0, y: 0 };
  private launchDuration: number = 0.9;
  private launchT: number = 0;
  private launchPeakHeight: number = 60;  // peak z height during arc

  constructor(id: string, opts: CollectibleOptions) {
    super(id);
    this.layer = 'object';
    this.solid = false;
    this.itemId = opts.itemId;
    this.pickupRadius = opts.pickupRadius ?? 0.6;

    this.transform.set(opts.col, opts.row);

    this.animController = new AnimationController();
    this.animController.addAnimation('idle', {
      assetId: opts.assetId,
      frameWidth: opts.srcW,
      frameHeight: opts.srcH,
      frameCount: opts.frameCount ?? 1,
      frameRate: opts.frameRate ?? 2,
      loop: true,
    });
    this.animController.play('idle');

    this.baseScale = opts.drawH / opts.srcH;
    this.drawScale = this.baseScale;

    // Small blob shadow
    this.blobShadow = { rx: 8, ry: 4, opacity: 0.2 };
  }

  /** Call every frame. Handles bob and pickup animation. */
  update(dt: number): void {
    switch (this.state) {
      case CollectibleState.IDLE:
        this.bobTime += dt;
        // Gentle vertical bob via transform.z
        this.transform.z = Math.sin(this.bobTime * 2.5 + this.bobPhase) * 3;
        break;

      case CollectibleState.PICKING_UP:
        this.pickupT += dt / Collectible.PICKUP_DURATION;
        if (this.pickupT >= 1) {
          this.pickupT = 1;
          this.state = CollectibleState.DONE;
          this.opacity = 0;
        } else {
          // Scale up slightly, fade out
          this.drawScale = this.baseScale * (1 + this.pickupT * 0.4);
          this.opacity = 1 - this.pickupT;
          // Rise up
          this.transform.z = this.pickupT * 20;
        }
        break;

      case CollectibleState.LAUNCHING: {
        this.launchT += dt / this.launchDuration;
        if (this.launchT >= 1) {
          this.launchT = 1;
          this.state = CollectibleState.IDLE;
          this.transform.set(this.launchTo.x, this.launchTo.y);
          this.transform.z = 0;
          this.drawScale = this.baseScale;
          this.opacity = 1;
          // Restore blob shadow on landing
          this.blobShadow = { rx: 8, ry: 4, opacity: 0.2 };
          this.bobTime = 0;
          this.bobPhase = Math.random() * Math.PI * 2;
        } else {
          const t = this.launchT;
          // Lerp grid position
          const x = this.launchFrom.x + (this.launchTo.x - this.launchFrom.x) * t;
          const y = this.launchFrom.y + (this.launchTo.y - this.launchFrom.y) * t;
          this.transform.set(x, y);
          // Parabolic arc height: 4·h·t·(1-t) peaks at t=0.5
          this.transform.z = 4 * this.launchPeakHeight * t * (1 - t);
          // Pulsing glow during flight
          this.drawScale = this.baseScale * (1 + 0.35 * Math.sin(t * Math.PI));
          this.opacity = Math.min(1, t * 3); // fade in quickly
        }
        break;
      }

      case CollectibleState.DONE:
        // Waiting for removal — nothing to do
        break;
    }
  }

  /** Trigger the pickup animation. Returns true if pickup started. */
  startPickup(): boolean {
    if (this.state !== CollectibleState.IDLE) return false;
    this.state = CollectibleState.PICKING_UP;
    this.pickupT = 0;
    this.blobShadow = null; // hide shadow during pickup
    return true;
  }

  /**
   * Start a launch arc animation from one grid position to another.
   * The collectible will fly in a parabolic arc and then settle into IDLE.
   */
  startLaunch(
    from: { x: number; y: number },
    to: { x: number; y: number },
    duration: number = 0.9,
    peakHeight: number = 60,
  ): void {
    this.state = CollectibleState.LAUNCHING;
    this.launchFrom = { ...from };
    this.launchTo = { ...to };
    this.launchDuration = duration;
    this.launchPeakHeight = peakHeight;
    this.launchT = 0;
    this.transform.set(from.x, from.y);
    this.opacity = 0; // start invisible, fades in
    this.blobShadow = null; // no shadow while airborne
  }

  /** Check if a position is within pickup range. */
  isInRange(x: number, y: number): boolean {
    const dx = x - this.transform.x;
    const dy = y - this.transform.y;
    return dx * dx + dy * dy <= this.pickupRadius * this.pickupRadius;
  }
}
