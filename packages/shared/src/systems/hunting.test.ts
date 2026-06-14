import { huntingSystem } from './hunting';
import { createInitialState } from '../state';
import { MOB_BITE_DAMAGE, MOB_HP, NODE_RESPAWN_TICKS, VILLAGER_XP, WILDLIFE_XP } from '../constants';

test('a mob in catch range loses HP but is not removed until it dies', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs.find((m) => m.species === 'wildlife')!;
  s.map.mobs = [mob];
  s.monster.pos = { ...mob.pos };
  huntingSystem(s);
  expect(mob.hp).toBe(MOB_HP - MOB_BITE_DAMAGE);
  expect(s.map.mobs).toHaveLength(1);
  expect(s.monster.evolution!.xp).toBe(0);
});

test('enough bites kill a wildlife mob and grant WILDLIFE_XP', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs.find((m) => m.species === 'wildlife')!;
  s.map.mobs = [mob];
  s.monster.pos = { ...mob.pos };
  const bites = Math.ceil(MOB_HP / MOB_BITE_DAMAGE);
  for (let i = 0; i < bites; i++) huntingSystem(s);
  expect(s.map.mobs).toHaveLength(0);
  expect(s.monster.evolution!.xp).toBe(WILDLIFE_XP);
});

test('a villager grants the larger VILLAGER_XP when killed', () => {
  const s = createInitialState(1);
  const v = s.map.mobs.find((m) => m.species === 'villager')!;
  s.map.mobs = [v];
  s.monster.pos = { ...v.pos };
  const bites = Math.ceil(MOB_HP / MOB_BITE_DAMAGE);
  for (let i = 0; i < bites; i++) huntingSystem(s);
  expect(s.monster.evolution!.xp).toBe(VILLAGER_XP);
});

test('mobs out of catch range are untouched', () => {
  const s = createInitialState(1);
  s.monster.pos = { x: 0, y: 0 };
  const before = s.map.mobs.map((m) => m.hp);
  huntingSystem(s);
  expect(s.map.mobs.map((m) => m.hp)).toEqual(before);
  expect(s.monster.evolution!.xp).toBe(0);
});

test('only the nearest mob is bitten per tick', () => {
  const s = createInitialState(1);
  const a = s.map.mobs[0];
  const b = s.map.mobs[1];
  a.pos = { x: 50, y: 50 };
  b.pos = { x: 50.5, y: 50 };
  s.map.mobs = [a, b];
  s.monster.pos = { x: 50, y: 50 };
  huntingSystem(s);
  expect(a.hp).toBe(MOB_HP - MOB_BITE_DAMAGE);
  expect(b.hp).toBe(MOB_HP);
  expect(NODE_RESPAWN_TICKS).toBeGreaterThan(0);
});

test('respawn refills a depleted herd on the respawn tick', () => {
  const s = createInitialState(1);
  const herd = s.map.herds.find((h) => h.species === 'wildlife')!;
  s.map.mobs = s.map.mobs.filter((m) => m.herdId !== herd.id);
  s.monster.pos = { x: 0, y: 0 };
  s.tick = NODE_RESPAWN_TICKS; // also a herd respawn multiple? use HERD_RESPAWN_TICKS below instead
  // use the herd respawn tick explicitly
  s.tick = 100;
  huntingSystem(s);
  const count = s.map.mobs.filter((m) => m.herdId === herd.id).length;
  expect(count).toBeGreaterThan(0);
  expect(s.map.mobs.every((m) => m.hp === MOB_HP)).toBe(true);
});
