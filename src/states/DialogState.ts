import { GameState } from '../core/GameState';
import type { DialogTree } from '../dialog/DialogData';
import type { DialogUI } from '../ui/DialogUI';
import { eventBus } from '../core/EventBus';

/**
 * Game state for an active dialog.
 *
 * - Transparent: the game world still renders beneath.
 * - Blocks update: player movement is paused while talking.
 */
export class DialogState extends GameState {
  override readonly isTransparent = true;
  override readonly blocksUpdate = true;

  private tree: DialogTree;
  private currentNodeId: string;
  private ui: DialogUI;
  /** Called when the dialog ends (caller should pop this state). */
  private onClose: () => void;

  constructor(tree: DialogTree, ui: DialogUI, onClose: () => void) {
    super();
    this.tree = tree;
    this.currentNodeId = tree.startNodeId;
    this.ui = ui;
    this.onClose = onClose;
  }

  override onEnter(): void {
    eventBus.emit('dialog:open', { dialogId: this.tree.id, npcId: this.tree.id });
    this.showCurrentNode();
  }

  override onExit(): void {
    this.ui.hide();
    eventBus.emit('dialog:close', { dialogId: this.tree.id });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_dt: number): void {
    // Dialog logic is event-driven (keyboard/click), nothing to poll.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(_dt: number): void {
    // UI is an HTML overlay — no canvas work needed.
  }

  // ── internal ────────────────────────────────────────────────

  private showCurrentNode(): void {
    const node = this.tree.nodes[this.currentNodeId];
    if (!node) {
      this.onClose();
      return;
    }

    this.ui.show(
      node,
      (choiceIndex) => {
        const choice = node.choices[choiceIndex];
        if (!choice) return;

        eventBus.emit('dialog:choice', { dialogId: this.tree.id, choiceIndex });

        if (choice.nextNodeId === null) {
          // End of dialog
          this.onClose();
          return;
        }

        this.currentNodeId = choice.nextNodeId;
        this.showCurrentNode();
      },
      () => {
        // ESC pressed — close the entire dialog immediately
        this.onClose();
      },
    );
  }
}
