import { Config } from '../core/Config';
import { Camera } from '../rendering/Camera';
import { Action, DEFAULT_BINDINGS, type KeyBindings } from '../core/InputManager';
import type { InputProvider } from '../core/InputProvider';

/**
 * Desktop input: keyboard + mouse wheel + mouse position.
 * Implements InputProvider so InputManager can aggregate it
 * alongside other providers (touch, gamepad, etc.).
 */
export class KeyboardInputProvider implements InputProvider {
  private keys: Set<string> = new Set();
  private mouseX = 0;
  private mouseY = 0;
  private bindings: KeyBindings;
  private abort: AbortController;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    bindings?: Partial<KeyBindings>,
  ) {
    this.bindings = { ...DEFAULT_BINDINGS, ...bindings };
    this.abort = new AbortController();
    const signal = this.abort.signal;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    }, { signal });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    }, { signal });

    window.addEventListener('blur', () => {
      this.keys.clear();
    }, { signal });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }, { signal });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      this.camera.adjustZoom(dir * Config.CAMERA_ZOOM_STEP);
    }, { passive: false, signal } as AddEventListenerOptions);
  }

  isActionActive(action: Action): boolean {
    const codes = this.bindings[action];
    for (const code of codes) {
      if (this.keys.has(code)) return true;
    }
    return false;
  }

  getMovementVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isActionActive(Action.MOVE_UP))    y -= 1;
    if (this.isActionActive(Action.MOVE_DOWN))  y += 1;
    if (this.isActionActive(Action.MOVE_LEFT))  x -= 1;
    if (this.isActionActive(Action.MOVE_RIGHT)) x += 1;
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  getPointerPosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  /** Update a binding at runtime. */
  rebind(action: Action, codes: string[]): void {
    this.bindings[action] = codes;
  }

  dispose(): void {
    this.abort.abort();
  }
}
