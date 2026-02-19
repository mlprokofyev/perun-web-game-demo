# Roadmap

> Completed work, remaining tasks, and priority matrix.
>
> Last updated: 2026-02-19

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
| Interactable marker | Dedicated canvas overlay above WebGL post-process layer. Procedural pixel-art arrow, zoom-aware scaling + bob animation. Player occlusion via `destination-out` compositing. Unaffected by lighting/shadows. |
| Dialog UI controls | Arrow/Enter/ESC navigation, mouse support, controls hint bar |
| Dog NPC (proof of concept) | Walk-to behavior with re-aim steering, 6-node branching dialog tree with quest integration |
| Animation stop-frame fix | Player snaps to frame 0 (neutral stance) on movement stop instead of freezing mid-stride |
| Interactable marker improvements | Canvas-rendered markers visible above static objects, occluded by player. `[E]` badge with pulse animation drawn alongside arrow. Separate `NPC_ONBOARD_RADIUS` for badge visibility. |

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
| Dynamic fog/vignette profiles | Vignette and fog wisps decoupled — independent color, opacity, blend mode per lighting profile. Night: dark additive glow. Day: blue-grey framing + white fog patches. |
| Profile-driven snow opacity | Snow particle alpha driven by `snowOpacity` in profile (night=full, day=subtle 0.1) |

### Phase 3a: HUD & UI Polish

| Task | Notes |
|------|-------|
| Controls help overlay | `ControlsHelpUI.ts` — HTML overlay listing all controls by category. Toggle with `H` key. |
| Debug panel toggle | Debug info and FPS/zoom panels hidden by default. Toggle with `U` key (edge-triggered). |
| Quest HUD toggle | Quest objective tracker togglable with `Q` key. Visible by default. |
| Sub-path deployment | Vite `base` config for `/doors/1/` sub-path. `AssetManifest` uses `import.meta.env.BASE_URL` for all asset paths. |

### Phase 3b: Items & Quests

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
| **Dog quest fix** | Changed "give bone" objective from `talk`/required:2 to `flag`/`dog_fed`/required:1. Fixed counter display and missing dialog option. Retroactive talk credit on quest accept. |
| **Bone consumption fix** | Giving bone to dog now removes all bones from inventory (`inventory.remove('bone', inventory.count('bone'))`). |
| **ESC closes all modals** | Inventory (I) and Quest Log (J) panels now dismissible with ESC, matching Dialog and Item Preview behavior. Hint text updated in UI. |
| **Dog spawn delay** | Dog NPC spawns after `DOG_SPAWN_DELAY` (2s) via pending events, not immediately. |

### Phase 3c: Localization & Polish

| Task | Notes |
|------|-------|
| **Russian localization** | All user-facing text translated to Russian: dialogs, item names/descriptions, quest titles/objectives, UI labels, interaction prompts, controls help, HUD debug labels, floating text, page title. `lang="ru"` on HTML root. |
| **Marker occlusion fix** | Two-pass rendering in `drawInteractMarkers`: pass 1 draws markers behind the player (with `destination-out` occlusion), pass 2 draws markers in front (no occlusion). Prevents markers disappearing when player walks behind the marked entity. |
| **HUD readability fix** | Added semi-transparent dark backgrounds with borders to `#hud`, `#debug-overlay`, `#controls-hint`, `#interact-prompt`. Reduced text-shadow blur for `#quest-hud`. Readable in both day and night modes. |
| **Sticks asset update** | `stick_pile_1` uses `obj_sticks_snow_rotated` asset with no rotation applied. Added to asset manifest. |
| **Sticks collider tuning** | Reduced `solidCols` from 0.4→0.2 and `solidRows` from 0.4→0.15 for `stick_pile_1` to match the visual footprint and eliminate dead-zone. |
| **Campfire feed/burst state** | Campfire starts small/dim (0.7×/0.8×), grows to normal (1×/1×) after `feed()`. `burst()` temporarily boosts scale, light, sparks, spawn rate. `lightMult` getter dynamically combines state + burst multipliers. |
| **Smooth burst envelope** | Replaced instant burst on/off with three-phase envelope (ramp-up 0.3s, hold, ramp-down 0.5s). All burst parameters (scale, light, sparks, spawn rate) lerp from baseline to peak using eased `burstT`. Quadratic easing: `easeIn(t)=t²`, `easeOut(t)=1-(1-t)²`. |

