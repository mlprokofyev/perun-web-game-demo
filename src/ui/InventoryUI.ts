import { inventory } from '../items/Inventory';
import { getItemDef } from '../items/ItemDef';
import { assetLoader } from '../core/AssetLoader';

/**
 * HTML overlay for the player inventory.
 * Arrow keys navigate slots, Enter inspects, ESC/I closes.
 */
export class InventoryUI {
  private container: HTMLElement;
  private slotsEl: HTMLElement;
  private hintEl: HTMLElement;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  private selectedIndex: number = 0;
  private slotCount: number = 0;
  private slotItemIds: string[] = [];

  private onInspect: ((itemId: string) => void) | null = null;
  private onClose: (() => void) | null = null;

  constructor() {
    let container = document.getElementById('inventory-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'inventory-container';
      container.innerHTML = `
        <div class="inventory-box">
          <div class="inventory-title">ИНВЕНТАРЬ</div>
          <div class="inventory-slots"></div>
          <div class="inventory-hint">
            <span class="key">↑</span><span class="key">↓</span> выбор
            <span class="key">Enter</span> осмотреть
            <span class="key">ESC</span> закрыть
          </div>
        </div>
      `;
      document.getElementById('game-container')!.appendChild(container);
    }
    this.container = container;
    this.container.style.display = 'none';
    this.slotsEl = container.querySelector('.inventory-slots')!;
    this.hintEl = container.querySelector('.inventory-hint')!;
  }

  show(onInspect?: (itemId: string) => void, onClose?: () => void): void {
    this.onInspect = onInspect ?? null;
    this.onClose = onClose ?? null;
    this.refresh();
    this.container.style.display = 'flex';
    this.attachKeyListener();
  }

  hide(): void {
    this.container.style.display = 'none';
    this.removeKeyListener();
  }

  get visible(): boolean {
    return this.container.style.display !== 'none';
  }

  private refresh(): void {
    this.slotsEl.innerHTML = '';
    const slots = inventory.getSlots();
    this.slotItemIds = [];

    if (slots.length === 0) {
      this.slotCount = 0;
      const empty = document.createElement('div');
      empty.className = 'inventory-empty';
      empty.textContent = 'Пусто';
      this.slotsEl.appendChild(empty);
      return;
    }

    this.slotCount = slots.length;
    if (this.selectedIndex >= this.slotCount) {
      this.selectedIndex = Math.max(0, this.slotCount - 1);
    }

    for (const slot of slots) {
      const def = getItemDef(slot.itemId);
      if (!def) continue;
      this.slotItemIds.push(slot.itemId);

      const el = document.createElement('div');
      el.className = 'inventory-slot';

      const pointer = document.createElement('span');
      pointer.className = 'inventory-pointer';
      pointer.textContent = '▸';
      el.appendChild(pointer);

      const icon = assetLoader.get(def.iconAssetId);
      if (icon) {
        const img = document.createElement('canvas');
        img.width = 24;
        img.height = 24;
        img.className = 'inventory-icon';
        const ctx = img.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        const sz = assetLoader.getSize(def.iconAssetId);
        const sw = sz?.width ?? 24;
        const sh = sz?.height ?? 24;
        const scale = Math.min(24 / sw, 24 / sh);
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);
        const dx = Math.round((24 - dw) / 2);
        const dy = Math.round((24 - dh) / 2);
        ctx.drawImage(icon as CanvasImageSource, 0, 0, sw, sh, dx, dy, dw, dh);
        el.appendChild(img);
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'inventory-icon-fallback';
        fallback.textContent = def.name[0];
        el.appendChild(fallback);
      }

      if (slot.count > 1) {
        const count = document.createElement('span');
        count.className = 'inventory-count';
        count.textContent = `×${slot.count}`;
        el.appendChild(count);
      }

      const name = document.createElement('span');
      name.className = 'inventory-name';
      name.textContent = def.name;
      el.appendChild(name);

      this.slotsEl.appendChild(el);
    }

    this.highlightSelected();
  }

  private highlightSelected(): void {
    const items = this.slotsEl.querySelectorAll('.inventory-slot');
    items.forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });
  }

  private attachKeyListener(): void {
    this.removeKeyListener();
    this.keydownHandler = (e: KeyboardEvent) => {
      if (this.slotCount === 0) {
        if (e.code === 'Escape' || e.code === 'KeyI') {
          e.preventDefault();
          e.stopPropagation();
          this.onClose?.();
        }
        return;
      }

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          e.stopPropagation();
          this.selectedIndex = (this.selectedIndex - 1 + this.slotCount) % this.slotCount;
          this.highlightSelected();
          break;

        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          e.stopPropagation();
          this.selectedIndex = (this.selectedIndex + 1) % this.slotCount;
          this.highlightSelected();
          break;

        case 'Enter':
        case 'Space':
          e.preventDefault();
          e.stopPropagation();
          if (this.slotItemIds[this.selectedIndex]) {
            this.onInspect?.(this.slotItemIds[this.selectedIndex]);
          }
          break;

        case 'Escape':
        case 'KeyI':
          e.preventDefault();
          e.stopPropagation();
          this.onClose?.();
          break;
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  private removeKeyListener(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }
}
