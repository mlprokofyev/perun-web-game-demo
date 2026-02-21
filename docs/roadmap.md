# Roadmap

> Completed work, remaining tasks, and priority matrix.
>
> Last updated: 2026-02-20

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
| **Collectible spawning** | WorldGenerator + ForestSceneSetup data-driven placement. Stick piles via InteractableObject (press E); bone/stone via auto-pickup Collectible. |
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
| **Pending events system** | Timer-based callback queue in GameplaySystem. Used for delayed secret item spawn after fire burst. |
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

## Phase 4 — Decompose God Object ✅

> **Goal:** Break `Game.ts` from ~1590 lines to ~450-line orchestrator. Highest impact on dev velocity — every future feature becomes cheaper.

| Step | Task | Status | Result |
|------|------|--------|--------|
| 4.1 | **Extract `InteractionSystem`** — proximity detection, prompt display, interaction dispatch | ✅ Done | `systems/InteractionSystem.ts` (~75 lines). Returns typed `InteractionTarget` for dispatch. |
| 4.2 | **Extract `RenderOrchestrator`** — tile/entity enqueuing, layer flushing, post-process, markers | ✅ Done | `rendering/RenderOrchestrator.ts` (~520 lines). Full pipeline with `RenderDeps` + `RenderFrameState` interfaces. |
| 4.3 | **Extract `ForestSceneSetup`** — entity spawning and world setup | ✅ Done | `scenes/ForestSceneSetup.ts` (~240 lines). Functions for player, campfire, dog NPC, collectibles, interactables. |
| 4.4 | **Extract `GameplaySystem`** — campfire interaction, collectible pickup, floating text, pending events | ✅ Done | `systems/GameplaySystem.ts` (~400 lines). Both update and draw methods. |
| 4.5 | **Move `PlayingState`** — inline class at bottom of `Game.ts` → `states/PlayingState.ts` | ✅ Done | `states/PlayingState.ts` (~15 lines). Delegates to `Game._update()` / `Game._render()`. |

All steps were pure refactors — zero behavior changes. TypeScript compilation (`tsc --noEmit`) and linting passed cleanly.

---

## Phase 5 — Input Provider Abstraction ✅

> **Goal:** Make input source-agnostic. Enables touch support and gamepad without changing any game logic.

| Step | Task | Status | Result |
|------|------|--------|--------|
| 5.1 | **Define `InputProvider` interface** | ✅ Done | `core/InputProvider.ts`. Methods: `isActionActive(action)`, `getMovementVector()`, `getPointerPosition()`, `dispose()`. |
| 5.2 | **Refactor `InputSystem` → `KeyboardInputProvider`** | ✅ Done | `systems/KeyboardInputProvider.ts`. Keyboard + mouse wheel + mouse position. AbortController cleanup. |
| 5.3 | **Refactor `InputManager` to accept `InputProvider[]`** | ✅ Done | OR aggregation for actions, highest-magnitude for movement, first-valid for pointer. `dispose()` method. |
| 5.4 | **Implement `TouchInputProvider`** | ✅ Done | `systems/TouchInputProvider.ts`. Virtual joystick (bottom-left, run zone), action buttons (E, bag, quest, close), pinch-to-zoom. |
| 5.5 | **Platform detection → provider selection** | ✅ Done | In `Game` constructor. Both providers active simultaneously on laptops with touchscreen. `isMobile()` block removed from `main.ts`. Old `InputSystem.ts` deleted. |

`Player.handleInput(inputManager)` unchanged. Desktop uses keyboard provider, touch devices use touch provider — transparent to all game code. CSS media queries hide keyboard-only hints on touch-only devices.

---

## Phase 5b — Touch UI/UX Polish ✅

> **Goal:** Make the touch experience feel native — fix bugs, add contextual controls, merge redundant UI, refine visual details.

