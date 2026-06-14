# Sim: Blacksmith & Equippable Weapons (Plan 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** In the sim, heroes start unarmed; a Blacksmith building lets heroes craft swords/bows that appear on a rack and are equipped by walking onto them; equipped weapons set the hero's combat; hero bots arm themselves.

**Architecture:** New pure systems `craftingSystem` + `equipSystem` in `@game/shared`, a shared `maxId` helper, weapon items in `GameState.map.weapons`, and `Entity.equipped`. Combat is unchanged (equipping mutates `hero.combat`). One tiny client touch keeps the renderer compiling (`'blacksmith'` color); the rest of the client is Plan 2.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Types, cost, constants (+ keep client compiling)

**Files:** `packages/shared/src/types.ts`, `packages/shared/src/cost.ts`, `packages/shared/src/constants.ts`, `packages/client/src/render/renderer.ts`, `packages/client/src/config.ts`

- [ ] **Step 1: types.ts**

Add weapon types after `MobSpecies`:
```ts
export type WeaponType = 'sword' | 'bow';

export interface WeaponItem {
  id: EntityId;
  type: WeaponType;
  pos: Vec2;
}
```
Add `'blacksmith'` to `BuildingType`:
```ts
export type BuildingType = 'core' | 'generator' | 'tower' | 'workshop' | 'blacksmith';
```
Add `'craft'` to `ActionType`:
```ts
export type ActionType = 'attack' | 'build' | 'ability' | 'craft';
```
Add `equipped` to `Entity`:
```ts
  equipped?: WeaponType; // heroes; undefined = unarmed
```
Add `craftType` to `Input`:
```ts
  craftType?: WeaponType; // used when action === 'craft'
```
Add `weapons` to `MapState`:
```ts
  weapons: WeaponItem[];
```

- [ ] **Step 2: cost.ts** — extend `BuildableType`:
```ts
export type BuildableType = 'generator' | 'tower' | 'workshop' | 'blacksmith';
```

- [ ] **Step 3: constants.ts** — extend the building records and append weapon constants:
```ts
export const BUILD_COSTS: Record<'generator' | 'tower' | 'workshop' | 'blacksmith', number> = {
  generator: 40,
  tower: 50,
  workshop: 60,
  blacksmith: 60,
};
export const BUILDING_HP: Record<'generator' | 'tower' | 'workshop' | 'blacksmith', number> = {
  generator: 30,
  tower: 40,
  workshop: 30,
  blacksmith: 35,
};
```
Append:
```ts
// --- Weapons / equipment ---
export const UNARMED_RANGE = 1.4;
export const UNARMED_DAMAGE = 2;
export const WEAPON_RANGE: Record<'sword' | 'bow', number> = { sword: 1.8, bow: 9 };
export const WEAPON_DAMAGE: Record<'sword' | 'bow', number> = { sword: 8, bow: 4 };
export const CRAFT_COST: Record<'sword' | 'bow', number> = { sword: 30, bow: 45 };
export const PICKUP_RANGE = 1.2;
export const RACK_OFFSET = { x: 3, y: -2 };
```

- [ ] **Step 4: Keep the client renderer compiling** — `renderer.ts` `BUILDING_COLOR` is
`Record<Building['type'], number>`, which now requires `blacksmith`. Add to `config.ts` `COLORS`:
```ts
  blacksmith: 0x8b949e,
```
and add to `BUILDING_COLOR` in `renderer.ts`:
```ts
  blacksmith: COLORS.blacksmith,
```

- [ ] **Step 5: Type-check both packages**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: errors only where `createInitialState` lacks `weapons` (fixed Task 3) — note and proceed.
Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: clean (renderer color added).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(sim): add weapon types, blacksmith building, weapon constants"
```

---

### Task 2: Shared `maxId` helper

**Files:** Create `packages/shared/src/ids.ts`; modify `systems/building.ts`, `systems/hunting.ts`; test `packages/shared/src/ids.test.ts`

- [ ] **Step 1: Test**

```ts
import { maxId } from './ids';
import { createInitialState } from './state';

