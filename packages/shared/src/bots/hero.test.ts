import { heroBot } from './hero';
import { createInitialState } from '../state';
import { BUILD_COSTS } from '../constants';
import type { Entity } from '../types';

function hero(state: ReturnType<typeof createInitialState>, role: string): Entity {
  return state.heroes.find((h) => h.role === role)!;
}

test('heroes swarm the monster when it threatens the core', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos }; // monster at the core -> within aggro radius
  const h = hero(s, 'defender');
  h.pos = { x: core.pos.x - 10, y: core.pos.y }; // to the west of the monster
  const input = heroBot(s, h);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0); // moves east toward the monster
});

test('a builder builds a tower when safe and able to afford it', () => {
  const s = createInitialState(123);
  s.resources.materials = 100; // monster is far at spawn -> safe
  const input = heroBot(s, hero(s, 'builder'));
  expect(input.action).toBe('build');
  expect(input.buildType).toBe('tower');
});

test('an economy hero builds a generator when safe and able to afford it', () => {
  const s = createInitialState(123);
  s.resources.materials = 100;
  const input = heroBot(s, hero(s, 'economy'));
  expect(input.action).toBe('build');
  expect(input.buildType).toBe('generator');
});

test('a builder without enough materials regroups near the core', () => {
  const s = createInitialState(123);
  s.resources.materials = 0;
  const builder = hero(s, 'builder');
  builder.pos = { x: 0, y: 0 }; // far from the core
  const input = heroBot(s, builder);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0); // heads back toward the core (50,50)
  expect(input.move.y).toBeGreaterThan(0);
});

test('a defender holds position when already near the core and no threat', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  const defender = hero(s, 'defender');
  defender.pos = { ...core.pos };
  const input = heroBot(s, defender);
  expect(input.move).toEqual({ x: 0, y: 0 });
  expect(BUILD_COSTS.tower).toBeGreaterThan(0);
});
