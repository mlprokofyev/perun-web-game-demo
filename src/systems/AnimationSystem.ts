import type { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';

/** Updates animation controllers on all entities that have one. */
export class AnimationSystem {
  update(dt: number, entities: Entity[]): void {
    for (const e of entities) {
      const anim = e.animController;
      if (!anim) continue; // skip entities without animation

      if (e instanceof Player) {
        // Use screen-space direction for animation facing (classic isometric feel)
        anim.setFromVelocity(e.screenDirX, e.screenDirY, dt);
      } else if (e.velocity) {
        anim.setFromVelocity(e.velocity.vx, e.velocity.vy, dt);
      }
      anim.update(dt);
    }
  }
}
