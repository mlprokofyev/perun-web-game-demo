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
      speaker: 'Dog',
      text: '*wags tail and looks at you with big warm eyes*',
      choices: [
        { text: 'Hey there, buddy! Are you lost?', nextNodeId: 'lost' },
        { text: 'What a good boy!', nextNodeId: 'good_boy' },
        {
          text: 'Here, I found a bone for you!',
          nextNodeId: 'give_bone',
          // Only show if player has a bone AND quest is active
          condition: (flags) => inventory.has('bone') && questTracker.isActive('q_dog_bone'),
          onSelect: (flags) => {
            inventory.remove('bone', 1);
            flags.set('dog_fed', true);
          },
        },
        {
          text: '(The dog seems happy now.)',
          nextNodeId: 'end_happy_quest',
          condition: (flags) => flags.getBool('dog_fed'),
        },
        { text: 'Shoo! Go away!', nextNodeId: 'shoo' },
      ],
    },
    lost: {
      speaker: 'Dog',
      text: '*tilts head and whimpers softly, then nudges your hand with a cold nose*',
      choices: [
        {
          text: "Don't worry, I'll look after you. Let me find something for you.",
          nextNodeId: 'quest_accept',
          condition: (flags) => !flags.getBool('quest_dog_bone_done') && !questTracker.isActive('q_dog_bone'),
          onSelect: (_flags) => {
            questTracker.start('q_dog_bone');
            // Retroactively credit this conversation for the 'talk' objective
            // (dialog:open fired before the quest was active)
            eventBus.emit('dialog:open', { dialogId: 'dog_greeting', npcId: 'dog' });
          },
        },
        { text: "Don't worry, I'll look after you.", nextNodeId: 'end_happy' },
        { text: 'I wish I had something to give you...', nextNodeId: 'end_happy' },
      ],
    },
    quest_accept: {
      speaker: 'Dog',
      text: '*perks up and sniffs the air hopefully, tail wagging faster*',
      choices: [
        { text: "I'll find something, hold on!", nextNodeId: null },
      ],
    },
    give_bone: {
      speaker: 'Dog',
      text: '*eyes go wide, grabs the bone gently, and starts gnawing on it with pure joy!*',
      choices: [
        { text: 'Enjoy it, buddy!', nextNodeId: 'end_happy_quest' },
      ],
    },
    end_happy_quest: {
      speaker: 'Dog',
      text: '*lies down contentedly with the bone between paws, tail sweeping the ground*',
      choices: [
        { text: '[End]', nextNodeId: null },
      ],
    },
    good_boy: {
      speaker: 'Dog',
      text: '*barks happily and does a little spin, tail wagging furiously*',
      choices: [
        { text: 'Want to come along with me?', nextNodeId: 'end_happy' },
        { text: "Stay here, I'll be back.", nextNodeId: 'end_stay' },
      ],
    },
    shoo: {
      speaker: 'Dog',
      text: "*lowers ears and looks at the ground... but doesn't move*",
      choices: [
        { text: "...Sorry. I didn't mean that.", nextNodeId: 'lost' },
        { text: '[Walk away]', nextNodeId: null },
      ],
    },
    end_happy: {
      speaker: 'Dog',
      text: '*settles down next to you and lets out a content sigh*',
      choices: [
        { text: '[End]', nextNodeId: null },
      ],
    },
    end_stay: {
      speaker: 'Dog',
      text: '*sits down obediently and watches you walk away with hopeful eyes*',
      choices: [
        { text: '[End]', nextNodeId: null },
      ],
    },
  },
};

// Auto-register the sample dialog
registerDialog(DOG_DIALOG);
