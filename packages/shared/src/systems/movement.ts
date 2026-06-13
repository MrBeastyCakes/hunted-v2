import { DT } from '../constants';
import { clamp, normalize } from '../math';
import type { Entity, GameState, InputMap } from '../types';

// Mutates state in place: advances each living actor by its input direction.
export function movementSystem(state: GameState, inputs: InputMap): void {
  const actors: Entity[] = [state.monster, ...state.heroes];
  for (const actor of actors) {
    if (!actor.alive) continue;
    const input = inputs[actor.id];
    if (!input) continue;
    const dir = normalize(input.move);
    if (dir.x === 0 && dir.y === 0) continue;
    actor.pos.x = clamp(actor.pos.x + dir.x * actor.speed * DT, 0, state.map.width);
    actor.pos.y = clamp(actor.pos.y + dir.y * actor.speed * DT, 0, state.map.height);
  }
}
