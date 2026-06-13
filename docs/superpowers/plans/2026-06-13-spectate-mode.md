# Hero Spectate Mode Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** When the player's hero is killed (permadeath — no respawn), the player enters spectate mode: the camera follows a living ally, and a key cycles to the next living actor (allies, then the monster).

**Architecture:** Pure, unit-tested spectate helpers in the client (`spectate.ts`); the PixiJS renderer gains a settable camera target + a spectate HUD line; `main.ts` detects death, suppresses input for the dead hero, and handles the cycle key. The sim already models permadeath (`alive: false`) — no sim/shared changes.

**Tech Stack:** TypeScript, Vitest, PixiJS (client only).

---

### Task 1: Pure spectate helpers

**Files:**
- Create: `packages/client/src/spectate.ts`
- Test: `packages/client/src/spectate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { spectatableIds, nextSpectateTarget, isActorAlive } from './spectate';
import { createInitialState } from '@game/shared';

test('spectatableIds lists living heroes (excluding the dead self) then the monster', () => {
  const s = createInitialState(1);
  const dead = s.heroes[0];
  dead.alive = false;
  const ids = spectatableIds(s, dead.id);
  const livingHeroIds = s.heroes.filter((h) => h.alive && h.id !== dead.id).map((h) => h.id);
  expect(ids).toEqual([...livingHeroIds, s.monster.id]);
});

test('spectatableIds omits the monster when it is dead', () => {
  const s = createInitialState(1);
  s.monster.alive = false;
  const ids = spectatableIds(s, s.heroes[0].id);
  expect(ids).not.toContain(s.monster.id);
});

test('nextSpectateTarget starts at the first option when none is set', () => {
  expect(nextSpectateTarget(undefined, [3, 5, 7])).toBe(3);
});

test('nextSpectateTarget cycles and wraps around', () => {
  expect(nextSpectateTarget(3, [3, 5, 7])).toBe(5);
  expect(nextSpectateTarget(7, [3, 5, 7])).toBe(3);
});

test('nextSpectateTarget resets to first when current is no longer an option', () => {
  expect(nextSpectateTarget(99, [3, 5, 7])).toBe(3);
});

test('nextSpectateTarget returns undefined when there is nothing to watch', () => {
  expect(nextSpectateTarget(3, [])).toBeUndefined();
});

test('isActorAlive reflects the entity alive flag', () => {
  const s = createInitialState(1);
  expect(isActorAlive(s, s.monster.id)).toBe(true);
  s.heroes[0].alive = false;
  expect(isActorAlive(s, s.heroes[0].id)).toBe(false);
  expect(isActorAlive(s, 999999)).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test spectate`
Expected: FAIL — cannot find module `./spectate`.

- [ ] **Step 3: Implement**

```ts
import type { EntityId, GameState } from '@game/shared';

// Living actors the player may watch: living heroes (minus the dead self), then the monster.
export function spectatableIds(state: GameState, deadActorId: EntityId): EntityId[] {
  const ids: EntityId[] = [];
  for (const h of state.heroes) {
    if (h.alive && h.id !== deadActorId) ids.push(h.id);
  }
  if (state.monster.alive) ids.push(state.monster.id);
  return ids;
}

// The next id to watch when cycling; wraps around. undefined if nothing to watch.
export function nextSpectateTarget(
  current: EntityId | undefined,
  options: EntityId[],
): EntityId | undefined {
  if (options.length === 0) return undefined;
  if (current === undefined) return options[0];
  const i = options.indexOf(current);
  if (i === -1) return options[0];
  return options[(i + 1) % options.length];
}

export function isActorAlive(state: GameState, id: EntityId): boolean {
  if (state.monster.id === id) return state.monster.alive;
  const hero = state.heroes.find((h) => h.id === id);
  return hero?.alive ?? false;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test spectate`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/spectate.ts packages/client/src/spectate.test.ts
