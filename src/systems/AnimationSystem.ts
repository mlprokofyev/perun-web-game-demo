import type { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';

/** Updates animation controllers on all entities */
export class AnimationSystem {
  update(dt: number, entities: Entity[]): void {
    for (const e of entities) {
      if (e instanceof Player) {
        // Use screen-space direction for animation facing (classic isometric feel)
        e.animController.setFromVelocity(e.screenDirX, e.screenDirY);
      } else {
        e.animController.setFromVelocity(e.velocity.vx, e.velocity.vy);
      }
      e.animController.update(dt);
    }
  }
}
