# Architecture

> Engine design, core systems, entity model, events, physics, input, game states, items, quests.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (Client-Side)                       │
├─────────────────────────────────────────────────────────────────┤
│  Game Application Layer                                         │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │  Game.ts   │  │ GameState      │  │  DialogState /        │ │
│  │  (loop)    │  │ Manager        │  │  InventoryState /     │ │
│  │            │  │                │  │  QuestLogState /      │ │
│  │            │  │                │  │  ItemPreviewState     │ │
│  └────────────┘  └────────────────┘  └───────────────────────┘ │
│                                                                 │
│  Item & Quest Layer                                             │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │ ItemDef    │  │ Inventory  │  │  QuestDef / QuestTracker │ │
│  │ Registry   │  │            │  │                          │ │
│  └────────────┘  └────────────┘  └──────────────────────────┘ │
│  ┌────────────┐                                                │
│  │ GameFlags  │  ← Persistent game state (booleans, counters)  │
│  └────────────┘                                                │
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
│                                                                 │
│  UI Layer                                                       │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │  DialogUI  │  │ InventoryUI│  │  QuestLogUI /            │ │
│  │            │  │            │  │  ItemPreviewUI / HUD /   │ │
│  │            │  │            │  │  ControlsHelpUI          │ │
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
                          NPC.update() (re-aim steering, fade-in)
                          Campfire.updateSparks()
                          Collectible.update() (bob, pickup anim, launch arc)
                                ↓
                          updateCollectibles() — auto-pickup, item preview trigger
                          updateInteraction() — Press E dispatch
                          updateCampfireInteractable() — dynamic enable/disable
                          updateTriggerZones() — enter/exit events
                          updatePendingEvents() — timed callbacks
                                ↓
                          Toggle checks (snow, day/night, lighting, inventory, quest log)
                                ↓
                          applyLightingProfile() → PostProcess + Renderer
                                ↓
                          Renderer.enqueue() → Z-sort → Canvas draw
                          Floating text particles (world-to-screen)
                                ↓
                          PostProcessPipeline.render() (WebGL2 lighting)
                                ↓
                          Marker canvas overlay (above post-process, below DOM)
                                ↓
                          DOM overlays (dialog, inventory, quest log, item preview, HUD)
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
  interactLabel: string;                        // Dynamic prompt text ("talk", "collect sticks", etc.)
  drawScale: number;                            // Sprite scaling factor
  layer: 'ground' | 'object' | 'character';    // Render layer hint
}
```

### Concrete Entity Types

| Type | Components | Purpose |
|------|-----------|---------|
| **Player** | velocity ✓, collider ✓ (solid), animController ✓, blobShadow ✓ | Player-controlled character |
| **NPC** | velocity ✓, collider ✓ (solid when idle), animController ✓, blobShadow ✓ | Walk-to behavior with re-aim steering, dialog interaction |
| **Campfire** | collider ✓ (solid), animController ✓, blobShadow ✓ | Animated fire with spark particles, burst() for dramatic effects |
| **Collectible** | — | World item pickup with bob, pickup animation, parabolic launch arc |
| **InteractableObject** | — | Invisible entity for press-E interactions on static objects (stick piles, campfire) |
| **TriggerZone** | — | Invisible pass-through zone firing enter/exit events |

### Collectible States

```
IDLE (bob animation, glow)
  → player enters pickup radius →
PICKING_UP (scale up + fade out)
  → animation complete →
DONE (removed by EntityManager)

-- Or, for launched items: --
LAUNCHING (parabolic arc from source to target)
  → arc complete →
