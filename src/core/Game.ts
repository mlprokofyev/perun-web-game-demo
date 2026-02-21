import { Config } from './Config';
import { Camera } from '../rendering/Camera';
import { Renderer } from '../rendering/Renderer';
import { PostProcessPipeline } from '../rendering/PostProcessPipeline';
import { KeyboardInputProvider } from '../systems/KeyboardInputProvider';
import { TouchInputProvider } from '../systems/TouchInputProvider';
import type { InputProvider } from './InputProvider';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { NPC } from '../entities/NPC';
import { Player } from '../entities/Player';
import { Campfire } from '../entities/Campfire';
import { TileMap } from '../world/TileMap';
import { HUD } from '../ui/HUD';
import { DialogUI } from '../ui/DialogUI';
import { InventoryUI } from '../ui/InventoryUI';
import { QuestLogUI } from '../ui/QuestLogUI';
import { ControlsHelpUI } from '../ui/ControlsHelpUI';
import { DialogState } from '../states/DialogState';
import { ItemPreviewUI } from '../ui/ItemPreviewUI';
import { NoteUI } from '../ui/NoteUI';
import { getDialogTree } from '../dialog/DialogData';
// Side-effect imports: registers sample dialog + items + quests
import '../dialog/DialogData';
import '../items/ItemDef';
import '../quests/QuestDef';
import { isoToScreen } from '../rendering/IsometricUtils';
import { assetLoader } from '../core/AssetLoader';
import { EntityManager } from './EntityManager';
import { eventBus } from './EventBus';
import { InputManager, Action } from './InputManager';
import { GameStateManager } from './GameState';
import { FireLightEffect } from '../rendering/effects/FireLightEffect';
import { LightingProfile, NIGHT_PROFILE, DAY_PROFILE, lerpProfile } from '../rendering/LightingProfile';
import { questTracker } from '../quests/QuestTracker';
import { getItemDef } from '../items/ItemDef';
import { PlayingState } from '../states/PlayingState';
import { InteractionSystem } from '../systems/InteractionSystem';
import { GameplaySystem } from '../systems/GameplaySystem';
import { RenderOrchestrator } from '../rendering/RenderOrchestrator';
import {
  createPlayer,
  createCampfire,
  createDogNPC,
  createCollectibles,
  createStickPileInteractables,
  createDoorInteractable,
  createNoteInteractable,
} from '../scenes/ForestSceneSetup';

export class Game {
  private camera: Camera;
  private renderer: Renderer;
  private postProcess: PostProcessPipeline;
  private inputManager: InputManager;
  private touchProvider: TouchInputProvider | null = null;
  private physics: PhysicsSystem;
  private animationSystem: AnimationSystem;
  private entityManager: EntityManager;
  private stateManager: GameStateManager;
  private interactionSystem: InteractionSystem;
  private gameplaySystem: GameplaySystem;
  private renderOrchestrator: RenderOrchestrator;

  private player: Player;
  private campfire: Campfire;
  private campfireFlicker: FireLightEffect;
  private tileMap: TileMap;

  private hud: HUD;
  private dialogUI: DialogUI;
  private inventoryUI: InventoryUI;
  private questLogUI: QuestLogUI;
  private controlsHelpUI: ControlsHelpUI;
  private itemPreviewUI: ItemPreviewUI;
  private noteUI: NoteUI;

  private lastTimestamp: number = 0;
  private elapsed: number = 0;
  private running: boolean = false;

  /** Touch idle-zoom state */
  private idleTimer = 0;
  private isIdle = false;

  /** Toggle tracking (edge-triggered) */
  private lightTogglePrev = false;
  private snowTogglePrev = false;
  private snowEnabled = true;
  private inventoryTogglePrev = false;
  private questLogTogglePrev = false;
  private controlsHelpTogglePrev = false;
  private debugTogglePrev = false;
  private questHudTogglePrev = false;
  private timeTogglePrev = false;

