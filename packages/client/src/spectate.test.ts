import { spectatableIds, nextSpectateTarget, isActorAlive } from './spectate';
import { createInitialState } from '@game/shared';

test('spectatableIds lists living heroes (excluding the dead self) then the monster', () => {
  const s = createInitialState(1);
  const dead = s.heroes[0];
  dead.alive = false;
  const ids = spectatableIds(s, dead.id);
  const livingHeroIds = s.heroes.filter((h) => h.alive && h.id !== dead.id).map((h) => h.id);
  expect(ids).toEqual([...livingHeroIds, s.monster.id]);
});

test('spectatableIds omits the monster when it is dead', () => {
  const s = createInitialState(1);
  s.monster.alive = false;
  const ids = spectatableIds(s, s.heroes[0].id);
  expect(ids).not.toContain(s.monster.id);
});

test('nextSpectateTarget starts at the first option when none is set', () => {
  expect(nextSpectateTarget(undefined, [3, 5, 7])).toBe(3);
});

test('nextSpectateTarget cycles and wraps around', () => {
  expect(nextSpectateTarget(3, [3, 5, 7])).toBe(5);
  expect(nextSpectateTarget(7, [3, 5, 7])).toBe(3);
});

test('nextSpectateTarget resets to first when current is no longer an option', () => {
  expect(nextSpectateTarget(99, [3, 5, 7])).toBe(3);
});

test('nextSpectateTarget returns undefined when there is nothing to watch', () => {
  expect(nextSpectateTarget(3, [])).toBeUndefined();
});

test('isActorAlive reflects the entity alive flag', () => {
  const s = createInitialState(1);
  expect(isActorAlive(s, s.monster.id)).toBe(true);
  s.heroes[0].alive = false;
  expect(isActorAlive(s, s.heroes[0].id)).toBe(false);
  expect(isActorAlive(s, 999999)).toBe(false);
});