| Step | Task | Status | Result |
|------|------|--------|--------|
| 5b.1 | **Fix touch overlay blocking DOM UI** | ✅ Done | Root overlay `pointerEvents: 'none'`, individual controls `pointerEvents: 'auto'`. Joystick listeners moved to `document`. |
| 5b.2 | **Fix multi-button touch release** | ✅ Done | Per-button `touchId` tracking — releasing one finger no longer releases all buttons. |
| 5b.3 | **Fix modal close on touch** | ✅ Done | `PAUSE` action cascades through Note → ItemPreview → Inventory → QuestLog → ControlsHelp. Added ✕ close buttons (visible on touch via CSS) to Dialog, Inventory, QuestLog. Tap-to-dismiss for ItemPreview and Note containers. |
| 5b.4 | **Contextual action button** | ✅ Done | Pill-shaped `🤚 {label}` button (bottom-right) — shown only when near an interactable. Auto-width, `max-width: 200px`, ellipsis overflow. Haptic feedback via `navigator.vibrate`. |
| 5b.5 | **Merge 🎒/📜 into HUD** | ✅ Done | Removed standalone bag/quest buttons from touch overlay. Integrated 🎒 and 📜 into `#inv-preview` as a single flex row. Items expand leftward. Event delegation in `Game.ts` distinguishes 🎒 (inventory) vs 📜 (quest log) clicks. `#inv-preview` always visible on touch (even when empty). |
| 5b.6 | **Remove menu/pause button** | ✅ Done | `≡` button removed from touch overlay — served no purpose. |
| 5b.7 | **Disable onboarding on touch** | ✅ Done | `gameplaySystem.onboardingHintActive = false` when `TouchInputProvider` is present. |
| 5b.8 | **Touch marker symbol** | ✅ Done | Markers show `🤚` (white via `ctx.filter = 'brightness(0) invert(1)'`) instead of `[E]` on touch. Badge size responsive to text via `ctx.measureText`. Badge always rendered above arrow. |
| 5b.9 | **Action button symbol** | ✅ Done | Action button prepends white `🤚` via `<span>` with `filter: brightness(0) invert(1)`. `gap: 8px` between symbol and label. |
| 5b.10 | **Suppress tap highlight** | ✅ Done | `-webkit-tap-highlight-color: transparent` on `#game-container` and all descendants. |
| 5b.11 | **Back-to-hub button fix** | ✅ Done | Bigger padding/font on touch, `z-index: 60`, excluded from joystick touch capture. |
| 5b.12 | **Platform-specific hints** | ✅ Done | `.keyboard-hint` / `.touch-hint` CSS classes with `@media (pointer: coarse)` query. All UI overlays show appropriate hint text per platform. |
| 5b.13 | **Mobile Safari safe-area support** | ✅ Done | `viewport-fit=cover` on meta tag, `100dvh` for `#game-container`, `env(safe-area-inset-bottom)` on joystick, action button, and dialog container. Prevents browser chrome from hiding controls. |
| 5b.14 | **Robust touch interaction (consumeAction)** | ✅ Done | Replaced polling + manual edge-detect with `consumeAction` pattern across `InputProvider`, `InputManager`, `KeyboardInputProvider` (`justPressed` set), `TouchInputProvider` (`pendingActions` set). `InteractionSystem` uses `consumeAction(Action.INTERACT)` — fixes first-tap misses and inconsistent behavior during simultaneous movement. |
| 5b.15 | **getBoundingClientRect hit-testing** | ✅ Done | Replaced `document.elementFromPoint()` with `getBoundingClientRect()` in `TouchInputProvider.handleButtonTouchStart()`. Skips hidden buttons (`width === 0`). Fixes unreliable hit detection on mobile Safari for newly-shown elements. |
| 5b.16 | **Pinch-zoom false-trigger guard** | ✅ Done | `hasTrackedTouch()` helper prevents two-finger pinch detection when one touch belongs to joystick or action button — fixes accidental zoom during simultaneous movement + interaction. |
| 5b.17 | **Joystick transparency** | ✅ Done | Reduced opacity of joystick base and thumb across idle and running states for less visual intrusion. |

---

## Phase 5c — Idle Zoom, Door, Loading Screen ✅

> **Goal:** Touch idle zoom, door prop + interaction + conditional light, loading screen redesign.

