import { huntingSystem } from './hunting';
import { createInitialState } from '../state';
import { CATCH_RANGE, HERD_RESPAWN_TICKS, MOB_PER_HERD, VILLAGER_XP, WILDLIFE_XP } from '../constants';

test('eats a wildlife mob in catch range and grants WILDLIFE_XP', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs.find((m) => m.species === 'wildlife')!;
  s.monster.pos = { ...mob.pos };
  const before = s.map.mobs.length;
  huntingSystem(s);
  expect(s.map.mobs.find((m) => m.id === mob.id)).toBeUndefined();
  expect(s.map.mobs.length).toBe(before - 1);
  expect(s.monster.evolution!.xp).toBe(WILDLIFE_XP);
});

test('eating a villager grants the larger VILLAGER_XP', () => {
  const s = createInitialState(1);
  const v = s.map.mobs.find((m) => m.species === 'villager')!;
  s.monster.pos = { ...v.pos };
  huntingSystem(s);
  expect(s.monster.evolution!.xp).toBe(VILLAGER_XP);
});

test('mobs out of catch range are not eaten', () => {
  const s = createInitialState(1);
  s.monster.pos = { x: 0, y: 0 };
  const before = s.map.mobs.length;
  huntingSystem(s);
  expect(s.map.mobs.length).toBe(before);
  expect(s.monster.evolution!.xp).toBe(0);
});

test('respawn refills a depleted herd on the respawn tick', () => {
  const s = createInitialState(1);
  const herd = s.map.herds.find((h) => h.species === 'wildlife')!;
  s.map.mobs = s.map.mobs.filter((m) => m.herdId !== herd.id); // wipe that herd
  s.tick = HERD_RESPAWN_TICKS; // a respawn tick
  huntingSystem(s);
  const count = s.map.mobs.filter((m) => m.herdId === herd.id).length;
  expect(count).toBe(MOB_PER_HERD);
});

test('new respawned mob ids are unique', () => {
  const s = createInitialState(1);
  const herd = s.map.herds.find((h) => h.species === 'wildlife')!;
  s.map.mobs = s.map.mobs.filter((m) => m.herdId !== herd.id);
  s.tick = HERD_RESPAWN_TICKS;
  huntingSystem(s);
  expect(CATCH_RANGE).toBeGreaterThan(0);
  const ids = s.map.mobs.map((m) => m.id);
  expect(new Set(ids).size).toBe(ids.length);
});
