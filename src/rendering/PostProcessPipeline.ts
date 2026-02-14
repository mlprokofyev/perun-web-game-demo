/**
 * WebGL2 post-processing pipeline for lighting + shadows.
 *
 * Takes the 2D canvas output as a texture, applies per-pixel lighting
 * with occluder-based soft shadows via a fragment shader, and renders
 * the result to an overlaid WebGL canvas.
 *
 * The 2D rendering pipeline (Renderer.ts) is completely untouched.
 */

const MAX_LIGHTS = 16;
const MAX_OCCLUDERS = 32;

/* ─── Shaders ──────────────────────────────────────────────────────── */

const VERT_SRC = /*glsl*/ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG_SRC = /*glsl*/ `#version 300 es
precision highp float;

#define MAX_LIGHTS    16
#define MAX_OCCLUDERS 32

uniform sampler2D u_scene;
uniform vec2      u_resolution;
uniform vec3      u_ambientColor;
uniform float     u_time;

/* Lights */
uniform int   u_numLights;
uniform vec2  u_lightPos      [MAX_LIGHTS];
uniform vec3  u_lightColor    [MAX_LIGHTS];
uniform float u_lightRadius   [MAX_LIGHTS];
uniform float u_lightIntensity[MAX_LIGHTS];
uniform float u_lightFlicker  [MAX_LIGHTS];

/* Occluders (shadow casters) */
uniform int   u_numOccluders;
uniform vec2  u_occPos   [MAX_OCCLUDERS];
uniform float u_occRadius[MAX_OCCLUDERS];
uniform float u_occHeight[MAX_OCCLUDERS];

/* Shadow length control */
uniform float u_shadowLenMult;

/* Height-fade zone — reduces shadow on tall entities (feet=full shadow, head=lit) */
uniform int   u_hfActive;       /* 0 = off, 1 = on */
uniform vec2  u_hfFootPos;      /* foot center in GL screen coords */
uniform float u_hfWidth;        /* sprite width in pixels */
uniform float u_hfHeight;       /* sprite height in pixels */
uniform float u_hfStrength;     /* 0-1: how much shadow is reduced at head */

/* Volumetric sprite shading — cylindrical diffuse + rim light */
uniform sampler2D u_spriteTex;
uniform int       u_volActive;      /* 0 = off, 1 = on */
uniform vec4      u_spriteRect;     /* screen rect in GL pixels: x, y (bottom-left), w, h */
uniform vec4      u_spriteSrcUV;    /* source UV in sprite texture: u, v, uWidth, vHeight */
uniform float     u_volDiffuse;     /* cylindrical diffuse strength 0-1 */
uniform float     u_volRim;         /* rim light strength 0-1 */
uniform vec3      u_volRimColor;    /* rim light colour */

in  vec2 v_uv;
out vec4 fragColor;

/* ── helpers ──────────────────────────────────────────────────────── */

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

/* Sample sprite alpha — returns 0.0 for UVs outside the source frame rect
   (prevents reading adjacent sprite-sheet frames during edge detection). */
float spriteAlpha(vec2 uv) {
    vec2 mn = u_spriteSrcUV.xy;
    vec2 mx = mn + u_spriteSrcUV.zw;
    if (uv.x < mn.x || uv.x > mx.x || uv.y < mn.y || uv.y > mx.y) return 0.0;
    return texture(u_spriteTex, uv).a;
}

/*
 * Soft shadow test: how much of 'light' reaches 'frag' given one occluder.
 * Returns 1.0 = fully lit, 0.0 = fully shadowed.
 *
 * Closest point on frag→light segment to occluder center, with smooth
 * boundary fades to avoid hard edges at segment endpoints.
 */
float shadowFactor(vec2 frag, vec2 light, vec2 occ, float r, float maxReach) {
    vec2  d   = light - frag;
    float len = length(d);
    if (len < 0.001) return 1.0;

    vec2  dir = d / len;
    float t   = dot(occ - frag, dir);

    /* Closest point on segment (clamped) */
    vec2  closest  = frag + dir * clamp(t, 0.0, len);
    float perpDist = distance(closest, occ);

    /* Perpendicular penumbra */
    float shadow = smoothstep(r * 0.3, r * 2.0, perpDist);

    /* Smooth boundary fade — replaces the hard t < 0 / t > len cutoff.
       Fades shadow in/out over a distance of r around each endpoint. */
    float fade = smoothstep(-r, r * 0.3, t)
               * smoothstep(len + r, len - r * 0.3, t);

    /* Limit shadow reach — distance from occluder fades shadow proportional to height */
    float distFromOcc = distance(frag, occ);
    float reachFade = 1.0 - smoothstep(maxReach * 0.5, maxReach, distFromOcc);

    return mix(1.0, shadow, fade * reachFade);
}

/* ── main ─────────────────────────────────────────────────────────── */

void main() {
    vec4 scene   = texture(u_scene, v_uv);
    vec2 fragPos = v_uv * u_resolution;

    /* start with ambient */
    vec3 light = u_ambientColor;

    /* accumulate point lights */
    for (int i = 0; i < MAX_LIGHTS; i++) {
        if (i >= u_numLights) break;

        float dist     = distance(fragPos, u_lightPos[i]);
        float normDist = clamp(dist / u_lightRadius[i], 0.0, 1.0);

        /* smooth quadratic falloff (gentle, wide glow) */
        float atten = 1.0 - normDist * normDist;

        /* optional flicker */
        float flicker = 1.0;
        if (u_lightFlicker[i] > 0.0) {
            float n = hash(floor(u_time * 8.0) + float(i) * 13.7);
            flicker = 1.0 - u_lightFlicker[i] * n * 0.5;
        }

        /* combined shadow from all occluders for this light.
           Use min (not multiply) — opaque objects don't stack shadows. */
        float shadow = 1.0;
        for (int j = 0; j < MAX_OCCLUDERS; j++) {
            if (j >= u_numOccluders) break;
            float maxReach = u_occHeight[j] * u_shadowLenMult;
            shadow = min(shadow, shadowFactor(fragPos, u_lightPos[i], u_occPos[j], u_occRadius[j], maxReach));
        }

        /* Height fade: tall entities see over ground-level shadows.
           Uses actual sprite alpha to confine the effect to the player's
           visible body — transparent area around the sprite is untouched.

           Direction-aware: in isometric view, "behind the player" means the
           light source is above the feet in GL Y (farther from the camera).
           When the light is behind, the face should stay in shadow, so we
           reduce the height-fade strength via frontFac. */
        if (u_hfActive > 0) {
            float hfMask = 0.0;

            if (u_volActive > 0) {
                /* Precise path: sample sprite alpha texture */
                vec2 sprMin  = u_spriteRect.xy;
                vec2 sprSize = u_spriteRect.zw;
                vec2 lp = fragPos - sprMin;
                if (lp.x >= 0.0 && lp.x <= sprSize.x &&
                    lp.y >= 0.0 && lp.y <= sprSize.y) {
                    vec2 luv   = lp / sprSize;
                    vec2 srcUV = u_spriteSrcUV.xy + luv * u_spriteSrcUV.zw;
                    hfMask = spriteAlpha(srcUV);
                }
            } else {
                /* Fallback: soft rectangular containment (no sprite tex) */
                float dx = abs(fragPos.x - u_hfFootPos.x);
                hfMask = 1.0 - smoothstep(u_hfWidth * 0.1, u_hfWidth * 1.0, dx);
            }

            if (hfMask > 0.1) {
                float dy = fragPos.y - u_hfFootPos.y;  /* positive = above feet in GL */
                /* vertical: 0 at feet, peaks mid-sprite, 0 above head */
                float hy = smoothstep(0.0, u_hfHeight * 1.0, dy)
                         * (1.0 - smoothstep(u_hfHeight * 0.8, u_hfHeight * 0.9, dy));

                /* Isometric facing factor — infer depth from screen position.
                   In isometric: higher GL Y = top of screen = farther from camera.
                   Derive a pseudo-Z: negative Y (light below = in front) → positive Z;
                   positive Y (light above = behind) → negative Z. */
                vec2  hlDir = u_lightPos[i] - vec2(u_hfFootPos.x, u_hfFootPos.y + u_hfHeight * 0.5);
                float isoZ  = -hlDir.y + abs(hlDir.x) * 0.3;
                float frontFac = smoothstep(-80.0, 80.0, isoZ);

                shadow = mix(shadow, 1.0, hfMask * hy * u_hfStrength * frontFac);
            }
        }

        light += u_lightColor[i] * u_lightIntensity[i] * atten * flicker * shadow;
    }

    /* ── Volumetric sprite shading ── cylindrical diffuse + rim light ── */
    if (u_volActive > 0 && u_numLights > 0) {
        vec2 sprMin  = u_spriteRect.xy;
        vec2 sprSize = u_spriteRect.zw;
        vec2 lp = fragPos - sprMin;

        if (lp.x >= 0.0 && lp.x <= sprSize.x && lp.y >= 0.0 && lp.y <= sprSize.y) {
            vec2 luv   = lp / sprSize;
            vec2 srcUV = u_spriteSrcUV.xy + luv * u_spriteSrcUV.zw;
            float alpha = spriteAlpha(srcUV);

            if (alpha > 0.1) {
                /* Cylindrical normal — character is a vertical cylinder */
                float nx = (luv.x - 0.5) * 2.0;
                float nz = sqrt(max(0.001, 1.0 - nx * nx));
                vec3 N = normalize(vec3(nx, 0.0, nz));

                /* 3D light direction from sky light (index 0).
                   In isometric, higher GL Y = farther from camera = "behind".
                   Infer Z from the Y component: light below sprite → Z positive
                   (in front), light above → Z negative (behind).
                   The X component adds a side-light bias so horizontal
                   lights don't collapse to Z=0. */
                vec2  toLight  = u_lightPos[0] - fragPos;
                float isoLZ   = -toLight.y + abs(toLight.x) * 0.3;
                /* Minimum magnitude prevents degenerate normalisation */
                isoLZ = sign(isoLZ) * max(abs(isoLZ), 50.0);
                vec3  L        = normalize(vec3(toLight, isoLZ));
                float NdotL    = dot(N, L);

                /* Half-Lambert diffuse — never fully dark */
                float diffuse = NdotL * 0.5 + 0.5;
                light *= mix(vec3(1.0), vec3(diffuse), u_volDiffuse);

                /* Rim light via alpha-edge detection.
                   Sample alpha at ±1.5 px in each direction;
                   edge pixels have at least one transparent neighbour. */
                vec2  pxUV = u_spriteSrcUV.zw / sprSize;  /* 1 screen-pixel in UV */
                float sD   = 1.5;
                float aL = spriteAlpha(srcUV + vec2(-pxUV.x * sD, 0.0));
                float aR = spriteAlpha(srcUV + vec2( pxUV.x * sD, 0.0));
                float aU = spriteAlpha(srcUV + vec2(0.0,  pxUV.y * sD));
                float aD = spriteAlpha(srcUV + vec2(0.0, -pxUV.y * sD));

                float edge = 1.0 - min(min(aL, aR), min(aU, aD));
                edge *= smoothstep(0.1, 0.5, alpha);   /* fade with sprite alpha */

                /* Fresnel-like: brighter on the side facing away from light */
                float rim = pow(1.0 - clamp(NdotL, 0.0, 1.0), 2.0)
                          * edge * u_volRim;
                light += u_volRimColor * rim;
            }
        }
    }

    light = min(light, vec3(1.2));   /* allow slight bloom from rim */
    fragColor = vec4(scene.rgb * light, 1.0);
}`;

