# Isometric 2.5D Pixel Art Browser Game - Software Architecture

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client-Side)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Game Application Layer                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │   │
│  │  │   Game   │  │   UI     │  │   Save/Load     │   │   │
│  │  │   Loop   │  │  Manager │  │   Manager       │   │   │
│  │  └──────────┘  └──────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Game Engine Layer                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │   │
│  │  │ Renderer │  │  Physics │  │   Collision     │   │   │
│  │  │ (Canvas) │  │  Engine  │  │   Detection     │   │   │
│  │  └──────────┘  └──────────┘  └─────────────────┘   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │   │
│  │  │  Input   │  │  Audio   │  │   Animation     │   │   │
│  │  │ Handler  │  │  Engine  │  │   System        │   │   │
│  │  └──────────┘  └──────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Core Systems Layer                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │   │
│  │  │  Asset   │  │  Entity  │  │   Scene         │   │   │
│  │  │ Manager  │  │ Component│  │   Manager       │   │   │
│  │  │          │  │  System  │  │                 │   │   │
│  │  └──────────┘  └──────────┘  └─────────────────┘   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │   │
│  │  │  Event   │  │  State   │  │   Isometric     │   │   │
│  │  │  System  │  │ Manager  │  │   Grid System   │   │   │
│  │  └──────────┘  └──────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 2. Technology Stack

### Core Technologies
- **HTML5 Canvas** - 2D rendering context for pixel-perfect graphics
- **WebGL2** - Post-processing pass for real-time lighting and shadows (GLSL 300 es)
- **TypeScript/JavaScript** - Main programming language
- **Webpack/Vite** - Module bundler and dev server

### Recommended Libraries
- **Pixi.js** or **Phaser 3** - Game framework (optional but recommended)
  - Pixi.js: Lightweight, fast 2D rendering
  - Phaser 3: Full-featured game framework with built-in physics
- **Howler.js** - Audio management
- **localForage** - IndexedDB wrapper for save games

### Optional Enhancements
- **Matter.js** or **Box2D** - Physics engine (if needed)
- **Tiled** - Map editor for isometric tile maps (export to JSON)
- **webpack-image-loader** - Automatic sprite sheet generation

## 3. Directory Structure

```
/project-root
│
├── /public
│   ├── index.html
│   └── /assets
│       ├── /sprites
│       │   ├── /characters
│       │   ├── /tiles
│       │   ├── /objects
│       │   └── /ui
│       ├── /audio
│       │   ├── /music
│       │   └── /sfx
│       └── /data
│           ├── maps.json
│           └── config.json
│
├── /src
│   ├── main.ts                    # Entry point
│   ├── /core
│   │   ├── Game.ts                # Main game class
│   │   ├── AssetLoader.ts         # PNG asset loading
│   │   ├── EventBus.ts            # Event system
│   │   └── Config.ts              # Game configuration
│   │
│   ├── /rendering
│   │   ├── Renderer.ts            # Canvas 2D rendering
│   │   ├── PostProcessPipeline.ts # WebGL2 lighting & shadow post-process
│   │   ├── Camera.ts              # Viewport/camera system
│   │   ├── IsometricUtils.ts     # Coordinate conversions
│   │   └── SpriteRenderer.ts     # PNG sprite rendering
│   │
│   ├── /world
│   │   ├── TileMap.ts             # Isometric tile map
│   │   ├── Grid.ts                # Grid system for iso space
│   │   ├── Layer.ts               # Multi-layer rendering
│   │   └── WorldLoader.ts         # Load map data
│   │
│   ├── /entities
│   │   ├── Entity.ts              # Base entity class
│   │   ├── Player.ts              # Player character
│   │   ├── NPC.ts                 # Non-player characters
│   │   └── /components
│   │       ├── Transform.ts       # Position, rotation, scale
│   │       ├── Sprite.ts          # Visual representation
│   │       ├── Collider.ts        # Collision box
│   │       └── Movement.ts        # Movement behavior
│   │
│   ├── /systems
│   │   ├── InputSystem.ts         # Keyboard/mouse input
│   │   ├── PhysicsSystem.ts       # Movement & collision
│   │   ├── AnimationSystem.ts     # Sprite animation
│   │   └── AISystem.ts            # NPC behavior
│   │
│   ├── /ui
│   │   ├── UIManager.ts           # UI rendering
│   │   ├── HUD.ts                 # Heads-up display
│   │   ├── Menu.ts                # Game menus
│   │   └── Dialog.ts              # Dialog boxes
│   │
│   ├── /audio
│   │   ├── AudioManager.ts        # Sound playback
│   │   └── MusicPlayer.ts         # Background music
│   │
│   └── /utils
│       ├── Math.ts                # Math utilities
│       ├── SaveManager.ts         # Save/load game state
│       └── Debug.ts               # Debug tools
│
├── package.json
├── tsconfig.json
└── webpack.config.js / vite.config.js
```

