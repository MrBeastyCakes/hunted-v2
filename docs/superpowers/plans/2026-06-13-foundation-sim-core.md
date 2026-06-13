# Foundation & Sim Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the TypeScript monorepo and a pure, deterministic, fixed-timestep simulation core that can be ticked headlessly in tests, with movement working and a determinism guarantee in place.

**Architecture:** A pnpm monorepo with a `@game/shared` package containing a transport-agnostic ECS-lite simulation: plain serializable `GameState`, an `Input`-as-intent model, and pure system functions run by a `step(state, inputs)` function at a fixed 20 Hz. No rendering, no networking, no DOM, seeded RNG only. Later plans add gameplay systems, a PixiJS client, and bots; later still, a Colyseus server wraps this exact module.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest (test runner). Node 18+ (`structuredClone` available).

---

## File Structure

```
monster-city-1v4/
├─ pnpm-workspace.yaml            # workspace globs
├─ package.json                   # root scripts + TS devDep
├─ packages/
│  └─ shared/
│     ├─ package.json             # @game/shared, vitest
│     ├─ tsconfig.json
│     ├─ vitest.config.ts
│     └─ src/
│        ├─ index.ts              # barrel re-exports
│        ├─ types.ts              # Vec2, Entity, GameState, Input, etc.
│        ├─ constants.ts          # TICK_RATE, DT, default map config
│        ├─ rng.ts                # seeded mulberry32 RNG over GameState
│        ├─ state.ts              # createInitialState factory
│        ├─ math.ts               # clamp, length, normalize helpers
│        ├─ systems/
│        │  └─ movement.ts        # movementSystem
│        └─ step.ts               # step(state, inputs) — runs systems
```

Each file has one responsibility. Systems live under `systems/` so Plan 2 adds siblings without touching `step.ts` beyond one import + one call line each.

---

### Task 1: Monorepo scaffold & toolchain

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Test: `packages/shared/src/smoke.test.ts`

- [ ] **Step 1: Create workspace + root package files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

`package.json`:
```json
{
  "name": "monster-city-1v4",
  "private": true,
  "scripts": {
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create the shared package files**

`packages/shared/package.json`:
```json
{
  "name": "@game/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true },
});
```

- [ ] **Step 3: Add a smoke test to verify the toolchain**

`packages/shared/src/smoke.test.ts`:
```ts
test('toolchain runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Install and run**

Run: `pnpm install`
Then run: `pnpm -r test`
Expected: 1 passing test in `@game/shared`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo and shared package with vitest"
```

---

### Task 2: Math helpers

**Files:**
- Create: `packages/shared/src/math.ts`
- Test: `packages/shared/src/math.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/math.test.ts`:
```ts
import { clamp, length, normalize } from './math';

test('clamp bounds a value', () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-3, 0, 10)).toBe(0);
  expect(clamp(99, 0, 10)).toBe(10);
});

test('length computes magnitude', () => {
  expect(length({ x: 3, y: 4 })).toBe(5);
  expect(length({ x: 0, y: 0 })).toBe(0);
});

