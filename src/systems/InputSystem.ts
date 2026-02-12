import { Config } from '../core/Config';
import { Camera } from '../rendering/Camera';

/** Tracks keyboard and mouse state each frame */
export class InputSystem {
  private keys: Set<string> = new Set();
  private mouseX: number = 0;
  private mouseY: number = 0;

  constructor(private canvas: HTMLCanvasElement, private camera: Camera) {
    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      // Prevent arrow keys from scrolling page
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousemove', e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      this.camera.adjustZoom(dir * Config.CAMERA_ZOOM_STEP);
    }, { passive: false });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** Returns normalized movement vector from WASD/Arrows */
  getMovementVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    // Normalize diagonal
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  isRunning(): boolean {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  getMouseScreen(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }
}
