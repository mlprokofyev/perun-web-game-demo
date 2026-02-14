import type { AssetEntry } from './AssetLoader';

/** Shape of the JSON manifest file */
interface ManifestFile {
  assets: AssetEntry[];
}

/**
 * Load the asset manifest from a JSON file and return the entries array.
 * Falls back to an empty array on network / parse failure.
 */
export async function loadAssetManifest(url = '/assets/data/assets.json'): Promise<AssetEntry[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ManifestFile = await res.json();
    return data.assets ?? [];
  } catch (err) {
    console.warn('[AssetManifest] Failed to load manifest, returning empty:', err);
    return [];
  }
}
