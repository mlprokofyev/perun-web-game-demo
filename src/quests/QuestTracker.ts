import { getQuestDef, getAllQuestDefs, type QuestDef } from './QuestDef';
import { eventBus } from '../core/EventBus';
import { gameFlags } from '../core/GameFlags';
import { inventory } from '../items/Inventory';

// ─── Quest runtime state ────────────────────────────────────────

export type QuestStatus = 'not_started' | 'active' | 'completed' | 'failed';

export interface QuestState {
  questId: string;
  status: QuestStatus;
  /** Per-objective progress (current count). Same length as QuestDef.objectives. */
  progress: number[];
}

/**
 * Tracks quest progress at runtime.
 * Listens to EventBus events to auto-advance objectives.
 * Singleton — call questTracker.init() once after EventBus and registries are ready.
 */
export class QuestTracker {
  private quests: Map<string, QuestState> = new Map();
  private initialized = false;

  /** Call once to start listening to game events. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Auto-advance 'collect' objectives when items are collected
    eventBus.on('item:collected', ({ itemId }) => {
      this.advanceObjectives('collect', itemId);
    });

    // Auto-advance 'talk' objectives when dialogs open
    eventBus.on('dialog:open', ({ dialogId }) => {
      this.advanceObjectives('talk', dialogId);
    });

    // Auto-advance 'reach' objectives when trigger zones are entered
    eventBus.on('trigger:enter', ({ zoneId }) => {
      this.advanceObjectives('reach', zoneId);
    });

    // Auto-advance 'flag' objectives when flags are checked (poll on dialog:choice)
    eventBus.on('dialog:choice', () => {
      this.checkFlagObjectives();
    });
  }

  // ─── Quest lifecycle ──────────────────────────────────────

  /** Start a quest (set to active). No-op if already started or completed. */
  start(questId: string): boolean {
    const def = getQuestDef(questId);
    if (!def) return false;

    const existing = this.quests.get(questId);
    if (existing && existing.status !== 'not_started') return false;

    // Check prerequisite
    if (def.prerequisite) {
      const pre = this.quests.get(def.prerequisite);
      if (!pre || pre.status !== 'completed') return false;
    }

    const state: QuestState = {
      questId,
      status: 'active',
      progress: def.objectives.map(() => 0),
    };
    this.quests.set(questId, state);
    eventBus.emit('quest:started', { questId });
    return true;
  }

  /** Get the runtime state for a quest. */
  getState(questId: string): QuestState | undefined {
    return this.quests.get(questId);
  }

  /** Get status (returns 'not_started' for unknown quests). */
  getStatus(questId: string): QuestStatus {
    return this.quests.get(questId)?.status ?? 'not_started';
  }

  /** Is the quest currently active? */
  isActive(questId: string): boolean {
    return this.getStatus(questId) === 'active';
  }

  /** Is the quest completed? */
  isCompleted(questId: string): boolean {
    return this.getStatus(questId) === 'completed';
  }

  /** Get all active quest states. */
  getActiveQuests(): QuestState[] {
    return Array.from(this.quests.values()).filter(q => q.status === 'active');
  }

  /** Get all completed quest states. */
  getCompletedQuests(): QuestState[] {
    return Array.from(this.quests.values()).filter(q => q.status === 'completed');
  }

  /** Get all quest states. */
  getAllStates(): QuestState[] {
    return Array.from(this.quests.values());
  }

  /** Manually trigger a re-check of all 'flag' type objectives against current GameFlags.
   *  Call this after setting a flag that should advance a quest (e.g. 'sticks_in_fire'). */
  checkFlags(): void {
    this.checkFlagObjectives();
  }

  // ─── Objective advancement ────────────────────────────────

  /** Advance matching objectives in all active quests. */
  private advanceObjectives(type: string, target: string): void {
    for (const state of this.quests.values()) {
      if (state.status !== 'active') continue;

      const def = getQuestDef(state.questId);
      if (!def) continue;

      for (let i = 0; i < def.objectives.length; i++) {
        const obj = def.objectives[i];
        if (obj.type !== type || obj.target !== target) continue;
        if (state.progress[i] >= obj.required) continue;

        // For 'collect', check actual inventory count
        if (type === 'collect') {
          state.progress[i] = inventory.count(target);
        } else {
          state.progress[i] = Math.min(state.progress[i] + 1, obj.required);
        }

        if (state.progress[i] >= obj.required) {
          eventBus.emit('quest:objective_complete', { questId: state.questId, objectiveIndex: i });
        }
      }

      this.checkQuestCompletion(state, def);
    }
  }

  /** Check 'flag' type objectives against current GameFlags. */
  private checkFlagObjectives(): void {
    for (const state of this.quests.values()) {
      if (state.status !== 'active') continue;

      const def = getQuestDef(state.questId);
      if (!def) continue;

      for (let i = 0; i < def.objectives.length; i++) {
        const obj = def.objectives[i];
        if (obj.type !== 'flag') continue;
        state.progress[i] = gameFlags.getBool(obj.target) ? 1 : 0;

        if (state.progress[i] >= obj.required) {
          eventBus.emit('quest:objective_complete', { questId: state.questId, objectiveIndex: i });
        }
      }

      this.checkQuestCompletion(state, def);
    }
  }

  /** Check if all objectives are met → complete the quest. */
  private checkQuestCompletion(state: QuestState, def: QuestDef): void {
    if (state.status !== 'active') return;

    const allDone = def.objectives.every((obj, i) => state.progress[i] >= obj.required);
    if (!allDone) return;

    state.status = 'completed';

    // Set completion flag in GameFlags
    if (def.completionFlag) {
      gameFlags.set(def.completionFlag, true);
    }

    eventBus.emit('quest:complete', { questId: state.questId });
  }

  // ─── Serialization ────────────────────────────────────────

  toJSON(): Record<string, { status: QuestStatus; progress: number[] }> {
    const obj: Record<string, { status: QuestStatus; progress: number[] }> = {};
    for (const [k, v] of this.quests) {
      obj[k] = { status: v.status, progress: v.progress };
    }
    return obj;
  }

  fromJSON(data: Record<string, { status: QuestStatus; progress: number[] }>): void {
    for (const key of Object.keys(data)) {
      const d = data[key];
      this.quests.set(key, { questId: key, status: d.status, progress: d.progress });
    }
  }
}

/** Singleton quest tracker. */
export const questTracker = new QuestTracker();
