# Rendering

> Render pipeline, lighting & shadow system, day/night profiles, fire effects, fog, snowfall, post-processing, shader tuning.

---

## Pipeline Overview

Each frame renders in this order:

```
Canvas 2D (Renderer.ts)              WebGL2 overlay (PostProcessPipeline.ts)
┌────────────────────────────┐       ┌──────────────────────────────────────┐
│ 1. Clear background        │       │ Upload Canvas as GL texture          │
│    (color from profile)    │       │ Fragment shader per pixel:           │
│ 2. Ground tiles (Z-sorted) │       │   • Ambient light (from profile)    │
│ 3. Ground-layer objects    │  ──►  │   • Point lights (iso-elliptical)   │
│ 4. Back boundary fog       │       │   • Occluder soft shadows            │
│ 5. Back animated wisps     │       │   • Shadow opacity scaling           │
│ 6. Blob shadows            │       │   • Player height fade               │
│ 7. Campfire sparks         │       │   • Volumetric sprite shading        │
│ 8. Object layer (Z-sorted) │       │     (ambient + direct separated)    │
│ 9. Front boundary fog      │       └──────────────────────────────────────┘
│ 10. Front animated wisps   │                       │
│ 11. Floating text          │       ┌──────────────────────────────────────┐
│ 12. Snowfall particles     │       │ DOM overlays                         │
│ 13. Debug overlay (opt.)   │       │   • Dialog UI                        │
└────────────────────────────┘       │   • Interact markers (canvas arrows)  │
                                     │   • Interaction prompt               │
                                     │   • Inventory overlay (I)            │
                                     │   • Quest log overlay (J)            │
                                     │   • Quest HUD (top-right, Q toggle)  │
│   • Item preview overlay             │
│   • Note parchment overlay (E)       │
│   • Controls help overlay (H)        │
                                     │   • Debug panels (U toggle)          │
                                     └──────────────────────────────────────┘
```

### Render Layers

| Step | What | File | Notes |
|------|------|------|-------|
| 1 | Clear | `Renderer.ts` | Background color from active `LightingProfile` |
| 2 | Ground tiles | `Renderer.ts` | Enqueued to ground layer, flushed with Z-sort |
| 3 | Ground-layer objects | `Renderer.ts` | Objects with `groundLayer: true` (e.g., `obj_campfire`), always below player |
| 4–5 | Back fog | `FogEffect.ts` | Radial vignette + edge gradients + wisps, dimmed by `BOUNDARY_FOG_BACK_MULT` |
| 6 | Blob shadows | `RenderOrchestrator.ts` | Soft ellipses under entities that have `blobShadow` configured |
| 7 | Campfire sparks | `GameplaySystem.ts` | Particle system, drawn before object layer so player covers them. Alpha scaled by `fireOpacity`. |
| 8 | Object layer | `Renderer.ts` | Static objects + entities, depth-sorted by `(col+row)`. Supports rotation. |
| 9–10 | Front fog | `FogEffect.ts` | Bottom/right edges, rendered over objects |
| 11 | Floating text | `GameplaySystem.ts` | "+1" / item name particles. World-to-screen projection, rise + fade animation. |
| 12 | Snowfall | `SnowfallEffect.ts` | 3D-projected particles with parallax depth. Gated by snow toggle. |
| 13 | Debug grid | `RenderOrchestrator.ts` | Optional, hold `G` |
| 14 | Post-process | `PostProcessPipeline.ts` | WebGL2 full-screen quad with lighting shader |
| 15 | Markers | `RenderOrchestrator.ts` | Interaction markers on a separate canvas layer (above post-process, below DOM). Two-pass depth-aware rendering with player silhouette occlusion. Platform-aware badge: `[E]` on desktop, `🤚` emoji (white via canvas filter) on touch. Badge size responsive to text via `measureText`. Badge positioned above arrow with consistent gap. |
| 16 | DOM overlays | `DialogUI.ts` / `InventoryUI.ts` / `ItemPreviewUI.ts` / `ControlsHelpUI.ts` | HTML elements above both canvases (dialog, inventory, quest log, item preview, HUD, controls help, debug panels). HUD/debug panels use semi-transparent dark backgrounds for readability in both day and night modes. Touch overlays include ✕ close buttons and tap-to-dismiss behavior. |
| 17 | Touch overlay | `TouchInputProvider.ts` | DOM layer for semi-transparent virtual joystick (bottom-left) and contextual action button (bottom-right). Safe-area-aware positioning via `env(safe-area-inset-bottom)`. Root overlay `pointerEvents: none` with `auto` on controls. `getBoundingClientRect` hit-testing. Above DOM UI (`z-index: 50`). |

