import type { BuildingType, EntityId, GameState, Input, RoleType } from '@game/shared';

export type Side = 'monster' | RoleType;

export interface KeyMap {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  feed: boolean;
  build: boolean;
}

// Maps the chosen side to the entity the player controls.
export function actorIdForSide(state: GameState, side: Side): EntityId | undefined {
  if (side === 'monster') return state.monster.id;
  return state.heroes.find((h) => h.role === side)?.id;
}

// Pure mapping from held keys to a sim Input. feed takes priority over build.
export function inputFromKeys(actorId: EntityId, keys: KeyMap, buildType?: BuildingType): Input {
  let x = 0;
  let y = 0;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) y -= 1;
  if (keys.down) y += 1;

  const input: Input = { actorId, move: { x, y } };
  if (keys.feed) {
    input.action = 'feed';
  } else if (keys.build) {
    input.action = 'build';
    if (buildType) input.buildType = buildType;
  }
  return input;
}
