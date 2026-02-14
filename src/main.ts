import { assetLoader } from './core/AssetLoader';
import { generateProceduralAssets } from './assets/ProceduralAssets';
import { generateWorld } from './world/WorldGenerator';
import { Game } from './core/Game';

async function boot(): Promise<void> {
  console.log('[Perun] Booting...');

  // Generate procedural fallback assets first
  generateProceduralAssets();

  // Load real PNG assets (override procedural ones)
  try {
    await assetLoader.loadAll([
      // Tiles
      { id: 'tile_grass', path: '/assets/sprites/tiles/ground_snow_thick.png' },

      // Character
      { id: 'char_idle', path: '/assets/sprites/characters/player_idle.png' },
      { id: 'char_walk_south', path: '/assets/sprites/characters/player_walk_south.png' },
      { id: 'char_walk_north', path: '/assets/sprites/characters/player_walk_north.png' },
      { id: 'char_walk_east', path: '/assets/sprites/characters/player_walk_east.png' },
      { id: 'char_walk_west', path: '/assets/sprites/characters/player_walk_west.png' },
      { id: 'char_walk_south_east', path: '/assets/sprites/characters/player_walk_south_east.png' },
      { id: 'char_walk_south_west', path: '/assets/sprites/characters/player_walk_south_west.png' },
      { id: 'char_walk_north_east', path: '/assets/sprites/characters/player_walk_north_east.png' },
      { id: 'char_walk_north_west', path: '/assets/sprites/characters/player_walk_north_west.png' },

      // Objects
      { id: 'obj_tree_med_snow',  path: '/assets/sprites/objects/tree_snow_med_1.png' },
      { id: 'obj_tree_big', path: '/assets/sprites/objects/tree_big.png' },
      { id: 'obj_tree_snow_big_1', path: '/assets/sprites/objects/tree_snow_big_1.png'},
      { id: 'obj_stone', path: '/assets/sprites/objects/stone_on_grass.png' },
      { id: 'obj_house', path: '/assets/sprites/objects/house_2_snow.png' },
    ]);
    console.log('[Perun] All PNG assets loaded.');
  } catch (err) {
    console.warn('[Perun] Some assets failed to load, using procedural fallbacks:', err);
  }

  // Generate world
  const tileMap = generateWorld();

  // Get container
  const container = document.getElementById('game-container')!;

  // Create and start game
  const game = new Game(container, tileMap);
  game.start();

  console.log('[Perun] Game started.');
}

boot().catch(err => {
  console.error('[Perun] Boot failed:', err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'Failed to start: ' + err.message;
});
