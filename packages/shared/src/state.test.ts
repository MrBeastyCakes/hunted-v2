import { createInitialState } from './state';
import { CORE_START_HP, MONSTER_START_HP } from './constants';

test('creates a playing match with one monster and four heroes', () => {
  const s = createInitialState(123);
  expect(s.phase).toBe('playing');
  expect(s.tick).toBe(0);
  expect(s.monster.kind).toBe('monster');
  expect(s.monster.health.hp).toBe(MONSTER_START_HP);
  expect(s.heroes).toHaveLength(4);
  const roles = s.heroes.map((h) => h.role).sort();
  expect(roles).toEqual(['builder', 'defender', 'economy', 'scout']);
});

test('includes a city core building at full HP', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core');
  expect(core).toBeDefined();
  expect(core!.health.hp).toBe(CORE_START_HP);
});

test('seeds RNG state from the seed and is reproducible', () => {
  const a = createInitialState(123);
  const b = createInitialState(123);
  expect(a.rngSeed).toBe(123);
  expect(a).toEqual(b);
});

test('all entity and building ids are unique', () => {
  const s = createInitialState(123);
  const ids = [
    s.monster.id,
    ...s.heroes.map((h) => h.id),
    ...s.buildings.map((b) => b.id),
    ...s.map.wildlifeNodes.map((n) => n.id),
    ...s.map.resourceNodes.map((n) => n.id),
  ];
  expect(new Set(ids).size).toBe(ids.length);
});
