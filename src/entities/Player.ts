import { Entity } from './Entity';
import { Velocity, Collider } from './Components';
import { AnimationController } from './AnimationController';
import { Config } from '../core/Config';

/** Minimal input interface needed by the player — works with both InputSystem and InputManager */
export interface PlayerInput {
  getMovementVector(): { x: number; y: number };
  isRunning(): boolean;
}

/** Player-controlled character entity */
export class Player extends Entity {
  /** Last screen-space movement direction (for animation facing) */
  screenDirX: number = 0;
  screenDirY: number = 0;

  // Override base optionals — Player always has these
  declare velocity: Velocity;
  declare collider: Collider;
  declare animController: AnimationController;

  constructor() {
    super('player');
    this.layer = 'character';
    this.velocity = new Velocity();
    this.collider = new Collider();
    this.collider.hw = 0.25;
    this.collider.hh = 0.25;
    this.animController = new AnimationController();
    this.blobShadow = {
      rx: Config.PLAYER_BLOB_SHADOW_RX,
      ry: Config.PLAYER_BLOB_SHADOW_RY,
      opacity: Config.PLAYER_BLOB_SHADOW_OPACITY,
    };
  }

  /** Read input and set velocity (screen-direction → grid-direction) */
  handleInput(input: PlayerInput): void {
    const mv = input.getMovementVector(); // screen-space direction

    // Store screen direction for animation facing
    this.screenDirX = mv.x;
    this.screenDirY = mv.y;

    // Convert screen direction → grid direction via inverse isometric transform
    const TW = Config.TILE_WIDTH;
    const TH = Config.TILE_HEIGHT;
    let gx = mv.x / TW + mv.y / TH;
    let gy = -mv.x / TW + mv.y / TH;

    // Normalize so diagonals aren't faster
    const len = Math.sqrt(gx * gx + gy * gy);
    if (len > 0) { gx /= len; gy /= len; }

    const speed = Config.PLAYER_SPEED / ((TW + TH) / 2);
    const mult = input.isRunning() ? Config.PLAYER_RUN_MULT : 1;
    this.velocity.vx = gx * speed * mult;
    this.velocity.vy = gy * speed * mult;
  }
}
