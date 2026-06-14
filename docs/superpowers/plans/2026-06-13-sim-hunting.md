# Sim Hunting + 5-Level Evolution Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace passive feeding with active hunting in the simulation: roaming herds of wildlife and a villager herd at the campfire that scatter when approached and are eaten on contact for XP, plus a 5-level evolution curve with widening XP thresholds. The monster bot hunts.

**Architecture:** Two new pure deterministic systems in `@game/shared` — `herdSystem` (mob wander + scatter/flee) and `huntingSystem` (eat-on-contact + respawn) — plus a reworked `evolutionSystem` (5 stages by `MONSTER_STAGE_XP`). New `Mob`/`Herd` types live in `GameState.map`. **Additive & non-breaking:** the legacy `wildlifeNodes` + `feedingSystem` stay in place this plan so the client keeps compiling; Plan B removes them after migrating the client.

**Tech Stack:** TypeScript, Vitest.

**Builds on Plans 1–7:** uses `step()`, `createInitialState`, `nextRandom`, `distance`, the combat city-damage XP, and the monster bot.

---

### Task 1: Types + constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add mob/herd types** to `types.ts`

After the `ResourceNode` interface, add:
```ts
export type MobSpecies = 'wildlife' | 'villager';

export interface Mob {
  id: EntityId;
  herdId: number;
  species: MobSpecies;
  pos: Vec2;
  state: 'calm' | 'fleeing';
  fleeTicks: number;
}

export interface Herd {
  id: number;
  species: MobSpecies;
  home: Vec2;
}
```

In the `MapState` interface, add `mobs` and `herds` (keep `wildlifeNodes` for now):
```ts
export interface MapState {
  width: number;
  height: number;
  wildlifeNodes: ResourceNode[];
  resourceNodes: ResourceNode[];
  mobs: Mob[];
  herds: Herd[];
}
```

- [ ] **Step 2: Add constants** to `constants.ts`

Append:
```ts
// --- Hunting / mobs ---
export const WILDLIFE_HERD_COUNT = 3;
export const MOB_PER_HERD = 5;
export const VILLAGERS_AT_START = 5;
export const MOB_WANDER_SPEED = 2;
export const MOB_FLEE_SPEED = 5.5; // just under monster speed (6)
export const HERD_WANDER_RADIUS = 6;
export const SCATTER_RADIUS = 10;
export const SCATTER_TICKS = 40; // 2s at 20Hz
export const CATCH_RANGE = 1.5;
export const HERD_RESPAWN_TICKS = 100; // every 5s
export const WILDLIFE_XP = 25;
export const VILLAGER_XP = 120;

// --- 5-level evolution (xp required to be AT each stage, index 0 = stage 1) ---
export const MONSTER_STAGE_XP = [0, 100, 300, 800, 1800];
```

Change the existing combat XP constant:
```ts
export const CITY_DAMAGE_XP = 3; // monster xp per point of building damage dealt (was 2)
```

Remove the now-unused old-evolution constants `STAGE2_XP`, `STAGE3_XP`, and `STAGE3_CITY_DAMAGE_REQ` (the new evolution uses `MONSTER_STAGE_XP`). Keep `STAGE_HP_BONUS` and `STAGE_DAMAGE_BONUS`.

- [ ] **Step 3: Type-check (expect errors only in evolution.ts/its test, fixed in Task 4)**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit & cd ../..`
Expected: errors referencing `STAGE2_XP`/`STAGE3_XP` in `systems/evolution.ts` and its test (resolved in Task 4) and the missing `mobs`/`herds` in `createInitialState` (resolved in Task 2). That's expected mid-task; proceed.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat(sim): add mob/herd types and hunting + 5-level constants"
```

---

### Task 2: Spawn herds in createInitialState

**Files:**
- Modify: `packages/shared/src/state.ts`
- Modify: `packages/shared/src/state.test.ts`

