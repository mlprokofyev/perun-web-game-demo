import type { Player } from '../entities/Player';
import type { Camera } from '../rendering/Camera';
import type { TileMap } from '../world/TileMap';
import { questTracker } from '../quests/QuestTracker';
import { getQuestDef } from '../quests/QuestDef';
import { inventory } from '../items/Inventory';
import { getItemDef } from '../items/ItemDef';
import { assetLoader } from '../core/AssetLoader';
import { eventBus } from '../core/EventBus';

/** Simple HTML overlay HUD */
export class HUD {
  private hudEl: HTMLElement;
  private debugEl: HTMLElement;
  private questHudEl: HTMLElement;
  private invPreviewEl: HTMLElement;
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  private _debugVisible = false;
  private _questHudVisible = true;
  private _idleMode = false;

  /** Cached icon data URLs keyed by asset id */
  private iconCache: Map<string, string> = new Map();
  /** Dirty flag — rebuild inv preview HTML only when inventory changes */
  private invDirty: boolean = true;

  constructor() {
    this.hudEl = document.getElementById('hud')!;
    this.debugEl = document.getElementById('debug-overlay')!;

    // Hide debug panels by default
    this.hudEl.style.display = 'none';
    this.debugEl.style.display = 'none';

    // Create quest tracker HUD element
    let qh = document.getElementById('quest-hud');
    if (!qh) {
      qh = document.createElement('div');
      qh.id = 'quest-hud';
      document.getElementById('game-container')!.appendChild(qh);
    }
    this.questHudEl = qh;

    let ip = document.getElementById('inv-preview');
    if (!ip) {
      ip = document.createElement('div');
      ip.id = 'inv-preview';
      document.getElementById('game-container')!.appendChild(ip);
    }
    this.invPreviewEl = ip;

    eventBus.on('inventory:changed', () => { this.invDirty = true; });
  }

  get debugVisible(): boolean { return this._debugVisible; }
  setDebugVisible(v: boolean): void {
    this._debugVisible = v;
    if (!v) {
      this.hudEl.style.display = 'none';
      this.debugEl.style.display = 'none';
    }
  }

  get questHudVisible(): boolean { return this._questHudVisible; }
  setQuestHudVisible(v: boolean): void {
    this._questHudVisible = v;
    if (!v) {
      this.questHudEl.style.display = 'none';
    }
  }

  setIdleMode(idle: boolean): void {
    if (idle === this._idleMode) return;
    this._idleMode = idle;
    const opacity = idle ? '0' : '1';
    this.questHudEl.style.transition = 'opacity 0.6s';
    this.invPreviewEl.style.transition = 'opacity 0.6s';
    this.questHudEl.style.opacity = opacity;
    this.invPreviewEl.style.opacity = opacity;
  }

  update(dt: number, player: Player, camera: Camera, tileMap: TileMap): void {
    // FPS counter
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer -= 1;
    }

    // Debug panels
    if (this._debugVisible) {
      const t = player.transform;
      const dir = player.animController.getDirection();
      const itemCount = inventory.getSlots().length;
      const invStr = itemCount > 0 ? `Предметы: ${itemCount}` : '';

      this.hudEl.style.display = '';
      this.hudEl.innerHTML = `
        Поз: ${t.x.toFixed(1)}, ${t.y.toFixed(1)}<br>
        Напр: ${dir}${invStr ? '<br>' + invStr : ''}
      `;

      this.debugEl.style.display = '';
      this.debugEl.innerHTML = `
        FPS: ${this.fps}<br>
        Масштаб: ${camera.zoom.toFixed(1)}x<br>
        Карта: ${tileMap.cols}×${tileMap.rows}<br>
        Объекты: ${tileMap.objects.length}
      `;
    }

    // Active quest objective tracker
    this.updateQuestHud();

    // Inventory quick-preview
    this.updateInvPreview();
  }

  private updateQuestHud(): void {
    if (!this._questHudVisible) {
      this.questHudEl.style.display = 'none';
      return;
    }

    const active = questTracker.getActiveQuests();
    if (active.length === 0) {
      this.questHudEl.style.display = 'none';
      return;
    }

    let html = '';
    for (const state of active) {
      const def = getQuestDef(state.questId);
      if (!def) continue;

      html += `<div class="quest-hud-title">▸ ${def.title}</div>`;
      for (let i = 0; i < def.objectives.length; i++) {
        const obj = def.objectives[i];
        const progress = state.progress[i] ?? 0;
        const done = progress >= obj.required;
        const icon = done ? '✓' : '○';
        const cls = done ? 'done' : '';
        const countStr = obj.required > 1 ? ` (${Math.min(progress, obj.required)}/${obj.required})` : '';
        html += `<div class="quest-hud-obj ${cls}">${icon} ${obj.description}${countStr}</div>`;
      }
    }

    this.questHudEl.innerHTML = html;
    this.questHudEl.style.display = '';
  }

  private updateInvPreview(): void {
    const slots = inventory.getSlots();
    const isEmpty = slots.length === 0;

    this.invPreviewEl.classList.toggle('inv-preview-empty', isEmpty);

    if (this.questHudEl.style.display !== 'none' && this.questHudEl.offsetHeight > 0) {
      this.invPreviewEl.style.top = `${this.questHudEl.offsetTop + this.questHudEl.offsetHeight + 6}px`;
    } else {
      this.invPreviewEl.style.top = '';
    }

    if (!this.invDirty) {
      this.invPreviewEl.style.display = 'block';
      return;
    }
    this.invDirty = false;

    let html = '';

    if (!isEmpty) {
      html += '<div class="inv-preview-items">';
      for (const slot of slots) {
        const def = getItemDef(slot.itemId);
        if (!def) continue;

        const iconUrl = this.getIconDataUrl(def.iconAssetId);
        const iconHtml = iconUrl
          ? `<img src="${iconUrl}" width="20" height="20" class="inv-preview-icon">`
          : `<span class="inv-preview-icon-fallback">${def.name[0]}</span>`;

        const countStr = slot.count > 1 ? `<span class="inv-preview-count">×${slot.count}</span>` : '';
        html += `<div class="inv-preview-slot" title="${def.name}">${iconHtml}${countStr}</div>`;
      }
      html += '</div>';
    }

    html += '<div class="inv-preview-bag">🎒</div>';
    html += '<div class="inv-preview-questlog">📜</div>';
    html += '<div class="inv-preview-hint"><span class="inv-preview-key">I</span> — инвентарь</div>';

    this.invPreviewEl.innerHTML = html;
    this.invPreviewEl.style.display = '';
  }

  private getIconDataUrl(assetId: string): string | null {
    const cached = this.iconCache.get(assetId);
    if (cached) return cached;

    const icon = assetLoader.get(assetId);
    if (!icon) return null;

    const sz = assetLoader.getSize(assetId);
    const sw = sz?.width ?? 24;
    const sh = sz?.height ?? 24;
    const scale = Math.min(20 / sw, 20 / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);

    const cvs = document.createElement('canvas');
    cvs.width = 20;
    cvs.height = 20;
    const ctx = cvs.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(icon as CanvasImageSource, 0, 0, sw, sh,
      Math.round((20 - dw) / 2), Math.round((20 - dh) / 2), dw, dh);

    const url = cvs.toDataURL();
    this.iconCache.set(assetId, url);
    return url;
  }
}
