import { PICKUP_RANGE, WEAPON_DAMAGE, WEAPON_RANGE } from '../constants';
import { distance } from '../math';
import type { Entity, GameState, WeaponItem } from '../types';

// A hero walking onto a weapon pickup equips it (nearest hero wins); the pickup is consumed.
export function equipSystem(state: GameState): void {
  const remaining: WeaponItem[] = [];
  for (const w of state.map.weapons) {
    let taker: Entity | undefined;
    let bestDist = PICKUP_RANGE;
    for (const h of state.heroes) {
      if (!h.alive || !h.combat) continue;
      const d = distance(h.pos, w.pos);
      if (d <= bestDist) {
        bestDist = d;
        taker = h;
      }
    }
    if (taker && taker.combat) {
      taker.equipped = w.type;
      taker.combat.range = WEAPON_RANGE[w.type];
      taker.combat.damage = WEAPON_DAMAGE[w.type];
    } else {
      remaining.push(w);
    }
  }
  state.map.weapons = remaining;
}
