# Architecture

> Engine design, core systems, entity model, events, physics, input, game states.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (Client-Side)                       │
├─────────────────────────────────────────────────────────────────┤
│  Game Application Layer                                         │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │  Game.ts   │  │ GameState      │  │  DialogState /        │ │
│  │  (loop)    │  │ Manager        │  │  PlayingState         │ │
│  └────────────┘  └────────────────┘  └───────────────────────┘ │
│                                                                 │
│  Game Engine Layer                                              │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │ Renderer   │  │  Physics   │  │  Animation System        │ │
│  │ (Canvas2D) │  │  System    │  │                          │ │
│  └────────────┘  └────────────┘  └──────────────────────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │  Input     │  │  PostProc  │  │  Effects (Snow, Fog,     │ │
│  │  Manager   │  │  (WebGL2)  │  │  FireLight)              │ │
│  └────────────┘  └────────────┘  └──────────────────────────┘ │
│  ┌────────────┐                                                │
│  │  Lighting  │  ← Day/night profiles, smooth transitions      │
│  │  Profile   │                                                │
│  └────────────┘                                                │
│                                                                 │
│  Core Systems Layer                                             │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │  Asset     │  │  Entity    │  │  EventBus (typed)        │ │
│  │  Loader    │  │  Manager   │  │                          │ │
│  └────────────┘  └────────────┘  └──────────────────────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │  Config    │  │  TileMap   │  │  Isometric Grid          │ │
│  └────────────┘  └────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
User Input → InputSystem → InputManager (action mapping)
                                ↓
                          Player.handleInput()
                                ↓
                          PhysicsSystem.update()
                            ├─ Tile walkability
                            ├─ Object collision
                            └─ Entity-vs-entity collision
                                ↓
                          AnimationSystem.update()
                                ↓
                          NPC.update() (walk-to, fade-in)
                          Campfire.updateSparks()
                                ↓
                          Interaction check (proximity)
                                ↓
                          Toggle checks (snow, day/night, lighting)
                                ↓
                          applyLightingProfile() → PostProcess + Renderer
                                ↓
                          Renderer.enqueue() → Z-sort → Canvas draw
                                ↓
                          PostProcessPipeline.render() (WebGL2 lighting)
                                ↓
                          DOM overlays (dialog, markers)
```

---

## Coordinate System

The game uses a standard isometric projection with a 2:1 diamond ratio.

| Space | Description |
|-------|-------------|
| **Grid** `(col, row)` | Logical tile positions. Fractional values place entities between tiles. |
| **World** `(x, y)` | Pixel positions after isometric projection via `isoToScreen()`. |
| **Screen** `(x, y)` | World coordinates transformed by camera (pan + zoom) via `camera.worldToScreen()`. |

Conversion functions live in `src/rendering/IsometricUtils.ts`:

- `isoToScreen(col, row)` → world pixel position
- `screenToIso(x, y)` → grid position
- `depthOf(col, row, z)` → Z-sort value for painter's algorithm

Axis orientation:

```
           col+ (screen-right ↘)
          /
   (0,0) ─────►
         \
          row+ (screen-left ↙)
