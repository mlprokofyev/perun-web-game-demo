import { Config } from '../core/Config';
import { Camera } from '../rendering/Camera';
import { Action } from '../core/InputManager';
import type { InputProvider } from '../core/InputProvider';

const JOY_SIZE     = 130;
const JOY_THUMB    = 46;
const JOY_MARGIN   = 24;
const JOY_RUN_ZONE = 0.6;

const BTN_SIZE        = 56;
const BTN_SIZE_SMALL  = 44;
const BTN_MARGIN      = 16;
const BTN_GAP         = 10;

const MIN_HOLD_MS = 80;

interface ActionButton {
  action: Action;
  element: HTMLElement;
  touchId: number | null;
  releaseTimer: number | null;
}

/**
 * Touch input: virtual joystick (bottom-left), contextual action (bottom-right),
 * utility buttons (top corners), pinch-to-zoom.
 *
 * The overlay root is pointer-events:none so DOM UI (dialog, inventory, etc.)
 * is never blocked. Only individual control elements receive touch events.
 * Touch listeners are on `document` to capture the joystick zone without
 * stealing events from game UI.
 */
export class TouchInputProvider implements InputProvider {
  private joyVec = { x: 0, y: 0 };
  private joyRunning = false;
  private joyTouchId: number | null = null;
  private joyCenterX = 0;
  private joyCenterY = 0;

  private activeActions: Set<Action> = new Set();
  private buttons: ActionButton[] = [];

  private pinchDist: number | null = null;

  private lastPointerX = 0;
  private lastPointerY = 0;

  private overlay: HTMLElement;
  private joyBase: HTMLElement;
  private joyThumb: HTMLElement;
  private actionBtn: HTMLElement;
  private actionBtnData: ActionButton;

  private abort: AbortController;

  constructor(
    private container: HTMLElement,
    private camera: Camera,
  ) {
    this.abort = new AbortController();
    const signal = this.abort.signal;

    this.overlay = document.createElement('div');
    this.overlay.id = 'touch-overlay';
    Object.assign(this.overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '50',
      pointerEvents: 'none',
      touchAction: 'none',
    });
    container.appendChild(this.overlay);

    // ── Joystick (bottom-left) ───────────────────────────────
    this.joyBase = this.createJoystickBase();
    this.joyThumb = this.createJoystickThumb();
    this.joyBase.appendChild(this.joyThumb);
    this.overlay.appendChild(this.joyBase);