test('maxId returns the largest id across all collections', () => {
  const s = createInitialState(1);
  const max = maxId(s);
  const all = [
    s.monster.id,
    ...s.heroes.map((h) => h.id),
    ...s.buildings.map((b) => b.id),
    ...s.map.resourceNodes.map((n) => n.id),
    ...s.map.mobs.map((m) => m.id),
  ];
  expect(max).toBe(Math.max(...all));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test ids`
Expected: FAIL — cannot find module `./ids`.

- [ ] **Step 3: Implement** `ids.ts`

```ts
import type { GameState } from './types';

// The largest entity id currently in use across the whole state.
export function maxId(state: GameState): number {
  let max = state.monster.id;
  for (const h of state.heroes) max = Math.max(max, h.id);
  for (const b of state.buildings) max = Math.max(max, b.id);
  for (const n of state.map.resourceNodes) max = Math.max(max, n.id);
  for (const m of state.map.mobs) max = Math.max(max, m.id);
  for (const w of state.map.weapons) max = Math.max(max, w.id);
  return max;
}
```

- [ ] **Step 4: Refactor `building.ts` and `hunting.ts`** to use it — delete their local `maxId`
functions and add `import { maxId } from '../ids';` to each.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @game/shared test ids`
Expected: PASS.
Run: `pnpm --filter @game/shared test building`
Run: `pnpm --filter @game/shared test hunting`
Expected: PASS (behavior unchanged).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/ids.ts packages/shared/src/ids.test.ts packages/shared/src/systems/building.ts packages/shared/src/systems/hunting.ts
git commit -m "refactor(sim): extract shared maxId helper (covers weapons)"
```

---

### Task 3: Unarmed heroes + weapons array in initial state

**Files:** `packages/shared/src/state.ts`, `packages/shared/src/state.test.ts`

- [ ] **Step 1: Test additions** (`state.test.ts`)

Import `UNARMED_DAMAGE, UNARMED_RANGE` and add:
```ts
test('heroes start unarmed with weak melee combat', () => {
  const s = createInitialState(1);
  expect(s.map.weapons).toEqual([]);
  for (const h of s.heroes) {
    expect(h.equipped).toBeUndefined();
    expect(h.combat!.damage).toBe(UNARMED_DAMAGE);
    expect(h.combat!.range).toBe(UNARMED_RANGE);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test state`
Expected: FAIL (heroes have damage 4 / range 3; no `weapons`).

- [ ] **Step 3: Implement** in `state.ts`

Add `UNARMED_DAMAGE, UNARMED_RANGE` to the constants import. Change the hero combat in the
`heroes` map:
```ts
    combat: { damage: UNARMED_DAMAGE, range: UNARMED_RANGE, cooldown: 12, cooldownRemaining: 0 },
```
Add `weapons: []` to the returned `map`:
```ts
    map: { width: MAP_WIDTH, height: MAP_HEIGHT, resourceNodes, mobs, herds, weapons: [] },
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/state.ts packages/shared/src/state.test.ts
git commit -m "feat(sim): heroes start unarmed; add weapons array"
```

---

### Task 4: craftingSystem

**Files:** Create `packages/shared/src/systems/crafting.ts`; test `packages/shared/src/systems/crafting.test.ts`

- [ ] **Step 1: Test**

```ts
import { craftingSystem } from './crafting';
import { createInitialState } from '../state';
import { CRAFT_COST } from '../constants';
import type { Building, InputMap } from '../types';

function withBlacksmith(s: ReturnType<typeof createInitialState>): Building {
  const bs: Building = { id: 9001, type: 'blacksmith', pos: { x: 50, y: 50 }, health: { hp: 35, maxHp: 35 }, level: 1 };
  s.buildings.push(bs);
  return bs;
}

test('crafting spawns a weapon on the rack and spends materials', () => {
  const s = createInitialState(1);
  withBlacksmith(s);
  const hero = s.heroes[0];
  s.resources.materials = 100;
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'craft', craftType: 'sword' },
  };
  craftingSystem(s, inputs);
  expect(s.map.weapons).toHaveLength(1);
  expect(s.map.weapons[0].type).toBe('sword');
  expect(s.resources.materials).toBe(100 - CRAFT_COST.sword);
});

test('no crafting without a blacksmith', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  s.resources.materials = 100;
  craftingSystem(s, {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'craft', craftType: 'bow' },
  });
  expect(s.map.weapons).toHaveLength(0);
});

test('no crafting without enough materials', () => {
  const s = createInitialState(1);
  withBlacksmith(s);
  const hero = s.heroes[0];
  s.resources.materials = 5;
  craftingSystem(s, {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'craft', craftType: 'bow' },
  });
  expect(s.map.weapons).toHaveLength(0);
  expect(s.resources.materials).toBe(5);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test crafting`
Expected: FAIL — cannot find module `./crafting`.

- [ ] **Step 3: Implement** `crafting.ts`

```ts
import { CRAFT_COST, RACK_OFFSET } from '../constants';
import { maxId } from '../ids';
import type { GameState, InputMap, WeaponItem } from '../types';

// Heroes with a 'craft' action spawn a weapon on the blacksmith's rack (costs materials).
export function craftingSystem(state: GameState, inputs: InputMap): void {
  const blacksmith = state.buildings.find((b) => b.type === 'blacksmith');
  if (!blacksmith) return;

  let nextId = maxId(state) + 1;
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    const input = inputs[hero.id];
    if (!input || input.action !== 'craft' || !input.craftType) continue;
    const type = input.craftType;
    if (state.resources.materials < CRAFT_COST[type]) continue;

    state.resources.materials -= CRAFT_COST[type];
    const n = state.map.weapons.length;
    const item: WeaponItem = {
      id: nextId++,
      type,
      pos: { x: blacksmith.pos.x + RACK_OFFSET.x + (n % 3), y: blacksmith.pos.y + RACK_OFFSET.y },
    };
    state.map.weapons.push(item);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test crafting`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/crafting.ts packages/shared/src/systems/crafting.test.ts
git commit -m "feat(sim): add crafting system (blacksmith makes weapons)"
```

---

### Task 5: equipSystem

**Files:** Create `packages/shared/src/systems/equip.ts`; test `packages/shared/src/systems/equip.test.ts`

- [ ] **Step 1: Test**

```ts
import { equipSystem } from './equip';
import { createInitialState } from '../state';
import { WEAPON_DAMAGE, WEAPON_RANGE } from '../constants';

test('a hero on a weapon equips it; the pickup is consumed', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  s.map.weapons = [{ id: 9001, type: 'bow', pos: { ...hero.pos } }];
  equipSystem(s);
  expect(hero.equipped).toBe('bow');
  expect(hero.combat!.range).toBe(WEAPON_RANGE.bow);
  expect(hero.combat!.damage).toBe(WEAPON_DAMAGE.bow);
  expect(s.map.weapons).toHaveLength(0);
});

test('a weapon out of pickup range is left on the rack', () => {
  const s = createInitialState(1);
  s.heroes.forEach((h) => (h.pos = { x: 0, y: 0 }));
  s.map.weapons = [{ id: 9001, type: 'sword', pos: { x: 80, y: 80 } }];
  equipSystem(s);
  expect(s.map.weapons).toHaveLength(1);
  expect(s.heroes.every((h) => h.equipped === undefined)).toBe(true);
});

test('equipping a sword sets strong melee stats', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  s.map.weapons = [{ id: 9002, type: 'sword', pos: { ...hero.pos } }];
  equipSystem(s);
  expect(hero.equipped).toBe('sword');
  expect(hero.combat!.damage).toBe(WEAPON_DAMAGE.sword);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test equip`
Expected: FAIL — cannot find module `./equip`.

- [ ] **Step 3: Implement** `equip.ts`

```ts
import { PICKUP_RANGE, WEAPON_DAMAGE, WEAPON_RANGE } from '../constants';
import { distance } from '../math';
import type { GameState, WeaponItem } from '../types';

// A hero walking onto a weapon pickup equips it (nearest hero wins); the pickup is consumed.
export function equipSystem(state: GameState): void {
  const remaining: WeaponItem[] = [];
  for (const w of state.map.weapons) {
    let taker: (typeof state.heroes)[number] | undefined;
    let bestDist = PICKUP_RANGE;
    for (const h of state.heroes) {
      if (!h.alive || !h.combat) continue;
      const d = distance(h.pos, w.pos);
      if (d <= bestDist) {
        bestDist = d;
        taker = h;
      }
    }
    if (taker && taker.combat) {
      taker.equipped = w.type;
      taker.combat.range = WEAPON_RANGE[w.type];
      taker.combat.damage = WEAPON_DAMAGE[w.type];
    } else {
      remaining.push(w);
    }
  }
  state.map.weapons = remaining;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test equip`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/equip.ts packages/shared/src/systems/equip.test.ts
git commit -m "feat(sim): add equip system (pick weapons off the rack)"
```

---

### Task 6: Wire step() + exports

**Files:** `packages/shared/src/step.ts`, `packages/shared/src/index.ts`

- [ ] **Step 1: Wire `step.ts`** — add imports and insert after `buildingSystem`:
```ts
import { craftingSystem } from './systems/crafting';
import { equipSystem } from './systems/equip';
```
```ts
  buildingSystem(next, inputs);
  craftingSystem(next, inputs);
  equipSystem(next);
  combatSystem(next, inputs);
```

- [ ] **Step 2: Export** from `index.ts`:
```ts
export { craftingSystem } from './systems/crafting';
export { equipSystem } from './systems/equip';
export { maxId } from './ids';
```

- [ ] **Step 3: Determinism + step tests**

Run: `pnpm --filter @game/shared test step`
Expected: PASS (deterministic; crafting/equip use no RNG).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/step.ts packages/shared/src/index.ts
git commit -m "feat(sim): wire crafting + equip into step()"
```

---

### Task 7: Hero bot arms up + integration fix

**Files:** `packages/shared/src/bots/hero.ts`, `packages/shared/src/bots/hero.test.ts`, `packages/shared/src/integration.test.ts`

- [ ] **Step 1: Update hero-bot tests** (`hero.test.ts`) — add:
```ts
import { CRAFT_COST } from '../constants';
import type { Building } from '../types';

test('an unarmed hero walks to a weapon on the rack', () => {
  const s = createInitialState(123);
  const hero = hero(s, 'defender'); // see existing helper
  const w = { id: 9001, type: 'sword' as const, pos: { x: hero.pos.x + 10, y: hero.pos.y } };
  s.map.weapons = [w];
  const input = heroBot(s, hero);
  expect(input.action).toBeUndefined();
  expect(input.move.x).toBeGreaterThan(0); // toward the weapon
});

test('an unarmed hero crafts when a blacksmith exists and it can afford it', () => {
  const s = createInitialState(123);
  s.buildings.push({ id: 9002, type: 'blacksmith', pos: { x: 50, y: 50 }, health: { hp: 35, maxHp: 35 }, level: 1 });
  s.resources.materials = 100;
  const input = heroBot(s, hero(s, 'scout'));
  expect(input.action).toBe('craft');
  expect(input.craftType).toBe('bow'); // scouts prefer bows
  expect(CRAFT_COST.bow).toBeGreaterThan(0);
});

test('an unarmed hero builds a blacksmith when none exists and it can afford it', () => {
  const s = createInitialState(123);
  s.resources.materials = 100;
  const input = heroBot(s, hero(s, 'defender'));
  expect(input.action).toBe('build');
  expect(input.buildType).toBe('blacksmith');
});
```
(The existing file already has a `hero(state, role)` helper and `monster threatens` / build tests;
keep those. Note: the "builder builds a tower when safe" test now requires the hero to be armed —
update it to set `builder.equipped = 'sword'` before asserting the tower build.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test bots/hero`
Expected: FAIL.

- [ ] **Step 3: Rewrite** `bots/hero.ts`

```ts
import { BUILD_COSTS, CRAFT_COST, HERO_AGGRO_RADIUS, HERO_HOLD_RADIUS } from '../constants';
import { buildCost } from '../cost';
import { distance } from '../math';
import type { BuildingType, Entity, GameState, Input, Vec2, WeaponItem, WeaponType } from '../types';

function toward(from: Vec2, to: Vec2): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

function buildChoice(role: Entity['role']): 'tower' | 'generator' | undefined {
  if (role === 'builder') return 'tower';
  if (role === 'economy') return 'generator';
  return undefined;
}

function nearestWeapon(state: GameState, from: Vec2): WeaponItem | undefined {
  let best: WeaponItem | undefined;
  let bestDist = Infinity;
  for (const w of state.map.weapons) {
    const d = distance(from, w.pos);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

export function heroBot(state: GameState, hero: Entity): Input {
  const id = hero.id;
  const core = state.buildings.find((b) => b.type === 'core');
  const m = state.monster;

  // 1. Swarm a monster threatening the core.
  if (m.alive && core !== undefined && distance(m.pos, core.pos) <= HERO_AGGRO_RADIUS) {
    return { actorId: id, move: toward(hero.pos, m.pos) };
  }

  // 2. Arm up if unarmed.
  if (!hero.equipped) {
    const weapon = nearestWeapon(state, hero.pos);
    if (weapon) return { actorId: id, move: toward(hero.pos, weapon.pos) };

    const blacksmith = state.buildings.find((b) => b.type === 'blacksmith');
    if (blacksmith) {
      const want: WeaponType = hero.role === 'scout' ? 'bow' : 'sword';
      if (state.resources.materials >= CRAFT_COST[want]) {
        return { actorId: id, move: { x: 0, y: 0 }, action: 'craft', craftType: want };
      }
    } else if (state.resources.materials >= buildCost(hero.role, 'blacksmith')) {
      const buildType: BuildingType = 'blacksmith';
      return { actorId: id, move: { x: 0, y: 0 }, action: 'build', buildType };
    }
  }

  // 3. Armed (or can't arm yet): build economy/defense, else regroup near the core.
  const choice = buildChoice(hero.role);
  if (choice && state.resources.materials >= BUILD_COSTS[choice]) {
    const buildType: BuildingType = choice;
    return { actorId: id, move: { x: 0, y: 0 }, action: 'build', buildType };
  }
  if (core && distance(hero.pos, core.pos) > HERO_HOLD_RADIUS) {
    return { actorId: id, move: toward(hero.pos, core.pos) };
  }
  return { actorId: id, move: { x: 0, y: 0 } };
}
```

- [ ] **Step 4: Fix the "builders win" integration test** (`integration.test.ts`) — unarmed heroes
can't realistically kill the monster, so arm them. In that test, after placing the heroes on the
monster, equip them with swords:
```ts
  for (const h of s.heroes) {
    h.pos = { ...s.monster.pos };
    h.equipped = 'sword';
    h.combat!.damage = 8;
    h.combat!.range = 1.8;
  }
```

- [ ] **Step 5: Run the bot + integration tests**

Run: `pnpm --filter @game/shared test bots`
Run: `pnpm --filter @game/shared test integration`
Expected: PASS — including `bots.integration` (the autonomous match still terminates; bots arm up).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/bots/hero.ts packages/shared/src/bots/hero.test.ts packages/shared/src/integration.test.ts
git commit -m "feat(sim): hero bots build a blacksmith, craft, and equip weapons"
```

---

### Task 8: Full sweep (both packages green)

- [ ] **Step 1: Shared sweep**

Run: `pnpm --filter @game/shared test`
Expected: PASS (all suites).

- [ ] **Step 2: Client still green** (additive shared changes + the one renderer color)

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client test`
Expected: PASS.

- [ ] **Step 3: Commit (if any incidental fixes)** — otherwise nothing to do.

---

## Self-Review

**Spec coverage:** unarmed heroes (Task 3) ✓; blacksmith building type + cost (Tasks 1) ✓;
crafting → rack (Task 4) ✓; equip-on-contact sets combat (Task 5) ✓; weapon-based combat
(combat unchanged; equip mutates `hero.combat`) ✓; bot arming (Task 7) ✓; step wiring + determinism
(Task 6) ✓; client kept compiling (Task 1 Step 4) ✓. Client craft menu / weapon rendering / equipped
indicator = Plan 2.

**Placeholder scan:** complete code in every step; no TBD. ✓

**Type consistency:** `WeaponType`/`WeaponItem`/`equipped`/`craftType` (Task 1) used by crafting
(4), equip (5), bot (7). `BuildableType`+`'blacksmith'` (cost.ts) matches `BUILD_COSTS`/`BUILDING_HP`
literal records (constants). `maxId` (Task 2) reused by building/hunting/crafting. `CRAFT_COST`/
`WEAPON_RANGE`/`WEAPON_DAMAGE`/`PICKUP_RANGE`/`RACK_OFFSET` defined once (Task 1). `craftingSystem`/
`equipSystem` signatures match the `step()` calls (Task 6). ✓
