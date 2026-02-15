import { Entity } from './Entity';
import { eventBus } from '../core/EventBus';

export interface TriggerZoneOptions {
  /** Grid position */
  col: number;
  row: number;
  /** Trigger radius in grid units */
  radius: number;
  /** If true, fires only once then deactivates. */
  oneShot?: boolean;
  /** Optional callback when the zone is entered. */
  onEnter?: (entityId: string) => void;
  /** Optional callback when the zone is exited. */
  onExit?: (entityId: string) => void;
}

/**
 * Invisible zone that fires events when entities enter/exit its radius.
 * Used for item pickup areas, area-based quest objectives, cutscene triggers.
 */
export class TriggerZone extends Entity {
  readonly radius: number;
  readonly oneShot: boolean;
  private onEnterCb?: (entityId: string) => void;
  private onExitCb?: (entityId: string) => void;

  /** Tracks which entity ids are currently inside the zone. */
  private inside: Set<string> = new Set();

  /** Whether this zone is still active (oneShot zones deactivate after first trigger). */
  active: boolean = true;

  constructor(id: string, opts: TriggerZoneOptions) {
    super(id);
    this.layer = 'ground';
    this.solid = false;
    this.opacity = 0; // invisible
    this.transform.set(opts.col, opts.row);
    this.radius = opts.radius;
    this.oneShot = opts.oneShot ?? false;
    this.onEnterCb = opts.onEnter;
    this.onExitCb = opts.onExit;
  }

  /**
   * Call every frame with a list of entity ids + positions to check.
   * Fires trigger:enter / trigger:exit events as appropriate.
   */
  check(entities: Array<{ id: string; x: number; y: number }>): void {
    if (!this.active) return;

    const zx = this.transform.x;
    const zy = this.transform.y;
    const r2 = this.radius * this.radius;
    const nowInside = new Set<string>();

    for (const e of entities) {
      const dx = e.x - zx;
      const dy = e.y - zy;
      if (dx * dx + dy * dy <= r2) {
        nowInside.add(e.id);
      }
    }

    // Enter events
    for (const eid of nowInside) {
      if (!this.inside.has(eid)) {
        eventBus.emit('trigger:enter', { zoneId: this.id, entityId: eid });
        this.onEnterCb?.(eid);

        if (this.oneShot) {
          this.active = false;
          return;
        }
      }
    }

    // Exit events
    for (const eid of this.inside) {
      if (!nowInside.has(eid)) {
        eventBus.emit('trigger:exit', { zoneId: this.id, entityId: eid });
        this.onExitCb?.(eid);
      }
    }

    this.inside = nowInside;
  }

  /** Manually deactivate this zone. */
  deactivate(): void {
    this.active = false;
    this.inside.clear();
  }

  /** Reset a one-shot zone so it can fire again. */
  reset(): void {
    this.active = true;
    this.inside.clear();
  }
}
