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

  /** Lighting — twilight sky light from upper-left */
  LIGHTING_ENABLED: true,
  LIGHT_AMBIENT_R: 0.18,
  LIGHT_AMBIENT_G: 0.22,
  LIGHT_AMBIENT_B: 0.38,

  /** Sky light: world-pixel offset from map center (negative = upper-left) */
  SKY_LIGHT_OFFSET_X: -1500,
  SKY_LIGHT_OFFSET_Y: 1500,
  SKY_LIGHT_RADIUS: 3500,
  SKY_LIGHT_R: 0.75,
  SKY_LIGHT_G: 0.8,
  SKY_LIGHT_B: 1.0,
  SKY_LIGHT_INTENSITY: 0.55,

  /** Player shadow-casting radius in asset pixels */
  PLAYER_SHADOW_RADIUS: 15,

  /** Vertical offset (in asset pixels) from sprite bottom to visual feet.
   *  Moves the shadow occluder up to match where the character actually stands. */
  PLAYER_FOOT_OFFSET: 18,

  /** Shadow length multiplier: maxReach = objectHeight × this value.
   *  Higher = longer shadows (low sun angle), lower = shorter (high sun). */
  SHADOW_LENGTH_MULT: 2.0,

  /** House window light — warm orange halo */
  WINDOW_LIGHT_COL: 1.0,
  WINDOW_LIGHT_ROW: 2.3,
  WINDOW_LIGHT_HEIGHT: 32,       // asset px above ground
  WINDOW_LIGHT_RADIUS: 150,
  WINDOW_LIGHT_R: 1.0,
  WINDOW_LIGHT_G: 0.65,
  WINDOW_LIGHT_B: 0.25,
  WINDOW_LIGHT_INTENSITY: 0.5,
  WINDOW_LIGHT_FLICKER: 0.15,    // subtle candle-like flicker

  /** Shadow height-fade: how much shadow is reduced at the head of a tall entity (0-1) */
  SHADOW_HEIGHT_FADE: 0.8,

  /** Debug */
  DEBUG: true,
} as const;
