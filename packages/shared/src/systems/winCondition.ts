import type { GameState } from '../types';

// Decides the match outcome. Monster win (core down) takes priority over builders win.
export function winConditionSystem(state: GameState): void {
  const core = state.buildings.find((b) => b.type === 'core');
  if (!core || core.health.hp <= 0) {
    state.phase = 'monsterWon';
    return;
  }
  if (!state.monster.alive) {
    state.phase = 'buildersWon';
  }
}