- [ ] **Step 1: Update the failing tests** (edit `state.test.ts`)

Add `MOB_PER_HERD`, `VILLAGERS_AT_START`, `WILDLIFE_HERD_COUNT` to the constants import, then add:
```ts
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
```

Update the existing "all entity and building ids are unique" test to include mobs:
```ts
  const ids = [
    s.monster.id,
    ...s.heroes.map((h) => h.id),
    ...s.buildings.map((b) => b.id),
    ...s.map.wildlifeNodes.map((n) => n.id),
    ...s.map.resourceNodes.map((n) => n.id),
    ...s.map.mobs.map((m) => m.id),
  ];
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test state`
Expected: FAIL — `s.map.herds`/`s.map.mobs` are undefined.

- [ ] **Step 3: Implement** in `state.ts`

Add to the imports from `./constants`: `MOB_PER_HERD`, `VILLAGERS_AT_START`, `WILDLIFE_HERD_COUNT`.

Add type imports: extend the `./types` import with `Herd, Mob, MobSpecies`.

Before the `return`, build herds + mobs (deterministic placement — no RNG, so the state stays reproducible):
```ts
  const herds: Herd[] = [];
  const mobs: Mob[] = [];

  const spawnHerd = (species: MobSpecies, home: { x: number; y: number }, size: number) => {
    const herdId = id();
    herds.push({ id: herdId, species, home: { ...home } });
    for (let i = 0; i < size; i++) {
      const ang = (i / size) * Math.PI * 2;
      mobs.push({
        id: id(),
        herdId,
        species,
        pos: { x: home.x + Math.cos(ang) * 2, y: home.y + Math.sin(ang) * 2 },
        state: 'calm',
        fleeTicks: 0,
      });
    }
  };

  const wildlifeHomes = [
    { x: 18, y: 18 },
    { x: 82, y: 22 },
    { x: 50, y: 80 },
  ];
  for (let i = 0; i < WILDLIFE_HERD_COUNT; i++) {
    spawnHerd('wildlife', wildlifeHomes[i % wildlifeHomes.length], MOB_PER_HERD);
  }
  spawnHerd('villager', center, VILLAGERS_AT_START);
```

Add `mobs` and `herds` to the returned `map`:
```ts
    map: { width: MAP_WIDTH, height: MAP_HEIGHT, wildlifeNodes, resourceNodes, mobs, herds },
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/state.ts packages/shared/src/state.test.ts
git commit -m "feat(sim): spawn wildlife + villager herds in initial state"
```

---

### Task 3: herdSystem (wander + scatter)

**Files:**
- Create: `packages/shared/src/systems/herd.ts`
- Test: `packages/shared/src/systems/herd.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { herdSystem } from './herd';
import { createInitialState } from '../state';
import { SCATTER_RADIUS } from '../constants';

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

test('herd movement is deterministic for a given seed', () => {
  const a = createInitialState(7);
  const b = createInitialState(7);
  for (let i = 0; i < 30; i++) {
    herdSystem(a);
    herdSystem(b);
  }
  expect(a.map.mobs).toEqual(b.map.mobs);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test herd`
Expected: FAIL — cannot find module `./herd`.

- [ ] **Step 3: Implement** `packages/shared/src/systems/herd.ts`

