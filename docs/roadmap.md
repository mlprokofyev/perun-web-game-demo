# Roadmap

> Completed work, remaining tasks, and priority matrix.
>
> Last updated: 2026-02-16

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
| EntityManager | Central registry with spatial queries, emits entity:added/removed events |
| Wire EventBus with typed events | Fully typed GameEvents interface. Quest + inventory + collectible events implemented |
| Input action mapping | Action enum with configurable key bindings, rebind support. Actions: INVENTORY (I), QUEST_LOG (J) |
| GameStateManager | State stack with transparent/blocking flags, push/pop/replace |
| Make components optional | Nullable velocity, collider, animController. Systems null-check |

### Phase 2: Feature Infrastructure

| Task | Notes |
|------|-------|
| Interaction system | Proximity detection, dynamic "Press E to {label}" prompt, edge-triggered dispatch. Generalized to any Entity with `interactable = true`. |
| NPC base class | Walk-to (re-aim steering each frame), fade-in, state machine (WALKING→IDLE), non-solid during walk. Overshoot guard on arrival. |
| Dialog system | DialogData.ts (data model + registry), DialogUI.ts (HTML overlay), DialogState.ts (game state). Conditional branches with `condition` + `onSelect` callbacks. |
| Entity-vs-entity collision | PhysicsSystem: solid check, non-solid passthrough, overlap escape |
| Entity opacity / fade-in | Renderer globalAlpha based on entity.opacity |
| Blob shadows for all entities | Per-entity blobShadow config { rx, ry, opacity } |
| Interactable marker | Pixel-art SVG arrow as DOM overlay, zoom-aware scaling + bob animation |
| Dialog UI controls | Arrow/Enter/ESC navigation, mouse support, controls hint bar |
| Dog NPC (proof of concept) | Walk-to behavior with re-aim steering, 6-node branching dialog tree with quest integration |
| Animation stop-frame fix | Player snaps to frame 0 (neutral stance) on movement stop instead of freezing mid-stride |

### Phase 2b: Environment & Atmosphere

| Task | Notes |
|------|-------|
| Campfire entity | Animated procedural fire with spark particles, collider, `burst()` method for dramatic effects |
| Campfire ground object | obj_campfire on groundLayer (always below player), blob shadow |
| Fire light effect | Reusable breath+wobble+crackle flicker (FireLightEffect.ts) |
| Campfire light integration | Point light modulated by FireLightEffect, Config-driven params |
| Static world objects | Sticks snow ×2 with rotation, colliders, configurable shadow. Trees: med_snow, snow_big_1, pine_snow. |
| Object rotation support | Renderer ctx.translate/rotate |
| Isometric light projection | Elliptical distance in shader via u_isoRatio |
| Shadow opacity control | Profile-controlled u_shadowOpacity for soft day shadows |
| Separated ambient/direct lighting | Shader: volumetric only affects direct light, not ambient |
| Sprite-alpha height fade | Height fade uses actual sprite alpha, no rectangular fallback |
| Snow toggle | N key, edge-triggered |
| Day/night lighting profiles | NIGHT/DAY presets with lerpProfile() |
| Day/night smooth transition | 1.5s ease-in-out, all params interpolated as floats |
| Soft fire fade on mode change | fireOpacity/pointLightOpacity as continuous floats |
| Dynamic background color | Renderer.setBackgroundColor() driven by profile |
| Volumetric rim color per profile | Night: cool blue, Day: neutral white |

### Phase 3: Items & Quests

