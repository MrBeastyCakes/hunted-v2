# Resource Gathering + Animal Roaming (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Heroes venture out to harvest resource nodes for materials (exposing themselves to the monster), and wildlife herds roam a wider area and migrate so the world feels alive. Then redeploy.

**Architecture:** New pure `gatheringSystem` (auto-harvest on proximity + node respawn) wired into `step()`; `herdSystem` gains a wider wander radius + periodic home migration; `heroBot` gains a gather behavior; client `pointer` lets a hero tap a resource node. All deterministic, unit-tested.

**Tech Stack:** TypeScript, Vitest, PixiJS 8.

---

### Task 1: Constants + bigger resource nodes

**Files:** `packages/shared/src/constants.ts`, `packages/shared/src/state.ts`

- [ ] **Step 1: Constants** — append to `constants.ts`:
```ts
// --- Gathering ---
export const GATHER_RANGE = 2.5;
export const GATHER_RATE = 4; // materials/tick per harvesting hero
export const RESOURCE_NODE_AMOUNT = 300;
export const NODE_RESPAWN_TICKS = 300;
export const NODE_RESPAWN_AMOUNT = 100;

// --- Herd roaming ---
export const HERD_MIGRATE_TICKS = 120;
export const HERD_MIGRATE_STEP = 6;
```
Change the existing `HERD_WANDER_RADIUS`:
```ts
export const HERD_WANDER_RADIUS = 14; // was 6 — animals roam wider
```

- [ ] **Step 2: Bigger nodes** — in `state.ts`, import `RESOURCE_NODE_AMOUNT` and set each resource
node's `amount` to it:
```ts
  const resourceNodes: ResourceNode[] = [
    { id: id(), pos: { x: 40, y: 30 }, amount: RESOURCE_NODE_AMOUNT },
    { id: id(), pos: { x: 60, y: 30 }, amount: RESOURCE_NODE_AMOUNT },
    { id: id(), pos: { x: 50, y: 70 }, amount: RESOURCE_NODE_AMOUNT },
  ];
```

- [ ] **Step 3: Type-check**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/state.ts
git commit -m "feat(sim): gathering/roaming constants; bigger resource nodes"
```

---

### Task 2: gatheringSystem

**Files:** Create `packages/shared/src/systems/gathering.ts`; test `packages/shared/src/systems/gathering.test.ts`

- [ ] **Step 1: Test**

```ts
import { gatheringSystem } from './gathering';
import { createInitialState } from '../state';
import { GATHER_RATE, NODE_RESPAWN_TICKS, RESOURCE_NODE_AMOUNT } from '../constants';

test('a hero on a resource node harvests it into the materials pool', () => {
  const s = createInitialState(1);
  const node = s.map.resourceNodes[0];
  s.resources.materials = 0;
  s.heroes[0].pos = { ...node.pos };
  for (const h of s.heroes.slice(1)) h.pos = { x: 0, y: 0 };
  gatheringSystem(s);
  expect(s.resources.materials).toBe(GATHER_RATE);
  expect(node.amount).toBe(RESOURCE_NODE_AMOUNT - GATHER_RATE);
});

test('multiple heroes harvest a node faster', () => {
  const s = createInitialState(1);
  const node = s.map.resourceNodes[0];
  s.resources.materials = 0;
  s.heroes[0].pos = { ...node.pos };
  s.heroes[1].pos = { ...node.pos };
  for (const h of s.heroes.slice(2)) h.pos = { x: 0, y: 0 };
  gatheringSystem(s);
  expect(s.resources.materials).toBe(GATHER_RATE * 2);
});

test('a depleted node yields nothing and is not over-drained', () => {
  const s = createInitialState(1);
  const node = s.map.resourceNodes[0];
  node.amount = 2;
  s.resources.materials = 0;
  s.heroes[0].pos = { ...node.pos };
  for (const h of s.heroes.slice(1)) h.pos = { x: 0, y: 0 };
  gatheringSystem(s);
  expect(node.amount).toBe(0);
  expect(s.resources.materials).toBe(2);
});

