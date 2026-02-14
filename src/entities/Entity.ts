import { Transform, Velocity, Collider } from './Components';
import { AnimationController } from './AnimationController';

/** Base entity in the game world.
 *  Only `transform` is mandatory — all other components are optional.
 *  Systems check for component presence before operating on an entity.
 */
export class Entity {
  id: string;

  /** Every entity has a position */
  transform: Transform = new Transform();

  /** Optional: movement velocity (needed for physics) */
  velocity: Velocity | null = null;

  /** Optional: collision shape (needed for physics) */
  collider: Collider | null = null;

  /** Optional: animation controller (needed for animated sprites) */
  animController: AnimationController | null = null;

  /** If true, this entity blocks movement */
  solid: boolean = false;

  /** Render layer hint */
  layer: 'ground' | 'object' | 'character' = 'character';

  /** Scale factor applied when drawing the sprite (1 = native pixel size) */
  drawScale: number = 1;

  /** Render opacity (0 = invisible, 1 = fully opaque). Affects sprite + shadow. */
  opacity: number = 1;

  /** Blob shadow parameters. null = no shadow drawn. */
  blobShadow: { rx: number; ry: number; opacity: number } | null = null;

  constructor(id: string) {
    this.id = id;
  }
}
