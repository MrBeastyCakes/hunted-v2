import { findActor, pickTarget } from './pointer';
import { createInitialState } from '@game/shared';

test('findActor returns the monster and heroes by id, undefined otherwise', () => {
  const s = createInitialState(1);
  expect(findActor(s, s.monster.id)?.kind).toBe('monster');
  expect(findActor(s, s.heroes[0].id)?.id).toBe(s.heroes[0].id);
  expect(findActor(s, 999999)).toBeUndefined();
});

test('pickTarget grabs a wildlife node when tapped near it', () => {
  const s = createInitialState(1);
  const node = s.map.wildlifeNodes[0];
  const pick = pickTarget(s, { x: node.pos.x + 0.5, y: node.pos.y }, 3.5);
  expect(pick).toEqual({ kind: 'wildlife', id: node.id, pos: node.pos });
});

test('pickTarget grabs the monster when tapped on it', () => {
  const s = createInitialState(1);
  const pick = pickTarget(s, { ...s.monster.pos }, 3.5);
  expect(pick?.kind).toBe('monster');
  expect(pick?.id).toBe(s.monster.id);
});

test('pickTarget returns undefined when the tap is in open space', () => {
  const s = createInitialState(1);
  // a corner far from everything
  expect(pickTarget(s, { x: 2, y: 98 }, 3.5)).toBeUndefined();
});

test('pickTarget ignores dead actors and depleted wildlife', () => {
  const s = createInitialState(1);
  s.monster.alive = false;
  const node = s.map.wildlifeNodes[0];
  node.amount = 0;
  expect(pickTarget(s, { ...s.monster.pos }, 3.5)).toBeUndefined();
  expect(pickTarget(s, { ...node.pos }, 3.5)).toBeUndefined();
});
