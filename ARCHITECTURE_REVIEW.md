# Architecture Review & Improvement Plan

> Perun Pixel Web — Isometric 2.5D Browser Game  
> Initial review: 2026-02-14  
> Last updated: 2026-02-15

---

## Executive Summary

The project started with a solid rendering foundation — isometric pipeline, WebGL2 post-processing with lighting/shadows, snowfall particles, and procedural asset fallbacks. The initial review identified tight coupling and monolithic architecture as the core issues.

**Phase 0 and Phase 1 refactoring is now complete.** The codebase has been restructured with proper separation of concerns, an event-driven architecture, a game state machine, and a flexible entity system. The first gameplay feature — an NPC with walk-to behavior, interaction, and a branching dialog system — has been implemented as a proof of concept.

---

## Table of Contents

1. [Completed Work](#1-completed-work)
2. [Current Architecture](#2-current-architecture)
3. [Remaining Work](#3-remaining-work)
4. [Per-File Status](#4-per-file-status)

---

## 1. Completed Work

### Phase 0: Quick Wins ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Type `Direction` as a union type | ✅ Done | `src/core/Types.ts` — union type + `ALL_DIRECTIONS` constant, used in `AnimationController` and `Game.ts` |
| 2 | Move magic numbers to `Config.ts` | ✅ Done | Character dimensions (`CHAR_SRC_W/H`, `CHAR_DRAW_H`), tile dimensions, dog NPC constants all centralized |
| 3 | Extract `SnowfallEffect` | ✅ Done | `src/rendering/effects/SnowfallEffect.ts` — ~174 lines extracted from Renderer |
| 4 | Extract `FogEffect` | ✅ Done | `src/rendering/effects/FogEffect.ts` — ~268 lines (boundary + animated wisps) extracted from Renderer |
| 5 | Create asset manifest JSON | ✅ Done | `public/assets/data/assets.json` + `src/core/AssetManifest.ts` loader. `main.ts` uses manifest instead of inline array |

### Phase 1: Core Infrastructure ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6 | EntityManager | ✅ Done | `src/core/EntityManager.ts` — central registry with `add/remove/getAll/getByPrefix/getInRadius`. Emits `entity:added/removed` events |
| 7 | Wire EventBus with typed events | ✅ Done | `src/core/EventBus.ts` — fully typed with specific payloads for `player:moved`, `dialog:*`, `interaction:*`, `entity:*`, `input:action`, etc. |
| 8 | Input action mapping | ✅ Done | `src/core/InputManager.ts` — `Action` enum (`MOVE_UP/DOWN/LEFT/RIGHT`, `RUN`, `INTERACT`, `TOGGLE_LIGHT`, `DEBUG_GRID`, `PAUSE`) with configurable key bindings and `rebind()` support |
| 9 | GameStateManager | ✅ Done | `src/core/GameState.ts` — state stack with `push/pop`, `isTransparent` (render underneath), `blocksUpdate` (pause game). Active states: `PlayingState`, `DialogState` |
| 10 | Make components optional | ✅ Done | `Entity.ts` — `velocity`, `collider`, `animController` are now nullable. Added `opacity`, `blobShadow`, `interactable` properties. Systems null-check before processing |

### Phase 2: Feature Infrastructure (Partial) 🔶

| # | Task | Status | Notes |
|---|------|--------|-------|
| 11 | InteractionSystem | ✅ Done | Proximity detection in `Game._update()` with configurable `NPC_INTERACT_RADIUS`. Shows "Press E to talk" prompt. Edge-triggered E key opens dialog |
| 12 | TriggerZone entity | ❌ Not started | — |
| 13 | NPC base class | ✅ Done | `src/entities/NPC.ts` — walk-to behavior, fade-in, state machine (`WALKING → IDLE`), non-solid during walk / solid on arrival |
| 14 | Dialog system | ✅ Done | `DialogData.ts` (data model + sample dialog), `DialogUI.ts` (arrow/enter/ESC navigation), `DialogState.ts` (game state). Full branching dialog with 6 nodes |
| 15 | Generalize volumetric/shadow rendering | ❌ Not started | Still player-only in `Game._render()` |

### Additional Implemented Features

| Feature | Details |
|---------|---------|
| **Entity-vs-entity collision** | `PhysicsSystem.ts` — solid entities block each other. Non-solid entities (walking NPCs) pass through. Overlap escape logic prevents player from getting stuck |
| **Entity opacity / fade-in** | `Renderer.ts` — `RenderItem.opacity` applied via `globalAlpha`. NPC fades in over configurable duration |
| **Blob shadows for all entities** | `Entity.blobShadow` config (`rx`, `ry`, `opacity`). Rendered for player + NPCs |
| **Interactable marker** | Pixel-art SVG arrow (▼) as DOM overlay above idle NPCs. Zoom-aware scaling (clamped 0.6×–1.6×), gentle bob animation, `z-index: 9999` to avoid post-process dimming |
| **Dialog UI controls** | Arrow keys / W/S to navigate choices, Enter/Space to confirm, ESC to close at any time. Mouse hover + click also supported. Controls hint bar displayed in dialog |
| **Dog NPC (proof of concept)** | Spawns at (5.7, 1.2) transparent, walks to (2.6, 4.2), fades in, switches to idle, becomes interactable. 6-node branching dialog tree |

---

## 2. Current Architecture

```
src/
├── core/
│   ├── Game.ts                  # Orchestrator: init, loop, state delegation
│   ├── GameState.ts             # State stack (PlayingState, DialogState) ✅
│   ├── EntityManager.ts         # Central entity registry + spatial queries ✅
│   ├── EventBus.ts              # Typed pub/sub with specific payloads ✅
│   ├── InputManager.ts          # Action mapping layer over raw keys ✅
│   ├── AssetLoader.ts           # Asset loading (unchanged)
│   ├── AssetManifest.ts         # JSON manifest loader ✅
│   ├── Config.ts                # All constants centralized ✅
│   └── Types.ts                 # Direction union type ✅
│
├── entities/
│   ├── Entity.ts                # Base entity with optional components ✅
│   ├── Player.ts                # Player-specific input handling ✅
│   ├── NPC.ts                   # NPC with walk-to, fade-in, state machine ✅
│   ├── Components.ts            # Transform, Velocity, Collider
│   └── AnimationController.ts   # Animation state + typed directions ✅
│
├── systems/
│   ├── InputSystem.ts           # Raw key state (wrapped by InputManager)
│   ├── PhysicsSystem.ts         # Movement + tile/object/entity collision ✅
│   └── AnimationSystem.ts       # Animation state machine ✅
│
├── rendering/
│   ├── Renderer.ts              # Canvas draw queue + flush (~270 lines, slimmed) ✅
│   ├── Camera.ts                # Viewport (unchanged)
│   ├── IsometricUtils.ts        # Coordinate math (unchanged)
│   ├── PostProcessPipeline.ts   # WebGL2 lighting (unchanged)
│   └── effects/
│       ├── SnowfallEffect.ts    # Extracted from Renderer ✅
│       └── FogEffect.ts         # Boundary + animated wisps extracted ✅
│
├── dialog/
│   └── DialogData.ts            # Dialog tree data model + sample dialog ✅
│
├── states/
│   └── DialogState.ts           # Game state for active dialog ✅
│
├── ui/
│   ├── HUD.ts                   # Debug/info overlay (unchanged)
│   └── DialogUI.ts              # Bottom-of-screen dialog with choices ✅
│
├── world/
│   ├── TileMap.ts               # Grid data + object storage
│   └── WorldGenerator.ts        # Hardcoded world (unchanged)
│
├── assets/
│   └── ProceduralAssets.ts      # Fallback asset generation (unchanged)
│
└── main.ts                      # Boot: load manifest, init Game ✅
```

### Key Typed Events (EventBus)

All events are fully typed with specific payloads:

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
  'input:action':      { action: Action; state: 'pressed' | 'released' };
}
```

### Game State Stack

```
PLAYING → push DIALOG → (player frozen, game renders underneath) → pop → PLAYING
```

States support:
- `isTransparent`: render the state below (e.g., game world visible during dialog)
- `blocksUpdate`: pause the state below (e.g., player can't move during dialog)

### Entity System

Flexible pseudo-ECS with optional components:

```typescript
class Entity {
  id: string;
  transform: Transform;          // Always present
  velocity: Velocity | null;     // Optional — NPCs have it, trigger zones won't
  collider: Collider | null;     // Optional — with solid flag
  animController: AnimationController | null;  // Optional
  opacity: number;               // For fade-in/out effects
  blobShadow: { rx, ry, opacity } | null;     // Per-entity shadow config
  interactable: boolean;         // Whether player can interact
  drawScale: number;             // Sprite scaling factor
}
```

### Physics Collision Model

Three-layer collision in `PhysicsSystem.canMove()`:
1. **Tile walkability** — grid cells the AABB overlaps
2. **Tile-map objects** — static objects (trees, rocks) via `TileMap.collidesWithObject()`
3. **Entity-vs-entity** — only if the moving entity is solid. Non-solid entities (walking NPCs) pass through. **Overlap escape**: if already overlapping, movement is allowed to prevent freezing

### NPC Lifecycle

```
SPAWN (transparent, non-solid)
  → fade in over N seconds
  → walk toward target position
  → ARRIVE (opaque, solid, interactable)
  → idle animation + interaction marker
  → player approaches → "Press E to talk" prompt
  → player presses E → DialogState pushed
  → dialog completes/ESC → DialogState popped → PLAYING
```

---

## 3. Remaining Work

### Phase 2: Feature Infrastructure (Remaining)

| # | Task | Effort | Blocks |
|---|------|--------|--------|
| 12 | **TriggerZone entity** — position + radius + event name, pass-through collider, one-shot/repeatable | 1 day | Item pickup, area events |
| 15 | **Generalize volumetric/shadow rendering** — move per-entity render config into a component so any entity can have volumetric shading | 2 days | NPC lighting parity |

### Phase 3: Content Infrastructure

| # | Task | Effort | Blocks |
|---|------|--------|--------|
| 16 | **Data-driven maps** — JSON map files with tile grid + object placements + NPC spawns + trigger zones | 2 days | Content scalability |
| 17 | **Inventory system** — item definitions, player inventory state, pickup events | 2 days | Collectibles |
| 18 | **Scene/Map transitions** — load different maps, preserve player state | 1 day | Multi-area game |

### Quality & Performance

| Task | Effort | Priority |
|------|--------|----------|
| **Spatial indexing** for entity collision (grid-based or quadtree) | 1 day | P3 — needed when entity count grows |
| **AI system** for NPC behaviors (patrol, follow, flee) | 2 days | P3 — needed for richer NPCs |
| **Pathfinding** (A* on tile grid) for NPC navigation | 1 day | P3 — needed for dynamic NPC movement |
| **Dispose/cleanup patterns** — remove event listeners, free WebGL resources | 0.5 day | P3 — needed for scene transitions |
| **Render queue optimization** — partition by layer before sorting | 0.5 day | P3 — minor perf gain |
| **Data-driven world** — replace `WorldGenerator.ts` hardcoded positions with JSON loader | 1 day | P2 |
| **UI component system** — structured UI framework for dialogs, inventory, menus | 2 days | P2 |

---

## 4. Per-File Status

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `core/Game.ts` | ~595 | 🔶 Improved | No longer a god object for most systems. Still orchestrates rendering pipeline. NPC interaction logic is inline — could extract to `InteractionSystem` |
| `core/GameState.ts` | ~107 | ✅ New | State stack with transparent/blocking flags |
| `core/EntityManager.ts` | ~71 | ✅ New | Central registry with spatial queries |
| `core/EventBus.ts` | ~56 | ✅ Rewritten | Fully typed, actively used |
| `core/InputManager.ts` | ~82 | ✅ New | Action mapping with rebind support |
| `core/Config.ts` | ~150 | ✅ Expanded | All constants centralized including NPC params |
| `core/AssetManifest.ts` | ~22 | ✅ New | JSON manifest loader |
| `core/Types.ts` | ~21 | ✅ New | Direction union type |
| `entities/Entity.ts` | ~28 | ✅ Refactored | Optional components, opacity, blobShadow, interactable |
| `entities/Player.ts` | ~48 | ✅ Updated | Explicit component init, blobShadow enabled |
| `entities/NPC.ts` | ~136 | ✅ New | Walk-to, fade-in, state machine, solid-on-arrival |
| `entities/AnimationController.ts` | ~125 | ✅ Updated | Typed Direction, used by both Player and NPC |
| `entities/Components.ts` | ~27 | Unchanged | Transform, Velocity, Collider with solid flag |
| `systems/PhysicsSystem.ts` | ~82 | ✅ Improved | Entity-vs-entity collision, overlap escape, non-solid passthrough |
| `systems/AnimationSystem.ts` | ~17 | ✅ Updated | Null-checks optional animController |
| `systems/InputSystem.ts` | ~58 | Unchanged | Raw key state, wrapped by InputManager |
| `rendering/Renderer.ts` | ~273 | ✅ Slimmed | Reduced from ~650 lines. Effects extracted. Opacity support added |
| `rendering/effects/SnowfallEffect.ts` | ~174 | ✅ New | Extracted from Renderer |
| `rendering/effects/FogEffect.ts` | ~268 | ✅ New | Boundary + animated wisps extracted |
| `rendering/Camera.ts` | ~66 | Unchanged | — |
| `rendering/IsometricUtils.ts` | ~30 | Unchanged | — |
| `rendering/PostProcessPipeline.ts` | ~723 | Unchanged | Still player-only for volumetric |
| `dialog/DialogData.ts` | ~95 | ✅ New | Data model + 6-node sample dog dialog |
| `states/DialogState.ts` | ~82 | ✅ New | Transparent, blocks update, manages dialog flow |
| `ui/DialogUI.ts` | ~127 | ✅ New | Arrow/Enter/ESC navigation, mouse support, controls hint |
| `ui/HUD.ts` | ~45 | Unchanged | — |
| `world/TileMap.ts` | ~95 | Unchanged | O(n) object collision still present |
| `world/WorldGenerator.ts` | ~50 | Unchanged | Hardcoded positions |
| `assets/ProceduralAssets.ts` | ~283 | Unchanged | — |
| `main.ts` | ~33 | ✅ Updated | Loads from manifest |
| `index.html` | ~241 | ✅ Updated | Dialog container, interact prompt, marker styles, dialog controls hint |
| `public/assets/data/assets.json` | ~24 | ✅ New | Asset manifest |

---

## Summary Priority Matrix (Updated)

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| **P0** | EntityManager | 1 day | ✅ Done |
| **P0** | GameStateManager | 1 day | ✅ Done |
| **P0** | Wire EventBus + typed events | 1 day | ✅ Done |
| **P1** | Input action mapping | 0.5 day | ✅ Done |
| **P1** | Extract Renderer effects | 1 day | ✅ Done |
| **P1** | Slim down Game.ts render | 1 day | ✅ Done |
| **P1** | Optional components / composition | 1 day | ✅ Done |
| **P1** | NPC system + dog proof of concept | 2 days | ✅ Done |
| **P1** | Dialog system + UI | 3 days | ✅ Done |
| **P1** | Interaction system | 1 day | ✅ Done |
| **P1** | Asset manifest JSON | 0.5 day | ✅ Done |
| **P1** | Direction union type + cleanup | 0.5 day | ✅ Done |
| **P2** | TriggerZone entity + system | 1 day | ❌ Not started |
| **P2** | Generalize volumetric rendering | 2 days | ❌ Not started |
| **P2** | Data-driven maps (JSON) | 2 days | ❌ Not started |
| **P2** | UI component system | 2 days | ❌ Not started |
| **P3** | Inventory system | 2 days | ❌ Not started |
| **P3** | Spatial indexing for entities | 1 day | ❌ Not started |
| **P3** | AI system for NPCs | 2 days | ❌ Not started |
| **P3** | Pathfinding (A*) | 1 day | ❌ Not started |
| **P3** | Scene/Map transitions | 1 day | ❌ Not started |
| **P3** | Dispose/cleanup patterns | 0.5 day | ❌ Not started |
