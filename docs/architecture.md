# Architecture

> Engine design, core systems, entity model, events, physics, input, game states, items, quests.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (Client-Side)                       │
├─────────────────────────────────────────────────────────────────┤
│  Game Orchestration Layer                                       │
│  ┌────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │  Game.ts   │  │ GameState      │  │  PlayingState /       │ │
│  │  (loop,    │  │ Manager        │  │  DialogState /        │ │
│  │  wiring,   │  │                │  │  InventoryState /     │ │
│  │  toggles)  │  │                │  │  QuestLogState /      │ │
│  │            │  │                │  │  ItemPreviewState     │ │
│  └────────────┘  └────────────────┘  └───────────────────────┘ │
│                                                                 │
│  Gameplay Systems Layer                                         │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ InteractionSystem│  │ GameplaySystem   │                   │
│  │ (proximity,      │  │ (collectibles,   │                   │
│  │  prompt, E-key)  │  │  campfire, text, │                   │
│  │                  │  │  triggers, zzz)  │                   │
│  └──────────────────┘  └──────────────────┘                   │
│                                                                 │
│  Scene Layer                                                    │
│  ┌──────────────────────────────────────────────┐              │
│  │ ForestSceneSetup (entity spawning, anims)    │              │
│  └──────────────────────────────────────────────┘              │
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
│  ┌──────────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ RenderOrchestrator│  │  Physics   │  │  Animation System │ │
│  │ (pipeline,        │  │  System    │  │                   │ │
│  │  post-process,    │  │            │  │                   │ │
│  │  markers)         │  │            │  │                   │ │
│  └──────────────────┘  └────────────┘  └────────────────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │ Renderer   │  │  PostProc  │  │  Effects (Snow, Fog,     │ │
│  │ (Canvas2D) │  │  (WebGL2)  │  │  FireLight)              │ │
│  └────────────┘  └────────────┘  └──────────────────────────┘ │
│  ┌────────────────────────────────┐  ┌────────────────────────┐ │
│  │  InputManager (aggregator)    │  │  Lighting Profile      │ │
│  │  ┌──────────┐ ┌────────────┐ │  │  ← Day/night presets   │ │
│  │  │ Keyboard │ │   Touch    │ │  │                        │ │
│  │  │ Provider │ │  Provider  │ │  │                        │ │
│  │  └──────────┘ └────────────┘ │  └────────────────────────┘ │
│  └────────────────────────────────┘                            │
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
│  UI Layer (all text in Russian)                                 │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │  DialogUI  │  │ InventoryUI│  │  QuestLogUI /            │ │
│  │            │  │            │  │  ItemPreviewUI / NoteUI / │ │
│  │            │  │            │  │  HUD / ControlsHelpUI    │ │
│  └────────────┘  └────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
User Input → KeyboardInputProvider / TouchInputProvider
                          ↓
                    InputManager (aggregation)
                          ↓
                    Player.handleInput()
                                ↓
                    ┌── Game._update() ──────────────────────────────────┐
                    │                                                     │
                    │  PhysicsSystem.update()                             │
                    │    ├─ Tile walkability                              │
                    │    ├─ Object collision                              │
                    │    └─ Entity-vs-entity collision                    │
                    │                                                     │
                    │  NPC.update() (re-aim steering, fade-in)            │
                    │  Campfire.updateSparks()                            │
                    │  AnimationSystem.update()                           │
                    │                                                     │
                    │  GameplaySystem                                     │
                    │    ├─ updateCampfireInteractable()                  │
                    │    ├─ updateCollectibles() — auto-pickup            │
                    │    ├─ updateTriggerZones() — enter/exit events      │
                    │    ├─ updatePendingEvents() — timed callbacks       │
                    │    └─ updateFloatingTexts()                         │
                    │                                                     │
                    │  InteractionSystem.update()                         │
                    │    → returns InteractionTarget (npc/object/campfire)│
                    │    → Game dispatches: openDialog / interact / etc.  │
                    │                                                     │
                    └─────────────────────────────────────────────────────┘
                                ↓
                    ┌── Game._render() ──────────────────────────────────┐
                    │                                                     │
                    │  handleInputToggles() — snow, lighting, UI panels   │
                    │  updateProfileTransition() — day/night lerp         │
                    │  applyLightingProfile() → PostProcess + Renderer    │
                    │                                                     │
                    │  RenderOrchestrator.render()                        │
                    │    ├─ Renderer.enqueue() → Z-sort → Canvas draw     │
                    │    ├─ GameplaySystem.drawCampfireSparks()           │
                    │    ├─ GameplaySystem.drawFloatingTexts()            │
                    │    ├─ GameplaySystem.drawDogZzz()                   │
                    │    ├─ GameplaySystem.drawOnboardingHint()           │
                    │    ├─ PostProcessPipeline.render() (WebGL2)         │
                    │    └─ drawInteractMarkers() (marker canvas)         │
                    │                                                     │
                    └─────────────────────────────────────────────────────┘
                                ↓
                          DOM overlays (dialog, inventory, quest log, HUD)
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
| **NPC** | velocity ✓, collider ✓ (solid when idle), animController ✓, blobShadow ✓ | Walk-to behavior with re-aim steering, dialog interaction, sleep state |
| **Campfire** | collider ✓ (solid), animController ✓, blobShadow ✓ | Animated fire with spark particles, burst() for dramatic effects |
| **Collectible** | — | World item pickup with bob, pickup animation, parabolic launch arc |
| **InteractableObject** | — | Invisible entity for press-E interactions on static objects (stick piles, campfire, wall note) |
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
- **Wall note** — opens parchment overlay (NoteUI), non-depleting (reusable)

