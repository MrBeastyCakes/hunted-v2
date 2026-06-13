# Pointer Controls + Viewport Hardening Implementation Plan (Plan 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the game playable by tap/click on mobile and desktop: tap empty ground to move, tap a wildlife node to feed (monster), tap the monster/buildings to engage, tap an actor to spectate when dead — plus crisp high-DPI rendering and disabled browser zoom/scroll. Keyboard stays as a desktop fallback.

**Architecture:** Pure, unit-tested modules do the thinking — inverse iso projection (`screenToWorld`), tap hit-testing (`pickTarget`), tap→intent resolution (`resolveTapIntent`), and a tiny pointer-control state turned into per-tick `Input` (`controlToInput`). The PixiJS renderer exposes its camera origin and uses logical (CSS-pixel) screen size; `main.ts` wires pointer events and DPR/viewport hardening. No `@game/shared` changes.

**Tech Stack:** TypeScript, Vitest, PixiJS 8, Vite.

**Builds on Plans 3 & 5:** reuses `worldToScreen`/`ScreenPoint` (iso.ts), the renderer, `inputFromKeys`/`Keyboard`, and `spectate.ts`. The core building is displayed as "Campfire" (its level-1 name).

---

### Task 1: Inverse isometric projection — `screenToWorld`

**Files:**
- Modify: `packages/client/src/render/iso.ts`
- Test: `packages/client/src/render/iso.test.ts`

- [ ] **Step 1: Add failing tests** (append to `iso.test.ts`)

```ts
import { screenToWorld, worldToScreen as w2s } from './iso';

test('screenToWorld inverts worldToScreen', () => {
  const origin = { x: 137, y: 42 };
  for (const world of [{ x: 0, y: 0 }, { x: 3, y: 7 }, { x: 12.5, y: -4 }]) {
    const back = screenToWorld(w2s(world, 32, 16, origin), 32, 16, origin);
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  }
});

test('screenToWorld maps the origin to world (0,0)', () => {
  const p = screenToWorld({ x: 100, y: 50 }, 32, 16, { x: 100, y: 50 });
  expect(p.x).toBeCloseTo(0);
  expect(p.y).toBeCloseTo(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test iso`
Expected: FAIL — `screenToWorld` is not exported.

- [ ] **Step 3: Implement** (append to `iso.ts`)

```ts
import type { Vec2 } from '@game/shared';

// Inverse of worldToScreen: recover a world point from a screen point.
export function screenToWorld(
  screen: ScreenPoint,
  tileW: number,
  tileH: number,
  origin: ScreenPoint,
): Vec2 {
  const dx = screen.x - origin.x;
  const dy = screen.y - origin.y;
  return { x: dx / tileW + dy / tileH, y: dy / tileH - dx / tileW };
}
```

