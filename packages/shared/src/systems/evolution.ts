import {
  STAGE2_XP,
  STAGE3_XP,
  STAGE3_CITY_DAMAGE_REQ,
  STAGE_DAMAGE_BONUS,
  STAGE_HP_BONUS,
} from '../constants';
import type { GameState } from '../types';

// Raises the monster's stage when XP (and, for stage 3, city damage) thresholds are met.
// One-way: stage never decreases. Each gained stage heals and strengthens the monster.
export function evolutionSystem(state: GameState): void {
  const m = state.monster;
  if (!m.alive || !m.evolution || !m.combat) return;
  const evo = m.evolution;

  let target = 1;
  if (evo.xp >= STAGE2_XP) target = 2;
  if (evo.xp >= STAGE3_XP && evo.cityDamageDealt >= STAGE3_CITY_DAMAGE_REQ) target = 3;

  while (evo.stage < target) {
    evo.stage += 1;
    m.health.maxHp += STAGE_HP_BONUS;
    m.health.hp += STAGE_HP_BONUS;
    m.combat.damage += STAGE_DAMAGE_BONUS;
  }
}
