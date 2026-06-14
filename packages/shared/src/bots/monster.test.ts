import { monsterBot } from './monster';
import { createInitialState } from '../state';

test('the monster moves toward the nearest mob to hunt it', () => {
  const s = createInitialState(123);
  // place a single wildlife mob clearly to the monster's east
  s.map.mobs = [
    {
      id: 9001,
      herdId: 1,
      species: 'wildlife',
      pos: { x: s.monster.pos.x + 10, y: s.monster.pos.y },
      state: 'calm',
      fleeTicks: 0,
    },
  ];
  const input = monsterBot(s);
  expect(input.actorId).toBe(s.monster.id);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0);
});

test('with no mobs left, the monster heads for the campfire', () => {
  const s = createInitialState(123);
  s.map.mobs = [];
  const core = s.buildings.find((b) => b.type === 'core')!;
  const input = monsterBot(s);
  // monster spawns at (5,5); core is at (50,50) -> both components positive
  expect(input.move.x).toBeGreaterThan(0);
  expect(input.move.y).toBeGreaterThan(0);
  expect(core).toBeDefined();
});
