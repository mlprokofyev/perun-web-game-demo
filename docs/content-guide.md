# Content Guide

> World coordinates, adding tiles, objects, animations, NPCs, and dialogs.

---

## World Coordinate Map

The game uses a **6×6 isometric grid**. Coordinates are `(col, row)` — fractional values place objects between tile centers.

### Grid Layout (as seen on screen)

```
                         (0,0)
                        /     \
                   (1,0)       (0,1)
                  /     \     /     \
             (2,0)       (1,1)       (0,2)
            /     \     /     \     /     \
       (3,0)       (2,1)       (1,2)       (0,3)
      /     \     /     \     /     \     /     \
 (4,0)       (3,1)       (2,2)       (1,3)       (0,4)
/     \     /     \     /     \     /     \     /     \
 (5,0)       (4,1)       (3,2)       (2,3)       (1,4)       (0,5)
        \     /     \     /     \     /     \     /     \     /
         (5,1)       (4,2)       (3,3)       (2,4)       (1,5)
                \     /     \     /     \     /     \     /
                 (5,2)       (4,3)       (3,4)       (2,5)
                        \     /     \     /     \     /
                         (5,3)       (4,4)       (3,5)
                                \     /     \     /
                                 (5,4)       (4,5)
                                        \     /
                                         (5,5)
```

### Axis Orientation

```
           col+ (screen-right ↘)
          /
   (0,0) ─────►
         \
          row+ (screen-left ↙)
```

- **col increases** → screen bottom-right
- **row increases** → screen bottom-left
- **(col+row) increases** → straight down

### Current Object Placements

```
         col →   0      1      2      3      4      5
   row ↓     ┌──────┬──────┬──────┬──────┬──────┬──────┐
         0   │      │      │      │      │      │      │
              ├──────┼──────┼──────┼──────┼──────┼──────┤
         1   │      │ HOUSE│      │ TREE │      │      │
              │      │(1.5, │      │(3.5, │      │      │
              ├──────┤ 1.5) ├──────┤ 0.7) ├──────┼──────┤
         2   │ WIND │      │      │      │      │      │
              │(1,2.8│      │      │      │      │      │
              ├──────┼──────┼──────┼──────┼──────┼──────┤
         3   │      │      │      │      │ STONE│ TREE │
              │      │      │      │      │(4.8, │(4.7, │
              ├──────┼──────┼──────┼──────┤ 3.0) │ 3.5) │
         4   │      │      │      │ DOG  │      │      │
              │      │      │      │(3.0, │      │      │
              ├──────┼──────┼──────┤ 3.7) ├──────┼──────┤
         5   │ TREE │      │ PLR  │      │      │      │
              │(0.7, │      │(1.3, │      │      │      │
              │ 4.7) │      │ 2.8) │      │      │      │
              └──────┴──────┴──────┴──────┴──────┴──────┘
```

### Object Reference

| Object | `(col, row)` | Asset | Draw Size | Solid | Shadow |
|--------|-------------|-------|-----------|-------|--------|
| House | (1.5, 1.5) | `obj_house` (house_2_snow.png) | 600×600 | 2×2 | 3×3+1 shadow grid |
| Big tree | (3.5, 0.7) | `obj_tree_snow_big_1` | 438×600 | 0.9×0.9 | radius 45 |
| Med tree 1 | (0.7, 4.7) | `obj_tree_med_snow` | 438×600 | 0.9×0.9 | radius 35 |
| Med tree 2 | (4.7, 3.5) | `obj_tree_med_snow` | 438×600 | 0.9×0.9 | radius 35 |
| Stone | (4.8, 3.0) | `obj_stone` | 52×44 | No | radius 10 |
| Window light | (1.0, 2.8) | — (point light) | — | — | — |
| Player spawn | (1.3, 2.8) | — | — | — | radius 15 |
| Dog NPC | (5.7→3.0, 1.2→3.7) | `dog_walk_west` / `dog_idle` | 80px tall | Yes (when idle) | — |

### Positioning Tips

- **Integer coords** `(2, 3)` — centers on the tile at column 2, row 3
- **Fractional coords** `(1.5, 1.5)` — centers between four tiles (used for large objects)
- **Walkable area** — all tiles `(0,0)` to `(5,5)` are grass and walkable; solidity comes from objects
- **Off-grid placement** — values like `4.8` nudge objects within a cell for natural-looking layouts
- **Map center** — `(3, 3)` in grid coords; sky light offset is relative to this point