  /** Day/night lighting profile system */
  private isNight = true;
  private activeProfile: LightingProfile = { ...NIGHT_PROFILE };
  private targetProfile: LightingProfile = NIGHT_PROFILE;
  private profileLerpT = 1;
  private static readonly PROFILE_TRANSITION_SPEED = 1.5;

  constructor(container: HTMLElement, tileMap: TileMap) {
    this.tileMap = tileMap;

    // ── Rendering infrastructure ──────────────────────────────
    this.camera = new Camera();
    this.renderer = new Renderer(container, this.camera);
    this.postProcess = new PostProcessPipeline(container, this.renderer.canvas);
    this.postProcess.enabled = Config.LIGHTING_ENABLED;

    // Marker overlay canvas (above WebGL post-process, below DOM UI)
    const markerCanvas = document.createElement('canvas');
    Object.assign(markerCanvas.style, {
      position: 'absolute',
      top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none',
      zIndex: '2',
      imageRendering: 'pixelated',
    } as CSSStyleDeclaration);
    container.appendChild(markerCanvas);
    const markerCtx = markerCanvas.getContext('2d')!;
    markerCtx.imageSmoothingEnabled = false;
    const syncMarkerSize = () => {
      markerCanvas.width = window.innerWidth;
      markerCanvas.height = window.innerHeight;
      markerCtx.imageSmoothingEnabled = false;
    };
    syncMarkerSize();
    window.addEventListener('resize', syncMarkerSize);

    this.postProcess.setAmbient(
      NIGHT_PROFILE.ambientR,
      NIGHT_PROFILE.ambientG,
      NIGHT_PROFILE.ambientB,
    );

    // ── Input ─────────────────────────────────────────────────
    const providers: InputProvider[] = [];
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasFinePointer = matchMedia('(pointer: fine)').matches;

    if (!hasTouch || hasFinePointer) {
      providers.push(new KeyboardInputProvider(this.renderer.canvas, this.camera));
    }
    if (hasTouch) {
      this.touchProvider = new TouchInputProvider(container);
      providers.push(this.touchProvider);
    }

    this.inputManager = new InputManager(providers);

    // ── Core systems ──────────────────────────────────────────
    this.physics = new PhysicsSystem(tileMap);
    this.animationSystem = new AnimationSystem();
    this.entityManager = new EntityManager();

    // ── UI ────────────────────────────────────────────────────
    this.hud = new HUD();
    this.dialogUI = new DialogUI();
    this.inventoryUI = new InventoryUI();
    this.questLogUI = new QuestLogUI();
    this.controlsHelpUI = new ControlsHelpUI();
    this.itemPreviewUI = new ItemPreviewUI();
    this.noteUI = new NoteUI();
    const interactPrompt = document.getElementById('interact-prompt')!;

    document.getElementById('inv-preview')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.inv-preview-questlog')) {
        if (this.questLogUI.visible) {
          this.questLogUI.hide();
        } else {
          this.inventoryUI.hide();
          this.controlsHelpUI.hide();
          this.questLogUI.show();
        }
        return;
      }
      if (!this.inventoryUI.visible && !this.itemPreviewUI.visible && !this.noteUI.visible) {
        this.openInventory();
      }
    });

    // ── State manager ─────────────────────────────────────────
    this.stateManager = new GameStateManager();

    // ── Extracted systems ─────────────────────────────────────
    this.interactionSystem = new InteractionSystem(
      this.entityManager,
      this.inputManager,
      interactPrompt,
    );

    this.gameplaySystem = new GameplaySystem(
      this.entityManager,
      this.camera,
      this.tileMap,
      this.stateManager,
      this.itemPreviewUI,
    );
    if (this.touchProvider) {
      this.gameplaySystem.onboardingHintActive = false;
    }

    // ── Scene setup ───────────────────────────────────────────
    this.player = createPlayer(this.entityManager);

    this.campfire = createCampfire(this.entityManager);
    this.campfireFlicker = new FireLightEffect({
      baseR: Config.CAMPFIRE_LIGHT_R,
      baseG: Config.CAMPFIRE_LIGHT_G,
      baseB: Config.CAMPFIRE_LIGHT_B,
    });

    this.gameplaySystem.pendingEvents.push({
      timer: Config.DOG_SPAWN_DELAY,
      callback: () => {
        const dog = createDogNPC(this.entityManager);
        this.gameplaySystem.dogNPC = dog;
      },
    });

    createCollectibles(this.entityManager);
    createStickPileInteractables(this.entityManager, this.tileMap, this.gameplaySystem);
    createDoorInteractable(this.entityManager);
    createNoteInteractable(this.entityManager, this.noteUI);

    eventBus.on('dialog:request', ({ dialogId }) => {
      const tree = getDialogTree(dialogId);
      if (!tree) return;
      this.interactionSystem.hidePrompt();
      const dialogState = new DialogState(tree, this.dialogUI, () => {
        this.stateManager.pop();
      });
      this.stateManager.push(dialogState);
    });

    eventBus.on('door:reveal', () => {
      this.noteUI.show(() => { this.noteUI.hide(); },
        `<div class="note-title">🚪</div>
         <div class="note-body">
           <p>Что находится за этой дверью? Вы узнаете чуть позже, она в разработке. Предлагаю относиться к этому, как к сериалу: в каждой серии будет что-то новенькое, но не всё сразу!</p>
           <p><strong>Продолжение следует...</strong></p>
         </div>
         <div class="note-hint">
           <span class="keyboard-hint">Нажмите <span class="key">Enter</span> или <span class="key">ESC</span> чтобы закрыть</span>
           <span class="touch-hint">Нажмите чтобы закрыть</span>
         </div>`);
    });

    // ── Quest tracker ─────────────────────────────────────────
    questTracker.init();
    questTracker.start('q_gather_sticks');

    // ── Render orchestrator ───────────────────────────────────
    this.renderOrchestrator = new RenderOrchestrator({
      renderer: this.renderer,
      postProcess: this.postProcess,
      camera: this.camera,
      tileMap: this.tileMap,
      entityManager: this.entityManager,
      inputManager: this.inputManager,
      player: this.player,
      campfire: this.campfire,
      campfireFlicker: this.campfireFlicker,
      stateManager: this.stateManager,
      markerCanvas,
      markerCtx,
      gameplaySystem: this.gameplaySystem,
      isTouch: this.touchProvider !== null,
    });

    // ── Start ─────────────────────────────────────────────────
    this.stateManager.push(new PlayingState(this));

    const playerWorld = isoToScreen(this.player.transform.x, this.player.transform.y);
    this.camera.follow(playerWorld.x, playerWorld.y);
    this.camera.snap();
  }

  start(): void {
    this.running = true;
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';

    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private loop = (timestamp: number): void => {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    this.stateManager.update(dt);
    this.stateManager.render(dt);

    requestAnimationFrame(this.loop);
  };

  /** @internal — called by PlayingState */
  _update(dt: number): void {
    // Block player input during overlays
    if (!this.inventoryUI.visible && !this.itemPreviewUI.visible && !this.noteUI.visible) {
      this.player.handleInput(this.inputManager);
    } else if (this.player.velocity) {
      this.player.velocity.vx = 0;
      this.player.velocity.vy = 0;
    }

    const entities = this.entityManager.getAll();

    this.gameplaySystem.updateOnboarding(dt, this.player.velocity);

    this.physics.update(dt, entities);

    for (const e of entities) {
      if (e instanceof NPC) e.update(dt);
    }

    if (this.activeProfile.fireOpacity > 0.001) {
      this.campfire.updateSparks(dt);
    }

    this.animationSystem.update(dt, entities);

    const pw = isoToScreen(this.player.transform.x, this.player.transform.y);
    this.camera.follow(pw.x, pw.y);
    this.camera.update(dt);

    eventBus.emit('player:moved', { x: this.player.transform.x, y: this.player.transform.y });

    this.gameplaySystem.updateCampfireInteractable(this.campfire, this.isNight);

    const interaction = this.interactionSystem.update(
      this.player.transform.x,
      this.player.transform.y,
    );
    if (this.touchProvider) {
      const label = this.interactionSystem.nearestInteractLabel;
      this.touchProvider.setInteractVisible(label !== null, label ?? undefined);
    }
    if (interaction) {
      switch (interaction.type) {
        case 'npc': this.openDialog(interaction.entity); break;
        case 'interactable': interaction.entity.interact(); break;
        case 'campfire': this.gameplaySystem.interactWithCampfire(this.campfire); break;
      }
    }

    this.gameplaySystem.updatePendingEvents(dt);
    this.gameplaySystem.updateCollectibles(dt, this.player.transform.x, this.player.transform.y);
    this.gameplaySystem.updateTriggerZones();
    this.gameplaySystem.updateFloatingTexts(dt);

    this.hud.update(dt, this.player, this.camera, this.tileMap);

    if (this.touchProvider) {
      this.updateIdleZoom(dt);
    }
  }

  private updateIdleZoom(dt: number): void {
    const v = this.player.velocity;
    const moving = v && (Math.abs(v.vx) > 0.001 || Math.abs(v.vy) > 0.001);

    if (moving) {
      this.idleTimer = 0;
      if (this.isIdle) {
        this.isIdle = false;
        this.camera.setTargetZoom(Config.CAMERA_DEFAULT_ZOOM);
        this.hud.setIdleMode(false);
        this.touchProvider!.setInteractVisible(false);
      }
      return;
    }

    if (!this.isIdle) {
      this.idleTimer += dt;
      if (this.idleTimer >= Config.CAMERA_IDLE_DELAY) {
        this.isIdle = true;
        this.camera.setTargetZoom(Config.CAMERA_IDLE_ZOOM);
        this.hud.setIdleMode(true);
      }
    }
  }

  /** @internal — called by PlayingState */
  _render(dt: number): void {
    this.elapsed += dt;

    this.handleInputToggles();
    this.updateProfileTransition(dt);
    this.applyLightingProfile();

    this.renderOrchestrator.render(dt, {
      elapsed: this.elapsed,
      activeProfile: this.activeProfile,
      snowEnabled: this.snowEnabled,
      nearestInteractId: this.interactionSystem.nearestInteractId,
    });
  }

  // ─── Input toggle handling ──────────────────────────────────

  private handleInputToggles(): void {
    const lDown = this.inputManager.isActionDown(Action.TOGGLE_LIGHT);
    if (lDown && !this.lightTogglePrev) {
      this.postProcess.enabled = !this.postProcess.enabled;
    }
    this.lightTogglePrev = lDown;

    const nDown = this.inputManager.isActionDown(Action.TOGGLE_SNOW);
    if (nDown && !this.snowTogglePrev) {
      this.snowEnabled = !this.snowEnabled;
    }
    this.snowTogglePrev = nDown;

    const iDown = this.inputManager.isActionDown(Action.INVENTORY);
    if (iDown && !this.inventoryTogglePrev && !this.inventoryUI.visible && !this.itemPreviewUI.visible && !this.noteUI.visible) {
      this.questLogUI.hide();
      this.controlsHelpUI.hide();
      this.openInventory();
    }
    this.inventoryTogglePrev = iDown;

    const jDown = this.inputManager.isActionDown(Action.QUEST_LOG);
    if (jDown && !this.questLogTogglePrev) {
      if (this.questLogUI.visible) {
        this.questLogUI.hide();
      } else {
        this.inventoryUI.hide();
        this.controlsHelpUI.hide();
        this.questLogUI.show();
      }
    }
    this.questLogTogglePrev = jDown;

    const hDown = this.inputManager.isActionDown(Action.CONTROLS_HELP);
    if (hDown && !this.controlsHelpTogglePrev) {
      if (this.controlsHelpUI.visible) {
        this.controlsHelpUI.hide();
      } else {
        this.inventoryUI.hide();
        this.questLogUI.hide();
        this.controlsHelpUI.show();
      }
    }
    this.controlsHelpTogglePrev = hDown;

    const escDown = this.inputManager.isActionDown(Action.PAUSE);
    if (escDown) {
      if (this.noteUI.visible) {
        this.noteUI.hide();
      } else if (this.itemPreviewUI.visible) {
        this.itemPreviewUI.hide();
      } else if (this.inventoryUI.visible) {
        this.inventoryUI.hide();
      } else if (this.questLogUI.visible) {
        this.questLogUI.hide();
      } else if (this.controlsHelpUI.visible) {
        this.controlsHelpUI.hide();
      }
    }

    const uDown = this.inputManager.isActionDown(Action.TOGGLE_DEBUG);
    if (uDown && !this.debugTogglePrev) {
      this.hud.setDebugVisible(!this.hud.debugVisible);
    }
    this.debugTogglePrev = uDown;

    const qDown = this.inputManager.isActionDown(Action.TOGGLE_QUEST_HUD);
    if (qDown && !this.questHudTogglePrev) {
      this.hud.setQuestHudVisible(!this.hud.questHudVisible);
    }
    this.questHudTogglePrev = qDown;
  }

  // ─── Day/night profile transition ──────────────────────────

  private updateProfileTransition(dt: number): void {
    const tDown = this.inputManager.isActionDown(Action.TOGGLE_TIME);
    if (tDown && !this.timeTogglePrev) {
      this.isNight = !this.isNight;
      this.targetProfile = this.isNight ? NIGHT_PROFILE : DAY_PROFILE;
      this.profileLerpT = 0;
    }
    this.timeTogglePrev = tDown;

    if (this.profileLerpT < 1) {
      this.profileLerpT = Math.min(1, this.profileLerpT + dt / Game.PROFILE_TRANSITION_SPEED);
      const ease = this.profileLerpT < 0.5
        ? 2 * this.profileLerpT * this.profileLerpT
        : 1 - Math.pow(-2 * this.profileLerpT + 2, 2) / 2;
      const from = this.isNight ? DAY_PROFILE : NIGHT_PROFILE;
      this.activeProfile = lerpProfile(from, this.targetProfile, ease);
    }
  }

  private applyLightingProfile(): void {
    const p = this.activeProfile;

    const toHex = (r: number, g: number, b: number) =>
      '#' + [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
    this.renderer.setBackgroundColor(toHex(p.bgR, p.bgG, p.bgB));

    this.postProcess.setAmbient(p.ambientR, p.ambientG, p.ambientB);
    this.postProcess.setShadowLengthMult(p.shadowLengthMult);
    this.postProcess.setShadowOpacity(p.shadowOpacity);

    this.campfire.opacity = p.fireOpacity;
    this.renderer.applyEffectProfile(p);
  }

  // ─── Dialog / Inventory ─────────────────────────────────────

  private openInventory(): void {
    this.inventoryUI.show(
      (itemId: string) => {
        const def = getItemDef(itemId);
        if (!def) return;
        this.inventoryUI.hide();
        this.itemPreviewUI.show(def, () => {
          this.itemPreviewUI.hide();
          this.openInventory();
        }, { showLabel: false });
      },
      () => {
        this.inventoryUI.hide();
      },
    );
  }

  private openDialog(npc: NPC): void {
    const tree = getDialogTree(npc.dialogId);
    if (!tree) return;

    this.interactionSystem.hidePrompt();

    const dialogState = new DialogState(tree, this.dialogUI, () => {
      this.stateManager.pop();
    });
    this.stateManager.push(dialogState);
  }
}
