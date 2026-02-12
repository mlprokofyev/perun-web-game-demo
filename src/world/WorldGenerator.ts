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
  tileMap.addObject({ col: 1,   row: 4.5, assetId: 'obj_tree', width: 306, height: 420, anchorY: 0.92, solid: true });
  tileMap.addObject({ col: 3.5, row: 1,   assetId: 'obj_tree', width: 306, height: 420, anchorY: 0.92, solid: true });
  tileMap.addObject({ col: 5,   row: 3.5, assetId: 'obj_tree', width: 306, height: 420, anchorY: 0.92, solid: true });

  // Stones near trees
  tileMap.addObject({ col: 4.8, row: 3,   assetId: 'obj_stone', width: 52, height: 44, anchorY: 0.85, solid: false });

  // 1 house (2×2 tile footprint)
  tileMap.addObject({ col: 1.5, row: 1.5, assetId: 'obj_house', width: 420, height: 420, anchorY: 0.82, solid: true, solidCols: 1.1, solidRows: 1.1 });

  return tileMap;
}
