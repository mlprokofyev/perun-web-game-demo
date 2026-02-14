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

  /** Tile image dimensions (matches PNG asset — full image, not grid spacing) */
  TILE_IMG_W: 218,
  TILE_IMG_H: 125,

  /** Character sprite source dimensions (must match the actual PNG frame size) */
  CHAR_SRC_W: 113,
  CHAR_SRC_H: 218,

  /** Desired on-screen draw height in world pixels.
   *  Adjust to make the character bigger or smaller on the map. */
  CHAR_DRAW_H: 128,

  /** Player defaults */
  PLAYER_START_COL: 1.3,
  PLAYER_START_ROW: 2.8,
  PLAYER_SPEED: 80,   // pixels per second in world space
  PLAYER_RUN_MULT: 1.8,

  /** Camera */
  CAMERA_ZOOM_MIN: 0.85,
  CAMERA_ZOOM_MAX: 5,
  CAMERA_ZOOM_STEP: 0.25,
  CAMERA_DEFAULT_ZOOM: 1.25,

  /** World (reduced to keep approx same visual extent with larger tiles) */
  MAP_COLS: 6,
  MAP_ROWS: 6,

  /** Lighting — twilight sky light from upper-left */
  LIGHTING_ENABLED: true,
  LIGHT_AMBIENT_R: 0.18,
  LIGHT_AMBIENT_G: 0.22,
  LIGHT_AMBIENT_B: 0.38,

  /** Sky light: world-pixel offset from map center (negative = upper-left) */
  SKY_LIGHT_OFFSET_X: -2000,
  SKY_LIGHT_OFFSET_Y: 300,
  SKY_LIGHT_RADIUS: 3500,
  SKY_LIGHT_R: 0.75,
  SKY_LIGHT_G: 0.8,
  SKY_LIGHT_B: 1.0,
  SKY_LIGHT_INTENSITY: 0.55,

  /** Window light on the house — warm orange glow with candle flicker
   *  Position scaled for 750px house footprint (center 1.5,1.5) */
  WINDOW_LIGHT_COL: 1.0,
  WINDOW_LIGHT_ROW: 2.8,
  WINDOW_LIGHT_HEIGHT: 46,
  WINDOW_LIGHT_RADIUS: 214,
  WINDOW_LIGHT_R: 1.0,
  WINDOW_LIGHT_G: 0.65,
  WINDOW_LIGHT_B: 0.25,
  WINDOW_LIGHT_INTENSITY: 0.8,
  WINDOW_LIGHT_FLICKER: 0.15,

  /** Player shadow-casting radius in asset pixels */
  PLAYER_SHADOW_RADIUS: 15,

  /** Vertical offset (in asset pixels) from sprite bottom to visual feet.
   *  Moves the shadow occluder up to match where the character actually stands. */
  PLAYER_FOOT_OFFSET: 18,

  /** Blob (contact) shadow under the player — soft ellipse on the ground.
   *  Radii are in world pixels; the ellipse is squashed vertically for isometric. */
  PLAYER_BLOB_SHADOW_RX: 22,
  PLAYER_BLOB_SHADOW_RY: 11,
  PLAYER_BLOB_SHADOW_OPACITY: 0.38,

  /** Shadow length multiplier: maxReach = objectHeight × this value.
   *  Higher = longer shadows (low sun angle), lower = shorter (high sun). */
  SHADOW_LENGTH_MULT: 2.0,

  /** Shadow height-fade: how much shadow is reduced at the head of a tall entity (0-1) */
  SHADOW_HEIGHT_FADE: 0.8,

  /** Volumetric sprite shading — gives the player a 3D cylindrical look */
  VOLUMETRIC_ENABLED: true,
  /** Cylindrical diffuse shading strength (0 = flat, 1 = full cylinder) */
  VOLUMETRIC_DIFFUSE: 0.8,
  /** Rim / back-light strength on silhouette edges (0 = none, 1 = bright) */
  VOLUMETRIC_RIM: 0.4,
  /** Rim light colour — cool blue to match twilight */
  VOLUMETRIC_RIM_R: 0.6,
  VOLUMETRIC_RIM_G: 0.75,
  VOLUMETRIC_RIM_B: 1.0,

  /** Boundary fog padding — inward offset in screen px from each map edge.
   *  Positive = fog starts further inside the map; negative = fog starts outside. */
  BOUNDARY_FOG_PADDING: -15,
  /** Opacity multiplier for back-edge fog (top/left). 0 = invisible, 1 = same as front. */
  BOUNDARY_FOG_BACK_MULT: 0.4,

  /** Animated edge fog — drifting wisps near map boundaries (drawn over everything) */
  FOG_WISPS_PER_EDGE: 20,
  FOG_WISP_SIZE: 220,         // base radius in screen px
  FOG_WISP_OPACITY: 0.4,      // peak opacity (0-1)
  FOG_WISP_DRIFT_SPEED: 0.45, // lateral drift freq (radians/s)
  FOG_WISP_BREATH_SPEED: 1.0, // opacity pulse freq (radians/s)
  FOG_WISP_REACH: 65,         // inward oscillation amplitude in px

  /** Snowfall weather effect — particles live in 3D world space */
  SNOW_ENABLED: true,
  SNOW_PARTICLE_COUNT: 1000,     // total snowflakes across the map
  SNOW_FALL_SPEED: 40,          // vertical fall speed (world px/s)
  SNOW_WIND_SPEED: 50,          // lateral wind drift in world px/s (positive = screen-right)
  SNOW_MIN_SIZE: 1.0,           // smallest flake screen radius (px, zoom-independent)
  SNOW_MAX_SIZE: 4,             // largest flake screen radius (px)
  SNOW_OPACITY: 0.85,           // peak flake opacity (0-1)
  SNOW_WOBBLE_SPEED: 1.8,       // horizontal sine-wobble frequency (rad/s)
  SNOW_WOBBLE_AMP: 25,          // wobble amplitude in world px
  SNOW_DEPTH_LAYERS: 10,         // number of parallax depth layers (1=flat, 3-5=rich depth)
  SNOW_MAX_HEIGHT: 500,         // max height above ground plane (world px)
  SNOW_SPAWN_PADDING: 2,        // extra grid cells beyond map edges for flake spawning

  /** Dog NPC — sprite source dimensions (from actual PNGs) */
  DOG_WALK_SRC_W: 172,   // 688 / 4 frames
  DOG_WALK_SRC_H: 96,
  DOG_IDLE_SRC_W: 123,   // 492 / 4 frames
  DOG_IDLE_SRC_H: 123,
  DOG_DRAW_H: 80,        // desired on-screen draw height (reference = idle frame)

  /** Dog NPC — behavior */
  DOG_SPEED: 60,          // world px/s
  DOG_SPAWN_COL: 5.7,
  DOG_SPAWN_ROW: 1.2,
  DOG_TARGET_COL: 3.0,
  DOG_TARGET_ROW: 3.7,
  DOG_FADE_DURATION: 2.0, // seconds to go from transparent to opaque

  /** NPC interaction */
  NPC_INTERACT_RADIUS: 1.2,  // grid units — distance within which "Press E" shows

  /** Debug */
  DEBUG: true,
} as const;
