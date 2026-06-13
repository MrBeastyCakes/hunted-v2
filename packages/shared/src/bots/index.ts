import type { EntityId, GameState, Input } from '../types';
import { monsterBot } from './monster';
import { heroBot } from './hero';

// Produces an Input for any bot-controlled actor. Pure: a function of state only.
export function botThink(state: GameState, actorId: EntityId): Input {
  if (actorId === state.monster.id) return monsterBot(state);
  const hero = state.heroes.find((h) => h.id === actorId);
  if (hero) return heroBot(state, hero);
  return { actorId, move: { x: 0, y: 0 } };
}

export { monsterBot } from './monster';
export { heroBot } from './hero';
