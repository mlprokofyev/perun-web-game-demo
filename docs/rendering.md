# Rendering

> Render pipeline, lighting & shadow system, day/night profiles, fire effects, fog, snowfall, post-processing, shader tuning.

---

## Pipeline Overview

Each frame renders in this order:

```
Canvas 2D (Renderer.ts)              WebGL2 overlay (PostProcessPipeline.ts)
+----------------------------+       +--------------------------------------+
| 1. Clear background        |       | Upload Canvas as GL texture          |
|    (color from profile)    |       | Fragment shader per pixel:           |
| 2. Ground tiles (Z-sorted) |       |   - Ambient light (from profile)    |
| 3. Ground-layer objects    |  -->  |   - Point lights (iso-elliptical)   |
| 4. Back boundary fog       |       |   - Occluder soft shadows            |
| 5. Back animated wisps     |       |   - Shadow opacity scaling           |
| 6. Blob shadows            |       |   - Player height fade               |
| 7. Campfire sparks         |       |   - Volumetric sprite shading        |
| 8. Object layer (Z-sorted) |       |     (ambient + direct separated)    |
| 9. Front boundary fog      |       +--------------------------------------+
| 10. Front animated wisps   |                       |
| 11. Snowfall particles     |       +--------------------------------------+
| 12. Debug overlay (opt.)   |       | DOM overlays                         |
+----------------------------+       |   - Dialog UI                        |
                                     |   - Interact markers (SVG arrows)    |
                                     |   - Interaction prompt               |
                                     +--------------------------------------+
```

### Render Layers

| Step | What | File | Notes |
|------|------|------|-------|
| 1 | Clear | Renderer.ts | Background color from active LightingProfile |
| 2 | Ground tiles | Renderer.ts | Enqueued to ground layer, flushed with Z-sort |
| 3 | Ground-layer objects | Renderer.ts | Objects with groundLayer: true (e.g., obj_campfire), always below player |
| 4-5 | Back fog | FogEffect.ts | Radial vignette + edge gradients + wisps |
| 6 | Blob shadows | Game.ts | Soft ellipses under entities that have blobShadow configured |
| 7 | Campfire sparks | Game.ts | Particle system, drawn before object layer so player covers them. Alpha scaled by fireOpacity. |
| 8 | Object layer | Renderer.ts | Static objects + entities, depth-sorted by (col+row). Supports rotation. |
| 9-10 | Front fog | FogEffect.ts | Bottom/right edges, rendered over objects |
| 11 | Snowfall | SnowfallEffect.ts | 3D-projected particles with parallax depth. Gated by snow toggle (N). |
| 12 | Debug grid | Game.ts | Optional, hold G |
| 13 | Post-process | PostProcessPipeline.ts | WebGL2 full-screen quad with lighting shader |
| 14 | DOM overlays | Game.ts / DialogUI.ts | HTML elements above both canvases |

### Z-Sorting

Entities and objects share a single depth-sorted render queue. Sort key: depthOf(col, row, z) which computes col + row + z. The painter's algorithm draws back-to-front so closer objects naturally occlude farther ones.

Ground-layer objects (groundLayer: true) use a depth bias based on their visual bottom edge to sort after all tiles they overlap.

### Object Rotation

Objects with a rotation value (radians) are rendered using ctx.translate/rotate centered on the draw rectangle.

### Entity Opacity

Entities with opacity < 1 are rendered with ctx.globalAlpha set accordingly. Used for NPC fade-in and campfire day/night transitions.

---

## Lighting & Shadow System

A **WebGL2 post-processing pass** layered on top of the Canvas 2D output. The 2D canvas is uploaded as a texture every frame. A fragment shader multiplies each pixel by computed light contribution. Toggle with L.

### Light Model (Separated Ambient + Direct)

The shader separates light into **ambient** (non-directional) and **direct** (point-light) accumulators. This is critical: volumetric diffuse shading only modulates the directional component, preventing unrealistic darkening in high-ambient conditions (day mode).

