import { MONSTER_STAGE_XP, STAGE_DAMAGE_BONUS, STAGE_HP_BONUS } from '../constants';
import type { GameState } from '../types';

// Advances the monster to the highest stage whose XP threshold it has reached (max 5).
// One-way; each gained stage heals and strengthens the monster.
export function evolutionSystem(state: GameState): void {
  const m = state.monster;
  if (!m.alive || !m.evolution || !m.combat) return;
  const evo = m.evolution;

  let target = 1;
  for (let stage = 1; stage <= MONSTER_STAGE_XP.length; stage++) {
    if (evo.xp >= MONSTER_STAGE_XP[stage - 1]) target = stage;
  }

  while (evo.stage < target) {
    evo.stage += 1;
    m.health.maxHp += STAGE_HP_BONUS;
    m.health.hp += STAGE_HP_BONUS;
    m.combat.damage += STAGE_DAMAGE_BONUS;
  }
}
