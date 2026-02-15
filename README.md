# Perun — Isometric Pixel Art Game

A 2.5D isometric pixel art browser game built with TypeScript, HTML5 Canvas, and a custom engine. Features a WebGL2 post-processing pipeline for real-time lighting and shadows, NPC interactions, and a branching dialog system.

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
| `E` | Interact with NPC |
| `↑` `↓` / `W` `S` | Navigate dialog choices |
| `Enter` / `Space` | Confirm dialog choice |
| `ESC` | Close dialog |
| Mouse wheel | Zoom in/out |
| `G` (hold) | Show debug grid overlay |
| `L` | Toggle lighting/shadows |

## Build

```bash
npm run build     # TypeScript check + Vite production build → dist/
npm run preview   # Serve the production build locally
```

## Tech Stack

- **TypeScript** — strict mode, ES modules
- **Vite** — dev server with HMR, production bundler
- **HTML5 Canvas 2D** — base rendering (tiles, objects, entities, fog, particles)
- **WebGL2** — post-processing pass for lighting and shadows (GLSL 300 es)
- **DOM overlays** — dialog UI, interaction prompts, markers (layered above canvases)
- `image-rendering: pixelated` for crisp pixel art at any zoom

## Project Structure

```
├── index.html                        Entry point (canvas, dialog UI, styles)
├── public/assets/
│   ├── data/assets.json              Asset manifest (loaded at boot)
│   └── sprites/
│       ├── characters/               Player + NPC sprite sheets
│       ├── objects/                   Houses, trees, stones
│       └── tiles/                    Isometric ground tiles
├── src/
│   ├── main.ts                       Boot: load manifest → init Game
│   ├── core/
│   │   ├── Game.ts                   Orchestrator: loop, update, render
│   │   ├── GameState.ts              State stack (Playing, Dialog)
│   │   ├── EntityManager.ts          Central entity registry + spatial queries
│   │   ├── EventBus.ts               Typed pub/sub event system
│   │   ├── InputManager.ts           Action mapping over raw keys
│   │   ├── AssetLoader.ts            Image loader/cache
│   │   ├── AssetManifest.ts          JSON manifest loader
│   │   ├── Config.ts                 All constants centralized
│   │   └── Types.ts                  Shared types (Direction)
│   ├── entities/
│   │   ├── Entity.ts                 Base entity (optional components)
│   │   ├── Player.ts                 Player with input-driven movement
│   │   ├── NPC.ts                    NPC with walk-to, fade-in, state machine
│   │   ├── Components.ts             Transform, Velocity, Collider
│   │   └── AnimationController.ts    Sprite sheet animation state machine
│   ├── systems/
│   │   ├── InputSystem.ts            Keyboard & mouse input capture
│   │   ├── PhysicsSystem.ts          Movement + tile/object/entity collision
│   │   └── AnimationSystem.ts        Animation state updates
│   ├── rendering/
│   │   ├── Renderer.ts               Canvas draw queue, Z-sorting, layers
│   │   ├── Camera.ts                 Viewport with smooth follow & zoom
│   │   ├── IsometricUtils.ts         Coordinate conversion
│   │   ├── PostProcessPipeline.ts    WebGL2 lighting & shadows
│   │   └── effects/
│   │       ├── SnowfallEffect.ts     Particle snowfall
│   │       └── FogEffect.ts          Boundary + animated wisps
│   ├── dialog/
│   │   └── DialogData.ts             Dialog tree model + sample dialog
│   ├── states/
│   │   └── DialogState.ts            Game state for active dialog
│   ├── ui/
│   │   ├── DialogUI.ts               Bottom-of-screen dialog with choices
│   │   └── HUD.ts                    Debug overlay (position, FPS, zoom)
│   ├── world/
│   │   ├── TileMap.ts                Tile grid + object storage
│   │   └── WorldGenerator.ts         Map generation
│   └── assets/
│       └── ProceduralAssets.ts       Canvas-generated fallback assets
├── docs/
│   ├── architecture.md               Engine architecture & systems
│   ├── rendering.md                  Render pipeline, lighting, shadows
│   ├── content-guide.md              World map, assets, NPCs, dialogs
│   └── roadmap.md                    Completed work + backlog
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Documentation

| Document | Contents |
|----------|----------|
| **[Architecture](docs/architecture.md)** | Engine design, entity system, game states, events, physics, input |
| **[Rendering](docs/rendering.md)** | Render pipeline, lighting & shadow system, fog, snowfall, shader tuning |
| **[Content Guide](docs/content-guide.md)** | World coordinates, adding tiles/objects/animations/NPCs/dialogs |
| **[Roadmap](docs/roadmap.md)** | Completed work, remaining tasks, priority matrix |

## License

Private project.