```

- **col increases** → screen bottom-right
- **row increases** → screen bottom-left
- **(col+row) increases** → straight down on screen

---

## Entity System

Flexible pseudo-ECS where only `transform` is mandatory. All other components are optional — systems null-check before processing.

```typescript
class Entity {
  id: string;
  transform: Transform;                         // Always present — grid position
  velocity: Velocity | null;                    // Needed for movement/physics
  collider: Collider | null;                    // Needed for collision (has solid flag)
  animController: AnimationController | null;   // Needed for animated sprites
  opacity: number;                // 0–1, for fade effects
  blobShadow: { rx, ry, opacity } | null;      // Per-entity ground shadow
  interactable: boolean;                        // Can player interact with this entity?
  drawScale: number;                            // Sprite scaling factor
  layer: 'ground' | 'object' | 'character';    // Render layer hint
}
```

### Concrete Entity Types

| Type | Components | Purpose |
|------|-----------|---------|
| **Player** | velocity ✓, collider ✓ (solid), animController ✓, blobShadow ✓ | Player-controlled character |
| **NPC** | velocity ✓, collider ✓ (solid when idle), animController ✓, blobShadow ✓ | Walk-to behavior, dialog interaction |
| **Campfire** | collider ✓ (solid), animController ✓, blobShadow ✓ | Animated fire with spark particles, gated by lighting profile |

### EntityManager

Central registry (`src/core/EntityManager.ts`). All entities are added here and queried by systems.

| Method | Description |
|--------|-------------|
| `add(entity)` | Register entity, emits `entity:added` |
| `remove(id)` | Remove entity, emits `entity:removed` |
| `get(id)` | Lookup by id |
| `getAll()` | All entities as array |
| `getByPrefix(prefix)` | Filter by id prefix (e.g., `"npc_"`) |
| `getInRadius(x, y, r)` | Spatial query in grid units |

---

## Game State Stack

The `GameStateManager` (`src/core/GameState.ts`) maintains a stack of states. The topmost state drives the frame.

```
PLAYING → push DIALOG → (player frozen, game renders underneath) → pop → PLAYING
```

Each state defines:

| Property | Effect |
|----------|--------|
| `isTransparent` | If `true`, the state below is also rendered (e.g., game world visible behind dialog) |
| `blocksUpdate` | If `true`, states below don't receive `update()` calls (e.g., player frozen during dialog) |

**Lifecycle hooks:** `onEnter()`, `onExit()`, `onPause()`, `onResume()`.

### Active States

| State | Transparent | Blocks Update | Purpose |
|-------|-------------|---------------|---------|
| `PlayingState` | No | No | Main gameplay — delegates to `Game._update()` / `Game._render()` |
| `DialogState` | Yes | Yes | Displays dialog UI, pauses game logic, handles choice navigation |

---

## Event System

Typed pub/sub bus (`src/core/EventBus.ts`). All event names and payloads are compile-time checked via the `GameEvents` interface.

```typescript
interface GameEvents {
  'entity:added':      { entity: Entity };
  'entity:removed':    { entityId: string };
  'player:moved':      { x: number; y: number };
  'trigger:enter':     { zoneId: string; entityId: string };
  'trigger:exit':      { zoneId: string; entityId: string };
  'interaction:start': { targetId: string };
  'interaction:end':   { targetId: string };
  'dialog:open':       { dialogId: string; npcId: string };
  'dialog:choice':     { dialogId: string; choiceIndex: number };
  'dialog:close':      { dialogId: string };
  'item:collected':    { itemId: string; entityId: string };
  'inventory:changed': { items: string[] };
  'scene:transition':  { from: string; to: string };
  'input:action':      { action: string; state: 'pressed' | 'released' };
}
```

Usage:

```typescript
eventBus.on('dialog:open', ({ dialogId, npcId }) => { /* ... */ });
eventBus.emit('player:moved', { x: 3.5, y: 4.0 });
```

To add a new event: add a key + payload type to `GameEvents` in `src/core/EventBus.ts`.

---

## Input System

Two layers:

1. **InputSystem** (`src/systems/InputSystem.ts`) — Raw keyboard/mouse state tracking. Captures `keydown`/`keyup`/`mousemove`/`wheel` events.

2. **InputManager** (`src/core/InputManager.ts`) — Maps raw key codes to semantic `Action` enums. Game code queries `InputManager`, never raw key codes.

### Actions

| Action | Default Keys | Purpose |
|--------|-------------|---------|
| `MOVE_UP` | `W`, `↑` | Movement |
| `MOVE_DOWN` | `S`, `↓` | Movement |
| `MOVE_LEFT` | `A`, `←` | Movement |
| `MOVE_RIGHT` | `D`, `→` | Movement |
| `RUN` | `Shift` | Sprint modifier |
| `INTERACT` | `E` | Talk to NPC / interact |
| `TOGGLE_LIGHT` | `L` | Toggle post-processing |
| `TOGGLE_SNOW` | `N` | Toggle snowfall |
| `TOGGLE_TIME` | `T` | Toggle day/night mode |
| `DEBUG_GRID` | `G` | Show debug grid |
| `PAUSE` | `Escape` | Pause / close dialog |

Bindings can be changed at runtime via `inputManager.rebind(Action, codes[])`.

---

## Physics & Collision

`PhysicsSystem` (`src/systems/PhysicsSystem.ts`) processes entities with both `velocity` and `collider` components. Movement is resolved per-axis (X then Y) with three collision layers:

1. **Tile walkability** — grid cells the entity's AABB overlaps must be walkable
2. **Tile-map objects** — static objects (trees, rocks) via `TileMap.collidesWithObject()`
3. **Entity-vs-entity** — AABB overlap between solid entities

### Special Behaviors

| Behavior | Implementation |
|----------|---------------|
| **Non-solid passthrough** | Only solid entities check against other entities. NPCs in `WALKING` state set `collider.solid = false` to walk through the player. |
| **Overlap escape** | If an entity already overlaps a solid entity at its current position, movement is allowed. Prevents the player from getting frozen when an NPC becomes solid on top of them. |
| **Map clamping** | Entity positions are clamped to `[0, mapCols/Rows]` after movement. |

---

## NPC Lifecycle

```
SPAWN (transparent, non-solid)
  → fade in over fadeDuration seconds
  → walk toward (targetCol, targetRow)
  → ARRIVE: snap to target, solid=true, interactable=true
  → idle animation + floating interact marker (SVG arrow)
  → player approaches within NPC_INTERACT_RADIUS → "Press E to talk"
  → player presses E → DialogState pushed
  → dialog completes / ESC → DialogState popped → PLAYING