```
for each pixel (fragPos):
    ambient = ambientColor              // non-directional, never affected by diffuse
    direct  = vec3(0.0)                 // directional accumulator

    for each point light i:
        // Isometric elliptical distance
        delta.y *= isoRatio             // squash Y for ground-plane projection
        attenuation = 1 - (dist / radius)^2
        flicker = noise-based modulation

        shadow = 1.0
        for each occluder j:
            maxReach = occHeight[j] * shadowLenMult
            shadow = min(shadow, shadowFactor(...))

        // Height fade (player head above shadow)
        shadow = mix(shadow, 1.0, hfMask * hy * strength * frontFac)

        // Shadow opacity (profile-controlled)
        shadow = mix(1.0, shadow, shadowOpacity)

        direct += color * intensity * attenuation * flicker * shadow

    // Volumetric sprite shading (player only)
    if volumetric active:
        direct *= mix(1.0, halfLambertDiffuse, volDiffuse)   // only direct!
        direct += rimColor * rim

    finalColor = sceneColor * clamp(ambient + direct, 0, 1.2)
```

### Isometric Light Projection

Light distance calculations use an elliptical metric to match the isometric ground plane:

```glsl
vec2 delta = fragPos - u_lightPos[i];
delta.y *= u_isoRatio;           // TILE_WIDTH / TILE_HEIGHT ~ 2.0
float dist = length(delta);
```

This makes light pools appear elliptical (wider horizontally, compressed vertically), matching how a circular light source would project onto an isometric surface.

### Current Lights

| Light | Position | Color | Behavior | Profile-gated |
|-------|----------|-------|----------|---------------|
| Sky light | World offset from map center (profile-driven) | Night: cool blue / Day: neutral white | No flicker | Always on (position/color from profile) |
| Window light | Grid (1.0, 2.8) elevated 46px | Warm orange (1.0, 0.65, 0.25) | Candle-like flicker | Yes: pointLightOpacity |
| Campfire light | Grid (2.5, 4.4) elevated 25px | Orange-yellow, modulated by FireLightEffect | Breath + wobble + crackle | Yes: fireOpacity |

Limits: up to **16 point lights** and **32 occluders** per frame (GLSL array sizes).

---

## Day/Night System (Lighting Profiles)

src/rendering/LightingProfile.ts defines a LightingProfile interface capturing all tunable scene parameters. Two presets are defined:

### Profile Parameters

| Parameter | Night | Day | Description |
|-----------|-------|-----|-------------|
| ambientR/G/B | 0.18/0.22/0.38 | 0.95/0.95/0.95 | Base scene illumination |
| bgR/G/B | 0.024/0.024/0.07 | 0.72/0.84/0.96 | Canvas background color |
| skyLightOffsetX/Y | -2000/300 | -800/-1200 | Sun/moon world position offset |
| skyLightRadius | 3500 | 5000 | Sky light reach |
| skyLightR/G/B | 0.75/0.8/1.0 | 1.0/1.0/0.98 | Sky light color |
| skyLightIntensity | 0.55 | 0.45 | Sky light brightness |
| shadowLengthMult | 2.0 | 0.4 | Shadow reach = height x mult |
| shadowOpacity | 1.0 | 0.25 | Shadow darkness (0=none, 1=full) |
| pointLightOpacity | 1.0 | 0.0 | Window light intensity multiplier |
| fireOpacity | 1.0 | 0.0 | Campfire flame/spark/light opacity |
| volRimR/G/B | 0.6/0.75/1.0 | 0.95/0.95/1.0 | Volumetric rim light color |

### Transition System

Toggling with T triggers a **1.5-second ease-in-out transition** using lerpProfile():

```typescript
// Ease-in-out quadratic
const ease = t < 0.5
  ? 2 * t * t
  : 1 - Math.pow(-2 * t + 2, 2) / 2;
activeProfile = lerpProfile(fromProfile, targetProfile, ease);
```

All float parameters interpolate smoothly. fireOpacity and pointLightOpacity are continuous floats (not booleans) so fire/lights fade gradually instead of snapping.

### Integration

Each frame, applyLightingProfile() pushes the active profile into:
- Renderer.setBackgroundColor() -- canvas background
- PostProcessPipeline.setAmbient() -- shader ambient
- PostProcessPipeline.setShadowLengthMult() / setShadowOpacity() -- shadow parameters
- Campfire.opacity -- entity visibility
- Point light intensity multiplied by pointLightOpacity
- Campfire light intensity multiplied by fireOpacity
- Spark alpha multiplied by fireOpacity
- Volumetric rim color from profile

---

## Fire Light Effect

src/rendering/effects/FireLightEffect.ts -- procedural fire flicker using three layered noise components:

| Component | Frequency | Amplitude | Character |
|-----------|-----------|-----------|-----------|
| Breath | ~0.4 Hz | +/-12% | Slow sinusoidal surge, overall brightness pulse |
| Wobble | ~1.8 Hz | +/-8% | Medium irregular oscillation (two offset sine waves) |
| Crackle | ~12 Hz | +/-10% | Fast sample-and-hold random jitter, sparking effect |

