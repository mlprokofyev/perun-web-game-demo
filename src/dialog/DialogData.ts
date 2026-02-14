// ─── Dialog tree data model ────────────────────────────────────

/** A single selectable response the player can pick. */
export interface DialogChoice {
  text: string;
  /** Id of the next node, or null to end the conversation. */
  nextNodeId: string | null;
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

// ─── Sample: dog greeting ──────────────────────────────────────

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
        { text: 'Shoo! Go away!', nextNodeId: 'shoo' },
      ],
    },
    lost: {
      speaker: 'Dog',
      text: '*tilts head and whimpers softly, then nudges your hand with a cold nose*',
      choices: [
        { text: "Don't worry, I'll look after you.", nextNodeId: 'end_happy' },
        { text: 'I wish I had something to give you...', nextNodeId: 'end_happy' },
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