IDLE (bob animation, glow)
```

### InteractableObject

Generic invisible entity for press-E interactions on static world objects. Used for:

- **Stick piles** — collect sticks, removes TileMap visual, depletes interactable
- **Campfire** — dynamically enabled when player has 2 sticks + quest active, consumes sticks, triggers fire burst + secret item

Options: `label`, `onInteract` callback, `radius`, `oneShot` flag.

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
PLAYING → push INVENTORY → (player frozen, game renders underneath) → pop → PLAYING
PLAYING → push ITEM_PREVIEW → (player frozen, game renders underneath) → pop → PLAYING
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
| `InventoryState` | Yes | Yes | Displays inventory UI overlay, toggled with I key |
| `QuestLogState` | Yes | Yes | Displays quest log overlay, toggled with J key |
| `ItemPreviewState` | Yes | Yes | Displays item discovery preview (icon, name, description). Triggered on pickup of non-stackable items. Dismisses with Enter/Space/ESC. |

---

## GameFlags

Persistent game state singleton (`src/core/GameFlags.ts`). Stores arbitrary key-value pairs used by quests, dialog conditions, and item gating.

| Method | Description |
|--------|-------------|
| `set(key, value)` | Set any value |
| `get(key)` | Get value (returns `undefined` if unset) |
| `getBool(key)` | Get boolean (defaults to `false`) |
| `getNumber(key)` | Get number (defaults to `0`) |

Used by:
- Quest completion flags (`quest_gather_sticks_done`)
- Campfire state (`sticks_in_fire`)
- Dialog condition callbacks

---

## Item & Inventory System

### Item Definitions (`src/items/ItemDef.ts`)

```typescript
interface ItemDef {
  id: string;
  name: string;
  description: string;
  iconAssetId: string;    // Procedural sprite id for UI
  stackable: boolean;
  maxStack: number;
}
```

Built-in items: `stick`, `bone`, `stone`, `ancient_ember`.

Items are registered via `registerItems()` and looked up via `getItemDef(id)`.

### Inventory (`src/items/Inventory.ts`)

Singleton managing the player's item collection.

| Method | Description |
|--------|-------------|
| `add(itemId, count, source?)` | Add items. Returns count actually added. Emits `inventory:changed`. |
| `remove(itemId, count)` | Remove items. Returns count actually removed. Emits `inventory:changed`. |
| `has(itemId, count?)` | Check if player has at least `count` of an item |
| `count(itemId)` | Get current count |
| `getAll()` | All inventory entries |

Source tracking prevents duplicate pickups from the same collectible entity.

---

## Quest System

### Quest Definitions (`src/quests/QuestDef.ts`)

```typescript
interface QuestDef {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  completionFlag: string;    // GameFlags key set on completion
}

