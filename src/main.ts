import { assetLoader } from './core/AssetLoader';
import { loadAssetManifest } from './core/AssetManifest';
import { generateProceduralAssets } from './assets/ProceduralAssets';
import { generateWorld } from './world/WorldGenerator';
import { Game } from './core/Game';

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches);
}

function showMobileWarning(): void {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(10,8,6,0.92);padding:24px;';

  const box = document.createElement('div');
  box.style.cssText =
    'max-width:420px;font-family:monospace;color:#e8dcc0;text-align:center;line-height:1.7;font-size:14px;';
  box.innerHTML =
    '<p>Честно признаюсь, адаптировать проект под мобильный веб я уже поленился,</p>' +
    '<p><b>НО</b>, как формулируют это большие уважающие game-студии:</p>' +
    '<p style="margin-top:12px;margin-bottom:12px;color:#c8a84e;font-size:16px;">«Эта платформа не поддерживается»</p>' +
    '<p></p><p>Чтобы насладиться всеми возможностями, откройте с компуктера</p>';

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

async function boot(): Promise<void> {
  console.log('[Perun] Booting...');

  if (isMobile()) {
    showMobileWarning();
    return;
  }

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
