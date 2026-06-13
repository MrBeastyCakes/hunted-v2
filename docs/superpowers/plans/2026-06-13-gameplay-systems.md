# Gameplay Systems Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the headless sim core into a complete, race-to-win match: feeding → evolution, resource generation → building, combat → death, and win conditions — all driveable by scripted inputs in tests.

**Architecture:** Add pure system functions under `packages/shared/src/systems/`, each mutating `GameState` in place, wired into `step()` in a fixed order. Extend `Evolution`, `Input`, and `Building` types with the few fields these systems need. Balance numbers live in `constants.ts`. No rendering, no networking — same deterministic 20 Hz core as Plan 1.

**Tech Stack:** TypeScript, pnpm, Vitest (unchanged from Plan 1).

**Builds on Plan 1:** `step.ts` already contains commented `// (Plan 2)` insertion points; Task 9 replaces them. Existing tests (math/rng/state/movement/step, 20 tests) must stay green throughout.

---

## Scope notes (deliberate deferrals to a later balance/depth pass)

- **Resource economy** is passive: Generators produce materials per tick (+ an Economy-role bonus), starting from a `STARTING_MATERIALS` stockpile. Harvesting map `resourceNodes` directly is deferred (the nodes stay in state for later). This is enough to prove the build→out-power loop.
- **Role differentiation** in this plan: Economy (income bonus) and Builder (build discount) have mechanical identity; Defender/Scout differentiation is deferred.
- **Building** is instant on the `build` action (no construction timer yet).
- **Hero respawn** after a pick-off is deferred (dead heroes simply stop acting), per spec §9.
- `food` resource is carried in state but unused this plan.

These match spec §9 ("balance tuned in playtesting") and the slice's out-of-scope list.

---

## File Structure

```
packages/shared/src/
├─ math.ts                       # MODIFY: add distance()
├─ types.ts                      # MODIFY: Evolution.cityDamageDealt, Input.buildType, Building.combat
├─ constants.ts                  # MODIFY: append gameplay balance constants
├─ state.ts                      # MODIFY: cityDamageDealt:0, STARTING_MATERIALS
├─ step.ts                       # MODIFY: wire the new systems in order
├─ index.ts                      # MODIFY: export new systems
├─ integration.test.ts           # CREATE: full-match win-path tests
└─ systems/
   ├─ feeding.ts                 # CREATE
   ├─ economy.ts                 # CREATE
   ├─ building.ts                # CREATE
   ├─ combat.ts                  # CREATE
   ├─ evolution.ts               # CREATE
   └─ winCondition.ts            # CREATE
```

Execution order in `step()` (Task 9): `movement → feeding → economy → building → combat → evolution → winCondition`. Order matters: feeding/combat add XP *before* evolution checks it; winCondition runs last on the resolved state.

---

### Task 1: Add `distance` helper

**Files:**
- Modify: `packages/shared/src/math.ts`
- Test: `packages/shared/src/math.test.ts`

- [ ] **Step 1: Add the failing test** (append to existing `math.test.ts`)

```ts
import { distance } from './math';

test('distance is the magnitude of the difference', () => {
  expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
});
```

