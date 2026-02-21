import { Config } from '../core/Config';
import { EntityManager } from '../core/EntityManager';
import { assetLoader } from '../core/AssetLoader';
import { InputManager, Action } from '../core/InputManager';
import { GameStateManager } from '../core/GameState';
import { Renderer, RenderLayer } from './Renderer';
import { PostProcessPipeline } from './PostProcessPipeline';
import { Camera } from './Camera';
import { isoToScreen } from './IsometricUtils';
import { FireLightEffect } from './effects/FireLightEffect';
import type { LightingProfile } from './LightingProfile';
import { TileMap } from '../world/TileMap';
import { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Campfire } from '../entities/Campfire';
import { NPC } from '../entities/NPC';
import { InteractableObject } from '../entities/InteractableObject';
import type { GameplaySystem } from '../systems/GameplaySystem';

const TILE_IMG_W = Config.TILE_IMG_W;
const TILE_IMG_H = Config.TILE_IMG_H;
const CHAR_SRC_W = Config.CHAR_SRC_W;
const CHAR_SRC_H = Config.CHAR_SRC_H;
const CHAR_DRAW_H = Config.CHAR_DRAW_H;
const CHAR_SCALE = CHAR_DRAW_H / CHAR_SRC_H;
const CHAR_DRAW_W = CHAR_SRC_W * CHAR_SCALE;

export interface RenderDeps {
  renderer: Renderer;
  postProcess: PostProcessPipeline;
  camera: Camera;
  tileMap: TileMap;
  entityManager: EntityManager;
  inputManager: InputManager;
  player: Player;
  campfire: Campfire;
  campfireFlicker: FireLightEffect;
  stateManager: GameStateManager;
  markerCanvas: HTMLCanvasElement;
  markerCtx: CanvasRenderingContext2D;
  gameplaySystem: GameplaySystem;
  isTouch: boolean;
}

export interface RenderFrameState {
  elapsed: number;
  activeProfile: LightingProfile;
  snowEnabled: boolean;
  nearestInteractId: string | null;
}

export class RenderOrchestrator {
  private renderer: Renderer;
  private postProcess: PostProcessPipeline;
  private camera: Camera;
  private tileMap: TileMap;
  private entityManager: EntityManager;
  private inputManager: InputManager;
  private player: Player;
  private campfire: Campfire;
  private campfireFlicker: FireLightEffect;
  private stateManager: GameStateManager;
  private markerCanvas: HTMLCanvasElement;
  private markerCtx: CanvasRenderingContext2D;
  private gameplaySystem: GameplaySystem;
  private markerLabel: string;
  private markerIsEmoji: boolean;

  constructor(deps: RenderDeps) {
    this.renderer = deps.renderer;
    this.postProcess = deps.postProcess;
    this.camera = deps.camera;
    this.tileMap = deps.tileMap;
    this.entityManager = deps.entityManager;
    this.inputManager = deps.inputManager;
    this.player = deps.player;
    this.campfire = deps.campfire;
    this.campfireFlicker = deps.campfireFlicker;
    this.stateManager = deps.stateManager;
    this.markerCanvas = deps.markerCanvas;
    this.markerCtx = deps.markerCtx;
    this.gameplaySystem = deps.gameplaySystem;
    this.markerIsEmoji = deps.isTouch;
    this.markerLabel = deps.isTouch ? '🤚' : 'E';
  }

