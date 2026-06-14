import { craftingSystem } from './crafting';
import { createInitialState } from '../state';
import { CRAFT_COST } from '../constants';
import type { Building, InputMap } from '../types';

function withBlacksmith(s: ReturnType<typeof createInitialState>): Building {
  const bs: Building = {
    id: 9001,
    type: 'blacksmith',
    pos: { x: 50, y: 50 },
    health: { hp: 35, maxHp: 35 },
    level: 1,
  };
  s.buildings.push(bs);
  return bs;
}

test('crafting spawns a weapon on the rack and spends materials', () => {
  const s = createInitialState(1);
  withBlacksmith(s);
  const hero = s.heroes[0];
  s.resources.materials = 100;
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'craft', craftType: 'sword' },
  };
  craftingSystem(s, inputs);
  expect(s.map.weapons).toHaveLength(1);
  expect(s.map.weapons[0].type).toBe('sword');
  expect(s.resources.materials).toBe(100 - CRAFT_COST.sword);
});

test('no crafting without a blacksmith', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  s.resources.materials = 100;
  craftingSystem(s, {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'craft', craftType: 'bow' },
  });
  expect(s.map.weapons).toHaveLength(0);
});

test('no crafting without enough materials', () => {
  const s = createInitialState(1);
  withBlacksmith(s);
  const hero = s.heroes[0];
  s.resources.materials = 5;
  craftingSystem(s, {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'craft', craftType: 'bow' },
  });
  expect(s.map.weapons).toHaveLength(0);
  expect(s.resources.materials).toBe(5);
});