Update the existing first import line in `math.test.ts` to include `distance`:
```ts
import { clamp, distance, length, normalize } from './math';
```
(Remove the separate `import { distance }` line if you prefer a single import — either compiles.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test math`
Expected: FAIL — `distance` is not exported.

- [ ] **Step 3: Implement** (append to `math.ts`)

```ts
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test math`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/math.ts packages/shared/src/math.test.ts
git commit -m "feat(sim): add distance helper"
```

---

### Task 2: Extend types, constants, and initial state

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/state.ts`

- [ ] **Step 1: Extend the `Evolution`, `Input`, and `Building` interfaces in `types.ts`**

Replace the `Evolution` interface with:
```ts
export interface Evolution {
  xp: number;
  stage: number; // 1..3 in the slice
  cityDamageDealt: number; // gates the jump to stage 3 (hybrid feeding)
}
```

Replace the `Building` interface with:
```ts
export interface Building {
  id: EntityId;
  type: BuildingType;
  pos: Vec2;
  health: Health;
  level: number;
  combat?: Combat; // towers have one
}
```

Replace the `Input` interface with:
```ts
export interface Input {
  actorId: EntityId;
  move: Vec2; // desired direction; not required to be normalized
  action?: ActionType;
  target?: EntityId | Vec2;
  buildType?: BuildingType; // used when action === 'build'
}
```

- [ ] **Step 2: Append gameplay constants to `constants.ts`**

```ts
import type { BuildingType, Combat } from './types';

// --- Feeding ---
export const FEED_RANGE = 4; // world units
export const FEED_RATE = 5; // node amount drained per tick
export const XP_PER_AMOUNT = 1; // monster XP per amount drained

// --- Evolution ---
export const STAGE2_XP = 100;
export const STAGE3_XP = 250;
export const STAGE3_CITY_DAMAGE_REQ = 50; // must have damaged the city this much to reach stage 3
export const STAGE_HP_BONUS = 40; // +maxHp (and heal) per stage gained
export const STAGE_DAMAGE_BONUS = 4; // +combat.damage per stage gained

// --- Combat ---
export const CITY_DAMAGE_XP = 2; // monster XP per point of building damage dealt

// --- Economy ---
export const STARTING_MATERIALS = 60;
export const GENERATOR_RATE = 1; // materials/tick per generator
export const ECONOMY_ROLE_BONUS = 2; // extra materials/tick if an economy hero is alive

// --- Building ---
export const BUILD_COSTS: Record<'generator' | 'tower' | 'workshop', number> = {
  generator: 40,
  tower: 50,
  workshop: 60,
};
export const BUILDING_HP: Record<'generator' | 'tower' | 'workshop', number> = {
  generator: 30,
  tower: 40,
  workshop: 30,
};
export const BUILDER_DISCOUNT = 0.5; // builder role pays this fraction of the cost
export const WORKSHOP_HERO_DAMAGE_BONUS = 3; // added to every hero's attack while a workshop stands
export const TOWER_COMBAT: Combat = {
  damage: 6,
  range: 12,
  cooldown: 15,
  cooldownRemaining: 0,
};
```

- [ ] **Step 3: Update `createInitialState` in `state.ts`**

In the `monster` object, change the `evolution` line to:
```ts
    evolution: { xp: 0, stage: 1, cityDamageDealt: 0 },
```

Add the `STARTING_MATERIALS` import to the existing import block from `./constants`:
```ts
import {
  CORE_START_HP,
  HERO_SPEED,
  HERO_START_HP,
  MAP_HEIGHT,
  MAP_WIDTH,
  MONSTER_SPEED,
  MONSTER_START_HP,
  STARTING_MATERIALS,
} from './constants';
```

Change the returned `resources` line to:
```ts
    resources: { materials: STARTING_MATERIALS, food: 0 },
```

- [ ] **Step 4: Type-check and run the existing suite (nothing should break)**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.
Run: `pnpm -r test`
Expected: PASS — all 21 tests (20 prior + the new distance test).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/state.ts
git commit -m "feat(sim): extend types/constants/state for gameplay systems"
```

---

### Task 3: Feeding system

**Files:**
- Create: `packages/shared/src/systems/feeding.ts`
- Test: `packages/shared/src/systems/feeding.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { feedingSystem } from './feeding';
import { createInitialState } from '../state';
import { FEED_RATE, XP_PER_AMOUNT } from '../constants';
import type { InputMap } from '../types';

function feedInput(state: ReturnType<typeof createInitialState>): InputMap {
  return { [state.monster.id]: { actorId: state.monster.id, move: { x: 0, y: 0 }, action: 'feed' } };
}

test('feeding drains the nearest wildlife node in range and grants XP', () => {
  const s = createInitialState(123);
  const node = s.map.wildlifeNodes[0];
  s.monster.pos = { ...node.pos }; // stand on it
  const startAmount = node.amount;
  feedingSystem(s, feedInput(s));
  expect(node.amount).toBe(startAmount - FEED_RATE);
  expect(s.monster.evolution!.xp).toBe(FEED_RATE * XP_PER_AMOUNT);
});

test('no feeding when out of range', () => {
  const s = createInitialState(123);
  s.monster.pos = { x: 0, y: 0 };
  const before = s.map.wildlifeNodes.map((n) => n.amount);
  feedingSystem(s, feedInput(s));
  expect(s.map.wildlifeNodes.map((n) => n.amount)).toEqual(before);
  expect(s.monster.evolution!.xp).toBe(0);
});

test('no feeding without the feed action', () => {
  const s = createInitialState(123);
  s.monster.pos = { ...s.map.wildlifeNodes[0].pos };
  feedingSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  expect(s.monster.evolution!.xp).toBe(0);
});

test('draining never goes below zero', () => {
  const s = createInitialState(123);
  const node = s.map.wildlifeNodes[0];
  node.amount = 2;
  s.monster.pos = { ...node.pos };
  feedingSystem(s, feedInput(s));
  expect(node.amount).toBe(0);
  expect(s.monster.evolution!.xp).toBe(2 * XP_PER_AMOUNT);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test feeding`
Expected: FAIL — cannot find module `./feeding`.

- [ ] **Step 3: Implement**

```ts
import { FEED_RANGE, FEED_RATE, XP_PER_AMOUNT } from '../constants';
import { distance } from '../math';
import type { GameState, InputMap, ResourceNode } from '../types';

// Monster feeds on the nearest wildlife node in range when the 'feed' action is given.
export function feedingSystem(state: GameState, inputs: InputMap): void {
  const m = state.monster;
  if (!m.alive || !m.evolution) return;
  const input = inputs[m.id];
  if (!input || input.action !== 'feed') return;

  let best: ResourceNode | undefined;
  let bestDist = Infinity;
  for (const node of state.map.wildlifeNodes) {
    if (node.amount <= 0) continue;
    const d = distance(m.pos, node.pos);
    if (d <= FEED_RANGE && d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  if (!best) return;

  const drained = Math.min(FEED_RATE, best.amount);
  best.amount -= drained;
  m.evolution.xp += drained * XP_PER_AMOUNT;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test feeding`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/feeding.ts packages/shared/src/systems/feeding.test.ts
git commit -m "feat(sim): add feeding system"
```

---

### Task 4: Economy system

**Files:**
- Create: `packages/shared/src/systems/economy.ts`
- Test: `packages/shared/src/systems/economy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { economySystem } from './economy';
import { createInitialState } from '../state';
import { ECONOMY_ROLE_BONUS, GENERATOR_RATE } from '../constants';
import type { Building } from '../types';

function generator(id: number): Building {
  return { id, type: 'generator', pos: { x: 0, y: 0 }, health: { hp: 30, maxHp: 30 }, level: 1 };
}

test('each generator produces materials per tick', () => {
  const s = createInitialState(123);
  // remove the economy hero so we isolate generator income
  s.heroes = s.heroes.filter((h) => h.role !== 'economy');
  s.resources.materials = 0;
  s.buildings.push(generator(1001), generator(1002));
  economySystem(s);
  expect(s.resources.materials).toBe(2 * GENERATOR_RATE);
});

test('a living economy hero adds a flat income bonus', () => {
  const s = createInitialState(123);
  s.resources.materials = 0;
  economySystem(s);
  expect(s.resources.materials).toBe(ECONOMY_ROLE_BONUS);
});

test('a dead economy hero gives no bonus', () => {
  const s = createInitialState(123);
  s.resources.materials = 0;
  const eco = s.heroes.find((h) => h.role === 'economy')!;
  eco.alive = false;
  economySystem(s);
  expect(s.resources.materials).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test economy`
Expected: FAIL — cannot find module `./economy`.

- [ ] **Step 3: Implement**

```ts
import { ECONOMY_ROLE_BONUS, GENERATOR_RATE } from '../constants';
import type { GameState } from '../types';

// Passive material income: generators + an alive economy hero bonus.
export function economySystem(state: GameState): void {
  const generators = state.buildings.filter((b) => b.type === 'generator').length;
  let income = generators * GENERATOR_RATE;
  if (state.heroes.some((h) => h.role === 'economy' && h.alive)) {
    income += ECONOMY_ROLE_BONUS;
  }
  state.resources.materials += income;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test economy`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/economy.ts packages/shared/src/systems/economy.test.ts
git commit -m "feat(sim): add economy system"
```

---

### Task 5: Building system

**Files:**
- Create: `packages/shared/src/systems/building.ts`
- Test: `packages/shared/src/systems/building.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildingSystem } from './building';
import { createInitialState } from '../state';
import { BUILD_COSTS, BUILDER_DISCOUNT, TOWER_COMBAT } from '../constants';
import type { InputMap } from '../types';

test('a hero builds a tower at its position, spending materials', () => {
  const s = createInitialState(123);
  const hero = s.heroes.find((h) => h.role === 'defender')!;
  s.resources.materials = 100;
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'tower' },
  };
  buildingSystem(s, inputs);
  const tower = s.buildings.find((b) => b.type === 'tower');
  expect(tower).toBeDefined();
  expect(tower!.pos).toEqual(hero.pos);
  expect(tower!.combat).toEqual(TOWER_COMBAT);
  expect(s.resources.materials).toBe(100 - BUILD_COSTS.tower);
});

test('builder role gets a discount', () => {
  const s = createInitialState(123);
  const builder = s.heroes.find((h) => h.role === 'builder')!;
  s.resources.materials = 100;
  const inputs: InputMap = {
    [builder.id]: { actorId: builder.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'generator' },
  };
  buildingSystem(s, inputs);
  expect(s.resources.materials).toBe(100 - Math.floor(BUILD_COSTS.generator * BUILDER_DISCOUNT));
});

test('cannot build without enough materials', () => {
  const s = createInitialState(123);
  const hero = s.heroes.find((h) => h.role === 'defender')!;
  s.resources.materials = 5;
  const before = s.buildings.length;
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'tower' },
  };
  buildingSystem(s, inputs);
  expect(s.buildings.length).toBe(before);
  expect(s.resources.materials).toBe(5);
});

test('new building ids are unique', () => {
  const s = createInitialState(123);
  const builder = s.heroes.find((h) => h.role === 'builder')!;
  const economy = s.heroes.find((h) => h.role === 'economy')!;
  s.resources.materials = 1000;
  const inputs: InputMap = {
    [builder.id]: { actorId: builder.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'generator' },
    [economy.id]: { actorId: economy.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'tower' },
  };
  buildingSystem(s, inputs);
  const ids = s.buildings.map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('cannot build a core', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  s.resources.materials = 1000;
  const before = s.buildings.length;
  const inputs: InputMap = {
    // @ts-expect-error 'core' is not a buildable type at runtime; system must ignore it
    [hero.id]: { actorId: hero.id, move: { x: 0, y: 0 }, action: 'build', buildType: 'core' },
  };
  buildingSystem(s, inputs);
  expect(s.buildings.length).toBe(before);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test building`
Expected: FAIL — cannot find module `./building`.

- [ ] **Step 3: Implement**

```ts
import { BUILD_COSTS, BUILDER_DISCOUNT, BUILDING_HP, TOWER_COMBAT } from '../constants';
import type { Building, BuildingType, GameState, InputMap, Vec2 } from '../types';

type BuildableType = 'generator' | 'tower' | 'workshop';

function isBuildable(type: BuildingType): type is BuildableType {
  return type === 'generator' || type === 'tower' || type === 'workshop';
}

function isVec2(t: unknown): t is Vec2 {
  return typeof t === 'object' && t !== null && 'x' in t && 'y' in t;
}

function maxId(state: GameState): number {
  let max = state.monster.id;
  for (const h of state.heroes) max = Math.max(max, h.id);
  for (const b of state.buildings) max = Math.max(max, b.id);
  for (const n of state.map.wildlifeNodes) max = Math.max(max, n.id);
  for (const n of state.map.resourceNodes) max = Math.max(max, n.id);
  return max;
}

// Heroes with the 'build' action spend shared materials to place structures.
export function buildingSystem(state: GameState, inputs: InputMap): void {
  let nextId = maxId(state) + 1;
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    const input = inputs[hero.id];
    if (!input || input.action !== 'build' || !input.buildType) continue;
    if (!isBuildable(input.buildType)) continue;

    const type = input.buildType;
    const base = BUILD_COSTS[type];
    const cost = hero.role === 'builder' ? Math.floor(base * BUILDER_DISCOUNT) : base;
    if (state.resources.materials < cost) continue;

    state.resources.materials -= cost;
    const pos = isVec2(input.target) ? { x: input.target.x, y: input.target.y } : { ...hero.pos };
    const building: Building = {
      id: nextId++,
      type,
      pos,
      health: { hp: BUILDING_HP[type], maxHp: BUILDING_HP[type] },
      level: 1,
    };
    if (type === 'tower') building.combat = { ...TOWER_COMBAT };
    state.buildings.push(building);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test building`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/building.ts packages/shared/src/systems/building.test.ts
git commit -m "feat(sim): add building system"
```

---

### Task 6: Combat system

**Files:**
- Create: `packages/shared/src/systems/combat.ts`
- Test: `packages/shared/src/systems/combat.test.ts`

Combat is automatic: any attacker with a valid enemy in range and an expired cooldown attacks. The monster auto-attacks the nearest hero or building unless its input action is `feed`. Heroes and towers auto-attack the monster.

- [ ] **Step 1: Write the failing test**

```ts
import { combatSystem } from './combat';
import { createInitialState } from '../state';
import { CITY_DAMAGE_XP, WORKSHOP_HERO_DAMAGE_BONUS, TOWER_COMBAT } from '../constants';
import type { Building, InputMap } from '../types';

test('a hero in range damages the monster and goes on cooldown', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  s.monster.pos = { ...hero.pos }; // in range
  const startHp = s.monster.health.hp;
  combatSystem(s, {});
  expect(s.monster.health.hp).toBe(startHp - hero.combat!.damage);
  expect(hero.combat!.cooldownRemaining).toBe(hero.combat!.cooldown);
});

test('cooldown blocks a second attack on the next tick', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  s.monster.pos = { ...hero.pos };
  combatSystem(s, {});
  const hpAfterFirst = s.monster.health.hp;
  combatSystem(s, {}); // cooldown ticks 12 -> 11, still > 0, no attack
  expect(s.monster.health.hp).toBe(hpAfterFirst);
});

test('monster attacks the city core and gains city-damage XP', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos };
  // push heroes far away so the core is the nearest target
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  const startCoreHp = core.health.hp;
  const dmg = s.monster.combat!.damage;
  combatSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  expect(core.health.hp).toBe(startCoreHp - dmg);
  expect(s.monster.evolution!.cityDamageDealt).toBe(dmg);
  expect(s.monster.evolution!.xp).toBe(dmg * CITY_DAMAGE_XP);
});

