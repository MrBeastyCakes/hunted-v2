import { dayNight } from '../time';
import type { GameState } from '../types';

// Decides the match outcome. Monster win (core down) takes priority; otherwise the village wins by
// killing the monster or by surviving to the end of the final night.
export function winConditionSystem(state: GameState): void {
  const core = state.buildings.find((b) => b.type === 'core');
  if (!core || core.health.hp <= 0) {
    state.phase = 'monsterWon';
    return;
  }
  if (!state.monster.alive) {
    state.phase = 'buildersWon';
    return;
  }
  if (dayNight(state.tick).ended) {
    state.phase = 'buildersWon';
  }
}
