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
      { id: 'tile_grass', path: '/assets/sprites/tiles/grass.png' },

      // Character
      { id: 'char_idle', path: '/assets/sprites/characters/player_idle.png' },

      // Objects
      { id: 'obj_tree',  path: '/assets/sprites/objects/tree.png' },
      { id: 'obj_stone', path: '/assets/sprites/objects/stone_on_grass.png' },
      { id: 'obj_house', path: '/assets/sprites/objects/house.png' },
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
