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

// Inverse of worldToScreen: recover a world point from a screen point.
export function screenToWorld(
  screen: ScreenPoint,
  tileW: number,
  tileH: number,
  origin: ScreenPoint,
): Vec2 {
  const dx = screen.x - origin.x;
  const dy = screen.y - origin.y;
  return { x: dx / tileW + dy / tileH, y: dy / tileH - dx / tileW };
}
