import { Config } from '../core/Config';
import { assetLoader } from '../core/AssetLoader';
import { eventBus } from '../core/EventBus';
import { ALL_DIRECTIONS } from '../core/Types';
import { EntityManager } from '../core/EntityManager';
import { Player } from '../entities/Player';
import { NPC, NPCState } from '../entities/NPC';
import { Campfire } from '../entities/Campfire';
import { Collectible } from '../entities/Collectible';
import { InteractableObject } from '../entities/InteractableObject';
import { TileMap } from '../world/TileMap';
import { NoteUI } from '../ui/NoteUI';
import type { AnimationDef } from '../entities/AnimationController';
import { CAMPFIRE_FRAME_W, CAMPFIRE_FRAME_H, CAMPFIRE_FRAMES } from '../assets/ProceduralAssets';
import { inventory } from '../items/Inventory';
import { questTracker } from '../quests/QuestTracker';
import type { GameplaySystem } from '../systems/GameplaySystem';

const CHAR_SRC_W = Config.CHAR_SRC_W;
const CHAR_SRC_H = Config.CHAR_SRC_H;
const CHAR_DRAW_H = Config.CHAR_DRAW_H;
const CHAR_SCALE = CHAR_DRAW_H / CHAR_SRC_H;

function frameCountOf(assetId: string, frameW: number): number {
  const size = assetLoader.getSize(assetId);
  if (!size) return 1;
  return Math.max(1, Math.floor(size.width / frameW));
}

export function registerPlayerAnimations(player: Player): void {
  const hasRealChar = assetLoader.has('char_idle');
  for (const dir of ALL_DIRECTIONS) {
    if (hasRealChar) {
      const idleAsset = 'char_idle';
      const idleDef: AnimationDef = {
        assetId: idleAsset,
        frameWidth: CHAR_SRC_W,
        frameHeight: CHAR_SRC_H,
        frameCount: frameCountOf(idleAsset, CHAR_SRC_W),
        frameRate: 1,
        loop: true,
      };
      player.animController.addAnimation(`idle_${dir}`, idleDef);

      const walkAssetId = `char_walk_${dir}`;
      const walkAsset = assetLoader.has(walkAssetId) ? walkAssetId : idleAsset;
      const walkDef: AnimationDef = {
        assetId: walkAsset,
        frameWidth: CHAR_SRC_W,
        frameHeight: CHAR_SRC_H,
        frameCount: frameCountOf(walkAsset, CHAR_SRC_W),
        frameRate: 5,
        loop: true,
      };
      player.animController.addAnimation(`walk_${dir}`, walkDef);
    } else {
      const procDir = dir.includes('_') ? dir.split('_')[0] : dir;
      const procWalk = `char_walk_${procDir}`;
      const procIdle = `char_idle_${procDir}`;
      player.animController.addAnimation(`walk_${dir}`, {
        assetId: procWalk,
        frameWidth: 32, frameHeight: 48,
        frameCount: frameCountOf(procWalk, 32),
        frameRate: 8, loop: true,
      });
      player.animController.addAnimation(`idle_${dir}`, {
        assetId: procIdle,
        frameWidth: 32, frameHeight: 48,
        frameCount: frameCountOf(procIdle, 32),
        frameRate: 1, loop: true,
      });
    }
  }
}

export function createPlayer(entityManager: EntityManager): Player {
  const player = new Player();
  player.drawScale = CHAR_SCALE;
  player.transform.set(Config.PLAYER_START_COL, Config.PLAYER_START_ROW);
  registerPlayerAnimations(player);
  player.animController.play('idle_south');
  entityManager.add(player);
  return player;
}

export function createCampfire(entityManager: EntityManager): Campfire {
  const fire = new Campfire(Config.CAMPFIRE_COL, Config.CAMPFIRE_ROW);
  fire.setBaseScale(Config.CAMPFIRE_DRAW_H / CAMPFIRE_FRAME_H);
  fire.blobShadow = { rx: 12, ry: 6, opacity: 0.18 };

  fire.animController.addAnimation('burn', {
    assetId: 'campfire_anim',
    frameWidth: CAMPFIRE_FRAME_W,
    frameHeight: CAMPFIRE_FRAME_H,
    frameCount: CAMPFIRE_FRAMES,
    frameRate: 6,
    loop: true,
  });
  fire.animController.play('burn');

  entityManager.add(fire);
  return fire;
}

