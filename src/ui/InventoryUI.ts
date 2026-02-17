import { inventory } from '../items/Inventory';
import { getItemDef } from '../items/ItemDef';
import { assetLoader } from '../core/AssetLoader';

/**
 * HTML overlay for the player inventory.
 * Shows collected items as an icon grid with counts.
 * Toggle with I key.
 */
export class InventoryUI {
  private container: HTMLElement;
  private slotsEl: HTMLElement;

  constructor() {
    // Create the container if it doesn't exist
    let container = document.getElementById('inventory-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'inventory-container';
      container.innerHTML = `
        <div class="inventory-box">
          <div class="inventory-title">INVENTORY</div>
          <div class="inventory-slots"></div>
          <div class="inventory-hint"><span class="key">I</span> / <span class="key">ESC</span> close</div>
        </div>
      `;
      document.getElementById('game-container')!.appendChild(container);
    }
    this.container = container;
    this.container.style.display = 'none';
    this.slotsEl = container.querySelector('.inventory-slots')!;
  }

  show(): void {
    this.refresh();
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  get visible(): boolean {
    return this.container.style.display !== 'none';
  }

  /** Rebuild slot display from current inventory state. */
  refresh(): void {
    this.slotsEl.innerHTML = '';
    const slots = inventory.getSlots();

    if (slots.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inventory-empty';
      empty.textContent = 'Empty';
      this.slotsEl.appendChild(empty);
      return;
    }

    for (const slot of slots) {
      const def = getItemDef(slot.itemId);
      if (!def) continue;

      const el = document.createElement('div');
      el.className = 'inventory-slot';
      el.title = `${def.name}: ${def.description}`;

      // Try to render the icon as a canvas image
      const icon = assetLoader.get(def.iconAssetId);
      if (icon) {
        const img = document.createElement('canvas');
        img.width = 24;
        img.height = 24;
        img.className = 'inventory-icon';
        const ctx = img.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(icon as CanvasImageSource, 0, 0, 24, 24);
        el.appendChild(img);
      } else {
        // Fallback: text icon
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
  }
}
