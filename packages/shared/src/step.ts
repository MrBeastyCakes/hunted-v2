import { movementSystem } from './systems/movement';
import type { GameState, InputMap } from './types';

// Pure fixed-timestep advance: clone, run systems on the clone, return it.
// Plan 2 adds feeding/evolution/combat/building/winCondition systems here,
// each as one import + one call line — order matters and is fixed.
export function step(state: GameState, inputs: InputMap): GameState {
  const next: GameState = structuredClone(state);
  if (next.phase !== 'playing') return next;

  movementSystem(next, inputs);
  // (Plan 2) feedingSystem(next, inputs);
  // (Plan 2) evolutionSystem(next);
  // (Plan 2) combatSystem(next, inputs);
  // (Plan 2) buildingSystem(next, inputs);
  // (Plan 2) winConditionSystem(next);

  next.tick += 1;
  return next;
}