  render(dt: number, state: RenderFrameState): void {
    const { elapsed, activeProfile, snowEnabled, nearestInteractId } = state;
    const cam = this.camera;
    const zoom = cam.zoom;

    this.renderer.clear();

    // ── Enqueue ground tiles ──────────────────────────────────
    for (let r = 0; r < this.tileMap.rows; r++) {
      for (let c = 0; c < this.tileMap.cols; c++) {
        const def = this.tileMap.getTileDef(c, r);
        if (def) {
          this.renderer.enqueueTile(c, r, def.assetId, TILE_IMG_W, TILE_IMG_H, TILE_IMG_W, TILE_IMG_H);
        }
      }
    }

    // ── Enqueue static objects ────────────────────────────────
    for (const obj of this.tileMap.objects) {
      this.renderer.enqueueObject(
        obj.col, obj.row,
        obj.assetId,
        obj.width, obj.height,
        obj.anchorY,
        obj.srcW, obj.srcH,
        obj.groundLayer ? RenderLayer.GROUND : RenderLayer.OBJECT,
        (obj.rotation ?? 0) * Math.PI / 180,
        obj.depthBias ?? 0,
      );
    }

    // ── Enqueue entities ──────────────────────────────────────
    for (const entity of this.entityManager.getAll()) {
      this.renderer.enqueueEntity(entity);
    }

    // ── Ground layer ──────────────────────────────────────────
    this.renderer.flushLayer(RenderLayer.GROUND);

    // ── Back boundary effects ─────────────────────────────────
    this.renderer.drawBoundaryVignette(this.tileMap.cols, this.tileMap.rows, 'back');
    this.renderer.drawAnimatedEdgeFog(this.tileMap.cols, this.tileMap.rows, elapsed, 'back');

    // ── Blob shadows ──────────────────────────────────────────
    for (const entity of this.entityManager.getAll()) {
      const bs = entity.blobShadow;
      if (!bs) continue;
      const iso = isoToScreen(entity.transform.x, entity.transform.y);
      this.renderer.drawBlobShadow(
        iso.x, iso.y,
        bs.rx, bs.ry,
        bs.opacity * entity.opacity,
      );
    }

    // ── Glow effects ──────────────────────────────────────────
    for (const entity of this.entityManager.getAll()) {
      const g = entity.glowEffect;
      if (!g) continue;
      const iso = isoToScreen(entity.transform.x, entity.transform.y);
      this.renderer.drawGlow(
        iso.x, iso.y, entity.transform.z,
        g.radius, g.r, g.g, g.b,
        g.opacity * entity.opacity,
      );
    }

    // ── Campfire sparks ───────────────────────────────────────
    if (activeProfile.fireOpacity > 0.001) {
      this.gameplaySystem.drawCampfireSparks(
        this.renderer.ctx, cam, this.campfire, activeProfile.fireOpacity,
      );
    }

    // ── Object & entity layer (depth-sorted) ──────────────────
    this.renderer.flushLayer(RenderLayer.OBJECT);

    // ── Front boundary effects ────────────────────────────────
    this.renderer.drawBoundaryVignette(this.tileMap.cols, this.tileMap.rows, 'front');
    this.renderer.drawAnimatedEdgeFog(this.tileMap.cols, this.tileMap.rows, elapsed, 'front');

    // ── Snowfall ──────────────────────────────────────────────
    if (snowEnabled) {
      this.renderer.drawSnow(this.tileMap.cols, this.tileMap.rows, dt, elapsed);
    }

    // ── Game-specific overlay effects ─────────────────────────
    this.gameplaySystem.drawFloatingTexts(this.renderer.ctx);
    this.gameplaySystem.drawDogZzz(this.renderer.ctx, cam, elapsed);
    this.gameplaySystem.drawOnboardingHint(
      this.renderer.ctx, cam, elapsed,
      this.player.transform.x, this.player.transform.y,
    );

    // ── Debug grid ────────────────────────────────────────────
    if (this.inputManager.isActionDown(Action.DEBUG_GRID)) {
      this.renderer.drawGridOverlay(this.tileMap.cols, this.tileMap.rows);
    }

    // ── Post-process lighting ─────────────────────────────────
    if (this.postProcess.enabled) {
      this.postProcess.clearLights();
      this.postProcess.clearOccluders();
      this.postProcess.clearHeightFade();

      this.setupLights(dt, activeProfile, zoom, cam);
      this.setupOccluders(activeProfile, zoom, cam);
      this.setupVolumetric(activeProfile, zoom, cam);

      this.postProcess.render(dt);
    }

    // ── Interaction markers ───────────────────────────────────
    this.drawInteractMarkers(elapsed, nearestInteractId);
  }

  // ─── Light setup ───────────────────────────────────────────

