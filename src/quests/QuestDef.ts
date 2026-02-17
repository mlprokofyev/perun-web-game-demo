// ─── Quest data model ───────────────────────────────────────────

/** Types of quest objectives the tracker can auto-check. */
export type ObjectiveType = 'collect' | 'talk' | 'reach' | 'flag';

/** A single objective within a quest. */
export interface QuestObjective {
  /** Human-readable description (shown in quest log) */
  description: string;
  /** Objective type — determines which EventBus events advance it */
  type: ObjectiveType;
  /** Target id: item id for 'collect', dialog id for 'talk', zone id for 'reach', flag name for 'flag' */
  target: string;
  /** Required count (default 1) */
  required: number;
}

/** Static definition for a quest. */
export interface QuestDef {
  /** Unique quest id */
  id: string;
  /** Display title */
  title: string;
  /** Description shown in quest log */
  description: string;
  /** Ordered list of objectives (all must be completed to finish the quest) */
  objectives: QuestObjective[];
  /** Quest id that must be completed before this one can start (optional) */
  prerequisite?: string;
  /** Flag to set in GameFlags when the quest completes (optional) */
  completionFlag?: string;
}

// ─── Registry ───────────────────────────────────────────────────

const QUEST_REGISTRY: Map<string, QuestDef> = new Map();

/** Look up a quest definition by id. */
export function getQuestDef(id: string): QuestDef | undefined {
  return QUEST_REGISTRY.get(id);
}

/** Register one or more quest definitions. */
export function registerQuests(...quests: QuestDef[]): void {
  for (const q of quests) {
    QUEST_REGISTRY.set(q.id, q);
  }
}

/** Get all registered quest defs. */
export function getAllQuestDefs(): QuestDef[] {
  return Array.from(QUEST_REGISTRY.values());
}

// ─── Built-in quests ────────────────────────────────────────────

registerQuests(
  {
    id: 'q_dog_bone',
    title: 'A Hungry Friend',
    description: 'The dog looks hungry. Find a bone and bring it back.',
    objectives: [
      { description: 'Talk to the dog', type: 'talk', target: 'dog_greeting', required: 1 },
      { description: 'Find a bone', type: 'collect', target: 'bone', required: 1 },
      { description: 'Give the bone to the dog', type: 'flag', target: 'dog_fed', required: 1 },
    ],
    completionFlag: 'quest_dog_bone_done',
  },
  {
    id: 'q_gather_sticks',
    title: 'Gathering Firewood',
    description: 'The campfire is dying. Find sticks from the snow piles and feed the fire.',
    objectives: [
      { description: 'Collect 2 sticks from the stick piles', type: 'collect', target: 'stick', required: 2 },
      { description: 'Put the sticks in the campfire', type: 'flag', target: 'sticks_in_fire', required: 1 },
    ],
    completionFlag: 'quest_gather_sticks_done',
  },
);
