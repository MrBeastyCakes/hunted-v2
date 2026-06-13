import { buildCost, type BuildableType, type GameState, type RoleType, type Vec2 } from '@game/shared';

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