| Step | Task | Status | Result |
|------|------|--------|--------|
| 5c.1 | **Remove pinch-to-zoom on touch** | ✅ Done | Removed all pinch detection logic from `TouchInputProvider`. Eliminates accidental zoom during joystick use. Desktop mouse-wheel zoom unaffected. |
| 5c.2 | **Touch idle zoom** | ✅ Done | After `CAMERA_IDLE_DELAY` (1.5s) of no movement, camera smoothly zooms to `CAMERA_IDLE_ZOOM` (0.8×). HUD fades out (quest tracker, inventory preview). Joystick + doors link remain visible. Movement resumes standard zoom. `Camera.setTargetZoom()` + `zoomSmoothing` lerp. |
| 5c.3 | **Fix desktop zoom rubber-band** | ✅ Done | `Camera.adjustZoom()` now updates `targetZoom` alongside `zoom` to prevent smooth lerp pulling zoom back to idle value. |
| 5c.4 | **Add door prop** | ✅ Done | `obj_door` asset at `(1.1, 2.3)` in `WorldGenerator`. `depthBias: 50` + insertion order ensures it renders above house but below player. |
| 5c.5 | **Door + window lights** | ✅ Done | Pink point light above door (`DOOR_LIGHT_*` config). Second window light at `(2.7, 1.4)` (`WINDOW2_LIGHT_*` config). Both have flicker. |
| 5c.6 | **Door interactable** | ✅ Done | `InteractableObject` in `ForestSceneSetup`. Emits `dialog:request` → `Game.ts` listener pushes `DialogState`. Door dialog: "ЧТО ЗА ЧЕРТОВЩИНА?" with "[открыть]" choice → `door:reveal` event → "coming soon" overlay via `NoteUI`. |
| 5c.7 | **Conditional door access** | ✅ Done | Door `interactable` flag + door light only active after player has `pink_lighter` in inventory. Listens to `inventory:changed`. |
| 5c.8 | **dialog:request / dialog:open split** | ✅ Done | Fixed infinite recursion: interactables emit `dialog:request`, `Game.ts` handles it and pushes `DialogState`. `dialog:open` is notification-only (emitted by `DialogState.onEnter`). |
| 5c.9 | **NoteUI custom content** | ✅ Done | `NoteUI.show()` accepts optional `customHtml` parameter for arbitrary full-screen overlays. |
| 5c.10 | **Loading screen redesign** | ✅ Done | Black background, `Press Start 2P` pixel font, "Door 1." title + "Загрузка..." text centered. "(← Doors)" link uses pixel font, `z-index: 10000` to stay above loading overlay. Controls hint removed. |

---

## Next Up: Phase 6 — Dependency Injection

> **Goal:** Eliminate module-level singletons. Prerequisite for engine extraction and testability.

| Step | Task | Effort | Notes |
|------|------|--------|-------|
| 6.1 | **Create `ServiceContainer`** | 0.5 day | Typed registry for services: `eventBus`, `assetLoader`, `inventory`, `questTracker`, `gameFlags`, `entityManager`, `inputManager`, `camera`. |
| 6.2 | **Wire container in `Game`** | 0.5 day | `Game` creates container, passes to systems/entities. |
| 6.3 | **Migrate singleton imports** | 1 day | Replace all direct `import { inventory }`, `import { eventBus }`, etc. with container access. Largest mechanical change. |
| 6.4 | **Remove pre-built instances** | 0.25 day | Singleton files export class only, not instance. Container owns lifecycle. |

---

## Phase 7 — HTML/CSS Extraction + UI Component Base

> **Goal:** Get `index.html` (844 lines) under control. Composable UI system for engine reuse.

| Step | Task | Effort | Notes |
|------|------|--------|-------|
| 7.1 | **Extract CSS** | 0.5 day | Per-component CSS files (or `styles/` directory). Import via Vite. `index.html` drops to ~30 lines. |
| 7.2 | **Move DOM creation to TypeScript** | 1 day | UI classes fully own their DOM. `index.html` only has `<div id="game-container">` + `<script>`. |
| 7.3 | **Create `UIComponent` base class** (engine-level) | 0.5 day | Lifecycle: `create()`, `show()`, `hide()`, `dispose()`. Event binding/unbinding. DOM element reference. |
| 7.4 | **Refactor all UI classes to extend `UIComponent`** | 1 day | `DialogUI`, `InventoryUI`, `QuestLogUI`, `ItemPreviewUI`, `NoteUI`, `ControlsHelpUI`, `HUD`. |

