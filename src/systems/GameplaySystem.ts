import { Config } from '../core/Config';
import { EntityManager } from '../core/EntityManager';
import { Camera } from '../rendering/Camera';
import { TileMap } from '../world/TileMap';
import { GameStateManager } from '../core/GameState';
import { Collectible, CollectibleState } from '../entities/Collectible';
import { TriggerZone } from '../entities/TriggerZone';
import { Campfire } from '../entities/Campfire';
import { NPC, NPCState } from '../entities/NPC';
import { isoToScreen } from '../rendering/IsometricUtils';
import { ItemPreviewUI } from '../ui/ItemPreviewUI';
import { ItemPreviewState } from '../states/ItemPreviewState';
import { inventory } from '../items/Inventory';
import { getItemDef, type ItemDef } from '../items/ItemDef';
import { eventBus } from '../core/EventBus';
import { questTracker } from '../quests/QuestTracker';
import { gameFlags } from '../core/GameFlags';

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export interface PendingEvent {
  timer: number;
  callback: () => void;
}

const CHAR_DRAW_H = Config.CHAR_DRAW_H;

export class GameplaySystem {
  readonly floatingTexts: FloatingText[] = [];
  readonly pendingEvents: PendingEvent[] = [];
  onboardingHintActive = true;
  onboardingFadeOut = 0;
  dogNPC: NPC | null = null;

  private static readonly ONBOARDING_FADE_DURATION = 0.6;

  constructor(
    private entityManager: EntityManager,
    private camera: Camera,
    private tileMap: TileMap,
    private stateManager: GameStateManager,
    private itemPreviewUI: ItemPreviewUI,
  ) {}

  // ─── Floating text ──────────────────────────────────────────

  addFloatingText(text: string, col: number, row: number, life: number = 1.0, offsetY: number = -30): void {
    const iso = isoToScreen(col, row);
    const screen = this.camera.worldToScreen(iso.x, iso.y);
    this.floatingTexts.push({
      text,
      x: screen.x,
      y: screen.y + offsetY,
      life,
      maxLife: life,
    });
  }

  updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 30 * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1, ft.life / ft.maxLife * 2);
      ctx.fillStyle = `rgba(255, 240, 180, ${alpha})`;
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
      ctx.lineWidth = 2;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  // ─── Pending events ─────────────────────────────────────────

  updatePendingEvents(dt: number): void {
    for (let i = this.pendingEvents.length - 1; i >= 0; i--) {
      this.pendingEvents[i].timer -= dt;
      if (this.pendingEvents[i].timer <= 0) {
        this.pendingEvents[i].callback();
        this.pendingEvents.splice(i, 1);
      }
    }
  }

  // ─── Onboarding ─────────────────────────────────────────────

  updateOnboarding(dt: number, velocity: { vx: number; vy: number } | null): void {
    if (this.onboardingHintActive) {
      if (velocity && (velocity.vx !== 0 || velocity.vy !== 0)) {
        this.onboardingHintActive = false;
        this.onboardingFadeOut = GameplaySystem.ONBOARDING_FADE_DURATION;
      }
    } else if (this.onboardingFadeOut > 0) {
      this.onboardingFadeOut -= dt;
    }
  }

  drawOnboardingHint(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    elapsed: number,
    playerX: number,
    playerY: number,
  ): void {
    let alpha: number;
    if (this.onboardingHintActive) {
      alpha = Math.min(1, elapsed * 2);
    } else if (this.onboardingFadeOut > 0) {
      alpha = this.onboardingFadeOut / GameplaySystem.ONBOARDING_FADE_DURATION;
    } else {
      return;
    }

    const pw = isoToScreen(playerX, playerY);
    const screen = camera.worldToScreen(pw.x, pw.y);
    const x = screen.x;
    const y = screen.y - CHAR_DRAW_H * 0.8 * camera.zoom;
    const bob = Math.sin(elapsed * 2.5) * 3;

    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';

    const line1 = 'нажми ←↑↓→';
    const line2 = 'для движения';
    const lineH = 16;
    const padX = 14;
    const padY = 8;
    const w1 = ctx.measureText(line1).width;
    const w2 = ctx.measureText(line2).width;
    const boxW = Math.max(w1, w2) + padX * 2;
    const boxH = lineH * 2 + padY * 2;
    const bx = x - boxW / 2;
    const by = y + bob - padY - lineH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + boxW - r, by);
    ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
    ctx.lineTo(bx + boxW, by + boxH - r);
    ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
    ctx.lineTo(bx + r, by + boxH);
    ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e8dcc0';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(line1, x, y + bob);
    ctx.fillText(line1, x, y + bob);
    ctx.strokeText(line2, x, y + bob + lineH);
    ctx.fillText(line2, x, y + bob + lineH);
    ctx.restore();
  }

  // ─── Collectibles ───────────────────────────────────────────

  updateCollectibles(dt: number, playerX: number, playerY: number): void {
    for (const e of this.entityManager.getAll()) {
      if (!(e instanceof Collectible)) continue;

      e.update(dt);

      if (e.state === CollectibleState.IDLE && e.isInRange(playerX, playerY)) {
        if (e.startPickup()) {
          const added = inventory.add(e.itemId, 1, e.id);
          if (added > 0) {
            eventBus.emit('collectible:pickup', { collectibleId: e.id, itemId: e.itemId });
            this.addFloatingText('+1', e.transform.x, e.transform.y);

            const itemDef = getItemDef(e.itemId);
            if (itemDef && !itemDef.stackable) {
              this.showItemPreview(itemDef);
            }
          }
        }
      }

      if (e.state === CollectibleState.DONE) {
        this.entityManager.remove(e.id);
      }
    }
  }

  private showItemPreview(item: ItemDef): void {
    const state = new ItemPreviewState(item, this.itemPreviewUI, () => {
      this.stateManager.pop();
    });
    this.stateManager.push(state);
  }

  // ─── Trigger zones ──────────────────────────────────────────

  updateTriggerZones(): void {
    const entities = this.entityManager.getAll()
      .filter(e => !(e instanceof TriggerZone))
      .map(e => ({ id: e.id, x: e.transform.x, y: e.transform.y }));

    for (const e of this.entityManager.getAll()) {
      if (e instanceof TriggerZone) {
        e.check(entities);
      }
    }
  }

  // ─── Campfire interaction ───────────────────────────────────

  updateCampfireInteractable(campfire: Campfire, isNight: boolean): void {
    const hasSticks = inventory.has('stick', 2);
    const questActive = questTracker.isActive('q_gather_sticks');
    const alreadyFed = gameFlags.getBool('sticks_in_fire');

    if (hasSticks && questActive && !alreadyFed && isNight) {
      campfire.interactable = true;
      campfire.interactLabel = 'подкинуть дрова';
    } else {
      campfire.interactable = false;
      campfire.interactLabel = '';
    }
  }

  interactWithCampfire(campfire: Campfire): void {
    if (!inventory.has('stick', 2)) return;

    inventory.remove('stick', 2);
    gameFlags.set('sticks_in_fire', true);
    questTracker.checkFlags();

    campfire.interactable = false;
    campfire.feed();

    this.addFloatingText('Как вспыхнул!', Config.CAMPFIRE_COL, Config.CAMPFIRE_ROW, 1.5, -40);
    campfire.burst(2.5);

    this.pendingEvents.push({
      timer: 1.5,
      callback: () => this.spawnSecretItem(),
    });
  }

  private spawnSecretItem(): void {
    const maxAttempts = 20;
    let col: number = Config.CAMPFIRE_COL;
    let row: number = Config.CAMPFIRE_ROW;

    for (let i = 0; i < maxAttempts; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1.0 + Math.random() * 1.0;
      const c = Math.max(0.5, Math.min(this.tileMap.cols - 0.5, Config.CAMPFIRE_COL + Math.cos(angle) * dist));
      const r = Math.max(0.5, Math.min(this.tileMap.rows - 0.5, Config.CAMPFIRE_ROW + Math.sin(angle) * dist));

      if (this.tileMap.isTileWalkable(Math.floor(c), Math.floor(r)) &&
          !this.tileMap.collidesWithObject(c, r, 0.15, 0.15)) {
        col = c;
        row = r;
        break;
      }
    }

    const lighter = new Collectible('secret_pink_lighter', {
      col: Config.CAMPFIRE_COL,
      row: Config.CAMPFIRE_ROW,
      pickupRadius: 0.33,
      itemId: 'pink_lighter',
      assetId: 'item_pink_lighter_world',
      srcW: 43,
      srcH: 87,
      drawH: 26,
    });
    lighter.glowEffect = { radius: 28, r: 230, g: 140, b: 180, opacity: 0.25 };

    lighter.startLaunch(
      { x: Config.CAMPFIRE_COL, y: Config.CAMPFIRE_ROW },
      { x: col, y: row },
      0.9,
      100,
    );

    this.entityManager.add(lighter);
    this.addFloatingText('✨ Вжух!', Config.CAMPFIRE_COL, Config.CAMPFIRE_ROW, 2.0, -60);
  }

  // ─── Campfire spark rendering ───────────────────────────────

  drawCampfireSparks(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    campfire: Campfire,
    fireOpacity: number,
  ): void {
    const sparks = campfire.sparks;
    if (sparks.length === 0) return;

    const zoom = camera.zoom;
    const fireIso = isoToScreen(Config.CAMPFIRE_COL, Config.CAMPFIRE_ROW);
    const fireScreen = camera.worldToScreen(fireIso.x, fireIso.y);
    const baseY = fireScreen.y + Config.TILE_HEIGHT / 2 * zoom;

    ctx.save();
    for (const s of sparks) {
      const t = s.life / s.maxLife;
      const alpha = Math.min(1, t * 1.2) * fireOpacity;
      const r = s.radius * zoom * Math.max(0.4, t);

      const sx = fireScreen.x + s.ox * zoom;
      const sy = baseY + s.oy * zoom;

      const red = 255;
      const green = Math.floor(110 + s.hue * 145);
      const blue = Math.floor(s.hue * 60);

      const glowR = r * 3;
      ctx.globalAlpha = alpha * 0.3;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      grad.addColorStop(0, `rgba(${red},${green},${blue},0.6)`);
      grad.addColorStop(1, `rgba(${red},${green},0,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${red},${green},${blue})`;
      ctx.fillRect(Math.floor(sx - r / 2), Math.floor(sy - r / 2), Math.ceil(r), Math.ceil(r));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─── Dog sleeping zzz ──────────────────────────────────────

  drawDogZzz(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    elapsed: number,
  ): void {
    const dog = this.dogNPC;
    if (!dog || dog.npcState !== NPCState.SLEEPING) return;

    const iso = isoToScreen(dog.transform.x, dog.transform.y);
    const screen = camera.worldToScreen(iso.x, iso.y);
    const zoom = camera.zoom;

    ctx.save();
    ctx.textAlign = 'center';

    const zChars = [
      { delay: 0,   size: 11, dx: 6,  rise: 35 },
      { delay: 0.7, size: 14, dx: 14, rise: 50 },
      { delay: 1.4, size: 18, dx: 22, rise: 65 },
    ];
    const cycleDuration = 2.8;

    for (const z of zChars) {
      const age = ((elapsed - z.delay) % cycleDuration + cycleDuration) % cycleDuration;
      const progress = age / cycleDuration;
      const alpha = progress < 0.15
        ? progress / 0.15
        : progress > 0.7
          ? 1 - (progress - 0.7) / 0.3
          : 1;

      if (alpha <= 0) continue;

      const baseY = screen.y + Config.DOG_DRAW_H * 0.1 * zoom;
      const x = screen.x + z.dx * zoom;
      const y = baseY - z.rise * progress * zoom;

      ctx.globalAlpha = alpha * 0.75;
      ctx.font = `bold ${Math.round(z.size * 0.8 * zoom)}px monospace`;
      ctx.fillStyle = '#e8dcc0';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2.5;
      ctx.strokeText('z', x, y);
      ctx.fillText('z', x, y);
    }

    ctx.restore();
  }
}
