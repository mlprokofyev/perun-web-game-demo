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
    canvas.width = 120;
    canvas.height = 120;
    ctx.clearRect(0, 0, 120, 120);

    if (item.glowColor) {
      const grad = ctx.createRadialGradient(60, 60, 0, 60, 60, 60);
      grad.addColorStop(0,   item.glowColor.replace(/[\d.]+\)$/, '0.8)'));
      grad.addColorStop(0.2, item.glowColor.replace(/[\d.]+\)$/, '0.6)'));
      grad.addColorStop(0.45, item.glowColor.replace(/[\d.]+\)$/, '0.35)'));
      grad.addColorStop(0.7, item.glowColor.replace(/[\d.]+\)$/, '0.12)'));
      grad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 120, 120);
    }

    ctx.imageSmoothingEnabled = false;
    if (iconSrc) {
      const size = assetLoader.getSize(item.iconAssetId);
      const sw = size?.width ?? 24;
      const sh = size?.height ?? 24;
      const scale = Math.min(80 / sw, 80 / sh);
      const dw = Math.round(sw * scale);
      const dh = Math.round(sh * scale);
      const dx = Math.round((120 - dw) / 2);
      const dy = Math.round((120 - dh) / 2);
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
