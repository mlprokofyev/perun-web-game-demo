import { Transform, Velocity, Collider } from './Components';
import { AnimationController } from './AnimationController';

/** Base entity in the game world */
export class Entity {
  id: string;
  transform: Transform = new Transform();
  velocity: Velocity = new Velocity();
  collider: Collider = new Collider();
  animController: AnimationController = new AnimationController();
  /** If true, this entity blocks movement */
  solid: boolean = false;
  /** Render layer hint */
  layer: 'ground' | 'object' | 'character' = 'character';

  constructor(id: string) {
    this.id = id;
  }
}
