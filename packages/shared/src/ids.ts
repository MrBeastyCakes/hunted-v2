import type { GameState } from './types';

// The largest entity id currently in use across the whole state.
export function maxId(state: GameState): number {
  let max = state.monster.id;
  for (const h of state.heroes) max = Math.max(max, h.id);
  for (const b of state.buildings) max = Math.max(max, b.id);
  for (const n of state.map.resourceNodes) max = Math.max(max, n.id);
  for (const m of state.map.mobs) max = Math.max(max, m.id);
  for (const w of state.map.weapons) max = Math.max(max, w.id);
  return max;
}
