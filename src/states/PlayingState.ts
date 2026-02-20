import { GameState } from '../core/GameState';
import type { Game } from '../core/Game';

export class PlayingState extends GameState {
  constructor(private game: Game) {
    super();
  }

  update(dt: number): void {
    this.game._update(dt);
  }

  render(dt: number): void {
    this.game._render(dt);
  }
}
