import { Config } from '../core/Config';

export interface TileDef {
  assetId: string;
  walkable: boolean;
}

export interface WorldObject {
  col: number;
  row: number;
  assetId: string;
  /** Draw width in world pixels */
  width: number;
  /** Draw height in world pixels */
  height: number;
  /** Source image width — defaults to width if omitted (for high-res assets) */
  srcW?: number;
  /** Source image height — defaults to height if omitted */
  srcH?: number;
  anchorY: number;
  solid: boolean;
  /** Grid footprint — how many columns the solid area spans (default 1) */
  solidCols?: number;
  /** Grid footprint — how many rows the solid area spans (default 1) */
  solidRows?: number;
  /** Shadow-casting radius in asset pixels (default: width * 0.15). Set 0 to disable shadow. */
  shadowRadius?: number;
  /** Shadow-casting height in world pixels (controls shadow length).
   *  Defaults to draw height. Set low for ground-level objects (short shadows). */
  shadowHeight?: number;
  /** If true, render on the GROUND layer (beneath all entities). Default false (OBJECT layer). */
  groundLayer?: boolean;
  /** Rotation in degrees (applied around sprite center). Default 0. */
  rotation?: number;
  /** Multiple shadow circles for complex shapes (overrides shadowRadius).
   *  Each entry is { dx, dy } in grid-coordinate offsets from (col, row) + radius in asset px. */
  shadowPoints?: Array<{ dx: number; dy: number; radius: number }>;
}

/**
 * Isometric tile map holding ground tiles and static objects.
 */
export class TileMap {
  cols: number;
  rows: number;
  /** 2D array [row][col] of tile type indices */
  tiles: number[][];
  /** Tile type definitions */
  tileDefs: TileDef[];
  /** Static objects (trees, rocks, buildings) */
  objects: WorldObject[] = [];

  constructor(cols: number, rows: number, tileDefs: TileDef[]) {
    this.cols = cols;
    this.rows = rows;
    this.tileDefs = tileDefs;
    // Default fill with first tile type
    this.tiles = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => 0)
    );
  }

  setTile(col: number, row: number, tileIndex: number): void {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.tiles[row][col] = tileIndex;
    }
  }

  getTileDef(col: number, row: number): TileDef | undefined {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return undefined;
    return this.tileDefs[this.tiles[row][col]];
  }

  /** Check if a tile cell is walkable (ground only, ignores objects) */
  isTileWalkable(col: number, row: number): boolean {
    const def = this.getTileDef(col, row);
    return !!def && def.walkable;
  }

  /** AABB overlap test: entity at (cx,cy) with half-extents (hw,hh) vs solid objects */
  collidesWithObject(cx: number, cy: number, hw: number, hh: number): boolean {
    for (const obj of this.objects) {
      if (!obj.solid) continue;
      const objHW = (obj.solidCols ?? 1) / 2;
      const objHH = (obj.solidRows ?? 1) / 2;
      if (Math.abs(cx - obj.col) < hw + objHW &&
          Math.abs(cy - obj.row) < hh + objHH) {
        return true;
      }
    }
    return false;
  }

  /** Legacy helper (tiles + objects) */
  isWalkable(col: number, row: number): boolean {
    return this.isTileWalkable(col, row);
  }

  addObject(obj: WorldObject): void {
    this.objects.push(obj);
  }
}
