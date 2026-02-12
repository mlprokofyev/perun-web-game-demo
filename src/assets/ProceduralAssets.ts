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
}
