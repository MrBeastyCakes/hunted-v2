import { monsterBot } from './monster';
import { createInitialState } from '../state';

test('a weak monster moves toward the nearest wildlife node', () => {
  const s = createInitialState(123);
  // monster starts at (5,5); nearest wildlife is (15,15)
  const input = monsterBot(s);
  expect(input.actorId).toBe(s.monster.id);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0);
  expect(input.move.y).toBeGreaterThan(0);
});

test('a weak monster on a wildlife node feeds', () => {
  const s = createInitialState(123);
  s.monster.pos = { ...s.map.wildlifeNodes[0].pos };
  expect(monsterBot(s).action).toBe('feed');
});

test('a stage-2 monster assaults the city core (moves toward it, no feed)', () => {
  const s = createInitialState(123);
  s.monster.evolution!.stage = 2;
  const core = s.buildings.find((b) => b.type === 'core')!;
  const input = monsterBot(s);
  expect(input.action).toBeUndefined();
  // from (5,5) toward core (50,50): both components positive
  expect(input.move.x).toBeGreaterThan(0);
  expect(input.move.y).toBeGreaterThan(0);
  expect(core).toBeDefined();
});

test('with all wildlife depleted, even a weak monster assaults', () => {
  const s = createInitialState(123);
  for (const n of s.map.wildlifeNodes) n.amount = 0;
  const input = monsterBot(s);
  expect(input.action).toBeUndefined(); // no feed; it heads for the core
});
