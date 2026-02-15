import { questTracker } from '../quests/QuestTracker';
import { getQuestDef } from '../quests/QuestDef';

/**
 * HTML overlay for the quest log.
 * Shows active and completed quests with objective progress.
 * Toggle with J key.
 */
export class QuestLogUI {
  private container: HTMLElement;
  private contentEl: HTMLElement;

  constructor() {
    let container = document.getElementById('questlog-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'questlog-container';
      container.innerHTML = `
        <div class="questlog-box">
          <div class="questlog-title">QUEST LOG</div>
          <div class="questlog-content"></div>
          <div class="questlog-hint"><span class="key">J</span> close</div>
        </div>
      `;
      document.getElementById('game-container')!.appendChild(container);
    }
    this.container = container;
    this.contentEl = container.querySelector('.questlog-content')!;
  }

  show(): void {
    this.refresh();
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  get visible(): boolean {
    return this.container.style.display !== 'none';
  }

  /** Rebuild quest list from current tracker state. */
  refresh(): void {
    this.contentEl.innerHTML = '';

    const active = questTracker.getActiveQuests();
    const completed = questTracker.getCompletedQuests();

    if (active.length === 0 && completed.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'questlog-empty';
      empty.textContent = 'No quests yet.';
      this.contentEl.appendChild(empty);
      return;
    }

    // Active quests
    if (active.length > 0) {
      const header = document.createElement('div');
      header.className = 'questlog-section';
      header.textContent = '— Active —';
      this.contentEl.appendChild(header);

      for (const state of active) {
        this.contentEl.appendChild(this.renderQuest(state.questId, false));
      }
    }

    // Completed quests
    if (completed.length > 0) {
      const header = document.createElement('div');
      header.className = 'questlog-section';
      header.textContent = '— Completed —';
      this.contentEl.appendChild(header);

      for (const state of completed) {
        this.contentEl.appendChild(this.renderQuest(state.questId, true));
      }
    }
  }

  private renderQuest(questId: string, isCompleted: boolean): HTMLElement {
    const def = getQuestDef(questId);
    const state = questTracker.getState(questId);
    const el = document.createElement('div');
    el.className = `questlog-quest ${isCompleted ? 'completed' : ''}`;

    const title = document.createElement('div');
    title.className = 'questlog-quest-title';
    title.textContent = (isCompleted ? '✓ ' : '▸ ') + (def?.title ?? questId);
    el.appendChild(title);

    if (def && state) {
      for (let i = 0; i < def.objectives.length; i++) {
        const obj = def.objectives[i];
        const progress = state.progress[i] ?? 0;
        const done = progress >= obj.required;

        const objEl = document.createElement('div');
        objEl.className = `questlog-objective ${done ? 'done' : ''}`;
        objEl.textContent = `  ${done ? '✓' : '○'} ${obj.description}`;
        if (obj.required > 1) {
          objEl.textContent += ` (${Math.min(progress, obj.required)}/${obj.required})`;
        }
        el.appendChild(objEl);
      }
    }

    return el;
  }
}