Options: `label`, `onInteract` callback, `radius`, `markerOffsetY`, `oneShot` flag.

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
| `PlayingState` | No | No | Main gameplay — delegates to `Game._update()` / `Game._render()`. Defined in `states/PlayingState.ts`. |
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
  glowColor?: string;     // Optional CSS glow for UI highlights
}
```

Built-in items: `stick`, `bone`, `stone`, `ancient_ember`, `pink_lighter`.

The `glowColor` property (e.g., `'rgba(230, 140, 180, 0.6)'`) renders a radial gradient halo around the item's icon in the inventory list, item preview, and world collectible sprite.

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

Three layers:

```
InputProvider (interface)
  ├─ KeyboardInputProvider  ← desktop: keyboard + mouse wheel + mouse
  └─ TouchInputProvider     ← touch: virtual joystick + buttons + pinch zoom
        ↓
InputManager (aggregator)
  → isActionDown(action)     — OR across all providers
  → getMovementVector()      — highest-magnitude provider wins
  → getMouseScreen()         — first non-zero pointer
  → isRunning()              — shorthand for RUN action
```

1. **InputProvider** (`src/core/InputProvider.ts`) — Interface that all input sources implement: `isActionActive(action)`, `getMovementVector()`, `getPointerPosition()`, `dispose()`.

2. **KeyboardInputProvider** (`src/systems/KeyboardInputProvider.ts`) — Desktop input. Tracks `keydown`/`keyup`/`mousemove`/`wheel` events. Maps `Action` enums to key codes via `KeyBindings`. Uses `AbortController` for clean disposal.

3. **TouchInputProvider** (`src/systems/TouchInputProvider.ts`) — Touch input. Virtual joystick (bottom-left, 130px, run zone at 60% radius, border color feedback when running). Contextual action button (bottom-right, pill-shaped `🤚 {label}`, shown only near interactables via `setInteractVisible()`). Pinch-to-zoom. DOM overlay with `pointerEvents: 'none'` on root, `'auto'` on individual controls. Per-button `touchId` tracking. Haptic feedback (`navigator.vibrate`). The 🎒/📜 buttons are part of the HUD (not the touch overlay).

4. **InputManager** (`src/core/InputManager.ts`) — Aggregates `InputProvider[]`. Game code queries `InputManager` only — never raw providers.

### Platform Detection

In `Game` constructor, providers are selected based on device capabilities:

- **Desktop** (`!hasTouch || hasFinePointer`): `KeyboardInputProvider` created
- **Touch** (`hasTouch`): `TouchInputProvider` created
- **Hybrid** (laptop with touchscreen): both providers active simultaneously

### Actions

| Action | Keyboard | Touch | Purpose |
|--------|----------|-------|---------|
| `MOVE_*` | `WASD` / Arrows | Virtual joystick | Movement |
| `RUN` | `Shift` | Joystick outer zone (>60% radius) | Sprint modifier |
| `INTERACT` | `E` | 🤚 action button (contextual, bottom-right) | Talk to NPC / interact |
| `INVENTORY` | `I` | 🎒 button (HUD, top-right) | Toggle inventory |
| `QUEST_LOG` | `J` | 📜 button (HUD, top-right) | Toggle quest log |
| `PAUSE` | `Escape` | ✕ close button (on overlays) | Close overlays |
| `TOGGLE_LIGHT` | `L` | — | Toggle post-processing |
| `TOGGLE_SNOW` | `N` | — | Toggle snowfall |
| `TOGGLE_TIME` | `T` | — | Toggle day/night mode |
| `DEBUG_GRID` | `G` | — | Show debug grid |
| `CONTROLS_HELP` | `H` | — | Toggle controls help |
| `TOGGLE_DEBUG` | `U` | — | Toggle debug panels |
| `TOGGLE_QUEST_HUD` | `Q` | — | Toggle quest HUD |
| Zoom | Mouse wheel | Pinch | Camera zoom |

Keyboard bindings can be changed at runtime via `keyboardProvider.rebind(Action, codes[])`.

### Touch Controls Layout

```
┌──────────────────────────────────────────┐
│                          [quest HUD]     │
│                      [item] [🎒] [📜]    │  ← #inv-preview (HUD)
│                                          │
│                                          │
│                                          │
│  ┌───────┐                               │
│  │   ○   │              [🤚 action name] │  ← contextual, hidden by default
│  └───────┘                               │
└──────────────────────────────────────────┘
  joystick (overlay)      action btn (overlay)
