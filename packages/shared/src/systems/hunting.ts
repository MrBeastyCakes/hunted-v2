import {
  CATCH_RANGE,
  HERD_RESPAWN_TICKS,
  LARGE_BITE_BACK,
  MOB_BITE_DAMAGE,
  MOB_PER_HERD,
  PREY_STATS,
  VILLAGERS_AT_START,
} from '../constants';
import { distance } from '../math';
import { maxId } from '../ids';
import type { GameState, Mob, PreyTier } from '../types';

// Monster bites the nearest mob in range; kills it at 0 HP for tier XP. Large prey bites back.
export function huntingSystem(state: GameState): void {
  const m = state.monster;

  if (m.alive && m.evolution) {
    let target: Mob | undefined;
    let bestDist = CATCH_RANGE;
    for (const mob of state.map.mobs) {
      const d = distance(m.pos, mob.pos);
      if (d <= bestDist) {
        bestDist = d;
        target = mob;
      }
    }
    if (target) {
      if (target.tier === 'large' && m.health) {
        m.health.hp -= LARGE_BITE_BACK;
        if (m.health.hp <= 0) {
          m.health.hp = 0;
          m.alive = false;
        }
      }
      target.hp -= MOB_BITE_DAMAGE;
      if (target.hp <= 0) {
        m.evolution.xp += PREY_STATS[target.tier].xp;
        state.map.mobs = state.map.mobs.filter((mob) => mob !== target);
      }
    }
  }

  if (state.tick > 0 && state.tick % HERD_RESPAWN_TICKS === 0) {
    let nextId = maxId(state) + 1;
    for (const herd of state.map.herds) {
      const cap = herd.species === 'villager' ? VILLAGERS_AT_START : MOB_PER_HERD;
      let count = state.map.mobs.filter((mb) => mb.herdId === herd.id).length;
      const tier: PreyTier = herd.species === 'villager' ? 'villager' : 'critter';
      while (count < cap) {
        state.map.mobs.push({
          id: nextId++,
          herdId: herd.id,
          species: herd.species,
          tier,
          pos: { ...herd.home },
          state: 'calm',
          fleeTicks: 0,
          hp: PREY_STATS[tier].hp,
        });
        count += 1;
      }
    }
  }
}