    // ── Bottom-right: contextual action (pill-shaped) ─────
    this.actionBtn = this.createActionButton(Action.INTERACT, '🤚', BTN_SIZE);
    Object.assign(this.actionBtn.style, {
      position: 'absolute',
      right: `${BTN_MARGIN}px`,
      bottom: `${BTN_MARGIN}px`,
      display: 'none',
      width: 'auto',
      height: 'auto',
      padding: '12px 20px',
      fontSize: '15px',
      borderRadius: '24px',
      gap: '8px',
      maxWidth: '200px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    this.actionBtnData = this.buttons[this.buttons.length - 1];
    this.overlay.appendChild(this.actionBtn);

    // ── Document-level touch listeners ───────────────────────
    document.addEventListener('touchstart', this.onTouchStart, { signal, passive: false });
    document.addEventListener('touchmove', this.onTouchMove, { signal, passive: false });
    document.addEventListener('touchend', this.onTouchEnd, { signal, passive: false });
    document.addEventListener('touchcancel', this.onTouchEnd, { signal, passive: false });
  }

  // ── InputProvider ──────────────────────────────────────────

  isActionActive(action: Action): boolean {
    if (action === Action.RUN) return this.joyRunning;
    return this.activeActions.has(action);
  }

  getMovementVector(): { x: number; y: number } {
    return this.joyVec;
  }

  getPointerPosition(): { x: number; y: number } {
    return { x: this.lastPointerX, y: this.lastPointerY };
  }

  dispose(): void {
    this.abort.abort();
    for (const btn of this.buttons) {
      if (btn.releaseTimer !== null) clearTimeout(btn.releaseTimer);
    }
    this.overlay.remove();
  }

  // ── Public API for contextual action button ────────────────

  /** Show/hide the action button and update its label. */
  setInteractVisible(visible: boolean, label?: string): void {
    this.actionBtn.style.display = visible ? 'flex' : 'none';
    if (label !== undefined) {
      this.actionBtn.innerHTML =
        `<span style="filter:brightness(0) invert(1)">🤚</span><span>${this.escapeHtml(label)}</span>`;
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Touch handlers ─────────────────────────────────────────

  private onTouchStart = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      this.lastPointerX = t.clientX;
      this.lastPointerY = t.clientY;

      if (this.handleButtonTouchStart(t)) {
        e.preventDefault();
        continue;
      }

      if (this.joyTouchId === null && t.clientX < window.innerWidth * 0.45) {
        const target = document.elementFromPoint(t.clientX, t.clientY);
        const isOnUI = target?.closest(
          '#dialog-container, #inventory-container, #questlog-container, ' +
          '#note-container, #item-preview-container, #controls-help-container, #back-to-hub',
        );
        if (isOnUI) continue;

        this.joyTouchId = t.identifier;
        const rect = this.joyBase.getBoundingClientRect();
        this.joyCenterX = rect.left + rect.width / 2;
        this.joyCenterY = rect.top + rect.height / 2;
        this.updateJoystick(t.clientX, t.clientY);
        e.preventDefault();
      }
    }

    if (e.touches.length === 2) {
      this.pinchDist = this.getTouchDistance(e.touches[0], e.touches[1]);
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (t.identifier === this.joyTouchId) {
        this.updateJoystick(t.clientX, t.clientY);
        e.preventDefault();
      }

      this.lastPointerX = t.clientX;
      this.lastPointerY = t.clientY;
    }

    if (e.touches.length === 2 && this.pinchDist !== null) {
      const newDist = this.getTouchDistance(e.touches[0], e.touches[1]);
      const delta = (newDist - this.pinchDist) * 0.005;
      this.camera.adjustZoom(delta);
      this.pinchDist = newDist;
      e.preventDefault();
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (t.identifier === this.joyTouchId) {
        this.resetJoystick();
      }

      this.handleButtonTouchEnd(t.identifier);
    }

    if (e.touches.length < 2) {
      this.pinchDist = null;
    }
  };

  // ── Joystick ───────────────────────────────────────────────

  private updateJoystick(cx: number, cy: number): void {
    const dx = cx - this.joyCenterX;
    const dy = cy - this.joyCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = JOY_SIZE / 2;
    const clampedDist = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * clampedDist;
    const ny = Math.sin(angle) * clampedDist;
    this.joyThumb.style.transform = `translate(${nx}px, ${ny}px)`;

    const mag = clampedDist / maxR;
    if (mag > 0.15) {
      this.joyVec = {
        x: Math.cos(angle) * Math.min(1, mag),
        y: Math.sin(angle) * Math.min(1, mag),
      };
    } else {
      this.joyVec = { x: 0, y: 0 };
    }

    const wasRunning = this.joyRunning;
    this.joyRunning = mag > JOY_RUN_ZONE;

    if (this.joyRunning && !wasRunning) {
      this.joyBase.style.borderColor = 'rgba(200, 170, 100, 0.5)';
    } else if (!this.joyRunning && wasRunning) {
      this.joyBase.style.borderColor = 'rgba(180, 160, 120, 0.25)';
    }

    this.joyThumb.style.background = this.joyRunning
      ? 'rgba(200, 170, 100, 0.65)'
      : 'rgba(200, 170, 100, 0.45)';
  }

  private resetJoystick(): void {
    this.joyTouchId = null;
    this.joyVec = { x: 0, y: 0 };
    this.joyRunning = false;
    this.joyThumb.style.transform = 'translate(0px, 0px)';
    this.joyThumb.style.background = 'rgba(200, 170, 100, 0.45)';
    this.joyBase.style.borderColor = 'rgba(180, 160, 120, 0.25)';
  }

  // ── Buttons (per-touch-ID tracking) ────────────────────────

  private handleButtonTouchStart(touch: Touch): boolean {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    for (const btn of this.buttons) {
      if (btn.element === el || btn.element.contains(el as Node)) {
        btn.touchId = touch.identifier;
        this.activeActions.add(btn.action);
        btn.element.style.transform = 'scale(0.9)';
        btn.element.style.opacity = '1';
        if (btn.releaseTimer !== null) {
          clearTimeout(btn.releaseTimer);
          btn.releaseTimer = null;
        }
        this.haptic();
        return true;
      }
    }
    return false;
  }

  private handleButtonTouchEnd(touchId: number): void {
    for (const btn of this.buttons) {
      if (btn.touchId !== touchId) continue;
      btn.touchId = null;
      btn.releaseTimer = window.setTimeout(() => {
        this.activeActions.delete(btn.action);
        btn.element.style.transform = '';
        btn.element.style.opacity = '';
        btn.releaseTimer = null;
      }, MIN_HOLD_MS);
    }
  }

  // ── DOM helpers ────────────────────────────────────────────

  private createJoystickBase(): HTMLElement {
    const base = document.createElement('div');
    Object.assign(base.style, {
      position: 'absolute',
      left: `${JOY_MARGIN}px`,
      bottom: `${JOY_MARGIN}px`,
      width: `${JOY_SIZE}px`,
      height: `${JOY_SIZE}px`,
      borderRadius: '50%',
      background: 'rgba(20, 18, 14, 0.35)',
      border: '2px solid rgba(180, 160, 120, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'auto',
      touchAction: 'none',
      transition: 'border-color 0.15s',
    });
    return base;
  }

  private createJoystickThumb(): HTMLElement {
    const thumb = document.createElement('div');
    Object.assign(thumb.style, {
      width: `${JOY_THUMB}px`,
      height: `${JOY_THUMB}px`,
      borderRadius: '50%',
      background: 'rgba(200, 170, 100, 0.45)',
      border: '2px solid rgba(200, 170, 100, 0.5)',
      transition: 'background 0.1s',
      pointerEvents: 'none',
    });
    return thumb;
  }

  private createActionButton(action: Action, label: string, size: number): HTMLElement {
    const btn = document.createElement('div');
    Object.assign(btn.style, {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '12px',
      background: 'rgba(20, 18, 14, 0.45)',
      border: '2px solid rgba(180, 160, 120, 0.3)',
      color: '#d0c8a0',
      fontFamily: 'monospace',
      fontSize: size > 44 ? '20px' : '16px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'auto',
      touchAction: 'none',
      userSelect: 'none',
      transition: 'transform 0.08s, opacity 0.08s',
      opacity: '0.8',
    } as Partial<CSSStyleDeclaration>);
    btn.textContent = label;

    this.buttons.push({ action, element: btn, touchId: null, releaseTimer: null });
    return btn;
  }

  private getTouchDistance(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private haptic(): void {
    navigator.vibrate?.(12);
  }
}
