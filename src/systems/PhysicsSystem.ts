import type { Entity } from '../entities/Entity';
import type { TileMap } from '../world/TileMap';

/**
 * Moves entities based on velocity and resolves collisions.
 * Only processes entities that have both velocity and collider components.
 */
export class PhysicsSystem {
  constructor(private tileMap: TileMap) {}

  update(dt: number, entities: Entity[]): void {
    for (const e of entities) {
      const v = e.velocity;
      const c = e.collider;
      if (!v || !c) continue; // skip entities without physics components

      const t = e.transform;
      if (v.vx === 0 && v.vy === 0) continue;

      // Try X axis
      const nx = t.x + v.vx * dt;
      if (this.canMove(nx, t.y, c.hw, c.hh, e, entities)) {
        t.x = nx;
      }

      // Try Y axis
      const ny = t.y + v.vy * dt;
      if (this.canMove(t.x, ny, c.hw, c.hh, e, entities)) {
        t.y = ny;
      }

      // Clamp to map bounds
      t.x = Math.max(c.hw, Math.min(this.tileMap.cols - c.hw, t.x));
      t.y = Math.max(c.hh, Math.min(this.tileMap.rows - c.hh, t.y));
    }
  }

  private canMove(
    cx: number, cy: number, hw: number, hh: number,
    self: Entity, allEntities: Entity[],
  ): boolean {
    // 1. Tile walkability (grid cells the AABB overlaps)
    const minCol = Math.floor(cx - hw);
    const maxCol = Math.floor(cx + hw);
    const minRow = Math.floor(cy - hh);
    const maxRow = Math.floor(cy + hh);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!this.tileMap.isTileWalkable(c, r)) {
          return false;
        }
      }
    }

    // 2. Solid object AABB overlap (tile-map objects like trees, rocks)
    if (this.tileMap.collidesWithObject(cx, cy, hw, hh)) {
      return false;
    }

    // 3. Entity-vs-entity AABB overlap
    //    Only check if the moving entity itself is solid — non-solid
    //    entities (e.g. NPCs on a scripted walk) ignore other entities.
    //    If the entity already overlaps another at its current position,
    //    allow the move so it can escape (prevents getting frozen inside).
    const sc = self.collider;
    if (sc && sc.solid) {
      const st = self.transform;
      for (const other of allEntities) {
        if (other === self) continue;
        const oc = other.collider;
        if (!oc || !oc.solid) continue;
        const ot = other.transform;

        const wouldOverlap =
          Math.abs(cx - ot.x) < hw + oc.hw &&
          Math.abs(cy - ot.y) < hh + oc.hh;
        if (!wouldOverlap) continue;

        // Already overlapping at current position — let the entity move out
        const alreadyOverlapping =
          Math.abs(st.x - ot.x) < hw + oc.hw &&
          Math.abs(st.y - ot.y) < hh + oc.hh;
        if (alreadyOverlapping) continue;

        return false;
      }
    }

    return true;
  }
}