### Phase 3d: Gameplay Enhancements

| Task | Notes |
|------|-------|
| **Secret lighter item** | Pink lighter with custom PNG asset. Spawns at campfire after fire burst. `glowColor` radial gradient halo on world object, inventory icon, and item preview. |
| **Interactive inventory** | Keyboard navigation (↑/↓/W/S) through inventory slots. Enter/Space opens inspect action → full-size preview via `ItemPreviewUI` (header hidden). ESC returns to inventory. Player movement blocked during overlays. |
| **Mobile web detection** | `main.ts` checks UA + touch heuristics. Shows Russian unsupported-platform message and prevents game from loading on mobile. |
| **Dog sleep state** | `NPCState.SLEEPING` + `sleep()` method on NPC. Triggered after bone quest completion (on `dialog:close` event). Plays `dog_sleeping` 2-frame animation. Floating "zzz" effect rendered above sleeping dog. |
| **Wall note** | Procedural paper sprite on house wall (`obj_note_paper`) via `InteractableObject`. Opens `NoteUI` parchment overlay with developer message. Non-depleting (re-readable). `depthBias: -100` ensures player always in front. `markerOffsetY` for elevated [E] marker. |
| **Dynamic dog dialog** | Dialog choices adapt based on quest state via `condition` callbacks: pre-quest, active (waiting for bone), bone in inventory, and post-completion. Added "waiting" dialog node. |
| **Onboarding hint** | Floating message above player on start ("press WASD to move"). Dismisses after first movement. Semi-transparent background, monospace font. |
| **Inventory preview HUD** | Transparent preview below quest HUD showing inventory contents and "I" button hint. |
| **Barrel object** | `obj_barrel_snow` (barrel_snow.png 124×127) at (2.0, 2.8). Solid 0.35×0.35, shadow radius 22. |
| **Lighter glow (radial gradient)** | Replaced `box-shadow` rectangles with `ctx.createRadialGradient()` for smooth circular glow on canvas icons. 5-stop gradient for smoother falloff. Canvas sizes increased (32×32 inventory, 120×120 preview). |
| **InteractableObject marker offset** | Added `markerOffsetY` property for elevated [E] markers on wall-mounted objects. |
| **depthBias for WorldObject** | Added `depthBias` to `WorldObject` and `Renderer.enqueueObject()`. Negative values push objects behind entities for correct Z-sorting of wall decorations. |
| **Note interaction radius fix** | Increased from 0.1 → 1.0 (player couldn't reach trigger zone due to house collider). |
| **ItemPreviewUI visible fix** | Explicit `display: 'none'` in constructor prevents false positive from CSS-only hiding. |

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
| **P1** | Interactable marker improvements | — | Done |
| **P1** | Dynamic fog/vignette profiles | 0.5 day | Done |
| **P1** | Profile-driven snow opacity | — | Done |
| **P1** | Controls help overlay (H) | 0.5 day | Done |
| **P1** | Debug/quest HUD toggles (U, Q) | 0.5 day | Done |
| **P1** | Sub-path deployment (/doors/1/) | 0.5 day | Done |
| **P1** | Dog quest fix (flag-based objective) | — | Done |
| **P1** | Bone consumption fix | — | Done |
| **P1** | ESC closes all modals | — | Done |
| **P1** | Dog spawn delay | — | Done |
| **P1** | Russian localization | 0.5 day | Done |
| **P1** | Marker occlusion fix (two-pass) | — | Done |
| **P1** | HUD readability (day/night) | — | Done |
| **P1** | Sticks asset + collider tuning | — | Done |
| **P1** | Campfire feed/burst state system | 0.5 day | Done |
| **P1** | Smooth burst envelope (eased ramp) | — | Done |
| **P1** | Secret lighter item + glow | 0.5 day | Done |
| **P1** | Interactive inventory (keyboard nav + inspect) | 0.5 day | Done |
| **P1** | Mobile web detection + warning | — | Done |
| **P1** | Dog sleep state + zzz animation | 0.5 day | Done |
| **P1** | Wall note + NoteUI parchment overlay | 0.5 day | Done |
| **P1** | Dynamic dog dialog (quest-aware choices) | — | Done |
| **P1** | Onboarding movement hint | — | Done |
| **P1** | Barrel object | — | Done |
| **P1** | depthBias for WorldObject Z-sorting | — | Done |
| **P1** | InteractableObject markerOffsetY | — | Done |
| **P1** | Radial gradient glow (inventory + preview) | — | Done |
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
| core/Game.ts | ~1590 | Orchestrator. Interaction, collectibles, campfire interaction, item preview, floating text, pending events, profile-driven effects, controls help, debug/quest toggles, ESC-close for all modals, two-pass marker canvas overlay with depth-aware player occlusion. Campfire light radius/intensity driven by `Campfire.lightMult`. All user-facing strings in Russian. NPC shadow hardcoded to dog constants. Interactive inventory (keyboard nav + inspect). Wall note interactable. Dog sleep + zzz animation. Onboarding hint. |
| core/GameState.ts | ~108 | State stack with transparent/blocking flags |
| core/EntityManager.ts | ~71 | Central registry with spatial queries |
| core/EventBus.ts | ~78 | Fully typed. Quest, inventory, collectible events active. |
| core/InputManager.ts | ~96 | Action mapping with INVENTORY (I), QUEST_LOG (J), CONTROLS_HELP (H), TOGGLE_DEBUG (U), TOGGLE_QUEST_HUD (Q) |
| core/Config.ts | ~188 | All constants centralized. Campfire + dog params (including DOG_SLEEP_SRC_W/H), NPC onboard radius, dog spawn delay |
| core/GameFlags.ts | ~90 | Persistent game state singleton (booleans, counters, strings) |
| core/AssetManifest.ts | ~26 | JSON manifest loader. BASE_URL-aware for sub-path deployment. |
| core/AssetLoader.ts | ~56 | Image loader/cache |
| core/Types.ts | ~21 | Direction union type |
| entities/Entity.ts | ~47 | Optional components, opacity, blobShadow, interactable + interactLabel |
| entities/Player.ts | ~61 | Explicit component init |
| entities/NPC.ts | ~155 | Walk-to with re-aim steering, fade-in, state machine (WALKING → IDLE → SLEEPING), overshoot guard. `sleep()` method. Default interact label in Russian. |
| entities/Campfire.ts | ~216 | Spark particles, collider, animated fire. State-based scale/light (unfed 0.7×/0.8× → fed 1×/1×). Smooth burst envelope: ramp-up (0.3s, easeIn) → hold → ramp-down (0.5s, easeOut). All burst params lerped from burstT. |
| entities/Collectible.ts | ~188 | IDLE/PICKING_UP/LAUNCHING/DONE states, parabolic arc launch |
| entities/InteractableObject.ts | ~58 | Generic invisible interactable for static objects. `markerOffsetY` for elevated markers. |
| entities/TriggerZone.ts | ~101 | Invisible trigger with enter/exit events |
| entities/AnimationController.ts | ~121 | Typed Direction, stop-on-frame-0, idle timeout |
| entities/Components.ts | ~27 | Transform, Velocity, Collider |
| items/ItemDef.ts | ~79 | Item type + registry. 5 built-in items (stick, bone, stone, ancient_ember, pink_lighter). `glowColor` support. Names/descriptions in Russian. |
| items/Inventory.ts | ~138 | Add/remove/has/count, source tracking, EventBus integration |
| quests/QuestDef.ts | ~80 | Quest + objective data model, registry. 2 quests defined. Titles/descriptions/objectives in Russian. |
| quests/QuestTracker.ts | ~208 | Runtime quest state, event listeners, checkFlags() |
| dialog/DialogData.ts | ~155 | Data model + registry + quest-integrated dog dialog (condition/onSelect, bone consumption, dynamic choices based on quest state, "waiting" node). All dialog text in Russian. |
| states/DialogState.ts | ~107 | Transparent, blocks update. Filters choices by condition. |
| states/InventoryState.ts | ~29 | Transparent overlay for inventory |
| states/QuestLogState.ts | ~29 | Transparent overlay for quest log |
| states/ItemPreviewState.ts | ~43 | Transparent overlay for item discovery dialog |
| ui/DialogUI.ts | ~127 | Arrow/Enter/ESC navigation, mouse, hints |
| ui/ControlsHelpUI.ts | ~53 | HTML overlay listing all controls by category. Toggle with H key. All text in Russian. |
| ui/HUD.ts | ~123 | Debug panels (toggleable with U), quest HUD tracker (toggleable with Q) |
| ui/InventoryUI.ts | ~213 | HTML overlay: item icons with glow gradients, names, counts. Keyboard navigation (↑/↓/W/S), inspect action (Enter/Space). Labels in Russian. |
| ui/QuestLogUI.ts | ~114 | HTML overlay: active/completed quests + objectives. Labels in Russian. |
| ui/ItemPreviewUI.ts | ~95 | HTML overlay: item preview with 120×120 canvas, radial glow gradient, optional header. Labels in Russian. |
| ui/NoteUI.ts | ~67 | Parchment overlay for developer wall note. Dismissible with Enter/Space/Escape. Reusable. |
| systems/PhysicsSystem.ts | ~92 | Entity-vs-entity collision, overlap escape |
| systems/AnimationSystem.ts | ~20 | Null-checks optional animController |
| systems/InputSystem.ts | ~58 | Raw key state |
| rendering/Renderer.ts | ~373 | Z-sort with depthBias, rotation, dynamic bg color, profile-driven effects dispatch |
| rendering/PostProcessPipeline.ts | ~750 | Lighting, shadows, iso projection, volumetric |
| rendering/LightingProfile.ts | ~188 | Day/night presets + fog/vignette/snow profiles, lerpProfile() |
| rendering/effects/FireLightEffect.ts | ~143 | Breath + wobble + crackle flicker |
| rendering/effects/SnowfallEffect.ts | ~179 | Extracted from Renderer, profile-driven opacity |
| rendering/effects/FogEffect.ts | ~329 | Decoupled vignette + animated wisps, profile-driven color/opacity/blend |
| rendering/Camera.ts | ~66 | Unchanged |
| rendering/IsometricUtils.ts | ~30 | Unchanged |
| world/TileMap.ts | ~117 | WorldObject with rotation, groundLayer, shadowHeight, depthBias, removeObjectById |
| world/WorldGenerator.ts | ~112 | Campfire, sticks, trees, house, barrel, wall note. Hardcoded positions. depthBias for wall decorations. |
| assets/ProceduralAssets.ts | ~890 | Campfire anim + item icons + world sprites (stick, bone, stone, ancient_ember, lighter) + interact_marker + note_paper sprites |
| main.ts | ~73 | Mobile detection + unsupported-platform warning. Loads from manifest. |
| index.html | ~844 | Dialog, inventory, quest log, item preview, note parchment, controls help overlays. `lang="ru"`, all labels in Russian. Inventory selection styles, note parchment styles with animation. |
