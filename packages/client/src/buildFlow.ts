import {
  buildCost,
  distance,
  type BuildableType,
  type GameState,
  type RoleType,
  type Vec2,
} from '@game/shared';

export const BLUEPRINTS: BuildableType[] = ['tower', 'generator', 'workshop'];

export interface BuildFlow {
  phase: 'idle' | 'menu' | 'placing';
  blueprint?: BuildableType;
  ghost?: Vec2;
}

export type BuildEvent =
  | { t: 'open' }
  | { t: 'select'; blueprint: BuildableType }
  | { t: 'placeGhost'; point: Vec2 }
  | { t: 'confirm' }
  | { t: 'cancel' };

export interface BuildResult {
  flow: BuildFlow;
  build?: { buildType: BuildableType; target: Vec2 };
}

export function buildFlowReducer(flow: BuildFlow, e: BuildEvent): BuildResult {
  switch (e.t) {
    case 'open':
      return { flow: { phase: 'menu' } };
    case 'select':
      return { flow: { phase: 'placing', blueprint: e.blueprint } };
    case 'placeGhost':
      if (flow.phase !== 'placing') return { flow };
      return { flow: { ...flow, ghost: { ...e.point } } };
    case 'confirm':
      if (flow.phase === 'placing' && flow.blueprint && flow.ghost) {
        return {
          flow: { phase: 'idle' },
          build: { buildType: flow.blueprint, target: flow.ghost },
        };
      }
      return { flow };
    case 'cancel':
      return { flow: { phase: 'idle' } };
  }
}

export function canAfford(state: GameState, role: RoleType | undefined, type: BuildableType): boolean {
  return state.resources.materials >= buildCost(role, type);
}

interface ScreenPt {
  x: number;
  y: number;
}

export function isDoubleTap(
  prevMs: number | undefined,
  prevPos: ScreenPt | undefined,
  nowMs: number,
  nowPos: ScreenPt,
  maxMs: number,
  maxDistPx: number,
): boolean {
  if (prevMs === undefined || prevPos === undefined) return false;
  if (nowMs - prevMs > maxMs) return false;
  return Math.hypot(nowPos.x - prevPos.x, nowPos.y - prevPos.y) <= maxDistPx;
}

export type PlacingAction =
  | { t: 'placeGhost'; point: Vec2 }
  | { t: 'confirm' }
  | { t: 'cancel' }
  | { t: 'none' };

// Decides what a tap means while in placing mode.
export function placingTapAction(
  world: Vec2,
  isDouble: boolean,
  ghost: Vec2 | undefined,
  hitCampfire: boolean,
  pickRadius: number,
): PlacingAction {
  if (hitCampfire) return { t: 'cancel' };
  if (isDouble) return { t: 'placeGhost', point: world };
  if (ghost && distance(world, ghost) <= pickRadius) return { t: 'confirm' };
  return { t: 'none' };
}
