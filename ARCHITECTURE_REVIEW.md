# Architecture Review & Improvement Plan

> Perun Pixel Web — Isometric 2.5D Browser Game  
> Review date: 2026-02-14

---

## Executive Summary

The project has a solid rendering foundation — the isometric pipeline, WebGL2 post-processing with lighting/shadows, snowfall particles, and procedural asset fallbacks are impressive for a single-developer project. However, the architecture is **tightly coupled and monolithic**, which will make the planned features (NPCs, dialogs, collectibles, trigger zones) very painful to add without significant refactoring first.

The core issue: **everything knows about everything else**, and there's no abstraction layer between game logic and rendering/physics details.

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [Structural Weaknesses](#2-structural-weaknesses)
3. [Code Quality Issues](#3-code-quality-issues)
4. [Feature Readiness Gaps](#4-feature-readiness-gaps)
5. [Recommended Refactoring Plan](#5-recommended-refactoring-plan)
6. [Proposed Architecture](#6-proposed-architecture)
7. [Per-File Notes](#7-per-file-notes)

---

## 1. Critical Issues

### 1.1 `Game.ts` is a God Object

The `render()` method is ~200 lines handling: tile/object/entity enqueue, layer flushing, fog, blob shadows, input polling (L-key toggle), post-processing setup (lights, occluders, height-fade, volumetric sprite UV math). The `constructor` is ~80 lines of animation wiring.

**Impact**: Every new feature (NPC rendering, item glows, trigger zone visuals) will bloat this file further. Adding a second entity type requires duplicating most of the volumetric/shadow logic.

**Fix**: Extract a `RenderPipeline` or `SceneRenderer` that orchestrates render passes. Move entity-specific rendering config (sprite dimensions, draw scale, shadow params) into component data on the entity itself.

### 1.2 `Renderer.ts` is a God Class (~650 lines)

Contains five unrelated systems crammed into one class:
- Render queue management
- Snowfall particle system (~170 lines)
- Boundary fog (~120 lines)
- Animated edge wisps (~110 lines)
- Debug grid overlay

**Fix**: Extract `SnowfallEffect`, `BoundaryFogEffect`, `EdgeFogEffect` into `src/rendering/effects/`. Renderer should only manage the queue, sorting, and canvas drawing.

### 1.3 EventBus Exists But Is Never Used

`eventBus` singleton is declared in `core/EventBus.ts` and imported nowhere. All communication is through direct method calls and property reads.

**Impact**: Without event-driven communication, adding NPCs/dialogs/triggers means hardwiring every interaction into Game.ts. Example: "player enters zone" currently has no way to propagate without the systems being directly coupled.

**Fix**: Wire up the EventBus for cross-system communication. Define typed events (see §5).

### 1.4 No Scene / Game State Management

There's no concept of game states (playing, paused, in-dialog, cutscene, menu). The game loop always runs the same `update → render` cycle.

**Impact**: Opening a dialog must somehow freeze player movement, hide HUD elements, show dialog UI — with the current architecture this requires ad-hoc boolean flags scattered everywhere.

**Fix**: Implement a `GameStateManager` with a state stack:

```
PLAYING → push DIALOG → push INVENTORY → pop → pop → PLAYING
```

Each state owns its own `update(dt)` and `render(dt)` methods and can block or pass through to the state below.

---

## 2. Structural Weaknesses

### 2.1 Pseudo-ECS with Class Inheritance

The RFC describes an ECS, but the implementation uses **OOP inheritance** (`Player extends Entity`) with hardcoded components:

```typescript
// Entity.ts — every entity pays for every component
export class Entity {
  transform: Transform = new Transform();
  velocity: Velocity = new Velocity();
  collider: Collider = new Collider();
  animController: AnimationController = new AnimationController();
  // ...
}
```

Problems:
- A collectible item doesn't need `Velocity` or `AnimationController`.
- A trigger zone doesn't need `Collider` (in the physics sense) or `drawScale`.
- `AnimationSystem` does `instanceof Player` to branch logic — this breaks with NPCs.

**Fix (pragmatic, not full ECS rewrite)**: Use optional composition instead of mandatory inheritance:

```typescript
interface Entity {
  id: string;
  transform: Transform;
  components: Map<string, Component>;
  getComponent<T>(type: ComponentType<T>): T | undefined;
  hasComponent(type: ComponentType<any>): boolean;
}
```

Or, at minimum, make components nullable/optional on the base Entity so systems can check for presence instead of instanceof.

### 2.2 No Entity Manager

Entities are passed as raw arrays: `this.physics.update(dt, [this.player])`. There's no central registry.

**Impact**: Adding 10 NPCs means manually managing `[this.player, this.npc1, this.npc2, ...]` in Game.ts, passing them to every system, and manually adding/removing them.

**Fix**: Create an `EntityManager` class:

```typescript
class EntityManager {
  private entities: Map<string, Entity> = new Map();
  add(e: Entity): void;
  remove(id: string): void;
  getAll(): Entity[];
  getByComponent<T>(type: ComponentType<T>): Entity[];
  getInRadius(x: number, y: number, r: number): Entity[];
}
```

### 2.3 No Input Action Mapping

Raw keycodes are used everywhere:
- `this.input.isDown('KeyG')` in Game.ts render method
- `'KeyL'` for lighting toggle
- `'KeyW'`, `'KeyS'`, etc. in InputSystem

**Impact**: Adding "interact" (E key), "open inventory" (I key), "cancel" (Escape) means touching InputSystem + Game.ts + wherever the feature lives. No way to rebind keys.

**Fix**: Add an action layer:

```typescript
enum Action { MOVE_UP, MOVE_DOWN, INTERACT, TOGGLE_LIGHTING, DEBUG_GRID, OPEN_INVENTORY }
// Configurable key → action bindings
```

### 2.4 Asset Manifest is Hardcoded

All asset loading is inline in `main.ts`:

```typescript
await assetLoader.loadAll([
  { id: 'tile_grass', path: '/assets/sprites/tiles/ground_snow_thick.png' },
  { id: 'char_idle', path: '/assets/sprites/characters/player_idle.png' },
  // ...40 more lines...
]);
```

**Fix**: Move to a JSON manifest file (`public/assets/data/assets.json`) as the RFC already suggests. Load and parse it at boot.

### 2.5 World Generation is Hardcoded

`WorldGenerator.ts` is a single function with hardcoded object positions, asset IDs, and pixel dimensions. No way to define maps externally.

**Fix**: Data-driven map definitions in JSON (or Tiled editor export). WorldGenerator becomes a loader/parser, not a hardcoder.

---

## 3. Code Quality Issues

### 3.1 No TypeScript Union Types for Directions

Direction is `string` throughout (`'south'`, `'north_east'`, etc.). Easy to typo, no autocomplete, no exhaustive checking.

```typescript
type Direction = 'north' | 'south' | 'east' | 'west'
  | 'north_east' | 'north_west' | 'south_east' | 'south_west';
```

### 3.2 Magic Numbers in Game.ts

```typescript
const TILE_IMG_W = 218;
const TILE_IMG_H = 125;
const CHAR_SRC_W = 113;
const CHAR_SRC_H = 218;
const CHAR_DRAW_H = 128;
```

These should be in `Config.ts` or derived from asset metadata automatically.

### 3.3 HUD Uses innerHTML

```typescript
this.hudEl.innerHTML = `
  Perun Pixel World<br>
  Pos: ${t.x.toFixed(1)}, ${t.y.toFixed(1)}<br>
  Dir: ${dir}
`;
```

Minor issue for a game, but prevents any structured UI. For dialog boxes, inventory panels, and NPC name plates, need a real UI component system.

### 3.4 No Dispose / Cleanup Patterns

- `window.addEventListener('resize', ...)` in Renderer, PostProcessPipeline, Camera — never removed
- WebGL resources (textures, programs, VAOs) never freed
- OK for a single-scene game; breaks with scene transitions

### 3.5 Sorting Every Frame Without Need

`Renderer.flushLayer()` sorts the entire render queue on every `flushLayer()` call (called 2x per frame). The sort includes items from other layers that are then skipped. Should partition by layer first, then sort within.

### 3.6 O(n) Collision for Objects

`TileMap.collidesWithObject()` iterates all objects for every axis check. With many NPCs and items, this needs spatial indexing (grid-based or quadtree).

---

## 4. Feature Readiness Gaps

### 4.1 NPCs (Not Ready)

Missing:
- [ ] Entity manager (central registry)
- [ ] NPC class with behavior/AI component
- [ ] Pathfinding (even basic A* on the grid)
- [ ] Animation setup per-NPC (currently hardcoded for player only in Game constructor)
- [ ] Rendering pipeline that handles N entities with volumetric shading (current code only does it for `this.player`)
- [ ] Interaction proximity check + prompt UI

### 4.2 Dialogs (Not Ready)

Missing:
- [ ] Game state machine (pause gameplay during dialog)
- [ ] Dialog data format (JSON with branching, conditions, choices)
- [ ] Dialog UI renderer (text box, speaker portrait, choices)
- [ ] Trigger mechanism (approach NPC → show interact prompt → E key → open dialog)
- [ ] Input blocking (player shouldn't move during dialog)

### 4.3 Collectible Items (Not Ready)

Missing:
- [ ] Item definitions (data-driven)
- [ ] Inventory state + UI
- [ ] Trigger zones (enter area → pick up item / show prompt)
- [ ] Item entity type (rendered on map, removed on pickup)
- [ ] Event: `item_collected` → update HUD / trigger dialog / unlock door

### 4.4 Trigger Zones (Not Ready)

Missing:
- [ ] Zone entity type (position, radius/shape, callback/event)
- [ ] Collision system extended with `isTrigger` flag (pass-through, fires event)
- [ ] EventBus integration (zone entered/exited events)
- [ ] Zone types: one-shot, repeatable, conditional

---

## 5. Recommended Refactoring Plan

Priority order — each step unblocks the next and subsequent features.

### Phase 0: Quick Wins (1-2 days)

1. **Type `Direction`** as a union type. Use it everywhere instead of `string`.
2. **Move magic numbers** from Game.ts to Config.ts.
3. **Extract `SnowfallEffect`** from Renderer.ts into `rendering/effects/SnowfallEffect.ts`.
4. **Extract `FogEffect`** (boundary + animated wisps) into `rendering/effects/FogEffect.ts`.
5. **Create asset manifest JSON** and load it in `main.ts` instead of inline array.

### Phase 1: Core Infrastructure (3-5 days)

6. **EntityManager** — central registry with add/remove/query.
7. **Wire EventBus** — define typed events, emit from systems, subscribe in Game.
8. **Input action mapping** — abstract keycodes into named actions. Support rebinding.
9. **GameStateManager** — state stack with `update`/`render` per state. At minimum: `PlayingState`, `PausedState`.
10. **Make components optional** — Entity should not force every component. Systems check for component presence.

### Phase 2: Feature Infrastructure (3-5 days)

11. **InteractionSystem** — proximity check around player, show prompt, handle E-key.
12. **TriggerZone entity** — position + radius + event name. CollisionSystem detects overlap and fires events.
13. **NPC base class** with behavior component (idle, patrol, interact).
14. **Dialog system** — data format, DialogState (game state), UI renderer.
15. **Generalize volumetric/shadow rendering** — move per-entity render config into a component so any entity can have volumetric shading, not just `this.player`.

### Phase 3: Content Infrastructure (2-3 days)

16. **Data-driven maps** — JSON map files with tile grid + object placements + NPC spawns + trigger zones.
17. **Inventory system** — item definitions, player inventory state, pickup events.
18. **Scene/Map transitions** — load different maps, preserve player state.

---

## 6. Proposed Architecture

```
src/
├── core/
│   ├── Game.ts                  # Slim orchestrator: init, loop, delegate
│   ├── GameStateManager.ts      # State stack (Playing, Dialog, Pause, etc.)
│   ├── EntityManager.ts         # Central entity registry + queries
│   ├── EventBus.ts              # Typed pub/sub (already exists, needs wiring)
│   ├── AssetLoader.ts           # Asset loading (exists)
│   ├── AssetManifest.ts         # JSON manifest loader
│   ├── Config.ts                # Constants (exists)
│   └── InputManager.ts          # Action mapping layer over raw keys
│
├── components/                  # Pure data, no behavior
│   ├── Transform.ts
│   ├── Velocity.ts
│   ├── Collider.ts
│   ├── SpriteComponent.ts       # Asset ID, frame dimensions, draw scale
│   ├── AnimationComponent.ts    # Animation defs + state
│   ├── DialogComponent.ts       # Dialog tree reference for NPCs
│   ├── InteractableComponent.ts # Prompt text, interaction range, callback
│   ├── TriggerZoneComponent.ts  # Radius, event name, one-shot flag
│   ├── InventoryComponent.ts    # Items held
│   ├── AIComponent.ts           # Behavior type, patrol path, state
│   └── LightSourceComponent.ts  # Per-entity light emission
│
├── entities/
│   ├── EntityFactory.ts         # Create entities from data definitions
│   ├── Player.ts                # Player-specific input handling
│   ├── NPC.ts                   # NPC entity setup
│   └── Item.ts                  # Collectible item entity
│
├── systems/                     # Stateless processors operating on entities
│   ├── InputSystem.ts           # Raw key state (exists, slimmed down)
│   ├── PlayerControlSystem.ts   # Reads actions → sets player velocity
│   ├── PhysicsSystem.ts         # Movement + collision (exists)
│   ├── AnimationSystem.ts       # Animation state machine (exists)
│   ├── AISystem.ts              # NPC behavior/patrol/idle
│   ├── InteractionSystem.ts     # Proximity checks, prompt display
│   ├── TriggerSystem.ts         # Zone overlap detection → events
│   └── DialogSystem.ts          # Dialog progression logic
│
├── rendering/
│   ├── Renderer.ts              # Canvas draw queue + flush (slimmed down)
│   ├── Camera.ts                # Viewport (exists)
│   ├── IsometricUtils.ts        # Coordinate math (exists)
│   ├── PostProcessPipeline.ts   # WebGL2 lighting (exists)
│   ├── RenderPipeline.ts        # Orchestrates render passes per frame
│   └── effects/
│       ├── SnowfallEffect.ts
│       ├── BoundaryFogEffect.ts
│       └── EdgeFogEffect.ts
│
├── ui/
│   ├── UIManager.ts             # Manages UI layers/components
│   ├── HUD.ts                   # Exists (refactored)
│   ├── DialogUI.ts              # Dialog box, choices, portraits
│   ├── InventoryUI.ts           # Item grid
│   └── InteractPrompt.ts        # "Press E to talk" floating prompt
│
├── world/
│   ├── TileMap.ts               # Grid data (exists, slimmed down)
│   ├── WorldLoader.ts           # Load map from JSON
│   ├── SpatialIndex.ts          # Grid-based spatial lookup for entities
│   └── MapDefinition.ts         # Type defs for JSON map format
│
├── data/                        # Typed definitions loaded from JSON
│   ├── DialogData.ts
│   ├── ItemData.ts
│   └── NPCData.ts
│
├── assets/
│   └── ProceduralAssets.ts      # Exists
│
└── main.ts                      # Boot: load manifest, init Game
```

### Key Typed Events (for EventBus)

```typescript
interface GameEvents {
  'entity:added': { entity: Entity };
  'entity:removed': { entityId: string };
  'player:moved': { x: number; y: number };
  'trigger:enter': { zoneId: string; entityId: string };
  'trigger:exit': { zoneId: string; entityId: string };
  'interaction:start': { targetId: string };
  'interaction:end': { targetId: string };
  'dialog:open': { dialogId: string; npcId: string };
  'dialog:choice': { dialogId: string; choiceIndex: number };
  'dialog:close': { dialogId: string };
  'item:collected': { itemId: string; entityId: string };
  'inventory:changed': { items: string[] };
  'scene:transition': { from: string; to: string };
  'input:action': { action: Action; state: 'pressed' | 'released' };
}
```

---

## 7. Per-File Notes

| File | Size | Issues |
|------|------|--------|
| `Game.ts` | 387 lines | God object. Constructor: animation wiring. Render: fog/shadow/volumetric/input. Must be split. |
| `Renderer.ts` | 648 lines | Contains snowfall, fog, wisps. Extract into effects. Sort optimization needed. |
| `PostProcessPipeline.ts` | 722 lines | Well-structured but only handles single player. Needs generalization for N entities. |
| `Config.ts` | 119 lines | Good centralization. Missing character dimensions. Add feature flags section. |
| `Player.ts` | 41 lines | Clean. `handleInput` should move to `PlayerControlSystem`. |
| `Entity.ts` | 21 lines | Hardcoded components. Make optional/composable. |
| `Components.ts` | 27 lines | Fine, but should be split into separate files for extensibility. |
| `AnimationController.ts` | 117 lines | `instanceof Player` dependency in AnimationSystem. `IDLE_TIMEOUT` of 10s is oddly high. Direction strings untyped. |
| `AnimationSystem.ts` | 17 lines | `instanceof Player` check — won't scale for NPCs. |
| `PhysicsSystem.ts` | 60 lines | Clean. Needs trigger zone support and spatial indexing. |
| `InputSystem.ts` | 58 lines | Raw keycodes only. No action mapping. No mouse click. No touch support. |
| `TileMap.ts` | 95 lines | Conflates tile data + object storage + collision. O(n) object collision. |
| `WorldGenerator.ts` | 49 lines | Hardcoded positions. Replace with data-driven loader. |
| `HUD.ts` | 45 lines | innerHTML, direct DOM. Need UI component abstraction for dialogs/inventory. |
| `EventBus.ts` | 28 lines | Unused. Untyped. Needs typed event definitions. |
| `AssetLoader.ts` | 56 lines | Clean. Needs manifest-based loading. |
| `ProceduralAssets.ts` | 283 lines | Good fallback pattern. Large but self-contained. |
| `IsometricUtils.ts` | 30 lines | Clean and correct. |
| `Camera.ts` | 66 lines | Clean. Missing: bounds clamping, dead zones. |
| `main.ts` | 58 lines | Hardcoded asset list. Should load from manifest. |

---

## Summary Priority Matrix

| Priority | Item | Effort | Blocks |
|----------|------|--------|--------|
| **P0** | EntityManager | 1 day | NPCs, items, triggers |
| **P0** | GameStateManager | 1 day | Dialogs, pause, menus |
| **P0** | Wire EventBus + typed events | 1 day | Triggers, items, dialogs |
| **P1** | Input action mapping | 0.5 day | Interactions, rebinding |
| **P1** | Extract Renderer effects | 1 day | Clean codebase |
| **P1** | Slim down Game.ts render | 1 day | Maintainability |
| **P1** | Optional components / composition | 1 day | NPC/item entity diversity |
| **P2** | InteractionSystem + TriggerSystem | 2 days | NPC dialogs, item pickup |
| **P2** | Data-driven maps (JSON) | 1 day | Content scalability |
| **P2** | Asset manifest JSON | 0.5 day | Content scalability |
| **P2** | Dialog system + UI | 3 days | NPC conversations |
| **P3** | Spatial indexing for entities | 1 day | Performance at scale |
| **P3** | AI system for NPCs | 2 days | NPC behaviors |
| **P3** | Inventory system | 2 days | Collectibles |
| **P3** | Direction union type + cleanup | 0.5 day | Code quality |
