import { GameState } from '../core/GameState';
import type { InventoryUI } from '../ui/InventoryUI';

/**
 * Game state for the inventory overlay.
 * Transparent: world still renders. Blocks update: player can't move.
 */
export class InventoryState extends GameState {
  override readonly isTransparent = true;
  override readonly blocksUpdate = true;

  constructor(private ui: InventoryUI, private onClose: () => void) {
    super();
  }

  override onEnter(): void {
    this.ui.show();
  }

  override onExit(): void {
    this.ui.hide();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_dt: number): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(_dt: number): void {}
}
