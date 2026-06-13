import { economySystem } from './economy';
import { createInitialState } from '../state';
import { ECONOMY_ROLE_BONUS, GENERATOR_RATE } from '../constants';
import type { Building } from '../types';

function generator(id: number): Building {
  return { id, type: 'generator', pos: { x: 0, y: 0 }, health: { hp: 30, maxHp: 30 }, level: 1 };
}

test('each generator produces materials per tick', () => {
  const s = createInitialState(123);
  // remove the economy hero so we isolate generator income
  s.heroes = s.heroes.filter((h) => h.role !== 'economy');
  s.resources.materials = 0;
  s.buildings.push(generator(1001), generator(1002));
  economySystem(s);
  expect(s.resources.materials).toBe(2 * GENERATOR_RATE);
});

test('a living economy hero adds a flat income bonus', () => {
  const s = createInitialState(123);
  s.resources.materials = 0;
  economySystem(s);
  expect(s.resources.materials).toBe(ECONOMY_ROLE_BONUS);
});

test('a dead economy hero gives no bonus', () => {
  const s = createInitialState(123);
  s.resources.materials = 0;
  const eco = s.heroes.find((h) => h.role === 'economy')!;
  eco.alive = false;
  economySystem(s);
  expect(s.resources.materials).toBe(0);
});
