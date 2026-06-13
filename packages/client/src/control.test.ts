import { actorIdForSide, inputFromKeys, type KeyMap, type Side } from './control';
import { createInitialState } from '@game/shared';

const noKeys: KeyMap = { up: false, down: false, left: false, right: false, feed: false, build: false };

test('actorIdForSide returns the monster id', () => {
  const s = createInitialState(1);
  expect(actorIdForSide(s, 'monster')).toBe(s.monster.id);
});

test('actorIdForSide returns the hero id for a role', () => {
  const s = createInitialState(1);
  const scout = s.heroes.find((h) => h.role === 'scout')!;
  expect(actorIdForSide(s, 'scout')).toBe(scout.id);
});

test('inputFromKeys maps direction keys to a move vector', () => {
  const input = inputFromKeys(7, { ...noKeys, left: true, up: true });
  expect(input).toEqual({ actorId: 7, move: { x: -1, y: -1 } });
});

test('opposing keys cancel out', () => {
  const input = inputFromKeys(7, { ...noKeys, left: true, right: true });
  expect(input.move).toEqual({ x: 0, y: 0 });
});

test('feed key sets the feed action', () => {
  const input = inputFromKeys(7, { ...noKeys, feed: true });
  expect(input.action).toBe('feed');
});

test('build key sets the build action and build type', () => {
  const input = inputFromKeys(7, { ...noKeys, build: true }, 'tower');
  expect(input.action).toBe('build');
  expect(input.buildType).toBe('tower');
});

test('feed takes priority over build when both are held', () => {
  const input = inputFromKeys(7, { ...noKeys, feed: true, build: true }, 'tower');
  expect(input.action).toBe('feed');
});

test('Side type accepts monster and roles', () => {
  const sides: Side[] = ['monster', 'builder', 'defender', 'scout', 'economy'];
  expect(sides).toHaveLength(5);
});