```

The NPC class (`src/entities/NPC.ts`) manages its own state machine (`WALKING → IDLE`) and velocity aim.

---

## Campfire Entity

`src/entities/Campfire.ts` — animated fire with a particle spark system.

- Renders using `AnimationController` with a procedurally generated sprite sheet (`campfire_anim`)
- Also renders a static `obj_campfire` PNG on the ground layer (beneath the player)
- Manages its own `sparks` array — particles that rise, drift, and fade
- Has a solid `Collider` (configurable `hw`/`hh`)
- `opacity` is driven by `LightingProfile.fireOpacity` for smooth day/night transitions

### Spark Particles

Each spark has: position offset (`ox`, `oy`), velocity (`vx`, `vy`), `life`/`maxLife`, `radius`, `hue` (orange→yellow gradient). Rendered with a radial gradient glow + solid pixel in `Game.drawCampfireSparks()`.

---

## Dialog System

Three files cooperate:

| File | Role |
|------|------|
| `src/dialog/DialogData.ts` | Data model (`DialogTree`, `DialogNode`, `DialogChoice`) + registry + sample dialog |
| `src/ui/DialogUI.ts` | DOM-based UI rendering: speaker name, text, choice list, controls hint bar |
| `src/states/DialogState.ts` | Game state: pauses gameplay, drives dialog node progression, handles input |

### Dialog Data Model

```typescript
interface DialogTree {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogNode>;
}

interface DialogNode {
  speaker: string;
  text: string;
  choices: DialogChoice[];
}

interface DialogChoice {
  text: string;
  nextNodeId: string | null;  // null = end conversation
}
```

Dialogs are registered at import time via `registerDialog(tree)` and looked up by id via `getDialogTree(id)`.

### Dialog Controls

| Input | Action |
|-------|--------|
| `↑` / `↓` or `W` / `S` | Navigate choices |
| `Enter` / `Space` | Confirm choice |
| `ESC` | Close dialog at any time |
| Mouse hover + click | Also supported |

---

## Asset Loading

Boot sequence in `src/main.ts`:

1. Generate procedural fallback assets (canvas-drawn placeholders)
2. Load asset manifest from `public/assets/data/assets.json`
3. Load all PNGs listed in manifest — on success they override procedural versions
4. Generate world and start the game loop

The game runs even if PNG files are missing (falls back to procedural).

### Asset Manifest Format

```json
{
  "assets": [
    { "id": "tile_grass",    "path": "/assets/sprites/tiles/ground_snow_thick.png" },
    { "id": "char_idle",     "path": "/assets/sprites/characters/player_idle.png" },
    { "id": "dog_walk_west", "path": "/assets/sprites/characters/dog_walk_west.png" }
  ]
}
```

To add a new asset: add an entry to `public/assets/data/assets.json`. The `id` is used to reference the asset in code via `assetLoader.getAsset(id)`.

---

## Camera

`src/rendering/Camera.ts` — viewport with smooth-follow and zoom.

| Feature | Details |
|---------|---------|
| **Follow** | Smooth-follows the player's world position |
| **Zoom** | Range `CAMERA_ZOOM_MIN` to `CAMERA_ZOOM_MAX`, step `CAMERA_ZOOM_STEP` |
| **Frustum culling** | Renderer skips off-screen tiles and objects |
| **Coordinate transform** | `worldToScreen(wx, wy)` → screen position with pan + zoom |

---

## Configuration

All tunable constants are centralized in `src/core/Config.ts` as a single `const` object with `as const` for type safety. Categories include:

- Tile and canvas dimensions
- Character sprite dimensions and scaling
- Player defaults (position, speed, run multiplier)
- Camera (zoom range, default zoom)
- Lighting (ambient, sky light, window light — used as initial values; overridden by lighting profiles at runtime)
- Shadows (radius, offset, length multiplier, height fade)
- Volumetric shading (diffuse, rim light)
- Fog (boundary padding, wisp parameters)
- Snowfall (particle count, speed, wind, layers)
- Dog NPC (sprite dimensions, speed, spawn/target position, fade duration)
- Campfire (position, draw height, light color/radius/intensity, shadow radius)
- Interaction (NPC interact radius)

### Lighting Profiles

Runtime lighting state is managed by `LightingProfile` objects (`src/rendering/LightingProfile.ts`), not raw `Config` values. Two presets are defined:

| Profile | Ambient | Background | Shadows | Point Lights | Fire |
|---------|---------|------------|---------|--------------|------|
| `NIGHT_PROFILE` | Dark blue (0.18, 0.22, 0.38) | Deep navy | Long, full opacity | On | On |
| `DAY_PROFILE` | Bright neutral (0.95, 0.95, 0.95) | Sky blue | Short, faint (0.25 opacity) | Off | Off |

Profiles are lerped with ease-in-out over 1.5 seconds when toggled with `T`. See `docs/rendering.md` for full details.

See `src/core/Config.ts` for the full list with inline documentation.
