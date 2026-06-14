import { herdSystem } from './herd';
import { createInitialState } from '../state';
import { HERD_MIGRATE_TICKS, SCATTER_RADIUS } from '../constants';

test('a mob far from the monster stays near its herd home (calm)', () => {
  const s = createInitialState(1);
  s.monster.pos = { x: 0, y: 0 }; // far from everything
  const mob = s.map.mobs[0];
  const home = s.map.herds.find((h) => h.id === mob.herdId)!.home;
  for (let i = 0; i < 50; i++) herdSystem(s);
  const d = Math.hypot(mob.pos.x - home.x, mob.pos.y - home.y);
  expect(mob.state).toBe('calm');
  expect(d).toBeLessThan(8); // within wander radius (+ a step)
});

test('approaching a herd makes the whole herd flee away from the monster', () => {
  const s = createInitialState(1);
  const herd = s.map.herds.find((h) => h.species === 'wildlife')!;
  s.monster.pos = { ...herd.home }; // right on top of them
  herdSystem(s);
  const herdMobs = s.map.mobs.filter((m) => m.herdId === herd.id);
  expect(herdMobs.every((m) => m.state === 'fleeing')).toBe(true);
});

test('a fleeing mob increases its distance from the monster', () => {
  const s = createInitialState(1);
  const herd = s.map.herds.find((h) => h.species === 'wildlife')!;
  const mob = s.map.mobs.find((m) => m.herdId === herd.id)!;
  s.monster.pos = { x: mob.pos.x - 3, y: mob.pos.y }; // monster just west
  const before = Math.hypot(mob.pos.x - s.monster.pos.x, mob.pos.y - s.monster.pos.y);
  herdSystem(s);
  const after = Math.hypot(mob.pos.x - s.monster.pos.x, mob.pos.y - s.monster.pos.y);
  expect(after).toBeGreaterThan(before);
  expect(SCATTER_RADIUS).toBeGreaterThan(0);
});

test('a wildlife herd home migrates on the migrate tick', () => {
  const s = createInitialState(5);
  s.monster.pos = { x: 0, y: 0 }; // no panic
  const herd = s.map.herds.find((h) => h.species === 'wildlife')!;
  const before = { ...herd.home };
  s.tick = HERD_MIGRATE_TICKS;
  herdSystem(s);
  const moved = before.x !== herd.home.x || before.y !== herd.home.y;
  expect(moved).toBe(true);
});

test('the villager herd home does not migrate', () => {
  const s = createInitialState(5);
  s.monster.pos = { x: 0, y: 0 };
  const villager = s.map.herds.find((h) => h.species === 'villager')!;
  const before = { ...villager.home };
  s.tick = HERD_MIGRATE_TICKS;
  herdSystem(s);
  expect(villager.home).toEqual(before);
});

test('herd movement is deterministic for a given seed', () => {
  const a = createInitialState(7);
  const b = createInitialState(7);
  for (let i = 0; i < 30; i++) {
    herdSystem(a);
    herdSystem(b);
  }
  expect(a.map.mobs).toEqual(b.map.mobs);
});
