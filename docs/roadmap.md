# Roadmap

> Completed work, remaining tasks, and priority matrix.
>
> Last updated: 2026-02-15

---

## Completed

### Phase 0: Quick Wins

| Task | Notes |
|------|-------|
| Type `Direction` as a union type | `src/core/Types.ts` — union type + `ALL_DIRECTIONS` constant |
| Move magic numbers to `Config.ts` | Character dimensions, tile dimensions, NPC constants all centralized |
| Extract `SnowfallEffect` | `src/rendering/effects/SnowfallEffect.ts` — ~174 lines from Renderer |
| Extract `FogEffect` | `src/rendering/effects/FogEffect.ts` — ~268 lines from Renderer |
| Create asset manifest JSON | `public/assets/data/assets.json` + `AssetManifest.ts` loader |

### Phase 1: Core Infrastructure

| Task | Notes |
|------|-------|
| EntityManager | `src/core/EntityManager.ts` — central registry with spatial queries, emits events |
| Wire EventBus with typed events | `src/core/EventBus.ts` — fully typed `GameEvents` interface |
| Input action mapping | `src/core/InputManager.ts` — `Action` enum with configurable key bindings |
| GameStateManager | `src/core/GameState.ts` — state stack with transparent/blocking flags |
| Make components optional | `Entity.ts` — nullable `velocity`, `collider`, `animController`. Systems null-check |

### Phase 2: Feature Infrastructure (Partial)

| Task | Notes |
|------|-------|
| Interaction system | Proximity detection, "Press E" prompt, edge-triggered dialog opening |
| NPC base class | `src/entities/NPC.ts` — walk-to, fade-in, state machine, non-solid during walk |
| Dialog system | `DialogData.ts` (data model), `DialogUI.ts` (UI), `DialogState.ts` (game state) |
| Entity-vs-entity collision | `PhysicsSystem.ts` — solid check, non-solid passthrough, overlap escape |
| Entity opacity / fade-in | `Renderer.ts` — `globalAlpha` based on entity opacity |
| Blob shadows for all entities | Per-entity `blobShadow` config |
| Interactable marker | Pixel-art SVG arrow as DOM overlay, zoom-aware scaling |
| Dialog UI controls | Arrow/Enter/ESC navigation, mouse support, controls hint bar |
| Dog NPC (proof of concept) | Walk-to behavior, 6-node branching dialog tree |

---

## Remaining

### Phase 2: Feature Infrastructure

| Task | Effort | Blocks |
|------|--------|--------|
| **TriggerZone entity** — position + radius + event name, pass-through collider, one-shot/repeatable | 1 day | Item pickup, area events |
| **Generalize volumetric/shadow rendering** — move per-entity render config into a component so any entity can have volumetric shading | 2 days | NPC lighting parity |

### Phase 3: Content Infrastructure

| Task | Effort | Blocks |
|------|--------|--------|
| **Data-driven maps** — JSON map files with tile grid + object placements + NPC spawns + trigger zones | 2 days | Content scalability |
| **Inventory system** — item definitions, player inventory state, pickup events | 2 days | Collectibles |
| **Scene/Map transitions** — load different maps, preserve player state | 1 day | Multi-area game |

### Quality & Performance

| Task | Effort | Priority |
|------|--------|----------|
| **Data-driven world** — replace `WorldGenerator.ts` hardcoded positions with JSON | 1 day | P2 |
| **UI component system** — structured framework for dialogs, inventory, menus | 2 days | P2 |
| **Spatial indexing** for entity collision (grid-based or quadtree) | 1 day | P3 |
| **AI system** for NPC behaviors (patrol, follow, flee) | 2 days | P3 |
| **Pathfinding** (A* on tile grid) for NPC navigation | 1 day | P3 |
| **Dispose/cleanup patterns** — remove listeners, free WebGL resources | 0.5 day | P3 |
| **Render queue optimization** — partition by layer before sorting | 0.5 day | P3 |

