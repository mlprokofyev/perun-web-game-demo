import type { ItemDef } from '../items/ItemDef';
import { assetLoader } from '../core/AssetLoader';

/**
 * HTML overlay that shows a "discovered item" preview dialog.
 * Displays the item icon (scaled up from the 24×24 procedural sprite),
 * name, and description. Accepts Enter / Space / Escape to dismiss.
 */
export class ItemPreviewUI {
  private container: HTMLElement;
  private labelEl: HTMLElement;
  private iconCanvas: HTMLCanvasElement;
  private nameEl: HTMLElement;
  private descEl: HTMLElement;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.container = document.getElementById('item-preview-container')!;
    this.container.style.display = 'none';
    this.labelEl = this.container.querySelector('.item-preview-label')!;
    this.iconCanvas = this.container.querySelector('.item-preview-icon') as HTMLCanvasElement;
    this.nameEl = this.container.querySelector('.item-preview-name')!;
    this.descEl = this.container.querySelector('.item-preview-desc')!;
  }

  /**
   * Show the item preview overlay.
   * @param item  The ItemDef to display.
   * @param onClose  Callback when the player dismisses the dialog.
   */
  show(item: ItemDef, onClose: () => void, options?: { showLabel?: boolean }): void {
    this.removeKeyListener();

    // ── Render the item icon onto the preview canvas ──
    const iconSrc = assetLoader.get(item.iconAssetId);
    const canvas = this.iconCanvas;
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false; // keep pixel-art crisp
    if (iconSrc) {
      const size = assetLoader.getSize(item.iconAssetId);
      const sw = size?.width ?? 24;
      const sh = size?.height ?? 24;
      const scale = Math.min(64 / sw, 64 / sh);
      const dw = Math.round(sw * scale);
      const dh = Math.round(sh * scale);
      const dx = Math.round((64 - dw) / 2);
      const dy = Math.round((64 - dh) / 2);
      ctx.drawImage(iconSrc as CanvasImageSource, 0, 0, sw, sh, dx, dy, dw, dh);
    }

    // ── Text content ──
    this.labelEl.style.display = (options?.showLabel !== false) ? '' : 'none';
    this.nameEl.textContent = item.name;
    this.descEl.textContent = item.description;

    // ── Show ──
    this.container.style.display = 'flex';

    // ── Keyboard: Enter / Space / Escape to dismiss ──
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // Small delay before attaching listener so the key that triggered
    // the collectible pickup doesn't immediately close the preview.
    requestAnimationFrame(() => {
      if (this.keydownHandler) {
        window.addEventListener('keydown', this.keydownHandler);
      }
    });
  }

  /** Hide the preview overlay and clean up. */
  hide(): void {
    this.container.style.display = 'none';
    this.removeKeyListener();
  }

  get visible(): boolean {
    return this.container.style.display !== 'none';
  }

  private removeKeyListener(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }
}
