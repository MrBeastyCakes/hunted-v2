import { step } from './step';
import { createInitialState } from './state';
import type { InputMap } from './types';

test('step returns a new state and advances the tick', () => {
  const s0 = createInitialState(123);
  const s1 = step(s0, {});
  expect(s1.tick).toBe(1);
  expect(s0.tick).toBe(0); // original is not mutated
});

test('step applies movement inputs', () => {
  const s0 = createInitialState(123);
  const hero = s0.heroes[0];
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 1, y: 0 } },
  };
  const s1 = step(s0, inputs);
  expect(s1.heroes[0].pos.x).toBeGreaterThan(hero.pos.x);
});

test('does not advance when phase is not playing', () => {
  const s0 = createInitialState(123);
  s0.phase = 'buildersWon';
  const s1 = step(s0, {});
  expect(s1.tick).toBe(0);
});

test('same seed + same input log => identical final state (determinism)', () => {
  const log: InputMap[] = [];
  // build a deterministic 50-tick input log driving the monster in a square
  const seed = createInitialState(777);
  const mId = seed.monster.id;
  const dirs = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  for (let i = 0; i < 50; i++) {
    log.push({ [mId]: { actorId: mId, move: dirs[i % 4] } });
  }

  let a = createInitialState(777);
  let b = createInitialState(777);
  for (const inp of log) {
    a = step(a, inp);
    b = step(b, inp);
  }
  expect(a).toEqual(b);
});
