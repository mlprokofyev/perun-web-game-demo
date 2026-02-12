import { Entity } from './Entity';
import { Config } from '../core/Config';
import type { InputSystem } from '../systems/InputSystem';

/** Player-controlled character entity */
export class Player extends Entity {
  /** Last screen-space movement direction (for animation facing) */
  screenDirX: number = 0;
  screenDirY: number = 0;

  constructor() {
    super('player');
    this.layer = 'character';
    this.collider.hw = 0.25;
    this.collider.hh = 0.25;
  }

  /** Read input and set velocity (screen-direction → grid-direction) */
  handleInput(input: InputSystem): void {
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
