export interface AssetEntry {
  id: string;
  path: string;
  width?: number;
  height?: number;
}

/**
 * Loads and caches PNG image assets.
 * Also supports registering procedurally-generated canvases.
 */
export class AssetLoader {
  private images: Map<string, HTMLImageElement> = new Map();
  private canvases: Map<string, HTMLCanvasElement> = new Map();

  /** Load a single image by id + URL path */
  loadImage(id: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.images.has(id)) { resolve(); return; }
      const img = new Image();
      img.onload = () => { this.images.set(id, img); resolve(); };
      img.onerror = () => reject(new Error(`Failed to load asset: ${path}`));
      img.src = path;
    });
  }

  /** Load multiple assets in parallel */
  async loadAll(entries: AssetEntry[]): Promise<void> {
    await Promise.all(entries.map(e => this.loadImage(e.id, e.path)));
  }

  /** Register a pre-rendered canvas as an asset (for procedural generation) */
  registerCanvas(id: string, canvas: HTMLCanvasElement): void {
    this.canvases.set(id, canvas);
  }

  /** Get asset as a drawable source (HTMLImageElement or HTMLCanvasElement) */
  get(id: string): CanvasImageSource | undefined {
    return this.images.get(id) ?? this.canvases.get(id);
  }

  has(id: string): boolean {
    return this.images.has(id) || this.canvases.has(id);
  }
}

export const assetLoader = new AssetLoader();
