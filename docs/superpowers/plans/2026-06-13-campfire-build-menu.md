# Campfire Build Menu + Ghost Placement Implementation Plan (Plan 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Heroes build through the campfire: tap the campfire → blueprint menu (cost-gated) → pick one → double-tap the map to drop a translucent ghost → single-tap the ghost to confirm → it builds there. Completes the no-buttons touch design.

**Architecture:** Pure, unit-tested state machines do the work — `buildFlowReducer` (menu → placing → confirm), `canAfford`, `isDoubleTap`, `placingTapAction`, and a `buildCost` helper promoted into `@game/shared` (single source of truth, reused by the sim). The build-menu DOM overlay, the ghost render, and the `main.ts` wiring are thin glue (build/run-verified). The sim already builds at a target position, so a confirmed placement just emits a one-shot build `Input`.

**Tech Stack:** TypeScript, Vitest, PixiJS 8, Vite.

**Builds on Plan 6:** reuses `pointer.ts` (`pickTarget`, `findActor`, `resolveTapIntent`), the renderer, and the tap wiring.

---

### Task 1: Promote `buildCost` into @game/shared

**Files:**
- Create: `packages/shared/src/cost.ts`
- Modify: `packages/shared/src/systems/building.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/cost.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/cost.test.ts`:
```ts
import { buildCost } from './cost';
import { BUILD_COSTS, BUILDER_DISCOUNT } from './constants';

test('non-builder roles pay the full cost', () => {
  expect(buildCost('defender', 'tower')).toBe(BUILD_COSTS.tower);
  expect(buildCost('economy', 'generator')).toBe(BUILD_COSTS.generator);
  expect(buildCost(undefined, 'workshop')).toBe(BUILD_COSTS.workshop);
});

test('the builder role gets the discount (floored)', () => {
  expect(buildCost('builder', 'tower')).toBe(Math.floor(BUILD_COSTS.tower * BUILDER_DISCOUNT));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test cost`
Expected: FAIL — cannot find module `./cost`.

- [ ] **Step 3: Implement** `packages/shared/src/cost.ts`

```ts
import { BUILD_COSTS, BUILDER_DISCOUNT } from './constants';
import type { RoleType } from './types';

export type BuildableType = 'generator' | 'tower' | 'workshop';

// Material cost of a blueprint for a given role (builder gets a discount).
export function buildCost(role: RoleType | undefined, type: BuildableType): number {
  const base = BUILD_COSTS[type];
  return role === 'builder' ? Math.floor(base * BUILDER_DISCOUNT) : base;
}
```

- [ ] **Step 4: Refactor `buildingSystem` to use it**

In `packages/shared/src/systems/building.ts`:
- Replace the local `type BuildableType = ...` line with an import: add `import { buildCost, type BuildableType } from '../cost';` near the top (and remove the now-duplicate local `type BuildableType` declaration).
- Replace the cost computation:
```ts
    const base = BUILD_COSTS[type];
    const cost = hero.role === 'builder' ? Math.floor(base * BUILDER_DISCOUNT) : base;
```
with:
```ts
    const cost = buildCost(hero.role, type);
```
- Remove now-unused imports `BUILDER_DISCOUNT` (and `BUILD_COSTS` if no longer referenced) from the building.ts constants import. (Leave `BUILDING_HP`, `TOWER_COMBAT`.)

- [ ] **Step 5: Export from the barrel** (add to `packages/shared/src/index.ts`)

```ts
export { buildCost } from './cost';
export type { BuildableType } from './cost';
```

- [ ] **Step 6: Run shared tests (cost + building must pass)**

Run: `pnpm --filter @game/shared test`
Expected: PASS — including the existing building suite (unchanged behavior) and the new cost suite.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/cost.ts packages/shared/src/cost.test.ts packages/shared/src/systems/building.ts packages/shared/src/index.ts
git commit -m "feat(sim): promote buildCost into shared, reuse in buildingSystem"
```

---

### Task 2: Build-flow reducer + affordability

**Files:**
- Create: `packages/client/src/buildFlow.ts`
- Test: `packages/client/src/buildFlow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { BLUEPRINTS, buildFlowReducer, canAfford, type BuildFlow } from './buildFlow';
import { createInitialState } from '@game/shared';

test('BLUEPRINTS are the three buildable structures', () => {
  expect(BLUEPRINTS).toEqual(['tower', 'generator', 'workshop']);
});

