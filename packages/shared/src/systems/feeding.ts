import { FEED_RANGE, FEED_RATE, XP_PER_AMOUNT } from '../constants';
import { distance } from '../math';
import type { GameState, InputMap, ResourceNode } from '../types';

// Monster feeds on the nearest wildlife node in range when the 'feed' action is given.
export function feedingSystem(state: GameState, inputs: InputMap): void {
  const m = state.monster;
  if (!m.alive || !m.evolution) return;
  const input = inputs[m.id];
  if (!input || input.action !== 'feed') return;

  let best: ResourceNode | undefined;
  let bestDist = Infinity;
  for (const node of state.map.wildlifeNodes) {
    if (node.amount <= 0) continue;
    const d = distance(m.pos, node.pos);
    if (d <= FEED_RANGE && d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  if (!best) return;

  const drained = Math.min(FEED_RATE, best.amount);
  best.amount -= drained;
  m.evolution.xp += drained * XP_PER_AMOUNT;
}
