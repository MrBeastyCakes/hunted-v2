import { monsterBot } from './monster';
import { createInitialState } from '../state';
import { levelCost } from '../skill';

test('the monster bot spends banked XP on a sense when it can afford a level', () => {
  const s = createInitialState(123);
  s.monster.evolution!.xp = levelCost(s.monster.evolution!.level) + 5;
  const input = monsterBot(s);
  expect(input.action).toBe('spend');
  expect(['vision', 'hearing', 'smell']).toContain(input.skillPath);
});

test('the monster moves toward the nearest mob to hunt it', () => {
  const s = createInitialState(123);
  s.monster.evolution!.xp = 0; // don't auto-spend; assert movement
  // place a single wildlife mob clearly to the monster's east
  s.map.mobs = [
    {
      id: 9001,
      herdId: 1,
      species: 'wildlife',
      tier: 'critter',
      pos: { x: s.monster.pos.x + 10, y: s.monster.pos.y },
      state: 'calm',
      fleeTicks: 0,
      hp: 6,
    },
  ];
  const input = monsterBot(s);
  expect(input.actorId).toBe(s.monster.id);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0);
});

test('with no mobs left, the monster heads for the campfire', () => {
  const s = createInitialState(123);
  s.monster.evolution!.xp = 0; // don't auto-spend; assert movement
  s.map.mobs = [];
  const core = s.buildings.find((b) => b.type === 'core')!;
  const input = monsterBot(s);
  // monster spawns at (5,5); core is at (50,50) -> both components positive
  expect(input.move.x).toBeGreaterThan(0);
  expect(input.move.y).toBeGreaterThan(0);
  expect(core).toBeDefined();
});