git commit -m "feat(client): add pure spectate helpers"
```

---

### Task 2: Renderer — settable camera target + spectate HUD

**Files:**
- Modify: `packages/client/src/render/renderer.ts`

The renderer currently centers on a fixed `controlledId`. Decouple the camera target from the highlighted-hero id, add a setter, and show a spectate line when the player's hero is dead.

- [ ] **Step 1: Add a settable camera target**

In `GameRenderer`, after the constructor's existing field assignments, the constructor already stores `controlledId`. Add a mutable camera target field initialized to it. Replace the constructor signature/body's start so the class has:
```ts
  private cameraTargetId: number;

  constructor(
    private readonly app: Application,
    private readonly controlledId: number,
  ) {
    this.cameraTargetId = controlledId;
    this.world.addChild(this.g);
    this.app.stage.addChild(this.world);
```
(Leave the rest of the constructor — the `hud` and `banner` setup — unchanged.)

Add a setter method to the class:
```ts
  setCameraTarget(id: number): void {
    this.cameraTargetId = id;
  }
```

- [ ] **Step 2: Use the camera target for the camera and add a spectate HUD line**

In `render(...)`, replace the camera line:
```ts
    const controlledPos = this.interpPos(prev, curr, this.controlledId, alpha) ?? curr.monster.pos;
```
with:
```ts
    const controlledPos = this.interpPos(prev, curr, this.cameraTargetId, alpha) ?? curr.monster.pos;
```

Then, where the HUD text is assigned, append a spectate indicator. Replace the HUD assignment block:
```ts
    this.hud.text =
      `materials: ${Math.floor(curr.resources.materials)}\n` +
      `monster: stage ${m.evolution?.stage ?? 1}  hp ${Math.ceil(m.health.hp)}/${m.health.maxHp}  xp ${Math.floor(m.evolution?.xp ?? 0)}\n` +
      `tick: ${curr.tick}`;
```
with:
```ts
    const me = findEntity(curr, this.controlledId);
    const spectating = me ? !me.alive : false;
    this.hud.text =
      `materials: ${Math.floor(curr.resources.materials)}\n` +
      `monster: stage ${m.evolution?.stage ?? 1}  hp ${Math.ceil(m.health.hp)}/${m.health.maxHp}  xp ${Math.floor(m.evolution?.xp ?? 0)}\n` +
      `tick: ${curr.tick}` +
      (spectating ? `\nSPECTATING — Tab/Space to cycle` : '');
```

- [ ] **Step 3: Type-check**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/render/renderer.ts
git commit -m "feat(client): renderer supports a settable camera target and spectate HUD"
```

---

### Task 3: Wire spectate into the bootstrap

**Files:**
- Modify: `packages/client/src/main.ts`

- [ ] **Step 1: Import the spectate helpers**

Add near the other imports:
```ts
import { isActorAlive, nextSpectateTarget, spectatableIds } from './spectate';
```

- [ ] **Step 2: Add spectate state and the cycle key, and suppress dead-hero input**

After `const renderer = new GameRenderer(app, controlledId);` add:
```ts
  let spectating = false;
  let cameraTargetId = controlledId;

  // Edge-triggered cycle key, active only while spectating.
  window.addEventListener('keydown', (e) => {
    if (!spectating) return;
    if (e.code !== 'Tab' && e.code !== 'Space') return;
    e.preventDefault();
    cameraTargetId = nextSpectateTarget(cameraTargetId, spectatableIds(curr, controlledId)) ?? cameraTargetId;
    renderer.setCameraTarget(cameraTargetId);
  });
```

In the `for (let i = 0; i < steps; i++)` loop, replace the line that always sends the controlled input:
```ts
      inputs[controlledId] = inputFromKeys(controlledId, keyboard.state(), DEFAULT_BUILD);
```
with (only drive the controlled actor while it is alive):
```ts
      if (isActorAlive(curr, controlledId)) {
        inputs[controlledId] = inputFromKeys(controlledId, keyboard.state(), DEFAULT_BUILD);
      }
```

- [ ] **Step 3: Handle the death transition and auto-advance, after the step loop**

Immediately after the `for` loop (before `renderer.render(...)`), add:
```ts
    if (!isActorAlive(curr, controlledId)) {
      const options = spectatableIds(curr, controlledId);
      if (!spectating) {
        spectating = true;
        cameraTargetId = nextSpectateTarget(undefined, options) ?? cameraTargetId;
        renderer.setCameraTarget(cameraTargetId);
      } else if (!isActorAlive(curr, cameraTargetId)) {
        // The actor we were watching died; advance to the next living one.
        cameraTargetId = nextSpectateTarget(undefined, options) ?? cameraTargetId;
        renderer.setCameraTarget(cameraTargetId);
      }
    }
```

- [ ] **Step 4: Type-check**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/main.ts
git commit -m "feat(client): enter spectate mode when the player's hero dies"
```

---

### Task 4: Full sweep + build verification

- [ ] **Step 1: Full monorepo test sweep**

Run: `pnpm -r test`
Expected: PASS — shared 67; client 27 (prior 20 + spectate 7).

- [ ] **Step 2: Production build**

Run: `pnpm --filter @game/client build`
Expected: clean successful build.

- [ ] **Step 3: Commit (if any incidental changes)** — otherwise nothing to do.

- [ ] **Step 4: Manual playtest (human)**

Play a hero, let the monster kill you (e.g. pick the scout and wander into the monster), and confirm: HUD shows "SPECTATING", camera follows a living ally, Tab/Space cycles through living allies and then the monster.

---

## Self-Review

**Coverage:** No-respawn is already enforced by the sim (`alive:false`); spectate is purely client. Camera-follow-living-allies + cycle key → Tasks 1–3. HUD indicator → Task 2. Dead hero no longer controllable → Task 3 input suppression. ✓

**Placeholder scan:** Every step has concrete code/edits. ✓

**Type consistency:** `spectatableIds(state, deadId)`, `nextSpectateTarget(current, options)`, `isActorAlive(state, id)` defined in Task 1 and used identically in Task 3. `GameRenderer.setCameraTarget(id)` added in Task 2 and called in Task 3. `findEntity` already exists in `renderer.ts` (Plan 3) and is reused in Task 2's HUD block. ✓
