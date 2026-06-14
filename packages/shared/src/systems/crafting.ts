import { CRAFT_COST, RACK_OFFSET } from '../constants';
import { maxId } from '../ids';
import type { GameState, InputMap, WeaponItem } from '../types';

// Heroes with a 'craft' action spawn a weapon on the blacksmith's rack (costs materials).
export function craftingSystem(state: GameState, inputs: InputMap): void {
  const blacksmith = state.buildings.find((b) => b.type === 'blacksmith');
  if (!blacksmith) return;

  let nextId = maxId(state) + 1;
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    const input = inputs[hero.id];
    if (!input || input.action !== 'craft' || !input.craftType) continue;
    const type = input.craftType;
    if (state.resources.materials < CRAFT_COST[type]) continue;

    state.resources.materials -= CRAFT_COST[type];
    const n = state.map.weapons.length;
    const item: WeaponItem = {
      id: nextId++,
      type,
      pos: { x: blacksmith.pos.x + RACK_OFFSET.x + (n % 3), y: blacksmith.pos.y + RACK_OFFSET.y },
    };
    state.map.weapons.push(item);
  }
}