```

- **Joystick** and **action button** live in the `TouchInputProvider` overlay (DOM elements with `pointerEvents: 'auto'` on a `pointerEvents: 'none'` container).
- **🎒 / 📜 buttons** live in the HUD's `#inv-preview` element — a flex row that also shows inventory item slots. Items expand leftward from the 🎒 button. Clicking 🎒 opens inventory, clicking 📜 opens quest log (via event delegation in `Game.ts`).
- The **action button** is only visible when the player is near an interactable entity. `Game.ts` calls `touchProvider.setInteractVisible()` with the label from `InteractionSystem.nearestInteractLabel`.
- On touch-only devices (`pointer: coarse` + `hover: none`), keyboard-specific hints are hidden and touch-specific hints are shown via CSS classes `.keyboard-hint` / `.touch-hint`.
- All tappable elements have `-webkit-tap-highlight-color: transparent` to suppress blue highlight.

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

The NPC class (`src/entities/NPC.ts`) manages its own state machine (`WALKING → IDLE → SLEEPING`). Velocity is recomputed each frame to point at the target (seek steering), with an overshoot guard: `arrivalThreshold = max(0.1, stepSize)`.

The `sleep()` method transitions an NPC to `NPCState.SLEEPING`: stops movement, disables interaction, and plays the `sleep` animation. Used for the dog after completing the bone quest. A floating "zzz" effect is rendered above sleeping NPCs by `GameplaySystem.drawDogZzz()`.

---

## System Architecture (Phase 4 Decomposition)

The `Game.ts` orchestrator was decomposed into focused modules. Each module has a single responsibility and communicates through well-defined interfaces.

### Module Dependency Graph

```
main.ts
  └─> Game (core/Game.ts) — orchestrator (~450 lines)
       ├─> ForestSceneSetup (scenes/) — entity spawning
       ├─> InteractionSystem (systems/) — proximity + E-key dispatch
       ├─> GameplaySystem (systems/) — gameplay update + draw logic
       ├─> RenderOrchestrator (rendering/) — full render pipeline
       ├─> [engine systems: Physics, Animation, Input, Camera, Renderer, PostProcess]
       └─> [game states: PlayingState, DialogState, InventoryState, ...]
```

### Game.ts — Orchestrator

`src/core/Game.ts` (~450 lines) is a thin coordinator that:

- Creates and wires all systems in the constructor
- Delegates scene setup to `ForestSceneSetup`
- Runs the game loop (`start`, `stop`, `loop`)
- In `_update`: calls systems in order (physics → NPC → animation → camera → gameplay → interaction)
- In `_render`: handles input toggles, profile transitions, then delegates to `RenderOrchestrator`
- Manages day/night profile state and lighting application
- Handles `openDialog` and `openInventory` (UI state transitions)

### InteractionSystem

`src/systems/InteractionSystem.ts` (~78 lines) — proximity detection and interact dispatch.

