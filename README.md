# Perun — Isometric Pixel Art Game

A 2.5D isometric pixel art browser game built with TypeScript, HTML5 Canvas, and a custom engine. Features a WebGL2 post-processing pipeline for real-time lighting and shadows, day/night cycle, campfire with particle effects, NPC interactions, and a branching dialog system.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Controls

### Desktop (keyboard + mouse)

| Input | Action |
|---|---|
| `WASD` / Arrow keys | Move |
| `Shift` (hold) | Run (1.8× speed) |
| `E` | Interact with NPC / objects |
| `↑` `↓` / `W` `S` | Navigate dialog choices |
| `Enter` / `Space` | Confirm dialog choice |
| `ESC` | Close dialog / overlay |
| Mouse wheel | Zoom in/out |
| `I` | Toggle inventory |
| `J` | Toggle quest log |
| `T` | Toggle day/night mode |
| `N` | Toggle snowfall |
| `H` | Controls help overlay |
| `Q` | Toggle quest HUD |
| `U` | Toggle debug info |
| `L` | Toggle lighting/shadows |
| `G` (hold) | Show debug grid overlay |

### Touch (phones / tablets)

| Control | Action |
|---|---|
| Virtual joystick (bottom-left) | Move; push past 60% radius to run |
| 🤚 action button (bottom-right) | Contextual interact — appears near NPCs/objects with dynamic label |
| 🎒 button (top-right HUD) | Open inventory (merged with inventory preview) |
| 📜 button (top-right HUD) | Toggle quest log |
| Pinch | Zoom in/out |
| Tap dialog choice | Select choice; ✕ button closes dialog |
| Tap overlay backdrop | Dismiss item preview / note |
| ✕ close button | Close inventory / quest log (visible on touch only) |

Platform detection is automatic — desktop, touch-only, and hybrid (laptop + touchscreen) are all supported.

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
│       ├── objects/                   Houses, trees, stones, campfire, sticks, barrel, lighter, paper
│       └── tiles/                    Isometric ground tiles
├── src/
│   ├── main.ts                       Boot: load manifest → init Game
│   ├── core/
│   │   ├── Game.ts                   Orchestrator: loop, system wiring, toggles, profile transitions
│   │   ├── GameState.ts              State stack (Playing, Dialog, Inventory, etc.)
│   │   ├── EntityManager.ts          Central entity registry + spatial queries
│   │   ├── EventBus.ts               Typed pub/sub event system
│   │   ├── InputManager.ts           Aggregates InputProvider[] — action queries, consumeAction, movement, pointer
│   │   ├── InputProvider.ts          InputProvider interface (isActionActive, consumeAction, movement, pointer)
│   │   ├── GameFlags.ts              Persistent game state (booleans, counters)
│   │   ├── AssetLoader.ts            Image loader/cache
│   │   ├── AssetManifest.ts          JSON manifest loader
│   │   ├── Config.ts                 All constants centralized
│   │   └── Types.ts                  Shared types (Direction)
│   ├── entities/
│   │   ├── Entity.ts                 Base entity (optional components)
│   │   ├── Player.ts                 Player with input-driven movement
│   │   ├── NPC.ts                    NPC with walk-to, fade-in, sleep, state machine
│   │   ├── Campfire.ts               Campfire entity with spark particles
│   │   ├── Collectible.ts            World item pickup with animations
│   │   ├── InteractableObject.ts     Invisible press-E interaction entity
│   │   ├── TriggerZone.ts            Pass-through zone with enter/exit events
│   │   ├── Components.ts             Transform, Velocity, Collider
│   │   └── AnimationController.ts    Sprite sheet animation state machine
│   ├── systems/
│   │   ├── InteractionSystem.ts      Proximity detection, interact via consumeAction, prompt display
│   │   ├── GameplaySystem.ts         Collectibles, campfire, floating text, triggers, onboarding
│   │   ├── KeyboardInputProvider.ts  Desktop: keyboard + mouse + justPressed tracking for consumeAction
│   │   ├── TouchInputProvider.ts     Touch: semi-transparent joystick, contextual action, pinch zoom, safe-area support
│   │   ├── PhysicsSystem.ts          Movement + tile/object/entity collision
│   │   └── AnimationSystem.ts        Animation state updates
│   ├── rendering/
│   │   ├── RenderOrchestrator.ts     Full render pipeline: enqueue, flush, post-process, markers
│   │   ├── Renderer.ts               Canvas draw queue, Z-sorting, layers, profile-driven effects
│   │   ├── Camera.ts                 Viewport with smooth follow & zoom
│   │   ├── IsometricUtils.ts         Coordinate conversion
│   │   ├── PostProcessPipeline.ts    WebGL2 lighting & shadows
│   │   ├── LightingProfile.ts        Day/night presets + lerp transition + fog/snow profiles
│   │   └── effects/
│   │       ├── FireLightEffect.ts    Procedural fire flicker (breath+wobble+crackle)
│   │       ├── SnowfallEffect.ts     Particle snowfall (profile-driven opacity)
│   │       └── FogEffect.ts          Decoupled vignette + animated fog wisps
│   ├── scenes/
│   │   └── ForestSceneSetup.ts       Entity spawning + animation registration for forest scene
│   ├── dialog/
│   │   └── DialogData.ts             Dialog tree model + sample dialog
│   ├── items/
│   │   ├── ItemDef.ts                Item type registry (glowColor support)
│   │   └── Inventory.ts              Player inventory singleton
│   ├── quests/
│   │   ├── QuestDef.ts               Quest + objective data model
│   │   └── QuestTracker.ts           Runtime quest state + event listeners
│   ├── states/
│   │   ├── PlayingState.ts           Default state — delegates to Game._update/_render
│   │   ├── DialogState.ts            Game state for active dialog
│   │   ├── InventoryState.ts         Inventory overlay state
│   │   ├── QuestLogState.ts          Quest log overlay state
│   │   └── ItemPreviewState.ts       Item preview overlay state
│   ├── ui/
│   │   ├── DialogUI.ts               Bottom-of-screen dialog with choices + touch close
│   │   ├── InventoryUI.ts            Inventory list with keyboard nav + touch tap + close
│   │   ├── ItemPreviewUI.ts          Full-size item preview with glow + tap-to-dismiss
│   │   ├── QuestLogUI.ts             Quest log overlay + touch close
│   │   ├── NoteUI.ts                 Parchment overlay for wall note + tap-to-dismiss
│   │   ├── ControlsHelpUI.ts         Controls help overlay (H key)
│   │   └── HUD.ts                    Debug overlay + quest HUD + inventory preview (🎒/📜)
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
| **[Rendering](docs/rendering.md)** | Render pipeline, lighting & shadow system, day/night profiles, fire effects, fog, snowfall |
| **[Content Guide](docs/content-guide.md)** | World coordinates, adding tiles/objects/animations/NPCs/dialogs |
| **[Roadmap](docs/roadmap.md)** | Completed work, remaining tasks, priority matrix |

## License

Private project.
