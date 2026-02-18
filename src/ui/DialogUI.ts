import type { DialogNode } from '../dialog/DialogData';

/**
 * HTML overlay for classic bottom-of-screen dialog.
 * Navigate choices with ↑/↓ arrows, confirm with Enter.
 * ESC closes the dialog at any time.
 */
export class DialogUI {
  private container: HTMLElement;
  private speakerEl: HTMLElement;
  private textEl: HTMLElement;
  private choicesEl: HTMLElement;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  /** Currently highlighted choice (0-based). */
  private selectedIndex: number = 0;
  /** Total choices in the current node. */
  private choiceCount: number = 0;

  constructor() {
    this.container = document.getElementById('dialog-container')!;
    this.speakerEl = this.container.querySelector('.dialog-speaker')!;
    this.textEl = this.container.querySelector('.dialog-text')!;
    this.choicesEl = this.container.querySelector('.dialog-choices')!;
  }

  /**
   * Display a dialog node.
   * - `onChoice` fires with the 0-based index of the selected choice.
   * - `onClose` fires when the player presses ESC to exit the dialog.
   */
  show(node: DialogNode, onChoice: (index: number) => void, onClose: () => void): void {
    // Clean up any previous listener
    this.removeKeyListener();

    this.speakerEl.textContent = node.speaker;
    this.textEl.textContent = node.text;
    this.choicesEl.innerHTML = '';

    this.choiceCount = node.choices.length;
    this.selectedIndex = 0;

    node.choices.forEach((choice, i) => {
      const li = document.createElement('li');
      li.className = 'dialog-choice';
      const tagHtml = choice.tag
        ? `<span class="dialog-tag dialog-tag--${choice.tag}">${DialogUI.TAG_LABELS[choice.tag] ?? choice.tag}</span> `
        : '';
      li.innerHTML =
        `<span class="dialog-choice-pointer">▸</span> ${tagHtml}${this.escapeHtml(choice.text)}`;
      li.addEventListener('click', () => onChoice(i));
      li.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.highlightSelected();
      });
      this.choicesEl.appendChild(li);
    });

    this.highlightSelected();

    // Keyboard: ↑/↓ navigate, Enter confirms, ESC closes
    this.keydownHandler = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;

        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          e.stopPropagation();
          this.selectedIndex = (this.selectedIndex - 1 + this.choiceCount) % this.choiceCount;
          this.highlightSelected();
          return;

        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          e.stopPropagation();
          this.selectedIndex = (this.selectedIndex + 1) % this.choiceCount;
          this.highlightSelected();
          return;

        case 'Enter':
        case 'Space':
          e.preventDefault();
          e.stopPropagation();
          onChoice(this.selectedIndex);
          return;
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.container.style.display = 'flex';
  }

  /** Hide the dialog overlay and clean up listeners. */
  hide(): void {
    this.container.style.display = 'none';
    this.removeKeyListener();
  }

  get visible(): boolean {
    return this.container.style.display !== 'none';
  }

  /** Apply the `selected` CSS class to the currently highlighted choice. */
  private highlightSelected(): void {
    const items = this.choicesEl.querySelectorAll('.dialog-choice');
    items.forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });
  }

  private removeKeyListener(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  private static readonly TAG_LABELS: Record<string, string> = {
    quest: 'Квест',
    action: 'Действие',
    new: 'Новое',
  };

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
