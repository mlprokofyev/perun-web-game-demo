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
│   │   └── Renderer.ts            Canvas renderer — Z-sorting, layers, boundary fog
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

This layered approach ensures fog affects only tiles, not objects or the player.

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

## Tech Stack

- **TypeScript** — strict mode, ES modules
- **Vite** — dev server with HMR, production bundler
- **HTML5 Canvas 2D** — all rendering, no WebGL dependency
- `image-rendering: pixelated` for crisp pixel art at any zoom

## License

Private project.
