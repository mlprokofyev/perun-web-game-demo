/**
 * Full-screen parchment overlay for the wall note.
 * Shows static text content, dismissable by Enter/Space/Escape.
 */
export class NoteUI {
  private container: HTMLElement;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    let container = document.getElementById('note-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'note-container';
      container.innerHTML = `
        <div class="note-parchment">
          <div class="note-title">Записка зрителю</div>
          <div class="note-body">
            <p>Этот проект не имеет какого-то глубокого смысла – это сценка-бродилка, с помощью которой я исследовал возможности и ограничения художественной выразительности этого формата. Тем не менее, я оставил тут пару пасхалок на будущее и от скуки.</p>
            <p>Поэтому призываю не относиться к этому проекту слишком серьёзно, но буду рад, если он кого-то вдохновит или кто-то захочет подключиться, чтобы сделать что-то совместно.</p>
            <p>Спасибо, что зашли.</p>
            <p class="note-signature">– Миша</p>
          </div>
          <div class="note-hint">
            Нажмите <span class="key">Enter</span> или <span class="key">ESC</span> чтобы закрыть
          </div>
        </div>
      `;
      document.getElementById('game-container')!.appendChild(container);
    }
    this.container = container;
    this.container.style.display = 'none';
  }

  show(onClose: () => void): void {
    this.removeKeyListener();
    this.container.style.display = 'flex';

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    requestAnimationFrame(() => {
      if (this.keydownHandler) {
        window.addEventListener('keydown', this.keydownHandler);
      }
    });
  }

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
