import { Entity } from './Entity';

export interface InteractableObjectOptions {
  col: number;
  row: number;
  /** Prompt label shown to the player (e.g. "collect sticks") */
  label: string;
  /** Called when the player presses E. Return true if the interaction succeeded. */
  onInteract: () => boolean;
  /** Interaction radius in grid units (default: Config.NPC_INTERACT_RADIUS) */
  radius?: number;
}

/**
 * Invisible entity that exists solely for interaction.
 * The visual representation is a separate TileMap static object —
 * this entity handles the "Press E" interaction logic.
 */
export class InteractableObject extends Entity {
  /** Whether this object has been used up / depleted. */
  depleted: boolean = false;

  /** Grid-unit radius for player proximity check (defaults to NPC_INTERACT_RADIUS). */
  readonly interactRadius: number;

  private onInteractCb: () => boolean;

  constructor(id: string, opts: InteractableObjectOptions) {
    super(id);
    this.layer = 'ground';
    this.solid = false;
    this.opacity = 0; // invisible — visual handled by TileMap object
    this.interactable = true;
    this.interactLabel = opts.label;
    this.transform.set(opts.col, opts.row);
    this.onInteractCb = opts.onInteract;
    this.interactRadius = opts.radius ?? 1.2;
  }

  /** Execute the interaction callback. */
  interact(): boolean {
    if (this.depleted) return false;
    return this.onInteractCb();
  }

  /** Mark this object as depleted (no longer interactable). */
  deplete(): void {
    this.depleted = true;
    this.interactable = false;
  }
}