Output per frame: intensity (0.5-1.5), radius (follows intensity at reduced amplitude), r/g/b (color shifts: dim = redder, bright = yellower).

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

The effect runs in Game._update(). Output values modulate the campfire addLight() call.

---

## Shadow Algorithm

The shadowFactor() function tests how much light reaches a pixel through a circular occluder:

1. **Segment projection** -- project occluder center onto the frag-to-light line segment, find closest point (clamped)
2. **Perpendicular penumbra** -- smoothstep(r * 0.3, r * 2.0, perpDist) for soft edges
3. **Endpoint fade** -- smoothstep over distance r around each endpoint prevents hard-edge artifacts
4. **Height-proportional reach** -- maxReach = height * SHADOW_LENGTH_MULT, so tall objects cast long shadows
5. **Multi-occluder combination** -- shadows combine with min() (not multiply) to avoid unnaturally dark overlap
6. **Shadow opacity** -- shadow = mix(1.0, shadow, u_shadowOpacity) -- profile-controlled darkness

#### Complex Shadow Shapes

Simple objects (trees, stones) use a single shadowRadius. Complex objects (houses) define shadowPoints -- overlapping circles that approximate the silhouette:

```typescript
shadowPoints: [
  { dx: -0.4, dy: -0.4, radius: 40 },
  { dx:  0.0, dy: -0.4, radius: 40 },
  { dx:  0.4, dy: -0.4, radius: 40 },
  // ... 3x3 grid covers rectangular footprint
]
```

Each dx/dy is in grid-coordinate offsets from the object's (col, row).

#### Player as Shadow Caster

The player is registered as a circular occluder at their visual feet. PLAYER_FOOT_OFFSET shifts the occluder up from the sprite bottom to align with where the character actually stands.

### Player Height Fade

Simulates 3D shadow behavior: feet receive full shadow, head has reduced shadow.

- **Sprite-alpha masking** -- uses the actual sprite alpha channel for precise containment (no rectangular fallback for spriteAlphaOnly zones)
- **Vertical bell curve** -- starts at zero at feet, peaks in upper body, fades above head
- **Front-facing check** -- frontFac based on isometric light direction prevents back-light from affecting shadow fade

```glsl
float hx = spriteAlpha(srcUV);  // precise mask
float hy = smoothstep(0.0, height, dy)
         * (1.0 - smoothstep(height * 0.8, height * 0.9, dy));
shadow = mix(shadow, 1.0, hx * hy * strength * frontFac);
```

### Coordinate Handling

All lighting operates in **screen-space pixels**:

1. isoToScreen(col, row) -> world pixel position
2. camera.worldToScreen(wx, wy) -> screen pixel position (pan + zoom)
3. **Y-flip for WebGL**: gl_y = canvasHeight - screen_y (top=0 -> bottom=0)

### Integration in Game Loop

