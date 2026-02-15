import { InputSystem } from '../systems/InputSystem';

/** Named game actions — decouple game logic from raw keycodes. */
export enum Action {
  MOVE_UP      = 'MOVE_UP',
  MOVE_DOWN    = 'MOVE_DOWN',
  MOVE_LEFT    = 'MOVE_LEFT',
  MOVE_RIGHT   = 'MOVE_RIGHT',
  RUN          = 'RUN',
  INTERACT     = 'INTERACT',
  TOGGLE_LIGHT = 'TOGGLE_LIGHT',
  TOGGLE_SNOW  = 'TOGGLE_SNOW',
  TOGGLE_TIME  = 'TOGGLE_TIME',
  DEBUG_GRID   = 'DEBUG_GRID',
  PAUSE        = 'PAUSE',
}

/** A binding maps an Action to one or more keyboard codes. */
export type KeyBindings = Record<Action, string[]>;

/** Default key bindings (WASD + arrows). */
export const DEFAULT_BINDINGS: KeyBindings = {
  [Action.MOVE_UP]:      ['KeyW', 'ArrowUp'],
  [Action.MOVE_DOWN]:    ['KeyS', 'ArrowDown'],
  [Action.MOVE_LEFT]:    ['KeyA', 'ArrowLeft'],
  [Action.MOVE_RIGHT]:   ['KeyD', 'ArrowRight'],
  [Action.RUN]:          ['ShiftLeft', 'ShiftRight'],
  [Action.INTERACT]:     ['KeyE'],
  [Action.TOGGLE_LIGHT]: ['KeyL'],
  [Action.TOGGLE_SNOW]:  ['KeyN'],
  [Action.TOGGLE_TIME]:  ['KeyT'],
  [Action.DEBUG_GRID]:   ['KeyG'],
  [Action.PAUSE]:        ['Escape'],
};

/**
 * Thin abstraction over InputSystem that maps raw key codes to named actions.
 * Game code should query InputManager instead of raw key codes.
 */
export class InputManager {
  private bindings: KeyBindings;

  constructor(
    private input: InputSystem,
    bindings?: Partial<KeyBindings>,
  ) {
    this.bindings = { ...DEFAULT_BINDINGS, ...bindings };
  }

  /** Is the given action currently held down? */
  isActionDown(action: Action): boolean {
    const codes = this.bindings[action];
    for (const code of codes) {
      if (this.input.isDown(code)) return true;
    }
    return false;
  }

  /** Normalized movement vector derived from MOVE_* actions. */
  getMovementVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isActionDown(Action.MOVE_UP))    y -= 1;
    if (this.isActionDown(Action.MOVE_DOWN))  y += 1;
    if (this.isActionDown(Action.MOVE_LEFT))  x -= 1;
    if (this.isActionDown(Action.MOVE_RIGHT)) x += 1;
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  /** Is the player trying to run? */
  isRunning(): boolean {
    return this.isActionDown(Action.RUN);
  }

  /** Passthrough: get raw mouse screen position. */
  getMouseScreen(): { x: number; y: number } {
    return this.input.getMouseScreen();
  }

  /** Rebind an action at runtime. */
  rebind(action: Action, codes: string[]): void {
    this.bindings[action] = codes;
  }
}
