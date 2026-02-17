import type { AssetEntry } from './AssetLoader';

/** Shape of the JSON manifest file */
interface ManifestFile {
  assets: AssetEntry[];
}

const BASE = import.meta.env.BASE_URL;

/**
 * Load the asset manifest from a JSON file and return the entries array.
 * Falls back to an empty array on network / parse failure.
 * All asset paths are resolved relative to Vite's configured `base`.
 */
export async function loadAssetManifest(url = `${BASE}assets/data/assets.json`): Promise<AssetEntry[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ManifestFile = await res.json();
    const entries = data.assets ?? [];
    return entries.map(e => ({ ...e, path: `${BASE}${e.path}` }));
  } catch (err) {
    console.warn('[AssetManifest] Failed to load manifest, returning empty:', err);
    return [];
  }
}
