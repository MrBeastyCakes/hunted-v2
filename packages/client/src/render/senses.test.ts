import { hearRange, hearTargets, smellRanges, smellTargets } from './senses';
import { createInitialState } from '@game/shared';

test('smellRanges grow with rank', () => {
  expect(smellRanges(0)).toEqual({ rancid: 0, food: 0, living: 0 });
  expect(smellRanges(1).rancid).toBe(20);
  expect(smellRanges(2).food).toBe(40);
  expect(smellRanges(3).living).toBe(10);
  expect(smellRanges(4).living).toBe(20);
});

test('smell rank 0 perceives nothing', () => {
  const s = createInitialState(1);
  expect(smellTargets(s, 0)).toEqual([]);
});

test('rank 1 smells a nearby large beast as rancid', () => {
  const s = createInitialState(1);
  const large = s.map.mobs.find((m) => m.tier === 'large')!;
  s.monster.pos = { x: large.pos.x + 5, y: large.pos.y }; // within 20
  const targets = smellTargets(s, 1);
  expect(targets.some((t) => t.id === large.id && t.category === 'rancid')).toBe(true);
  // a critter is NOT smellable at rank 1 (living needs rank 3)
  const critter = s.map.mobs.find((m) => m.tier === 'critter')!;
  expect(targets.some((t) => t.id === critter.id)).toBe(false);
});

test('rank 3 smells a nearby critter as living', () => {
  const s = createInitialState(1);
  const critter = s.map.mobs.find((m) => m.tier === 'critter')!;
  s.monster.pos = { x: critter.pos.x + 3, y: critter.pos.y }; // within 10
  const targets = smellTargets(s, 3);
  expect(targets.some((t) => t.id === critter.id && t.category === 'living')).toBe(true);
});

test('hearRange follows the rank table', () => {
  expect(hearRange(0)).toBe(0);
  expect(hearRange(1)).toBe(10);
  expect(hearRange(2)).toBe(20);
  expect(hearRange(4)).toBe(40);
});

test('hearing perceives creatures within range only', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs[0];
  s.monster.pos = { x: mob.pos.x + 5, y: mob.pos.y }; // within 10
  expect(hearTargets(s, 1).some((t) => t.id === mob.id)).toBe(true);
  s.monster.pos = { x: mob.pos.x + 50, y: mob.pos.y }; // out of 10
  expect(hearTargets(s, 1).some((t) => t.id === mob.id)).toBe(false);
});
