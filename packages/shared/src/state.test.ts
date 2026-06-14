import { createInitialState } from './state';
import {
  CORE_START_HP,
  MONSTER_START_HP,
  MONSTER_START_XP,
  MOB_PER_HERD,
  UNARMED_DAMAGE,
  UNARMED_RANGE,
  VILLAGERS_AT_START,
  WILDLIFE_HERD_COUNT,
} from './constants';

test('creates a playing match with one monster and four heroes', () => {
  const s = createInitialState(123);
  expect(s.phase).toBe('playing');
  expect(s.tick).toBe(0);
  expect(s.monster.kind).toBe('monster');
  expect(s.monster.health.hp).toBe(MONSTER_START_HP);
  expect(s.heroes).toHaveLength(4);
  const roles = s.heroes.map((h) => h.role).sort();
  expect(roles).toEqual(['builder', 'defender', 'economy', 'scout']);
});

test('includes a city core building at full HP', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core');
  expect(core).toBeDefined();
  expect(core!.health.hp).toBe(CORE_START_HP);
});

test('seeds RNG state from the seed and is reproducible', () => {
  const a = createInitialState(123);
  const b = createInitialState(123);
  expect(a.rngSeed).toBe(123);
  expect(a).toEqual(b);
});

test('spawns wildlife herds and one villager herd at the campfire', () => {
  const s = createInitialState(123);
  const wildlifeHerds = s.map.herds.filter((h) => h.species === 'wildlife');
  const villagerHerds = s.map.herds.filter((h) => h.species === 'villager');
  expect(wildlifeHerds).toHaveLength(WILDLIFE_HERD_COUNT);
  expect(villagerHerds).toHaveLength(1);

  const core = s.buildings.find((b) => b.type === 'core')!;
  expect(villagerHerds[0].home).toEqual(core.pos);

  const wildlife = s.map.mobs.filter((m) => m.species === 'wildlife');
  const villagers = s.map.mobs.filter((m) => m.species === 'villager');
  expect(wildlife).toHaveLength(WILDLIFE_HERD_COUNT * MOB_PER_HERD);
  expect(villagers).toHaveLength(VILLAGERS_AT_START);
  expect(s.map.mobs.every((m) => m.state === 'calm')).toBe(true);
});

test('wildlife herds spawn a mix of prey tiers; villagers are the villager tier', () => {
  const s = createInitialState(123);
  const wildTiers = new Set(s.map.mobs.filter((m) => m.species === 'wildlife').map((m) => m.tier));
  expect(wildTiers.has('critter')).toBe(true);
  expect(wildTiers.has('large')).toBe(true);
  expect(s.map.mobs.filter((m) => m.species === 'villager').every((m) => m.tier === 'villager')).toBe(true);
});

test('the monster starts with one free level of XP to spend on spawn', () => {
  const s = createInitialState(1);
  expect(s.monster.evolution!.xp).toBe(MONSTER_START_XP);
  expect(s.monster.evolution!.level).toBe(1);
});

test('heroes start unarmed with weak melee combat', () => {
  const s = createInitialState(1);
  expect(s.map.weapons).toEqual([]);
  for (const h of s.heroes) {
    expect(h.equipped).toBeUndefined();
    expect(h.combat!.damage).toBe(UNARMED_DAMAGE);
    expect(h.combat!.range).toBe(UNARMED_RANGE);
  }
});

test('all entity and building ids are unique', () => {
  const s = createInitialState(123);
  const ids = [
    s.monster.id,
    ...s.heroes.map((h) => h.id),
    ...s.buildings.map((b) => b.id),
    ...s.map.resourceNodes.map((n) => n.id),
    ...s.map.mobs.map((m) => m.id),
  ];
  expect(new Set(ids).size).toBe(ids.length);
});
