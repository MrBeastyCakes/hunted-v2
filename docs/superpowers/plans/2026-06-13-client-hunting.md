# Client Hunting + Legacy Cleanup Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make hunting visible and playable: render the herds, let the monster tap-to-chase mobs, show the monster level as `L/5`, and remove the now-dead legacy feeding code (`wildlifeNodes`, `feedingSystem`, the `'feed'` action). Then it's ready to redeploy.

**Architecture:** Migrate the client to mobs first (pure pointer logic → renderer → controls), keeping each step green, then delete the legacy feeding from `@game/shared` once nothing references it. The sim's hunting (Plan A) is unchanged.

**Tech Stack:** TypeScript, Vitest, PixiJS 8, Vite.

**Builds on Plan A:** consumes `GameState.map.mobs`/`herds`, `Mob`, the 5-level evolution, and the hunting/herd systems.

---

### Task 1: Pointer migration — pick mobs, tap-to-chase

**Files:**
- Modify: `packages/client/src/pointer.ts`
- Modify: `packages/client/src/pointer.test.ts`

The monster now hunts mobs: `pickTarget` returns `mob` picks; tapping a mob yields a `chase`
intent; `PointerControl` tracks a `chaseMobId`; `controlToInput` steers toward the chased mob.
The `'feed'` intent and `feedNodeId` are removed.

- [ ] **Step 1: Update the tests** in `pointer.test.ts`

Replace the wildlife `pickTarget` test with a mob test:
```ts
test('pickTarget grabs a mob when tapped near it', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs[0];
  const pick = pickTarget(s, { x: mob.pos.x + 0.4, y: mob.pos.y }, 3.5);
  expect(pick).toEqual({ kind: 'mob', id: mob.id, pos: mob.pos });
});
```
In the "ignores dead actors and depleted wildlife" test, drop the wildlife-node line and replace
with a mob-emptiness check:
```ts
test('pickTarget ignores dead actors', () => {
  const s = createInitialState(1);
  s.monster.alive = false;
  s.map.mobs = [];
  expect(pickTarget(s, { ...s.monster.pos }, 3.5)).toBeUndefined();
});
```
Replace the monster-feed intent test with a chase test, and drop the old feed `controlToInput`
test, replacing with chase behavior:
```ts
test('monster tapping a mob yields a chase intent', () => {
  const s = createInitialState(1);
  const mob = s.map.mobs[0];
  const intent = resolveTapIntent(s, s.monster.id, { ...mob.pos }, 3.5);
  expect(intent).toEqual({ kind: 'chase', mobId: mob.id });
});

test('applyIntent for chase sets the chase mob and clears move target', () => {
  const c = applyIntent({ moveTarget: { x: 1, y: 1 } }, { kind: 'chase', mobId: 9 });
  expect(c).toEqual({ chaseMobId: 9 });
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
```
Update the `applyIntent` "move clears feeding" test to use chase instead:
```ts
test('applyIntent sets a move target and clears chasing', () => {
  const c = applyIntent({ chaseMobId: 9 }, { kind: 'move', point: { x: 3, y: 4 } });
  expect(c).toEqual({ moveTarget: { x: 3, y: 4 } });
});
```
Remove the `FEED_RANGE` import and the two old feed-specific tests.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test pointer`
Expected: FAIL (chase/mob not implemented).

- [ ] **Step 3: Implement** in `pointer.ts`

Change the `Pick` kind union `'wildlife'` → `'mob'`, and in `pickTarget` replace the wildlife-node
loop with mobs:
```ts
  for (const mob of state.map.mobs) consider('mob', mob.id, mob.pos);
```
(Remove the `for (const n of state.map.wildlifeNodes ...)` line.)

Update `TapIntent`: replace the `feed` variant with `chase`:
```ts
  | { kind: 'chase'; mobId: EntityId }
```
In `resolveTapIntent`, replace the monster wildlife/feed branch:
```ts
    if (isMonster && pick.kind === 'mob') return { kind: 'chase', mobId: pick.id };
    if (isMonster && (pick.kind === 'building' || pick.kind === 'hero')) {
      return { kind: 'attack', point: pick.pos };
    }
```
Replace `PointerControl`:
```ts
export interface PointerControl {
  moveTarget?: Vec2;
  chaseMobId?: EntityId;
}
```
Update `applyIntent`:
```ts
    case 'move':
    case 'attack':
      return { moveTarget: { ...intent.point } };
    case 'chase':
      return { chaseMobId: intent.mobId };
    case 'spectate':
    case 'openBuildMenu':
      return control;
