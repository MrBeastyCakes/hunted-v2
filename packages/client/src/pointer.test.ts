import {
  applyIntent,
  controlToInput,
  findActor,
  moveTargetToInput,
  pickTarget,
  resolveTapIntent,
  type PointerControl,
} from './pointer';
import { createInitialState } from '@game/shared';

test('findActor returns the monster and heroes by id, undefined otherwise', () => {
  const s = createInitialState(1);
  expect(findActor(s, s.monster.id)?.kind).toBe('monster');
  expect(findActor(s, s.heroes[0].id)?.id).toBe(s.heroes[0].id);
  expect(findActor(s, 999999)).toBeUndefined();
});

test('pickTarget grabs a mob when tapped near it', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs[0];
  const pick = pickTarget(s, { x: mob.pos.x + 0.4, y: mob.pos.y }, 3.5);
  expect(pick).toEqual({ kind: 'mob', id: mob.id, pos: mob.pos });
});

test('pickTarget grabs the monster when tapped on it', () => {
  const s = createInitialState(1);
  s.map.mobs = []; // isolate the monster from nearby mobs
  const pick = pickTarget(s, { ...s.monster.pos }, 3.5);
  expect(pick?.kind).toBe('monster');
  expect(pick?.id).toBe(s.monster.id);
});

test('pickTarget returns undefined when the tap is in open space', () => {
  const s = createInitialState(1);
  s.map.mobs = [];
  expect(pickTarget(s, { x: 2, y: 98 }, 3.5)).toBeUndefined();
});

test('pickTarget ignores dead actors', () => {
  const s = createInitialState(1);
  s.monster.alive = false;
  s.map.mobs = [];
  expect(pickTarget(s, { ...s.monster.pos }, 3.5)).toBeUndefined();
});

test('monster tapping a mob yields a chase intent', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs[0];
  const intent = resolveTapIntent(s, s.monster.id, { ...mob.pos }, 3.5);
  expect(intent).toEqual({ kind: 'chase', mobId: mob.id });
});

test('monster tapping a building yields an attack intent at its position', () => {
  const s = createInitialState(1);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.map.mobs = []; // so the building is the nearest pick
  const intent = resolveTapIntent(s, s.monster.id, { ...core.pos }, 3.5);
  expect(intent).toEqual({ kind: 'attack', point: core.pos });
});

test('a hero tapping the monster yields an attack intent', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  s.map.mobs = [];
  const intent = resolveTapIntent(s, hero.id, { ...s.monster.pos }, 3.5);
  expect(intent).toEqual({ kind: 'attack', point: s.monster.pos });
});

test('tapping open ground yields a move intent to that point', () => {
  const s = createInitialState(1);
  const intent = resolveTapIntent(s, s.heroes[0].id, { x: 2, y: 98 }, 3.5);
  expect(intent).toEqual({ kind: 'move', point: { x: 2, y: 98 } });
});

test('a dead controlled hero tapping an actor yields a spectate intent', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  hero.alive = false;
  const ally = s.heroes[1];
  s.map.mobs = [];
  const intent = resolveTapIntent(s, hero.id, { ...ally.pos }, 3.5);
  expect(intent).toEqual({ kind: 'spectate', actorId: ally.id });
});

test('a hero tapping the campfire (core) opens the build menu', () => {
  const s = createInitialState(1);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.map.mobs = [];
  const intent = resolveTapIntent(s, s.heroes[0].id, { ...core.pos }, 3.5);
  expect(intent).toEqual({ kind: 'openBuildMenu' });
});

test('the monster tapping the campfire attacks, not opens a menu', () => {
  const s = createInitialState(1);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.map.mobs = [];
  const intent = resolveTapIntent(s, s.monster.id, { ...core.pos }, 3.5);
  expect(intent).toEqual({ kind: 'attack', point: core.pos });
});

test('moveTargetToInput points toward the target, zero on arrival', () => {
  const a = moveTargetToInput(5, { x: 0, y: 0 }, { x: 10, y: 0 }, 0.6);
  expect(a).toEqual({ actorId: 5, move: { x: 10, y: 0 } });
  const b = moveTargetToInput(5, { x: 10, y: 0 }, { x: 10, y: 0 }, 0.6);
  expect(b.move).toEqual({ x: 0, y: 0 });
});

test('applyIntent sets a move target and clears chasing', () => {
  const c = applyIntent({ chaseMobId: 9 }, { kind: 'move', point: { x: 3, y: 4 } });
  expect(c).toEqual({ moveTarget: { x: 3, y: 4 } });
});

test('applyIntent for chase sets the chase mob and clears move target', () => {
  const c = applyIntent({ moveTarget: { x: 1, y: 1 } }, { kind: 'chase', mobId: 9 });
  expect(c).toEqual({ chaseMobId: 9 });
});

test('controlToInput walks toward a move target', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  const control: PointerControl = { moveTarget: { x: hero.pos.x + 20, y: hero.pos.y } };
  const input = controlToInput(s, hero.id, control, 0.6);
  expect(input.move.x).toBeGreaterThan(0);
  expect(input.action).toBeUndefined();
});

test('controlToInput steers toward the chased mob, stops when it is gone', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs[0];
  s.monster.pos = { x: mob.pos.x - 10, y: mob.pos.y };
  const chasing = controlToInput(s, s.monster.id, { chaseMobId: mob.id }, 0.6);
  expect(chasing.move.x).toBeGreaterThan(0); // toward the mob (east)
  const gone = controlToInput(s, s.monster.id, { chaseMobId: 999999 }, 0.6);
  expect(gone.move).toEqual({ x: 0, y: 0 });
});

test('controlToInput with no control is a no-op', () => {
  const s = createInitialState(1);
  expect(controlToInput(s, s.heroes[0].id, {}, 0.6).move).toEqual({ x: 0, y: 0 });
});

test('pickTarget grabs a weapon pickup', () => {
  const s = createInitialState(1);
  s.map.weapons = [{ id: 9001, type: 'sword', pos: { x: 50, y: 50 } }];
  s.map.mobs = [];
  const pick = pickTarget(s, { x: 50, y: 50 }, 3.5);
  expect(pick).toEqual({ kind: 'weapon', id: 9001, pos: { x: 50, y: 50 } });
});

test('a hero tapping a blacksmith opens the craft menu', () => {
  const s = createInitialState(1);
  s.buildings.push({ id: 9002, type: 'blacksmith', pos: { x: 60, y: 60 }, health: { hp: 35, maxHp: 35 }, level: 1 });
  s.map.mobs = [];
  const intent = resolveTapIntent(s, s.heroes[0].id, { x: 60, y: 60 }, 3.5);
  expect(intent).toEqual({ kind: 'openCraftMenu' });
});

test('a hero tapping a weapon moves to it (to equip)', () => {
  const s = createInitialState(1);
  s.map.weapons = [{ id: 9003, type: 'bow', pos: { x: 40, y: 40 } }];
  s.map.mobs = [];
  const intent = resolveTapIntent(s, s.heroes[0].id, { x: 40, y: 40 }, 3.5);
  expect(intent).toEqual({ kind: 'move', point: { x: 40, y: 40 } });
});