### Z-Sorting

Entities and objects share a single depth-sorted render queue. Sort key: `depthOf(col, row, z)` which computes `(col + row) * TILE_HEIGHT + z`. The painter's algorithm draws back-to-front so closer objects naturally occlude farther ones.

Ground-layer objects (`groundLayer: true`) use a depth bias based on their visual bottom edge to sort after all tiles they overlap.

Objects can specify a `depthBias` (number) to manually offset their sort depth. Negative values push the object earlier in the draw order (behind nearby entities). Used for wall decorations like the paper note (`depthBias: -100`) to ensure the player always renders in front regardless of approach angle.

### Object Rotation

Objects with a `rotation` value (radians) are rendered using `ctx.translate/rotate` centered on the draw rectangle.

### Entity Opacity

Entities with `opacity < 1` are rendered with `ctx.globalAlpha` set accordingly. Used for NPC fade-in and campfire day/night transitions.

---

## Lighting & Shadow System

A **WebGL2 post-processing pass** layered on top of the Canvas 2D output. The 2D canvas is uploaded as a texture every frame. A fragment shader multiplies each pixel by computed light contribution. Toggle with `L`.

### Light Model (Separated Ambient + Direct)

The shader separates light into **ambient** (non-directional) and **direct** (point-light) accumulators. This is critical: volumetric diffuse shading only modulates the directional component, preventing unrealistic darkening in high-ambient conditions (day mode).

```
for each pixel (fragPos):
    ambient = ambientColor              ← non-directional, never affected by diffuse
    direct  = vec3(0.0)                 ← directional accumulator

    for each point light i:
        // Isometric elliptical distance
        delta.y *= isoRatio             ← squash Y for ground-plane projection
        attenuation = 1 − (dist / radius)²
        flicker = noise-based modulation

        shadow = 1.0
        for each occluder j:
            maxReach = occHeight[j] × shadowLenMult
            shadow = min(shadow, shadowFactor(...))

        // Height fade (player head above shadow)
        shadow = mix(shadow, 1.0, hfMask × hy × strength × frontFac)

        // Shadow opacity (profile-controlled)
        shadow = mix(1.0, shadow, shadowOpacity)

        direct += color × intensity × attenuation × flicker × shadow

    // Volumetric sprite shading (player only)
    if volumetric active:
        direct *= mix(1.0, halfLambertDiffuse, volDiffuse)    ← only direct!
        direct += rimColor × rim

    finalColor = sceneColor × clamp(ambient + direct, 0, 1.2)
```

### Isometric Light Projection

Light distance calculations use an elliptical metric to match the isometric ground plane:

```glsl
vec2 delta = fragPos - u_lightPos[i];
delta.y *= u_isoRatio;           // TILE_WIDTH / TILE_HEIGHT ≈ 2.0
float dist = length(delta);
```

This makes light pools appear elliptical (wider horizontally, compressed vertically) — matching how a circular light source would project onto an isometric surface.

### Current Lights

| Light | Position | Color | Behavior | Profile-gated |
|-------|----------|-------|----------|---------------|
| **Sky light** | World offset from map center (profile-driven) | Night: cool blue / Day: neutral white | No flicker | Always on (position/color from profile) |
| **Window light** | Grid `(1.0, 2.8)` elevated `46px` | Warm orange (1.0, 0.65, 0.25) | Candle-like flicker | Yes — `pointLightOpacity` |
| **Window light 2** | Grid `(2.7, 1.4)` elevated `46px` | Warm orange (1.0, 0.65, 0.25) | Candle-like flicker | Yes — `pointLightOpacity` |
| **Door light** | Grid `(1.1, 2.3)` elevated `60px` | Pink (1.0, 0.3, 0.6) | Candle-like flicker | Yes — `pointLightOpacity` + requires `pink_lighter` in inventory |
| **Campfire light** | Grid `(2.5, 4.4)` elevated `25px` | Orange-yellow, modulated by `FireLightEffect` | Breath + wobble + crackle. Radius and intensity scale with `Campfire.lightMult` (varies by fed state + burst envelope). | Yes — `fireOpacity` |