## 4. Core Systems Detailed Design

### 4.1 Isometric Coordinate System

```typescript
// Convert screen coordinates to isometric grid
function screenToIso(screenX: number, screenY: number): {x: number, y: number} {
  const tileWidth = 64;   // PNG tile width
  const tileHeight = 32;  // PNG tile height
  
  const x = (screenX / (tileWidth / 2) + screenY / (tileHeight / 2)) / 2;
  const y = (screenY / (tileHeight / 2) - screenX / (tileWidth / 2)) / 2;
  
  return {x: Math.floor(x), y: Math.floor(y)};
}

// Convert isometric grid to screen coordinates
function isoToScreen(gridX: number, gridY: number): {x: number, y: number} {
  const tileWidth = 64;
  const tileHeight = 32;
  
  const x = (gridX - gridY) * (tileWidth / 2);
  const y = (gridX + gridY) * (tileHeight / 2);
  
  return {x, y};
}
```

### 4.2 Asset Management

```typescript
class AssetLoader {
  private assets: Map<string, HTMLImageElement> = new Map();
  private manifest: AssetManifest;
  
  async loadAssets(manifest: AssetManifest): Promise<void> {
    const promises = manifest.sprites.map(sprite => 
      this.loadImage(sprite.id, sprite.path)
    );
    await Promise.all(promises);
  }
  
  private loadImage(id: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.assets.set(id, img);
        resolve();
      };
      img.onerror = reject;
      img.src = path;
    });
  }
  
  getAsset(id: string): HTMLImageElement | undefined {
    return this.assets.get(id);
  }
}
```

### 4.3 Rendering System with Z-Sorting

```typescript
class IsometricRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  
  render(entities: Entity[]): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Z-sort entities (painter's algorithm)
    const sorted = entities.sort((a, b) => {
      const aDepth = a.position.x + a.position.y;
      const bDepth = b.position.x + b.position.y;
      return aDepth - bDepth;
    });
    
    // Render in order
    for (const entity of sorted) {
      this.renderEntity(entity);
    }
  }
  
  private renderEntity(entity: Entity): void {
    const screenPos = isoToScreen(entity.position.x, entity.position.y);
    const sprite = assetLoader.getAsset(entity.spriteId);
    
    if (sprite) {
      this.ctx.drawImage(
        sprite,
        screenPos.x - this.camera.x,
        screenPos.y - this.camera.y - entity.position.z // z for height
      );
    }
  }
}
```

### 4.4 Game Loop

```typescript
class Game {
  private lastTimestamp: number = 0;
  private readonly TARGET_FPS = 60;
  private readonly FRAME_TIME = 1000 / this.TARGET_FPS;
  
  start(): void {
    requestAnimationFrame(this.gameLoop.bind(this));
  }
  
  private gameLoop(timestamp: number): void {
    const deltaTime = timestamp - this.lastTimestamp;
    
    if (deltaTime >= this.FRAME_TIME) {
      // Update game state
      this.update(deltaTime / 1000); // Convert to seconds
      
      // Render
      this.render();
      
      this.lastTimestamp = timestamp;
    }
    
    requestAnimationFrame(this.gameLoop.bind(this));
  }
  
  private update(dt: number): void {
    inputSystem.update();
    physicsSystem.update(dt);
    animationSystem.update(dt);
    aiSystem.update(dt);
  }
  
  private render(): void {
    renderer.render(sceneManager.getCurrentScene().entities);
    uiManager.render();
  }
}
```

### 4.5 Entity Component System (ECS)