---

## Adding Assets

### Asset Manifest

All assets are declared in `public/assets/data/assets.json`:

```json
{
  "assets": [
    { "id": "tile_grass", "path": "/assets/sprites/tiles/ground_snow_thick.png" },
    { "id": "char_idle",  "path": "/assets/sprites/characters/player_idle.png" }
  ]
}
```

Every new sprite must be added here. The `id` is used to reference it in code via `assetLoader.getAsset(id)`.

### New Tile

1. Drop PNG into `public/assets/sprites/tiles/`
2. Add entry to `assets.json`
3. Add a tile definition in `WorldGenerator.ts` → `TileMap` constructor
4. Set tiles via `tileMap.setTile(col, row, tileIndex)`

### New Object

1. Drop PNG into `public/assets/sprites/objects/`
2. Add entry to `assets.json`
3. Place in `WorldGenerator.ts` via `tileMap.addObject({...})`:

```typescript
tileMap.addObject({
  col: 3.5,                // grid position
  row: 2.0,
  assetId: 'obj_my_thing', // matches assets.json id
  width: 200,              // draw size in world pixels
  height: 300,
  srcW: 400,               // optional: source PNG pixel dimensions
  srcH: 600,               //   (use when PNG is higher-res than draw size)
  anchorY: 0.92,           // vertical anchor (0=top, 1=bottom, 0.92=feet near bottom)
  solid: true,             // blocks player movement
  solidCols: 1,            // collision footprint in grid cells (default 1)
  solidRows: 1,
  shadowRadius: 35,        // simple circular shadow
  // OR for complex shapes:
  // shadowPoints: [{ dx: 0, dy: 0, radius: 40 }, ...]
});
```

### Shadow Configuration

| Type | When to use | Example |
|------|-------------|---------|
| `shadowRadius: N` | Simple/round objects (trees, stones) | `shadowRadius: 35` |
| `shadowPoints: [...]` | Complex shapes (buildings) | Grid of `{dx, dy, radius}` offsets |
| Neither | No shadow | Omit both fields |

---

## Adding Player Animations

Player animations are horizontal sprite sheets — frames laid out left to right in a single row. Each frame must be `CHAR_SRC_W × CHAR_SRC_H` (currently 113×218).

Animation keys use the format `{state}_{direction}` where state is `idle` or `walk` and direction is one of: `south`, `north`, `east`, `west`, `south_east`, `south_west`, `north_east`, `north_west`.

### Steps

1. **Create the sprite sheet.** For a 6-frame walk cycle: 6 frames of 113×218 → final PNG is 678×218. Transparent background.

2. **Drop the PNG** into `public/assets/sprites/characters/`. Naming convention: `player_{state}_{direction}.png`.

3. **Add to asset manifest** in `assets.json`:
   ```json
   { "id": "char_walk_south", "path": "/assets/sprites/characters/player_walk_south.png" }
   ```
   Asset ID format: `char_{state}_{direction}`.

4. **Wire the animation** in `src/core/Game.ts`, in the animation registration block:
   ```typescript
   const walkDef: AnimationDef = {
     assetId: 'char_walk_south',
     frameWidth: Config.CHAR_SRC_W,   // 113
     frameHeight: Config.CHAR_SRC_H,  // 218
     frameCount: 6,
     frameRate: 8,
     loop: true,
   };
   this.player.animController.addAnimation('walk_south', walkDef);
   ```

5. **Repeat** for other directions/states.

### Scaling

The draw size is controlled by `CHAR_DRAW_H` in `Config.ts` (default 128). The engine derives `drawScale = CHAR_DRAW_H / CHAR_SRC_H`, so any sprite resolution works — just keep `CHAR_SRC_W`/`CHAR_SRC_H` matching the actual frame pixel dimensions.

---

## Adding NPCs

### 1. Prepare Assets

- Create idle and walk sprite sheets
- Add to `public/assets/sprites/characters/`
- Add entries to `assets.json`

### 2. Add Config Constants

In `src/core/Config.ts`, add sprite dimensions and behavior parameters:

