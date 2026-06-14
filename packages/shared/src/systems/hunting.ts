import {
  CATCH_RANGE,
  HERD_RESPAWN_TICKS,
  MOB_PER_HERD,
  VILLAGERS_AT_START,
  VILLAGER_XP,
  WILDLIFE_XP,
} from '../constants';
import { distance } from '../math';
import { maxId } from '../ids';
import type { GameState, Mob } from '../types';

// Monster eats mobs on contact (XP by species), and herds slowly repopulate.
export function huntingSystem(state: GameState): void {
  const m = state.monster;

  if (m.alive && m.evolution) {
    const remaining: Mob[] = [];
    for (const mob of state.map.mobs) {
      if (distance(m.pos, mob.pos) <= CATCH_RANGE) {
        m.evolution.xp += mob.species === 'villager' ? VILLAGER_XP : WILDLIFE_XP;
      } else {
        remaining.push(mob);
      }
    }
    state.map.mobs = remaining;
  }

  if (state.tick > 0 && state.tick % HERD_RESPAWN_TICKS === 0) {
    let nextId = maxId(state) + 1;
    for (const herd of state.map.herds) {
      const target = herd.species === 'villager' ? VILLAGERS_AT_START : MOB_PER_HERD;
      let count = state.map.mobs.filter((mb) => mb.herdId === herd.id).length;
      while (count < target) {
        state.map.mobs.push({
          id: nextId++,
          herdId: herd.id,
          species: herd.species,
          pos: { ...herd.home },
          state: 'calm',
          fleeTicks: 0,
        });
        count += 1;
      }
    }
  }
}