/* ─── Types ────────────────────────────────────────────────────────── */

export interface LightSource {
  /** Screen-space X (pixels, left = 0) */
  x: number;
  /** Screen-space Y (pixels, top = 0) */
  y: number;
  /** Radius in screen pixels */
  radius: number;
  /** RGB colour components 0-1 */
  r: number;
  g: number;
  b: number;
  /** Brightness multiplier */
  intensity: number;
  /** Flicker strength 0-1 (0 = steady, 1 = heavy flicker) */
  flicker: number;
}

export interface Occluder {
  /** Screen-space X (pixels) */
  x: number;
  /** Screen-space Y (pixels) */
  y: number;
  /** Shadow-casting radius in screen pixels */
  radius: number;
  /** Object height in screen pixels — taller objects cast longer shadows */
  height: number;
}

/* ─── Pipeline ─────────────────────────────────────────────────────── */

export class PostProcessPipeline {
  /* WebGL state */
  private gl: WebGL2RenderingContext | null = null;
  private glCanvas: HTMLCanvasElement;
  private program: WebGLProgram | null = null;
  private sceneTex: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private sourceCanvas: HTMLCanvasElement;

  /* Cached uniform locations (keyed by name) */
  private loc: Record<string, WebGLUniformLocation | null> = {};

  /* Per-frame state */
  private lights: LightSource[] = [];
  private occluders: Occluder[] = [];
  private ambientR = 0.15;
  private ambientG = 0.12;
  private ambientB = 0.2;
  private time = 0;
  private shadowLenMult = 2.0;
  private _enabled = true;