```
_render(dt):
    applyLightingProfile()         // ambient, bg, shadows from active profile
    ... 2D rendering (tiles, fog, objects, entities, snow) ...

    if postProcess.enabled:
        clearLights / clearOccluders / clearHeightFade
        addLight(skyLight)         // position + color from profile
        if pointLightOpacity > 0:
            addLight(windowLight)  // intensity * pointLightOpacity
        if fireOpacity > 0:
            addLight(campfireLight) // intensity * fireOpacity * flicker
        for each world object -> addOccluder(position, radius, height)
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
| Diffuse strength | VOLUMETRIC_DIFFUSE | 0.8 | 0 = flat, 1 = full cylinder shading |
| Rim strength | VOLUMETRIC_RIM | 0.4 | 0 = none, 1 = bright rim |
| Rim color | Profile volRimR/G/B | Night: cool blue, Day: neutral | Adjusts with day/night |

---

## Boundary Fog

Two complementary systems hide the hard diamond boundary and add atmospheric depth. Both live in src/rendering/effects/FogEffect.ts.

### Static Boundary Fog

- **Radial vignette** -- large elliptical gradient centered on the map
- **Edge gradients** -- linear gradient strips along each isometric diamond edge
- Drawn in **two passes**: back (top/left, behind objects) and front (bottom/right, over objects)
- BOUNDARY_FOG_PADDING shifts fog inward (positive) or outward (negative) from edges
- BOUNDARY_FOG_BACK_MULT reduces back-edge opacity to prevent over-darkening

### Animated Fog Wisps

Drifting blob wisps along map edges for a misty atmosphere.

- FOG_WISPS_PER_EDGE wisps per edge, evenly distributed
- Per-wisp animation: lateral drift, inward oscillation, opacity breathing -- deterministic sin with golden-ratio phase seeding
- Stretched ellipses drawn with globalCompositeOperation = 'lighter' for additive glow
- Same back/front split as static fog, dimmed by BOUNDARY_FOG_BACK_MULT

---

## Snowfall

src/rendering/effects/SnowfallEffect.ts -- particle system projected into 3D isometric space.

- Particles have world (col, row, height) positions projected through the isometric pipeline
- SNOW_DEPTH_LAYERS parallax layers for depth
- Horizontal sine-wobble (SNOW_WOBBLE_SPEED/AMP) and wind drift (SNOW_WIND_SPEED)
- Particles wrap when falling below ground or drifting off-screen
- Toggled with N key (edge-triggered)

---

## Blob Shadows

Soft elliptical contact shadows drawn on the ground layer beneath each entity that has blobShadow configured.

| Parameter | Description |
|-----------|-------------|
| rx | Horizontal radius (world pixels) |
| ry | Vertical radius (squashed for isometric) |
| opacity | Shadow darkness (0-1) |

Rendered in Game._render() before the object layer flush. The player, dog NPC, and campfire have blob shadows configured.

---

## Shader Tuning Guide

| Parameter | File | What it controls |
|-----------|------|------------------|
| r * 0.3, r * 2.0 in shadowFactor | PostProcessPipeline.ts | Penumbra softness (inner/outer edge) |
| smoothstep(-r, r*0.3, t) | PostProcessPipeline.ts | Shadow endpoint fade distance |
| u_hfWidth * 0.1 / 0.85 | PostProcessPipeline.ts | Height-fade horizontal containment |
| u_hfHeight * 0.4 / 0.85 / 1.05 | PostProcessPipeline.ts | Height-fade vertical bell shape |
| 1 - d^2/r^2 falloff formula | PostProcessPipeline.ts | Light falloff curve (quadratic) |
| maxReach * 0.5, maxReach | PostProcessPipeline.ts | Shadow length fade (start/end of reach) |
| u_isoRatio | PostProcessPipeline.ts | Elliptical light projection (TILE_WIDTH / TILE_HEIGHT) |
| u_shadowOpacity | PostProcessPipeline.ts | Profile-controlled shadow darkness |

---

## Lighting Configuration Reference

Static constants in Config.ts (used as defaults / initial values):

| Constant | Default | Description |
|----------|---------|-------------|
| LIGHTING_ENABLED | true | Enable lighting on start |
| LIGHT_AMBIENT_R/G/B | 0.18 / 0.22 / 0.38 | Initial ambient (overridden by profile) |
| SKY_LIGHT_OFFSET_X/Y | -2000 / 300 | Night sky light offset |
| SKY_LIGHT_RADIUS | 3500 | Night sky light reach |
| SKY_LIGHT_R/G/B | 0.75 / 0.8 / 1.0 | Night sky light color |
| SKY_LIGHT_INTENSITY | 0.55 | Night sky light brightness |
| WINDOW_LIGHT_* | various | Window light position, color, flicker |
| CAMPFIRE_LIGHT_* | various | Campfire light position, color, intensity, height offset |
| PLAYER_SHADOW_RADIUS | 15 | Player occluder radius (asset px) |
| PLAYER_FOOT_OFFSET | 18 | Sprite bottom to visual feet (asset px) |
| SHADOW_LENGTH_MULT | 2.0 | Shadow reach = height x this (initial, profile overrides) |
| SHADOW_HEIGHT_FADE | 0.8 | Shadow reduction at player head |
| VOLUMETRIC_DIFFUSE | 0.8 | Cylindrical diffuse shading strength |
| VOLUMETRIC_RIM | 0.4 | Rim/back-light strength on edges |
| VOLUMETRIC_RIM_R/G/B | 0.6 / 0.75 / 1.0 | Initial rim color (profile overrides) |

---

## Limits & Constraints

- Up to **16 point lights** and **32 occluders** per frame (GLSL uniform array sizes)
- Occluders are **circular** -- non-circular shapes require multiple overlapping circles
- Shadows are computed in **screen space** -- no depth buffer or true 3D raycasting
- Snow particles are 2D-projected -- no true volumetric interaction with objects
- Volumetric sprite shading is **player-only** -- applied via a single sprite texture uniform
