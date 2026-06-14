import { winConditionSystem } from './winCondition';
import { createInitialState } from '../state';
import { TOTAL_TICKS } from '../time';

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

test('builders win by surviving to the end of the final night', () => {
  const s = createInitialState(123);
  s.tick = TOTAL_TICKS;
  winConditionSystem(s);
  expect(s.phase).toBe('buildersWon');
});

test('surviving the timer does not override a monster win', () => {
  const s = createInitialState(123);
  s.tick = TOTAL_TICKS;
  s.buildings.find((b) => b.type === 'core')!.health.hp = 0;
  winConditionSystem(s);
  expect(s.phase).toBe('monsterWon');
});