---

## Priority Matrix

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| **P0** | EntityManager | 1 day | ✅ |
| **P0** | GameStateManager | 1 day | ✅ |
| **P0** | Wire EventBus + typed events | 1 day | ✅ |
| **P1** | Input action mapping | 0.5 day | ✅ |
| **P1** | Extract Renderer effects | 1 day | ✅ |
| **P1** | Optional components / composition | 1 day | ✅ |
| **P1** | NPC system + dog PoC | 2 days | ✅ |
| **P1** | Dialog system + UI | 3 days | ✅ |
| **P1** | Interaction system | 1 day | ✅ |
| **P1** | Asset manifest JSON | 0.5 day | ✅ |
| **P2** | TriggerZone entity + system | 1 day | — |
| **P2** | Generalize volumetric rendering | 2 days | — |
| **P2** | Data-driven maps (JSON) | 2 days | — |
| **P2** | UI component system | 2 days | — |
| **P3** | Inventory system | 2 days | — |
| **P3** | Spatial indexing | 1 day | — |
| **P3** | AI system for NPCs | 2 days | — |
| **P3** | Pathfinding (A*) | 1 day | — |
| **P3** | Scene/Map transitions | 1 day | — |
| **P3** | Dispose/cleanup patterns | 0.5 day | — |

---

## Per-File Status

| File | Lines | Notes |
|------|-------|-------|
| `core/Game.ts` | ~595 | Orchestrator. Interaction logic inline — candidate for extraction |
| `core/GameState.ts` | ~107 | State stack with transparent/blocking flags |
| `core/EntityManager.ts` | ~71 | Central registry with spatial queries |
| `core/EventBus.ts` | ~56 | Fully typed, actively used |
| `core/InputManager.ts` | ~82 | Action mapping with rebind support |
| `core/Config.ts` | ~150 | All constants centralized |
| `core/AssetManifest.ts` | ~22 | JSON manifest loader |
| `core/Types.ts` | ~21 | Direction union type |
| `entities/Entity.ts` | ~41 | Optional components, opacity, blobShadow |
| `entities/Player.ts` | ~48 | Explicit component init |
| `entities/NPC.ts` | ~136 | Walk-to, fade-in, state machine |
| `entities/AnimationController.ts` | ~125 | Typed Direction |
| `entities/Components.ts` | ~27 | Transform, Velocity, Collider |
| `systems/PhysicsSystem.ts` | ~92 | Entity-vs-entity collision, overlap escape |
| `systems/AnimationSystem.ts` | ~17 | Null-checks optional animController |
| `systems/InputSystem.ts` | ~58 | Raw key state |
| `rendering/Renderer.ts` | ~273 | Slimmed from ~650. Effects extracted. Opacity support |
| `rendering/effects/SnowfallEffect.ts` | ~174 | Extracted from Renderer |
| `rendering/effects/FogEffect.ts` | ~268 | Boundary + animated wisps |
| `rendering/Camera.ts` | ~66 | Unchanged |
| `rendering/IsometricUtils.ts` | ~30 | Unchanged |
| `rendering/PostProcessPipeline.ts` | ~723 | Still player-only for volumetric |
| `dialog/DialogData.ts` | ~95 | Data model + 6-node sample dialog |
| `states/DialogState.ts` | ~82 | Transparent, blocks update |
| `ui/DialogUI.ts` | ~127 | Arrow/Enter/ESC navigation, mouse, hints |
| `ui/HUD.ts` | ~45 | Unchanged |
| `world/TileMap.ts` | ~95 | O(n) object collision |
| `world/WorldGenerator.ts` | ~50 | Hardcoded positions |
| `assets/ProceduralAssets.ts` | ~283 | Unchanged |
| `main.ts` | ~33 | Loads from manifest |
| `index.html` | ~241 | Dialog container, markers, styles |
