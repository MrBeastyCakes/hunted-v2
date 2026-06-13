import { botThink } from './index';
import { createInitialState } from '../state';

test('routes the monster id to the monster bot', () => {
  const s = createInitialState(123);
  s.monster.pos = { ...s.map.wildlifeNodes[0].pos };
  expect(botThink(s, s.monster.id).action).toBe('feed'); // monster-bot behavior
});

test('routes a hero id to the hero bot', () => {
  const s = createInitialState(123);
  s.resources.materials = 100;
  const builder = s.heroes.find((h) => h.role === 'builder')!;
  const input = botThink(s, builder.id);
  expect(input.actorId).toBe(builder.id);
  expect(input.action).toBe('build'); // hero-bot behavior
});

test('an unknown actor id yields a no-op input', () => {
  const s = createInitialState(123);
  expect(botThink(s, 999999)).toEqual({ actorId: 999999, move: { x: 0, y: 0 } });
});
