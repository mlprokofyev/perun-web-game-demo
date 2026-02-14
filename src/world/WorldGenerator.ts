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
   tileMap.addObject({ col: 0.7,   row: 4.7, assetId: 'obj_tree_med_snow', width: 438, height: 600, srcW: 511, srcH: 700, anchorY: 0.92, solid: true, solidCols: 0.9, solidRows: 0.9, shadowRadius: 35 });
  tileMap.addObject({ col: 3.5, row: 0.7,   assetId: 'obj_tree_snow_big_1', width: 438, height: 600, srcW: 511, srcH: 700, anchorY: 0.92, solid: true, solidCols: 0.9, solidRows: 0.9, shadowRadius: 45 });
  tileMap.addObject({ col: 4.7,   row: 3.5, assetId: 'obj_tree_med_snow', width: 438, height: 600, srcW: 511, srcH: 700, anchorY: 0.92, solid: true, solidCols: 0.9, solidRows: 0.9, shadowRadius: 35 });

  // Stones near trees
  tileMap.addObject({ col: 4.8, row: 3,   assetId: 'obj_stone', width: 52, height: 44, anchorY: 0.85, solid: false, shadowRadius: 10 });

  // 1 house — high-res 890×890 drawn at 600×600 (~2.75 tile footprint)
  // Shadow grid scaled ×1.429 from 420 base
  tileMap.addObject({
    col: 1.5, row: 1.5, assetId: 'obj_house', width: 600, height: 600,
    srcW: 890, srcH: 890,
    anchorY: 0.82, solid: true, solidCols: 2, solidRows: 2,
    shadowPoints: [
      // Back row (roof overhang)
      { dx: -0.64, dy: -0.64, radius: 54 },
      { dx:  0.0,  dy: -0.64, radius: 60 },
      { dx:  0.64, dy: -0.64, radius: 54 },
      // Middle row (walls)
      { dx: -0.64, dy:  0.0,  radius: 60 },
      { dx:  0.0,  dy:  0.0,  radius: 69 },
      { dx:  0.64, dy:  0.0,  radius: 60 },
      // Front row (base + porch)
      { dx: -0.64, dy:  0.57, radius: 54 },
      { dx:  0.0,  dy:  0.57, radius: 60 },
      { dx:  0.64, dy:  0.57, radius: 54 },
      // Extra roof peak occluder
      { dx:  0.0,  dy: -1.0,  radius: 43 },
    ],
  });

  return tileMap;
}