Limits: up to **16 point lights** and **32 occluders** per frame (GLSL array sizes).

---

## Day/Night System (Lighting Profiles)

`src/rendering/LightingProfile.ts` defines a `LightingProfile` interface capturing all tunable scene parameters. Two presets are defined:

### Profile Parameters

| Parameter | Night | Day | Description |
|-----------|-------|-----|-------------|
| `ambientR/G/B` | 0.18/0.22/0.38 | 0.95/0.95/0.95 | Base scene illumination |
| `bgR/G/B` | 0.024/0.024/0.07 | 0.72/0.84/0.96 | Canvas background color |
| `skyLightOffsetX/Y` | -2000/300 | -800/-1200 | Sun/moon world position offset |
| `skyLightRadius` | 3500 | 5000 | Sky light reach |
| `skyLightR/G/B` | 0.75/0.8/1.0 | 1.0/1.0/0.98 | Sky light color |
| `skyLightIntensity` | 0.55 | 0.35 | Sky light brightness |
| `shadowLengthMult` | 2.0 | 0.4 | Shadow reach = height × mult |
| `shadowOpacity` | 1.0 | 0.25 | Shadow darkness (0=none, 1=full) |
| `pointLightOpacity` | 1.0 | 0.0 | Window light intensity multiplier |
| `fireOpacity` | 1.0 | 0.0 | Campfire flame/spark/light opacity |
| `volRimR/G/B` | 0.6/0.75/1.0 | 0.95/0.95/1.0 | Volumetric rim light color |
| `snowOpacity` | 1.0 | 0.1 | Snow particle intensity (0=invisible, 1=full) |
| `vignetteOpacity` | 1.0 | 0.7 | Boundary vignette darkness |
| `vignetteR/G/B` | 0.024/0.024/0.07 | 0.278/0.373/0.518 | Vignette color (night=dark navy, day=blue-grey) |
| `fogWispOpacity` | 1.0 | 0.85 | Animated fog wisp intensity |
| `fogWispR/G/B` | 0.024/0.024/0.07 | 0.851/0.851/0.851 | Fog wisp color (night=dark, day=light grey) |
| `fogWispAdditive` | true | false | Wisp blend mode (true=`lighter` glow, false=`source-over` fog) |

### Transition System

Toggling with `T` triggers a **1.5-second ease-in-out transition** using `lerpProfile()`:

```typescript
// Ease-in-out quadratic
const ease = t < 0.5
  ? 2 * t * t
  : 1 - Math.pow(-2 * t + 2, 2) / 2;
activeProfile = lerpProfile(fromProfile, targetProfile, ease);
```

All float parameters interpolate smoothly. `fireOpacity` and `pointLightOpacity` are floats (not booleans) so fire/lights fade gradually instead of snapping. The same applies to `snowOpacity`, `vignetteOpacity`, `fogWispOpacity`, and all color channels — vignette and fog wisps transition color and intensity between day and night.

### Integration

Each frame, `applyLightingProfile()` pushes the active profile into:
- `Renderer.setBackgroundColor()` — canvas background
- `Renderer.applyEffectProfile()` — vignette, fog wisps, and snow opacity/color
- `PostProcessPipeline.setAmbient()` — shader ambient
- `PostProcessPipeline.setShadowLengthMult()` / `setShadowOpacity()` — shadow parameters
- `Campfire.opacity` — entity visibility
- Point light `intensity` multiplied by `pointLightOpacity`
- Campfire light `intensity` multiplied by `fireOpacity`
- Spark alpha multiplied by `fireOpacity`
- Volumetric rim color from profile

---

## Fire Light Effect

