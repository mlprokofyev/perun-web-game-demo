# Rendering

> Render pipeline, lighting & shadow system, fog, snowfall, post-processing, shader tuning.

---

## Pipeline Overview

Each frame renders in this order:

```
Canvas 2D (Renderer.ts)              WebGL2 overlay (PostProcessPipeline.ts)
┌────────────────────────────┐       ┌──────────────────────────────────────┐
│ 1. Clear background        │       │ Upload Canvas as GL texture          │
│ 2. Ground tiles (Z-sorted) │       │ Fragment shader per pixel:           │
│ 3. Back boundary fog       │  ──►  │   • Ambient light                    │
│ 4. Back animated wisps     │       │   • Point lights + quadratic falloff │
│ 5. Blob shadows            │       │   • Occluder soft shadows            │
│ 6. Object layer (Z-sorted) │       │   • Player height fade              │
│ 7. Front boundary fog      │       │   • Volumetric sprite shading       │
│ 8. Front animated wisps    │       └──────────────────────────────────────┘
│ 9. Snowfall particles      │                       │
│ 10. Debug overlay (opt.)   │       ┌──────────────────────────────────────┐
└────────────────────────────┘       │ DOM overlays                         │
                                     │   • Dialog UI                        │
                                     │   • Interact markers (SVG arrows)    │
                                     │   • Interaction prompt               │
                                     └──────────────────────────────────────┘
```

### Render Layers

| Step | What | File | Notes |
|------|------|------|-------|
| 1 | Clear | `Renderer.ts` | Background color fill |
| 2 | Ground tiles | `Renderer.ts` | Enqueued to ground layer, flushed with Z-sort |
| 3–4 | Back fog | `FogEffect.ts` | Radial vignette + edge gradients + wisps, dimmed by `BOUNDARY_FOG_BACK_MULT` |
| 5 | Blob shadows | `Game.ts` | Soft ellipses under entities that have `blobShadow` configured |
| 6 | Object layer | `Renderer.ts` | Static objects + entities, depth-sorted by `(col+row)` |
| 7–8 | Front fog | `FogEffect.ts` | Bottom/right edges, rendered over objects |
| 9 | Snowfall | `SnowfallEffect.ts` | 3D-projected particles with parallax depth |
| 10 | Debug grid | `Game.ts` | Optional, hold `G` |
| 11 | Post-process | `PostProcessPipeline.ts` | WebGL2 full-screen quad with lighting shader |
| 12 | DOM overlays | `Game.ts` / `DialogUI.ts` | HTML elements above both canvases |

### Z-Sorting

Entities and objects share a single depth-sorted render queue. Sort key: `depthOf(col, row, z)` which computes `col + row + z`. The painter's algorithm draws back-to-front so closer objects naturally occlude farther ones.

### Entity Opacity

Entities with `opacity < 1` are rendered with `ctx.globalAlpha` set accordingly. Used for NPC fade-in.

---

## Lighting & Shadow System

A **WebGL2 post-processing pass** layered on top of the Canvas 2D output. The 2D canvas is uploaded as a texture every frame. A fragment shader multiplies each pixel by computed light contribution. Toggle with `L`.

### Light Model

```
for each pixel (fragPos):
    light = ambientColor

    for each point light i:
        attenuation = 1 − (dist / radius)²         // smooth quadratic falloff
        flicker     = noise-based modulation         // optional per-light

        shadow = 1.0                                 // fully lit
        for each occluder j:
            maxReach = occHeight[j] × shadowLenMult
            shadow = min(shadow, shadowFactor(...))

        // Player height fade
        if heightFadeActive and pixel inside player sprite:
            shadow = mix(shadow, 1.0, hx × hy × strength)

        light += color × intensity × attenuation × flicker × shadow

    finalColor = sceneColor × clamp(light, 0, 1)
```

### Current Lights

| Light | Position | Color | Behavior |
|-------|----------|-------|----------|
| **Sky light** | World offset `(SKY_LIGHT_OFFSET_X/Y)` from map center | Cool blue (0.75, 0.8, 1.0) | Simulates moon/sun from upper-left |
| **Window light** | Grid `(1.0, 2.8)` elevated `46px` | Warm orange (1.0, 0.65, 0.25) | Candle-like flicker (`WINDOW_LIGHT_FLICKER`) |

Limits: up to **16 point lights** and **32 occluders** per frame (GLSL array sizes).

### Shadow Algorithm

The `shadowFactor()` function tests how much light reaches a pixel through a circular occluder:

1. **Segment projection** — project occluder center onto the frag→light line segment, find closest point (clamped)
2. **Perpendicular penumbra** — `smoothstep(r × 0.3, r × 2.0, perpDist)` for soft edges
3. **Endpoint fade** — `smoothstep` over distance `r` around each endpoint prevents hard-edge artifacts
4. **Height-proportional reach** — `maxReach = height × SHADOW_LENGTH_MULT`, so tall objects cast long shadows
5. **Multi-occluder combination** — shadows combine with `min()` (not multiply) to avoid unnaturally dark overlap

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

- **Horizontal containment** — `smoothstep` fades to zero outside sprite width
- **Vertical bell curve** — starts at zero at feet, peaks in upper body, fades above head

```glsl
float hx = 1.0 - smoothstep(width * 0.1, width * 0.85, dx);
float hy = smoothstep(0.0, height * 0.4, dy)
         * (1.0 - smoothstep(height * 0.85, height * 1.05, dy));
shadow = mix(shadow, 1.0, hx * hy * strength);
```

