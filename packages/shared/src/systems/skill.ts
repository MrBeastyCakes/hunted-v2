import { spendOnSkill } from '../skill';
import type { GameState, InputMap } from '../types';

// Consumes the monster's 'spend' action to raise a sense path.
export function skillSystem(state: GameState, inputs: InputMap): void {
  const input = inputs[state.monster.id];
  if (input?.action === 'spend' && input.skillPath) {
    spendOnSkill(state, input.skillPath);
  }
}
