import { FEED_RANGE, MONSTER_ASSAULT_STAGE } from '../constants';
import { distance } from '../math';
import type { GameState, Input, ResourceNode, Vec2 } from '../types';

function toward(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y }; // the sim normalizes direction
}

function nearestLiveWildlife(state: GameState, from: Vec2): ResourceNode | undefined {
  let best: ResourceNode | undefined;
  let bestDist = Infinity;
  for (const n of state.map.wildlifeNodes) {
    if (n.amount <= 0) continue;
    const d = distance(from, n.pos);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

// Feed up to the assault stage, then march on the city core.
export function monsterBot(state: GameState): Input {
  const m = state.monster;
  const id = m.id;
  const stage = m.evolution?.stage ?? 1;
  const wildlife = nearestLiveWildlife(state, m.pos);

  if (stage < MONSTER_ASSAULT_STAGE && wildlife) {
    if (distance(m.pos, wildlife.pos) <= FEED_RANGE) {
      return { actorId: id, move: { x: 0, y: 0 }, action: 'feed' };
    }
    return { actorId: id, move: toward(m.pos, wildlife.pos) };
  }

  const core = state.buildings.find((b) => b.type === 'core');
  if (core) return { actorId: id, move: toward(m.pos, core.pos) };
  return { actorId: id, move: { x: 0, y: 0 } };
}
