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
   tileMap.addObject({ col: 4.5,   row: 3.1, assetId: 'obj_tree_med_snow', width: 438, height: 600, srcW: 511, srcH: 700, anchorY: 0.92, solid: true, solidCols: 0.9, solidRows: 0.9, shadowRadius: 35 });
  tileMap.addObject({ col: 3.5, row: 0.7,   assetId: 'obj_tree_snow_big_1', width: 438, height: 600, srcW: 511, srcH: 700, anchorY: 0.92, solid: true, solidCols: 0.9, solidRows: 0.9, shadowRadius: 45 });
  tileMap.addObject({ col: 0.5,   row: 4.9, assetId: 'obj_tree_pine_snow', width: 438, height: 652, srcW: 625, srcH: 931, anchorY: 0.92, solid: true, solidCols: 0.9, solidRows: 0.9, shadowRadius: 35 });

  // Sticks pile with snow — low ground object, short shadow over full footprint
  tileMap.addObject({
    id: 'stick_pile_1',
    col: 0.3, row: 3.1,
    assetId: 'obj_sticks_snow_rotated',
    width: 130, height: 80,
    srcW: 258, srcH: 158,
    anchorY: 0.85,
    solid: true,
    solidCols: 0.1,
    solidRows: 0.3,
    shadowRadius: 0,
  });

  // Second sticks pile
  tileMap.addObject({
    id: 'stick_pile_2',
    col: 2.8, row: 2.2,
    assetId: 'obj_sticks_snow',
    width: 130, height: 80,
    srcW: 258, srcH: 158,
    anchorY: 0.85,
    solid: true,
    solidCols: 0.2,
    solidRows: 0.1,
    shadowRadius: 0,
  });

  // Campfire pit — stone ring base sprite, rendered on ground layer (player always above)
  tileMap.addObject({
    col: Config.CAMPFIRE_COL, row: Config.CAMPFIRE_ROW,
    assetId: 'obj_campfire',
    width: 140, height: 90,
    srcW: 182, srcH: 116,
    anchorY: 0.5,          // vertically centered on the grid position
    solid: false,          // collision handled by Campfire entity
    shadowRadius: 20,
    groundLayer: true,
  });

  // Barrel near house entrance
  tileMap.addObject({
    col: 4.2, row: 0.8,
    assetId: 'obj_barrel_snow',
    width: 80, height: 82,
    srcW: 124, srcH: 127,
    anchorY: 0.88,
    solid: true,
    solidCols: 0.35,
    solidRows: 0.35,
    shadowRadius: 22,
  });

  // Paper note pinned to house wall (anchorY > 1 pushes sprite above its grid cell)
  tileMap.addObject({
    id: 'wall_note',
    col: 2.0, row: 2.7,
    assetId: 'obj_note_paper',
    width: 30, height: 33,
    srcW: 51, srcH: 56,
    anchorY: 4.1,
    solid: false,
    depthBias: -100,
    shadowRadius: 0,
  });

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

  // Door prop on the house wall — positive bias to render above house, below player
  tileMap.addObject({
    col: 1.1, row: 2.3,
    assetId: 'obj_door',
    width: 60, height: 140,
    srcW: 90, srcH: 208,
    anchorY: 0.92,
    solid: false,
    depthBias: 50,
    shadowRadius: 0,
  });

  return tileMap;
}