```typescript
class Entity {
  id: string;
  components: Map<string, Component> = new Map();
  
  addComponent<T extends Component>(component: T): void {
    this.components.set(component.constructor.name, component);
  }
  
  getComponent<T extends Component>(type: new(...args: any[]) => T): T | undefined {
    return this.components.get(type.name) as T;
  }
}

// Example components
class Transform {
  x: number = 0;
  y: number = 0;
  z: number = 0; // Height above ground
}

class Sprite {
  spriteId: string;
  currentFrame: number = 0;
  animations: Map<string, Animation> = new Map();
}

class Collider {
  width: number;
  height: number;
  offset: {x: number, y: number};
}
```

## 5. Data Flow

```
User Input → InputSystem → Entity Components → PhysicsSystem
                                               ↓
                                        Collision Detection
                                               ↓
                                        Update Positions
                                               ↓
                                        AnimationSystem
                                               ↓
                                        Z-Sort Entities
                                               ↓
                                        Renderer → Canvas
```

## 6. Asset Requirements & Specifications

### 6.1 Technical Requirements

#### **Tile Assets**
- **Dimensions**: 64x32px (2:1 isometric ratio) - MANDATORY
- **Format**: PNG with alpha transparency (32-bit RGBA)
- **Perspective**: Top-down isometric view
- **Grid alignment**: Bottom edge aligns with grid line
- **Naming**: `category_name_variant.png` (e.g., `grass_dark_01.png`)

#### **Character/Entity Assets**
- **Base size**: 64x64px per frame (for human-sized characters)
- **Large entities**: 64x96px, 64x128px (trees, buildings)
- **Format**: PNG with alpha transparency
- **Pivot point**: Center-bottom (where sprite "touches" ground)
- **Sprite sheets**: Horizontal arrangement of frames
- **Background**: Fully transparent (no padding)

#### **Building Assets**
- **Small structures**: 64x64px to 128x96px
- **Large structures**: 128x128px or larger
- **Format**: PNG with alpha transparency
- **Details**: Windows, doors should be clearly visible at scale

### 6.2 Character Animation Requirements

#### **Animation Directions (8-Directional System)**

**Option A: Full 8 Directions** (Recommended for polish)
- North (N)
- Northeast (NE)
- East (E)
- Southeast (SE)
- South (S)
- Southwest (SW)
- West (W)
- Northwest (NW)

**Option B: 4 Directions + Flipping** (Efficient)
- North, South, East, West
- Use horizontal flipping for missing directions
- Code handles diagonal interpolation

#### **Animation States & Frame Counts**

| Animation State | Frames | FPS | Sprite Sheet Size (4 frames) | Notes |
|----------------|--------|-----|------------------------------|-------|
| Idle | 1-4 | 4-6 | 64x64 to 256x64 | Subtle breathing |
| Walk | 4-8 | 8-12 | 256x64 (4 frames) | Per direction |
| Run | 6-8 | 12-15 | 384x64 to 512x64 | Optional, faster |
| Attack | 4-6 | 12-15 | 256x64 to 384x64 | If combat game |
| Jump | 3-4 | 10-12 | 192x64 to 256x64 | If applicable |

#### **Sprite Sheet Format**

```
player_walk_south.png (256x64px = 4 frames × 64px)
┌────────┬────────┬────────┬────────┐
│Frame 1 │Frame 2 │Frame 3 │Frame 4 │
│ 64x64  │ 64x64  │ 64x64  │ 64x64  │
│ Left   │ Both   │ Right  │ Both   │
│ foot   │ feet   │ foot   │ feet   │
│forward │together│forward │together│
└────────┴────────┴────────┴────────┘
```

**File naming convention:**
- `player_idle_south.png` (64x64, single frame)
- `player_walk_south.png` (256x64, 4 frames)
- `player_walk_north.png` (256x64, 4 frames)
- `player_walk_east.png` (256x64, 4 frames)
- `player_walk_west.png` (256x64, 4 frames)

### 6.3 Animation System Implementation

