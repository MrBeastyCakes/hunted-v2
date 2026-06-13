import { BUILD_COSTS, HERO_AGGRO_RADIUS, HERO_HOLD_RADIUS } from '../constants';
import { distance } from '../math';
import type { BuildingType, Entity, GameState, Input, Vec2 } from '../types';

function toward(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

// What each role builds when safe and able; non-builders return undefined.
function buildChoice(role: Entity['role']): 'tower' | 'generator' | undefined {
  if (role === 'builder') return 'tower';
  if (role === 'economy') return 'generator';
  return undefined;
}

// Swarm a threatening monster; otherwise build (builder/economy) or regroup near the core.
export function heroBot(state: GameState, hero: Entity): Input {
  const id = hero.id;
  const core = state.buildings.find((b) => b.type === 'core');
  const m = state.monster;

  const monsterThreatens =
    m.alive && core !== undefined && distance(m.pos, core.pos) <= HERO_AGGRO_RADIUS;
  if (monsterThreatens) {
    return { actorId: id, move: toward(hero.pos, m.pos) };
  }

  const choice = buildChoice(hero.role);
  if (choice && state.resources.materials >= BUILD_COSTS[choice]) {
    const buildType: BuildingType = choice;
    return { actorId: id, move: { x: 0, y: 0 }, action: 'build', buildType };
  }

  if (core && distance(hero.pos, core.pos) > HERO_HOLD_RADIUS) {
    return { actorId: id, move: toward(hero.pos, core.pos) };
  }
  return { actorId: id, move: { x: 0, y: 0 } };
}
