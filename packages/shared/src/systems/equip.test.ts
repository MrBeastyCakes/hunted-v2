import { equipSystem } from './equip';
import { createInitialState } from '../state';
import { WEAPON_DAMAGE, WEAPON_RANGE } from '../constants';

test('a hero on a weapon equips it; the pickup is consumed', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  s.map.weapons = [{ id: 9001, type: 'bow', pos: { ...hero.pos } }];
  equipSystem(s);
  expect(hero.equipped).toBe('bow');
  expect(hero.combat!.range).toBe(WEAPON_RANGE.bow);
  expect(hero.combat!.damage).toBe(WEAPON_DAMAGE.bow);
  expect(s.map.weapons).toHaveLength(0);
});

test('a weapon out of pickup range is left on the rack', () => {
  const s = createInitialState(1);
  s.heroes.forEach((h) => (h.pos = { x: 0, y: 0 }));
  s.map.weapons = [{ id: 9001, type: 'sword', pos: { x: 80, y: 80 } }];
  equipSystem(s);
  expect(s.map.weapons).toHaveLength(1);
  expect(s.heroes.every((h) => h.equipped === undefined)).toBe(true);
});

test('equipping a sword sets strong melee stats', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  s.map.weapons = [{ id: 9002, type: 'sword', pos: { ...hero.pos } }];
  equipSystem(s);
  expect(hero.equipped).toBe('sword');
  expect(hero.combat!.damage).toBe(WEAPON_DAMAGE.sword);
});