test('open -> menu, select -> placing', () => {
  let r = buildFlowReducer({ phase: 'idle' }, { t: 'open' });
  expect(r.flow.phase).toBe('menu');
  r = buildFlowReducer(r.flow, { t: 'select', blueprint: 'tower' });
  expect(r.flow).toEqual({ phase: 'placing', blueprint: 'tower' });
});

test('placeGhost records the ghost position while placing', () => {
  const flow: BuildFlow = { phase: 'placing', blueprint: 'tower' };
  const r = buildFlowReducer(flow, { t: 'placeGhost', point: { x: 5, y: 6 } });
  expect(r.flow).toEqual({ phase: 'placing', blueprint: 'tower', ghost: { x: 5, y: 6 } });
});

test('placeGhost is ignored when not placing', () => {
  const r = buildFlowReducer({ phase: 'menu' }, { t: 'placeGhost', point: { x: 1, y: 1 } });
  expect(r.flow).toEqual({ phase: 'menu' });
});

test('confirm with a ghost emits a build command and returns to idle', () => {
  const flow: BuildFlow = { phase: 'placing', blueprint: 'generator', ghost: { x: 9, y: 2 } };
  const r = buildFlowReducer(flow, { t: 'confirm' });
  expect(r.flow).toEqual({ phase: 'idle' });
  expect(r.build).toEqual({ buildType: 'generator', target: { x: 9, y: 2 } });
});

test('confirm without a ghost does nothing', () => {
  const flow: BuildFlow = { phase: 'placing', blueprint: 'tower' };
  const r = buildFlowReducer(flow, { t: 'confirm' });
  expect(r.flow).toEqual(flow);
  expect(r.build).toBeUndefined();
});

test('cancel returns to idle', () => {
  const r = buildFlowReducer({ phase: 'placing', blueprint: 'tower', ghost: { x: 1, y: 1 } }, { t: 'cancel' });
  expect(r.flow).toEqual({ phase: 'idle' });
});

