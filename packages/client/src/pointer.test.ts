import { findActor, pickTarget, resolveTapIntent } from './pointer';
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

test('monster tapping a wildlife node yields a feed intent', () => {
  const s = createInitialState(1);
  const node = s.map.wildlifeNodes[0];
  const intent = resolveTapIntent(s, s.monster.id, { ...node.pos }, 3.5);
  expect(intent).toEqual({ kind: 'feed', nodeId: node.id });
});

test('monster tapping a building yields an attack intent at its position', () => {
  const s = createInitialState(1);
  const core = s.buildings.find((b) => b.type === 'core')!;
  const intent = resolveTapIntent(s, s.monster.id, { ...core.pos }, 3.5);
  expect(intent).toEqual({ kind: 'attack', point: core.pos });
});

test('a hero tapping the monster yields an attack intent', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  const intent = resolveTapIntent(s, hero.id, { ...s.monster.pos }, 3.5);
  expect(intent).toEqual({ kind: 'attack', point: s.monster.pos });
});

test('tapping open ground yields a move intent to that point', () => {
  const s = createInitialState(1);
  const intent = resolveTapIntent(s, s.heroes[0].id, { x: 2, y: 98 }, 3.5);
  expect(intent).toEqual({ kind: 'move', point: { x: 2, y: 98 } });
});

test('a dead controlled hero tapping an actor yields a spectate intent', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  hero.alive = false;
  const ally = s.heroes[1];
  const intent = resolveTapIntent(s, hero.id, { ...ally.pos }, 3.5);
  expect(intent).toEqual({ kind: 'spectate', actorId: ally.id });
});
