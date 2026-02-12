# Perun — Isometric Pixel Art Game

A 2.5D isometric pixel art browser game built with TypeScript, HTML5 Canvas, and Vite. No frameworks, no WebGL — pure Canvas 2D rendering with a custom engine.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Controls

| Input | Action |
|---|---|
| `WASD` / Arrow keys | Move |
| `Shift` (hold) | Run (1.8× speed) |
| Mouse wheel | Zoom in/out |
| `G` (hold) | Show debug grid overlay |
| `L` | Toggle lighting/shadows |

## Build

```bash
npm run build     # TypeScript check + Vite production build → dist/
npm run preview   # Serve the production build locally
```

## Project Structure

```
├── index.html                     Entry point (canvas container, HUD, styles)
├── public/assets/sprites/         PNG assets
│   ├── characters/
│   │   └── player_idle.png        Player idle sprite (128×128)
│   ├── objects/
│   │   ├── house.png              House object (512×512)
│   │   ├── tree.png               Tree object (217×256)
│   │   └── stone_on_grass.png     Stone decoration (52×44)
│   └── tiles/
│       └── grass.png              Isometric grass tile (218×125)
├── src/
│   ├── main.ts                    Boot sequence — loads assets, generates world, starts game
│   ├── core/
│   │   ├── Config.ts              Global constants (tile size, map dims, speeds, camera)
│   │   ├── Game.ts                Main game class — loop, update, render orchestration
│   │   ├── AssetLoader.ts         Image asset loader/cache (PNG + procedural canvas)
│   │   └── EventBus.ts            Pub/sub event system
│   ├── rendering/
│   │   ├── IsometricUtils.ts      isoToScreen / screenToIso coordinate conversion
│   │   ├── Camera.ts              Viewport camera with smooth follow & zoom
│   │   ├── Renderer.ts            Canvas renderer — Z-sorting, layers, boundary fog
│   │   └── PostProcessPipeline.ts WebGL2 lighting & shadow post-process
│   ├── entities/
│   │   ├── Entity.ts              Base entity class (component container)
│   │   ├── Components.ts          Transform, Velocity, Sprite, Collider components
│   │   ├── Player.ts              Player entity with input-driven movement
│   │   └── AnimationController.ts Sprite sheet animation state machine
│   ├── systems/
│   │   ├── InputSystem.ts         Keyboard & mouse input capture
│   │   ├── PhysicsSystem.ts       Movement, collision detection & resolution
│   │   └── AnimationSystem.ts     Animation state updates based on velocity
│   ├── world/
│   │   ├── TileMap.ts             Tile grid + static object storage
│   │   └── WorldGenerator.ts      Map generation (tile placement, object spawning)
│   ├── assets/
│   │   └── ProceduralAssets.ts    Canvas-generated fallback assets (used if PNGs fail)
│   └── ui/
│       └── HUD.ts                 Debug overlay (position, FPS, zoom)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Architecture

### Coordinate System

The game uses a standard isometric projection with a 2:1 diamond ratio:

- **Grid coordinates** `(col, row)` — logical tile positions
- **World coordinates** `(x, y)` — pixel positions after isometric projection
- **Screen coordinates** — world coordinates transformed by camera (pan + zoom)

Conversion functions in `IsometricUtils.ts`:
- `isoToScreen(col, row)` → world pixel position
- `screenToIso(x, y)` → grid position
- `depthOf(col, row, z)` → Z-sort value (painter's algorithm)

### Render Pipeline

Each frame follows this order:

1. **Clear** canvas with background color
2. **Enqueue** all ground tiles → **flush ground layer**
3. **Draw boundary fog** over tiles (radial vignette + edge gradients)
4. **Enqueue** static objects + entities → **flush object layer**
5. **Debug overlay** (optional grid)
6. **Post-process** — upload canvas as WebGL texture, apply lighting & shadows (if enabled)

This layered approach ensures fog affects only tiles, not objects or the player. The WebGL post-process operates on the final composited image.

### Entity Component System

Entities hold components (`Transform`, `Velocity`, `Sprite`, `Collider`) and are updated by systems:

- **InputSystem** — polls keyboard/mouse state
- **PhysicsSystem** — applies velocity, resolves collisions against tile map and solid objects
- **AnimationSystem** — selects animation based on movement direction and speed

### Camera

- Smooth-follow targeting the player
- Zoom range: 1×–5× (configurable)
- Frustum culling in the renderer skips off-screen tiles/objects

### Asset Loading

Boot sequence in `main.ts`:
1. Generate procedural fallback assets (canvas-drawn placeholders)
2. Load real PNGs — on success they override the procedural versions
3. Generate world and start the game loop

This means the game can run even if PNG files are missing.

## Configuration

All tunable constants live in `src/core/Config.ts`:

| Constant | Default | Description |
|---|---|---|
| `TILE_WIDTH` | 218 | Isometric diamond width (px) |
| `TILE_HEIGHT` | 109 | Isometric diamond height (px) |
| `MAP_COLS` | 6 | Grid columns |
| `MAP_ROWS` | 6 | Grid rows |
| `PLAYER_SPEED` | 80 | Movement speed (world px/sec) |
| `PLAYER_RUN_MULT` | 1.8 | Run speed multiplier |
| `CAMERA_DEFAULT_ZOOM` | 2 | Initial zoom level |
| `CAMERA_ZOOM_MIN/MAX` | 1 / 5 | Zoom bounds |

## Adding Assets

### New tile
1. Drop PNG into `public/assets/sprites/tiles/`
2. Add a load entry in `src/main.ts` → `assetLoader.loadAll([...])`
3. Add a tile definition in `WorldGenerator.ts` → `TileMap` constructor
4. Set tiles via `tileMap.setTile(col, row, tileIndex)`

### New object
1. Drop PNG into `public/assets/sprites/objects/`
2. Add a load entry in `src/main.ts`
3. Place via `tileMap.addObject({ col, row, assetId, width, height, anchorY, solid })`
   - `anchorY` (0–1): vertical anchor point on the image (0.92 = feet near bottom)
   - `solid`: whether the player collides with it

## Lighting & Shadows

The game features a real-time lighting and shadow system implemented as a **WebGL2 post-processing pass** on top of the Canvas 2D renderer. Toggle with `L`.

### Architecture

```
Canvas 2D (Renderer.ts)          WebGL2 overlay (PostProcessPipeline.ts)
┌────────────────────┐           ┌──────────────────────────────────────┐
│ Tiles, objects,    │  texture  │ Full-screen quad + fragment shader   │
│ player, fog        │ ────────► │ per-pixel lighting, soft shadows,    │
│ (unchanged)        │  upload   │ height-fade                          │
└────────────────────┘           └──────────────────────────────────────┘
```

The 2D canvas content is uploaded as a `GL_TEXTURE_2D` every frame. A fragment shader multiplies each pixel's colour by the computed light contribution, producing a lit scene on an overlaid canvas with `pointer-events: none`.

### Light model

- **Ambient light** — constant RGB tint applied to the entire scene (twilight blue by default).
- **Point lights** — each has position, colour, radius, intensity, and optional flicker. Falloff is smooth quadratic: `atten = 1 − (d/r)²`.
- Currently one **sky light** simulates the moon/sun from the upper-left of the map.

### Shadow casting

Objects register as **occluders** — circles in screen space. For each pixel the shader ray-tests from fragment to every light through all occluders:

1. Project occluder centre onto the frag→light segment (closest point).
2. Compare perpendicular distance to occluder radius with `smoothstep` for soft penumbra.
3. Smooth boundary fades at segment endpoints prevent hard-edge artifacts.
4. Multiple occluder shadows per light combine with `min()` (not multiply) so overlapping objects don't produce unnaturally dark areas.

Complex objects (e.g. the house) use **`shadowPoints`** — a grid of overlapping circles that approximate a rectangular shadow silhouette.

Shadow length is **proportional to object height** — each occluder carries a `height` value, and the shader limits the shadow reach to `height × SHADOW_LENGTH_MULT`. Tall trees cast long shadows while small stones cast short ones.

The **player also casts a shadow** as a circular occluder at their feet. `PLAYER_FOOT_OFFSET` shifts the occluder up from the sprite bottom to align with the character's visual feet (accounting for sprite padding).

### Player height fade

In a 2D top-down view, a character walking into shadow would darken uniformly. To simulate 3D height the shader applies a **height fade** within the player sprite bounds:

- **Feet** (bottom of sprite) receive full shadow.
- **Head** (top of sprite) has shadow reduced by `SHADOW_HEIGHT_FADE` (0–1).
- The effect is contained horizontally and vertically within the sprite using `smoothstep` so it doesn't bleed outside.

### Configuration (`Config.ts`)

| Constant | Default | Description |
|---|---|---|
| `LIGHTING_ENABLED` | `true` | Enable post-process lighting on start |
| `LIGHT_AMBIENT_R/G/B` | 0.18 / 0.22 / 0.38 | Global ambient colour (twilight blue) |
| `SKY_LIGHT_OFFSET_X/Y` | −1500 / 1500 | Sky light world offset from map centre |
| `SKY_LIGHT_RADIUS` | 3500 | Sky light reach (world pixels) |
| `SKY_LIGHT_R/G/B` | 0.75 / 0.8 / 1.0 | Sky light colour |
| `SKY_LIGHT_INTENSITY` | 0.6 | Sky light brightness multiplier |
| `PLAYER_SHADOW_RADIUS` | 15 | Player shadow occluder radius (asset px) |
| `PLAYER_FOOT_OFFSET` | 18 | Sprite-bottom → visual feet offset (asset px) |
| `SHADOW_LENGTH_MULT` | 2.0 | Shadow reach = object height × this value |
| `SHADOW_HEIGHT_FADE` | 0.8 | Shadow reduction at player head (0–1) |

### Adding shadow-casting objects

In `WorldGenerator.ts`, set shadow properties when calling `tileMap.addObject()`:

- **Simple circle**: `shadowRadius: 35` — single circular occluder.
- **Complex shape**: `shadowPoints: [{ dx, dy, radius }]` — array of circles offset from the object's grid position. Used for buildings.
- **No shadow**: `shadowRadius: 0` or omit both fields.

### Shader tuning reference

| Shader parameter | Location | Effect |
|---|---|---|
| `r * 0.3 / r * 2.0` in `shadowFactor` | `PostProcessPipeline.ts` | Penumbra softness (inner/outer edge) |
| `smoothstep(-r, r*0.3, t)` | `PostProcessPipeline.ts` | Endpoint boundary fade distance |
| `u_hfWidth * 0.1 / 0.85` | `PostProcessPipeline.ts` | Height-fade horizontal containment |
| `u_hfHeight * 0.4 / 0.85 / 1.05` | `PostProcessPipeline.ts` | Height-fade vertical shape (bell curve) |
| `maxReach * 0.5 / maxReach` in `shadowFactor` | `PostProcessPipeline.ts` | Shadow length fade (start/end of reach) |

## Tech Stack

- **TypeScript** — strict mode, ES modules
- **Vite** — dev server with HMR, production bundler
- **HTML5 Canvas 2D** — base rendering (tiles, objects, entities)
- **WebGL2** — post-processing pass for lighting and shadows
- `image-rendering: pixelated` for crisp pixel art at any zoom

## License

Private project.