test('canAfford compares materials against the role-adjusted cost', () => {
  const s = createInitialState(1);
  const builder = s.heroes.find((h) => h.role === 'builder')!;
  s.resources.materials = 0;
  expect(canAfford(s, builder.role, 'tower')).toBe(false);
  s.resources.materials = 1000;
  expect(canAfford(s, builder.role, 'tower')).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test buildFlow`
Expected: FAIL — cannot find module `./buildFlow`.

- [ ] **Step 3: Implement** `packages/client/src/buildFlow.ts`

```ts
import { buildCost, type BuildableType, type GameState, type RoleType, type Vec2 } from '@game/shared';

export const BLUEPRINTS: BuildableType[] = ['tower', 'generator', 'workshop'];

export interface BuildFlow {
  phase: 'idle' | 'menu' | 'placing';
  blueprint?: BuildableType;
  ghost?: Vec2;
}

export type BuildEvent =
  | { t: 'open' }
  | { t: 'select'; blueprint: BuildableType }
  | { t: 'placeGhost'; point: Vec2 }
  | { t: 'confirm' }
  | { t: 'cancel' };

export interface BuildResult {
  flow: BuildFlow;
  build?: { buildType: BuildableType; target: Vec2 };
}

export function buildFlowReducer(flow: BuildFlow, e: BuildEvent): BuildResult {
  switch (e.t) {
    case 'open':
      return { flow: { phase: 'menu' } };
    case 'select':
      return { flow: { phase: 'placing', blueprint: e.blueprint } };
    case 'placeGhost':
      if (flow.phase !== 'placing') return { flow };
      return { flow: { ...flow, ghost: { ...e.point } } };
    case 'confirm':
      if (flow.phase === 'placing' && flow.blueprint && flow.ghost) {
        return {
          flow: { phase: 'idle' },
          build: { buildType: flow.blueprint, target: flow.ghost },
        };
      }
      return { flow };
    case 'cancel':
      return { flow: { phase: 'idle' } };
  }
}

export function canAfford(state: GameState, role: RoleType | undefined, type: BuildableType): boolean {
  return state.resources.materials >= buildCost(role, type);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test buildFlow`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/buildFlow.ts packages/client/src/buildFlow.test.ts
git commit -m "feat(client): add build-flow reducer and affordability"
```

---

### Task 3: Double-tap detection + placing-mode tap action

**Files:**
- Modify: `packages/client/src/buildFlow.ts`
- Modify: `packages/client/src/buildFlow.test.ts`
- Modify: `packages/client/src/config.ts`

- [ ] **Step 1: Add config constants** (append to `config.ts`)

```ts
// Double-tap detection (for placing build ghosts).
export const DOUBLE_TAP_MS = 300; // max gap between taps
export const DOUBLE_TAP_DIST = 30; // max screen-pixel movement between taps
```

- [ ] **Step 2: Add failing tests** (append to `buildFlow.test.ts`)

```ts
import { isDoubleTap, placingTapAction } from './buildFlow';

test('isDoubleTap is false without a previous tap', () => {
  expect(isDoubleTap(undefined, undefined, 100, { x: 0, y: 0 }, 300, 30)).toBe(false);
});

test('isDoubleTap is true for two close, quick taps', () => {
  expect(isDoubleTap(100, { x: 10, y: 10 }, 350, { x: 12, y: 11 }, 300, 30)).toBe(true);
});

test('isDoubleTap is false when too slow or too far', () => {
  expect(isDoubleTap(100, { x: 10, y: 10 }, 500, { x: 12, y: 11 }, 300, 30)).toBe(false);
  expect(isDoubleTap(100, { x: 10, y: 10 }, 350, { x: 80, y: 80 }, 300, 30)).toBe(false);
});

test('placingTapAction: tapping the campfire cancels', () => {
  expect(placingTapAction({ x: 5, y: 5 }, false, { x: 9, y: 9 }, true, 3.5)).toEqual({ t: 'cancel' });
});

test('placingTapAction: a double-tap places the ghost', () => {
  expect(placingTapAction({ x: 5, y: 5 }, true, undefined, false, 3.5)).toEqual({
    t: 'placeGhost',
    point: { x: 5, y: 5 },
  });
});

test('placingTapAction: a single tap on the ghost confirms', () => {
  expect(placingTapAction({ x: 9.2, y: 9 }, false, { x: 9, y: 9 }, false, 3.5)).toEqual({ t: 'confirm' });
});

test('placingTapAction: a single tap elsewhere does nothing', () => {
  expect(placingTapAction({ x: 1, y: 1 }, false, { x: 9, y: 9 }, false, 3.5)).toEqual({ t: 'none' });
});
```

- [ ] **Step 3: Implement** (append to `buildFlow.ts`)

```ts
import { distance } from '@game/shared';

interface ScreenPt {
  x: number;
  y: number;
}

export function isDoubleTap(
  prevMs: number | undefined,
  prevPos: ScreenPt | undefined,
  nowMs: number,
  nowPos: ScreenPt,
  maxMs: number,
  maxDistPx: number,
): boolean {
  if (prevMs === undefined || prevPos === undefined) return false;
  if (nowMs - prevMs > maxMs) return false;
  return Math.hypot(nowPos.x - prevPos.x, nowPos.y - prevPos.y) <= maxDistPx;
}

export type PlacingAction =
  | { t: 'placeGhost'; point: Vec2 }
  | { t: 'confirm' }
  | { t: 'cancel' }
  | { t: 'none' };

// Decides what a tap means while in placing mode.
export function placingTapAction(
  world: Vec2,
  isDouble: boolean,
  ghost: Vec2 | undefined,
  hitCampfire: boolean,
  pickRadius: number,
): PlacingAction {
  if (hitCampfire) return { t: 'cancel' };
  if (isDouble) return { t: 'placeGhost', point: world };
  if (ghost && distance(world, ghost) <= pickRadius) return { t: 'confirm' };
  return { t: 'none' };
}
```

(Merge the new `distance` import with the existing `@game/shared` import line at the top of `buildFlow.ts` if your linter prefers a single import.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test buildFlow`
Expected: PASS (15 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/buildFlow.ts packages/client/src/buildFlow.test.ts packages/client/src/config.ts
git commit -m "feat(client): add double-tap detection and placing-mode tap action"
```

---

### Task 4: `resolveTapIntent` opens the build menu on a hero's campfire tap

**Files:**
- Modify: `packages/client/src/pointer.ts`
- Modify: `packages/client/src/pointer.test.ts`

- [ ] **Step 1: Add a failing test** (append to `pointer.test.ts`)

```ts
test('a hero tapping the campfire (core) opens the build menu', () => {
  const s = createInitialState(1);
  const core = s.buildings.find((b) => b.type === 'core')!;
  const intent = resolveTapIntent(s, s.heroes[0].id, { ...core.pos }, 3.5);
  expect(intent).toEqual({ kind: 'openBuildMenu' });
});

test('the monster tapping the campfire attacks, not opens a menu', () => {
  const s = createInitialState(1);
  const core = s.buildings.find((b) => b.type === 'core')!;
  const intent = resolveTapIntent(s, s.monster.id, { ...core.pos }, 3.5);
  expect(intent).toEqual({ kind: 'attack', point: core.pos });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test pointer`
Expected: FAIL — hero tapping core currently returns a `move` intent.

- [ ] **Step 3: Implement**

In `pointer.ts`, add `openBuildMenu` to the `TapIntent` union:
```ts
export type TapIntent =
  | { kind: 'move'; point: Vec2 }
  | { kind: 'feed'; nodeId: EntityId }
  | { kind: 'attack'; point: Vec2 }
  | { kind: 'spectate'; actorId: EntityId }
  | { kind: 'openBuildMenu' };
```

In `resolveTapIntent`, in the `if (pick) { ... }` block, after the existing hero-vs-monster line, add a hero-vs-campfire case:
```ts
    if (!isMonster && pick.kind === 'monster') return { kind: 'attack', point: pick.pos };
    if (!isMonster && pick.kind === 'building') {
      const building = state.buildings.find((b) => b.id === pick.id);
      if (building?.type === 'core') return { kind: 'openBuildMenu' };
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test pointer`
Expected: PASS (18 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/pointer.ts packages/client/src/pointer.test.ts
git commit -m "feat(client): hero tapping the campfire opens the build menu"
```

---

### Task 5: Renderer draws the build ghost

**Files:**
- Modify: `packages/client/src/render/renderer.ts`

- [ ] **Step 1: Add ghost state + setter**

Add a field near the others:
```ts
  private ghost?: { pos: Vec2; type: Building['type'] };
```

Add a setter method:
```ts
  setGhost(pos: Vec2 | undefined, type?: Building['type']): void {
    this.ghost = pos && type ? { pos, type } : undefined;
  }
```

- [ ] **Step 2: Draw the ghost each frame**

In `render(...)`, right after the buildings loop (before the Campfire label block), add:
```ts
    if (this.ghost) {
      const gp = project(this.ghost.pos);
      const size = 11;
      this.g
        .rect(gp.x - size / 2, gp.y - size, size, size)
        .fill({ color: BUILDING_COLOR[this.ghost.type], alpha: 0.45 });
    }
```

- [ ] **Step 3: Type-check**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/render/renderer.ts
git commit -m "feat(client): renderer draws a translucent build ghost"
```

---

### Task 6: Build-menu overlay + main.ts wiring

**Files:**
- Create: `packages/client/src/buildMenu.ts`
- Modify: `packages/client/src/main.ts`

- [ ] **Step 1: Create the build-menu DOM overlay** `packages/client/src/buildMenu.ts`

```ts
import type { BuildableType } from '@game/shared';

export interface BlueprintItem {
  type: BuildableType;
  cost: number;
  affordable: boolean;
}

let panel: HTMLDivElement | undefined;

function ensurePanel(): HTMLDivElement {
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = 'buildmenu';
  Object.assign(panel.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    display: 'none',
    gap: '8px',
    padding: '10px',
    background: '#161b22ee',
    border: '1px solid #2f81f7',
    borderRadius: '10px',
    zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(panel);
  return panel;
}

// Shows the blueprint menu; calls onSelect(type) or onCancel and hides itself.
export function showBuildMenu(
  items: BlueprintItem[],
  onSelect: (type: BuildableType) => void,
  onCancel: () => void,
): void {
  const el = ensurePanel();
  el.innerHTML = '';
  el.style.display = 'flex';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.textContent = `${item.type} (${item.cost})`;
    btn.disabled = !item.affordable;
    Object.assign(btn.style, {
      fontSize: '15px',
      padding: '8px 12px',
      cursor: item.affordable ? 'pointer' : 'not-allowed',
      opacity: item.affordable ? '1' : '0.45',
      border: '1px solid #30363d',
      borderRadius: '8px',
      background: '#0d1117',
      color: '#e6edf3',
    } satisfies Partial<CSSStyleDeclaration>);
    btn.addEventListener('click', () => {
      hideBuildMenu();
      onSelect(item.type);
    });
    el.appendChild(btn);
  }

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  Object.assign(cancel.style, {
    fontSize: '15px',
    padding: '8px 12px',
    cursor: 'pointer',
    border: '1px solid #30363d',
    borderRadius: '8px',
    background: '#0d1117',
    color: '#e6edf3',
  } satisfies Partial<CSSStyleDeclaration>);
  cancel.addEventListener('click', () => {
    hideBuildMenu();
    onCancel();
  });
  el.appendChild(cancel);
}

export function hideBuildMenu(): void {
  if (panel) panel.style.display = 'none';
}

// A small instruction line while placing a ghost.
let hint: HTMLDivElement | undefined;
export function setPlacingHint(visible: boolean): void {
  if (!hint) {
    hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      padding: '8px 12px',
      background: '#161b22ee',
      borderRadius: '8px',
      color: '#e6edf3',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      zIndex: '20',
    } satisfies Partial<CSSStyleDeclaration>);
    hint.textContent = 'Double-tap to place • tap the ghost to confirm • tap the campfire to cancel';
    document.body.appendChild(hint);
  }
  hint.style.display = visible ? 'block' : 'none';
}
```

- [ ] **Step 2: Wire it into `main.ts` — imports**

Add:
```ts
import { buildCost } from '@game/shared';
import {
  BLUEPRINTS,
  buildFlowReducer,
  canAfford,
  isDoubleTap,
  placingTapAction,
  type BuildFlow,
} from './buildFlow';
import { showBuildMenu, hideBuildMenu, setPlacingHint } from './buildMenu';
import { findActor } from './pointer';
import { DOUBLE_TAP_DIST, DOUBLE_TAP_MS } from './config';
```
(Ensure `findActor` and `pickTarget` are imported from `./pointer`; `pickTarget` is already used — extend the existing import to include `findActor`. Add `DOUBLE_TAP_DIST`/`DOUBLE_TAP_MS` to the existing `./config` import.)

Also extend the existing pointer import to include `pickTarget`:
```ts
import { applyIntent, controlToInput, findActor, pickTarget, resolveTapIntent, type PointerControl } from './pointer';
```

- [ ] **Step 3: Add build-flow state**

After `let control: PointerControl = {};` add:
```ts
  let flow: BuildFlow = { phase: 'idle' };
  let pendingBuild: { buildType: import('@game/shared').BuildingType; target: { x: number; y: number } } | undefined;
  let lastTapMs: number | undefined;
  let lastTapPos: { x: number; y: number } | undefined;

  const isCampfireHit = (world: { x: number; y: number }): boolean => {
    const pick = pickTarget(curr, world, PICK_RADIUS);
    if (!pick || pick.kind !== 'building') return false;
    return curr.buildings.find((b) => b.id === pick.id)?.type === 'core';
  };
```

- [ ] **Step 4: Replace the pointer handler body**

Replace the entire existing `app.canvas.addEventListener('pointerdown', ...)` handler with:
```ts
  app.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = app.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = screenToWorld(screen, TILE_W, TILE_H, renderer.cameraOrigin());

    const now = performance.now();
    const doubleTap = isDoubleTap(lastTapMs, lastTapPos, now, screen, DOUBLE_TAP_MS, DOUBLE_TAP_DIST);
    lastTapMs = now;
    lastTapPos = screen;

    if (flow.phase === 'menu') return; // handled by overlay buttons

    if (flow.phase === 'placing') {
      const action = placingTapAction(world, doubleTap, flow.ghost, isCampfireHit(world), PICK_RADIUS);
      if (action.t === 'placeGhost') {
        flow = buildFlowReducer(flow, { t: 'placeGhost', point: action.point }).flow;
        renderer.setGhost(flow.ghost, flow.blueprint);
      } else if (action.t === 'confirm') {
        const r = buildFlowReducer(flow, { t: 'confirm' });
        flow = r.flow;
        renderer.setGhost(undefined);
        setPlacingHint(false);
        if (r.build) pendingBuild = r.build;
      } else if (action.t === 'cancel') {
        flow = buildFlowReducer(flow, { t: 'cancel' }).flow;
        renderer.setGhost(undefined);
        setPlacingHint(false);
      }
      return;
    }

    // idle phase: normal intents
    const intent = resolveTapIntent(curr, controlledId, world, PICK_RADIUS);
    if (intent.kind === 'openBuildMenu') {
      flow = buildFlowReducer(flow, { t: 'open' }).flow;
      const me = findActor(curr, controlledId);
      const items = BLUEPRINTS.map((type) => ({
        type,
        cost: buildCost(me?.role, type),
        affordable: canAfford(curr, me?.role, type),
      }));
      showBuildMenu(
        items,
        (type) => {
          flow = buildFlowReducer(flow, { t: 'select', blueprint: type }).flow;
          setPlacingHint(true);
        },
        () => {
          flow = buildFlowReducer(flow, { t: 'cancel' }).flow;
        },
      );
      return;
    }
    if (intent.kind === 'spectate') {
      cameraTargetId = intent.actorId;
      renderer.setCameraTarget(cameraTargetId);
    } else {
      control = applyIntent(control, intent);
    }
  });
```

- [ ] **Step 5: Inject a one-shot build Input in the step loop**

Replace the controlled-input block:
```ts
      if (isActorAlive(curr, controlledId)) {
        const k = keyboard.state();
        const keyboardActive = k.up || k.down || k.left || k.right || k.feed || k.build;
        inputs[controlledId] = keyboardActive
          ? inputFromKeys(controlledId, k, DEFAULT_BUILD)
          : controlToInput(curr, controlledId, control, MOVE_ARRIVAL_EPS);
      }
```
with:
```ts
      if (isActorAlive(curr, controlledId)) {
        if (pendingBuild) {
          inputs[controlledId] = {
            actorId: controlledId,
            move: { x: 0, y: 0 },
            action: 'build',
            buildType: pendingBuild.buildType,
            target: pendingBuild.target,
          };
          pendingBuild = undefined;
        } else {
          const k = keyboard.state();
          const keyboardActive = k.up || k.down || k.left || k.right || k.feed || k.build;
          inputs[controlledId] = keyboardActive
            ? inputFromKeys(controlledId, k, DEFAULT_BUILD)
            : controlToInput(curr, controlledId, control, MOVE_ARRIVAL_EPS);
        }
      }
```

- [ ] **Step 6: Type-check + build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.
Run: `pnpm --filter @game/client build`
Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/buildMenu.ts packages/client/src/main.ts
git commit -m "feat(client): campfire build menu, ghost placement, and confirm-to-build"
```

---

### Task 7: Full sweep + run verification

- [ ] **Step 1: Full monorepo test sweep**

Run: `pnpm -r test`
Expected: PASS — shared 69 (67 + 2 cost); client 45 + buildFlow (15) + 2 new pointer = 62.

- [ ] **Step 2: Dev-server smoke check**

Start `pnpm --filter @game/client dev` in the background; fetch `http://localhost:5173/` (HTTP 200, contains `Choose your side`); stop the server.

- [ ] **Step 3: Manual playtest (human)**

Pick a Builder hero, tap the campfire → menu appears with costs; pick Tower → double-tap a spot → a translucent ghost appears → tap the ghost → a tower is built and materials drop. Tap the campfire mid-placement to cancel.

---

## Self-Review

**Spec coverage (against `2026-06-13-mobile-controls-design.md`):**
- Tap campfire → blueprint menu with costs, greyed when unaffordable → Tasks 2 (canAfford), 6 (overlay). ✓
- Select blueprint → double-tap to place ghost → single-tap ghost to confirm → build at target → Tasks 2 (reducer), 3 (placing action / double-tap), 5 (ghost render), 6 (wiring + one-shot build Input). ✓
- Tap campfire again to cancel → Task 3 (`placingTapAction` cancel) + Task 6. ✓
- Monster tapping the campfire attacks (no menu) → Task 4 test. ✓
- Sim unchanged except a refactor that preserves behavior; build-at-target already supported → Task 1. ✓

**Placeholder scan:** No TBD/TODO; every code step is complete. ✓

**Type consistency:** `buildCost(role, type)` and `BuildableType` come from `@game/shared` (Task 1) and are used by `buildFlow.ts` (Task 2) and `main.ts` (Task 6). `BuildFlow`/`buildFlowReducer`/`canAfford`/`BLUEPRINTS` (Task 2) + `isDoubleTap`/`placingTapAction`/`PlacingAction` (Task 3) consumed in Task 6. `TapIntent` gains `openBuildMenu` (Task 4), handled in Task 6. `GameRenderer.setGhost(pos, type)` (Task 5) called in Task 6. `pickTarget`/`findActor` (pointer.ts) used in Task 6. `DOUBLE_TAP_MS`/`DOUBLE_TAP_DIST` (Task 3 config) used in Task 6. The one-shot build `Input` uses `BuildingType` + `target` already on the `Input` type (Plan 2). ✓
