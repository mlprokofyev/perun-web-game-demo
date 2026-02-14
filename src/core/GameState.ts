/**
 * Abstract base for game states.
 * Each state can handle its own update/render cycle.
 *
 * The state stack works as follows:
 * - The topmost state receives update() and render() calls.
 * - If `isTransparent` is true, the state below is also rendered (for overlays).
 * - If `blocksUpdate` is true, states below are NOT updated (for pause/dialog).
 */
export abstract class GameState {
  /** If true, the state below will also be rendered (useful for overlays). */
  readonly isTransparent: boolean = false;

  /** If true, states below will NOT receive update() calls. */
  readonly blocksUpdate: boolean = false;

  /** Called when this state is pushed onto the stack. */
  onEnter(): void {}

  /** Called when this state is popped from the stack. */
  onExit(): void {}

  /** Called when a state above this one is pushed (this state is "paused"). */
  onPause(): void {}

  /** Called when a state above this one is popped (this state resumes). */
  onResume(): void {}

  /** Update game logic. dt = seconds since last frame. */
  abstract update(dt: number): void;

  /** Render. dt = seconds since last frame (for animation interpolation). */
  abstract render(dt: number): void;
}

/**
 * Manages a stack of GameStates.
 * The topmost state drives the frame. States can be pushed/popped
 * to implement dialogs, pause, inventory overlays, etc.
 */
export class GameStateManager {
  private stack: GameState[] = [];

  /** Push a new state onto the stack. */
  push(state: GameState): void {
    const current = this.peek();
    current?.onPause();
    this.stack.push(state);
    state.onEnter();
  }

  /** Pop the topmost state. Returns the popped state or undefined. */
  pop(): GameState | undefined {
    const removed = this.stack.pop();
    removed?.onExit();
    const current = this.peek();
    current?.onResume();
    return removed;
  }

  /** Replace the topmost state with a new one. */
  replace(state: GameState): void {
    const removed = this.stack.pop();
    removed?.onExit();
    this.stack.push(state);
    state.onEnter();
  }

  /** Get the topmost state (without removing it). */
  peek(): GameState | undefined {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
  }

  /** Number of states on the stack. */
  get size(): number {
    return this.stack.length;
  }

  /**
   * Process the stack for one frame.
   * Walks down the stack to find which states should update/render.
   */
  update(dt: number): void {
    // Find the first state that blocks update (from top)
    let updateFrom = this.stack.length - 1;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      updateFrom = i;
      if (this.stack[i].blocksUpdate) break;
    }
    // Update from the blocking point up to the top
    for (let i = updateFrom; i < this.stack.length; i++) {
      this.stack[i].update(dt);
    }
  }

  render(dt: number): void {
    // Find the first non-transparent state (from top), render from there up
    let renderFrom = this.stack.length - 1;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      renderFrom = i;
      if (!this.stack[i].isTransparent) break;
    }
    for (let i = renderFrom; i < this.stack.length; i++) {
      this.stack[i].render(dt);
    }
  }
}
