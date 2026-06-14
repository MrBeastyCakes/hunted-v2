import { combatSystem } from './systems/combat';
import { economySystem } from './systems/economy';
import { evolutionSystem } from './systems/evolution';
import { buildingSystem } from './systems/building';
import { herdSystem } from './systems/herd';
import { huntingSystem } from './systems/hunting';
import { movementSystem } from './systems/movement';
import { winConditionSystem } from './systems/winCondition';
import type { GameState, InputMap } from './types';

// Pure fixed-timestep advance: clone, run systems in order on the clone, return it.
// Order matters: feeding/combat add XP before evolution reads it; winCondition runs last.
export function step(state: GameState, inputs: InputMap): GameState {
  const next: GameState = structuredClone(state);
  if (next.phase !== 'playing') return next;

  movementSystem(next, inputs);
  herdSystem(next);
  huntingSystem(next);
  economySystem(next);
  buildingSystem(next, inputs);
  combatSystem(next, inputs);
  evolutionSystem(next);
  winConditionSystem(next);

  next.tick += 1;
  return next;
}
