import { heroBot } from './hero';
import { createInitialState } from '../state';
import { BUILD_COSTS, CRAFT_COST } from '../constants';

function hero(state: ReturnType<typeof createInitialState>, role: string) {
  return state.heroes.find((h) => h.role === role)!;
}

test('heroes swarm the monster when it threatens the core', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos }; // within aggro radius
  const h = hero(s, 'defender');
  h.pos = { x: core.pos.x - 10, y: core.pos.y };
  const input = heroBot(s, h);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0); // moves east toward the monster
});

test('an unarmed hero walks to a weapon on the rack', () => {
  const s = createInitialState(123);
  const h = hero(s, 'defender');
  s.map.weapons = [{ id: 9001, type: 'sword', pos: { x: h.pos.x + 10, y: h.pos.y } }];
  const input = heroBot(s, h);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0); // toward the weapon
});

test('an unarmed hero crafts when a blacksmith exists and it can afford it', () => {
  const s = createInitialState(123);
  s.buildings.push({
    id: 9002,
    type: 'blacksmith',
    pos: { x: 50, y: 50 },
    health: { hp: 35, maxHp: 35 },
    level: 1,
  });
  s.resources.materials = 100;
  const input = heroBot(s, hero(s, 'scout'));
  expect(input.action).toBe('craft');
  expect(input.craftType).toBe('bow'); // scouts prefer bows
  expect(CRAFT_COST.bow).toBeGreaterThan(0);
});

test('an unarmed hero builds a blacksmith when none exists and it can afford it', () => {
  const s = createInitialState(123);
  s.resources.materials = 100;
  const input = heroBot(s, hero(s, 'defender'));
  expect(input.action).toBe('build');
  expect(input.buildType).toBe('blacksmith');
});

test('an armed builder builds a tower when safe and able to afford it', () => {
  const s = createInitialState(123);
  const builder = hero(s, 'builder');
  builder.equipped = 'sword';
  s.resources.materials = 100;
  const input = heroBot(s, builder);
  expect(input.action).toBe('build');
  expect(input.buildType).toBe('tower');
  expect(BUILD_COSTS.tower).toBeGreaterThan(0);
});

test('an armed economy hero builds a generator when safe and able to afford it', () => {
  const s = createInitialState(123);
  const economy = hero(s, 'economy');
  economy.equipped = 'sword';
  s.resources.materials = 100;
  const input = heroBot(s, economy);
  expect(input.action).toBe('build');
  expect(input.buildType).toBe('generator');
});

test('an armed defender holds position when near the core and no threat', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  const defender = hero(s, 'defender');
  defender.equipped = 'sword';
  defender.pos = { ...core.pos };
  s.resources.materials = 0;
  const input = heroBot(s, defender);
  expect(input.move).toEqual({ x: 0, y: 0 });
});
