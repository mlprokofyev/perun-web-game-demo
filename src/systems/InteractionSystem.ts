import { Entity } from '../entities/Entity';
import { InteractableObject } from '../entities/InteractableObject';
import { NPC } from '../entities/NPC';
import { Campfire } from '../entities/Campfire';
import { EntityManager } from '../core/EntityManager';
import { InputManager, Action } from '../core/InputManager';
import { Config } from '../core/Config';

export type InteractionTarget =
  | { type: 'npc'; entity: NPC }
  | { type: 'interactable'; entity: InteractableObject }
  | { type: 'campfire'; entity: Campfire };

export class InteractionSystem {
  private interactPrev = false;
  nearestInteractId: string | null = null;
  nearestInteractLabel: string | null = null;

  constructor(
    private entityManager: EntityManager,
    private inputManager: InputManager,
    private interactPrompt: HTMLElement,
  ) {}

  hidePrompt(): void {
    this.interactPrompt.style.display = 'none';
  }

  update(playerX: number, playerY: number): InteractionTarget | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;
    let onboardEntity: Entity | null = null;
    let onboardDist = Infinity;

    for (const e of this.entityManager.getAll()) {
      if (!e.interactable) continue;
      const interactR = (e instanceof InteractableObject) ? e.interactRadius : Config.NPC_INTERACT_RADIUS;
      const onboardR = Config.NPC_ONBOARD_RADIUS;
      const dx = e.transform.x - playerX;
      const dy = e.transform.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= interactR && dist < nearestDist) {
        nearest = e;
        nearestDist = dist;
      }
      if (dist <= onboardR && dist < onboardDist) {
        onboardEntity = e;
        onboardDist = dist;
      }
    }

    this.nearestInteractId = onboardEntity?.id ?? null;

    if (nearest) {
      const label = nearest.interactLabel || 'действовать';
      this.nearestInteractLabel = label;
      this.interactPrompt.innerHTML = `Нажмите <span class="key">E</span> — ${label}`;
      this.interactPrompt.style.display = '';
    } else {
      this.nearestInteractLabel = null;
      this.interactPrompt.style.display = 'none';
    }

    const eDown = this.inputManager.isActionDown(Action.INTERACT);
    let result: InteractionTarget | null = null;
    if (eDown && !this.interactPrev && nearest) {
      if (nearest instanceof NPC) {
        result = { type: 'npc', entity: nearest };
      } else if (nearest instanceof InteractableObject) {
        result = { type: 'interactable', entity: nearest };
      } else if (nearest instanceof Campfire) {
        result = { type: 'campfire', entity: nearest };
      }
    }
    this.interactPrev = eDown;
    return result;
  }
}
