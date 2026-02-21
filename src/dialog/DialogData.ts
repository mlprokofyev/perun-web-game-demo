import type { GameFlags } from '../core/GameFlags';

// ─── Dialog tree data model ────────────────────────────────────

/** A single selectable response the player can pick. */
export interface DialogChoice {
  text: string;
  /** Id of the next node, or null to end the conversation. */
  nextNodeId: string | null;
  /** Optional: choice is only shown when this returns true. */
  condition?: (flags: GameFlags) => boolean;
  /** Optional: executed when the player picks this choice (before advancing). */
  onSelect?: (flags: GameFlags) => void;
  /** Optional tag displayed as a colored badge before the text (e.g. 'quest', 'action', 'new'). */
  tag?: 'quest' | 'action' | 'new';
}

/** One "beat" in a conversation — the NPC speaks, then the player chooses. */
export interface DialogNode {
  speaker: string;
  text: string;
  choices: DialogChoice[];
}

/** A complete conversation tree. */
export interface DialogTree {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogNode>;
}

// ─── Registry ──────────────────────────────────────────────────

const DIALOG_REGISTRY: Record<string, DialogTree> = {};

/** Look up a dialog tree by id. */
export function getDialogTree(id: string): DialogTree | undefined {
  return DIALOG_REGISTRY[id];
}

/** Register a dialog tree so it can be retrieved by id later. */
export function registerDialog(tree: DialogTree): void {
  DIALOG_REGISTRY[tree.id] = tree;
}

// ─── Sample: dog greeting (quest-integrated) ───────────────────

import { inventory } from '../items/Inventory';
import { questTracker } from '../quests/QuestTracker';
import { eventBus } from '../core/EventBus';

export const DOG_DIALOG: DialogTree = {
  id: 'dog_greeting',
  startNodeId: 'start',
  nodes: {
    start: {
      speaker: 'Пёс',
      text: '*виляет хвостом и смотрит на тебя большими тёплыми глазами*',
      choices: [
        {
          text: 'Где ты пропадал? Я начал переживать!',
          nextNodeId: 'lost',
          condition: () => !questTracker.isActive('q_dog_bone') && !questTracker.isCompleted('q_dog_bone'),
        },
        {
          text: 'Вот, погрызи!',
          nextNodeId: 'give_bone',
          tag: 'quest',
          condition: () => inventory.has('bone') && questTracker.isActive('q_dog_bone'),
          onSelect: (flags) => {
            inventory.remove('bone', inventory.count('bone'));
            flags.set('dog_fed', true);
          },
        },
        {
          text: 'Ждёшь? Скоро найду, потерпи.',
          nextNodeId: null,
          condition: () => questTracker.isActive('q_dog_bone') && !inventory.has('bone'),
        },
        {
          text: '(Пёс выглядит довольным.)',
          nextNodeId: 'end_happy_quest',
          condition: (flags) => flags.getBool('dog_fed'),
        },
        {
          text: 'Опять ты! Кыш, проваливай!',
          nextNodeId: 'shoo',
          condition: () => !questTracker.isActive('q_dog_bone') && !questTracker.isCompleted('q_dog_bone'),
        },
      ],
    },
    lost: {
      speaker: 'Пёс',
      text: '*наклоняет голову и тихонько ворчит, потом тычется носом в твою руку*',
      choices: [
        {
          text: 'Ну, хорошо. Найду тебе что-нибудь.',
          nextNodeId: 'quest_accept',
          condition: (flags) => !flags.getBool('quest_dog_bone_done') && !questTracker.isActive('q_dog_bone'),
          onSelect: (_flags) => {
            questTracker.start('q_dog_bone');
            eventBus.emit('dialog:open', { dialogId: 'dog_greeting', npcId: 'dog' });
          },
        }
      ],
    },
    quest_accept: {
      speaker: 'Пёс',
      text: '*оживляется и принюхивается с надеждой, хвост виляет быстрее*',
      choices: [
        { text: '[Уйти]', nextNodeId: null },
      ],
    },
    waiting: {
      speaker: 'Пёс',
      text: '*нетерпеливо принюхивается, заглядывает в твои руки и разочарованно вздыхает*',
      choices: [
        { text: 'Скоро найду, потерпи.', nextNodeId: null },
      ],
    },
    give_bone: {
      speaker: 'Пёс',
      text: '*глаза округляются, радостно берёт кость и начинает грызть её с явным наслаждением!*',
      choices: [
        { text: 'Ну ты, серый!', nextNodeId: 'end_happy_quest' },
      ],
    },
    end_happy_quest: {
      speaker: 'Пёс',
      text: '*довольно укладывается, радостный, и засыпает перед костром*',
      choices: [
        { text: '[Конец]', nextNodeId: null },
      ],
    },
    shoo: {
      speaker: 'Пёс',
      text: '*прижимает уши и смотрит в землю...*',
      choices: [
        { text: '...Лааадно, вспылил, прости. День сегодня не задался.', nextNodeId: 'lost' },
        { text: '[Уйти]', nextNodeId: null },
      ],
    },
    end_stay: {
      speaker: 'Пёс',
      text: '*послушно садится и провожает тебя взглядом, полным надежды*',
      choices: [
        { text: '[Конец]', nextNodeId: null },
      ],
    },
  },
};

// ─── Door dialog ────────────────────────────────────────────────

export const DOOR_DIALOG: DialogTree = {
  id: 'door_mystery',
  startNodeId: 'start',
  nodes: {
    start: {
      speaker: '???',
      text: 'ЧТО ЗА ЧЕРТОВЩИНА?',
      choices: [
        {
          text: 'Открыть дверь',
          nextNodeId: null,
          tag: 'action',
          onSelect: () => {
            eventBus.emit('door:reveal', {});
          },
        },
      ],
    },
  },
};

// Auto-register dialogs
registerDialog(DOG_DIALOG);
registerDialog(DOOR_DIALOG);
