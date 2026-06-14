# Hunt Tuning: easier to catch, harder to kill (Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make forest creatures easier to catch (slower flee, panic later, bigger bite reach) and a little harder to kill (mobs get a small HP pool; the monster bites them down over a few ticks instead of instant-eat). Sim-only. Then redeploy.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Constants + mob HP field

**Files:** `packages/shared/src/constants.ts`, `packages/shared/src/types.ts`, `packages/shared/src/state.ts`, `packages/shared/src/systems/hunting.ts` (respawn)

- [ ] **Step 1: Constants** — in `constants.ts`:
  - change `MOB_FLEE_SPEED` 5.5 → `3.5`
  - change `SCATTER_RADIUS` 10 → `7`
  - change `CATCH_RANGE` 1.5 → `2.2`
  - append:
```ts
export const MOB_HP = 16;
export const MOB_BITE_DAMAGE = 4; // monster damage per tick to a mob in catch range
```

- [ ] **Step 2: Mob type** — in `types.ts`, add `hp` to `Mob`:
```ts
export interface Mob {
  id: EntityId;
  herdId: number;
  species: MobSpecies;
  pos: Vec2;
  state: 'calm' | 'fleeing';
  fleeTicks: number;
  hp: number;
}
```

- [ ] **Step 3: Spawn with hp** — in `state.ts`, import `MOB_HP` and add `hp: MOB_HP` to the mob
created in `spawnHerd`:
```ts
      mobs.push({
        id: id(),
        herdId,
        species,
        pos: { x: home.x + Math.cos(ang) * 2, y: home.y + Math.sin(ang) * 2 },
        state: 'calm',
        fleeTicks: 0,
        hp: MOB_HP,
      });
```

- [ ] **Step 4: Respawned mobs get hp** — in `hunting.ts` respawn block, add `hp: MOB_HP` (import
`MOB_HP`):
```ts
        state.map.mobs.push({
          id: nextId++,
          herdId: herd.id,
          species: herd.species,
          pos: { ...herd.home },
          state: 'calm',
          fleeTicks: 0,
          hp: MOB_HP,
        });
```

- [ ] **Step 5: Type-check**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/types.ts packages/shared/src/state.ts packages/shared/src/systems/hunting.ts
git commit -m "feat(sim): mobs gain HP; easier-to-catch flee/scatter tuning"
```

---

### Task 2: huntingSystem bites mobs down

**Files:** `packages/shared/src/systems/hunting.ts`, `packages/shared/src/systems/hunting.test.ts`

- [ ] **Step 1: Rewrite the hunting tests** (`hunting.test.ts`)

```ts
import { huntingSystem } from './hunting';
import { createInitialState } from '../state';
import {
  MOB_BITE_DAMAGE,
  MOB_HP,
  NODE_RESPAWN_TICKS, // (unused import guard below)
  VILLAGER_XP,
  WILDLIFE_XP,
} from '../constants';

test('a mob in catch range loses HP but is not removed until it dies', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs.find((m) => m.species === 'wildlife')!;
  s.monster.pos = { ...mob.pos };
  huntingSystem(s);
  expect(mob.hp).toBe(MOB_HP - MOB_BITE_DAMAGE);
  expect(s.map.mobs.find((m) => m.id === mob.id)).toBeDefined();
  expect(s.monster.evolution!.xp).toBe(0);
});

test('enough bites kill a wildlife mob and grant WILDLIFE_XP', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs.find((m) => m.species === 'wildlife')!;
  // isolate: only this mob exists so it stays nearest
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
  expect(b.hp).toBe(MOB_HP); // untouched this tick
  expect(NODE_RESPAWN_TICKS).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test hunting`
Expected: FAIL (old instant-eat behavior).

- [ ] **Step 3: Rewrite the eat block** in `hunting.ts` — replace the harvest loop with a
nearest-mob bite:
```ts
  const m = state.monster;

  if (m.alive && m.evolution) {
    let target: Mob | undefined;
    let bestDist = CATCH_RANGE;
    for (const mob of state.map.mobs) {
      const d = distance(m.pos, mob.pos);
      if (d <= bestDist) {
        bestDist = d;
        target = mob;
      }
    }
    if (target) {
      target.hp -= MOB_BITE_DAMAGE;
      if (target.hp <= 0) {
        m.evolution.xp += target.species === 'villager' ? VILLAGER_XP : WILDLIFE_XP;
        state.map.mobs = state.map.mobs.filter((mob) => mob !== target);
      }
    }
  }
```
Update the imports in `hunting.ts` to include `CATCH_RANGE, MOB_BITE_DAMAGE` (and keep
`VILLAGER_XP, WILDLIFE_XP, MOB_HP` for respawn, plus the respawn/herd constants already used).

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test hunting`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/hunting.ts packages/shared/src/systems/hunting.test.ts
git commit -m "feat(sim): monster bites mobs down (HP) instead of instant-eat"
```

---

### Task 3: Fix the hunting integration test

**Files:** `packages/shared/src/integration.test.ts`

- [ ] **Step 1: Update the "hunting mobs levels the monster up" test** so it stays on prey long
enough to actually kill (mobs now have HP). Replace its body with:
```ts
test('hunting mobs levels the monster up', () => {
  let s = createInitialState(3);
  for (let i = 0; i < 120 && s.map.mobs.length > 0; i++) {
    const target = s.map.mobs[0];
    s = structuredClone(s);
    s.monster.pos = { ...target.pos }; // sit on a mob and bite it down
    s = step(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  }
  expect(s.monster.evolution!.xp).toBeGreaterThan(0);
  expect(s.monster.evolution!.stage).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run the integration + bots suites**

Run: `pnpm --filter @game/shared test integration`
Run: `pnpm --filter @game/shared test bots`
Expected: PASS (bots.integration still terminates).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/integration.test.ts
git commit -m "test(sim): update hunting integration for mob HP"
```

---

### Task 4: Sweep + deploy

- [ ] **Step 1: Full sweep**

Run: `pnpm -r test`
Expected: PASS (shared + client).

- [ ] **Step 2: Client build** (mobs gained a field; confirm client still compiles)

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client build`
Expected: clean.

- [ ] **Step 3: Merge + deploy**

Merge to `master`, delete branch, `git push origin master`; watch the Pages run to success; confirm
live.

- [ ] **Step 4: Manual playtest (human)**

As the monster: critters no longer outrun you and don't panic from across the map — you can run one
down — but each takes a few bites to finish instead of vanishing on touch.

---

## Self-Review

**Coverage:** easier to catch — `MOB_FLEE_SPEED` 3.5, `SCATTER_RADIUS` 7, `CATCH_RANGE` 2.2 (Task 1) ✓;
harder to kill — `Mob.hp` + bite-down in `huntingSystem` (Tasks 1,2) ✓; respawn/spawn set hp (Task 1) ✓;
integration updated (Task 3) ✓; deploy (Task 4) ✓.

**Placeholder scan:** complete code; no TBD. ✓

**Type consistency:** `Mob.hp` added (Task 1) set in `state.ts` and `hunting.ts` respawn; `MOB_HP`/
`MOB_BITE_DAMAGE`/`CATCH_RANGE` used in `hunting.ts`. Client reads `mob.species`/`mob.state` only —
the new `hp` field doesn't affect it (still compiles). ✓