- Scans entities for interactables within `NPC_INTERACT_RADIUS` and `NPC_ONBOARD_RADIUS`
- Tracks the nearest interactable (`nearestInteractId`) for marker rendering
- Exposes `nearestInteractLabel` — the label of the nearest interactable entity, used by `Game.ts` to drive the touch contextual action button via `touchProvider.setInteractVisible()`
- Shows/hides the "Press E" prompt with dynamic labels
- Returns a typed `InteractionTarget` on interact action: `{ type: 'npc' | 'interactable' | 'campfire', entity }`. Game handles dispatch.

### GameplaySystem

`src/systems/GameplaySystem.ts` (~400 lines) — all game-specific update and draw logic.

**Update methods** (called from `Game._update`):
- `updateCollectibles(dt, playerX, playerY)` — auto-pickup, item preview trigger, entity removal
- `updateCampfireInteractable(campfire, isNight)` — dynamic enable/disable based on inventory + quest state
- `interactWithCampfire(campfire)` — consume sticks, trigger burst, schedule secret item
- `updateTriggerZones()` — enter/exit event dispatch
- `updatePendingEvents(dt)` — timer-based callback queue
- `updateFloatingTexts(dt)` — float upward + fade
- `updateOnboarding(dt, velocity)` — dismiss hint on first movement

**Draw methods** (called from `RenderOrchestrator.render`):
- `drawCampfireSparks(ctx, camera, campfire, fireOpacity)` — radial gradient sparks
- `drawFloatingTexts(ctx)` — pickup feedback
- `drawDogZzz(ctx, camera, elapsed)` — sleeping NPC zzz animation
- `drawOnboardingHint(ctx, camera, elapsed, playerX, playerY)` — movement prompt

**Utility**: `addFloatingText(text, col, row, life?, offsetY?)` — converts grid coords to screen coords and spawns a floating text particle.

### ForestSceneSetup

`src/scenes/ForestSceneSetup.ts` (~240 lines) — entity creation functions for the forest scene.

| Function | Returns | Notes |
|----------|---------|-------|
| `createPlayer(entityManager)` | `Player` | Sets up position, scale, animations, registers with EntityManager |
| `createCampfire(entityManager)` | `Campfire` | Position, scale, burn animation |
| `createDogNPC(entityManager)` | `NPC` | Walk/idle/sleep animations, dialog:close listener for sleep |
| `createCollectibles(entityManager)` | — | Bones, stone |
| `createStickPileInteractables(entityManager, tileMap, gameplaySystem)` | — | Press-E to collect, removes visual, floating text |
| `createNoteInteractable(entityManager, noteUI)` | — | Press-E opens parchment overlay |
| `registerPlayerAnimations(player)` | — | Direction-based walk/idle animations |

### RenderOrchestrator

`src/rendering/RenderOrchestrator.ts` (~520 lines) — the complete render pipeline.

Receives per-frame state via `RenderFrameState` (elapsed, activeProfile, snowEnabled, nearestInteractId) and orchestrates:

1. Tile/object/entity enqueuing → Renderer
2. Ground layer flush
3. Boundary effects (vignette, fog wisps — back pass)
4. Blob shadows, glow effects
5. Campfire sparks (via GameplaySystem)
6. Object/entity layer flush (depth-sorted)
7. Boundary effects (front pass)
8. Snowfall
9. Floating text, dog zzz, onboarding hint (via GameplaySystem)
10. Debug grid overlay
11. Post-process pass: lights (sky, window, campfire), occluders (objects, player, NPCs), height-fade, volumetric sprite shading
12. Interaction markers: two-pass depth-aware rendering with player silhouette occlusion

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

`src/entities/Campfire.ts` — animated fire with a particle spark system and stateful visual scaling.

- Renders using `AnimationController` with a procedurally generated sprite sheet (`campfire_anim`)
- Also renders a static `obj_campfire` PNG on the ground layer (beneath the player)
- Manages its own `sparks` array — particles that rise, drift, and fade
- Has a solid `Collider` (configurable `hw`/`hh`)
- `opacity` is driven by `LightingProfile.fireOpacity` for smooth day/night transitions

### Campfire State

The campfire starts small/dim and grows after feeding:

| State | Scale Mult | Light Mult | Trigger |
|-------|-----------|------------|---------|
| **Unfed** (initial) | 0.7× | 0.8× | — |
| **Fed** | 1.0× | 1.0× | `feed()` — permanently upgrades after adding sticks |