`src/rendering/effects/FireLightEffect.ts` — procedural fire flicker using three layered noise components:

| Component | Frequency | Amplitude | Character |
|-----------|-----------|-----------|-----------|
| **Breath** | ~0.4 Hz | ±12% | Slow sinusoidal surge — overall brightness pulse |
| **Wobble** | ~1.8 Hz | ±8% | Medium irregular oscillation (two offset sine waves) |
| **Crackle** | ~12 Hz | ±10% | Fast sample-and-hold random jitter — sparking effect |

Output per frame: `intensity` (0.5–1.5), `radius` (follows intensity at reduced amplitude), `r`/`g`/`b` (color shifts: dim = redder, bright = yellower).

### Configuration

```typescript
new FireLightEffect({
  baseR: 1.0, baseG: 0.55, baseB: 0.12,
  breathFreq: 0.4, breathAmp: 0.12,
  wobbleFreq: 1.8, wobbleAmp: 0.08,
  crackleRate: 12, crackleAmp: 0.10,
  radiusFollow: 0.5,
  colorShift: 0.3,
});
```

The effect runs during the render pass in `RenderOrchestrator.setupLights()`. Output values are used to modulate the campfire's `addLight()` call.

---

## Shadow Algorithm

The `shadowFactor()` function tests how much light reaches a pixel through a circular occluder:

1. **Segment projection** — project occluder center onto the frag→light line segment, find closest point (clamped)
2. **Perpendicular penumbra** — `smoothstep(r × 0.3, r × 2.0, perpDist)` for soft edges
3. **Endpoint fade** — `smoothstep` over distance `r` around each endpoint prevents hard-edge artifacts
4. **Height-proportional reach** — `maxReach = height × SHADOW_LENGTH_MULT`, so tall objects cast long shadows
5. **Multi-occluder combination** — shadows combine with `min()` (not multiply) to avoid unnaturally dark overlap
6. **Shadow opacity** — `shadow = mix(1.0, shadow, u_shadowOpacity)` — profile-controlled darkness

#### Complex Shadow Shapes

Simple objects (trees, stones) use a single `shadowRadius`. Complex objects (houses) define `shadowPoints` — overlapping circles that approximate the silhouette:

```typescript
shadowPoints: [
  { dx: -0.4, dy: -0.4, radius: 40 },
  { dx:  0.0, dy: -0.4, radius: 40 },
  { dx:  0.4, dy: -0.4, radius: 40 },
  // ... 3×3 grid covers rectangular footprint
]
```

Each `dx/dy` is in grid-coordinate offsets from the object's `(col, row)`.

#### Player as Shadow Caster

The player is registered as a circular occluder at their visual feet. `PLAYER_FOOT_OFFSET` shifts the occluder up from the sprite bottom to align with where the character actually stands.

### Player Height Fade

Simulates 3D shadow behavior: feet receive full shadow, head has reduced shadow. Prevents the flat look of uniform top-to-bottom darkening.

- **Sprite-alpha masking** — uses the actual sprite alpha channel for precise containment (no rectangular fallback for `spriteAlphaOnly` zones)
- **Vertical bell curve** — starts at zero at feet, peaks in upper body, fades above head
- **Front-facing check** — `frontFac` based on isometric light direction prevents back-light from affecting shadow fade

```glsl
float hx = spriteAlpha(srcUV);  // precise mask
float hy = smoothstep(0.0, height, dy)
         * (1.0 - smoothstep(height * 0.8, height * 0.9, dy));
shadow = mix(shadow, 1.0, hx * hy * strength * frontFac);
```

### Coordinate Handling

All lighting operates in **screen-space pixels**:

1. `isoToScreen(col, row)` → world pixel position
2. `camera.worldToScreen(wx, wy)` → screen pixel position (pan + zoom)
3. **Y-flip for WebGL**: `gl_y = canvasHeight - screen_y` (top=0 → bottom=0)

### Integration in Game Loop