```typescript
// Animation data structure
interface AnimationData {
  spriteSheet: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number; // FPS
  loop: boolean;
}

// Animation controller
class AnimationController {
  private animations: Map<string, AnimationData> = new Map();
  private currentAnimation: string = "idle_south";
  private currentFrame: number = 0;
  private elapsed: number = 0;
  
  // Update animation frame based on delta time
  update(deltaTime: number): void {
    const anim = this.animations.get(this.currentAnimation);
    if (!anim) return;
    
    this.elapsed += deltaTime;
    const frameDuration = 1 / anim.frameRate;
    
    if (this.elapsed >= frameDuration) {
      this.currentFrame = (this.currentFrame + 1) % anim.frameCount;
      if (!anim.loop && this.currentFrame === 0) {
        this.currentFrame = anim.frameCount - 1;
      }
      this.elapsed = 0;
    }
  }
  
  // Set animation based on velocity direction
  setAnimationFromVelocity(vx: number, vy: number): void {
    if (vx === 0 && vy === 0) {
      this.play("idle_" + this.getCurrentDirection());
      return;
    }
    
    const direction = this.velocityToDirection(vx, vy);
    this.play(`walk_${direction}`);
  }
  
  private velocityToDirection(vx: number, vy: number): string {
    const angle = Math.atan2(vy, vx) * 180 / Math.PI;
    const normalized = (angle + 360) % 360;
    
    // 8-directional
    if (normalized >= 337.5 || normalized < 22.5) return "east";
    if (normalized >= 22.5 && normalized < 67.5) return "southeast";
    if (normalized >= 67.5 && normalized < 112.5) return "south";
    if (normalized >= 112.5 && normalized < 157.5) return "southwest";
    if (normalized >= 157.5 && normalized < 202.5) return "west";
    if (normalized >= 202.5 && normalized < 247.5) return "northwest";
    if (normalized >= 247.5 && normalized < 292.5) return "north";
    return "northeast";
  }
  
  play(animationName: string): void {
    if (this.currentAnimation !== animationName) {
      this.currentAnimation = animationName;
      this.currentFrame = 0;
      this.elapsed = 0;
    }
  }
  
  getCurrentFrame(): {x: number, y: number, width: number, height: number} {
    const anim = this.animations.get(this.currentAnimation);
    if (!anim) return {x: 0, y: 0, width: 64, height: 64};
    
    return {
      x: this.currentFrame * anim.frameWidth,
      y: 0,
      width: anim.frameWidth,
      height: anim.frameHeight
    };
  }
}
```

### 6.4 Sprite Sheet Loader

```typescript
class SpriteSheetLoader {
  async loadAnimation(
    path: string,
    frameWidth: number,
    frameHeight: number,
    frameCount: number,
    frameRate: number = 10,
    loop: boolean = true
  ): Promise<AnimationData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          spriteSheet: img,
          frameWidth,
          frameHeight,
          frameCount,
          frameRate,
          loop
        });
      };
      img.onerror = reject;
      img.src = path;
    });
  }
  
  // Extract individual frames (optional, for pre-processing)
  extractFrames(spriteSheet: HTMLImageElement, frameWidth: number, frameHeight: number, frameCount: number): HTMLCanvasElement[] {
    const frames: HTMLCanvasElement[] = [];
    
    for (let i = 0; i < frameCount; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = frameWidth;
      canvas.height = frameHeight;
      const ctx = canvas.getContext('2d')!;
      
      ctx.drawImage(
        spriteSheet,
        i * frameWidth, 0,
        frameWidth, frameHeight,
        0, 0,
        frameWidth, frameHeight
      );
      
      frames.push(canvas);
    }
    
    return frames;
  }
}
```

### 6.5 Asset Checklist

Before importing assets into the game:

- [ ] All PNGs have full alpha transparency (no white backgrounds)
- [ ] Tile sprites are exactly 64x32px (isometric 2:1 ratio)
- [ ] Character sprites are 64x64px per frame
- [ ] Sprite sheets have frames evenly spaced horizontally
- [ ] No extra padding/whitespace around sprites
- [ ] Character pivot point is at center-bottom of sprite
- [ ] All directional animations have matching frame counts
- [ ] Naming convention is consistent across all assets
- [ ] File sizes are optimized (use PNG compression tools)
- [ ] Assets tested at 1x, 2x, and 4x zoom levels

### 6.6 Asset Organization