test('nodes replenish on the respawn tick', () => {
  const s = createInitialState(1);
  const node = s.map.resourceNodes[0];
  node.amount = 0;
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  s.tick = NODE_RESPAWN_TICKS;
  gatheringSystem(s);
  expect(node.amount).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test gathering`
Expected: FAIL — cannot find module `./gathering`.

- [ ] **Step 3: Implement** `gathering.ts`

```ts
import {
  GATHER_RANGE,
  GATHER_RATE,
  NODE_RESPAWN_AMOUNT,
  NODE_RESPAWN_TICKS,
  RESOURCE_NODE_AMOUNT,
} from '../constants';
import { distance } from '../math';
import type { GameState } from '../types';

// Heroes within range of a resource node harvest it into the shared materials pool.
// Nodes slowly replenish on the respawn tick.
export function gatheringSystem(state: GameState): void {
  for (const node of state.map.resourceNodes) {
    if (node.amount <= 0) continue;
    let harvesters = 0;
    for (const h of state.heroes) {
      if (h.alive && distance(h.pos, node.pos) <= GATHER_RANGE) harvesters += 1;
    }
    if (harvesters === 0) continue;
    const harvest = Math.min(node.amount, GATHER_RATE * harvesters);
    node.amount -= harvest;
    state.resources.materials += harvest;
  }

  if (state.tick > 0 && state.tick % NODE_RESPAWN_TICKS === 0) {
    for (const node of state.map.resourceNodes) {
      node.amount = Math.min(RESOURCE_NODE_AMOUNT, node.amount + NODE_RESPAWN_AMOUNT);
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test gathering`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/gathering.ts packages/shared/src/systems/gathering.test.ts
git commit -m "feat(sim): add gathering system (harvest resource nodes)"
```

---

### Task 3: Herd roaming (wider wander + migration)

**Files:** `packages/shared/src/systems/herd.ts`, `packages/shared/src/systems/herd.test.ts`

- [ ] **Step 1: Add a migration test** (append to `herd.test.ts`)

```ts
import { HERD_MIGRATE_TICKS } from '../constants';

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test herd`
Expected: FAIL (no migration yet).

- [ ] **Step 3: Implement migration** in `herd.ts`

Add imports `HERD_MIGRATE_STEP, HERD_MIGRATE_TICKS` to the constants import and `clamp` is already
imported. At the **start** of `herdSystem` (before the panic loop), add:
```ts
  if (state.tick > 0 && state.tick % HERD_MIGRATE_TICKS === 0) {
    for (const herd of state.map.herds) {
      if (herd.species !== 'wildlife') continue;
      const ang = nextRandom(state) * Math.PI * 2;
      herd.home.x = clamp(herd.home.x + Math.cos(ang) * HERD_MIGRATE_STEP, 0, state.map.width);
      herd.home.y = clamp(herd.home.y + Math.sin(ang) * HERD_MIGRATE_STEP, 0, state.map.height);
    }
  }
```
(The wider roam comes free from the `HERD_WANDER_RADIUS` change in Task 1.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test herd`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/systems/herd.ts packages/shared/src/systems/herd.test.ts
git commit -m "feat(sim): wildlife herds roam wider and migrate"
```

---

### Task 4: Wire gathering into step()

**Files:** `packages/shared/src/step.ts`, `packages/shared/src/index.ts`

- [ ] **Step 1: Wire** — add `import { gatheringSystem } from './systems/gathering';` and insert
after `huntingSystem`:
```ts
  herdSystem(next);
  huntingSystem(next);
  gatheringSystem(next);
  economySystem(next);
```

- [ ] **Step 2: Export** — add to `index.ts`:
```ts
export { gatheringSystem } from './systems/gathering';
```

- [ ] **Step 3: Determinism test**

Run: `pnpm --filter @game/shared test step`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/step.ts packages/shared/src/index.ts
git commit -m "feat(sim): wire gathering into step()"
```

---

### Task 5: Hero bots venture out to gather

**Files:** `packages/shared/src/bots/hero.ts`, `packages/shared/src/bots/hero.test.ts`

- [ ] **Step 1: Add a test** (append to `hero.test.ts`)

```ts
test('an armed hero that cannot afford to build goes to gather a resource node', () => {
  const s = createInitialState(123);
  const builder = hero(s, 'builder');
  builder.equipped = 'sword';
  builder.pos = { x: 50, y: 50 };
  s.resources.materials = 0; // can't afford a tower
  const input = heroBot(s, builder);
  expect(input.action).toBeUndefined();
  // nearest node is at (50,70) or (40,30)/(60,30); just assert it moves somewhere
  expect(Math.hypot(input.move.x, input.move.y)).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test bots/hero`
Expected: FAIL — currently an armed hero with no materials regroups to the core (which it is at,
so move is {0,0}).

- [ ] **Step 3: Implement** — in `hero.ts`, add a nearest-resource helper and a gather step.

Add to the `@game/shared` types import: `ResourceNode`. Add a helper near `nearestWeapon`:
```ts
function nearestResource(state: GameState, from: Vec2): ResourceNode | undefined {
  let best: ResourceNode | undefined;
  let bestDist = Infinity;
  for (const n of state.map.resourceNodes) {
    if (n.amount <= 0) continue;
    const d = distance(from, n.pos);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}
```
In step 3 of `heroBot` (the "armed / can't arm" section), insert a gather branch between the
build-choice branch and the regroup branch:
```ts
  const choice = buildChoice(hero.role);
  if (choice && state.resources.materials >= BUILD_COSTS[choice]) {
    const buildType: BuildingType = choice;
    return { actorId: id, move: { x: 0, y: 0 }, action: 'build', buildType };
  }
  const node = nearestResource(state, hero.pos);
  if (node) return { actorId: id, move: toward(hero.pos, node.pos) };
  if (core && distance(hero.pos, core.pos) > HERO_HOLD_RADIUS) {
    return { actorId: id, move: toward(hero.pos, core.pos) };
  }
  return { actorId: id, move: { x: 0, y: 0 } };
```

- [ ] **Step 4: Run bot tests**

Run: `pnpm --filter @game/shared test bots`
Expected: PASS (incl. bots.integration — the autonomous match still terminates).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/bots/hero.ts packages/shared/src/bots/hero.test.ts
git commit -m "feat(sim): hero bots venture out to gather resources"
```

---

### Task 6: Client — tap a resource node to gather

**Files:** `packages/client/src/pointer.ts`, `packages/client/src/pointer.test.ts`

- [ ] **Step 1: Test** (append to `pointer.test.ts`)

```ts
test('a hero tapping a resource node moves to it (to gather)', () => {
  const s = createInitialState(1);
  s.map.mobs = [];
  const node = s.map.resourceNodes[0];
  const intent = resolveTapIntent(s, s.heroes[0].id, { ...node.pos }, 3.5);
  expect(intent).toEqual({ kind: 'move', point: { x: node.pos.x, y: node.pos.y } });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test pointer`
Expected: FAIL — resource nodes aren't picked, so the tap may resolve to a different pick or plain
ground move (works only if no other pick is closer; make it explicit).

- [ ] **Step 3: Implement** — in `pointer.ts`, add `'resource'` to `Pick['kind']`, pick non-empty
resource nodes in `pickTarget` (after weapons):
```ts
  for (const n of state.map.resourceNodes) if (n.amount > 0) consider('resource', n.id, n.pos);
```
In `resolveTapIntent`, handle a resource pick (anyone walking to it; heroes gather on contact) —
add next to the weapon case:
```ts
    if (pick.kind === 'weapon' || pick.kind === 'resource') {
      return { kind: 'move', point: { x: pick.pos.x, y: pick.pos.y } };
    }
```
(Remove the standalone weapon-only line if you merge them.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test pointer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/pointer.ts packages/client/src/pointer.test.ts
git commit -m "feat(client): tap a resource node to walk over and gather"
```

---

### Task 7: Sweep, build, serve, deploy

- [ ] **Step 1: Full sweep**

Run: `pnpm -r test`
Expected: PASS (shared + client).

- [ ] **Step 2: Client build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client build`
Expected: clean.

- [ ] **Step 3: Serve smoke**

Start `pnpm --filter @game/client dev`; fetch `http://localhost:5173/` (HTTP 200, `Choose your side`); stop.

- [ ] **Step 4: Merge + deploy**

Merge `feat/gathering-roaming` to `master`, delete branch, `git push origin master`; watch the
Pages workflow to success; confirm the live URL serves.

- [ ] **Step 5: Manual playtest (human)**

Play the monster: heroes now leave the campfire to harvest the blue resource nodes — catch a lone
gatherer. Watch wildlife herds roam and migrate across the map.

---

## Self-Review

**Spec coverage:** harvest nodes -> materials (Task 2) ✓; nodes replenish (Task 2) ✓; hero bots
venture to gather (Task 5) ✓; player tap-to-gather (Task 6) ✓; wildlife wider wander + migration
(Tasks 1,3) ✓; villagers don't migrate (Task 3 test) ✓; deterministic (seeded RNG; no unseeded
randomness) ✓; deploy (Task 7) ✓.

**Placeholder scan:** complete code; no TBD. ✓

**Type consistency:** `gatheringSystem(state)` matches its `step()` call (Task 4) and export.
`GATHER_*`/`NODE_*`/`RESOURCE_NODE_AMOUNT`/`HERD_MIGRATE_*` defined once (Task 1). `nearestResource`
returns `ResourceNode` (imported in hero.ts). `Pick.kind` `'resource'` handled in `resolveTapIntent`.
`HERD_WANDER_RADIUS` change is value-only (same name). ✓