```
_render(dt):
    applyLightingProfile()         // ambient, bg, shadows from active profile
    ... 2D rendering (tiles, fog, objects, entities, snow) ...

    if postProcess.enabled:
        clearLights / clearOccluders / clearHeightFade
        addLight(skyLight)         // position + color from profile
        if pointLightOpacity > 0:
            addLight(windowLight)      // intensity × pointLightOpacity
            addLight(windowLight2)     // second window
            if inventory.has('pink_lighter'):
                addLight(doorLight)    // pink, conditional
        if fireOpacity > 0:
            addLight(campfireLight) // intensity × fireOpacity × flicker
        for each world object → addOccluder(position, radius, height)
        addOccluder(player feet, radius, height)
        setHeightFade(footX, footY, width, height, strength)
        postProcess.render(dt)     // upload texture + full-screen quad
```

---

## Volumetric Sprite Shading

Gives the player a 3D cylindrical look with directional lighting and rim highlights.

**Key design**: Volumetric diffuse only multiplies the **directional** (point-light) accumulator, not the ambient. This prevents the player from going unrealistically dark when ambient is high (day mode).

| Parameter | Config Key | Default | Description |
|-----------|-----------|---------|-------------|
| Diffuse strength | `VOLUMETRIC_DIFFUSE` | 0.8 | 0 = flat, 1 = full cylinder shading |
| Rim strength | `VOLUMETRIC_RIM` | 0.4 | 0 = none, 1 = bright rim |
| Rim color | Profile `volRimR/G/B` | Night: cool blue, Day: neutral | Adjusts with day/night |

---

## Boundary Fog

Two independent visual layers hide the hard diamond boundary and add atmospheric depth. Both live in `src/rendering/effects/FogEffect.ts` but have separate profile-driven color, opacity, and blend mode.

### 1. Boundary Vignette (Static Framing)

Static radial darkening + edge gradients that frame the map.

- **Radial vignette** — large elliptical gradient centered on the map
- **Edge gradients** — linear gradient strips along each isometric diamond edge
- Drawn in **two passes**: back (top/left, behind objects) and front (bottom/right, over objects)
- `BOUNDARY_FOG_PADDING` shifts fog inward (positive) or outward (negative) from edges
- `BOUNDARY_FOG_BACK_MULT` reduces back-edge opacity to prevent over-darkening

