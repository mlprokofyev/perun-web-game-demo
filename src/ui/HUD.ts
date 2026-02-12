import type { Player } from '../entities/Player';
import type { Camera } from '../rendering/Camera';
import type { TileMap } from '../world/TileMap';
import { screenToIso } from '../rendering/IsometricUtils';

/** Simple HTML overlay HUD */
export class HUD {
  private hudEl: HTMLElement;
  private debugEl: HTMLElement;
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  constructor() {
    this.hudEl = document.getElementById('hud')!;
    this.debugEl = document.getElementById('debug-overlay')!;
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

    const t = player.transform;
    const dir = player.animController.getDirection();

    this.hudEl.innerHTML = `
      Perun Pixel World<br>
      Pos: ${t.x.toFixed(1)}, ${t.y.toFixed(1)}<br>
      Dir: ${dir}
    `;

    this.debugEl.innerHTML = `
      FPS: ${this.fps}<br>
      Zoom: ${camera.zoom.toFixed(1)}x<br>
      Map: ${tileMap.cols}×${tileMap.rows}<br>
      Objects: ${tileMap.objects.length}
    `;
  }
}
