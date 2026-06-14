import { huntingSystem } from './hunting';
import { createInitialState } from '../state';
import { LARGE_BITE_BACK, MOB_BITE_DAMAGE, NODE_RESPAWN_TICKS, PREY_STATS } from '../constants';

test('a critter in catch range loses HP but is not removed until it dies', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 0;
  const mob = s.map.mobs.find((m) => m.tier === 'critter')!;
  s.map.mobs = [mob];
  s.monster.pos = { ...mob.pos };
  huntingSystem(s);
  expect(mob.hp).toBe(PREY_STATS.critter.hp - MOB_BITE_DAMAGE);
  expect(s.map.mobs).toHaveLength(1);
  expect(s.monster.evolution!.xp).toBe(0);
});

test('killing a critter grants critter XP', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 0;
  const mob = s.map.mobs.find((m) => m.tier === 'critter')!;
  s.map.mobs = [mob];
  s.monster.pos = { ...mob.pos };
  const bites = Math.ceil(PREY_STATS.critter.hp / MOB_BITE_DAMAGE);
  for (let i = 0; i < bites; i++) huntingSystem(s);
  expect(s.map.mobs).toHaveLength(0);
  expect(s.monster.evolution!.xp).toBe(PREY_STATS.critter.xp);
});

test('killing a villager grants the big villager XP', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 0;
  const v = s.map.mobs.find((m) => m.tier === 'villager')!;
  s.map.mobs = [v];
  s.monster.pos = { ...v.pos };
  const bites = Math.ceil(PREY_STATS.villager.hp / MOB_BITE_DAMAGE);
  for (let i = 0; i < bites; i++) huntingSystem(s);
  expect(s.monster.evolution!.xp).toBe(PREY_STATS.villager.xp);
});

test('a large creature bites back while being hunted', () => {
  const s = createInitialState(1);
  const large = s.map.mobs.find((m) => m.tier === 'large')!;
  s.map.mobs = [large];
  s.monster.pos = { ...large.pos };
  const hp = s.monster.health.hp;
  huntingSystem(s);
  expect(s.monster.health.hp).toBe(hp - LARGE_BITE_BACK);
});

test('mobs out of catch range are untouched', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 0;
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
  const aHp = a.hp;
  const bHp = b.hp;
  huntingSystem(s);
  expect(a.hp).toBe(aHp - MOB_BITE_DAMAGE);
  expect(b.hp).toBe(bHp);
  expect(NODE_RESPAWN_TICKS).toBeGreaterThan(0);
});

test('respawn refills a depleted herd with critters on the respawn tick', () => {
  const s = createInitialState(1);
  const herd = s.map.herds.find((h) => h.species === 'wildlife')!;
  s.map.mobs = s.map.mobs.filter((m) => m.herdId !== herd.id);
  s.monster.pos = { x: 0, y: 0 };
  s.tick = 100;
  huntingSystem(s);
  const refilled = s.map.mobs.filter((m) => m.herdId === herd.id);
  expect(refilled.length).toBeGreaterThan(0);
  expect(refilled.every((m) => m.tier === 'critter' && m.hp === PREY_STATS.critter.hp)).toBe(true);
});