### PNG Asset Structure
```
/assets/sprites/
  /tiles/
    - grass_01.png (64x32px)
    - dirt_01.png (64x32px)
    - stone_01.png (64x32px)
  /characters/
    - player_idle_south.png (64x64px, 1 frame)
    - player_walk_south.png (256x64px, 4 frames)
    - player_walk_north.png (256x64px, 4 frames)
    - player_walk_east.png (256x64px, 4 frames)
    - player_walk_west.png (256x64px, 4 frames)
  /objects/
    - tree_01.png (64x96px with transparency)
    - rock_01.png (64x64px)
    - house_01.png (128x128px)
  /ui/
    - button.png
    - panel.png
    - cursor.png
```

### 6.7 Asset Manifest (JSON)

Complete manifest file structure for asset loading:

```json
{
  "version": "1.0",
  "tiles": [
    {
      "id": "grass_01",
      "path": "/assets/sprites/tiles/grass_01.png",
      "width": 64,
      "height": 32
    },
    {
      "id": "dirt_01",
      "path": "/assets/sprites/tiles/dirt_01.png",
      "width": 64,
      "height": 32
    }
  ],
  "characters": {
    "player": {
      "idle": {
        "south": {
          "path": "/assets/sprites/characters/player_idle_south.png",
          "frames": 1,
          "frameWidth": 64,
          "frameHeight": 64,
          "frameRate": 6
        }
      },
      "walk": {
        "south": {
          "path": "/assets/sprites/characters/player_walk_south.png",
          "frames": 4,
          "frameWidth": 64,
          "frameHeight": 64,
          "frameRate": 10
        },
        "north": {
          "path": "/assets/sprites/characters/player_walk_north.png",
          "frames": 4,
          "frameWidth": 64,
          "frameHeight": 64,
          "frameRate": 10
        },
        "east": {
          "path": "/assets/sprites/characters/player_walk_east.png",
          "frames": 4,
          "frameWidth": 64,
          "frameHeight": 64,
          "frameRate": 10
        },
        "west": {
          "path": "/assets/sprites/characters/player_walk_west.png",
          "frames": 4,
          "frameWidth": 64,
          "frameHeight": 64,
          "frameRate": 10
        }
      }
    }
  },
  "objects": [
    {
      "id": "tree_01",
      "path": "/assets/sprites/objects/tree_01.png",
      "width": 64,
      "height": 96,
      "anchorY": 0.8
    },
    {
      "id": "rock_01",
      "path": "/assets/sprites/objects/rock_01.png",
      "width": 64,
      "height": 64
    },
    {
      "id": "house_01",
      "path": "/assets/sprites/objects/house_01.png",
      "width": 128,
      "height": 128,
      "anchorY": 0.75
    }
  ]
}
```

## 7. Lighting & Shadow System

### 7.1 Overview

The lighting system is a **WebGL2 post-processing pass** layered on top of the Canvas 2D renderer. It applies per-pixel lighting and soft shadows without modifying the 2D rendering pipeline.

```
┌──────────────────────────────┐
│   Canvas 2D (Renderer.ts)    │  ← Tiles, objects, player, fog
│   Unchanged 2D pipeline      │
└──────────┬───────────────────┘
           │ texImage2D (each frame)
           ▼
┌──────────────────────────────┐
│   WebGL2 overlay canvas      │  ← PostProcessPipeline.ts
│   Fragment shader applies:   │
│   • Ambient light            │
│   • Point lights + falloff   │
│   • Occluder soft shadows    │
│   • Player height fade       │
└──────────────────────────────┘
```

### 7.2 Fragment Shader Pipeline

```
for each pixel (fragPos):
    light = ambientColor

    for each point light i:
        attenuation = 1 − (dist / radius)²        // smooth quadratic falloff
        flicker     = noise-based modulation        // optional

        shadow = 1.0                                // fully lit
        for each occluder j:
            maxReach = occHeight[j] * shadowLenMult  // taller → longer shadow
            shadow = min(shadow, shadowFactor(fragPos, lightPos, occPos, occRadius, maxReach))

        // Player height fade: reduce shadow from feet (full) to head (reduced)
        if heightFadeActive and pixel inside player sprite:
            shadow = mix(shadow, 1.0, hx * hy * strength)

        light += color * intensity * attenuation * flicker * shadow

    finalColor = sceneColor * clamp(light, 0, 1)
```

### 7.3 Shadow Algorithm

The `shadowFactor()` function tests how much light reaches a fragment through a single circular occluder:

