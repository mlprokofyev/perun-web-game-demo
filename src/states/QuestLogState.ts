import { GameState } from '../core/GameState';
import type { QuestLogUI } from '../ui/QuestLogUI';

/**
 * Game state for the quest log overlay.
 * Transparent: world still renders. Blocks update: player can't move.
 */
export class QuestLogState extends GameState {
  override readonly isTransparent = true;
  override readonly blocksUpdate = true;

  constructor(private ui: QuestLogUI, private onClose: () => void) {
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
