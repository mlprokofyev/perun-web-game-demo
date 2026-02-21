import type { Action } from './InputManager';

/**
 * Abstract input source. Implementations provide platform-specific
 * input capture (keyboard, touch, gamepad) behind a unified API.
 * InputManager aggregates one or more providers.
 */
export interface InputProvider {
  /** Is the given semantic action currently active (held / pressed)? */
  isActionActive(action: Action): boolean;

  /**
   * Returns true if the action was pressed since the last consume call,
   * and clears the flag. Use for one-shot actions (interact, toggle)
   * instead of polling isActionActive with manual edge detection.
   */
  consumeAction(action: Action): boolean;

  /** Normalized movement vector (each axis –1 … +1, magnitude ≤ 1). */
  getMovementVector(): { x: number; y: number };

  /** Current pointer / touch screen position (pixels). */
  getPointerPosition(): { x: number; y: number };

  /** Release event listeners and remove any DOM elements. */
  dispose(): void;
}
