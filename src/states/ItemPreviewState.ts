import { GameState } from '../core/GameState';
import type { ItemDef } from '../items/ItemDef';
import type { ItemPreviewUI } from '../ui/ItemPreviewUI';

/**
 * Game state for displaying an item preview dialog.
 *
 * - Transparent: the game world still renders beneath.
 * - Blocks update: player movement is paused while viewing.
 */
export class ItemPreviewState extends GameState {
  override readonly isTransparent = true;
  override readonly blocksUpdate = true;

  private ui: ItemPreviewUI;
  private item: ItemDef;
  private onClose: () => void;

  constructor(item: ItemDef, ui: ItemPreviewUI, onClose: () => void) {
    super();
    this.item = item;
    this.ui = ui;
    this.onClose = onClose;
  }

  override onEnter(): void {
    this.ui.show(this.item, () => this.onClose());
  }

  override onExit(): void {
    this.ui.hide();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_dt: number): void {
    // Input is handled by the UI's keydown listener.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(_dt: number): void {
    // UI is an HTML overlay — no canvas work needed.
  }
}
