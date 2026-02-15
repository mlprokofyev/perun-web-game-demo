/**
 * Global game state variables — persistent key/value store.
 * Used by quests, dialog conditions, triggers, and save/load.
 *
 * Values can be any JSON-serializable type (boolean, number, string).
 * Prefer typed helper methods (getBool, getNumber) over raw get().
 */
export class GameFlags {
  private flags: Map<string, unknown> = new Map();

  // ─── Typed getters ─────────────────────────────────────────

  /** Get a raw value, or undefined if not set. */
  get(key: string): unknown {
    return this.flags.get(key);
  }

  /** Get a boolean flag (defaults to false). */
  getBool(key: string): boolean {
    return this.flags.get(key) === true;
  }

  /** Get a numeric flag (defaults to 0). */
  getNumber(key: string): number {
    const v = this.flags.get(key);
    return typeof v === 'number' ? v : 0;
  }

  /** Get a string flag (defaults to ''). */
  getString(key: string): string {
    const v = this.flags.get(key);
    return typeof v === 'string' ? v : '';
  }

  // ─── Setters ───────────────────────────────────────────────

  set(key: string, value: unknown): void {
    this.flags.set(key, value);
  }

  /** Toggle a boolean flag (false → true, truthy → false). */
  toggle(key: string): boolean {
    const next = !this.getBool(key);
    this.flags.set(key, next);
    return next;
  }

  /** Increment a numeric flag by delta (defaults to +1). */
  increment(key: string, delta: number = 1): number {
    const next = this.getNumber(key) + delta;
    this.flags.set(key, next);
    return next;
  }

  /** Check if a key exists at all. */
  has(key: string): boolean {
    return this.flags.has(key);
  }

  /** Delete a single flag. */
  delete(key: string): void {
    this.flags.delete(key);
  }

  /** Remove all flags. */
  clear(): void {
    this.flags.clear();
  }

  // ─── Serialization ─────────────────────────────────────────

  /** Serialize to a plain object (for JSON.stringify / localStorage). */
  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of this.flags) {
      obj[k] = v;
    }
    return obj;
  }

  /** Restore from a plain object. Merges with existing flags. */
  fromJSON(data: Record<string, unknown>): void {
    for (const key of Object.keys(data)) {
      this.flags.set(key, data[key]);
    }
  }
}

/** Singleton game flags instance. */
export const gameFlags = new GameFlags();
