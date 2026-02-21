import { assetLoader } from './core/AssetLoader';
import { loadAssetManifest } from './core/AssetManifest';
import { generateProceduralAssets } from './assets/ProceduralAssets';
import { generateWorld } from './world/WorldGenerator';
import { Game } from './core/Game';

async function boot(): Promise<void> {
  console.log('[Perun] Booting...');

  // Generate procedural fallback assets first
  generateProceduralAssets();

  // Load asset manifest and then fetch all PNGs
  try {
    const entries = await loadAssetManifest();
    if (entries.length > 0) {
      await assetLoader.loadAll(entries);
      console.log(`[Perun] ${entries.length} PNG assets loaded from manifest.`);
    } else {
      console.warn('[Perun] Asset manifest was empty — using procedural fallbacks.');
    }
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
  if (loading) loading.textContent = 'Ошибка запуска: ' + err.message;
});