---

## Phase 8 — Engine / Game Directory Split

> **Goal:** Clear boundary between reusable engine and game-specific code. Final structural reorganization before extraction.

Target structure:

```
src/
├── engine/                      # Reusable — becomes its own package in Phase 9
│   ├── core/                    # Game loop, ServiceContainer, Config base
│   ├── ecs/                     # Entity, Component, EntityManager, System interface
│   ├── input/                   # InputManager, InputProvider, KeyboardProvider, TouchProvider
│   ├── rendering/               # Renderer, Camera, PostProcess, IsometricUtils, effects/
│   ├── physics/                 # PhysicsSystem (generic tile-based collision)
│   ├── animation/               # AnimationSystem, AnimationController
│   ├── state/                   # GameStateManager, GameState base
│   ├── events/                  # EventBus (generic, typed)
│   ├── assets/                  # AssetLoader, AssetManifest
│   ├── ui/                      # UIComponent base, UIManager
│   └── scene/                   # Scene interface, SceneManager
│
├── game/                        # Game-specific
│   ├── entities/                # Player, NPC, Campfire, Collectible...
│   ├── systems/                 # InteractionSystem, GameplaySystem...
│   ├── scenes/                  # Scene definitions, world gen, entity spawning
│   ├── dialog/                  # DialogData, dialog trees
│   ├── quests/                  # QuestDef, QuestTracker
│   ├── items/                   # ItemDef, Inventory
│   ├── ui/                      # DialogUI, InventoryUI, QuestLogUI...
│   └── config/                  # Game constants, LightingProfiles
│
└── main.ts                      # Bootstrap: create engine, load game scene
```

| Step | Task | Effort | Notes |
|------|------|--------|-------|
| 8.1 | **Create directory structure** | 0.25 day | `engine/` and `game/` directories. |
| 8.2 | **Move engine systems** | 1 day | Systems with zero game-specific imports → `engine/`. |
| 8.3 | **Define `Scene` interface** | 0.5 day | `load(container): Promise<void>`, `update(dt)`, `render(dt)`, `dispose()`. |
| 8.4 | **Create `SceneManager`** | 0.5 day | Scene lifecycle, transitions between scenes. |
| 8.5 | **Convert current game to `ForestScene`** | 1 day | Implements `Scene`, wires game-specific systems. |
| 8.6 | **Move game code to `game/`** | 0.5 day | Fix all imports. Validate identical behavior. |

---

## Phase 9 — Engine Extraction to Separate Package

> **Goal:** Engine becomes a standalone repo/package. Clone it to start new games.

| Step | Task | Effort | Notes |
|------|------|--------|-------|
| 9.1 | **Convert to monorepo** | 0.5 day | `packages/engine/` + `packages/perun-game/`. Vite workspace config. |
| 9.2 | **Engine `package.json` + public API** | 0.5 day | Exports: `Game`, `Scene`, `InputManager`, `InputProvider`, `Entity`, `Component`, `Renderer`, `Camera`, `EventBus`, `ServiceContainer`, `UIComponent`, etc. |
| 9.3 | **Game imports engine** | 0.5 day | `import { Game, Scene, InputManager } from '@perun/engine'` |
| 9.4 | **"New game" template + docs** | 0.5 day | Minimal setup: clone, create scene, run. Document public API surface. |

---

## Phase 10 — Content & Polish

> Previously Phase 4. Content work that benefits from the architectural foundation.

