import { combatSystem } from './combat';
import { createInitialState } from '../state';
import { CITY_DAMAGE_XP, WORKSHOP_HERO_DAMAGE_BONUS, TOWER_COMBAT } from '../constants';
import type { Building } from '../types';

test('a hero in range damages the monster and goes on cooldown', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  for (const h of s.heroes) if (h !== hero) h.pos = { x: 0, y: 0 }; // isolate this hero
  s.monster.pos = { ...hero.pos }; // in range
  const startHp = s.monster.health.hp;
  combatSystem(s, {});
  expect(s.monster.health.hp).toBe(startHp - hero.combat!.damage);
  expect(hero.combat!.cooldownRemaining).toBe(hero.combat!.cooldown);
});

test('cooldown blocks a second attack on the next tick', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  s.monster.pos = { ...hero.pos };
  combatSystem(s, {});
  const hpAfterFirst = s.monster.health.hp;
  combatSystem(s, {}); // cooldown ticks 12 -> 11, still > 0, no attack
  expect(s.monster.health.hp).toBe(hpAfterFirst);
});

test('monster attacks the city core and gains city-damage XP', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos };
  // push heroes far away so the core is the nearest target
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  const startCoreHp = core.health.hp;
  const dmg = s.monster.combat!.damage;
  combatSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  expect(core.health.hp).toBe(startCoreHp - dmg);
  expect(s.monster.evolution!.cityDamageDealt).toBe(dmg);
  expect(s.monster.evolution!.xp).toBe(dmg * CITY_DAMAGE_XP);
});

test('monster does not attack while feeding', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  const startCoreHp = core.health.hp;
  combatSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 }, action: 'feed' } });
  expect(core.health.hp).toBe(startCoreHp);
});

test('a tower auto-attacks the monster in range', () => {
  const s = createInitialState(123);
  const tower: Building = {
    id: 9001,
    type: 'tower',
    pos: { x: 50, y: 50 },
    health: { hp: 40, maxHp: 40 },
    level: 1,
    combat: { ...TOWER_COMBAT },
  };
  s.buildings.push(tower);
  s.monster.pos = { x: 50, y: 50 };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 }; // isolate tower damage
  const startHp = s.monster.health.hp;
  combatSystem(s, {});
  expect(s.monster.health.hp).toBe(startHp - TOWER_COMBAT.damage);
});

test('a workshop boosts hero attack damage', () => {
  const s = createInitialState(123);
  s.buildings.push({
    id: 9002, type: 'workshop', pos: { x: 0, y: 0 }, health: { hp: 30, maxHp: 30 }, level: 1,
  });
  const hero = s.heroes[0];
  // isolate this hero: move the others away
  for (const h of s.heroes) if (h !== hero) h.pos = { x: 0, y: 0 };
  s.monster.pos = { ...hero.pos };
  const startHp = s.monster.health.hp;
  combatSystem(s, {});
  expect(s.monster.health.hp).toBe(startHp - (hero.combat!.damage + WORKSHOP_HERO_DAMAGE_BONUS));
});

test('lethal damage marks the monster dead', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  s.monster.health.hp = 1;
  s.monster.pos = { ...hero.pos };
  combatSystem(s, {});
  expect(s.monster.health.hp).toBe(0);
  expect(s.monster.alive).toBe(false);
});

test('destroyed non-core buildings are removed; core is kept', () => {
  const s = createInitialState(123);
  const tower: Building = {
    id: 9003, type: 'tower', pos: { x: 50, y: 50 }, health: { hp: 0, maxHp: 40 }, level: 1,
  };
  s.buildings.push(tower);
  const core = s.buildings.find((b) => b.type === 'core')!;
  core.health.hp = 0;
  combatSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  expect(s.buildings.find((b) => b.id === 9003)).toBeUndefined();
  expect(s.buildings.find((b) => b.type === 'core')).toBeDefined();
});
