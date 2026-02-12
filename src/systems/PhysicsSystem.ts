import type { Entity } from '../entities/Entity';
import type { TileMap } from '../world/TileMap';

/**
 * Moves entities based on velocity and resolves collisions.
 * - Tile walkability: grid-cell check
 * - Solid objects: AABB overlap (position-based, not grid-snapped)
 */
export class PhysicsSystem {
  constructor(private tileMap: TileMap) {}

  update(dt: number, entities: Entity[]): void {
    for (const e of entities) {
      const t = e.transform;
      const v = e.velocity;
      const c = e.collider;

      if (v.vx === 0 && v.vy === 0) continue;

      // Try X axis
      const nx = t.x + v.vx * dt;
      if (this.canMove(nx, t.y, c.hw, c.hh)) {
        t.x = nx;
      }

      // Try Y axis
      const ny = t.y + v.vy * dt;
      if (this.canMove(t.x, ny, c.hw, c.hh)) {
        t.y = ny;
      }

      // Clamp to map bounds
      t.x = Math.max(c.hw, Math.min(this.tileMap.cols - c.hw, t.x));
      t.y = Math.max(c.hh, Math.min(this.tileMap.rows - c.hh, t.y));
    }
  }

  private canMove(cx: number, cy: number, hw: number, hh: number): boolean {
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

    // 2. Solid object AABB overlap
    if (this.tileMap.collidesWithObject(cx, cy, hw, hh)) {
      return false;
    }

    return true;
  }
}