| Task | Notes |
|------|-------|
| **GameFlags / state variables** | `Map<string, any>` singleton for persistent game state. `getBool()`, `set()`. Serializable. |
| **TriggerZone entity** | Position + radius, pass-through collider, one-shot/repeatable flag. Fires `trigger:enter`/`trigger:exit` events. |
| **Conditional dialog branches** | `DialogChoice.condition` + `onSelect` callbacks. Choices filtered dynamically in DialogState. Integrates with GameFlags, Inventory, QuestTracker. |
| **Item definitions** | `ItemDef` type with registry. Built-in items: stick, bone, stone, ancient_ember. |
| **Inventory system** | `Inventory` singleton: add/remove/has/count, source tracking, emits `inventory:changed` with itemId/count/total. |
| **Collectible entity** | Extends Entity. States: IDLE (bob), PICKING_UP (scale+fade), LAUNCHING (parabolic arc), DONE. Auto-pickup on proximity. |
| **InteractableObject entity** | Generic invisible entity for static object interactions (e.g., collect from stick piles, feed campfire). One-shot/repeatable. |
| **Collectible spawning** | WorldGenerator + Game.ts data-driven placement. Stick piles via InteractableObject (press E); bone/stone via auto-pickup Collectible. |
| **Inventory UI** | HTML overlay toggled with `I` key → edge-triggered in Game._render(). Shows item icons, names, counts. |
| **Pickup feedback** | Floating text particles (+1, item names). World-to-screen projection, fade + rise animation. |
| **Quest data model** | `QuestDef` with objectives (collect, flag types). Registry. Two quests: q_gather_sticks, q_dog_bone. |
| **QuestTracker** | Runtime state per quest. Listens to `collectible:pickup`, `inventory:changed`. `checkFlags()` for explicit flag-based objective re-evaluation. Emits quest events. |
| **Quest log UI** | HTML overlay toggled with `J` key. Shows active/completed quests with objective progress. |
| **Quest HUD** | Top-right overlay showing current objective description + progress. |
| **Quest-gated dialog** | Dog NPC dialog references quest state, inventory, flags. Conditional choices for bone delivery, quest acceptance. |
| **Sample quest chain** | "Gathering Firewood" (collect 2 sticks → feed campfire → secret item emerges). "A Hungry Friend" (find bone → give to dog). |
| **Campfire interaction** | Dynamic interactability based on inventory+quest state. Consumes sticks, triggers fire burst, schedules secret item via pending events. |
| **Secret item emergence** | Ancient Ember: launches from campfire in parabolic arc to random nearby position. Pulsing glow during flight. |
| **Item preview dialog** | `ItemPreviewState` + `ItemPreviewUI`: centered overlay with item icon (64×64 upscaled), name, description. Triggers on pickup of non-stackable items. Enter/Space/ESC to dismiss. |
| **Pending events system** | Timer-based callback queue in Game.ts. Used for delayed secret item spawn after fire burst. |

---

## Next Up: Phase 4 — Content & Polish

| Task | Effort | Notes |
|------|--------|-------|
| **Data-driven maps** — JSON map files with tile grid + object placements + NPC spawns + trigger zones + collectibles | 2 days | Replace WorldGenerator.ts hardcoded positions |
| **Scene/Map transitions** — load different maps, preserve player state + inventory + quest progress | 1 day | Multi-area game |
| **Generalize volumetric rendering** — move per-entity shadow/volumetric config into a component (currently hardcoded to player + dog-specific constants) | 2 days | NPC lighting parity for any entity |
| **UI component system** — structured framework for dialogs, inventory, quest log, menus | 2 days | Reduce DOM boilerplate |
| **Save/Load** — serialize GameFlags + Inventory + QuestTracker + player position to localStorage | 1 day | Persistence |
| **More quest content** — additional quest chains, branching outcomes, rewards | 2 days | Validate full quest loop end-to-end |
| **Item use/combine** — use items from inventory, combine items for crafting | 1.5 days | Extends item system |
| **Objective markers** — HUD indicators pointing toward active quest objectives | 0.5 day | Reuse interactable marker pattern |

## Phase 5: Systems & Performance

| Task | Effort | Priority |
|------|--------|----------|
| Spatial indexing for entity collision (grid-based or quadtree) | 1 day | P3 |
| AI system for NPC behaviors (patrol, follow, flee) | 2 days | P3 |
| Pathfinding (A* on tile grid) for NPC navigation | 1 day | P3 |
| Dispose/cleanup patterns — remove listeners, free WebGL resources | 0.5 day | P3 |
| Render queue optimization — partition by layer before sorting | 0.5 day | P3 |

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
| **P1** | GameFlags / state variables | 0.5 day | Done |
| **P1** | TriggerZone entity | 1 day | Done |
| **P1** | Conditional dialog branches | 0.5 day | Done |
| **P1** | Item definitions + Inventory system | 1 day | Done |
| **P1** | Collectible entity + spawning | 1.5 day | Done |
| **P1** | Inventory UI | 1 day | Done |
| **P1** | Quest data model + QuestTracker | 1.5 day | Done |
| **P1** | Quest log UI + quest HUD | 1 day | Done |
| **P1** | Quest-gated dialog + sample quest chain | 1.5 day | Done |
| **P1** | InteractableObject + campfire interaction | 1 day | Done |
| **P1** | Secret item + launch animation | 0.5 day | Done |
| **P1** | Item preview dialog | 0.5 day | Done |
| **P1** | Animation stop-frame fix | — | Done |
| **P2** | Data-driven maps (JSON) | 2 days | — |
| **P2** | Scene/Map transitions | 1 day | — |
| **P2** | Generalize volumetric rendering | 2 days | — |
| **P2** | UI component system | 2 days | — |
| **P2** | Save/Load (localStorage) | 1 day | — |
| **P2** | More quest content | 2 days | — |
| **P2** | Item use/combine | 1.5 days | — |
| **P2** | Objective markers | 0.5 day | — |
| **P3** | Spatial indexing | 1 day | — |
| **P3** | AI system for NPCs | 2 days | — |
| **P3** | Pathfinding (A*) | 1 day | — |
| **P3** | Dispose/cleanup patterns | 0.5 day | — |