  private setupLights(
    dt: number,
    p: LightingProfile,
    zoom: number,
    cam: Camera,
  ): void {
    // Sky light
    const mapCenter = isoToScreen(this.tileMap.cols / 2, this.tileMap.rows / 2);
    const skyWorldX = mapCenter.x + p.skyLightOffsetX;
    const skyWorldY = mapCenter.y + p.skyLightOffsetY;
    const skyScreen = cam.worldToScreen(skyWorldX, skyWorldY);
    this.postProcess.addLight({
      x: skyScreen.x,
      y: skyScreen.y,
      radius: p.skyLightRadius * zoom,
      r: p.skyLightR,
      g: p.skyLightG,
      b: p.skyLightB,
      intensity: p.skyLightIntensity,
      flicker: 0,
    });

    // Window light
    if (p.pointLightOpacity > 0.001) {
      const winWorld = isoToScreen(Config.WINDOW_LIGHT_COL, Config.WINDOW_LIGHT_ROW);
      const winScreen = cam.worldToScreen(
        winWorld.x,
        winWorld.y + Config.TILE_HEIGHT / 2 - Config.WINDOW_LIGHT_HEIGHT,
      );
      this.postProcess.addLight({
        x: winScreen.x,
        y: winScreen.y,
        radius: Config.WINDOW_LIGHT_RADIUS * zoom,
        r: Config.WINDOW_LIGHT_R,
        g: Config.WINDOW_LIGHT_G,
        b: Config.WINDOW_LIGHT_B,
        intensity: Config.WINDOW_LIGHT_INTENSITY * p.pointLightOpacity,
        flicker: Config.WINDOW_LIGHT_FLICKER,
      });
    }

    // Campfire light
    if (p.fireOpacity > 0.001) {
      this.campfireFlicker.update(dt);
      const fireWorld = isoToScreen(Config.CAMPFIRE_COL, Config.CAMPFIRE_ROW);
      const fireScreen = cam.worldToScreen(
        fireWorld.x,
        fireWorld.y + Config.TILE_HEIGHT / 2 - Config.CAMPFIRE_LIGHT_HEIGHT,
      );
      const fireLightMult = this.campfire.lightMult;
      this.postProcess.addLight({
        x: fireScreen.x,
        y: fireScreen.y,
        radius: Config.CAMPFIRE_LIGHT_RADIUS * zoom * this.campfireFlicker.radius * fireLightMult,
        r: this.campfireFlicker.r,
        g: this.campfireFlicker.g,
        b: this.campfireFlicker.b,
        intensity: Config.CAMPFIRE_LIGHT_INTENSITY * this.campfireFlicker.intensity * p.fireOpacity * fireLightMult,
        flicker: 0,
      });
    }
  }

  // ─── Occluder setup ────────────────────────────────────────

  private setupOccluders(
    p: LightingProfile,
    zoom: number,
    cam: Camera,
  ): void {
    // Static objects
    for (const obj of this.tileMap.objects) {
      const objH = (obj.shadowHeight ?? obj.height) * zoom;
      if (obj.shadowPoints) {
        for (const sp of obj.shadowPoints) {
          const ow = isoToScreen(obj.col + sp.dx, obj.row + sp.dy);
          const os = cam.worldToScreen(ow.x, ow.y + Config.TILE_HEIGHT / 2);
          this.postProcess.addOccluder({ x: os.x, y: os.y, radius: sp.radius * zoom, height: objH });
        }
      } else {
        const sr = obj.shadowRadius ?? obj.width * 0.15;
        if (sr <= 0) continue;
        const ow = isoToScreen(obj.col, obj.row);
        const os = cam.worldToScreen(ow.x, ow.y + Config.TILE_HEIGHT / 2);
        this.postProcess.addOccluder({ x: os.x, y: os.y, radius: sr * zoom, height: objH });
      }
    }

    // Player shadow
    const pIso = isoToScreen(this.player.transform.x, this.player.transform.y);
    const pScreen = cam.worldToScreen(pIso.x, pIso.y);
    const footOffset = Config.PLAYER_FOOT_OFFSET * zoom;
    const feetY = pScreen.y + Config.TILE_HEIGHT / 2 * zoom - footOffset;
    const pShadowR = Config.PLAYER_SHADOW_RADIUS * zoom;
    const pShadowH = CHAR_DRAW_H * zoom;
    this.postProcess.addOccluder({ x: pScreen.x, y: feetY, radius: pShadowR, height: pShadowH });
    const flankOff = pShadowR * 0.7;
    const flankR = pShadowR * 0.7;
    this.postProcess.addOccluder({ x: pScreen.x - flankOff, y: feetY, radius: flankR, height: pShadowH * 0.8 });
    this.postProcess.addOccluder({ x: pScreen.x + flankOff, y: feetY, radius: flankR, height: pShadowH * 0.8 });

    // NPC shadows + height-fade
    for (const e of this.entityManager.getAll()) {
      if (!(e instanceof NPC)) continue;
      if (e.opacity <= 0) continue;

      const nIso = isoToScreen(e.transform.x, e.transform.y);
      const nScreen = cam.worldToScreen(nIso.x, nIso.y);
      const nFootOffset = Config.DOG_FOOT_OFFSET * zoom;
      const nFeetY = nScreen.y + Config.TILE_HEIGHT / 2 * zoom - nFootOffset;
      const nShadowR = Config.DOG_SHADOW_RADIUS * zoom;
      const nAnim = e.animController?.getCurrentFrame();
      const nDrawH = (nAnim?.height ?? Config.DOG_DRAW_H) * e.drawScale * zoom;
      this.postProcess.addOccluder({ x: nScreen.x, y: nFeetY, radius: nShadowR, height: nDrawH });

      const nDrawW = (nAnim?.width ?? Config.DOG_IDLE_SRC_W) * e.drawScale * zoom;
      this.postProcess.addHeightFade(
        nScreen.x, nFeetY, nDrawW, nDrawH,
        Config.SHADOW_HEIGHT_FADE * 0.7,
      );
    }

    // Player height-fade
    const spriteH = CHAR_DRAW_H * zoom;
    const spriteW = CHAR_DRAW_W * zoom;
    this.postProcess.addHeightFade(
      pScreen.x, feetY, spriteW, spriteH,
      Config.SHADOW_HEIGHT_FADE,
      true,
    );
  }

