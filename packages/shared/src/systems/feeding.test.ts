import { feedingSystem } from './feeding';
import { createInitialState } from '../state';
import { FEED_RATE, XP_PER_AMOUNT } from '../constants';
import type { InputMap } from '../types';

function feedInput(state: ReturnType<typeof createInitialState>): InputMap {
  return { [state.monster.id]: { actorId: state.monster.id, move: { x: 0, y: 0 }, action: 'feed' } };
}

test('feeding drains the nearest wildlife node in range and grants XP', () => {
  const s = createInitialState(123);
  const node = s.map.wildlifeNodes[0];
  s.monster.pos = { ...node.pos }; // stand on it
  const startAmount = node.amount;
  feedingSystem(s, feedInput(s));
  expect(node.amount).toBe(startAmount - FEED_RATE);
  expect(s.monster.evolution!.xp).toBe(FEED_RATE * XP_PER_AMOUNT);
});

test('no feeding when out of range', () => {
  const s = createInitialState(123);
  s.monster.pos = { x: 0, y: 0 };
  const before = s.map.wildlifeNodes.map((n) => n.amount);
  feedingSystem(s, feedInput(s));
  expect(s.map.wildlifeNodes.map((n) => n.amount)).toEqual(before);
  expect(s.monster.evolution!.xp).toBe(0);
});

test('no feeding without the feed action', () => {
  const s = createInitialState(123);
  s.monster.pos = { ...s.map.wildlifeNodes[0].pos };
  feedingSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  expect(s.monster.evolution!.xp).toBe(0);
});

test('draining never goes below zero', () => {
  const s = createInitialState(123);
  const node = s.map.wildlifeNodes[0];
  node.amount = 2;
  s.monster.pos = { ...node.pos };
  feedingSystem(s, feedInput(s));
  expect(node.amount).toBe(0);
  expect(s.monster.evolution!.xp).toBe(2 * XP_PER_AMOUNT);
});