test('normalize returns a unit vector, or zero for zero input', () => {
  expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  const n = normalize({ x: 3, y: 4 });
  expect(n.x).toBeCloseTo(0.6);
  expect(n.y).toBeCloseTo(0.8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @game/shared test math`
Expected: FAIL — cannot find module `./math`.

- [ ] **Step 3: Write the implementation**

`packages/shared/src/math.ts`:
```ts
export interface Vec2 {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @game/shared test math`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/math.ts packages/shared/src/math.test.ts
git commit -m "feat(sim): add Vec2 math helpers"
```

---

### Task 3: Core types & constants

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`

No test of its own (pure type declarations + constants; exercised by later tasks). The "test" is that it type-checks when imported in Task 4.

- [ ] **Step 1: Write the types**

`packages/shared/src/types.ts`:
```ts
import type { Vec2 } from './math';

export type { Vec2 };

export type EntityId = number;
export type RoleType = 'builder' | 'defender' | 'scout' | 'economy';
export type Phase = 'lobby' | 'playing' | 'monsterWon' | 'buildersWon';
export type ActionType = 'attack' | 'feed' | 'build' | 'ability';
export type BuildingType = 'core' | 'generator' | 'tower' | 'workshop';

export interface Health {
  hp: number;
  maxHp: number;
}

export interface Combat {
  damage: number;
  range: number;
  cooldown: number; // ticks between attacks
  cooldownRemaining: number;
}

export interface Evolution {
  xp: number;
  stage: number; // 1..3 in the slice
}

export interface Entity {
  id: EntityId;
  kind: 'monster' | 'hero';
  pos: Vec2;
  speed: number; // world units per second
  health: Health;
  alive: boolean;
  combat?: Combat;
  evolution?: Evolution; // monster only
  role?: RoleType; // hero only
}

export interface ResourceNode {
  id: EntityId;
  pos: Vec2;
  amount: number;
}

export interface MapState {
  width: number;
  height: number;
  wildlifeNodes: ResourceNode[];
  resourceNodes: ResourceNode[];
}

export interface Building {
  id: EntityId;
  type: BuildingType;
  pos: Vec2;
  health: Health;
  level: number;
}

export interface ResourcePool {
  materials: number;
  food: number;
}

export interface GameState {
  tick: number;
  phase: Phase;
  rngSeed: number;
  rngState: number; // advances each RNG draw; lives in state for determinism
  map: MapState;
  monster: Entity;
  heroes: Entity[];
  buildings: Building[];
  resources: ResourcePool;
}

export interface Input {
  actorId: EntityId;
  move: Vec2; // desired direction; not required to be normalized
  action?: ActionType;
  target?: EntityId | Vec2;
}

// Inputs for one tick, keyed by actorId.
export type InputMap = Record<EntityId, Input>;
```

- [ ] **Step 2: Write the constants**

`packages/shared/src/constants.ts`:
```ts
export const TICK_RATE = 20; // simulation ticks per second
export const DT = 1 / TICK_RATE; // seconds per tick

// Default vertical-slice map dimensions (world units).
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;

// Default actor speeds (world units per second).
export const MONSTER_SPEED = 6;
export const HERO_SPEED = 5;

// Default starting health.
export const MONSTER_START_HP = 60;
export const HERO_START_HP = 40;
export const CORE_START_HP = 200;
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat(sim): add core types and balance constants"
```

---

### Task 4: Seeded deterministic RNG

**Files:**
- Create: `packages/shared/src/rng.ts`
- Test: `packages/shared/src/rng.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/rng.test.ts`:
```ts
import { nextRandom, randomRange } from './rng';
import type { GameState } from './types';

function stub(seed: number): GameState {
  return { rngSeed: seed, rngState: seed } as GameState;
}

test('nextRandom returns a float in [0, 1)', () => {
  const s = stub(42);
  for (let i = 0; i < 100; i++) {
    const r = nextRandom(s);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  }
});

test('same seed produces the same sequence', () => {
  const a = stub(7);
  const b = stub(7);
  const seqA = [nextRandom(a), nextRandom(a), nextRandom(a)];
  const seqB = [nextRandom(b), nextRandom(b), nextRandom(b)];
  expect(seqA).toEqual(seqB);
});

test('different seeds diverge', () => {
  const a = stub(1);
  const b = stub(2);
  expect(nextRandom(a)).not.toBe(nextRandom(b));
});

test('randomRange stays within bounds', () => {
  const s = stub(99);
  for (let i = 0; i < 100; i++) {
    const r = randomRange(s, 10, 20);
    expect(r).toBeGreaterThanOrEqual(10);
    expect(r).toBeLessThan(20);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @game/shared test rng`
Expected: FAIL — cannot find module `./rng`.

- [ ] **Step 3: Write the implementation**

`packages/shared/src/rng.ts`:
```ts
import type { GameState } from './types';

// Mulberry32: fast, deterministic. Advances state.rngState and returns [0, 1).
export function nextRandom(state: GameState): number {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(state: GameState, min: number, max: number): number {
  return min + nextRandom(state) * (max - min);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @game/shared test rng`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/rng.ts packages/shared/src/rng.test.ts
git commit -m "feat(sim): add seeded deterministic RNG"
```

---

### Task 5: Initial state factory

**Files:**
- Create: `packages/shared/src/state.ts`
- Test: `packages/shared/src/state.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/state.test.ts`:
```ts
import { createInitialState } from './state';
import { CORE_START_HP, MONSTER_START_HP } from './constants';

test('creates a playing match with one monster and four heroes', () => {
  const s = createInitialState(123);
  expect(s.phase).toBe('playing');
  expect(s.tick).toBe(0);
  expect(s.monster.kind).toBe('monster');
  expect(s.monster.health.hp).toBe(MONSTER_START_HP);
  expect(s.heroes).toHaveLength(4);
  const roles = s.heroes.map((h) => h.role).sort();
  expect(roles).toEqual(['builder', 'defender', 'economy', 'scout']);
});

test('includes a city core building at full HP', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core');
  expect(core).toBeDefined();
  expect(core!.health.hp).toBe(CORE_START_HP);
});

test('seeds RNG state from the seed and is reproducible', () => {
  const a = createInitialState(123);
  const b = createInitialState(123);
  expect(a.rngSeed).toBe(123);
  expect(a).toEqual(b);
});

test('all entity and building ids are unique', () => {
  const s = createInitialState(123);
  const ids = [
    s.monster.id,
    ...s.heroes.map((h) => h.id),
    ...s.buildings.map((b) => b.id),
    ...s.map.wildlifeNodes.map((n) => n.id),
    ...s.map.resourceNodes.map((n) => n.id),
  ];
  expect(new Set(ids).size).toBe(ids.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @game/shared test state`
Expected: FAIL — cannot find module `./state`.

- [ ] **Step 3: Write the implementation**

`packages/shared/src/state.ts`:
```ts
import {
  CORE_START_HP,
  HERO_SPEED,
  HERO_START_HP,
  MAP_HEIGHT,
  MAP_WIDTH,
  MONSTER_SPEED,
  MONSTER_START_HP,
} from './constants';
import type {
  Building,
  Entity,
  GameState,
  ResourceNode,
  RoleType,
} from './types';

const ROLES: RoleType[] = ['builder', 'defender', 'scout', 'economy'];

export function createInitialState(seed: number): GameState {
  let nextId = 1;
  const id = () => nextId++;

  const center = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };

  const monster: Entity = {
    id: id(),
    kind: 'monster',
    pos: { x: 5, y: 5 }, // starts in a corner, away from the city
    speed: MONSTER_SPEED,
    health: { hp: MONSTER_START_HP, maxHp: MONSTER_START_HP },
    alive: true,
    evolution: { xp: 0, stage: 1 },
    combat: { damage: 5, range: 2, cooldown: 10, cooldownRemaining: 0 },
  };

  const heroes: Entity[] = ROLES.map((role, i) => ({
    id: id(),
    kind: 'hero',
    pos: { x: center.x + (i - 1.5) * 3, y: center.y + 4 },
    speed: HERO_SPEED,
    health: { hp: HERO_START_HP, maxHp: HERO_START_HP },
    alive: true,
    role,
    combat: { damage: 4, range: 3, cooldown: 12, cooldownRemaining: 0 },
  }));

  const buildings: Building[] = [
    {
      id: id(),
      type: 'core',
      pos: { ...center },
      health: { hp: CORE_START_HP, maxHp: CORE_START_HP },
      level: 1,
    },
  ];

  const wildlifeNodes: ResourceNode[] = [
    { id: id(), pos: { x: 15, y: 15 }, amount: 100 },
    { id: id(), pos: { x: 85, y: 20 }, amount: 100 },
    { id: id(), pos: { x: 20, y: 80 }, amount: 100 },
    { id: id(), pos: { x: 80, y: 85 }, amount: 100 },
  ];

  const resourceNodes: ResourceNode[] = [
    { id: id(), pos: { x: 40, y: 30 }, amount: 100 },
    { id: id(), pos: { x: 60, y: 30 }, amount: 100 },
    { id: id(), pos: { x: 50, y: 70 }, amount: 100 },
  ];

  return {
    tick: 0,
    phase: 'playing',
    rngSeed: seed,
    rngState: seed,
    map: { width: MAP_WIDTH, height: MAP_HEIGHT, wildlifeNodes, resourceNodes },
    monster,
    heroes,
    buildings,
    resources: { materials: 0, food: 0 },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @game/shared test state`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/state.ts packages/shared/src/state.test.ts
git commit -m "feat(sim): add initial state factory for the vertical slice"
```

---

### Task 6: Movement system

**Files:**
- Create: `packages/shared/src/systems/movement.ts`
- Test: `packages/shared/src/systems/movement.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/systems/movement.test.ts`:
```ts
import { movementSystem } from './movement';
import { createInitialState } from '../state';
import { DT, HERO_SPEED } from '../constants';
import type { InputMap } from '../types';

test('moves an actor in the normalized input direction by speed * DT', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  const startX = hero.pos.x;
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 1, y: 0 } },
  };
  movementSystem(s, inputs);
  expect(hero.pos.x).toBeCloseTo(startX + HERO_SPEED * DT);
});

test('diagonal movement is normalized (no speed boost)', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  const start = { ...hero.pos };
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 1, y: 1 } },
  };
  movementSystem(s, inputs);
  const dist = Math.hypot(hero.pos.x - start.x, hero.pos.y - start.y);
  expect(dist).toBeCloseTo(HERO_SPEED * DT);
});

test('no input means no movement', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  const start = { ...hero.pos };
  movementSystem(s, {});
  expect(hero.pos).toEqual(start);
});