  // ─── Volumetric setup ──────────────────────────────────────

  private setupVolumetric(
    activeProfile: LightingProfile,
    zoom: number,
    cam: Camera,
  ): void {
    if (!Config.VOLUMETRIC_ENABLED) {
      this.postProcess.clearVolumetric();
      return;
    }

    const pIso = isoToScreen(this.player.transform.x, this.player.transform.y);
    const pScreen = cam.worldToScreen(pIso.x, pIso.y);
    const playerAnim = this.player.animController;
    const frame = playerAnim.getCurrentFrame();
    const assetId = playerAnim.getCurrentAssetId();
    const spriteImg = assetLoader.get(assetId);
    const sheetSize = assetLoader.getSize(assetId);

    if (spriteImg && sheetSize) {
      const drawX = pScreen.x - CHAR_DRAW_W / 2 * zoom;
      const drawY = pScreen.y + (-CHAR_DRAW_H + Config.TILE_HEIGHT / 2) * zoom;
      const drawW = CHAR_DRAW_W * zoom;
      const drawH = CHAR_DRAW_H * zoom;

      const srcU  = frame.x / sheetSize.width;
      const srcV  = 1 - (frame.y + frame.height) / sheetSize.height;
      const srcUW = frame.width / sheetSize.width;
      const srcVH = frame.height / sheetSize.height;

      this.postProcess.setVolumetricSprite(
        spriteImg as TexImageSource,
        drawX, drawY, drawW, drawH,
        srcU, srcV, srcUW, srcVH,
      );
      this.postProcess.setVolumetricParams(
        Config.VOLUMETRIC_DIFFUSE,
        Config.VOLUMETRIC_RIM,
        activeProfile.volRimR,
        activeProfile.volRimG,
        activeProfile.volRimB,
      );
    }
  }

  // ─── Interaction markers ───────────────────────────────────

