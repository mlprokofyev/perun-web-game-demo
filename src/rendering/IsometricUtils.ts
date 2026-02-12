import { Config } from '../core/Config';

const TW = Config.TILE_WIDTH;
const TH = Config.TILE_HEIGHT;

/** Convert isometric grid coords → screen pixel coords */
export function isoToScreen(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * (TW / 2),
    y: (gx + gy) * (TH / 2),
  };
}

/** Convert screen pixel coords → fractional isometric grid coords */
export function screenToIso(sx: number, sy: number): { x: number; y: number } {
  const gx = (sx / (TW / 2) + sy / (TH / 2)) / 2;
  const gy = (sy / (TH / 2) - sx / (TW / 2)) / 2;
  return { x: gx, y: gy };
}

/** Snap fractional iso coords to integer grid cell */
export function screenToGrid(sx: number, sy: number): { col: number; row: number } {
  const iso = screenToIso(sx, sy);
  return { col: Math.floor(iso.x), row: Math.floor(iso.y) };
}

/** Depth key for painter's algorithm z-sorting (higher = rendered later = on top) */
export function depthOf(gx: number, gy: number, gz: number = 0): number {
  return (gx + gy) * TH + gz;
}