  /* Height-fade zone (screen coords, top=0) */
  private hfActive = false;
  private hfFootX = 0;
  private hfFootY = 0;
  private hfWidth = 0;
  private hfHeight = 0;
  private hfStrength = 0;

  /* Volumetric sprite shading */
  private spriteTex: WebGLTexture | null = null;
  private volActive = false;
  private spriteScreenX = 0;   // screen-space left (top = 0 convention)
  private spriteScreenY = 0;   // screen-space top
  private spriteScreenW = 0;
  private spriteScreenH = 0;
  private spriteSrcU = 0;
  private spriteSrcV = 0;
  private spriteSrcUW = 1;
  private spriteSrcVH = 1;
  private volDiffuse = 0.45;
  private volRim = 0.6;
  private volRimR = 0.6;
  private volRimG = 0.75;
  private volRimB = 1.0;
  private spriteImage: TexImageSource | null = null;

  get enabled(): boolean {
    return this._enabled;
  }
  set enabled(v: boolean) {
    this._enabled = v;
    this.glCanvas.style.display = v ? 'block' : 'none';
  }

  constructor(container: HTMLElement, sourceCanvas: HTMLCanvasElement) {
    this.sourceCanvas = sourceCanvas;

    /* Create overlay canvas */
    this.glCanvas = document.createElement('canvas');
    Object.assign(this.glCanvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '1',
      imageRendering: 'pixelated',
    } as CSSStyleDeclaration);
    container.appendChild(this.glCanvas);