  private drawInteractMarkers(elapsed: number, nearestInteractId: string | null): void {
    const ctx = this.markerCtx;
    ctx.clearRect(0, 0, this.markerCanvas.width, this.markerCanvas.height);

    if (this.stateManager.size > 1) return;

    const cam = this.camera;
    const zoom = cam.zoom;
    const markerAsset = assetLoader.get('interact_marker');

    // Player draw info for silhouette erasure
    const pAnim = this.player.animController;
    const pt = this.player.transform;
    const playerDepth = pt.x + pt.y;
    let playerDraw: { asset: CanvasImageSource; sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } | null = null;

    if (pAnim) {
      const pIso = isoToScreen(pt.x, pt.y);
      const pScr = cam.worldToScreen(pIso.x, pIso.y);
      const pFrame = pAnim.getCurrentFrame();
      const pAsset = assetLoader.get(pAnim.getCurrentAssetId());
      if (pAsset) {
        const s = this.player.drawScale;
        const dw = pFrame.width * s;
        const dh = pFrame.height * s;
        playerDraw = {
          asset: pAsset as CanvasImageSource,
          sx: pFrame.x, sy: pFrame.y, sw: pFrame.width, sh: pFrame.height,
          dx: pScr.x + (-dw / 2) * zoom,
          dy: pScr.y + (-dh + Config.TILE_HEIGHT / 2 - pt.z) * zoom,
          dw: dw * zoom,
          dh: dh * zoom,
        };
      }
    }

    // Partition by depth relative to player
    const behind: Entity[] = [];
    const inFront: Entity[] = [];
    for (const e of this.entityManager.getAll()) {
      if (!e.interactable) continue;
      const entityDepth = e.transform.x + e.transform.y;
      if (playerDraw && playerDepth > entityDepth) {
        behind.push(e);
      } else {
        inFront.push(e);
      }
    }

    // Pass 1: markers behind player (will be occluded)
    for (const e of behind) {
      this.drawSingleMarker(ctx, e, cam, zoom, markerAsset ?? null, elapsed, nearestInteractId);
    }

    // Erase player silhouette from pass-1 markers
    if (behind.length > 0 && playerDraw) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(
        playerDraw.asset,
        playerDraw.sx, playerDraw.sy, playerDraw.sw, playerDraw.sh,
        playerDraw.dx, playerDraw.dy, playerDraw.dw, playerDraw.dh,
      );
      ctx.restore();
    }

    // Pass 2: markers in front of player (no occlusion)
    for (const e of inFront) {
      this.drawSingleMarker(ctx, e, cam, zoom, markerAsset ?? null, elapsed, nearestInteractId);
    }
  }

  private drawSingleMarker(
    ctx: CanvasRenderingContext2D,
    e: Entity,
    cam: Camera,
    zoom: number,
    markerAsset: CanvasImageSource | null,
    elapsed: number,
    nearestInteractId: string | null,
  ): void {
    const iso = isoToScreen(e.transform.x, e.transform.y);
    const scr = cam.worldToScreen(iso.x, iso.y);
    const spriteH = (e.animController?.getCurrentFrame()?.height ?? 0) * e.drawScale;

    const extraOffset = (e instanceof InteractableObject) ? e.markerOffsetY * zoom : 0;
    const defaultOffset = spriteH > 0
      ? (-spriteH + Config.TILE_HEIGHT / 2) * zoom
      : -30 * zoom - extraOffset;
    const bob = Math.sin(elapsed * 3) * 3;
    const markerScale = Math.min(1.6, Math.max(0.6, zoom * 0.8));

    const mw = 14 * markerScale;
    const mh = 10 * markerScale;
    const markerTop = scr.y + defaultOffset - 8 + bob;
    const markerLeft = scr.x - mw / 2;

    if (markerAsset) {
      ctx.save();
      ctx.shadowColor = 'rgba(209, 165, 136, 1)';
      ctx.shadowBlur = 5 * markerScale;
      ctx.shadowOffsetY = 1;
      ctx.drawImage(
        markerAsset as CanvasImageSource,
        0, 0, 7, 5,
        markerLeft, markerTop, mw, mh,
      );
      ctx.restore();
    }

    if (nearestInteractId === e.id) {
      const pulse = 0.65 + 0.35 * (0.5 + 0.5 * Math.cos(elapsed * Math.PI));
      ctx.save();
      ctx.globalAlpha = pulse;

      const label = this.markerLabel;
      const fontSize = 11;
      ctx.font = `bold ${fontSize}px monospace`;
      const tm = ctx.measureText(label);
      const padX = 6;
      const padY = 4;
      const textH = (tm.actualBoundingBoxAscent ?? fontSize * 0.8)
                   + (tm.actualBoundingBoxDescent ?? fontSize * 0.2);
      const bw = Math.max(tm.width, textH) + padX * 2;
      const bh = textH + padY * 2;
      const bx = scr.x - bw / 2;
      const gap = 4 * markerScale;
      const by = markerTop - gap - bh;

      ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
      const r = 3;
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bw - r, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bh - r);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      ctx.lineTo(bx + r, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(200, 170, 100, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'rgba(240, 232, 192, 0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      if (this.markerIsEmoji) {
        ctx.shadowColor = 'transparent';
        ctx.filter = 'brightness(0) invert(1)';
      }
      ctx.fillText(label, scr.x, by + bh / 2);
      if (this.markerIsEmoji) {
        ctx.filter = 'none';
      }

      ctx.restore();
    }
  }
}
