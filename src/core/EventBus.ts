import type { Entity } from '../entities/Entity';

// ─── Event definitions ──────────────────────────────────────────
// Add new events here as the game grows.

export interface GameEvents {
  /** An entity was added to the EntityManager */
  'entity:added': { entity: Entity };
  /** An entity was removed from the EntityManager */
  'entity:removed': { entityId: string };
  /** The player's grid position changed */
  'player:moved': { x: number; y: number };
  /** An entity entered a trigger zone */
  'trigger:enter': { zoneId: string; entityId: string };
  /** An entity exited a trigger zone */
  'trigger:exit': { zoneId: string; entityId: string };
  /** An interaction started with a target entity */
  'interaction:start': { targetId: string };
  /** An interaction ended */
  'interaction:end': { targetId: string };
  /** A dialog was opened */
  'dialog:open': { dialogId: string; npcId: string };
  /** A dialog choice was made */
  'dialog:choice': { dialogId: string; choiceIndex: number };
  /** A dialog was closed */
  'dialog:close': { dialogId: string };
  /** An item was collected */
  'item:collected': { itemId: string; entityId: string };
  /** The inventory changed */
  'inventory:changed': { items: string[] };
  /** A scene transition was requested */
  'scene:transition': { from: string; to: string };
  /** An input action was pressed or released */
  'input:action': { action: string; state: 'pressed' | 'released' };
}

// ─── Typed EventBus ─────────────────────────────────────────────

type Listener<T> = (payload: T) => void;

/** Typed pub/sub event bus — all event names and payloads are compile-time checked. */
export class EventBus {
  private listeners: Map<string, Set<Listener<any>>> = new Map();

  /** Subscribe to a typed event. */
  on<K extends keyof GameEvents>(event: K, fn: Listener<GameEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  /** Unsubscribe from a typed event. */
  off<K extends keyof GameEvents>(event: K, fn: Listener<GameEvents[K]>): void {
    this.listeners.get(event)?.delete(fn);
  }

  /** Emit a typed event with its payload. */
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(payload));
  }

  /** Remove all listeners. */
  clear(): void {
    this.listeners.clear();
  }
}

/** Singleton event bus for global game events */
export const eventBus = new EventBus();
