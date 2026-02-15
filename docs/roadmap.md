# Roadmap

> Completed work, remaining tasks, and priority matrix.
>
> Last updated: 2026-02-15

---

## Completed

### Phase 0: Quick Wins

| Task | Notes |
|------|-------|
| Type Direction as a union type | src/core/Types.ts -- union type + ALL_DIRECTIONS constant |
| Move magic numbers to Config.ts | Character dimensions, tile dimensions, NPC constants all centralized |
| Extract SnowfallEffect | src/rendering/effects/SnowfallEffect.ts -- ~174 lines from Renderer |
| Extract FogEffect | src/rendering/effects/FogEffect.ts -- ~268 lines from Renderer |
| Create asset manifest JSON | public/assets/data/assets.json + AssetManifest.ts loader |

### Phase 1: Core Infrastructure

| Task | Notes |
|------|-------|
| EntityManager | src/core/EntityManager.ts -- central registry with spatial queries, emits events |
| Wire EventBus with typed events | src/core/EventBus.ts -- fully typed GameEvents interface |
| Input action mapping | src/core/InputManager.ts -- Action enum with configurable key bindings |
| GameStateManager | src/core/GameState.ts -- state stack with transparent/blocking flags |
| Make components optional | Entity.ts -- nullable velocity, collider, animController. Systems null-check |

### Phase 2: Feature Infrastructure (Partial)

| Task | Notes |
|------|-------|
| Interaction system | Proximity detection, "Press E" prompt, edge-triggered dialog opening |
| NPC base class | src/entities/NPC.ts -- walk-to, fade-in, state machine, non-solid during walk |
| Dialog system | DialogData.ts (data model), DialogUI.ts (UI), DialogState.ts (game state) |
| Entity-vs-entity collision | PhysicsSystem.ts -- solid check, non-solid passthrough, overlap escape |
| Entity opacity / fade-in | Renderer.ts -- globalAlpha based on entity opacity |
| Blob shadows for all entities | Per-entity blobShadow config |
| Interactable marker | Pixel-art SVG arrow as DOM overlay, zoom-aware scaling |
| Dialog UI controls | Arrow/Enter/ESC navigation, mouse support, controls hint bar |
| Dog NPC (proof of concept) | Walk-to behavior, 6-node branching dialog tree |

### Phase 2b: Environment & Atmosphere

| Task | Notes |
|------|-------|
| Campfire entity | src/entities/Campfire.ts -- animated procedural fire with spark particles, collider |
| Campfire ground object | obj_campfire on groundLayer (always below player), blob shadow |
| Fire light effect | src/rendering/effects/FireLightEffect.ts -- reusable breath+wobble+crackle flicker |
| Campfire light integration | Point light modulated by FireLightEffect, configurable via Config.ts |
| Static world objects | Sticks snow x2 with rotation, colliders, configurable shadow |
| Object rotation support | Renderer supports rotated objects via ctx.translate/rotate |
| Isometric light projection | Elliptical distance in shader via u_isoRatio |
| Shadow opacity control | Profile-controlled u_shadowOpacity for soft day shadows |
| Separated ambient/direct lighting | Shader refactor: volumetric only affects direct light, not ambient |
| Sprite-alpha height fade | Height fade uses actual sprite alpha, no rectangular fallback |
| Snow toggle | N key, edge-triggered |
| Day/night lighting profiles | LightingProfile.ts -- NIGHT/DAY presets with lerpProfile() |
| Day/night smooth transition | 1.5s ease-in-out, all parameters interpolated as floats |
| Soft fire fade on mode change | fireOpacity/pointLightOpacity as continuous floats (not booleans) |
| Dynamic background color | Renderer.setBackgroundColor() driven by profile |
| Volumetric rim color per profile | Night: cool blue, Day: neutral white |

---

## Remaining

### Phase 2: Feature Infrastructure

| Task | Effort | Blocks |
|------|--------|--------|
| **TriggerZone entity** -- position + radius + event name, pass-through collider, one-shot/repeatable | 1 day | Item pickup, area events |
| **Generalize volumetric/shadow rendering** -- move per-entity render config into a component so any entity can have volumetric shading | 2 days | NPC lighting parity |

### Phase 3: Content Infrastructure

| Task | Effort | Blocks |
|------|--------|--------|
| **Data-driven maps** -- JSON map files with tile grid + object placements + NPC spawns + trigger zones | 2 days | Content scalability |
| **Inventory system** -- item definitions, player inventory state, pickup events | 2 days | Collectibles |
| **Scene/Map transitions** -- load different maps, preserve player state | 1 day | Multi-area game |

### Quality & Performance