test('monster does not attack while feeding', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  const startCoreHp = core.health.hp;
  combatSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 }, action: 'feed' } });
  expect(core.health.hp).toBe(startCoreHp);
});

test('a tower auto-attacks the monster in range', () => {
  const s = createInitialState(123);
  const tower: Building = {
    id: 9001,
    type: 'tower',
    pos: { x: 50, y: 50 },
    health: { hp: 40, maxHp: 40 },
    level: 1,
    combat: { ...TOWER_COMBAT },
  };
  s.buildings.push(tower);
  s.monster.pos = { x: 50, y: 50 };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 }; // isolate tower damage
  const startHp = s.monster.health.hp;
  combatSystem(s, {});
  expect(s.monster.health.hp).toBe(startHp - TOWER_COMBAT.damage);
});

test('a workshop boosts hero attack damage', () => {
  const s = createInitialState(123);
  s.buildings.push({
    id: 9002, type: 'workshop', pos: { x: 0, y: 0 }, health: { hp: 30, maxHp: 30 }, level: 1,
  });
  const hero = s.heroes[0];
  s.monster.pos = { ...hero.pos };
  // isolate this hero: move the others away
  for (const h of s.heroes) if (h !== hero) h.pos = { x: 0, y: 0 };
  s.monster.pos = { ...hero.pos };
  const startHp = s.monster.health.hp;
  combatSystem(s, {});
  expect(s.monster.health.hp).toBe(startHp - (hero.combat!.damage + WORKSHOP_HERO_DAMAGE_BONUS));
});