### Coordinate Handling

All lighting operates in **screen-space pixels**:

1. `isoToScreen(col, row)` → world pixel position
2. `camera.worldToScreen(wx, wy)` → screen pixel position (pan + zoom)
3. **Y-flip for WebGL**: `gl_y = canvasHeight - screen_y` (top=0 → bottom=0)

### Integration in Game Loop

```
_render(dt):
    ... 2D rendering (tiles, fog, objects, entities, snow) ...

    if postProcess.enabled:
        clearLights / clearOccluders / clearHeightFade
        addLight(skyLight)         // computed from world offset + camera
        addLight(windowLight)      // grid position, elevated, with flicker
        setShadowLengthMult(SHADOW_LENGTH_MULT)
        for each world object → addOccluder(position, radius, height)
        addOccluder(player feet, radius, height)
        setHeightFade(footX, footY, width, height, strength)
        postProcess.render(dt)     // upload texture + full-screen quad
```

---

## Boundary Fog

Two complementary systems hide the hard diamond boundary and add atmospheric depth. Both live in `src/rendering/effects/FogEffect.ts`.

### Static Boundary Fog

- **Radial vignette** — large elliptical gradient centered on the map
- **Edge gradients** — linear gradient strips along each isometric diamond edge
- Drawn in **two passes**: back (top/left, behind objects) and front (bottom/right, over objects)
- `BOUNDARY_FOG_PADDING` shifts fog inward (positive) or outward (negative) from edges
- `BOUNDARY_FOG_BACK_MULT` reduces back-edge opacity to prevent over-darkening

### Animated Fog Wisps

Drifting blob wisps along map edges for a misty atmosphere.

- `FOG_WISPS_PER_EDGE` wisps per edge, evenly distributed
- Per-wisp animation: lateral **drift**, inward **oscillation**, opacity **breathing** — deterministic `sin` with golden-ratio phase seeding
- Stretched ellipses drawn with `globalCompositeOperation = 'lighter'` for additive glow
- Same back/front split as static fog, dimmed by `BOUNDARY_FOG_BACK_MULT`

---

## Snowfall

`src/rendering/effects/SnowfallEffect.ts` — particle system projected into 3D isometric space.

- Particles have world `(col, row, height)` positions projected through the isometric pipeline
- `SNOW_DEPTH_LAYERS` parallax layers for depth
- Horizontal sine-wobble (`SNOW_WOBBLE_SPEED/AMP`) and wind drift (`SNOW_WIND_SPEED`)
- Particles wrap when falling below ground or drifting off-screen

---

## Blob Shadows

Soft elliptical contact shadows drawn on the ground layer beneath each entity that has `blobShadow` configured.

| Parameter | Description |
|-----------|-------------|
| `rx` | Horizontal radius (world pixels) |
| `ry` | Vertical radius (squashed for isometric) |
| `opacity` | Shadow darkness (0–1) |

Rendered in `Game._render()` before the object layer flush. Both the player and dog NPC have blob shadows configured.

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

---

## Lighting Configuration Reference

| Constant | Default | Description |
|----------|---------|-------------|
| `LIGHTING_ENABLED` | `true` | Enable lighting on start |
| `LIGHT_AMBIENT_R/G/B` | 0.18 / 0.22 / 0.38 | Global ambient (twilight blue) |
| `SKY_LIGHT_OFFSET_X/Y` | −2000 / 300 | Sky light world offset from map center |
| `SKY_LIGHT_RADIUS` | 3500 | Sky light reach |
| `SKY_LIGHT_R/G/B` | 0.75 / 0.8 / 1.0 | Sky light color |
| `SKY_LIGHT_INTENSITY` | 0.55 | Sky light brightness |
| `WINDOW_LIGHT_COL/ROW` | 1.0 / 2.8 | Window light grid position |
| `WINDOW_LIGHT_HEIGHT` | 46 | Window elevation (asset px) |
| `WINDOW_LIGHT_RADIUS` | 214 | Window glow reach (px) |
| `WINDOW_LIGHT_R/G/B` | 1.0 / 0.65 / 0.25 | Warm orange |
| `WINDOW_LIGHT_INTENSITY` | 0.8 | Window brightness |
| `WINDOW_LIGHT_FLICKER` | 0.15 | Candle flicker strength |
| `PLAYER_SHADOW_RADIUS` | 15 | Player occluder radius (asset px) |
| `PLAYER_FOOT_OFFSET` | 18 | Sprite bottom → visual feet (asset px) |
| `SHADOW_LENGTH_MULT` | 2.0 | Shadow reach = height × this |
| `SHADOW_HEIGHT_FADE` | 0.8 | Shadow reduction at player head |
| `VOLUMETRIC_DIFFUSE` | 0.8 | Cylindrical diffuse shading strength |
| `VOLUMETRIC_RIM` | 0.4 | Rim/back-light strength on edges |
| `VOLUMETRIC_RIM_R/G/B` | 0.6 / 0.75 / 1.0 | Rim light color (cool blue) |

---

## Limits & Constraints

- Up to **16 point lights** and **32 occluders** per frame (GLSL uniform array sizes)
- Occluders are **circular** — non-circular shapes require multiple overlapping circles
- Shadows are computed in **screen space** — no depth buffer or true 3D raycasting
- Snow particles are 2D-projected — no true volumetric interaction with objects