`drawScale` and `lightMult` are derived from base values × state multipliers × burst envelope.

### Burst Envelope

`burst(duration)` triggers a smooth effect envelope instead of an instant pop:

```
burstT
1.0 ┤     ╭──────────╮
    │    ╱            ╲
    │   ╱              ╲
0.0 ┤──╯                ╰──
    └──┬──┬──────────┬──┬──
       rampUp  hold  rampDown
```

Three phases within the total `burstDuration`:

- **Ramp up** (0.3s) — `easeIn(t) = t²` from 0 to 1
- **Hold** — stays at 1 for the bulk of the duration
- **Ramp down** (0.5s) — `easeOut(t) = 1-(1-t)²` from 1 to 0

All burst parameters are derived by lerping between baseline and peak using the normalized `burstT`:

| Parameter | Baseline | Peak |
|-----------|----------|------|
| Max sparks | 30 | 50 |
| Spawn rate | 14/s | 30/s |
| Scale mult | 1× | 1.25× |
| Light mult | 1× | 1.2× |

The `lightMult` getter returns `_lightMult * lerp(1, peakLightMult, burstT)`, so Game.ts reads smoothly interpolated values every frame without any code changes.

### Spark Particles

Each spark has: position offset (`ox`, `oy`), velocity (`vx`, `vy`), `life`/`maxLife`, `radius`, `hue` (orange→yellow gradient). Rendered with a radial gradient glow + solid pixel in `GameplaySystem.drawCampfireSparks()`.

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

### Close Behavior (All Modals)

All overlay panels are dismissible with `ESC` (desktop) or touch-specific controls:

| Modal | Desktop | Touch |
|-------|---------|-------|
| Dialog | `ESC` key (DialogUI keydown) | ✕ close button (`.dialog-close`) |
| Item Preview | `ESC` key (ItemPreviewUI keydown, delayed 1 frame) | Tap overlay backdrop |
| Note | `Enter`/`Space`/`ESC` (NoteUI keydown) | Tap overlay backdrop |
| Inventory | `ESC` → `Action.PAUSE` in `handleInputToggles()` | ✕ close button (`.overlay-close`) |
| Quest Log | `ESC` → `Action.PAUSE` in `handleInputToggles()` | ✕ close button (`.overlay-close`) |
| Controls Help | `ESC` → `Action.PAUSE` in `handleInputToggles()` | N/A (keyboard-only overlay) |

`PAUSE` action cascade priority (when multiple panels open): Note > Item Preview > Inventory > Quest Log > Controls Help.

Player movement is blocked while any of inventory, item preview, or note overlays are visible.

---

## Item Preview Dialog

`src/states/ItemPreviewState.ts` + `src/ui/ItemPreviewUI.ts` — a special overlay shown when the player discovers a non-stackable item (e.g., Ancient Ember).

- **Trigger**: In `updateCollectibles()`, when a picked-up item has `stackable === false`, an `ItemPreviewState` is pushed. Also opened from the inventory inspect action.
- **Display**: Centered overlay with dark scrim, item icon scaled to 80×80 within a 120×120 canvas with pixel-art rendering (`imageSmoothingEnabled = false`), radial glow gradient (if `glowColor` set), item name, and description. The "НАЙДЕН НОВЫЙ ПРЕДМЕТ!" header is optional (`showLabel: false` when opened from inventory).
- **Dismiss**: Enter, Space, or Escape. The state pops itself and the game resumes.

---

## Wall Note Overlay

`src/ui/NoteUI.ts` — a parchment-styled DOM overlay for the developer message pinned to the house wall.

- **Trigger**: Player presses E near the wall note `InteractableObject` at `(2.0, 2.65)`.
- **Display**: Centered warm-toned parchment with title, body paragraphs, signature, and dismiss hint. CSS animation on entry.
- **Dismiss**: Enter, Space, or Escape. The overlay hides and the `onClose` callback fires.
- **Reusable**: The note is not depleted — the player can re-read it any time.

The visual paper sprite is a `WorldObject` in `TileMap` at `(2.1, 2.7)` with `anchorY: 5.5` (elevated to wall height) and `depthBias: -100` (ensures the player always renders in front).

---

## Platform Detection

Touch support is detected in the `Game` constructor using `'ontouchstart' in window`, `navigator.maxTouchPoints`, and `matchMedia('(pointer: fine)')`. Based on these signals:

- **Desktop**: only `KeyboardInputProvider` is created
- **Touch-only** (phone/tablet): only `TouchInputProvider` is created; keyboard onboarding hint disabled (`gameplaySystem.onboardingHintActive = false`)
- **Hybrid** (laptop with touchscreen): both providers are created and active simultaneously

The game loads on all platforms — no mobile blocking. `Game.ts` stores a `touchProvider` reference (if present) to drive the contextual action button and pass `isTouch` to `RenderOrchestrator` for marker rendering.

CSS media queries (`@media (pointer: coarse) and (hover: none)`) control platform-specific UI:
- `.keyboard-hint` visible on desktop, hidden on touch
- `.touch-hint` hidden on desktop, visible on touch
- `.overlay-close` (✕ buttons) hidden on desktop, visible on touch
- `#inv-preview` shows 🎒/📜 buttons on touch, hint text on desktop
- `-webkit-tap-highlight-color: transparent` on `#game-container *` suppresses blue tap highlights

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
- **Below player** (when appropriate): Player occlusion uses a **two-pass** approach. Pass 1 draws markers for entities deeper than (behind) the player — these are immediately occluded by stamping the player sprite with `destination-out`. Pass 2 draws markers for entities shallower than (in front of) the player — no occlusion needed since the player is behind them. This prevents markers from disappearing when the player walks behind the marked entity.
- **Below DOM UI**: Markers don't obscure dialog, inventory, or other UI panels.

### Visibility Rules

- Markers are hidden when any modal state is active (`stateManager.size > 1`).
- The badge only appears when the entity is the nearest interactable within `NPC_ONBOARD_RADIUS`.
- The arrow marker appears for all interactable entities within render distance.

### Platform-Specific Badge

- **Desktop**: Renders `[E]` text badge above the arrow.
- **Touch**: Renders `🤚` emoji badge (white via `ctx.filter = 'brightness(0) invert(1)'`). Badge dimensions are dynamically calculated using `ctx.measureText()` with `actualBoundingBoxAscent`/`actualBoundingBoxDescent` to correctly size for emoji glyphs.
- Badge is always positioned above the orange arrow with a gap of `4 * markerScale` pixels.

---

## Controls Help Overlay

`src/ui/ControlsHelpUI.ts` — an HTML overlay listing all game controls, organized by category (Movement, Interaction, Environment, Debug).

- **Toggle**: `H` key (edge-triggered via `CONTROLS_HELP` action). Also dismissible with `ESC`.
- **Display**: Centered overlay with categorized control listing, keyboard key badges, and descriptions.
- **State**: Not a game state — it's a simple DOM visibility toggle managed in `Game._update()`. Same for Inventory (`I` key) and Quest Log (`J` key).

---

## HUD & Debug Panels

`src/ui/HUD.ts` — manages HUD elements:

| Panel | Default | Toggle | Content |
|-------|---------|--------|---------|
| **Debug info** (top-left) | Hidden | `U` key | Player position, direction, item count |
| **Debug overlay** (top-right) | Hidden | `U` key | FPS, zoom, map size, object count |
| **Quest HUD** (top-right) | Visible | `Q` key | Active quest objectives with progress |
| **Inventory preview** (top-right, below quest HUD) | Visible when items exist (always on touch) | — | Item slots + 🎒 / 📜 buttons (touch only) |

Debug panels (`U`) and quest HUD (`Q`) are independently togglable. Both are edge-triggered in `Game._render()` via `handleInputToggles()`.

### Inventory Preview (Touch)

On touch devices, `#inv-preview` serves double duty — it displays inventory item icons *and* provides 🎒 (open inventory) and 📜 (open quest log) tap targets. The layout is a horizontal flex row: `[item slots...] [🎒] [📜]`, anchored to the top-right. Items expand leftward as the player collects them.

On desktop, the 🎒 / 📜 buttons are hidden and only item slots + a keyboard hint (`I`) are shown.

`Game.ts` attaches a delegated `click` listener to `#inv-preview` to distinguish clicks on `.inv-preview-bag` (opens inventory), `.inv-preview-questlog` (opens quest log), or item slots (opens inventory).

---

## Pending Events System

A simple timer-based callback queue managed by `GameplaySystem`. Events are pushed with a `timer` (seconds) and a `callback`. Each frame, timers decrement; when expired, the callback fires and the event is removed.

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
