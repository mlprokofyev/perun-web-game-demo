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
          <div class="controls-help-title">CONTROLS</div>
          <div class="controls-help-content">
            <div class="controls-help-section">Movement</div>
            <div class="controls-help-row"><span class="key">WASD</span> / <span class="key">Arrows</span> <span class="controls-help-desc">Move</span></div>
            <div class="controls-help-row"><span class="key">Shift</span> <span class="controls-help-desc">Run</span></div>
            <div class="controls-help-row"><span class="key">Scroll</span> <span class="controls-help-desc">Zoom</span></div>
            <div class="controls-help-section">Interaction</div>
            <div class="controls-help-row"><span class="key">E</span> <span class="controls-help-desc">Interact / Talk</span></div>
            <div class="controls-help-row"><span class="key">I</span> <span class="controls-help-desc">Inventory</span></div>
            <div class="controls-help-row"><span class="key">J</span> <span class="controls-help-desc">Quest Log</span></div>
            <div class="controls-help-section">Environment</div>
            <div class="controls-help-row"><span class="key">T</span> <span class="controls-help-desc">Day / Night</span></div>
            <div class="controls-help-row"><span class="key">N</span> <span class="controls-help-desc">Toggle Snow</span></div>
            <div class="controls-help-row"><span class="key">L</span> <span class="controls-help-desc">Toggle Lighting</span></div>
            <div class="controls-help-section">Debug</div>
            <div class="controls-help-row"><span class="key">G</span> <span class="controls-help-desc">Grid Overlay (hold)</span></div>
            <div class="controls-help-row"><span class="key">U</span> <span class="controls-help-desc">Debug Info</span></div>
          </div>
          <div class="controls-help-hint"><span class="key">H</span> / <span class="key">ESC</span> close</div>
        </div>
      `;
      document.getElementById('game-container')!.appendChild(container);
    }
    this.container = container;
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
