import { ECONOMY_ROLE_BONUS, GENERATOR_RATE, MATERIALS_CAP } from '../constants';
import type { GameState } from '../types';

// Passive material income: generators + an alive economy hero bonus.
export function economySystem(state: GameState): void {
  const generators = state.buildings.filter((b) => b.type === 'generator').length;
  let income = generators * GENERATOR_RATE;
  if (state.heroes.some((h) => h.role === 'economy' && h.alive)) {
    income += ECONOMY_ROLE_BONUS;
  }
  state.resources.materials = Math.min(MATERIALS_CAP, state.resources.materials + income);
}
