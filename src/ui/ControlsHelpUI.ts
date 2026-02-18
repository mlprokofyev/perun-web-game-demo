/**
 * HTML overlay listing all game controls.
 * Toggle with H key.
 */
export class ControlsHelpUI {
  private container: HTMLElement;

  constructor() {
    let container = document.getElementById('controls-help-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'controls-help-container';
      container.innerHTML = `
        <div class="controls-help-box">
          <div class="controls-help-title">УПРАВЛЕНИЕ</div>
          <div class="controls-help-content">
            <div class="controls-help-section">Движение</div>
            <div class="controls-help-row"><span class="key">WASD</span> / <span class="key">Стрелки</span> <span class="controls-help-desc">Ходить</span></div>
            <div class="controls-help-row"><span class="key">Shift</span> <span class="controls-help-desc">Бежать</span></div>
            <div class="controls-help-row"><span class="key">Scroll</span> <span class="controls-help-desc">Масштаб</span></div>
            <div class="controls-help-section">Взаимодействие</div>
            <div class="controls-help-row"><span class="key">E</span> <span class="controls-help-desc">Действие / Разговор</span></div>
            <div class="controls-help-row"><span class="key">I</span> <span class="controls-help-desc">Инвентарь</span></div>
            <div class="controls-help-row"><span class="key">J</span> <span class="controls-help-desc">Журнал заданий</span></div>
            <div class="controls-help-section">Окружение</div>
            <div class="controls-help-row"><span class="key">N</span> <span class="controls-help-desc">Вкл/выкл снег</span></div>
            <div class="controls-help-row"><span class="key">T</span> <span class="controls-help-desc">День / Ночь</span></div>
            <div class="controls-help-section">Отладка</div>
            <div class="controls-help-row"><span class="key">L</span> <span class="controls-help-desc">Вкл/выкл освещение</span></div>
            <div class="controls-help-row"><span class="key">G</span> <span class="controls-help-desc">Сетка (удерживать)</span></div>
            <div class="controls-help-row"><span class="key">U</span> <span class="controls-help-desc">Отладочная панель</span></div>
          </div>
          <div class="controls-help-hint"><span class="key">H</span> / <span class="key">ESC</span> закрыть</div>
        </div>
      `;
      document.getElementById('game-container')!.appendChild(container);
    }
    this.container = container;
    this.container.style.display = 'none';
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  get visible(): boolean {
    return this.container.style.display !== 'none';
  }
}