```ts
import {
  HERD_WANDER_RADIUS,
  MOB_FLEE_SPEED,
  MOB_WANDER_SPEED,
  SCATTER_RADIUS,
  SCATTER_TICKS,
  DT,
} from '../constants';
import { clamp, distance, normalize } from '../math';
import { nextRandom } from '../rng';
import type { GameState, Herd } from '../types';

// Mob movement: herds wander near home, but scatter and flee when the monster is near.
export function herdSystem(state: GameState): void {
  const m = state.monster;

  // 1. Which herds are panicked this tick?
  const panicked = new Set<number>();
  if (m.alive) {
    for (const mob of state.map.mobs) {
      if (distance(m.pos, mob.pos) <= SCATTER_RADIUS) panicked.add(mob.herdId);
    }
  }

  const homeOf = new Map<number, Herd>();
  for (const h of state.map.herds) homeOf.set(h.id, h);

  for (const mob of state.map.mobs) {
    if (panicked.has(mob.herdId)) {
      mob.state = 'fleeing';
      mob.fleeTicks = SCATTER_TICKS;
    }

    if (mob.state === 'fleeing' && mob.fleeTicks > 0 && m.alive) {
      const away = normalize({ x: mob.pos.x - m.pos.x, y: mob.pos.y - m.pos.y });
      mob.pos.x = clamp(mob.pos.x + away.x * MOB_FLEE_SPEED * DT, 0, state.map.width);
      mob.pos.y = clamp(mob.pos.y + away.y * MOB_FLEE_SPEED * DT, 0, state.map.height);
      mob.fleeTicks -= 1;
      if (mob.fleeTicks <= 0) mob.state = 'calm';
      continue;
    }

    // calm wander
    mob.state = 'calm';
    const home = homeOf.get(mob.herdId)?.home ?? mob.pos;
    let dir;
    if (distance(mob.pos, home) > HERD_WANDER_RADIUS) {
      dir = normalize({ x: home.x - mob.pos.x, y: home.y - mob.pos.y });
    } else {
      const ang = nextRandom(state) * Math.PI * 2;
      dir = { x: Math.cos(ang), y: Math.sin(ang) };
    }
    mob.pos.x = clamp(mob.pos.x + dir.x * MOB_WANDER_SPEED * DT, 0, state.map.width);
    mob.pos.y = clamp(mob.pos.y + dir.y * MOB_WANDER_SPEED * DT, 0, state.map.height);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test herd`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/herd.ts packages/shared/src/systems/herd.test.ts
git commit -m "feat(sim): add herd system (wander + scatter/flee)"
```

---

### Task 4: huntingSystem (eat + respawn) and reworked evolution

**Files:**
- Create: `packages/shared/src/systems/hunting.ts`
- Test: `packages/shared/src/systems/hunting.test.ts`
- Modify: `packages/shared/src/systems/evolution.ts`
- Modify: `packages/shared/src/systems/evolution.test.ts`

- [ ] **Step 1: Write the hunting test**

`packages/shared/src/systems/hunting.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test hunting`
Expected: FAIL — cannot find module `./hunting`.

- [ ] **Step 3: Implement** `packages/shared/src/systems/hunting.ts`

```ts
import {
  CATCH_RANGE,
  HERD_RESPAWN_TICKS,
  MOB_PER_HERD,
  VILLAGERS_AT_START,
  VILLAGER_XP,
  WILDLIFE_XP,
} from '../constants';
import { distance } from '../math';
import type { GameState, Mob } from '../types';

function maxId(state: GameState): number {
  let max = state.monster.id;
  for (const h of state.heroes) max = Math.max(max, h.id);
  for (const b of state.buildings) max = Math.max(max, b.id);
  for (const n of state.map.wildlifeNodes) max = Math.max(max, n.id);
  for (const n of state.map.resourceNodes) max = Math.max(max, n.id);
  for (const mob of state.map.mobs) max = Math.max(max, mob.id);
  return max;
}