test('clamps position to map bounds', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  hero.pos = { x: 0, y: 0 };
  hero.speed = 1000; // would overshoot
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: -1, y: -1 } },
  };
  movementSystem(s, inputs);
  expect(hero.pos.x).toBe(0);
  expect(hero.pos.y).toBe(0);
});

test('dead actors do not move', () => {
  const s = createInitialState(123);
  const hero = s.heroes[0];
  hero.alive = false;
  const start = { ...hero.pos };
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 1, y: 0 } },
  };
  movementSystem(s, inputs);
  expect(hero.pos).toEqual(start);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @game/shared test movement`
Expected: FAIL — cannot find module `./movement`.

- [ ] **Step 3: Write the implementation**

`packages/shared/src/systems/movement.ts`:
```ts
import { DT } from '../constants';
import { clamp, normalize } from '../math';
import type { Entity, GameState, InputMap } from '../types';

// Mutates state in place: advances each living actor by its input direction.
export function movementSystem(state: GameState, inputs: InputMap): void {
  const actors: Entity[] = [state.monster, ...state.heroes];
  for (const actor of actors) {
    if (!actor.alive) continue;
    const input = inputs[actor.id];
    if (!input) continue;
    const dir = normalize(input.move);
    if (dir.x === 0 && dir.y === 0) continue;
    actor.pos.x = clamp(actor.pos.x + dir.x * actor.speed * DT, 0, state.map.width);
    actor.pos.y = clamp(actor.pos.y + dir.y * actor.speed * DT, 0, state.map.height);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @game/shared test movement`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/movement.ts packages/shared/src/systems/movement.test.ts
git commit -m "feat(sim): add movement system"
```

---

### Task 7: The step() tick loop + determinism guarantee

**Files:**
- Create: `packages/shared/src/step.ts`
- Test: `packages/shared/src/step.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/step.test.ts`:
```ts
import { step } from './step';
import { createInitialState } from './state';
import type { InputMap } from './types';

test('step returns a new state and advances the tick', () => {
  const s0 = createInitialState(123);
  const s1 = step(s0, {});
  expect(s1.tick).toBe(1);
  expect(s0.tick).toBe(0); // original is not mutated
});

test('step applies movement inputs', () => {
  const s0 = createInitialState(123);
  const hero = s0.heroes[0];
  const inputs: InputMap = {
    [hero.id]: { actorId: hero.id, move: { x: 1, y: 0 } },
  };
  const s1 = step(s0, inputs);
  expect(s1.heroes[0].pos.x).toBeGreaterThan(hero.pos.x);
});

test('does not advance when phase is not playing', () => {
  const s0 = createInitialState(123);
  s0.phase = 'buildersWon';
  const s1 = step(s0, {});
  expect(s1.tick).toBe(0);
});

test('same seed + same input log => identical final state (determinism)', () => {
  const log: InputMap[] = [];
  // build a deterministic 50-tick input log driving the monster in a square
  const seed = createInitialState(777);
  const mId = seed.monster.id;
  const dirs = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  for (let i = 0; i < 50; i++) {
    log.push({ [mId]: { actorId: mId, move: dirs[i % 4] } });
  }

  let a = createInitialState(777);
  let b = createInitialState(777);
  for (const inp of log) {
    a = step(a, inp);
    b = step(b, inp);
  }
  expect(a).toEqual(b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @game/shared test step`
Expected: FAIL — cannot find module `./step`.

- [ ] **Step 3: Write the implementation**

`packages/shared/src/step.ts`:
```ts
import { movementSystem } from './systems/movement';
import type { GameState, InputMap } from './types';

// Pure fixed-timestep advance: clone, run systems on the clone, return it.
// Plan 2 adds feeding/evolution/combat/building/winCondition systems here,
// each as one import + one call line — order matters and is fixed.
export function step(state: GameState, inputs: InputMap): GameState {
  const next: GameState = structuredClone(state);
  if (next.phase !== 'playing') return next;

  movementSystem(next, inputs);
  // (Plan 2) feedingSystem(next, inputs);
  // (Plan 2) evolutionSystem(next);
  // (Plan 2) combatSystem(next, inputs);
  // (Plan 2) buildingSystem(next, inputs);
  // (Plan 2) winConditionSystem(next);

  next.tick += 1;
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @game/shared test step`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/step.ts packages/shared/src/step.test.ts
git commit -m "feat(sim): add deterministic step() tick loop with determinism test"
```

---

### Task 8: Public barrel export & full test sweep

**Files:**
- Create: `packages/shared/src/index.ts`
- Delete: `packages/shared/src/smoke.test.ts`

- [ ] **Step 1: Write the barrel export**

`packages/shared/src/index.ts`:
```ts
export * from './math';
export * from './types';
export * from './constants';
export * from './rng';
export * from './state';
export * from './step';
export { movementSystem } from './systems/movement';
```

- [ ] **Step 2: Remove the now-redundant smoke test**

Delete `packages/shared/src/smoke.test.ts` (the real suites cover the toolchain now).

- [ ] **Step 3: Run the full suite**

Run: `pnpm -r test`
Expected: PASS — all suites green (math, rng, state, movement, step), no smoke test.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(sim): add public barrel export; remove smoke test"
```

---

## Self-Review

**Spec coverage (against `2026-06-13-monster-vs-city-1v4-design.md`):**
- §4 monorepo / `@game/shared` / TS → Task 1, Task 3, Task 8. ✓
- §5 pure deterministic 20 Hz `step()`, no DOM/net/unseeded RNG → Task 6, Task 7. ✓
- §5 `GameState` shape, components, `Input` intent model, `InputMap` → Task 3. ✓
- §5 seeded RNG in state → Task 4. ✓
- §8 per-system tests + whole-match determinism test → every task is TDD; determinism in Task 7. ✓
- Out of scope here (correctly deferred to later plans): feeding/evolution/combat/building/win systems (Plan 2), PixiJS renderer (Plan 3), bots (Plan 4), Colyseus/server (post-slice). The `step.ts` body documents the exact insertion points for Plan 2 systems.

**Placeholder scan:** No "TBD/TODO/handle edge cases" in steps. The `// (Plan 2) ...` comments in `step.ts` are intentional, real code comments marking future insertion points, not plan placeholders. ✓

**Type consistency:** `GameState`, `Entity`, `Input`, `InputMap`, `ResourceNode`, `Building`, `RoleType` defined once in Task 3 and used unchanged in Tasks 4–8. `nextRandom`/`randomRange` signatures match between Task 4 def and usage. `movementSystem(state, inputs)` signature matches between Task 6 def and Task 7 call. `createInitialState(seed)` matches across Tasks 5–7. ✓
