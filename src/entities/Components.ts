/** Position in isometric grid space (fractional) */
export class Transform {
  x: number = 0;
  y: number = 0;
  z: number = 0; // height above ground

  set(x: number, y: number, z: number = 0): void {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

/** Velocity in grid-units per second */
export class Velocity {
  vx: number = 0;
  vy: number = 0;
}

/** Axis-aligned collider in grid space */
export class Collider {
  /** Half-extents in grid units */
  hw: number = 0.3;
  hh: number = 0.3;
  /** Whether this is a solid (blocking) collider */
  solid: boolean = true;
}
