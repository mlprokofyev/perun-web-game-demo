import type { InputProvider } from './InputProvider';

/** Named game actions — decouple game logic from raw keycodes. */
export enum Action {
  MOVE_UP         = 'MOVE_UP',
  MOVE_DOWN       = 'MOVE_DOWN',
  MOVE_LEFT       = 'MOVE_LEFT',
  MOVE_RIGHT      = 'MOVE_RIGHT',
  RUN             = 'RUN',
  INTERACT        = 'INTERACT',
  TOGGLE_LIGHT    = 'TOGGLE_LIGHT',
  TOGGLE_SNOW     = 'TOGGLE_SNOW',
  TOGGLE_TIME     = 'TOGGLE_TIME',
  INVENTORY       = 'INVENTORY',
  QUEST_LOG       = 'QUEST_LOG',
  DEBUG_GRID      = 'DEBUG_GRID',
  PAUSE           = 'PAUSE',
  CONTROLS_HELP   = 'CONTROLS_HELP',
  TOGGLE_DEBUG    = 'TOGGLE_DEBUG',
  TOGGLE_QUEST_HUD = 'TOGGLE_QUEST_HUD',
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
  [Action.INVENTORY]:    ['KeyI'],
  [Action.QUEST_LOG]:    ['KeyJ'],
  [Action.DEBUG_GRID]:      ['KeyG'],
  [Action.PAUSE]:           ['Escape'],
  [Action.CONTROLS_HELP]:   ['KeyH'],
  [Action.TOGGLE_DEBUG]:    ['KeyU'],
  [Action.TOGGLE_QUEST_HUD]: ['KeyQ'],
};

/**
 * Aggregates one or more InputProviders behind a single API.
 * All game code queries InputManager — never raw providers.
 */
export class InputManager {
  private providers: InputProvider[];

  constructor(providers: InputProvider[]) {
    this.providers = providers;
  }

  /** Is the given action currently held down (any provider)? */
  isActionDown(action: Action): boolean {
    for (const p of this.providers) {
      if (p.isActionActive(action)) return true;
    }
    return false;
  }

  /** Normalized movement vector — takes the provider with the largest magnitude. */
  getMovementVector(): { x: number; y: number } {
    let best = { x: 0, y: 0 };
    let bestLen = 0;
    for (const p of this.providers) {
      const v = p.getMovementVector();
      const len = v.x * v.x + v.y * v.y;
      if (len > bestLen) {
        best = v;
        bestLen = len;
      }
    }
    return best;
  }

  /** Is the player trying to run (any provider)? */
  isRunning(): boolean {
    return this.isActionDown(Action.RUN);
  }

  /** Pointer position from the first provider that has one. */
  getMouseScreen(): { x: number; y: number } {
    for (const p of this.providers) {
      const pos = p.getPointerPosition();
      if (pos.x !== 0 || pos.y !== 0) return pos;
    }
    return { x: 0, y: 0 };
  }

  /** Dispose all providers. */
  dispose(): void {
    for (const p of this.providers) {
      p.dispose();
    }
  }
}
