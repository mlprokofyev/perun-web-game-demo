import { Config } from '../core/Config';

/** Viewport camera with position, zoom, and smooth follow */
export class Camera {
  /** World-space center of the camera */
  x: number = 0;
  y: number = 0;

  zoom: number = Config.CAMERA_DEFAULT_ZOOM;

  /** Viewport size in screen pixels (set from canvas) */
  viewportW: number = Config.CANVAS_WIDTH;
  viewportH: number = Config.CANVAS_HEIGHT;

  /** Smooth follow parameters */
  private targetX: number = 0;
  private targetY: number = 0;
  private followSmoothing: number = 6; // higher = snappier

  private targetZoom: number = Config.CAMERA_DEFAULT_ZOOM;
  private zoomSmoothing: number = 3;

  setViewport(w: number, h: number): void {
    this.viewportW = w;
    this.viewportH = h;
  }

  /** Set the world position the camera should follow */
  follow(wx: number, wy: number): void {
    this.targetX = wx;
    this.targetY = wy;
  }

  /** Snap camera immediately to target */
  snap(): void {
    this.x = this.targetX;
    this.y = this.targetY;
  }

  update(dt: number): void {
    const t = 1 - Math.exp(-this.followSmoothing * dt);
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;

    const zt = 1 - Math.exp(-this.zoomSmoothing * dt);
    this.zoom += (this.targetZoom - this.zoom) * zt;
  }

  setTargetZoom(z: number): void {
    this.targetZoom = Math.max(Config.CAMERA_ZOOM_MIN, Math.min(Config.CAMERA_ZOOM_MAX, z));
  }

  /** Convert world coords → screen coords (accounting for camera + zoom) */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.viewportW / 2,
      y: (wy - this.y) * this.zoom + this.viewportH / 2,
    };
  }

  /** Convert screen coords → world coords */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewportW / 2) / this.zoom + this.x,
      y: (sy - this.viewportH / 2) / this.zoom + this.y,
    };
  }

  /** Clamp zoom and apply delta (instant — used by mouse wheel) */
  adjustZoom(delta: number): void {
    const z = Math.max(
      Config.CAMERA_ZOOM_MIN,
      Math.min(Config.CAMERA_ZOOM_MAX, this.zoom + delta)
    );
    this.zoom = z;
    this.targetZoom = z;
  }
}
