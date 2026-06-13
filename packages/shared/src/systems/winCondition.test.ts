import { winConditionSystem } from './winCondition';
import { createInitialState } from '../state';

test('monster wins when the core is destroyed', () => {
  const s = createInitialState(123);
  s.buildings.find((b) => b.type === 'core')!.health.hp = 0;
  winConditionSystem(s);
  expect(s.phase).toBe('monsterWon');
});

test('monster wins when the core is gone entirely', () => {
  const s = createInitialState(123);
  s.buildings = s.buildings.filter((b) => b.type !== 'core');
  winConditionSystem(s);
  expect(s.phase).toBe('monsterWon');
});

test('builders win when the monster is dead', () => {
  const s = createInitialState(123);
  s.monster.alive = false;
  winConditionSystem(s);
  expect(s.phase).toBe('buildersWon');
});

test('play continues while both sides are alive', () => {
  const s = createInitialState(123);
  winConditionSystem(s);
  expect(s.phase).toBe('playing');
});

test('monster win takes priority if both fall on the same tick', () => {
  const s = createInitialState(123);
  s.buildings.find((b) => b.type === 'core')!.health.hp = 0;
  s.monster.alive = false;
  winConditionSystem(s);
  expect(s.phase).toBe('monsterWon');
});