1. **Segment projection** — Project the occluder centre onto the frag→light line segment and find the closest point (clamped to segment bounds).
2. **Perpendicular penumbra** — Compare perpendicular distance to occluder radius using `smoothstep(r * 0.3, r * 2.0, perpDist)`. The wide range produces soft edges.
3. **Endpoint fade** — Instead of a hard `t < 0 || t > len` cut-off, a `smoothstep` fade over distance `r` around each endpoint prevents sharp shadow artifacts.
4. **Height-proportional reach** — Each occluder has a `height` (object's asset height × zoom). The shadow fades out beyond `maxReach = height × SHADOW_LENGTH_MULT`, so tall objects cast long shadows and short objects cast short ones.
5. **Multi-occluder combination** — Shadows from multiple occluders for the same light combine with `min()` (not multiplication) so overlapping objects don't produce unnaturally dark areas.

#### Complex shadow shapes

Simple objects (trees, stones) use a single `shadowRadius`. Complex objects (houses) define `shadowPoints` — a grid of overlapping circles that approximate the object's silhouette:

```typescript
shadowPoints: [
  { dx: -0.4, dy: -0.4, radius: 40 },
  { dx:  0.0, dy: -0.4, radius: 40 },
  { dx:  0.4, dy: -0.4, radius: 40 },
  { dx: -0.4, dy:  0.0, radius: 40 },
  { dx:  0.0, dy:  0.0, radius: 40 },
  { dx:  0.4, dy:  0.0, radius: 40 },
  { dx: -0.4, dy:  0.4, radius: 40 },
  { dx:  0.0, dy:  0.4, radius: 40 },
  { dx:  0.4, dy:  0.4, radius: 40 },
]
```

Each `dx/dy` is in grid-coordinate offsets from the object's `(col, row)`.

#### Player as shadow caster

The player is also registered as a circular occluder at their visual feet position. `PLAYER_FOOT_OFFSET` shifts the occluder up from the sprite's mathematical bottom to align with the character's actual feet (compensating for transparent padding in the sprite).

### 7.4 Player Height Fade

In pure 2D, a character entering shadow darkens uniformly top-to-bottom. The **height fade** simulates 3D by reducing shadow strength from feet to head within the player sprite bounds:

- **Horizontal containment**: `smoothstep` fades the effect to zero outside the sprite width.
- **Vertical bell curve**: Effect starts at zero at feet, peaks in the upper body, and fades back to zero above the head — preventing the effect from bleeding upward.

```glsl
float hx = 1.0 - smoothstep(width * 0.1, width * 0.85, dx);
float hy = smoothstep(0.0, height * 0.4, dy)
         * (1.0 - smoothstep(height * 0.85, height * 1.05, dy));
shadow = mix(shadow, 1.0, hx * hy * strength);
```

### 7.5 Coordinate Handling

All lighting operates in **screen-space pixels**. Key transformations:

1. `isoToScreen(col, row)` → world pixel position.
2. `camera.worldToScreen(wx, wy)` → screen pixel position (with pan + zoom).
3. **Y-flip for WebGL**: Screen coordinates (top = 0) are flipped to GL coordinates (bottom = 0) when setting uniforms: `gl_y = canvasHeight - screen_y`.

### 7.6 Integration in Game Loop (`Game.ts`)

```
render(dt):
    ... 2D rendering (tiles, fog, objects, player) ...

    if postProcess.enabled:
        clearLights / clearOccluders / clearHeightFade

        1. Compute sky light screen position from world offset + camera
        2. addLight(skyLight)
        3. setShadowLengthMult(SHADOW_LENGTH_MULT)
        4. For each world object → addOccluder (position, radius, height)
        5. addOccluder for player at visual feet (position + PLAYER_FOOT_OFFSET, radius, height)
        6. Compute player sprite bounds → setHeightFade(footX, footY, width, height, strength)
        7. postProcess.render(dt)  // upload texture + draw full-screen quad
```

### 7.7 Configuration Constants

| Constant | Default | Description |
|---|---|---|
| `LIGHTING_ENABLED` | `true` | Start with lighting on |
| `LIGHT_AMBIENT_R/G/B` | 0.18 / 0.22 / 0.38 | Ambient twilight colour |
| `SKY_LIGHT_OFFSET_X/Y` | −1500 / 1500 | Sky light world-space offset |
| `SKY_LIGHT_RADIUS` | 3500 | Sky light reach |
| `SKY_LIGHT_R/G/B` | 0.75 / 0.8 / 1.0 | Sky light colour |
| `SKY_LIGHT_INTENSITY` | 0.6 | Sky light brightness |
| `PLAYER_SHADOW_RADIUS` | 15 | Player shadow occluder radius (asset px) |
| `PLAYER_FOOT_OFFSET` | 18 | Sprite bottom → visual feet offset (asset px) |
| `SHADOW_LENGTH_MULT` | 2.0 | Shadow reach = object height × this value |
| `SHADOW_HEIGHT_FADE` | 0.8 | Shadow reduction at player head |

### 7.8 Shader Tuning Guide

| Parameter | File | What it controls |
|---|---|---|
| `r * 0.3, r * 2.0` | `PostProcessPipeline.ts` | Penumbra softness (inner → outer) |
| `smoothstep(-r, r*0.3, t)` | `PostProcessPipeline.ts` | Shadow endpoint fade distance |
| `u_hfWidth * 0.1 / 0.85` | `PostProcessPipeline.ts` | Height-fade horizontal extent |
| `u_hfHeight * 0.4 / 0.85 / 1.05` | `PostProcessPipeline.ts` | Height-fade vertical bell shape |
| Falloff formula `1 − d²/r²` | `PostProcessPipeline.ts` | Light falloff curve (quadratic) |
| `maxReach * 0.5, maxReach` | `PostProcessPipeline.ts` | Shadow length fade (start/end of reach) |

### 7.9 Limits

- Up to **16 point lights** and **32 occluders** per frame (GLSL array sizes).
- Occluders are **circular** — non-circular shapes require multiple overlapping circles.
- Shadows are computed in **screen space** — no depth buffer or true 3D raycasting.

## 8. Performance Optimization

### 7.1 Culling
- Only render entities within camera viewport
- Use spatial partitioning (quadtree) for large worlds

### 7.2 Asset Management
- Lazy load assets as needed
- Use sprite sheets to reduce draw calls
- Cache rendered tiles off-screen canvas

### 7.3 Canvas Optimization
- Use layered canvases (static background, dynamic entities, UI)
- Enable `imageSmoothingEnabled = false` for crisp pixels
- Use `willReadFrequently` hint for getImageData operations

## 9. Save/Load System

```typescript
interface SaveData {
  version: string;
  timestamp: number;
  player: {
    position: {x: number, y: number, z: number};
    inventory: Item[];
    stats: PlayerStats;
  };
  world: {
    mapId: string;
    modifiedTiles: TileModification[];
    entities: SerializedEntity[];
  };
}

class SaveManager {
  async save(slotId: string): Promise<void> {
    const data: SaveData = this.serializeGameState();
    await localforage.setItem(`save_${slotId}`, data);
  }
  
  async load(slotId: string): Promise<void> {
    const data = await localforage.getItem<SaveData>(`save_${slotId}`);
    if (data) {
      this.deserializeGameState(data);
    }
  }
}
```

## 10. Development Roadmap

### Phase 1: Foundation
- Set up project structure and build system
- Implement basic canvas rendering
- Create isometric coordinate system
- Build asset loader for PNG files

### Phase 2: Core Gameplay
- Implement entity system
- Add player movement and input
- Create tile map rendering with z-sorting
- Basic collision detection

### Phase 3: Features
- Animation system for sprite sheets
- Camera system (follow player, zoom)
- UI system (HUD, menus)
- Audio integration

### Phase 4: Polish
- Save/load system
- Performance optimization
- Debug tools
- Testing and bug fixes

## 11. Testing Strategy

- **Unit Tests**: Core systems (coordinate conversion, collision detection)
- **Integration Tests**: Asset loading, scene management
- **Performance Tests**: FPS monitoring, memory profiling
- **Manual Testing**: Gameplay, visual bugs, browser compatibility

## 12. Browser Compatibility

Target modern browsers with:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

All support Canvas API and modern JavaScript features.

---

**Next Steps:**
1. Set up project with Vite/Webpack + TypeScript
2. Create basic canvas and render first isometric tile
3. Implement coordinate conversion functions
4. Build asset loader and test with your PNG files
5. Create entity system and add player character