---

## Per-File Status

| File | Lines | Notes |
|------|-------|-------|
| core/Game.ts | ~1189 | Orchestrator. Interaction, collectibles, campfire interaction, item preview, floating text, pending events. NPC shadow hardcoded to dog constants. |
| core/GameState.ts | ~107 | State stack with transparent/blocking flags |
| core/EntityManager.ts | ~71 | Central registry with spatial queries |
| core/EventBus.ts | ~78 | Fully typed. Quest, inventory, collectible events active. |
| core/InputManager.ts | ~90 | Action mapping with INVENTORY (I), QUEST_LOG (J) |
| core/Config.ts | ~166 | All constants centralized. Campfire + dog params |
| core/GameFlags.ts | ~90 | Persistent game state singleton (booleans, counters, strings) |
| core/AssetManifest.ts | ~22 | JSON manifest loader |
| core/Types.ts | ~21 | Direction union type |
| entities/Entity.ts | ~47 | Optional components, opacity, blobShadow, interactable + interactLabel |
| entities/Player.ts | ~48 | Explicit component init |
| entities/NPC.ts | ~144 | Walk-to with re-aim steering, fade-in, state machine, overshoot guard |
| entities/Campfire.ts | ~130 | Spark particles, collider, animated fire, burst() for dramatic effects |
| entities/Collectible.ts | ~188 | IDLE/PICKING_UP/LAUNCHING/DONE states, parabolic arc launch |
| entities/InteractableObject.ts | ~51 | Generic invisible interactable for static objects |
| entities/TriggerZone.ts | ~101 | Invisible trigger with enter/exit events |
| entities/AnimationController.ts | ~122 | Typed Direction, stop-on-frame-0, idle timeout |
| entities/Components.ts | ~27 | Transform, Velocity, Collider |
| items/ItemDef.ts | ~75 | Item type + registry. 4 built-in items (stick, bone, stone, ancient_ember) |
| items/Inventory.ts | ~137 | Add/remove/has/count, source tracking, EventBus integration |
| quests/QuestDef.ts | ~79 | Quest + objective data model, registry. 2 quests defined. |
| quests/QuestTracker.ts | ~208 | Runtime quest state, event listeners, checkFlags() |
| dialog/DialogData.ts | ~148 | Data model + registry + quest-integrated dog dialog (condition/onSelect) |
| states/DialogState.ts | ~107 | Transparent, blocks update. Filters choices by condition. |
| states/InventoryState.ts | ~29 | Transparent overlay for inventory |
| states/QuestLogState.ts | ~29 | Transparent overlay for quest log |
| states/ItemPreviewState.ts | ~43 | Transparent overlay for item discovery dialog |
| ui/DialogUI.ts | ~127 | Arrow/Enter/ESC navigation, mouse, hints |
| ui/HUD.ts | ~93 | Player info + quest tracker HUD |
| ui/InventoryUI.ts | ~101 | HTML overlay: item icons, names, counts |
| ui/QuestLogUI.ts | ~113 | HTML overlay: active/completed quests + objectives |
| ui/ItemPreviewUI.ts | ~86 | HTML overlay: item discovery preview (icon + name + description) |
| systems/PhysicsSystem.ts | ~92 | Entity-vs-entity collision, overlap escape |
| systems/AnimationSystem.ts | ~17 | Null-checks optional animController |
| systems/InputSystem.ts | ~58 | Raw key state |
| rendering/Renderer.ts | ~305 | Z-sort, rotation, dynamic bg color |
| rendering/PostProcessPipeline.ts | ~751 | Lighting, shadows, iso projection, volumetric |
| rendering/LightingProfile.ts | ~137 | Day/night presets, lerpProfile() |
| rendering/effects/FireLightEffect.ts | ~144 | Breath + wobble + crackle flicker |
| rendering/effects/SnowfallEffect.ts | ~174 | Extracted from Renderer |
| rendering/effects/FogEffect.ts | ~268 | Boundary + animated wisps |
| rendering/Camera.ts | ~66 | Unchanged |
| rendering/IsometricUtils.ts | ~30 | Unchanged |
| world/TileMap.ts | ~114 | WorldObject with rotation, groundLayer, shadowHeight, removeObjectById |
| world/WorldGenerator.ts | ~87 | Campfire, sticks, trees (med_snow, big_1, pine_snow), house. Hardcoded positions. |
| assets/ProceduralAssets.ts | ~661 | Campfire anim + item icons + world sprites (stick, bone, stone, ancient_ember) |
| main.ts | ~43 | Loads from manifest |
| index.html | ~538 | Dialog, inventory, quest log, item preview overlays. Controls hints. |