test('lethal damage marks the monster dead', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  s.monster.health.hp = 1;
  s.monster.pos = { ...hero.pos };
  combatSystem(s, {});
  expect(s.monster.health.hp).toBe(0);
  expect(s.monster.alive).toBe(false);
});

test('destroyed non-core buildings are removed; core is kept', () => {
  const s = createInitialState(123);
  const tower: Building = {
    id: 9003, type: 'tower', pos: { x: 50, y: 50 }, health: { hp: 0, maxHp: 40 }, level: 1,
  };
  s.buildings.push(tower);
  const core = s.buildings.find((b) => b.type === 'core')!;
  core.health.hp = 0;
  combatSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  expect(s.buildings.find((b) => b.id === 9003)).toBeUndefined();
  expect(s.buildings.find((b) => b.type === 'core')).toBeDefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test combat`
Expected: FAIL — cannot find module `./combat`.

- [ ] **Step 3: Implement**

```ts
import { CITY_DAMAGE_XP, WORKSHOP_HERO_DAMAGE_BONUS } from '../constants';
import { distance } from '../math';
import type { Combat, GameState, Health, InputMap, Vec2 } from '../types';

function tickCooldown(c: Combat): void {
  if (c.cooldownRemaining > 0) c.cooldownRemaining -= 1;
}

interface MonsterTarget {
  health: Health;
  pos: Vec2;
  isBuilding: boolean;
}

function nearestMonsterTarget(state: GameState): MonsterTarget | undefined {
  const m = state.monster;
  if (!m.combat) return undefined;
  const range = m.combat.range;
  let best: MonsterTarget | undefined;
  let bestDist = Infinity;
  for (const h of state.heroes) {
    if (!h.alive) continue;
    const d = distance(m.pos, h.pos);
    if (d <= range && d < bestDist) {
      bestDist = d;
      best = { health: h.health, pos: h.pos, isBuilding: false };
    }
  }
  for (const b of state.buildings) {
    const d = distance(m.pos, b.pos);
    if (d <= range && d < bestDist) {
      bestDist = d;
      best = { health: b.health, pos: b.pos, isBuilding: true };
    }
  }
  return best;
}

// Resolves all attacks for one tick: monster vs heroes/buildings, heroes/towers vs monster.
export function combatSystem(state: GameState, inputs: InputMap): void {
  const m = state.monster;

  // 1. Tick down every cooldown.
  if (m.combat) tickCooldown(m.combat);
  for (const h of state.heroes) if (h.combat) tickCooldown(h.combat);
  for (const b of state.buildings) if (b.combat) tickCooldown(b.combat);

  const heroBonus = state.buildings.some((b) => b.type === 'workshop')
    ? WORKSHOP_HERO_DAMAGE_BONUS
    : 0;

  // 2. Monster attacks nearest enemy (unless feeding this tick).
  const mInput = inputs[m.id];
  if (m.alive && m.combat && m.evolution && mInput?.action !== 'feed') {
    if (m.combat.cooldownRemaining <= 0) {
      const target = nearestMonsterTarget(state);
      if (target) {
        target.health.hp -= m.combat.damage;
        m.combat.cooldownRemaining = m.combat.cooldown;
        if (target.isBuilding) {
          m.evolution.cityDamageDealt += m.combat.damage;
          m.evolution.xp += m.combat.damage * CITY_DAMAGE_XP;
        }
      }
    }
  }

  // 3. Heroes and towers attack the monster.
  if (m.alive) {
    for (const h of state.heroes) {
      if (!h.alive || !h.combat) continue;
      if (h.combat.cooldownRemaining > 0) continue;
      if (distance(h.pos, m.pos) <= h.combat.range) {
        m.health.hp -= h.combat.damage + heroBonus;
        h.combat.cooldownRemaining = h.combat.cooldown;
      }
    }
    for (const b of state.buildings) {
      if (b.type !== 'tower' || !b.combat) continue;
      if (b.combat.cooldownRemaining > 0) continue;
      if (distance(b.pos, m.pos) <= b.combat.range) {
        m.health.hp -= b.combat.damage;
        b.combat.cooldownRemaining = b.combat.cooldown;
      }
    }
  }

  // 4. Resolve deaths.
  if (m.health.hp <= 0) {
    m.health.hp = 0;
    m.alive = false;
  }
  for (const h of state.heroes) {
    if (h.health.hp <= 0) {
      h.health.hp = 0;
      h.alive = false;
    }
  }
  state.buildings = state.buildings.filter((b) => b.type === 'core' || b.health.hp > 0);
  const core = state.buildings.find((b) => b.type === 'core');
  if (core && core.health.hp < 0) core.health.hp = 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test combat`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/combat.ts packages/shared/src/systems/combat.test.ts
git commit -m "feat(sim): add combat system"
```

---

### Task 7: Evolution system

**Files:**
- Create: `packages/shared/src/systems/evolution.ts`
- Test: `packages/shared/src/systems/evolution.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { evolutionSystem } from './evolution';
import { createInitialState } from '../state';
import {
  STAGE2_XP,
  STAGE3_XP,
  STAGE3_CITY_DAMAGE_REQ,
  STAGE_DAMAGE_BONUS,
  STAGE_HP_BONUS,
} from '../constants';

test('reaches stage 2 at the XP threshold and gains HP + damage', () => {
  const s = createInitialState(123);
  const m = s.monster;
  const baseMaxHp = m.health.maxHp;
  const baseDmg = m.combat!.damage;
  m.evolution!.xp = STAGE2_XP;
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(2);
  expect(m.health.maxHp).toBe(baseMaxHp + STAGE_HP_BONUS);
  expect(m.combat!.damage).toBe(baseDmg + STAGE_DAMAGE_BONUS);
});

test('stage 3 is gated behind city damage even with enough XP', () => {
  const s = createInitialState(123);
  const m = s.monster;
  m.evolution!.xp = STAGE3_XP;
  m.evolution!.cityDamageDealt = 0;
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(2); // capped at 2 until the city has been hit enough
});

test('stage 3 unlocks once the city-damage requirement is met', () => {
  const s = createInitialState(123);
  const m = s.monster;
  m.evolution!.xp = STAGE3_XP;
  m.evolution!.cityDamageDealt = STAGE3_CITY_DAMAGE_REQ;
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(3);
});

test('evolution only moves upward and is idempotent', () => {
  const s = createInitialState(123);
  const m = s.monster;
  m.evolution!.xp = STAGE2_XP;
  evolutionSystem(s);
  const maxHpAfterFirst = m.health.maxHp;
  evolutionSystem(s); // no further XP gained
  expect(m.evolution!.stage).toBe(2);
  expect(m.health.maxHp).toBe(maxHpAfterFirst);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test evolution`
Expected: FAIL — cannot find module `./evolution`.

- [ ] **Step 3: Implement**

```ts
import {
  STAGE2_XP,
  STAGE3_XP,
  STAGE3_CITY_DAMAGE_REQ,
  STAGE_DAMAGE_BONUS,
  STAGE_HP_BONUS,
} from '../constants';
import type { GameState } from '../types';

// Raises the monster's stage when XP (and, for stage 3, city damage) thresholds are met.
// One-way: stage never decreases. Each gained stage heals and strengthens the monster.
export function evolutionSystem(state: GameState): void {
  const m = state.monster;
  if (!m.alive || !m.evolution || !m.combat) return;
  const evo = m.evolution;

  let target = 1;
  if (evo.xp >= STAGE2_XP) target = 2;
  if (evo.xp >= STAGE3_XP && evo.cityDamageDealt >= STAGE3_CITY_DAMAGE_REQ) target = 3;

  while (evo.stage < target) {
    evo.stage += 1;
    m.health.maxHp += STAGE_HP_BONUS;
    m.health.hp += STAGE_HP_BONUS;
    m.combat.damage += STAGE_DAMAGE_BONUS;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test evolution`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/evolution.ts packages/shared/src/systems/evolution.test.ts
git commit -m "feat(sim): add evolution system with city-damage gate"
```

---

### Task 8: Win condition system

**Files:**
- Create: `packages/shared/src/systems/winCondition.ts`
- Test: `packages/shared/src/systems/winCondition.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { winConditionSystem } from './winCondition';
import { createInitialState } from '../state';

test('monster wins when the core is destroyed', () => {
  const s = createInitialState(123);
  s.buildings.find((b) => b.type === 'core')!.health.hp = 0;
  winConditionSystem(s);
  expect(s.phase).toBe('monsterWon');
});

test('monster wins when the core is gone entirely', () => {
  const s = createInitialState(123);
  s.buildings = s.buildings.filter((b) => b.type !== 'core');
  winConditionSystem(s);
  expect(s.phase).toBe('monsterWon');
});

test('builders win when the monster is dead', () => {
  const s = createInitialState(123);
  s.monster.alive = false;
  winConditionSystem(s);
  expect(s.phase).toBe('buildersWon');
});

test('play continues while both sides are alive', () => {
  const s = createInitialState(123);
  winConditionSystem(s);
  expect(s.phase).toBe('playing');
});

test('monster win takes priority if both fall on the same tick', () => {
  const s = createInitialState(123);
  s.buildings.find((b) => b.type === 'core')!.health.hp = 0;
  s.monster.alive = false;
  winConditionSystem(s);
  expect(s.phase).toBe('monsterWon');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test winCondition`
Expected: FAIL — cannot find module `./winCondition`.

- [ ] **Step 3: Implement**

```ts
import type { GameState } from '../types';

// Decides the match outcome. Monster win (core down) takes priority over builders win.
export function winConditionSystem(state: GameState): void {
  const core = state.buildings.find((b) => b.type === 'core');
  if (!core || core.health.hp <= 0) {
    state.phase = 'monsterWon';
    return;
  }
  if (!state.monster.alive) {
    state.phase = 'buildersWon';
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test winCondition`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/winCondition.ts packages/shared/src/systems/winCondition.test.ts
git commit -m "feat(sim): add win condition system"
```

---

### Task 9: Wire systems into step(), export, and integration-test full matches

**Files:**
- Modify: `packages/shared/src/step.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/integration.test.ts`

- [ ] **Step 1: Wire the systems into `step.ts`**

Replace the body of `step.ts` with:
```ts
import { combatSystem } from './systems/combat';
import { economySystem } from './systems/economy';
import { evolutionSystem } from './systems/evolution';
import { buildingSystem } from './systems/building';
import { feedingSystem } from './systems/feeding';
import { movementSystem } from './systems/movement';
import { winConditionSystem } from './systems/winCondition';
import type { GameState, InputMap } from './types';

// Pure fixed-timestep advance: clone, run systems in order on the clone, return it.
// Order matters: feeding/combat add XP before evolution reads it; winCondition runs last.
export function step(state: GameState, inputs: InputMap): GameState {
  const next: GameState = structuredClone(state);
  if (next.phase !== 'playing') return next;

  movementSystem(next, inputs);
  feedingSystem(next, inputs);
  economySystem(next);
  buildingSystem(next, inputs);
  combatSystem(next, inputs);
  evolutionSystem(next);
  winConditionSystem(next);

  next.tick += 1;
  return next;
}
```

- [ ] **Step 2: Export the new systems from `index.ts`**

Replace the systems export line in `index.ts` with:
```ts
export { movementSystem } from './systems/movement';
export { feedingSystem } from './systems/feeding';
export { economySystem } from './systems/economy';
export { buildingSystem } from './systems/building';
export { combatSystem } from './systems/combat';
export { evolutionSystem } from './systems/evolution';
export { winConditionSystem } from './systems/winCondition';
```

- [ ] **Step 3: Write the integration tests**

`packages/shared/src/integration.test.ts`:
```ts
import { step } from './step';
import { createInitialState } from './state';
import type { GameState, InputMap } from './types';

// Advance the sim N ticks (or until it ends) with a per-tick input builder.
function run(s0: GameState, ticks: number, build: (s: GameState) => InputMap): GameState {
  let s = s0;
  for (let i = 0; i < ticks && s.phase === 'playing'; i++) {
    s = step(s, build(s));
  }
  return s;
}

test('builders win: heroes stand on the monster and grind it down', () => {
  let s = createInitialState(1);
  // Put all four heroes on top of the monster so every hero attacks it.
  s = structuredClone(s);
  for (const h of s.heroes) h.pos = { ...s.monster.pos };
  const finished = run(s, 2000, (state) => {
    const inputs: InputMap = {};
    for (const h of state.heroes) {
      inputs[h.id] = { actorId: h.id, move: { x: 0, y: 0 } }; // stay put; combat is automatic
    }
    return inputs;
  });
  expect(finished.phase).toBe('buildersWon');
  expect(finished.monster.alive).toBe(false);
});

test('monster wins: it sits on the core and razes it while heroes are away', () => {
  let s = createInitialState(2);
  s = structuredClone(s);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 }; // heroes nowhere near the fight
  const finished = run(s, 2000, (state) => ({
    [state.monster.id]: { actorId: state.monster.id, move: { x: 0, y: 0 } }, // auto-attacks the core
  }));
  expect(finished.phase).toBe('monsterWon');
  expect(finished.monster.evolution!.cityDamageDealt).toBeGreaterThan(0);
});

test('feeding then risking the city carries the monster to stage 3', () => {
  let s = createInitialState(3);
  s = structuredClone(s);
  const node = s.map.wildlifeNodes[0];
  node.amount = 100000; // effectively unlimited for the test
  s.monster.pos = { ...node.pos };
  // Phase A: feed in place until well past the stage-3 XP threshold.
  s = run(s, 2000, (state) => ({
    [state.monster.id]: { actorId: state.monster.id, move: { x: 0, y: 0 }, action: 'feed' },
  }));
  expect(s.monster.evolution!.stage).toBe(2); // XP is high, but no city damage yet -> capped at 2

  // Phase B: teleport onto the core and attack until stage 3 unlocks.
  s = structuredClone(s);
  const core = s.buildings.find((b) => b.type === 'core')!;
  core.health.hp = 100000; // keep the core alive long enough to evolve
  s.monster.pos = { ...core.pos };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  s = run(s, 2000, (state) => ({
    [state.monster.id]: { actorId: state.monster.id, move: { x: 0, y: 0 } },
  }));
  expect(s.monster.evolution!.stage).toBe(3);
});
```

- [ ] **Step 4: Type-check and run the full suite**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.
Run: `pnpm -r test`
Expected: PASS — all suites green (math, rng, state, movement, step, feeding, economy, building, combat, evolution, winCondition, integration).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/step.ts packages/shared/src/index.ts packages/shared/src/integration.test.ts
git commit -m "feat(sim): wire gameplay systems into step() with full-match integration tests"
```

---

## Self-Review

**Spec coverage (against `2026-06-13-monster-vs-city-1v4-design.md`):**
- Monster hybrid feeding (wilds → XP) → Task 3. ✓
- City damage feeds the biggest evolution jump → Task 6 (cityDamageDealt + XP) + Task 7 (stage-3 gate). ✓
- 3 evolution stages with growing power → Task 7. ✓
- Build economy (Generator/Tower/Workshop), shared materials → Tasks 4, 5. ✓
- Combat: heroes/towers vs monster, monster vs heroes/buildings, deaths, pick-offs → Task 6. ✓
- Role identity: Economy income, Builder discount → Tasks 4, 5 (Defender/Scout deferred — noted in Scope notes). ✓
- Race win conditions (raze core vs slay monster) → Task 8, proven end-to-end in Task 9. ✓
- Determinism preserved (no unseeded RNG, ordered iteration) → all systems pure; existing determinism test still runs in Task 2/9. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases" steps; every code step shows complete code. The "Scope notes" deferrals are explicit design decisions, not plan gaps. ✓

**Type consistency:** `cityDamageDealt` added in Task 2 and used identically in Tasks 6, 7, 9. `buildType` added in Task 2, used in Task 5. `Building.combat` added in Task 2, set in Task 5, read in Task 6. System signatures — `feedingSystem(state, inputs)`, `economySystem(state)`, `buildingSystem(state, inputs)`, `combatSystem(state, inputs)`, `evolutionSystem(state)`, `winConditionSystem(state)` — match between their defining tasks and the `step()` wiring in Task 9. Constant names (`BUILD_COSTS`, `BUILDING_HP`, `TOWER_COMBAT`, `STAGE2_XP`, `STAGE3_XP`, `STAGE3_CITY_DAMAGE_REQ`, `STAGE_HP_BONUS`, `STAGE_DAMAGE_BONUS`, `CITY_DAMAGE_XP`, `WORKSHOP_HERO_DAMAGE_BONUS`, `GENERATOR_RATE`, `ECONOMY_ROLE_BONUS`, `BUILDER_DISCOUNT`, `STARTING_MATERIALS`, feeding constants) are defined once in Task 2 and referenced consistently. ✓