    /* Acquire WebGL2 */
    const gl = this.glCanvas.getContext('webgl2', {
      alpha: false,
      premultipliedAlpha: false,
      antialias: false,
    });

    if (!gl) {
      console.warn('[PostProcess] WebGL2 unavailable — lighting disabled.');
      this._enabled = false;
      this.glCanvas.style.display = 'none';
      return;
    }
    this.gl = gl;

    this.initShaders();
    this.initGeometry();
    this.initTexture();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /* ── Shader compilation ─────────────────────────────────────────── */

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[PostProcess] Shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  private initShaders(): void {
    const gl = this.gl!;
    const vs = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[PostProcess] Link error:', gl.getProgramInfoLog(prog));
      return;
    }

    this.program = prog;
    gl.useProgram(prog);

    /* Cache scalar uniforms */
    for (const n of [
      'u_scene',
      'u_resolution',
      'u_ambientColor',
      'u_time',
      'u_numLights',
      'u_numOccluders',
      'u_shadowLenMult',
      'u_hfActive',
      'u_hfFootPos',
      'u_hfWidth',
      'u_hfHeight',
      'u_hfStrength',
      /* volumetric */
      'u_spriteTex',
      'u_volActive',
      'u_spriteRect',
      'u_spriteSrcUV',
      'u_volDiffuse',
      'u_volRim',
      'u_volRimColor',
    ]) {
      this.loc[n] = gl.getUniformLocation(prog, n);
    }

