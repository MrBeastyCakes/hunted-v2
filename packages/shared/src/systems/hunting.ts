import {
  CATCH_RANGE,
  HERD_RESPAWN_TICKS,
  MOB_BITE_DAMAGE,
  MOB_HP,
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
    // Bite the single nearest mob in catch range; kill it once its HP is gone.
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
      target.hp -= MOB_BITE_DAMAGE;
      if (target.hp <= 0) {
        m.evolution.xp += target.species === 'villager' ? VILLAGER_XP : WILDLIFE_XP;
        state.map.mobs = state.map.mobs.filter((mob) => mob !== target);
      }
    }
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
          hp: MOB_HP,
        });
        count += 1;
      }
    }
  }
}
