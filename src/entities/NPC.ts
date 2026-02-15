import { Entity } from './Entity';
import { Velocity, Collider } from './Components';
import { AnimationController } from './AnimationController';
import { Config } from '../core/Config';

/** Behavioural states for an NPC */
export enum NPCState {
  WALKING = 'WALKING',
  IDLE = 'IDLE',
}

/** Options bag for NPC construction */
export interface NPCOptions {
  spawnCol: number;
  spawnRow: number;
  targetCol: number;
  targetRow: number;
  /** Movement speed in world px/s (converted to grid speed internally) */
  speed: number;
  /** Seconds to fade from transparent → fully opaque */
  fadeDuration: number;
  /** Dialog tree id — looked up when the player interacts */
  dialogId: string;
}

/**
 * Non-player character entity.
 * Spawns at a position (optionally transparent), walks to a target, then idles.
 * Once idle it can be interacted with for dialog.
 */
export class NPC extends Entity {
  // Components guaranteed present on NPC
  declare velocity: Velocity;
  declare collider: Collider;
  declare animController: AnimationController;

  /** Current behaviour state */
  npcState: NPCState = NPCState.WALKING;

  /** Grid target the NPC is headed towards */
  readonly targetCol: number;
  readonly targetRow: number;

  /** Dialog tree id */
  readonly dialogId: string;

  /** Whether the player can currently interact (true once idle) */
  interactable: boolean = false;

  /** Grid speed (grid-units/s) */
  private gridSpeed: number;

  /** Fade-in tracking */
  private fadeElapsed: number = 0;
  private fadeDuration: number;

  constructor(id: string, opts: NPCOptions) {
    super(id);
    this.layer = 'character';

    // Components
    this.velocity = new Velocity();
    this.collider = new Collider();
    this.collider.hw = 0.05;
    this.collider.hh = 0.05;
    this.collider.solid = false; // non-solid during walk phase
    this.animController = new AnimationController();

    // Position
    this.transform.set(opts.spawnCol, opts.spawnRow);
    this.targetCol = opts.targetCol;
    this.targetRow = opts.targetRow;

    // Speed: convert world px/s → grid units/s
    const avgTile = (Config.TILE_WIDTH + Config.TILE_HEIGHT) / 2;
    this.gridSpeed = opts.speed / avgTile;

    // Fade
    this.fadeDuration = opts.fadeDuration;
    this.opacity = 0;

    // Dialog
    this.dialogId = opts.dialogId;

    // Set initial velocity towards target
    this.aimAtTarget();
  }

  /** Call every frame from the game update loop (after physics). */
  update(dt: number): void {
    switch (this.npcState) {
      case NPCState.WALKING: {
        // Fade in
        if (this.opacity < 1) {
          this.fadeElapsed += dt;
          this.opacity = Math.min(1, this.fadeElapsed / this.fadeDuration);
        }

        // Re-aim toward target each frame (steering) so deflections
        // by solid objects don't cause permanent drift / overshoot.
        const dx = this.targetCol - this.transform.x;
        const dy = this.targetRow - this.transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Arrival check — snap if close enough or if a single step
        // would overshoot the remaining distance.
        const stepSize = this.gridSpeed * dt;
        if (dist < Math.max(0.1, stepSize)) {
          this.transform.set(this.targetCol, this.targetRow);
          this.velocity.vx = 0;
          this.velocity.vy = 0;
          this.opacity = 1;
          this.npcState = NPCState.IDLE;
          this.interactable = true;
          this.interactLabel = 'talk';
          this.collider.solid = true; // become solid once settled
          // Switch to idle animation using last facing direction
          const dir = this.animController.getDirection();
          this.animController.play(`idle_${dir}`);
        } else {
          // Steer toward target
          this.velocity.vx = (dx / dist) * this.gridSpeed;
          this.velocity.vy = (dy / dist) * this.gridSpeed;
        }
        break;
      }

      case NPCState.IDLE:
        // Waiting for interaction — nothing to do.
        break;
    }
  }

  /** Compute and set velocity towards the target position. */
  private aimAtTarget(): void {
    const dx = this.targetCol - this.transform.x;
    const dy = this.targetRow - this.transform.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.01) return;

    this.velocity.vx = (dx / dist) * this.gridSpeed;
    this.velocity.vy = (dy / dist) * this.gridSpeed;
  }
}