    /* Cache per-light uniforms */
    for (let i = 0; i < MAX_LIGHTS; i++) {
      for (const field of [
        'u_lightPos',
        'u_lightColor',
        'u_lightRadius',
        'u_lightIntensity',
        'u_lightFlicker',
      ]) {
        this.loc[`${field}[${i}]`] = gl.getUniformLocation(
          prog,
          `${field}[${i}]`,
        );
      }
    }

    /* Cache per-occluder uniforms */
    for (let i = 0; i < MAX_OCCLUDERS; i++) {
      this.loc[`u_occPos[${i}]`] = gl.getUniformLocation(prog, `u_occPos[${i}]`);
      this.loc[`u_occRadius[${i}]`] = gl.getUniformLocation(prog, `u_occRadius[${i}]`);
      this.loc[`u_occHeight[${i}]`] = gl.getUniformLocation(prog, `u_occHeight[${i}]`);
    }
  }

  /* ── Full-screen quad ───────────────────────────────────────────── */

  private initGeometry(): void {
    const gl = this.gl!;

    //  pos (clip)   uv
    const verts = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
       1,  1, 1, 1,
    ]);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(this.program!, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);

    const aUV = gl.getAttribLocation(this.program!, 'a_uv');
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);
  }

  /* ── Scene texture ──────────────────────────────────────────────── */

  private initTexture(): void {
    const gl = this.gl!;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    /* Scene texture (unit 0) */
    this.sceneTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    /* Sprite texture for volumetric shading (unit 1) */
    this.spriteTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.spriteTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);   /* restore default unit */
  }

  /* ── Resize ─────────────────────────────────────────────────────── */

  resize(): void {
    this.glCanvas.width = window.innerWidth;
    this.glCanvas.height = window.innerHeight;
    this.gl?.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
  }

  /* ── Public API ─────────────────────────────────────────────────── */

  setAmbient(r: number, g: number, b: number): void {
    this.ambientR = r;
    this.ambientG = g;
    this.ambientB = b;
  }

  clearLights(): void {
    this.lights.length = 0;
  }

  addLight(light: LightSource): void {
    if (this.lights.length < MAX_LIGHTS) {
      this.lights.push(light);
    }
  }

  setShadowLengthMult(m: number): void {
    this.shadowLenMult = m;
  }

  clearOccluders(): void {
    this.occluders.length = 0;
  }

  addOccluder(occ: Occluder): void {
    if (this.occluders.length < MAX_OCCLUDERS) {
      this.occluders.push(occ);
    }
  }

  /** Define the height-fade zone for a tall entity (screen coords, top=0).
   *  Feet = full shadow, head = shadow reduced by `strength`. */
  setHeightFade(footX: number, footY: number, width: number, height: number, strength: number): void {
    this.hfActive = true;
    this.hfFootX = footX;
    this.hfFootY = footY;
    this.hfWidth = width;
    this.hfHeight = height;
    this.hfStrength = strength;
  }

  clearHeightFade(): void {
    this.hfActive = false;
  }

  /* ── Volumetric sprite shading ─────────────────────────────────── */

  /** Provide the player sprite image + on-screen rect + source UV rect.
   *  Screen coords use top=0 convention (same as the rest of the engine).
   *  Source UV is in normalised texture coords after Y-flip. */
  setVolumetricSprite(
    image: TexImageSource,
    screenX: number, screenY: number,
    screenW: number, screenH: number,
    srcU: number, srcV: number, srcUW: number, srcVH: number,
  ): void {
    this.volActive = true;
    this.spriteImage = image;
    this.spriteScreenX = screenX;
    this.spriteScreenY = screenY;
    this.spriteScreenW = screenW;
    this.spriteScreenH = screenH;
    this.spriteSrcU = srcU;
    this.spriteSrcV = srcV;
    this.spriteSrcUW = srcUW;
    this.spriteSrcVH = srcVH;
  }

  setVolumetricParams(diffuse: number, rim: number, rimR: number, rimG: number, rimB: number): void {
    this.volDiffuse = diffuse;
    this.volRim = rim;
    this.volRimR = rimR;
    this.volRimG = rimG;
    this.volRimB = rimB;
  }

  clearVolumetric(): void {
    this.volActive = false;
    this.spriteImage = null;
  }

  /** Upload scene texture, set uniforms, draw. Call once per frame after 2D rendering. */
  render(dt: number): void {
    if (!this._enabled || !this.gl || !this.program) return;

    const gl = this.gl;
    this.time += dt;

    /* Upload the 2D canvas as the scene texture */
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.sourceCanvas,
    );

    gl.useProgram(this.program);

    /* Scalar uniforms */
    gl.uniform1i(this.loc['u_scene'], 0);
    gl.uniform2f(
      this.loc['u_resolution'],
      this.glCanvas.width,
      this.glCanvas.height,
    );
    gl.uniform3f(
      this.loc['u_ambientColor'],
      this.ambientR,
      this.ambientG,
      this.ambientB,
    );
    gl.uniform1f(this.loc['u_time'], this.time);
    gl.uniform1i(this.loc['u_numLights'], this.lights.length);
    gl.uniform1i(this.loc['u_numOccluders'], this.occluders.length);
    gl.uniform1f(this.loc['u_shadowLenMult'], this.shadowLenMult);

    /* Per-light uniforms */
    const h = this.glCanvas.height;
    for (let i = 0; i < this.lights.length; i++) {
      const L = this.lights[i];
      // Flip Y: screen coords (top=0) → GL coords (bottom=0)
      gl.uniform2f(this.loc[`u_lightPos[${i}]`], L.x, h - L.y);
      gl.uniform3f(this.loc[`u_lightColor[${i}]`], L.r, L.g, L.b);
      gl.uniform1f(this.loc[`u_lightRadius[${i}]`], L.radius);
      gl.uniform1f(this.loc[`u_lightIntensity[${i}]`], L.intensity);
      gl.uniform1f(this.loc[`u_lightFlicker[${i}]`], L.flicker);
    }

    /* Per-occluder uniforms */
    for (let i = 0; i < this.occluders.length; i++) {
      const O = this.occluders[i];
      gl.uniform2f(this.loc[`u_occPos[${i}]`], O.x, h - O.y);
      gl.uniform1f(this.loc[`u_occRadius[${i}]`], O.radius);
      gl.uniform1f(this.loc[`u_occHeight[${i}]`], O.height);
    }

    /* Height-fade zone */
    gl.uniform1i(this.loc['u_hfActive'], this.hfActive ? 1 : 0);
    if (this.hfActive) {
      // Flip Y for GL: feet position
      gl.uniform2f(this.loc['u_hfFootPos'], this.hfFootX, h - this.hfFootY);
      gl.uniform1f(this.loc['u_hfWidth'], this.hfWidth);
      gl.uniform1f(this.loc['u_hfHeight'], this.hfHeight);
      gl.uniform1f(this.loc['u_hfStrength'], this.hfStrength);
    }

    /* Volumetric sprite shading */
    gl.uniform1i(this.loc['u_volActive'], this.volActive ? 1 : 0);
    if (this.volActive && this.spriteImage) {
      /* Upload sprite sheet to TEXTURE1 */
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.spriteTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.spriteImage);
      gl.uniform1i(this.loc['u_spriteTex'], 1);

      /* Sprite screen rect — convert from top=0 to GL bottom=0 */
      const glX = this.spriteScreenX;
      const glY = h - this.spriteScreenY - this.spriteScreenH;
      gl.uniform4f(this.loc['u_spriteRect'], glX, glY, this.spriteScreenW, this.spriteScreenH);

      /* Source UV rect (already in flipped-texture coordinates) */
      gl.uniform4f(this.loc['u_spriteSrcUV'], this.spriteSrcU, this.spriteSrcV, this.spriteSrcUW, this.spriteSrcVH);

      /* Tuning */
      gl.uniform1f(this.loc['u_volDiffuse'], this.volDiffuse);
      gl.uniform1f(this.loc['u_volRim'], this.volRim);
      gl.uniform3f(this.loc['u_volRimColor'], this.volRimR, this.volRimG, this.volRimB);

      gl.activeTexture(gl.TEXTURE0); /* restore */
    }

    /* Draw */
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}
