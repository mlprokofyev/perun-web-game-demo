import type { Entity } from '../entities/Entity';
import { eventBus } from './EventBus';

/**
 * Central registry for all game entities.
 * Provides add/remove/query operations so systems don't need hand-managed arrays.
 */
export class EntityManager {
  private entities: Map<string, Entity> = new Map();

  /** Register an entity. Replaces any existing entity with the same id. */
  add(entity: Entity): void {
    this.entities.set(entity.id, entity);
    eventBus.emit('entity:added', { entity });
  }

  /** Remove an entity by id. Returns true if it existed. */
  remove(id: string): boolean {
    const existed = this.entities.delete(id);
    if (existed) {
      eventBus.emit('entity:removed', { entityId: id });
    }
    return existed;
  }

  /** Get a specific entity by id, or undefined. */
  get(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /** Check if an entity with the given id exists. */
  has(id: string): boolean {
    return this.entities.has(id);
  }

  /** Return all entities as an array (stable snapshot). */
  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  /** Return entities whose id starts with the given prefix. */
  getByPrefix(prefix: string): Entity[] {
    const result: Entity[] = [];
    for (const [id, entity] of this.entities) {
      if (id.startsWith(prefix)) result.push(entity);
    }
    return result;
  }

  /** Return entities within a given grid radius of (x, y). */
  getInRadius(x: number, y: number, radius: number): Entity[] {
    const r2 = radius * radius;
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      const dx = entity.transform.x - x;
      const dy = entity.transform.y - y;
      if (dx * dx + dy * dy <= r2) result.push(entity);
    }
    return result;
  }

  /** Total number of entities. */
  get count(): number {
    return this.entities.size;
  }

  /** Remove all entities. */
  clear(): void {
    this.entities.clear();
  }
}
