import { Config } from '../core/Config';
import { TileMap } from './TileMap';

/**
 * Generates a map filled entirely with grass tiles,
 * plus trees and a house.
 */
export function generateWorld(): TileMap {
  const cols = Config.MAP_COLS;
  const rows = Config.MAP_ROWS;

  const tileMap = new TileMap(cols, rows, [
    { assetId: 'tile_grass', walkable: true },   // 0 — only tile type
  ]);

  // 3 trees (repositioned for 6×6 grid)
  tileMap.addObject({ col: 1,   row: 4.5, assetId: 'obj_tree', width: 306, height: 420, anchorY: 0.92, solid: true, shadowRadius: 35 });
  tileMap.addObject({ col: 3.5, row: 1,   assetId: 'obj_tree', width: 306, height: 420, anchorY: 0.92, solid: true, shadowRadius: 35 });
  tileMap.addObject({ col: 5,   row: 3.5, assetId: 'obj_tree', width: 306, height: 420, anchorY: 0.92, solid: true, shadowRadius: 35 });

  // Stones near trees
  tileMap.addObject({ col: 4.8, row: 3,   assetId: 'obj_stone', width: 52, height: 44, anchorY: 0.85, solid: false, shadowRadius: 10 });

  // 1 house (2×2 tile footprint) — 3×3 shadow grid for smooth rectangular silhouette
  tileMap.addObject({
    col: 1.5, row: 1.5, assetId: 'obj_house', width: 420, height: 420,
    anchorY: 0.82, solid: true, solidCols: 1.1, solidRows: 1.1,
    shadowPoints: [
      { dx: -0.4, dy: -0.4, radius: 40 },
      { dx:  0.0, dy: -0.4, radius: 40 },
      { dx:  0.4, dy: -0.4, radius: 40 },
      { dx: -0.4, dy:  0.0, radius: 40 },
      { dx:  0.0, dy:  0.0, radius: 40 },
      { dx:  0.4, dy:  0.0, radius: 40 },
      { dx: -0.4, dy:  0.4, radius: 40 },
      { dx:  0.0, dy:  0.4, radius: 40 },
      { dx:  0.4, dy:  0.4, radius: 40 },
    ],
  });

  return tileMap;
}