| Task | Effort | Notes |
|------|--------|-------|
| **Data-driven maps** — JSON map files with tile grid + object placements + NPC spawns + trigger zones + collectibles | 2 days | Replace WorldGenerator.ts hardcoded positions. Leverages `SceneBuilder` from Phase 4.3. |
| **Scene/Map transitions** — load different maps, preserve player state + inventory + quest progress | 1 day | Uses `SceneManager` from Phase 8.4. |
| **Generalize volumetric rendering** — move per-entity shadow/volumetric config into a component | 2 days | NPC lighting parity for any entity. |
| **Save/Load** — serialize ServiceContainer state to localStorage | 1 day | Cleaner with DI from Phase 6 — serialize container services. |
| **More quest content** — additional quest chains, branching outcomes, rewards | 2 days | Validate full quest loop end-to-end. |
| **Item use/combine** — use items from inventory, combine items for crafting | 1.5 days | Extends item system. |
| **Objective markers** — HUD indicators pointing toward active quest objectives | 0.5 day | Reuse interactable marker pattern. |

## Phase 11: Systems & Performance

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
| **P1** | **Phase 4: Decompose God Object** | 3.25 days | ✅ Done |
| P1 | Extract InteractionSystem | 0.5 day | ✅ Done |
| P1 | Extract RenderOrchestrator | 1 day | ✅ Done |
| P1 | Extract ForestSceneSetup | 0.5 day | ✅ Done |
| P1 | Extract GameplaySystem | 1 day | ✅ Done |
| P1 | Move PlayingState to own file | 0.25 day | ✅ Done |
| **P1** | **Phase 5: Input Provider Abstraction** | 3 days | ✅ Done |
| P1 | Define InputProvider interface | 0.25 day | ✅ Done |
| P1 | Refactor InputSystem → KeyboardInputProvider | 0.5 day | ✅ Done |
| P1 | Refactor InputManager for InputProvider[] | 0.5 day | ✅ Done |
| P1 | Implement TouchInputProvider | 1.5 days | ✅ Done |
| P1 | Platform detection → provider selection | 0.25 day | ✅ Done |
| **P1** | **Phase 5b: Touch UI/UX Polish** | 2 days | ✅ Done |
| P1 | Fix overlay blocking + multi-touch release | — | ✅ Done |
| P1 | Modal close on touch (✕ buttons, tap-to-dismiss) | — | ✅ Done |
| P1 | Contextual action button (🤚 + label) | — | ✅ Done |
| P1 | Merge 🎒/📜 into HUD | — | ✅ Done |
| P1 | Touch marker symbol + white color | — | ✅ Done |
| P1 | Platform-specific hints + suppress tap highlight | — | ✅ Done |
| P1 | Remove menu button + disable onboarding on touch | — | ✅ Done |
| P1 | Back-to-hub button fix | — | ✅ Done |
| **P1** | **Phase 6: Dependency Injection** | 2.25 days | — |
| P1 | Create ServiceContainer | 0.5 day | — |
| P1 | Wire container in Game | 0.5 day | — |
| P1 | Migrate singleton imports | 1 day | — |
| P1 | Remove pre-built singleton instances | 0.25 day | — |
| **P2** | **Phase 7: HTML/CSS Extraction + UI Base** | 3 days | — |
| P2 | Extract CSS from index.html | 0.5 day | — |
| P2 | Move DOM creation to TypeScript | 1 day | — |
| P2 | Create UIComponent base class | 0.5 day | — |
| P2 | Refactor UI classes to extend UIComponent | 1 day | — |
| **P2** | **Phase 8: Engine/Game Directory Split** | 3.75 days | — |
| P2 | Define Scene interface | 0.5 day | — |
| P2 | Create SceneManager | 0.5 day | — |
| P2 | Move engine systems to engine/ | 1 day | — |
| P2 | Convert game to ForestScene | 1 day | — |
| P2 | Move game code to game/ | 0.5 day | — |
| **P2** | **Phase 9: Engine Extraction** | 2 days | — |
| P2 | Convert to monorepo | 0.5 day | — |
| P2 | Engine package.json + public API | 0.5 day | — |
| P2 | Game imports engine package | 0.5 day | — |
| P2 | New game template + docs | 0.5 day | — |
| **P2** | Data-driven maps (JSON) | 2 days | — |
| **P2** | Scene/Map transitions | 1 day | — |
| **P2** | Generalize volumetric rendering | 2 days | — |
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
| core/Game.ts | ~554 | **Phase 4 + 5b + 5c.** Thin orchestrator: loop, system wiring, input toggles, day/night profile transitions. Stores `TouchInputProvider` reference for contextual action button. Idle zoom management (`updateIdleZoom`). Handles `dialog:request` and `door:reveal` events. Delegates update to InteractionSystem + GameplaySystem, render to RenderOrchestrator. Event delegation on `#inv-preview` for 🎒/📜 clicks. |
| systems/InteractionSystem.ts | ~77 | **Phase 4 + 5b.** Proximity detection, interact dispatch via `consumeAction(Action.INTERACT)`. Returns typed `InteractionTarget`. Exposes `nearestInteractLabel` for contextual action button. |
| systems/GameplaySystem.ts | ~400 | **New (Phase 4).** Collectibles, campfire interaction, floating text, pending events, trigger zones, onboarding. Draw methods for sparks, zzz, hint. |
| rendering/RenderOrchestrator.ts | ~551 | **Phase 4 + 5b.** Full render pipeline: enqueue, flush, post-process lights/occluders/volumetric, two-pass interaction markers. Touch-aware marker rendering: 🤚 emoji (white via canvas filter) with responsive badge sizing via `measureText`. |
| scenes/ForestSceneSetup.ts | ~259 | **Phase 4 + 5c.** Entity spawning functions for forest scene (player, campfire, dog, collectibles, interactables, door). `createDoorInteractable()` conditionally enabled via `inventory:changed`. |
| states/PlayingState.ts | ~15 | **New (Phase 4).** Default game state delegating to Game._update/_render. |
| core/GameState.ts | ~108 | State stack with transparent/blocking flags |
| core/EntityManager.ts | ~71 | Central registry with spatial queries |
| core/EventBus.ts | ~78 | Fully typed. Quest, inventory, collectible events active. |
| core/InputProvider.ts | ~20 | **New (Phase 5).** Interface: `isActionActive`, `consumeAction`, `getMovementVector`, `getPointerPosition`, `dispose`. |
| core/InputManager.ts | ~100 | **Refactored (Phase 5 + 5b).** Aggregates `InputProvider[]` — OR for actions, highest-magnitude for movement, first-valid for pointer. `consumeAction()` iterates all providers. Bindings moved to `KeyboardInputProvider`. |
| systems/KeyboardInputProvider.ts | ~100 | **New (Phase 5 + 5b).** Desktop keyboard + mouse wheel + mouse position. `justPressed` set for `consumeAction`. Replaces old `InputSystem.ts`. AbortController for cleanup. |
| systems/TouchInputProvider.ts | ~350 | **Phase 5 + 5b + 5c.** Virtual joystick (bottom-left, semi-transparent, run zone at 60%), contextual action button (pill-shaped 🤚 + label, bottom-right). No pinch-to-zoom (removed in 5c). Per-button `touchId` tracking. `pendingActions` set for `consumeAction`. `getBoundingClientRect` hit-testing. `env(safe-area-inset-bottom)` positioning. Overlay `pointerEvents: none` with `auto` on controls only. Haptic feedback. `setInteractVisible()` for dynamic action button. |
| core/Config.ts | ~212 | **Phase 5c.** All constants centralized. Campfire + dog params, NPC onboard radius, dog spawn delay. `CAMERA_IDLE_ZOOM`, `CAMERA_IDLE_DELAY`. `DOOR_LIGHT_*` + `WINDOW2_LIGHT_*` configs. |
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
| dialog/DialogData.ts | ~179 | **Phase 5c.** Data model + registry + quest-integrated dog dialog + door dialog (`door_mystery`). Door dialog emits `door:reveal` on choice. All dialog text in Russian. |
| states/DialogState.ts | ~107 | Transparent, blocks update. Filters choices by condition. |
| states/InventoryState.ts | ~29 | Transparent overlay for inventory |
| states/QuestLogState.ts | ~29 | Transparent overlay for quest log |
| states/ItemPreviewState.ts | ~43 | Transparent overlay for item discovery dialog |
| ui/DialogUI.ts | ~141 | **Phase 5b.** Arrow/Enter/ESC navigation, mouse, hints. ✕ close button (visible on touch). Platform-specific hint text (keyboard-hint / touch-hint). |
| ui/ControlsHelpUI.ts | ~53 | HTML overlay listing all controls by category. Toggle with H key. All text in Russian. |
| ui/HUD.ts | ~230 | **Phase 5b + 5c.** Debug panels (toggleable with U), quest HUD tracker (toggleable with Q). `updateInvPreview()` renders 🎒 + 📜 buttons inline with item slots as a flex row on touch. Always visible on touch (even when empty). `setIdleMode()` fades quest HUD + inventory preview during touch idle zoom. |
| ui/InventoryUI.ts | ~228 | **Phase 5b.** HTML overlay: item icons with glow gradients, names, counts. Keyboard navigation (↑/↓/W/S), inspect action (Enter/Space). ✕ close button, tap-on-slot for touch. Labels in Russian. |
| ui/QuestLogUI.ts | ~120 | **Phase 5b.** HTML overlay: active/completed quests + objectives. ✕ close button for touch. Labels in Russian. |
| ui/ItemPreviewUI.ts | ~115 | **Phase 5b.** HTML overlay: item preview with 120×120 canvas, radial glow gradient, optional header. Tap-to-dismiss on touch. Labels in Russian. |
| ui/NoteUI.ts | ~90 | **Phase 5b + 5c.** Parchment overlay with optional custom HTML content. Tap-to-dismiss on touch. Reusable. Used for wall note and door "coming soon" overlay. |
| systems/PhysicsSystem.ts | ~92 | Entity-vs-entity collision, overlap escape |
| systems/AnimationSystem.ts | ~20 | Null-checks optional animController |
| ~~systems/InputSystem.ts~~ | — | **Deleted (Phase 5).** Replaced by `KeyboardInputProvider`. |
| rendering/Renderer.ts | ~373 | Z-sort with depthBias, rotation, dynamic bg color, profile-driven effects dispatch |
| rendering/PostProcessPipeline.ts | ~750 | Lighting, shadows, iso projection, volumetric |
| rendering/LightingProfile.ts | ~188 | Day/night presets + fog/vignette/snow profiles, lerpProfile() |
| rendering/effects/FireLightEffect.ts | ~143 | Breath + wobble + crackle flicker |
| rendering/effects/SnowfallEffect.ts | ~179 | Extracted from Renderer, profile-driven opacity |
| rendering/effects/FogEffect.ts | ~329 | Decoupled vignette + animated wisps, profile-driven color/opacity/blend |
| rendering/Camera.ts | ~80 | **Phase 5c.** `targetZoom` + `zoomSmoothing` lerp for smooth zoom transitions. `setTargetZoom()` API for idle zoom. `adjustZoom()` syncs both `zoom` and `targetZoom`. |
| rendering/IsometricUtils.ts | ~30 | Unchanged |
| world/TileMap.ts | ~117 | WorldObject with rotation, groundLayer, shadowHeight, depthBias, removeObjectById |
| world/WorldGenerator.ts | ~125 | **Phase 5c.** Campfire, sticks, trees, house, barrel, wall note, door. Hardcoded positions. depthBias for wall decorations and door. |
| assets/ProceduralAssets.ts | ~890 | Campfire anim + item icons + world sprites (stick, bone, stone, ancient_ember, lighter) + interact_marker + note_paper sprites |
| main.ts | ~43 | **Updated (Phase 5).** Removed `isMobile()` block and mobile warning. Boot sequence only: procedural assets → manifest → world → Game. Platform detection moved to `Game` constructor. |
| index.html | ~965 | **Phase 5b + 5c + 7 target.** Dialog, inventory, quest log, item preview, note parchment, controls help overlays. `lang="ru"`, all labels in Russian. Touch-specific CSS: `keyboard-hint`/`touch-hint` classes, `overlay-close` ✕ buttons, `#inv-preview` flex layout with 🎒/📜, `-webkit-tap-highlight-color: transparent`, `#back-to-hub` touch sizing. Loading screen: black background, `Press Start 2P` pixel font, "Door 1." title + "Загрузка..." text. **Planned:** Extract CSS to separate files, move all DOM creation to TypeScript. Target: ~30 lines. |
