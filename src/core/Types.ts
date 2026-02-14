/** 8-directional facing used for animation and movement */
export type Direction =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'north_east'
  | 'north_west'
  | 'south_east'
  | 'south_west';

/** All 8 directions as a readonly array (useful for iteration) */
export const ALL_DIRECTIONS: readonly Direction[] = [
  'south', 'north', 'east', 'west',
  'south_east', 'south_west', 'north_east', 'north_west',
] as const;

/** The 4 cardinal directions */
export const CARDINAL_DIRECTIONS: readonly Direction[] = [
  'south', 'north', 'east', 'west',
] as const;
