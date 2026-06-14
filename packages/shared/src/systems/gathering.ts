import {
  GATHER_RANGE,
  GATHER_RATE,
  NODE_RESPAWN_AMOUNT,
  NODE_RESPAWN_TICKS,
  RESOURCE_NODE_AMOUNT,
} from '../constants';
import { distance } from '../math';
import type { GameState } from '../types';

// Heroes within range of a resource node harvest it into the shared materials pool.
// Nodes slowly replenish on the respawn tick.
export function gatheringSystem(state: GameState): void {
  for (const node of state.map.resourceNodes) {
    if (node.amount <= 0) continue;
    let harvesters = 0;
    for (const h of state.heroes) {
      if (h.alive && distance(h.pos, node.pos) <= GATHER_RANGE) harvesters += 1;
    }
    if (harvesters === 0) continue;
    const harvest = Math.min(node.amount, GATHER_RATE * harvesters);
    node.amount -= harvest;
    state.resources.materials += harvest;
  }

  if (state.tick > 0 && state.tick % NODE_RESPAWN_TICKS === 0) {
    for (const node of state.map.resourceNodes) {
      node.amount = Math.min(RESOURCE_NODE_AMOUNT, node.amount + NODE_RESPAWN_AMOUNT);
    }
  }
}
