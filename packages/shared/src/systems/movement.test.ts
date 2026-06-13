import { movementSystem } from './movement';
import { createInitialState } from '../state';
import { DT, HERO_SPEED } from '../constants';
import type { InputMap } from '../types';

test('moves an actor in the normalized input direction by speed * DT', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  const startX = hero.pos.x;
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 1, y: 0 } },
  };
  movementSystem(s, inputs);
  expect(hero.pos.x).toBeCloseTo(startX + HERO_SPEED * DT);
});

test('diagonal movement is normalized (no speed boost)', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  const start = { ...hero.pos };
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 1, y: 1 } },
  };
  movementSystem(s, inputs);
  const dist = Math.hypot(hero.pos.x - start.x, hero.pos.y - start.y);
  expect(dist).toBeCloseTo(HERO_SPEED * DT);
});

test('no input means no movement', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  const start = { ...hero.pos };
  movementSystem(s, {});
  expect(hero.pos).toEqual(start);
});

test('clamps position to map bounds', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  hero.pos = { x: 0, y: 0 };
  hero.speed = 1000; // would overshoot
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: -1, y: -1 } },
  };
  movementSystem(s, inputs);
  expect(hero.pos.x).toBe(0);
  expect(hero.pos.y).toBe(0);
});

test('dead actors do not move', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  hero.alive = false;
  const start = { ...hero.pos };
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 1, y: 0 } },
  };
  movementSystem(s, inputs);
  expect(hero.pos).toEqual(start);
});
