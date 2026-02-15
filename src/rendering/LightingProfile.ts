/**
 * Data-driven lighting profile — captures every tunable parameter
 * of the scene's visual state for a given time-of-day.
 *
 * Create presets (NIGHT, DAY, DAWN, DUSK…) and swap/lerp between them.
 */

export interface LightingProfile {
  name: string;

  // ── Ambient ───────────────────────────────────────
  ambientR: number;
  ambientG: number;
  ambientB: number;

  // ── Background / skybox color ─────────────────────
  bgR: number;
  bgG: number;
  bgB: number;

  // ── Sky (directional) light ───────────────────────
  skyLightOffsetX: number;
  skyLightOffsetY: number;
  skyLightRadius: number;
  skyLightR: number;
  skyLightG: number;
  skyLightB: number;
  skyLightIntensity: number;

  // ── Shadows ───────────────────────────────────────
  shadowLengthMult: number;
  shadowOpacity: number;       // 0 = no shadows, 1 = fully opaque

  // ── Point lights (campfire, windows) ──────────────
  pointLightOpacity: number;   // 0 = off, 1 = full strength

  // ── Fire animation ────────────────────────────────
  fireOpacity: number;         // 0 = off, 1 = full (flames, sparks, light)

  // ── Volumetric rim light color ────────────────────
  volRimR: number;
  volRimG: number;
  volRimB: number;
}

// ─── Presets ─────────────────────────────────────────────────────────

export const NIGHT_PROFILE: LightingProfile = {
  name: 'Night',

  ambientR: 0.18,
  ambientG: 0.22,
  ambientB: 0.38,

  bgR: 0.024,
  bgG: 0.024,
  bgB: 0.07,

  skyLightOffsetX: -2000,
  skyLightOffsetY: 300,
  skyLightRadius: 3500,
  skyLightR: 0.75,
  skyLightG: 0.8,
  skyLightB: 1.0,
  skyLightIntensity: 0.55,

  shadowLengthMult: 2.0,
  shadowOpacity: 1.0,

  pointLightOpacity: 1.0,
  fireOpacity: 1.0,

  volRimR: 0.6,
  volRimG: 0.75,
  volRimB: 1.0,
};

export const DAY_PROFILE: LightingProfile = {
  name: 'Day',

  ambientR: 0.95,
  ambientG: 0.95,
  ambientB: 0.95,

  bgR: 0.72,
  bgG: 0.84,
  bgB: 0.96,

  skyLightOffsetX: -800,
  skyLightOffsetY: -1200,    // high above — sun overhead
  skyLightRadius: 5000,
  skyLightR: 1.0,
  skyLightG: 1.0,
  skyLightB: 0.98,
  skyLightIntensity: 0.35,

  shadowLengthMult: 0.4,
  shadowOpacity: 0.25,

  pointLightOpacity: 0.0,
  fireOpacity: 0.0,

  volRimR: 0.95,
  volRimG: 0.95,
  volRimB: 1.0,
};

// ─── Utilities ───────────────────────────────────────────────────────

/** Linearly interpolate between two profiles. t=0 → a, t=1 → b. */
export function lerpProfile(a: LightingProfile, b: LightingProfile, t: number): LightingProfile {
  const m = (va: number, vb: number) => va + (vb - va) * t;
  return {
    name: t < 0.5 ? a.name : b.name,
    ambientR: m(a.ambientR, b.ambientR),
    ambientG: m(a.ambientG, b.ambientG),
    ambientB: m(a.ambientB, b.ambientB),
    bgR: m(a.bgR, b.bgR),
    bgG: m(a.bgG, b.bgG),
    bgB: m(a.bgB, b.bgB),
    skyLightOffsetX: m(a.skyLightOffsetX, b.skyLightOffsetX),
    skyLightOffsetY: m(a.skyLightOffsetY, b.skyLightOffsetY),
    skyLightRadius: m(a.skyLightRadius, b.skyLightRadius),
    skyLightR: m(a.skyLightR, b.skyLightR),
    skyLightG: m(a.skyLightG, b.skyLightG),
    skyLightB: m(a.skyLightB, b.skyLightB),
    skyLightIntensity: m(a.skyLightIntensity, b.skyLightIntensity),
    shadowLengthMult: m(a.shadowLengthMult, b.shadowLengthMult),
    shadowOpacity: m(a.shadowOpacity, b.shadowOpacity),
    pointLightOpacity: m(a.pointLightOpacity, b.pointLightOpacity),
    fireOpacity: m(a.fireOpacity, b.fireOpacity),
    volRimR: m(a.volRimR, b.volRimR),
    volRimG: m(a.volRimG, b.volRimG),
    volRimB: m(a.volRimB, b.volRimB),
  };
}
