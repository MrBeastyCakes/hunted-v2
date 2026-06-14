import { BUILD_COSTS, CRAFT_COST, HERO_AGGRO_RADIUS, HERO_HOLD_RADIUS } from '../constants';
import { buildCost } from '../cost';
import { distance } from '../math';
import type {
  BuildingType,
  Entity,
  GameState,
  Input,
  ResourceNode,
  Vec2,
  WeaponItem,
  WeaponType,
} from '../types';

function toward(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

function buildChoice(role: Entity['role']): 'tower' | 'generator' | undefined {
  if (role === 'builder') return 'tower';
  if (role === 'economy') return 'generator';
  return undefined;
}

function nearestWeapon(state: GameState, from: Vec2): WeaponItem | undefined {
  let best: WeaponItem | undefined;
  let bestDist = Infinity;
  for (const w of state.map.weapons) {
    const d = distance(from, w.pos);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

function nearestResource(state: GameState, from: Vec2): ResourceNode | undefined {
  let best: ResourceNode | undefined;
  let bestDist = Infinity;
  for (const n of state.map.resourceNodes) {
    if (n.amount <= 0) continue;
    const d = distance(from, n.pos);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

// Swarm a threatening monster; otherwise arm up (grab/craft/build a blacksmith); otherwise
// build economy/defense or regroup near the core.
export function heroBot(state: GameState, hero: Entity): Input {
  const id = hero.id;
  const core = state.buildings.find((b) => b.type === 'core');
  const m = state.monster;

  // 1. Swarm a monster threatening the core.
  if (m.alive && core !== undefined && distance(m.pos, core.pos) <= HERO_AGGRO_RADIUS) {
    return { actorId: id, move: toward(hero.pos, m.pos) };
  }

  // 2. Arm up if unarmed.
  if (!hero.equipped) {
    const weapon = nearestWeapon(state, hero.pos);
    if (weapon) return { actorId: id, move: toward(hero.pos, weapon.pos) };

    const blacksmith = state.buildings.find((b) => b.type === 'blacksmith');
    if (blacksmith) {
      const want: WeaponType = hero.role === 'scout' ? 'bow' : 'sword';
      if (state.resources.materials >= CRAFT_COST[want]) {
        return { actorId: id, move: { x: 0, y: 0 }, action: 'craft', craftType: want };
      }
    } else if (state.resources.materials >= buildCost(hero.role, 'blacksmith')) {
      const buildType: BuildingType = 'blacksmith';
      return { actorId: id, move: { x: 0, y: 0 }, action: 'build', buildType };
    }
  }

  // 3. Armed (or can't arm yet): build economy/defense, else regroup near the core.
  const choice = buildChoice(hero.role);
  if (choice && state.resources.materials >= BUILD_COSTS[choice]) {
    const buildType: BuildingType = choice;
    return { actorId: id, move: { x: 0, y: 0 }, action: 'build', buildType };
  }
  // Venture out to gather resources to fund the town.
  const node = nearestResource(state, hero.pos);
  if (node) return { actorId: id, move: toward(hero.pos, node.pos) };
  if (core && distance(hero.pos, core.pos) > HERO_HOLD_RADIUS) {
    return { actorId: id, move: toward(hero.pos, core.pos) };
  }
  return { actorId: id, move: { x: 0, y: 0 } };
}