export function createDogNPC(entityManager: EntityManager): NPC {
  const dog = new NPC('dog', {
    spawnCol: Config.DOG_SPAWN_COL,
    spawnRow: Config.DOG_SPAWN_ROW,
    targetCol: Config.DOG_TARGET_COL,
    targetRow: Config.DOG_TARGET_ROW,
    speed: Config.DOG_SPEED,
    fadeDuration: Config.DOG_FADE_DURATION,
    dialogId: 'dog_greeting',
  });

  dog.drawScale = Config.DOG_DRAW_H / Config.DOG_IDLE_SRC_H;
  dog.blobShadow = { rx: 11, ry: 6, opacity: 0.3 };

  const walkAsset = 'dog_walk_west';
  const idleAsset = 'dog_idle';
  for (const dir of ALL_DIRECTIONS) {
    if (assetLoader.has(walkAsset)) {
      dog.animController.addAnimation(`walk_${dir}`, {
        assetId: walkAsset,
        frameWidth: Config.DOG_WALK_SRC_W,
        frameHeight: Config.DOG_WALK_SRC_H,
        frameCount: frameCountOf(walkAsset, Config.DOG_WALK_SRC_W),
        frameRate: 6,
        loop: true,
      });
    }
    if (assetLoader.has(idleAsset)) {
      dog.animController.addAnimation(`idle_${dir}`, {
        assetId: idleAsset,
        frameWidth: Config.DOG_IDLE_SRC_W,
        frameHeight: Config.DOG_IDLE_SRC_H,
        frameCount: frameCountOf(idleAsset, Config.DOG_IDLE_SRC_W),
        frameRate: 2,
        loop: true,
      });
    }
  }
  const sleepAsset = 'dog_sleeping';
  if (assetLoader.has(sleepAsset)) {
    dog.animController.addAnimation('sleep', {
      assetId: sleepAsset,
      frameWidth: Config.DOG_SLEEP_SRC_W,
      frameHeight: Config.DOG_SLEEP_SRC_H,
      frameCount: frameCountOf(sleepAsset, Config.DOG_SLEEP_SRC_W),
      frameRate: 2,
      loop: true,
    });
  }

  dog.animController.play('walk_south_west');
  entityManager.add(dog);

  eventBus.on('dialog:close', () => {
    if (questTracker.isCompleted('q_dog_bone') && dog.npcState !== NPCState.SLEEPING) {
      dog.sleep();
    }
  });

  return dog;
}

export function createCollectibles(entityManager: EntityManager): void {
  const collectibles = [
    { id: 'collect_bone_1', itemId: 'bone', col: 4.4, row: 4.1, assetId: 'item_bone_world', srcW: 32, srcH: 32, drawH: 24, pickupRadius: 0.4 },
    { id: 'collect_bone_2', itemId: 'bone', col: 1.2, row: 4.4, assetId: 'item_bone_world', srcW: 32, srcH: 32, drawH: 24, pickupRadius: 0.4 },
    { id: 'collect_stone_1', itemId: 'stone', col: 5.0, row: 2.0, assetId: 'item_stone_world', srcW: 32, srcH: 32, drawH: 20 },
  ];

  for (const def of collectibles) {
    const c = new Collectible(def.id, {
      col: def.col,
      row: def.row,
      itemId: def.itemId,
      assetId: def.assetId,
      srcW: def.srcW,
      srcH: def.srcH,
      drawH: def.drawH,
      pickupRadius: def.pickupRadius,
    });
    entityManager.add(c);
  }
}

export function createStickPileInteractables(
  entityManager: EntityManager,
  tileMap: TileMap,
  gameplaySystem: GameplaySystem,
): void {
  const piles = [
    { entityId: 'interact_stick_pile_1', tileObjId: 'stick_pile_1', col: 0.5, row: 3.1 },
    { entityId: 'interact_stick_pile_2', tileObjId: 'stick_pile_2', col: 2.8, row: 2.2 },
  ];

  for (const pile of piles) {
    const obj = new InteractableObject(pile.entityId, {
      col: pile.col,
      row: pile.row,
      label: 'собрать хворост',
      onInteract: () => {
        const added = inventory.add('stick', 1, pile.entityId);
        if (added > 0) {
          eventBus.emit('collectible:pickup', { collectibleId: pile.entityId, itemId: 'stick' });
          gameplaySystem.addFloatingText('+1 Хворост', pile.col, pile.row, 1.2);
          tileMap.removeObjectById(pile.tileObjId);
          obj.deplete();
          entityManager.remove(pile.entityId);
          return true;
        }
        return false;
      },
    });
    entityManager.add(obj);
  }
}

export function createDoorInteractable(entityManager: EntityManager): void {
  const obj = new InteractableObject('interact_door', {
    col: 1.1,
    row: 2.3,
    label: 'дверь',
    onInteract: () => {
      eventBus.emit('dialog:request', { dialogId: 'door_mystery' });
      return true;
    },
    radius: 0.6,
    markerOffsetY: 40,
  });
  obj.interactable = inventory.has('pink_lighter');
  eventBus.on('inventory:changed', () => {
    obj.interactable = inventory.has('pink_lighter') && !obj.depleted;
  });
  entityManager.add(obj);
}

export function createNoteInteractable(
  entityManager: EntityManager,
  noteUI: NoteUI,
): void {
  const obj = new InteractableObject('interact_wall_note', {
    col: 2.0,
    row: 2.65,
    label: 'прочитать записку',
    onInteract: () => {
      noteUI.show(() => {
        noteUI.hide();
      });
      return true;
    },
    radius: 0.6,
    markerOffsetY: 50,
  });
  entityManager.add(obj);
}
