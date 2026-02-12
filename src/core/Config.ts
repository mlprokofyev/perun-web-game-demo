/** Game-wide configuration constants */
export const Config = {
  /** Isometric tile grid spacing (matches tile asset diamond: 218 wide, 109 tall) */
  TILE_WIDTH: 218,
  TILE_HEIGHT: 109,

  /** Default canvas resolution (will auto-resize to window) */
  CANVAS_WIDTH: 960,
  CANVAS_HEIGHT: 640,

  /** Target framerate */
  TARGET_FPS: 60,
  FRAME_TIME: 1000 / 60,

  /** Player defaults */
  PLAYER_SPEED: 80,   // pixels per second in world space
  PLAYER_RUN_MULT: 1.8,

  /** Camera */
  CAMERA_ZOOM_MIN: 1,
  CAMERA_ZOOM_MAX: 5,
  CAMERA_ZOOM_STEP: 0.25,
  CAMERA_DEFAULT_ZOOM: 1.5,

  /** World (reduced to keep approx same visual extent with larger tiles) */
  MAP_COLS: 6,
  MAP_ROWS: 6,

  /** Debug */
  DEBUG: true,
} as const;
