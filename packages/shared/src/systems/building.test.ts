import { buildingSystem } from './building';
import { createInitialState } from '../state';
import { BUILD_COSTS, BUILDER_DISCOUNT, TOWER_COMBAT } from '../constants';
import type { InputMap } from '../types';

test('a hero builds a tower at its position, spending materials', () => {
  const s = createInitialState(123);
  const hero = s.heroes.find((h) => h.role === 'defender')!;
  s.resources.materials = 100;
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'tower' },
  };
  buildingSystem(s, inputs);
  const tower = s.buildings.find((b) => b.type === 'tower');
  expect(tower).toBeDefined();
  expect(tower!.pos).toEqual(hero.pos);
  expect(tower!.combat).toEqual(TOWER_COMBAT);
  expect(s.resources.materials).toBe(100 - BUILD_COSTS.tower);
});

test('builder role gets a discount', () => {
  const s = createInitialState(123);
  const builder = s.heroes.find((h) => h.role === 'builder')!;
  s.resources.materials = 100;
  const inputs: InputMap = {
    [builder.id]: { actorId: builder.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'generator' },
  };
  buildingSystem(s, inputs);
  expect(s.resources.materials).toBe(100 - Math.floor(BUILD_COSTS.generator * BUILDER_DISCOUNT));
});

test('cannot build without enough materials', () => {
  const s = createInitialState(123);
  const hero = s.heroes.find((h) => h.role === 'defender')!;
  s.resources.materials = 5;
  const before = s.buildings.length;
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'tower' },
  };
  buildingSystem(s, inputs);
  expect(s.buildings.length).toBe(before);
  expect(s.resources.materials).toBe(5);
});

test('new building ids are unique', () => {
  const s = createInitialState(123);
  const builder = s.heroes.find((h) => h.role === 'builder')!;
  const economy = s.heroes.find((h) => h.role === 'economy')!;
  s.resources.materials = 1000;
  const inputs: InputMap = {
    [builder.id]: { actorId: builder.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'generator' },
    [economy.id]: { actorId: economy.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'tower' },
  };
  buildingSystem(s, inputs);
  const ids = s.buildings.map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('cannot build a core', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  s.resources.materials = 1000;
  const before = s.buildings.length;
  const inputs: InputMap = {
    // 'core' is a valid BuildingType but not buildable; the system must ignore it
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'core' },
  };
  buildingSystem(s, inputs);
  expect(s.buildings.length).toBe(before);
});