interface QuestObjective {
  description: string;
  type: 'collect' | 'talk' | 'flag';
  target: string;             // item id (collect), dialog id (talk), or flag key (flag)
  required: number;
}
```

Built-in quests: `q_gather_sticks` (collect sticks + feed campfire), `q_dog_bone` (find and give bone).

### QuestTracker (`src/quests/QuestTracker.ts`)

Runtime manager for quest state. Listens to EventBus events and auto-advances objectives.

| Method | Description |
|--------|-------------|
| `startQuest(id)` | Activate a quest |
| `getActiveQuests()` | All currently active quests |
| `getCompletedQuests()` | All completed quests |
| `checkFlags()` | Re-evaluate 'flag' type objectives against GameFlags |

Event listeners:
- `collectible:pickup` → advances 'collect' objectives
- `inventory:changed` → re-checks 'collect' objectives
- `dialog:open` → advances 'talk' objectives
- `dialog:choice` → re-evaluates 'flag' objectives via `checkFlagObjectives()`

Emits: `quest:started`, `quest:completed`, `quest:objective_completed`, `quest:objective_progress`.

---

## Event System

Typed pub/sub bus (`src/core/EventBus.ts`). All event names and payloads are compile-time checked via the `GameEvents` interface.

```typescript
interface GameEvents {
  'entity:added':              { entity: Entity };
  'entity:removed':            { entityId: string };
  'player:moved':              { x: number; y: number };
  'trigger:enter':             { zoneId: string; entityId: string };
  'trigger:exit':              { zoneId: string; entityId: string };
  'interaction:start':         { targetId: string };
  'interaction:end':           { targetId: string };
  'dialog:open':               { dialogId: string; npcId: string };
  'dialog:choice':             { dialogId: string; choiceIndex: number };
  'dialog:close':              { dialogId: string };
  'item:collected':            { itemId: string; entityId: string };
  'inventory:changed':         { itemId: string; count: number; total: number };
  'collectible:pickup':        { collectibleId: string; itemId: string };
  'scene:transition':          { from: string; to: string };
  'input:action':              { action: string; state: 'pressed' | 'released' };
  'quest:started':             { questId: string };
  'quest:completed':           { questId: string };
  'quest:failed':              { questId: string };
  'quest:objective_completed': { questId: string; objectiveIndex: number };
  'quest:objective_progress':  { questId: string; objectiveIndex: number; current: number; required: number };
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
| `INTERACT` | `E` | Talk to NPC / interact with objects |
| `TOGGLE_LIGHT` | `L` | Toggle post-processing |
| `TOGGLE_SNOW` | `N` | Toggle snowfall |
| `TOGGLE_TIME` | `T` | Toggle day/night mode |
| `DEBUG_GRID` | `G` | Show debug grid |
| `PAUSE` | `Escape` | Close any open overlay (dialog, inventory, quest log, controls help) |
| `INVENTORY` | `I` | Toggle inventory overlay |
| `QUEST_LOG` | `J` | Toggle quest log overlay |
| `CONTROLS_HELP` | `H` | Toggle controls help overlay |
| `TOGGLE_DEBUG` | `U` | Toggle debug info panels |
| `TOGGLE_QUEST_HUD` | `Q` | Toggle quest HUD tracker |

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
  → walk toward (targetCol, targetRow) with re-aim steering each frame
  → ARRIVE: snap to target (overshoot guard), solid=true, interactable=true
  → idle animation + floating interact marker (canvas-rendered pixel-art arrow)
  → player approaches within NPC_ONBOARD_RADIUS → [E] badge appears
  → player approaches within NPC_INTERACT_RADIUS → "Press E to talk"
  → player presses E → DialogState pushed
  → dialog completes / ESC → DialogState popped → PLAYING
```

The NPC class (`src/entities/NPC.ts`) manages its own state machine (`WALKING → IDLE`). Velocity is recomputed each frame to point at the target (seek steering), with an overshoot guard: `arrivalThreshold = max(0.1, stepSize)`.

---

## Animation Controller

`src/entities/AnimationController.ts` — manages sprite-sheet frame advancement for any entity.

### Stop Behavior

When the entity stops moving (`setFromVelocity` detects zero velocity):

1. **Snap to frame 0** — resets `currentFrame` and `elapsed` to 0, showing the neutral standing pose
2. **Freeze** — frame advancement is paused (`frozen = true`)
3. **Idle timeout** — after `IDLE_TIMEOUT` seconds (10s) of inactivity, switches from the frozen walk animation to the dedicated idle animation (`idle_{direction}`)

This prevents the character from appearing stuck mid-stride when the player releases movement keys.

---

## Campfire Entity

`src/entities/Campfire.ts` — animated fire with a particle spark system.

- Renders using `AnimationController` with a procedurally generated sprite sheet (`campfire_anim`)
- Also renders a static `obj_campfire` PNG on the ground layer (beneath the player)
- Manages its own `sparks` array — particles that rise, drift, and fade
- Has a solid `Collider` (configurable `hw`/`hh`)
- `opacity` is driven by `LightingProfile.fireOpacity` for smooth day/night transitions
- `burst(duration)` — dramatically increases spark emission rate and max sparks for a timed period (used for campfire interaction feedback)

### Spark Particles

Each spark has: position offset (`ox`, `oy`), velocity (`vx`, `vy`), `life`/`maxLife`, `radius`, `hue` (orange→yellow gradient). Rendered with a radial gradient glow + solid pixel in `Game.drawCampfireSparks()`.

---

## Dialog System

Three files cooperate:

| File | Role |
|------|------|
| `src/dialog/DialogData.ts` | Data model (`DialogTree`, `DialogNode`, `DialogChoice`) + registry + quest-integrated dialog |
| `src/ui/DialogUI.ts` | DOM-based UI rendering: speaker name, text, choice list, controls hint bar |
| `src/states/DialogState.ts` | Game state: pauses gameplay, drives dialog node progression, filters choices, handles input |

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
  condition?: (flags: GameFlags, inventory: Inventory, quests: QuestTracker) => boolean;
  onSelect?: (flags: GameFlags, inventory: Inventory, quests: QuestTracker) => void;
}
```

- **`condition`** — if present, the choice is only shown when `condition()` returns `true`. Evaluated each time the node is displayed.
- **`onSelect`** — if present, called when the player selects the choice. Used for quest advancement, item transfers, flag setting.

Dialogs are registered at import time via `registerDialog(tree)` and looked up by id via `getDialogTree(id)`.

### Dialog Controls

| Input | Action |
|-------|--------|
| `↑` / `↓` or `W` / `S` | Navigate choices |
| `Enter` / `Space` | Confirm choice |
| `ESC` | Close dialog at any time |
| Mouse hover + click | Also supported |

### ESC Close Behavior (All Modals)

All overlay panels are dismissible with `ESC`:

| Modal | ESC Handler |
|-------|-------------|
| Dialog | `DialogUI` keydown listener (immediate, with `stopPropagation`) |
| Item Preview | `ItemPreviewUI` keydown listener (delayed 1 frame to avoid pickup key collision) |
| Inventory | `Game._update()` — `Action.PAUSE` check |
| Quest Log | `Game._update()` — `Action.PAUSE` check |
| Controls Help | `Game._update()` — `Action.PAUSE` check |

Priority when multiple panels are open: Inventory > Quest Log > Controls Help (checked in that order in `_update()`).

---

## Item Preview Dialog

`src/states/ItemPreviewState.ts` + `src/ui/ItemPreviewUI.ts` — a special overlay shown when the player discovers a non-stackable item (e.g., Ancient Ember).

- **Trigger**: In `updateCollectibles()`, when a picked-up item has `stackable === false`, an `ItemPreviewState` is pushed.
- **Display**: Centered overlay with dark scrim, item icon scaled to 64×64 with pixel-art rendering (`imageSmoothingEnabled = false`) and glow drop-shadow, item name, and description.
- **Dismiss**: Enter, Space, or Escape. The state pops itself and the game resumes.

---

## Interaction Markers

Interaction markers (pixel-art arrow + `[E]` badge) are rendered on a dedicated `markerCanvas` — a third canvas layer that sits between the WebGL post-process canvas and DOM UI overlays.

### Canvas Stack (bottom to top)

| Layer | z-index | Content |
|-------|---------|---------|
| Main Canvas (2D) | 0 | Game world: tiles, objects, entities |
| WebGL Canvas | 1 | Post-processing: lighting, shadows, volumetric |
| Marker Canvas | 2 | Interaction markers (arrow + `[E]` badge) |
| DOM Overlays | 10+ | Dialog, inventory, quest log, HUD |

### Why a Separate Canvas?

- **Above post-processing**: Markers remain at full brightness regardless of lighting/shadow state.
- **Above static objects**: Markers float above trees and other world objects to stay visible.
- **Below player** (when appropriate): Player occlusion is achieved via `globalCompositeOperation = 'destination-out'` — the player's sprite is drawn on the marker canvas to erase marker pixels where the player should appear in front (based on depth comparison).
- **Below DOM UI**: Markers don't obscure dialog, inventory, or other UI panels.

### Visibility Rules

- Markers are hidden when any modal state is active (`stateManager.size > 1`).
- The `[E]` badge only appears when the entity is the nearest interactable within `NPC_ONBOARD_RADIUS`.
- The arrow marker appears for all interactable entities within render distance.

---

## Controls Help Overlay

`src/ui/ControlsHelpUI.ts` — an HTML overlay listing all game controls, organized by category (Movement, Interaction, Environment, Debug).

- **Toggle**: `H` key (edge-triggered via `CONTROLS_HELP` action). Also dismissible with `ESC`.
- **Display**: Centered overlay with categorized control listing, keyboard key badges, and descriptions.
- **State**: Not a game state — it's a simple DOM visibility toggle managed in `Game._update()`. Same for Inventory (`I` key) and Quest Log (`J` key).

---

## HUD & Debug Panels

`src/ui/HUD.ts` — manages three UI elements:

| Panel | Default | Toggle | Content |
|-------|---------|--------|---------|
| **Debug info** (top-left) | Hidden | `U` key | Player position, direction, item count |
| **Debug overlay** (top-right) | Hidden | `U` key | FPS, zoom, map size, object count |
| **Quest HUD** (top-right) | Visible | `Q` key | Active quest objectives with progress |

Debug panels (`U`) and quest HUD (`Q`) are independently togglable. Both are edge-triggered in `Game._render()`.

---

## Pending Events System

A simple timer-based callback queue in `Game.ts`. Events are pushed with a `timer` (seconds) and a `callback`. Each frame, timers decrement; when expired, the callback fires and the event is removed.

Used for:
- Delayed secret item spawn after campfire fire burst (1.5s delay)
- Dog NPC spawn delay (`DOG_SPAWN_DELAY` = 2s)

---

## Asset Loading

Boot sequence in `src/main.ts`:

1. Generate procedural fallback assets (canvas-drawn placeholders + item icons + world sprites)
2. Load asset manifest from `public/assets/data/assets.json` (paths resolved relative to `import.meta.env.BASE_URL`)
3. Load all PNGs listed in manifest — on success they override procedural versions
4. Generate world and start the game loop

The game runs even if PNG files are missing (falls back to procedural).

### Sub-Path Deployment

The game supports deployment under a sub-path (e.g., `/doors/1/`) via Vite's `base` config. Asset paths in `AssetManifest.ts` are prepended with `import.meta.env.BASE_URL` at runtime, so the same code works both at the root and under sub-paths.

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
- Interaction (NPC interact radius, NPC onboard radius for `[E]` badge)
- Dog spawn delay

### Lighting Profiles

Runtime lighting state is managed by `LightingProfile` objects (`src/rendering/LightingProfile.ts`), not raw `Config` values. Two presets are defined:

| Profile | Ambient | Background | Shadows | Point Lights | Fire | Snow | Vignette | Fog Wisps |
|---------|---------|------------|---------|--------------|------|------|----------|-----------|
| `NIGHT_PROFILE` | Dark blue (0.18, 0.22, 0.38) | Deep navy | Long, full opacity | On | On | Full | Dark, full opacity | Dark, additive glow |
| `DAY_PROFILE` | Bright neutral (0.95, 0.95, 0.95) | Sky blue | Short, faint (0.25 opacity) | Off | Off | Subtle (0.1) | Blue-grey, 0.7 opacity | Light grey, normal blend |

Profiles control snow opacity, boundary vignette (color + opacity), and animated fog wisps (color + opacity + blend mode) in addition to lighting and shadow parameters. All values lerp smoothly with ease-in-out over 1.5 seconds when toggled with `T`. See `docs/rendering.md` for full details.

See `src/core/Config.ts` for the full list with inline documentation.
