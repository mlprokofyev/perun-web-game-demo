// ─── Item definition data model ─────────────────────────────────

/** Static definition for an item type. */
export interface ItemDef {
  /** Unique item identifier (e.g. 'stick', 'bone', 'gem_red') */
  id: string;
  /** Display name */
  name: string;
  /** Short description (shown in inventory tooltip) */
  description: string;
  /** Asset id for the inventory icon sprite */
  iconAssetId: string;
  /** Whether multiple instances stack in one slot */
  stackable: boolean;
  /** Maximum stack size (only relevant when stackable) */
  maxStack: number;
}

// ─── Registry ───────────────────────────────────────────────────

const ITEM_REGISTRY: Map<string, ItemDef> = new Map();

/** Look up an item definition by id. */
export function getItemDef(id: string): ItemDef | undefined {
  return ITEM_REGISTRY.get(id);
}

/** Register one or more item definitions. */
export function registerItems(...items: ItemDef[]): void {
  for (const item of items) {
    ITEM_REGISTRY.set(item.id, item);
  }
}

/** Get all registered item defs. */
export function getAllItemDefs(): ItemDef[] {
  return Array.from(ITEM_REGISTRY.values());
}

// ─── Built-in item definitions ──────────────────────────────────

registerItems(
  {
    id: 'stick',
    name: 'Хворост',
    description: 'Крепкая палка хвороста. Хорошо горит.',
    iconAssetId: 'item_stick',
    stackable: true,
    maxStack: 10,
  },
  {
    id: 'bone',
    name: 'Кость',
    description: 'Большая белая кость. Собака была бы в восторге.',
    iconAssetId: 'item_bone',
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'stone',
    name: 'Камень',
    description: 'Гладкий круглый камень. Красивый и подозрительно ровный',
    iconAssetId: 'item_stone',
    stackable: true,
    maxStack: 10,
  },
  {
    id: 'ancient_ember',
    name: 'Древний Уголёк',
    description: 'Загадочный светящийся уголёк, тёплый на ощупь. Пульсирует древним внутренним светом.',
    iconAssetId: 'item_ancient_ember',
    stackable: false,
    maxStack: 1,
  },
);