```
Rewrite `controlToInput` to chase a mob (remove the `FEED_RANGE`/`feedNodeId` logic):
```ts
export function controlToInput(
  state: GameState,
  controlledId: EntityId,
  control: PointerControl,
  arrivalEps: number,
): Input {
  const actor = findActor(state, controlledId);
  if (!actor) return { actorId: controlledId, move: { x: 0, y: 0 } };

  if (control.chaseMobId !== undefined) {
    const mob = state.map.mobs.find((m) => m.id === control.chaseMobId);
    if (mob) return moveTargetToInput(controlledId, actor.pos, mob.pos, arrivalEps);
  }
  if (control.moveTarget) {
    return moveTargetToInput(controlledId, actor.pos, control.moveTarget, arrivalEps);
  }
  return { actorId: controlledId, move: { x: 0, y: 0 } };
}
```
Remove the now-unused `FEED_RANGE` import from `pointer.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test pointer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/pointer.ts packages/client/src/pointer.test.ts
git commit -m "feat(client): tap-to-chase mobs (replaces wildlife feed picking)"
```

---

### Task 2: Render herds + L/5 HUD

**Files:**
- Modify: `packages/client/src/config.ts`
- Modify: `packages/client/src/render/renderer.ts`

- [ ] **Step 1: Add mob colors** to `config.ts` `COLORS` (append inside the object):
```ts
  villager: 0xf2b66d,
  mobFlee: 0xffe08a,
```
(Wildlife mobs reuse the existing `wildlife` color.)

- [ ] **Step 2: Draw mobs** in `renderer.ts`

Remove the wildlife-node draw line:
```ts
    for (const n of curr.map.wildlifeNodes) this.dot(project(n.pos), 5, COLORS.wildlife);
```
and replace it with a mob loop:
```ts
    for (const mob of curr.map.mobs) {
      const color =
        mob.state === 'fleeing'
          ? COLORS.mobFlee
          : mob.species === 'villager'
            ? COLORS.villager
            : COLORS.wildlife;
      this.dot(project(mob.pos), mob.species === 'villager' ? 4 : 3, color);
    }
```

- [ ] **Step 3: Show the level as L/5** in the HUD

Change the monster HUD line:
```ts
      `monster: stage ${m.evolution?.stage ?? 1}  hp ...
```
to:
```ts
      `monster: L${m.evolution?.stage ?? 1}/5  hp ${Math.ceil(m.health.hp)}/${m.health.maxHp}  xp ${Math.floor(m.evolution?.xp ?? 0)}\n` +
```
(Keep the rest of the HUD string — `materials` line above, `tick` line below, spectate suffix — unchanged.)

- [ ] **Step 4: Type-check**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/config.ts packages/client/src/render/renderer.ts
git commit -m "feat(client): render mob herds and show monster level L/5"
```

---

### Task 3: Remove the feed control (keyboard)

**Files:**
- Modify: `packages/client/src/control.ts`
- Modify: `packages/client/src/control.test.ts`
- Modify: `packages/client/src/input/keyboard.ts`
- Modify: `packages/client/src/input/keyboard.test.ts`
- Modify: `packages/client/src/main.ts`

Hunting is auto-eat, so there's no feed key anymore.

- [ ] **Step 1: Update `control.ts`**

Remove `feed` from `KeyMap`:
```ts
export interface KeyMap {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  build: boolean;
}
```
In `inputFromKeys`, remove the `feed` branch (keep `build`):
```ts
  const input: Input = { actorId, move: { x, y } };
  if (keys.build) {
    input.action = 'build';
    if (buildType) input.buildType = buildType;
  }
  return input;
```

- [ ] **Step 2: Update `control.test.ts`**

Update `noKeys` to drop `feed`, remove the "feed key sets the feed action" and "feed takes
priority over build" tests. Keep the move/build tests.

- [ ] **Step 3: Update `keyboard.ts`**

Remove `feed` from `emptyKeyMap` and remove the `Space: 'feed'` entry from `CODE_TO_FIELD`.

- [ ] **Step 4: Update `keyboard.test.ts`**

In "emptyKeyMap is all false", drop `feed`. Replace the "Space feeds and KeyB builds" test with a
build-only one:
```ts
test('KeyB builds; release clears', () => {
  let m = emptyKeyMap();
  m = applyKey(m, 'KeyB', true);
  expect(m.build).toBe(true);
  m = applyKey(m, 'KeyB', false);
  expect(m.build).toBe(false);
});
```

- [ ] **Step 5: Update `main.ts`**

In the keyboard-active check, drop `k.feed`:
```ts
        const keyboardActive = k.up || k.down || k.left || k.right || k.build;
