import { getItemDef } from './ItemDef';
import { eventBus } from '../core/EventBus';

/** A single inventory slot: item id + current count. */
export interface InventorySlot {
  itemId: string;
  count: number;
}

/**
 * Player inventory — manages collected items.
 * Emits 'inventory:changed' on every mutation.
 * Emits 'item:collected' when an item is added.
 */
export class Inventory {
  private slots: Map<string, number> = new Map();
  private maxSlots: number;

  constructor(maxSlots: number = 20) {
    this.maxSlots = maxSlots;
  }

  /**
   * Add items. Returns the number actually added (may be less if stack/slot limits hit).
   * entityId is the source entity id (for the item:collected event).
   */
  add(itemId: string, count: number = 1, entityId: string = ''): number {
    const def = getItemDef(itemId);
    if (!def) return 0;

    const current = this.slots.get(itemId) ?? 0;

    if (current === 0 && this.slots.size >= this.maxSlots) {
      // No room for a new item type
      return 0;
    }

    const maxAdd = def.stackable ? def.maxStack - current : (current === 0 ? 1 : 0);
    const added = Math.min(count, Math.max(0, maxAdd));
    if (added <= 0) return 0;

    this.slots.set(itemId, current + added);

    eventBus.emit('item:collected', { itemId, entityId });
    this.emitChanged();

    return added;
  }

  /**
   * Remove items. Returns the number actually removed.
   */
  remove(itemId: string, count: number = 1): number {
    const current = this.slots.get(itemId) ?? 0;
    const removed = Math.min(count, current);
    if (removed <= 0) return 0;

    const next = current - removed;
    if (next <= 0) {
      this.slots.delete(itemId);
    } else {
      this.slots.set(itemId, next);
    }

    this.emitChanged();
    return removed;
  }

  /** Check if the player has at least `count` of an item. */
  has(itemId: string, count: number = 1): boolean {
    return (this.slots.get(itemId) ?? 0) >= count;
  }

  /** Get the count of an item. */
  count(itemId: string): number {
    return this.slots.get(itemId) ?? 0;
  }

  /** Get all non-empty slots. */
  getSlots(): InventorySlot[] {
    const result: InventorySlot[] = [];
    for (const [itemId, count] of this.slots) {
      result.push({ itemId, count });
    }
    return result;
  }

  /** Get a flat list of all item ids (for event payload). */
  getItemIds(): string[] {
    const result: string[] = [];
    for (const [itemId, count] of this.slots) {
      for (let i = 0; i < count; i++) result.push(itemId);
    }
    return result;
  }

  /** Total number of distinct item types held. */
  get slotCount(): number {
    return this.slots.size;
  }

  /** Whether inventory is full (no new item types can be added). */
  get isFull(): boolean {
    return this.slots.size >= this.maxSlots;
  }

  /** Clear all items. */
  clear(): void {
    this.slots.clear();
    this.emitChanged();
  }

  // ─── Serialization ─────────────────────────────────────────

  toJSON(): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [k, v] of this.slots) obj[k] = v;
    return obj;
  }

  fromJSON(data: Record<string, number>): void {
    this.slots.clear();
    for (const key of Object.keys(data)) {
      this.slots.set(key, data[key]);
    }
    this.emitChanged();
  }

  // ─── Internal ──────────────────────────────────────────────

  private emitChanged(): void {
    eventBus.emit('inventory:changed', { items: this.getItemIds() });
  }
}

/** Singleton player inventory. */
export const inventory = new Inventory();