// Monster eats mobs on contact (XP by species), and herds slowly repopulate.
export function huntingSystem(state: GameState): void {
  const m = state.monster;

  if (m.alive && m.evolution) {
    const remaining: Mob[] = [];
    for (const mob of state.map.mobs) {
      if (distance(m.pos, mob.pos) <= CATCH_RANGE) {
        m.evolution.xp += mob.species === 'villager' ? VILLAGER_XP : WILDLIFE_XP;
      } else {
        remaining.push(mob);
      }
    }
    state.map.mobs = remaining;
  }

  if (state.tick > 0 && state.tick % HERD_RESPAWN_TICKS === 0) {
    let nextId = maxId(state) + 1;
    for (const herd of state.map.herds) {
      const target = herd.species === 'villager' ? VILLAGERS_AT_START : MOB_PER_HERD;
      let count = state.map.mobs.filter((mb) => mb.herdId === herd.id).length;
      while (count < target) {
        state.map.mobs.push({
          id: nextId++,
          herdId: herd.id,
          species: herd.species,
          pos: { ...herd.home },
          state: 'calm',
          fleeTicks: 0,
        });
        count += 1;
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test hunting`
Expected: PASS (5 tests).

- [ ] **Step 5: Rewrite the evolution test** `packages/shared/src/systems/evolution.test.ts`

```ts
import { evolutionSystem } from './evolution';
import { createInitialState } from '../state';
import { MONSTER_STAGE_XP, STAGE_DAMAGE_BONUS, STAGE_HP_BONUS } from '../constants';

test('reaching a threshold advances the stage with HP + damage gains', () => {
  const s = createInitialState(1);
  const m = s.monster;
  const baseMaxHp = m.health.maxHp;
  const baseDmg = m.combat!.damage;
  m.evolution!.xp = MONSTER_STAGE_XP[1]; // enough for stage 2
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(2);
  expect(m.health.maxHp).toBe(baseMaxHp + STAGE_HP_BONUS);
  expect(m.combat!.damage).toBe(baseDmg + STAGE_DAMAGE_BONUS);
});

test('enough xp jumps multiple stages at once (heals + buffs per stage)', () => {
  const s = createInitialState(1);
  const m = s.monster;
  const baseMaxHp = m.health.maxHp;
  m.evolution!.xp = MONSTER_STAGE_XP[2]; // stage 3
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(3);
  expect(m.health.maxHp).toBe(baseMaxHp + 2 * STAGE_HP_BONUS);
});

test('caps at stage 5', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = MONSTER_STAGE_XP[4] + 99999;
  evolutionSystem(s);
  expect(s.monster.evolution!.stage).toBe(5);
});

test('evolution only moves upward and is idempotent', () => {
  const s = createInitialState(1);
  const m = s.monster;
  m.evolution!.xp = MONSTER_STAGE_XP[1];
  evolutionSystem(s);
  const hp = m.health.maxHp;
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(2);
  expect(m.health.maxHp).toBe(hp);
});
```

- [ ] **Step 6: Rewrite** `packages/shared/src/systems/evolution.ts`

```ts
import { MONSTER_STAGE_XP, STAGE_DAMAGE_BONUS, STAGE_HP_BONUS } from '../constants';
import type { GameState } from '../types';

// Advances the monster to the highest stage whose XP threshold it has reached (max 5).
// One-way; each gained stage heals and strengthens the monster.
export function evolutionSystem(state: GameState): void {
  const m = state.monster;
  if (!m.alive || !m.evolution || !m.combat) return;
  const evo = m.evolution;

  let target = 1;
  for (let stage = 1; stage <= MONSTER_STAGE_XP.length; stage++) {
    if (evo.xp >= MONSTER_STAGE_XP[stage - 1]) target = stage;
  }

  while (evo.stage < target) {
    evo.stage += 1;
    m.health.maxHp += STAGE_HP_BONUS;
    m.health.hp += STAGE_HP_BONUS;
    m.combat.damage += STAGE_DAMAGE_BONUS;
  }
}
```

- [ ] **Step 7: Run evolution + hunting tests**

Run: `pnpm --filter @game/shared test evolution`
Expected: PASS (4 tests).
Run: `pnpm --filter @game/shared test hunting`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/systems/hunting.ts packages/shared/src/systems/hunting.test.ts packages/shared/src/systems/evolution.ts packages/shared/src/systems/evolution.test.ts
git commit -m "feat(sim): add hunting system and 5-level evolution"
```

---

### Task 5: Wire the new systems into step()

**Files:**
- Modify: `packages/shared/src/step.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Wire `step.ts`**

Add imports:
```ts
import { herdSystem } from './systems/herd';
import { huntingSystem } from './systems/hunting';
```

Insert the two systems right after `movementSystem` and before `feedingSystem` (feeding stays this plan):
```ts
  movementSystem(next, inputs);
  herdSystem(next);
  huntingSystem(next);
  feedingSystem(next, inputs);
  economySystem(next);
  buildingSystem(next, inputs);
  combatSystem(next, inputs);
  evolutionSystem(next);
  winConditionSystem(next);
```

- [ ] **Step 2: Export the new systems** from `index.ts`

```ts
export { herdSystem } from './systems/herd';
export { huntingSystem } from './systems/hunting';
```

- [ ] **Step 3: Run the determinism + step tests**

Run: `pnpm --filter @game/shared test step`
Expected: PASS — the determinism test still holds (mobs use only seeded RNG).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/step.ts packages/shared/src/index.ts
git commit -m "feat(sim): wire herd + hunting systems into step()"
```

---

### Task 6: Monster bot hunts

**Files:**
- Modify: `packages/shared/src/bots/monster.ts`
- Modify: `packages/shared/src/bots/monster.test.ts`
- Modify: `packages/shared/src/bots/dispatch.test.ts`

- [ ] **Step 1: Rewrite the monster-bot test** `packages/shared/src/bots/monster.test.ts`

```ts
import { monsterBot } from './monster';
import { createInitialState } from '../state';

test('the monster moves toward the nearest mob to hunt it', () => {
  const s = createInitialState(123);
  // place a wildlife mob clearly nearest, to the monster's east
  s.map.mobs = [
    { id: 9001, herdId: 1, species: 'wildlife', pos: { x: s.monster.pos.x + 10, y: s.monster.pos.y }, state: 'calm', fleeTicks: 0 },
  ];
  const input = monsterBot(s);
  expect(input.actorId).toBe(s.monster.id);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0);
});

test('with no mobs left, the monster heads for the campfire', () => {
  const s = createInitialState(123);
  s.map.mobs = [];
  const core = s.buildings.find((b) => b.type === 'core')!;
  const input = monsterBot(s);
  // monster spawns at (5,5); core is at (50,50) -> both components positive
  expect(input.move.x).toBeGreaterThan(0);
  expect(input.move.y).toBeGreaterThan(0);
  expect(core).toBeDefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test bots/monster`
Expected: FAIL — current bot uses wildlife nodes/feeding, not mobs.

- [ ] **Step 3: Rewrite** `packages/shared/src/bots/monster.ts`

```ts
import { distance } from '../math';
import type { GameState, Input, Mob, Vec2 } from '../types';

function toward(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y }; // the sim normalizes direction
}

function nearestMob(state: GameState, from: Vec2): Mob | undefined {
  let best: Mob | undefined;
  let bestDist = Infinity;
  for (const mob of state.map.mobs) {
    const d = distance(from, mob.pos);
    if (d < bestDist) {
      bestDist = d;
      best = mob;
    }
  }
  return best;
}

// Hunt the nearest mob (eating is automatic on contact); if none remain, march on the campfire.
export function monsterBot(state: GameState): Input {
  const m = state.monster;
  const id = m.id;

  const mob = nearestMob(state, m.pos);
  if (mob) return { actorId: id, move: toward(m.pos, mob.pos) };

  const core = state.buildings.find((b) => b.type === 'core');
  if (core) return { actorId: id, move: toward(m.pos, core.pos) };
  return { actorId: id, move: { x: 0, y: 0 } };
}
```

- [ ] **Step 4: Fix the dispatch test** in `packages/shared/src/bots/dispatch.test.ts`

Replace the "routes the monster id to the monster bot" test body (it asserted feeding) with:
```ts
test('routes the monster id to the monster bot', () => {
  const s = createInitialState(123);
  s.map.mobs = [
    { id: 9001, herdId: 1, species: 'wildlife', pos: { x: s.monster.pos.x + 5, y: s.monster.pos.y }, state: 'calm', fleeTicks: 0 },
  ];
  const input = botThink(s, s.monster.id);
  expect(input.actorId).toBe(s.monster.id);
  expect(input.move.x).toBeGreaterThan(0); // monster-bot behavior: moves toward the mob
});
```

- [ ] **Step 5: Run the bot tests**

Run: `pnpm --filter @game/shared test bots`
Expected: PASS (monster, hero, dispatch, and bots.integration suites).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/bots/monster.ts packages/shared/src/bots/monster.test.ts packages/shared/src/bots/dispatch.test.ts
git commit -m "feat(sim): monster bot hunts mobs"
```

---

### Task 7: Update integration test + full sweep

**Files:**
- Modify: `packages/shared/src/integration.test.ts`

- [ ] **Step 1: Replace the feed-based stage test**

In `integration.test.ts`, remove the test titled `'feeding then risking the city carries the monster to stage 3'` and replace it with a hunting test:
```ts
test('hunting mobs levels the monster up', () => {
  let s = createInitialState(3);
  // Drive the monster onto each mob in turn and let step() eat them.
  for (let i = 0; i < 12 && s.map.mobs.length > 0; i++) {
    const target = s.map.mobs[0];
    s = structuredClone(s);
    s.monster.pos = { ...target.pos }; // teleport onto a mob (eaten next step)
    s = step(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  }
  expect(s.monster.evolution!.xp).toBeGreaterThan(0);
  expect(s.monster.evolution!.stage).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Type-check and run the whole shared suite**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.
Run: `pnpm --filter @game/shared test`
Expected: PASS — all suites, including `bots.integration` (the autonomous match still terminates) and the determinism test.

(If `bots.integration` exceeds its guard, the monster bot + hunting balance needs a look before proceeding — investigate, do not just raise the guard.)

- [ ] **Step 3: Confirm the client still builds (additive change didn't break it)**

Run: `pnpm --filter @game/client test`
Expected: PASS — the client is untouched; `wildlifeNodes` and `'feed'` still exist, so it compiles and its tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/integration.test.ts
git commit -m "test(sim): replace feed test with hunting level-up test"
```

---

## Self-Review

**Spec coverage:**
- Mob/Herd entities, wildlife + villager species, villager herd at campfire → Tasks 1, 2. ✓
- Wander + scatter/flee, deterministic → Task 3. ✓
- Eat-on-contact (species XP) + respawn → Task 4. ✓
- 5-level evolution, widening thresholds, gate removed → Task 4 (evolution rework). ✓
- Monster bot hunts → Task 6. ✓
- Step wiring; determinism preserved → Task 5. ✓
- Additive/non-breaking (legacy feeding + wildlifeNodes retained; client stays green) → Tasks 1, 5, 7. Legacy removal is Plan B. ✓
- Building-devour XP → already in combat via `CITY_DAMAGE_XP` (bumped to 3 in Task 1). ✓

**Placeholder scan:** No TBD/TODO; complete code in every step. The retained `wildlifeNodes`/`feedingSystem` are an intentional transitional measure (removed in Plan B), not a gap. ✓

**Type consistency:** `Mob`/`Herd`/`MobSpecies` defined in Task 1, used in Tasks 2–6. `MONSTER_STAGE_XP` defined in Task 1, used by evolution (Task 4) and its test. New systems `herdSystem(state)`/`huntingSystem(state)` signatures match their `step()` calls (Task 5) and exports. `monsterBot(state)` unchanged signature. `nextRandom(state)` (rng.ts) and `distance`/`normalize`/`clamp` (math.ts) reused. ✓
