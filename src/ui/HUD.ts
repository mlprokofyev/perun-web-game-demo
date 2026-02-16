import type { Player } from '../entities/Player';
import type { Camera } from '../rendering/Camera';
import type { TileMap } from '../world/TileMap';
import { questTracker } from '../quests/QuestTracker';
import { getQuestDef } from '../quests/QuestDef';
import { inventory } from '../items/Inventory';

/** Simple HTML overlay HUD */
export class HUD {
  private hudEl: HTMLElement;
  private debugEl: HTMLElement;
  private questHudEl: HTMLElement;
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  private _debugVisible = false;
  private _questHudVisible = true;

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
      const invStr = itemCount > 0 ? `Items: ${itemCount}` : '';

      this.hudEl.style.display = '';
      this.hudEl.innerHTML = `
        Pos: ${t.x.toFixed(1)}, ${t.y.toFixed(1)}<br>
        Dir: ${dir}${invStr ? '<br>' + invStr : ''}
      `;

      this.debugEl.style.display = '';
      this.debugEl.innerHTML = `
        FPS: ${this.fps}<br>
        Zoom: ${camera.zoom.toFixed(1)}x<br>
        Map: ${tileMap.cols}×${tileMap.rows}<br>
        Objects: ${tileMap.objects.length}
      `;
    }

    // Active quest objective tracker
    this.updateQuestHud();
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
}