| Task | Effort | Priority |
|------|--------|----------|
| **Data-driven world** -- replace WorldGenerator.ts hardcoded positions with JSON | 1 day | P2 |
| **UI component system** -- structured framework for dialogs, inventory, menus | 2 days | P2 |
| **Spatial indexing** for entity collision (grid-based or quadtree) | 1 day | P3 |
| **AI system** for NPC behaviors (patrol, follow, flee) | 2 days | P3 |
| **Pathfinding** (A* on tile grid) for NPC navigation | 1 day | P3 |
| **Dispose/cleanup patterns** -- remove listeners, free WebGL resources | 0.5 day | P3 |
| **Render queue optimization** -- partition by layer before sorting | 0.5 day | P3 |

---

## Priority Matrix

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| **P0** | EntityManager | 1 day | Done |
| **P0** | GameStateManager | 1 day | Done |
| **P0** | Wire EventBus + typed events | 1 day | Done |
| **P1** | Input action mapping | 0.5 day | Done |
| **P1** | Extract Renderer effects | 1 day | Done |
| **P1** | Optional components / composition | 1 day | Done |
| **P1** | NPC system + dog PoC | 2 days | Done |
| **P1** | Dialog system + UI | 3 days | Done |
| **P1** | Interaction system | 1 day | Done |
| **P1** | Asset manifest JSON | 0.5 day | Done |
| **P1** | Campfire entity + fire effects | 1 day | Done |
| **P1** | Day/night profiles + transitions | 1 day | Done |
| **P1** | Isometric lighting + shadow fixes | 1 day | Done |
| **P2** | TriggerZone entity + system | 1 day | -- |
| **P2** | Generalize volumetric rendering | 2 days | -- |
| **P2** | Data-driven maps (JSON) | 2 days | -- |
| **P2** | UI component system | 2 days | -- |
| **P3** | Inventory system | 2 days | -- |
| **P3** | Spatial indexing | 1 day | -- |
| **P3** | AI system for NPCs | 2 days | -- |
| **P3** | Pathfinding (A*) | 1 day | -- |
| **P3** | Scene/Map transitions | 1 day | -- |
| **P3** | Dispose/cleanup patterns | 0.5 day | -- |

---

## Per-File Status

| File | Lines | Notes |
|------|-------|-------|
| core/Game.ts | ~804 | Orchestrator. Interaction logic + lighting profiles inline |
| core/GameState.ts | ~107 | State stack with transparent/blocking flags |
| core/EntityManager.ts | ~71 | Central registry with spatial queries |
| core/EventBus.ts | ~56 | Fully typed, actively used |
| core/InputManager.ts | ~86 | Action mapping with rebind support. TOGGLE_SNOW, TOGGLE_TIME added |
| core/Config.ts | ~166 | All constants centralized. Campfire params added |
| core/AssetManifest.ts | ~22 | JSON manifest loader |
| core/Types.ts | ~21 | Direction union type |
| entities/Entity.ts | ~41 | Optional components, opacity, blobShadow |
| entities/Player.ts | ~48 | Explicit component init |
| entities/NPC.ts | ~136 | Walk-to, fade-in, state machine |
| entities/Campfire.ts | ~100 | Spark particles, collider, animated fire |
| entities/AnimationController.ts | ~125 | Typed Direction |
| entities/Components.ts | ~27 | Transform, Velocity, Collider |
| systems/PhysicsSystem.ts | ~92 | Entity-vs-entity collision, overlap escape |
| systems/AnimationSystem.ts | ~17 | Null-checks optional animController |
| systems/InputSystem.ts | ~58 | Raw key state |
| rendering/Renderer.ts | ~304 | Z-sort, rotation, dynamic bg color |
| rendering/PostProcessPipeline.ts | ~750 | Lighting, shadows, iso projection, volumetric |
| rendering/LightingProfile.ts | ~136 | Day/night presets, lerpProfile() |
| rendering/effects/FireLightEffect.ts | ~143 | Breath + wobble + crackle flicker |
| rendering/effects/SnowfallEffect.ts | ~174 | Extracted from Renderer |
| rendering/effects/FogEffect.ts | ~268 | Boundary + animated wisps |
| rendering/Camera.ts | ~66 | Unchanged |
| rendering/IsometricUtils.ts | ~30 | Unchanged |
| dialog/DialogData.ts | ~95 | Data model + 6-node sample dialog |
| states/DialogState.ts | ~82 | Transparent, blocks update |
| ui/DialogUI.ts | ~127 | Arrow/Enter/ESC navigation, mouse, hints |
| ui/HUD.ts | ~45 | Unchanged |
| world/TileMap.ts | ~102 | WorldObject with rotation, groundLayer, shadowHeight |
| world/WorldGenerator.ts | ~88 | Campfire, sticks, all objects |
| assets/ProceduralAssets.ts | ~452 | Campfire anim sprite sheet added |
| main.ts | ~33 | Loads from manifest |
| index.html | ~242 | Dialog container, markers, controls hints (N, T keys) |
