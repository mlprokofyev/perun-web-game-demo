import { GameState } from '../core/GameState';
import type { DialogTree, DialogChoice } from '../dialog/DialogData';
import type { DialogUI } from '../ui/DialogUI';
import { eventBus } from '../core/EventBus';
import { gameFlags } from '../core/GameFlags';

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

    // Filter choices by condition (if any)
    const visibleChoices: { original: DialogChoice; originalIndex: number }[] = [];
    for (let i = 0; i < node.choices.length; i++) {
      const c = node.choices[i];
      if (!c.condition || c.condition(gameFlags)) {
        visibleChoices.push({ original: c, originalIndex: i });
      }
    }

    // If all choices are filtered out, close the dialog
    if (visibleChoices.length === 0) {
      this.onClose();
      return;
    }

    // Build a filtered node for the UI (only visible choices)
    const filteredNode = {
      ...node,
      choices: visibleChoices.map(vc => vc.original),
    };

    this.ui.show(
      filteredNode,
      (filteredIndex) => {
        const vc = visibleChoices[filteredIndex];
        if (!vc) return;

        const choice = vc.original;

        // Execute onSelect callback before advancing
        choice.onSelect?.(gameFlags);

        eventBus.emit('dialog:choice', { dialogId: this.tree.id, choiceIndex: vc.originalIndex });

        if (choice.nextNodeId === null) {
          this.onClose();
          return;
        }

        this.currentNodeId = choice.nextNodeId;
        this.showCurrentNode();
      },
      () => {
        this.onClose();
      },
    );
  }
}
