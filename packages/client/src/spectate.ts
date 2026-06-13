import type { EntityId, GameState } from '@game/shared';

// Living actors the player may watch: living heroes (minus the dead self), then the monster.
export function spectatableIds(state: GameState, deadActorId: EntityId): EntityId[] {
  const ids: EntityId[] = [];
  for (const h of state.heroes) {
    if (h.alive && h.id !== deadActorId) ids.push(h.id);
  }
  if (state.monster.alive) ids.push(state.monster.id);
  return ids;
}

// The next id to watch when cycling; wraps around. undefined if nothing to watch.
export function nextSpectateTarget(
  current: EntityId | undefined,
  options: EntityId[],
): EntityId | undefined {
  if (options.length === 0) return undefined;
  if (current === undefined) return options[0];
  const i = options.indexOf(current);
  if (i === -1) return options[0];
  return options[(i + 1) % options.length];
}

export function isActorAlive(state: GameState, id: EntityId): boolean {
  if (state.monster.id === id) return state.monster.alive;
  const hero = state.heroes.find((h) => h.id === id);
  return hero?.alive ?? false;
}
