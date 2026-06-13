import type { Vec2 } from '@game/shared';

export interface ScreenPoint {
  x: number;
  y: number;
}

// 2:1 isometric projection. +x screen-southeast, +y screen-southwest.
export function worldToScreen(
  world: Vec2,
  tileW: number,
  tileH: number,
  origin: ScreenPoint,
): ScreenPoint {
  return {
    x: origin.x + (world.x - world.y) * (tileW / 2),
    y: origin.y + (world.x + world.y) * (tileH / 2),
  };
}
