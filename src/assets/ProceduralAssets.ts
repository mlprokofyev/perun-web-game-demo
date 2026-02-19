import { assetLoader } from '../core/AssetLoader';
import { Config } from '../core/Config';

const TW = Config.TILE_WIDTH;
const TH = Config.TILE_HEIGHT;

/** Helper: create a small off-screen canvas */
function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

/** Draw an isometric diamond (tile shape) */
function drawDiamond(ctx: CanvasRenderingContext2D, w: number, h: number, fill: string, stroke?: string): void {
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w, h / 2);
  ctx.lineTo(w / 2, h);
  ctx.lineTo(0, h / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** ---- TILE: grass ---- */
function makeGrassTile(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TW, TH);
  drawDiamond(ctx, TW, TH, '#3a5a28', '#2e4a20');
  // Pixel noise for texture
  const id = ctx.getImageData(0, 0, TW, TH);
  for (let i = 0; i < id.data.length; i += 4) {
    if (id.data[i + 3] > 0) {
      const n = (Math.random() - 0.5) * 16;
      id.data[i] = Math.min(255, Math.max(0, id.data[i] + n));
      id.data[i + 1] = Math.min(255, Math.max(0, id.data[i + 1] + n));
      id.data[i + 2] = Math.min(255, Math.max(0, id.data[i + 2] + n));
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

/** ---- TILE: dirt ---- */
function makeDirtTile(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TW, TH);
  drawDiamond(ctx, TW, TH, '#4a3a28', '#3a2e20');
  const id = ctx.getImageData(0, 0, TW, TH);
  for (let i = 0; i < id.data.length; i += 4) {
    if (id.data[i + 3] > 0) {
      const n = (Math.random() - 0.5) * 20;
      id.data[i] = Math.min(255, Math.max(0, id.data[i] + n));
      id.data[i + 1] = Math.min(255, Math.max(0, id.data[i + 1] + n));
      id.data[i + 2] = Math.min(255, Math.max(0, id.data[i + 2] + n));
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

/** ---- TILE: water ---- */
function makeWaterTile(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(TW, TH);
  drawDiamond(ctx, TW, TH, '#1a3040', '#162838');
  return c;
}

/** ---- OBJECT: tree ---- */
function makeTree(): HTMLCanvasElement {
  const w = 48, h = 80;
  const [c, ctx] = makeCanvas(w, h);
  // Trunk
  ctx.fillStyle = '#4a3628';
  ctx.fillRect(20, 40, 8, 40);
  // Canopy (dark dead-tree style matching user's assets)
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.arc(24, 30, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e2e2e';
  ctx.beginPath();
  ctx.arc(18, 22, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(30, 24, 11, 0, Math.PI * 2);
  ctx.fill();
  // Red accents (blood-tree vibe from user's art)
  ctx.fillStyle = '#6a2020';
  ctx.fillRect(12, 18, 3, 3);
  ctx.fillRect(32, 22, 2, 3);
  ctx.fillRect(20, 12, 3, 2);
  return c;
}

/** ---- OBJECT: rock ---- */
function makeRock(): HTMLCanvasElement {
  const w = 32, h = 24;
  const [c, ctx] = makeCanvas(w, h);
  ctx.fillStyle = '#5a5a5a';
  ctx.beginPath();
  ctx.ellipse(16, 14, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6a6a6a';
  ctx.beginPath();
  ctx.ellipse(14, 12, 10, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** ---- OBJECT: house ---- */
function makeHouse(): HTMLCanvasElement {
  const w = 96, h = 96;
  const [c, ctx] = makeCanvas(w, h);
  // Base (log-cabin style)
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(16, 40, 64, 48);
  // Roof
  ctx.fillStyle = '#5a5a5a';
  ctx.beginPath();
  ctx.moveTo(8, 42);
  ctx.lineTo(48, 12);
  ctx.lineTo(88, 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(8, 42);
  ctx.lineTo(48, 16);
  ctx.lineTo(88, 42);
  ctx.closePath();
  ctx.fill();
  // Door
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(40, 62, 16, 26);
  // Windows
  ctx.fillStyle = '#7a6a20';
  ctx.fillRect(22, 52, 10, 10);
  ctx.fillRect(64, 52, 10, 10);
  // Window cross
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(26, 52, 2, 10);
  ctx.fillRect(22, 56, 10, 2);
  ctx.fillRect(68, 52, 2, 10);
  ctx.fillRect(64, 56, 10, 2);
  return c;
}

/** ---- CHARACTER: 4-frame walk sprite sheet ---- */
function makeCharacterSheet(baseColor: string, accentColor: string): HTMLCanvasElement {
  const fw = 32, fh = 48;
  const frames = 4;
  const [c, ctx] = makeCanvas(fw * frames, fh);

  for (let f = 0; f < frames; f++) {
    const ox = f * fw;
    const bounce = (f % 2 === 0) ? 0 : -1;
    const legPhase = f; // 0,1,2,3

    // Body
    ctx.fillStyle = baseColor;
    ctx.fillRect(ox + 11, 16 + bounce, 10, 16);

    // Head
    ctx.fillStyle = '#c8a878';
    ctx.fillRect(ox + 12, 6 + bounce, 8, 10);

    // Hair / hat
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(ox + 11, 4 + bounce, 10, 5);

    // Scarf accent
    ctx.fillStyle = accentColor;
    ctx.fillRect(ox + 12, 15 + bounce, 8, 3);

    // Arms
    ctx.fillStyle = baseColor;
    if (f % 2 === 0) {
      ctx.fillRect(ox + 8, 18 + bounce, 3, 10);
      ctx.fillRect(ox + 21, 18 + bounce, 3, 10);
    } else {
      ctx.fillRect(ox + 7, 17 + bounce, 3, 11);
      ctx.fillRect(ox + 22, 19 + bounce, 3, 9);
    }

    // Legs
    ctx.fillStyle = '#4a3a2a';
    if (legPhase === 0) {
      ctx.fillRect(ox + 12, 32, 4, 12);
      ctx.fillRect(ox + 17, 32, 4, 12);
    } else if (legPhase === 1) {
      ctx.fillRect(ox + 10, 32, 4, 13);
      ctx.fillRect(ox + 18, 32, 4, 11);
    } else if (legPhase === 2) {
      ctx.fillRect(ox + 12, 32, 4, 12);
      ctx.fillRect(ox + 17, 32, 4, 12);
    } else {
      ctx.fillRect(ox + 14, 32, 4, 11);
      ctx.fillRect(ox + 15, 32, 4, 13);
    }

    // Boots
    ctx.fillStyle = '#5a3020';
    ctx.fillRect(ox + 11, 43, 5, 4);
    ctx.fillRect(ox + 17, 43, 5, 4);
  }

  return c;
}

function makeCharacterIdle(): HTMLCanvasElement {
  const fw = 32, fh = 48;
  const [c, ctx] = makeCanvas(fw, fh);

  // Body
  ctx.fillStyle = '#8a8a90';
  ctx.fillRect(11, 16, 10, 16);

  // Head
  ctx.fillStyle = '#c8a878';
  ctx.fillRect(12, 6, 8, 10);

  // Hair
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(11, 4, 10, 5);

  // Scarf
  ctx.fillStyle = '#8a3030';
  ctx.fillRect(12, 15, 8, 3);

  // Arms
  ctx.fillStyle = '#8a8a90';
  ctx.fillRect(8, 18, 3, 10);
  ctx.fillRect(21, 18, 3, 10);

  // Legs
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(12, 32, 4, 12);
  ctx.fillRect(17, 32, 4, 12);

  // Boots
  ctx.fillStyle = '#5a3020';
  ctx.fillRect(11, 43, 5, 4);
  ctx.fillRect(17, 43, 5, 4);

  return c;
}

// ─── Campfire sprite-sheet constants ─────────────────────────────
export const CAMPFIRE_FRAME_W = 64;
export const CAMPFIRE_FRAME_H = 80;
export const CAMPFIRE_FRAMES  = 6;

/** Seed-able pseudo-random for deterministic pixel noise */
function seededRand(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

/** ---- OBJECT: animated campfire (6-frame sprite sheet) ----
 *  64×80 per frame — firewood base, red-hot coals, soft rising flames, sparks.
 *  Flames are drawn at 2× resolution then blurred for a natural soft glow. */
function makeCampfireSheet(): HTMLCanvasElement {
  const fw = CAMPFIRE_FRAME_W;
  const fh = CAMPFIRE_FRAME_H;
  const frames = CAMPFIRE_FRAMES;
  const [c, ctx] = makeCanvas(fw * frames, fh);

  for (let f = 0; f < frames; f++) {
    const ox = f * fw;
    const rng = seededRand(f * 777 + 42);

    // ── Ground scorch mark ──
    ctx.fillStyle = '#1a1008';
    ctx.beginPath();
    ctx.ellipse(ox + fw / 2, fh - 6, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Firewood logs (cross-stacked) ──
    const logY = fh - 16;
    // Bottom log — horizontal
    ctx.fillStyle = '#3a2210';
    ctx.fillRect(ox + 12, logY + 2, 40, 6);
    // Bark highlight
    ctx.fillStyle = '#4d3018';
    ctx.fillRect(ox + 13, logY + 2, 38, 2);
    // Charred ends
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(ox + 12, logY + 2, 4, 6);
    ctx.fillRect(ox + 48, logY + 2, 4, 6);

    // Second log — angled left
    ctx.fillStyle = '#352010';
    for (let i = 0; i < 16; i++) {
      ctx.fillRect(ox + 14 + i, logY - i * 0.45 + 1, 5, 5);
    }
    // Third log — angled right
    ctx.fillStyle = '#3e2814';
    for (let i = 0; i < 16; i++) {
      ctx.fillRect(ox + 45 - i, logY - i * 0.45 + 1, 5, 5);
    }
    // Fourth log — short, across front
    ctx.fillStyle = '#30190c';
    ctx.fillRect(ox + 18, logY + 4, 28, 4);
    ctx.fillStyle = '#4a2e16';
    ctx.fillRect(ox + 19, logY + 4, 26, 2);

    // ── Glowing coals at base ──
    const coalY = logY + 1;
    const coalColors = ['#ff3300', '#cc2200', '#ff5500', '#ee4400', '#ff6600', '#ff4411'];
    for (let i = 0; i < 20; i++) {
      const cx2 = ox + 16 + rng() * 32;
      const cy2 = coalY - 2 + rng() * 6;
      const coalFlicker = (f + i) % 3;
      ctx.fillStyle = coalColors[(i + coalFlicker) % coalColors.length];
      ctx.fillRect(Math.floor(cx2), Math.floor(cy2), 2 + (i % 3), 2 + (i % 2));
    }

    // ── Ember glow (large radial underneath flames) ──
    const glowGrad = ctx.createRadialGradient(ox + fw / 2, coalY - 4, 3, ox + fw / 2, coalY - 4, 26);
    glowGrad.addColorStop(0, 'rgba(255,120,10,0.55)');
    glowGrad.addColorStop(0.4, 'rgba(255,70,0,0.3)');
    glowGrad.addColorStop(1, 'rgba(255,30,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(ox, coalY - 28, fw, 32);

    // ── Flames — drawn on a temp canvas at 2× then composited with blur ──
    const flameBase = coalY - 4;
    const flameCenterX = fw / 2;
    const flameW = fw * 2;
    const flameH = fh * 2;
    const [flameCanvas, fctx] = makeCanvas(flameW, flameH);

    // Flame palette (bottom → top): deep red → orange → yellow → white-yellow
    const flamePalette = [
      [200, 30, 0],  [210, 50, 0],  [230, 80, 0],
      [255, 100, 0], [255, 130, 20], [255, 165, 35],
      [255, 185, 60], [255, 200, 80], [255, 215, 110],
      [255, 230, 150], [255, 240, 185], [255, 250, 225],
    ];

    // Draw flame columns at 2× scale — wider strokes for softness
    for (let px = -16; px <= 16; px++) {
      const distFromCenter = Math.abs(px) / 16;
      const baseHeight = (1 - distFromCenter * distFromCenter) * 42;
      const noise = (rng() - 0.5) * 14 + Math.sin((f + px * 0.3) * 1.5) * 5;
      const height = Math.max(4, baseHeight + noise);

      for (let py = 0; py < height; py++) {
        const t = py / height;
        const wobble = Math.sin((f * 1.1 + py * 0.25 + px * 0.4)) * (t * 5);
        const fx = flameCenterX * 2 + px * 2 + wobble;
        const fy = flameBase * 2 - py * 2;

        if (fy < 2 || fy >= flameH) continue;

        const colorIdx = Math.min(flamePalette.length - 1, Math.floor(t * flamePalette.length));
        const [cr, cg, cb] = flamePalette[colorIdx];
        const alpha = t < 0.15 ? 0.9 : (1 - t * 0.4);
        fctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(2)})`;

        // Wider strokes (3–4px at 2×) — thins toward tips
        const w = t < 0.5 ? 4 : t < 0.8 ? 3 : 2;
        fctx.fillRect(Math.floor(fx), Math.floor(fy), w, 2);
      }
    }

    // Bright flame core (inner hotspot) at 2×
    for (let px = -6; px <= 6; px++) {
      const distFromCenter = Math.abs(px) / 6;
      const coreHeight = (1 - distFromCenter * distFromCenter) * 26 + (rng() - 0.5) * 8;
      for (let py = 0; py < coreHeight; py++) {
        const t = py / coreHeight;
        const wobble = Math.sin((f * 1.3 + py * 0.35)) * (t * 3);
        const fx = flameCenterX * 2 + px * 2 + wobble;
        const fy = flameBase * 2 - py * 2 - 3;
        if (fy < 2 || fy >= flameH) continue;

        if (t < 0.25) fctx.fillStyle = 'rgba(255,170,50,0.85)';
        else if (t < 0.5) fctx.fillStyle = 'rgba(255,200,90,0.8)';
        else if (t < 0.8) fctx.fillStyle = 'rgba(255,235,150,0.75)';
        else fctx.fillStyle = 'rgba(255,250,230,0.7)';

        fctx.fillRect(Math.floor(fx), Math.floor(fy), 3, 2);
      }
    }

    // Composite the 2× flame canvas back at 1× with blur for softness
    ctx.save();
    ctx.filter = 'blur(1.2px)';
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(flameCanvas, 0, 0, flameW, flameH, ox, 0, fw, fh);
    ctx.restore();

    // Second pass — sharper core layered on top (half opacity) for definition
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.drawImage(flameCanvas, 0, 0, flameW, flameH, ox, 0, fw, fh);
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── Small sparks/embers baked into the sprite sheet ──
    for (let s = 0; s < 7; s++) {
      const sx = ox + flameCenterX + (rng() - 0.5) * 28;
      const sy = flameBase - 22 - rng() * 24 - f * 2.5;
      if (sy < 2 || sy >= fh) continue;
      const sparkColors = ['#ff6600', '#ffaa22', '#ffdd55', '#ff8833', '#ffcc44'];
      ctx.fillStyle = sparkColors[s % sparkColors.length];
      ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
    }
  }

  return c;
}

// ─── Item icon + world sprites (procedural placeholders) ────────

/** 24×24 inventory icon: brown stick diagonal */
function makeItemStick(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 24);
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, 20);
  ctx.lineTo(20, 4);
  ctx.stroke();
  ctx.strokeStyle = '#A67C00';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(5, 19);
  ctx.lineTo(19, 5);
  ctx.stroke();
  return c;
}

/** 32×32 world sprite: stick on the ground */
function makeItemStickWorld(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32, 32);
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, 26);
  ctx.lineTo(28, 6);
  ctx.stroke();
  ctx.strokeStyle = '#A67C00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(5, 25);
  ctx.lineTo(27, 7);
  ctx.stroke();
  return c;
}

/** 24×24 inventory icon: bone with 3D shading */
function makeItemBone(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 24);
  ctx.save();
  ctx.translate(12, 12);
  ctx.rotate(-Math.PI / 4);

  // Dark outline / shadow pass
  ctx.fillStyle = '#121814';
  ctx.fillRect(-9, -2, 18, 5);
  ctx.beginPath();
  ctx.arc(-9, -2, 3.5, 0, Math.PI * 2);
  ctx.arc(-9, 3, 3.5, 0, Math.PI * 2);
  ctx.arc(9, -2, 3.5, 0, Math.PI * 2);
  ctx.arc(9, 3, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Main bone body
  ctx.fillStyle = '#A09A90';
  ctx.fillRect(-9, -2, 18, 4);
  ctx.beginPath();
  ctx.arc(-9, -2, 3, 0, Math.PI * 2);
  ctx.arc(-9, 2, 3, 0, Math.PI * 2);
  ctx.arc(9, -2, 3, 0, Math.PI * 2);
  ctx.arc(9, 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Top highlight
  ctx.fillStyle = '#F5F0E8';
  ctx.fillRect(-8, -2, 16, 2);
  ctx.beginPath();
  ctx.arc(-9, -2, 2, 0, Math.PI * 2);
  ctx.arc(9, -2, 2, 0, Math.PI * 2);
  ctx.fill();

  // Hot-spot specular
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-3, -1, 6, 1);

  ctx.restore();
  return c;
}

/** 32×32 world sprite: bone with 3D shading */
function makeItemBoneWorld(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32, 32);
  ctx.save();
  ctx.translate(16, 16);
  ctx.rotate(-Math.PI / 5);

  // Thin dark outline for ground contrast
  ctx.fillStyle = 'rgba(20, 15, 10, 0.55)';
  ctx.fillRect(-13, -3, 26, 8);
  ctx.beginPath();
  ctx.arc(-12, -2, 5.5, 0, Math.PI * 2);
  ctx.arc(-12, 4, 5.5, 0, Math.PI * 2);
  ctx.arc(12, -2, 5.5, 0, Math.PI * 2);
  ctx.arc(12, 4, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Dark outline / shadow pass
  ctx.fillStyle = '#8B7D6B';
  ctx.fillRect(-12, -2, 24, 6);
  ctx.beginPath();
  ctx.arc(-12, -2, 4.5, 0, Math.PI * 2);
  ctx.arc(-12, 4, 4.5, 0, Math.PI * 2);
  ctx.arc(12, -2, 4.5, 0, Math.PI * 2);
  ctx.arc(12, 4, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Main bone body
  ctx.fillStyle = '#D8CFC0';
  ctx.fillRect(-12, -2, 24, 5);
  ctx.beginPath();
  ctx.arc(-12, -2, 4, 0, Math.PI * 2);
  ctx.arc(-12, 3, 4, 0, Math.PI * 2);
  ctx.arc(12, -2, 4, 0, Math.PI * 2);
  ctx.arc(12, 3, 4, 0, Math.PI * 2);
  ctx.fill();

  // Top highlight
  ctx.fillStyle = '#F5F0E8';
  ctx.fillRect(-10, -2, 20, 2);
  ctx.beginPath();
  ctx.arc(-12, -2, 2.5, 0, Math.PI * 2);
  ctx.arc(12, -2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Hot-spot specular
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-4, -1, 8, 1);

  ctx.restore();
  return c;
}

/** 24×24 inventory icon: grey stone */
function makeItemStone(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 24);
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.ellipse(12, 14, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#AAA';
  ctx.beginPath();
  ctx.ellipse(11, 12, 6, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** 24×24 inventory icon: pink transparent plastic cigarette lighter */
function makeItemPinkLighter(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(24, 24);
  const bx = 9;
  const bw = 6;
  const cx = bx + bw / 2;
  const cy = 13;

  // ── Soft pink radial glow behind the lighter ──
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 12);
  glow.addColorStop(0, 'rgba(240, 160, 190, 0.45)');
  glow.addColorStop(0.5, 'rgba(220, 130, 170, 0.18)');
  glow.addColorStop(1, 'rgba(200, 100, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 24, 24);

  // ── 1px white outline around entire lighter silhouette ──
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  // Around fork prongs
  ctx.fillRect(bx, 0, 1, 3);
  ctx.fillRect(bx + 2, 0, 2, 1);
  ctx.fillRect(bx + 3, 0, 1, 3);
  ctx.fillRect(bx + 5, 0, 1, 3);
  // Around wheel
  ctx.fillRect(bx - 1, 3, 1, 2);
  ctx.fillRect(bx + bw, 3, 1, 2);
  // Around cap
  ctx.fillRect(bx - 2, 5, 1, 3);
  ctx.fillRect(bx + bw + 1, 5, 1, 3);
  // Around body
  ctx.fillRect(bx - 2, 8, 1, 14);
  ctx.fillRect(bx + bw + 1, 8, 1, 14);
  ctx.fillRect(bx - 1, 22, bw + 2, 1);

  // ── Fork prongs ──
  ctx.fillStyle = '#16161c';
  ctx.fillRect(bx + 1, 0, 1, 3);
  ctx.fillRect(bx + 4, 0, 1, 3);

  // ── Spark wheel ──
  ctx.fillStyle = '#222228';
  ctx.fillRect(bx, 3, bw, 2);
  ctx.fillStyle = '#38383e';
  ctx.fillRect(bx + 1, 3, bw - 2, 1);

  // ── Metal cap — stepped wider ──
  ctx.fillStyle = '#f0f0f4';
  ctx.fillRect(bx - 1, 5, bw + 2, 1);
  ctx.fillStyle = '#ccccda';
  ctx.fillRect(bx - 1, 6, bw + 2, 1);
  ctx.fillStyle = '#9898a8';
  ctx.fillRect(bx - 1, 7, bw + 2, 1);

  // ── Body outline ──
  const bodyTop = 8;
  const bodyH = 14;
  ctx.fillStyle = '#8a4860';
  ctx.fillRect(bx - 1, bodyTop, 1, bodyH);
  ctx.fillRect(bx + bw, bodyTop, 1, bodyH);
  ctx.fillRect(bx, bodyTop + bodyH, bw, 1);

  // ── Pink transparent plastic body ──
  ctx.fillStyle = '#e8a0b8';
  ctx.fillRect(bx, bodyTop, bw, bodyH);

  // Left highlight
  ctx.fillStyle = '#f4c0d4';
  ctx.fillRect(bx, bodyTop, 2, bodyH - 1);
  ctx.fillStyle = '#fce0ec';
  ctx.fillRect(bx, bodyTop + 1, 1, 3);

  // Internal gas tube
  ctx.fillStyle = '#c87898';
  ctx.fillRect(bx + 3, bodyTop + 1, 2, bodyH - 2);
  ctx.fillStyle = '#a06078';
  ctx.fillRect(bx + 3, bodyTop + 3, 1, 2);

  // Butane fuel level
  ctx.fillStyle = '#c0586e';
  ctx.fillRect(bx + 1, bodyTop + 8, 4, 5);
  ctx.fillStyle = '#a84060';
  ctx.fillRect(bx + 2, bodyTop + 9, 2, 3);

  // Right edge shadow
  ctx.fillStyle = '#d48c9c';
  ctx.fillRect(bx + 5, bodyTop, 1, bodyH - 1);

  return c;
}

/** 32×32 world sprite: pink transparent plastic cigarette lighter */
function makeItemPinkLighterWorld(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32, 32);
  const bx = 12;
  const bw = 8;
  const cx = bx + bw / 2;
  const cy = 17;

  // ── Soft pink radial glow ──
  const glow = ctx.createRadialGradient(cx, cy, 3, cx, cy, 16);
  glow.addColorStop(0, 'rgba(240, 160, 190, 0.40)');
  glow.addColorStop(0.5, 'rgba(220, 130, 170, 0.15)');
  glow.addColorStop(1, 'rgba(200, 100, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 32);

  // ── 1px white outline around entire lighter silhouette ──
  ctx.fillStyle = 'rgba(255, 255, 255, 0.50)';
  // Around fork prongs
  ctx.fillRect(bx + 1, 0, 1, 4);
  ctx.fillRect(bx + 3, 0, 2, 1);
  ctx.fillRect(bx + 4, 0, 1, 4);
  ctx.fillRect(bx + 6, 0, 1, 4);
  // Around wheel
  ctx.fillRect(bx - 1, 4, 1, 3);
  ctx.fillRect(bx + bw, 4, 1, 3);
  // Around cap
  ctx.fillRect(bx - 2, 7, 1, 4);
  ctx.fillRect(bx + bw + 1, 7, 1, 4);
  // Around body
  ctx.fillRect(bx - 2, 11, 1, 18);
  ctx.fillRect(bx + bw + 1, 11, 1, 18);
  ctx.fillRect(bx - 1, 29, bw + 2, 1);

  // ── Fork prongs ──
  ctx.fillStyle = '#16161c';
  ctx.fillRect(bx + 2, 0, 1, 4);
  ctx.fillRect(bx + 5, 0, 1, 4);

  // ── Spark wheel ──
  ctx.fillStyle = '#222228';
  ctx.fillRect(bx, 4, bw, 3);
  ctx.fillStyle = '#38383e';
  ctx.fillRect(bx + 1, 4, bw - 2, 1);

  // ── Metal cap — stepped wider ──
  ctx.fillStyle = '#f0f0f4';
  ctx.fillRect(bx - 1, 7, bw + 2, 1);
  ctx.fillStyle = '#ccccda';
  ctx.fillRect(bx - 1, 8, bw + 2, 2);
  ctx.fillStyle = '#9898a8';
  ctx.fillRect(bx - 1, 10, bw + 2, 1);

  // ── Body outline ──
  const bodyTop = 11;
  const bodyH = 18;
  ctx.fillStyle = '#8a4860';
  ctx.fillRect(bx - 1, bodyTop, 1, bodyH);
  ctx.fillRect(bx + bw, bodyTop, 1, bodyH);
  ctx.fillRect(bx, bodyTop + bodyH, bw, 1);

  // ── Pink transparent plastic body ──
  ctx.fillStyle = '#e8a0b8';
  ctx.fillRect(bx, bodyTop, bw, bodyH);

  // Left highlight
  ctx.fillStyle = '#f4c0d4';
  ctx.fillRect(bx, bodyTop, 3, bodyH - 1);
  ctx.fillStyle = '#fce0ec';
  ctx.fillRect(bx, bodyTop + 1, 2, 4);
  ctx.fillStyle = '#fff0f4';
  ctx.fillRect(bx + 1, bodyTop + 2, 1, 2);

  // Internal gas tube
  ctx.fillStyle = '#c87898';
  ctx.fillRect(bx + 4, bodyTop + 1, 3, bodyH - 2);
  ctx.fillStyle = '#a06078';
  ctx.fillRect(bx + 4, bodyTop + 4, 2, 3);

  // Butane fuel level
  ctx.fillStyle = '#c0586e';
  ctx.fillRect(bx + 2, bodyTop + 10, 5, 7);
  ctx.fillStyle = '#a84060';
  ctx.fillRect(bx + 3, bodyTop + 12, 3, 4);
  ctx.fillStyle = '#983855';
  ctx.fillRect(bx + 4, bodyTop + 13, 2, 2);

  // Right edge shadow
  ctx.fillStyle = '#d48c9c';
  ctx.fillRect(bx + 7, bodyTop, 1, bodyH - 1);

  return c;
}

/** 7×5 interaction marker (pixel-art downward arrow ▼) */
function makeInteractMarker(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(7, 5);
  ctx.fillStyle = '#E89028';
  ctx.fillRect(1, 0, 5, 1);
  ctx.fillRect(2, 1, 3, 1);
  ctx.fillRect(3, 2, 1, 1);
  ctx.fillStyle = '#C06A16';
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(6, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  ctx.fillRect(5, 1, 1, 1);
  ctx.fillRect(2, 2, 1, 1);
  ctx.fillRect(4, 2, 1, 1);
  ctx.fillRect(3, 3, 1, 1);
  return c;
}

/** 32×32 world sprite: stone */
function makeItemStoneWorld(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32, 32);
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.ellipse(16, 18, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#AAA';
  ctx.beginPath();
  ctx.ellipse(14, 15, 8, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function makeNotePaper(): HTMLCanvasElement {
  const W = 20;
  const H = 16;
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext('2d')!;

  // Paper body — slight isometric perspective (narrower at top)
  ctx.fillStyle = '#f0e4c8';
  ctx.beginPath();
  ctx.moveTo(3, 1);
  ctx.lineTo(17, 1);
  ctx.lineTo(18, 14);
  ctx.lineTo(2, 14);
  ctx.closePath();
  ctx.fill();

  // Subtle paper edge shadow
  ctx.strokeStyle = 'rgba(120, 90, 50, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Curled corner (bottom-right)
  ctx.fillStyle = '#e0d4b0';
  ctx.beginPath();
  ctx.moveTo(15, 14);
  ctx.lineTo(18, 14);
  ctx.lineTo(18, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 90, 50, 0.3)';
  ctx.stroke();

  // Text lines
  ctx.fillStyle = 'rgba(80, 55, 30, 0.5)';
  for (let y = 4; y <= 12; y += 2) {
    const indent = y === 4 ? 6 : 5;
    const end = y === 12 ? 12 : 15;
    ctx.fillRect(indent, y, end - indent, 1);
  }

  // Small red wax seal dot
  ctx.fillStyle = 'rgba(160, 50, 40, 0.7)';
  ctx.beginPath();
  ctx.arc(10, 13, 1.5, 0, Math.PI * 2);
  ctx.fill();

  return cvs;
}

/**
 * Generate and register all procedural placeholder assets.
 * These will be used until real PNG files are placed in /public/assets/.
 */
export function generateProceduralAssets(): void {
  // Tiles
  assetLoader.registerCanvas('tile_grass', makeGrassTile());
  assetLoader.registerCanvas('tile_dirt', makeDirtTile());
  assetLoader.registerCanvas('tile_water', makeWaterTile());

  // Objects
  assetLoader.registerCanvas('obj_tree', makeTree());
  assetLoader.registerCanvas('obj_rock', makeRock());
  assetLoader.registerCanvas('obj_house', makeHouse());

  // Character — same sheet for all 4 directions (placeholder)
  const walkSheet = makeCharacterSheet('#8a8a90', '#8a3030');
  assetLoader.registerCanvas('char_walk_south', walkSheet);
  assetLoader.registerCanvas('char_walk_north', walkSheet);
  assetLoader.registerCanvas('char_walk_east', walkSheet);
  assetLoader.registerCanvas('char_walk_west', walkSheet);

  const idleSheet = makeCharacterIdle();
  assetLoader.registerCanvas('char_idle_south', idleSheet);
  assetLoader.registerCanvas('char_idle_north', idleSheet);
  assetLoader.registerCanvas('char_idle_east', idleSheet);
  assetLoader.registerCanvas('char_idle_west', idleSheet);

  // Campfire — animated sprite sheet
  assetLoader.registerCanvas('campfire_anim', makeCampfireSheet());

  // Item collectible world sprites + inventory icons (procedural fallbacks)
  if (!assetLoader.has('item_stick')) {
    assetLoader.registerCanvas('item_stick', makeItemStick());
    assetLoader.registerCanvas('item_stick_world', makeItemStickWorld());
  }
  if (!assetLoader.has('item_bone')) {
    assetLoader.registerCanvas('item_bone', makeItemBone());
    assetLoader.registerCanvas('item_bone_world', makeItemBoneWorld());
  }
  if (!assetLoader.has('item_stone')) {
    assetLoader.registerCanvas('item_stone', makeItemStone());
    assetLoader.registerCanvas('item_stone_world', makeItemStoneWorld());
  }
  // Interaction marker
  assetLoader.registerCanvas('interact_marker', makeInteractMarker());

  // Note paper on house wall
  if (!assetLoader.has('obj_note_paper')) {
    assetLoader.registerCanvas('obj_note_paper', makeNotePaper());
  }

  if (!assetLoader.has('item_pink_lighter')) {
    assetLoader.registerCanvas('item_pink_lighter', makeItemPinkLighter());
    assetLoader.registerCanvas('item_pink_lighter_world', makeItemPinkLighterWorld());
  }
}