```

- [ ] **Step 6: Run client tests**

Run: `pnpm --filter @game/client test`
Expected: PASS (pointer, control, keyboard, buildFlow, spectate, loop, iso, interpolate).

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/control.ts packages/client/src/control.test.ts packages/client/src/input/keyboard.ts packages/client/src/input/keyboard.test.ts packages/client/src/main.ts
git commit -m "feat(client): remove the feed key (hunting is auto-eat)"
```

---

### Task 4: Remove legacy feeding from @game/shared

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/state.ts`
- Modify: `packages/shared/src/state.test.ts`
- Modify: `packages/shared/src/step.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/systems/hunting.ts`
- Delete: `packages/shared/src/systems/feeding.ts`
- Delete: `packages/shared/src/systems/feeding.test.ts`

- [ ] **Step 1: Types** — in `types.ts` remove `wildlifeNodes` from `MapState`, and remove
`'feed'` from `ActionType`:
```ts
export type ActionType = 'attack' | 'build' | 'ability';
```
```ts
export interface MapState {
  width: number;
  height: number;
  resourceNodes: ResourceNode[];
  mobs: Mob[];
  herds: Herd[];
}
```

- [ ] **Step 2: Constants** — remove `FEED_RANGE`, `FEED_RATE`, `XP_PER_AMOUNT` from `constants.ts`.

- [ ] **Step 3: State** — in `state.ts` remove the `wildlifeNodes` array and drop it from the
returned `map`:
```ts
    map: { width: MAP_WIDTH, height: MAP_HEIGHT, resourceNodes, mobs, herds },
```

- [ ] **Step 4: State test** — in `state.test.ts` remove the `...s.map.wildlifeNodes.map(...)`
line from the id-uniqueness list.

- [ ] **Step 5: Hunting** — in `systems/hunting.ts` remove the `wildlifeNodes` line from `maxId`:
```ts
  for (const n of state.map.resourceNodes) max = Math.max(max, n.id);
  for (const mob of state.map.mobs) max = Math.max(max, mob.id);
```

- [ ] **Step 6: Step** — in `step.ts` remove `import { feedingSystem } ...` and the
`feedingSystem(next, inputs);` call.

- [ ] **Step 7: Barrel** — in `index.ts` remove the `export { feedingSystem } ...` line.

- [ ] **Step 8: Delete the feeding files**

Delete `packages/shared/src/systems/feeding.ts` and `packages/shared/src/systems/feeding.test.ts`.

- [ ] **Step 9: Type-check + shared tests**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.
Run: `pnpm --filter @game/shared test`
Expected: PASS (no feeding suite; determinism + hunting + everything else green).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(sim): remove legacy wildlife nodes and feeding system"
```

---

### Task 5: Full sweep + build + run verification

- [ ] **Step 1: Full monorepo test sweep**

Run: `pnpm -r test`
Expected: PASS — shared (no feeding suite) and client all green.

- [ ] **Step 2: Client type-check + production build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client build`
Expected: clean build.

- [ ] **Step 3: Dev-server smoke check**

Start `pnpm --filter @game/client dev` in the background; fetch `http://localhost:5173/`
(HTTP 200, contains `Choose your side`); stop the server.

- [ ] **Step 4: Manual playtest (human)**

Pick the monster: tap a roaming critter to chase it down and eat it (auto), watch XP/level rise
(`L/5`); approach a herd and watch it scatter; villagers cluster at the campfire for the risky
late-game food.

---

## Self-Review

**Spec coverage:**
- Render mobs (wildlife vs villager, flee tint) → Task 2. ✓
- Tap-to-chase; remove feed picking → Task 1. ✓
- HUD `L/5` → Task 2. ✓
- Remove feed UI (key) → Task 3. ✓
- Remove legacy `wildlifeNodes`/`feedingSystem`/`'feed'` from shared → Task 4. ✓
- Green at each step (client migrated before shared removal) → ordering of Tasks 1–4. ✓

**Placeholder scan:** No TBD/TODO; complete edits in every step. ✓

**Type consistency:** `Pick.kind` `'mob'`, `TapIntent` `chase`, `PointerControl.chaseMobId`
(Task 1) consumed by `main.ts`'s existing `applyIntent` path. `COLORS.villager`/`mobFlee`
(Task 2) used in the renderer. `KeyMap` minus `feed` (Task 3) consistent across `control.ts`,
`keyboard.ts`, `main.ts`. After Task 4, no file references `wildlifeNodes`, `feedingSystem`, or
`'feed'` (client migrated in Tasks 1–3 first). `Mob` type from `@game/shared` used by pointer +
renderer. ✓
```
