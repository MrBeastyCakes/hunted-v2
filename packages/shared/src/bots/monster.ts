import { SKILL_MAX_RANK } from '../constants';
import { distance } from '../math';
import { levelCost } from '../skill';
import type { GameState, Input, Mob, SkillPath, Vec2 } from '../types';

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

  // Spend banked XP on the lowest-rank sense when a level is affordable.
  const evo = m.evolution;
  if (evo && evo.xp >= levelCost(evo.level)) {
    const paths: SkillPath[] = ['vision', 'hearing', 'smell'];
    const available = paths.filter((p) => evo.skills[p] < SKILL_MAX_RANK);
    if (available.length > 0) {
      available.sort((a, b) => evo.skills[a] - evo.skills[b]);
      return { actorId: id, move: { x: 0, y: 0 }, action: 'spend', skillPath: available[0] };
    }
  }

  const mob = nearestMob(state, m.pos);
  if (mob) return { actorId: id, move: toward(m.pos, mob.pos) };

  const core = state.buildings.find((b) => b.type === 'core');
  if (core) return { actorId: id, move: toward(m.pos, core.pos) };
  return { actorId: id, move: { x: 0, y: 0 } };
}