**Profile-driven**: Color and opacity are set per frame from the active `LightingProfile`:
- Night: dark navy (`vignetteR/G/B` = 0.024/0.024/0.07), full opacity
- Day: blue-grey (#475F84), reduced opacity (0.7) for a softer frame

### 2. Animated Fog Wisps (Weather)

Drifting blob wisps along map edges for atmospheric fog.

- `FOG_WISPS_PER_EDGE` wisps per edge, evenly distributed
- Per-wisp animation: lateral **drift**, inward **oscillation**, opacity **breathing** — deterministic `sin` with golden-ratio phase seeding
- Stretched ellipses oriented along edge tangent
- Same back/front split as vignette, dimmed by `BOUNDARY_FOG_BACK_MULT`

**Profile-driven**: Color, opacity, and blend mode are set per frame:
- Night: dark wisps with `globalCompositeOperation = 'lighter'` for additive glow on dark background
- Day: light grey wisps (#D9D9D9) with `globalCompositeOperation = 'source-over'` for normal fog patches (no white blowout on bright sky)

### Decoupled Design

Vignette and fog wisps are fully independent. Each receives its own color/opacity from the profile every frame via `applyVignetteProfile()` and `applyWispProfile()`. This means:
- Night: dark vignette framing + glowing wisps
- Day: soft blue-grey framing + white fog patches
- Transition: both layers smoothly crossfade color and intensity

---

## Snowfall

`src/rendering/effects/SnowfallEffect.ts` — particle system projected into 3D isometric space.

- Particles have world `(col, row, height)` positions projected through the isometric pipeline
- `SNOW_DEPTH_LAYERS` parallax layers for depth
- Horizontal sine-wobble (`SNOW_WOBBLE_SPEED/AMP`) and wind drift (`SNOW_WIND_SPEED`)
- Particles wrap when falling below ground or drifting off-screen
- Toggled with `N` key (edge-triggered)

**Profile-driven opacity**: The `snowOpacity` parameter from the active `LightingProfile` multiplies all snowflake alpha values. Night = full intensity (1.0), Day = subtle (0.1). This prevents heavy snowfall from looking wrong against a bright daytime sky while keeping a gentle dusting effect.

---

## Blob Shadows

Soft elliptical contact shadows drawn on the ground layer beneath each entity that has `blobShadow` configured.

| Parameter | Description |
|-----------|-------------|
| `rx` | Horizontal radius (world pixels) |
| `ry` | Vertical radius (squashed for isometric) |
| `opacity` | Shadow darkness (0–1) |

Rendered by `RenderOrchestrator` before the object layer flush. The player, dog NPC, and campfire have blob shadows configured.

---

## Shader Tuning Guide

| Parameter | File | What it controls |
|-----------|------|------------------|
| `r × 0.3, r × 2.0` in `shadowFactor` | `PostProcessPipeline.ts` | Penumbra softness (inner/outer edge) |
| `smoothstep(-r, r×0.3, t)` | `PostProcessPipeline.ts` | Shadow endpoint fade distance |
| `u_hfWidth × 0.1 / 0.85` | `PostProcessPipeline.ts` | Height-fade horizontal containment |
| `u_hfHeight × 0.4 / 0.85 / 1.05` | `PostProcessPipeline.ts` | Height-fade vertical bell shape |
| `1 − d²/r²` falloff formula | `PostProcessPipeline.ts` | Light falloff curve (quadratic) |
| `maxReach × 0.5, maxReach` | `PostProcessPipeline.ts` | Shadow length fade (start/end of reach) |
| `u_isoRatio` | `PostProcessPipeline.ts` | Elliptical light projection (TILE_WIDTH / TILE_HEIGHT) |
| `u_shadowOpacity` | `PostProcessPipeline.ts` | Profile-controlled shadow darkness |

---

## Lighting Configuration Reference

Static constants in `Config.ts` (used as defaults / initial values):

| Constant | Default | Description |
|----------|---------|-------------|
| `LIGHTING_ENABLED` | `true` | Enable lighting on start |
| `LIGHT_AMBIENT_R/G/B` | 0.18 / 0.22 / 0.38 | Initial ambient (overridden by profile) |
| `SKY_LIGHT_OFFSET_X/Y` | −2000 / 300 | Night sky light offset |
| `SKY_LIGHT_RADIUS` | 3500 | Night sky light reach |
| `SKY_LIGHT_R/G/B` | 0.75 / 0.8 / 1.0 | Night sky light color |
| `SKY_LIGHT_INTENSITY` | 0.55 | Night sky light brightness |
| `WINDOW_LIGHT_*` | various | Window light position, color, flicker |
| `WINDOW2_LIGHT_*` | various | Second window light position, color, flicker |
| `DOOR_LIGHT_*` | various | Door light position, pink color, flicker (conditional on inventory) |
| `CAMPFIRE_LIGHT_*` | various | Campfire light position, color, intensity, height offset |
| `PLAYER_SHADOW_RADIUS` | 15 | Player occluder radius (asset px) |
| `PLAYER_FOOT_OFFSET` | 18 | Sprite bottom → visual feet (asset px) |
| `SHADOW_LENGTH_MULT` | 2.0 | Shadow reach = height × this (initial, profile overrides) |
| `SHADOW_HEIGHT_FADE` | 0.8 | Shadow reduction at player head |
| `VOLUMETRIC_DIFFUSE` | 0.8 | Cylindrical diffuse shading strength |
| `VOLUMETRIC_RIM` | 0.4 | Rim/back-light strength on edges |
| `VOLUMETRIC_RIM_R/G/B` | 0.6 / 0.75 / 1.0 | Initial rim color (profile overrides) |

---

## Limits & Constraints

- Up to **16 point lights** and **32 occluders** per frame (GLSL uniform array sizes)
- Occluders are **circular** — non-circular shapes require multiple overlapping circles
- Shadows are computed in **screen space** — no depth buffer or true 3D raycasting
- Snow particles are 2D-projected — no true volumetric interaction with objects
- Volumetric sprite shading is **player-only** — applied via a single sprite texture uniform