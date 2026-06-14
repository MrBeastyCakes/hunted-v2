import { distance } from '../math';
import type { GameState, Input, Mob, Vec2 } from '../types';

function toward(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y }; // the sim normalizes direction
}

function nearestMob(state: GameState, from: Vec2): Mob | undefined {
  let best: Mob | undefined;
  let bestDist = Infinity;
  for (const mob of state.map.mobs) {
    const d = distance(from, mob.pos);
    if (d < bestDist) {
      bestDist = d;
      best = mob;
    }
  }
  return best;
}

// Hunt the nearest mob (eating is automatic on contact); if none remain, march on the campfire.
export function monsterBot(state: GameState): Input {
  const m = state.monster;
  const id = m.id;

  const mob = nearestMob(state, m.pos);
  if (mob) return { actorId: id, move: toward(m.pos, mob.pos) };

  const core = state.buildings.find((b) => b.type === 'core');
  if (core) return { actorId: id, move: toward(m.pos, core.pos) };
  return { actorId: id, move: { x: 0, y: 0 } };
}