(Note: `iso.ts` already imports `Vec2` for `worldToScreen`; if so, do not duplicate the import — keep a single `import type { Vec2 } from '@game/shared';` at the top.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test iso`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/render/iso.ts packages/client/src/render/iso.test.ts
git commit -m "feat(client): add screenToWorld inverse projection"
```

---

### Task 2: Pointer constants + hit-testing (`pickTarget`, `findActor`)

**Files:**
- Modify: `packages/client/src/config.ts`
- Create: `packages/client/src/pointer.ts`
- Test: `packages/client/src/pointer.test.ts`

- [ ] **Step 1: Add config constants** (append to `config.ts`)

```ts
// Pointer-control tuning.
export const PICK_RADIUS = 3.5; // world units: how close a tap must be to grab a target
export const MOVE_ARRIVAL_EPS = 0.6; // stop moving when within this distance of the target
```

- [ ] **Step 2: Write the failing test**

`packages/client/src/pointer.test.ts`:
```ts
import { findActor, pickTarget } from './pointer';
import { createInitialState } from '@game/shared';

test('findActor returns the monster and heroes by id, undefined otherwise', () => {
  const s = createInitialState(1);
  expect(findActor(s, s.monster.id)?.kind).toBe('monster');
  expect(findActor(s, s.heroes[0].id)?.id).toBe(s.heroes[0].id);
  expect(findActor(s, 999999)).toBeUndefined();
});

test('pickTarget grabs a wildlife node when tapped near it', () => {
  const s = createInitialState(1);
  const node = s.map.wildlifeNodes[0];
  const pick = pickTarget(s, { x: node.pos.x + 0.5, y: node.pos.y }, 3.5);
  expect(pick).toEqual({ kind: 'wildlife', id: node.id, pos: node.pos });
});

test('pickTarget grabs the monster when tapped on it', () => {
  const s = createInitialState(1);
  const pick = pickTarget(s, { ...s.monster.pos }, 3.5);
  expect(pick?.kind).toBe('monster');
  expect(pick?.id).toBe(s.monster.id);
});

test('pickTarget returns undefined when the tap is in open space', () => {
  const s = createInitialState(1);
  // a corner far from everything
  expect(pickTarget(s, { x: 2, y: 98 }, 3.5)).toBeUndefined();
});

test('pickTarget ignores dead actors and depleted wildlife', () => {
  const s = createInitialState(1);
  s.monster.alive = false;
  const node = s.map.wildlifeNodes[0];
  node.amount = 0;
  expect(pickTarget(s, { ...s.monster.pos }, 3.5)).toBeUndefined();
  expect(pickTarget(s, { ...node.pos }, 3.5)).toBeUndefined();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @game/client test pointer`
Expected: FAIL — cannot find module `./pointer`.

- [ ] **Step 4: Implement** `packages/client/src/pointer.ts`

```ts
import { distance, type Entity, type EntityId, type GameState, type Vec2 } from '@game/shared';

export interface Pick {
  kind: 'monster' | 'hero' | 'building' | 'wildlife';
  id: EntityId;
  pos: Vec2;
}

export function findActor(state: GameState, id: EntityId): Entity | undefined {
  if (state.monster.id === id) return state.monster;
  return state.heroes.find((h) => h.id === id);
}

// Nearest interactable within `radius` world units of the tapped point, or undefined.
export function pickTarget(state: GameState, world: Vec2, radius: number): Pick | undefined {
  let best: Pick | undefined;
  let bestDist = radius;
  const consider = (kind: Pick['kind'], id: EntityId, pos: Vec2) => {
    const d = distance(world, pos);
    if (d <= bestDist) {
      bestDist = d;
      best = { kind, id, pos };
    }
  };

  if (state.monster.alive) consider('monster', state.monster.id, state.monster.pos);
  for (const h of state.heroes) if (h.alive) consider('hero', h.id, h.pos);
  for (const b of state.buildings) consider('building', b.id, b.pos);
  for (const n of state.map.wildlifeNodes) if (n.amount > 0) consider('wildlife', n.id, n.pos);

  return best;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @game/client test pointer`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/config.ts packages/client/src/pointer.ts packages/client/src/pointer.test.ts
git commit -m "feat(client): add pointer constants and tap hit-testing"
```

---

### Task 3: Tap→intent resolution

**Files:**
- Modify: `packages/client/src/pointer.ts`
- Test: `packages/client/src/pointer.test.ts`

- [ ] **Step 1: Add failing tests** (append to `pointer.test.ts`)

```ts
import { resolveTapIntent } from './pointer';

test('monster tapping a wildlife node yields a feed intent', () => {
  const s = createInitialState(1);
  const node = s.map.wildlifeNodes[0];
  const intent = resolveTapIntent(s, s.monster.id, { ...node.pos }, 3.5);
  expect(intent).toEqual({ kind: 'feed', nodeId: node.id });
});

test('monster tapping a building yields an attack intent at its position', () => {
  const s = createInitialState(1);
  const core = s.buildings.find((b) => b.type === 'core')!;
  const intent = resolveTapIntent(s, s.monster.id, { ...core.pos }, 3.5);
  expect(intent).toEqual({ kind: 'attack', point: core.pos });
});

test('a hero tapping the monster yields an attack intent', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
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
  const intent = resolveTapIntent(s, hero.id, { ...ally.pos }, 3.5);
  expect(intent).toEqual({ kind: 'spectate', actorId: ally.id });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test pointer`
Expected: FAIL — `resolveTapIntent` is not exported.

- [ ] **Step 3: Implement** (append to `pointer.ts`)

```ts
export type TapIntent =
  | { kind: 'move'; point: Vec2 }
  | { kind: 'feed'; nodeId: EntityId }
  | { kind: 'attack'; point: Vec2 }
  | { kind: 'spectate'; actorId: EntityId };

// Maps a tapped world point to an intent, given who the player controls.
export function resolveTapIntent(
  state: GameState,
  controlledId: EntityId,
  world: Vec2,
  pickRadius: number,
): TapIntent {
  const controlled = findActor(state, controlledId);
  const spectating = !controlled || !controlled.alive;
  const pick = pickTarget(state, world, pickRadius);

  if (spectating) {
    if (pick && (pick.kind === 'hero' || pick.kind === 'monster')) {
      return { kind: 'spectate', actorId: pick.id };
    }
    return { kind: 'move', point: world };
  }

  const isMonster = controlledId === state.monster.id;
  if (pick) {
    if (isMonster && pick.kind === 'wildlife') return { kind: 'feed', nodeId: pick.id };
    if (isMonster && (pick.kind === 'building' || pick.kind === 'hero')) {
      return { kind: 'attack', point: pick.pos };
    }
    if (!isMonster && pick.kind === 'monster') return { kind: 'attack', point: pick.pos };
  }
  return { kind: 'move', point: world };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test pointer`
Expected: PASS (10 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/pointer.ts packages/client/src/pointer.test.ts
git commit -m "feat(client): add tap-to-intent resolution"
```

---

### Task 4: Pointer-control state → per-tick Input

**Files:**
- Modify: `packages/client/src/pointer.ts`
- Test: `packages/client/src/pointer.test.ts`

- [ ] **Step 1: Add failing tests** (append to `pointer.test.ts`)

```ts
import { applyIntent, controlToInput, moveTargetToInput, type PointerControl } from './pointer';
import { FEED_RANGE } from '@game/shared';

test('moveTargetToInput points toward the target, zero on arrival', () => {
  const a = moveTargetToInput(5, { x: 0, y: 0 }, { x: 10, y: 0 }, 0.6);
  expect(a).toEqual({ actorId: 5, move: { x: 10, y: 0 } });
  const b = moveTargetToInput(5, { x: 10, y: 0 }, { x: 10, y: 0 }, 0.6);
  expect(b.move).toEqual({ x: 0, y: 0 });
});

test('applyIntent sets a move target and clears feeding', () => {
  const c = applyIntent({ feedNodeId: 9 }, { kind: 'move', point: { x: 3, y: 4 } });
  expect(c).toEqual({ moveTarget: { x: 3, y: 4 } });
});

test('applyIntent for feed sets the feed node and clears move target', () => {
  const c = applyIntent({ moveTarget: { x: 1, y: 1 } }, { kind: 'feed', nodeId: 9 });
  expect(c).toEqual({ feedNodeId: 9 });
});

test('controlToInput walks toward a move target', () => {
  const s = createInitialState(1);
  const hero = s.heroes[0];
  const control: PointerControl = { moveTarget: { x: hero.pos.x + 20, y: hero.pos.y } };
  const input = controlToInput(s, hero.id, control, 0.6);
  expect(input.move.x).toBeGreaterThan(0);
  expect(input.action).toBeUndefined();
});

test('controlToInput feeds when in range of the feed node, else walks to it', () => {
  const s = createInitialState(1);
  const node = s.map.wildlifeNodes[0];
  // out of range -> walks
  s.monster.pos = { x: node.pos.x + FEED_RANGE + 5, y: node.pos.y };
  const walking = controlToInput(s, s.monster.id, { feedNodeId: node.id }, 0.6);
  expect(walking.action).toBeUndefined();
  expect(walking.move.x).toBeLessThan(0); // moves back toward the node
  // in range -> feeds
  s.monster.pos = { ...node.pos };
  const feeding = controlToInput(s, s.monster.id, { feedNodeId: node.id }, 0.6);
  expect(feeding.action).toBe('feed');
});

test('controlToInput with no control is a no-op', () => {
  const s = createInitialState(1);
  expect(controlToInput(s, s.heroes[0].id, {}, 0.6).move).toEqual({ x: 0, y: 0 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test pointer`
Expected: FAIL — `controlToInput`/`applyIntent`/`moveTargetToInput`/`PointerControl` not exported.

- [ ] **Step 3: Implement** (append to `pointer.ts`)

```ts
import { FEED_RANGE, type Input } from '@game/shared';

export interface PointerControl {
  moveTarget?: Vec2;
  feedNodeId?: EntityId;
}

export function moveTargetToInput(
  actorId: EntityId,
  from: Vec2,
  target: Vec2,
  arrivalEps: number,
): Input {
  if (distance(from, target) <= arrivalEps) return { actorId, move: { x: 0, y: 0 } };
  return { actorId, move: { x: target.x - from.x, y: target.y - from.y } };
}

// Folds a tap intent into the persistent pointer-control state.
export function applyIntent(control: PointerControl, intent: TapIntent): PointerControl {
  switch (intent.kind) {
    case 'move':
    case 'attack':
      return { moveTarget: { ...intent.point } };
    case 'feed':
      return { feedNodeId: intent.nodeId };
    case 'spectate':
      return control; // spectate is handled by the camera, not by movement
  }
}

// Produces the per-tick Input for the controlled actor from the pointer-control state.
export function controlToInput(
  state: GameState,
  controlledId: EntityId,
  control: PointerControl,
  arrivalEps: number,
): Input {
  const actor = findActor(state, controlledId);
  if (!actor) return { actorId: controlledId, move: { x: 0, y: 0 } };

  if (control.feedNodeId !== undefined) {
    const node = state.map.wildlifeNodes.find((n) => n.id === control.feedNodeId);
    if (node) {
      if (distance(actor.pos, node.pos) <= FEED_RANGE) {
        return { actorId: controlledId, move: { x: 0, y: 0 }, action: 'feed' };
      }
      return moveTargetToInput(controlledId, actor.pos, node.pos, arrivalEps);
    }
  }
  if (control.moveTarget) {
    return moveTargetToInput(controlledId, actor.pos, control.moveTarget, arrivalEps);
  }
  return { actorId: controlledId, move: { x: 0, y: 0 } };
}
```

(Merge the two `@game/shared` imports at the top of `pointer.ts` into one if your linter prefers; both importing from the same module is fine for TS.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test pointer`
Expected: PASS (16 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/pointer.ts packages/client/src/pointer.test.ts
git commit -m "feat(client): add pointer-control state and per-tick input"
```

---

### Task 5: Renderer — logical screen size, camera origin, Campfire label

**Files:**
- Modify: `packages/client/src/render/renderer.ts`

- [ ] **Step 1: Use logical (CSS-pixel) screen size**

In `render(...)`, replace:
```ts
    const screenW = this.app.renderer.width;
    const screenH = this.app.renderer.height;
```
with (so pointer math in CSS pixels matches the camera, independent of device pixel ratio):
```ts
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
```

- [ ] **Step 2: Store the camera origin and expose it**

Add a field near the other private fields:
```ts
  private lastOrigin: ScreenPoint = { x: 0, y: 0 };
```

In `render(...)`, right after `origin` is computed (the line `const origin: ScreenPoint = { ... };`), add:
```ts
    this.lastOrigin = origin;
```

Add a public accessor method to the class:
```ts
  cameraOrigin(): ScreenPoint {
    return this.lastOrigin;
  }
```

- [ ] **Step 3: Add a "Campfire" label on the core**

Add a field:
```ts
  private readonly campfireLabel: Text;
```

In the constructor, after the `banner` setup, add:
```ts
    this.campfireLabel = new Text({ text: 'Campfire', style: { fill: 0xffd24d, fontSize: 12 } });
    this.campfireLabel.anchor.set(0.5, 1);
    this.app.stage.addChild(this.campfireLabel);
```

In `render(...)`, after the buildings loop, add:
```ts
    const core = curr.buildings.find((b) => b.type === 'core');
    if (core) {
      const cp = project(core.pos);
      this.campfireLabel.position.set(cp.x, cp.y - 22);
      this.campfireLabel.visible = true;
    } else {
      this.campfireLabel.visible = false;
    }
```

- [ ] **Step 4: Type-check**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/render/renderer.ts
git commit -m "feat(client): renderer exposes camera origin, uses logical size, labels the Campfire"
```

---

### Task 6: Wire pointer input + DPR/viewport hardening

**Files:**
- Modify: `packages/client/src/main.ts`
- Modify: `packages/client/index.html`

- [ ] **Step 1: Harden the viewport** in `index.html`

Replace the viewport `<meta>` line with:
```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

In the `<style>` block, add to the `html, body` rule `overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none;` and add a new rule:
```css
      #app, #app canvas { touch-action: none; }
```
So the `html, body` rule becomes:
```css
      html, body { margin: 0; height: 100%; overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none; background: #11151c; font-family: system-ui, sans-serif; color: #e6edf3; }
```

- [ ] **Step 2: Update imports in `main.ts`**

Add:
```ts
import { TILE_H, TILE_W, COLORS, DEFAULT_BUILD, MOVE_ARRIVAL_EPS, PICK_RADIUS } from './config';
import { screenToWorld } from './render/iso';
import { applyIntent, controlToInput, resolveTapIntent, type PointerControl } from './pointer';
```
(Replace the existing `import { COLORS, DEFAULT_BUILD } from './config';` line with the combined import above. Keep all other existing imports.)

- [ ] **Step 3: Init PixiJS with device-pixel-ratio**

Replace:
```ts
  await app.init({ background: COLORS.background, resizeTo: window });
```
with:
```ts
  await app.init({
    background: COLORS.background,
    resizeTo: window,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
```

- [ ] **Step 4: Add pointer state and the tap handler**

After `let cameraTargetId = controlledId;` (added in Plan 5), add:
```ts
  let control: PointerControl = {};

  app.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = app.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = screenToWorld(screen, TILE_W, TILE_H, renderer.cameraOrigin());
    const intent = resolveTapIntent(curr, controlledId, world, PICK_RADIUS);
    if (intent.kind === 'spectate') {
      cameraTargetId = intent.actorId;
      renderer.setCameraTarget(cameraTargetId);
    } else {
      control = applyIntent(control, intent);
    }
  });
```

- [ ] **Step 5: Feed pointer control into the loop (keyboard overrides when used)**

Replace the controlled-input block inside the step loop:
```ts
      if (isActorAlive(curr, controlledId)) {
        inputs[controlledId] = inputFromKeys(controlledId, keyboard.state(), DEFAULT_BUILD);
      }
```
with:
```ts
      if (isActorAlive(curr, controlledId)) {
        const k = keyboard.state();
        const keyboardActive = k.up || k.down || k.left || k.right || k.feed || k.build;
        inputs[controlledId] = keyboardActive
          ? inputFromKeys(controlledId, k, DEFAULT_BUILD)
          : controlToInput(curr, controlledId, control, MOVE_ARRIVAL_EPS);
      }
```

- [ ] **Step 6: Type-check + production build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.
Run: `pnpm --filter @game/client build`
Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/main.ts packages/client/index.html
git commit -m "feat(client): pointer/tap controls, DPR rendering, viewport hardening"
```

---

### Task 7: Full sweep + run verification

- [ ] **Step 1: Full monorepo test sweep**

Run: `pnpm -r test`
Expected: PASS — shared 67; client 27 prior + iso (2 new) + pointer (16) = 45.

- [ ] **Step 2: Dev-server smoke check**

Start `pnpm --filter @game/client dev` in the background; fetch `http://localhost:5173/` and confirm HTTP 200 containing `Choose your side`; then stop the server.

- [ ] **Step 3: Manual playtest (human)**

On desktop: click ground to move, click a wildlife node as the monster to feed, click the monster as a hero to engage. On a phone: same with taps; confirm no pinch-zoom/scroll and crisp rendering. WASD still works on desktop.

---

## Self-Review

**Spec coverage (against `2026-06-13-mobile-controls-design.md`):**
- Tap empty ground → move (persistent target) → Tasks 3 (move intent), 4 (controlToInput). ✓
- Tap wildlife → feed (monster) → Tasks 3, 4. ✓
- Tap building/monster → engage → Task 3 (attack intent → move). ✓
- Spectate by tapping an actor → Tasks 3, 6. ✓
- Pointer-unified mouse + touch, WASD fallback → Task 6 (pointerdown works for both; keyboard override). ✓
- DPR crisp rendering + disabled zoom/scroll → Tasks 5 (logical size), 6 (init resolution, viewport/touch-action). ✓
- "Campfire" label on the core (type stays `core`) → Task 5. ✓
- Build menu is explicitly Plan 7 (not here). ✓

**Placeholder scan:** No TBD/TODO; every code step is complete. ✓

**Type consistency:** `screenToWorld(screen, tileW, tileH, origin)` (Task 1) called in Task 6. `pickTarget`/`findActor` (Task 2) used by `resolveTapIntent` (Task 3) and `controlToInput` (Task 4). `TapIntent`/`PointerControl` defined in Tasks 3–4 and consumed in Task 6. `GameRenderer.cameraOrigin()`/`setCameraTarget()` exist (Task 5 / Plan 5) and are called in Task 6. Config constants `PICK_RADIUS`, `MOVE_ARRIVAL_EPS`, `TILE_W`, `TILE_H` from `config.ts`. Reuses `@game/shared` exports `distance`, `FEED_RANGE`, `Input`, `Entity`, `EntityId`, `GameState`, `Vec2`. ✓