```typescript
// NPC sprite source dimensions
MY_NPC_WALK_SRC_W: 172,
MY_NPC_WALK_SRC_H: 96,
MY_NPC_IDLE_SRC_W: 123,
MY_NPC_IDLE_SRC_H: 123,
MY_NPC_DRAW_H: 80,

// NPC behavior
MY_NPC_SPEED: 60,
MY_NPC_SPAWN_COL: 5.7,
MY_NPC_SPAWN_ROW: 1.2,
MY_NPC_TARGET_COL: 3.0,
MY_NPC_TARGET_ROW: 3.7,
MY_NPC_FADE_DURATION: 2.0,
```

### 3. Create the NPC Instance

In `Game.ts`, create an NPC with the `NPC` class:

```typescript
import { NPC, NPCOptions } from '../entities/NPC';

const opts: NPCOptions = {
  spawnCol: Config.MY_NPC_SPAWN_COL,
  spawnRow: Config.MY_NPC_SPAWN_ROW,
  targetCol: Config.MY_NPC_TARGET_COL,
  targetRow: Config.MY_NPC_TARGET_ROW,
  speed: Config.MY_NPC_SPEED,
  fadeDuration: Config.MY_NPC_FADE_DURATION,
  dialogId: 'my_dialog_tree_id',
};
const npc = new NPC('npc_my_npc', opts);
```

### 4. Register Animations

Register idle and walk animations on the NPC's `animController`, similar to the player but with the NPC's asset ids and frame dimensions.

### 5. Add to EntityManager

```typescript
this.entityManager.add(npc);
```

The game loop will automatically:
- Update the NPC's movement and fade-in
- Render it with Z-sorting
- Show the interact marker when idle
- Handle proximity-based interaction prompt

---

## Adding Dialogs

### 1. Define the Dialog Tree

In `src/dialog/DialogData.ts` (or a new file), create a `DialogTree`:

```typescript
import { DialogTree, registerDialog } from './DialogData';

const myDialog: DialogTree = {
  id: 'my_dialog_id',
  startNodeId: 'start',
  nodes: {
    start: {
      speaker: 'Character Name',
      text: 'What the character says.',
      choices: [
        { text: 'Player response A', nextNodeId: 'node_a' },
        { text: 'Player response B', nextNodeId: 'node_b' },
        { text: '[Leave]', nextNodeId: null },  // null = end conversation
      ],
    },
    node_a: {
      speaker: 'Character Name',
      text: 'Reply to choice A.',
      choices: [
        { text: '[End]', nextNodeId: null },
      ],
    },
    node_b: {
      speaker: 'Character Name',
      text: 'Reply to choice B.',
      choices: [
        { text: 'Continue...', nextNodeId: 'start' },  // loops back
        { text: '[End]', nextNodeId: null },
      ],
    },
  },
};

registerDialog(myDialog);
```

### 2. Link to NPC

Set the `dialogId` in the NPC's `NPCOptions` to match the tree's `id`.

### Dialog Data Model

```
DialogTree
  ├── id: string
  ├── startNodeId: string
  └── nodes: Record<string, DialogNode>
       ├── speaker: string
       ├── text: string
       └── choices: DialogChoice[]
            ├── text: string
            └── nextNodeId: string | null
```

A `null` `nextNodeId` ends the conversation.

---

## Asset Specifications

### Tiles
- **Dimensions**: 218×125 px (isometric 2:1 ratio, grid spacing 218×109)
- **Format**: PNG with alpha transparency
- **Perspective**: Top-down isometric view

### Characters
- **Frame size**: `CHAR_SRC_W × CHAR_SRC_H` (currently 113×218 for the player)
- **Sprite sheets**: Horizontal arrangement of same-sized frames
- **Pivot point**: Center-bottom (where the sprite touches the ground)
- **Background**: Fully transparent
- **Naming**: `{character}_{state}_{direction}.png`

### Objects
- **Format**: PNG with alpha transparency
- **Specify `srcW`/`srcH`** when the source image is higher resolution than desired draw size
- **`anchorY`**: Vertical anchor point (0.85–0.95 typical for objects that sit on the ground)

### Asset Checklist

- [ ] All PNGs have full alpha transparency (no white backgrounds)
- [ ] Sprite sheets have frames evenly spaced horizontally
- [ ] No extra padding/whitespace around sprites
- [ ] Character pivot point is at center-bottom
- [ ] All directional animations have matching frame counts
- [ ] File naming follows the project convention
- [ ] Asset added to `assets.json`
- [ ] Tested at multiple zoom levels (1×, 2×, 4×)
