# Playable Client Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the game on screen — a PixiJS browser client that renders `GameState`, lets you pick a side (monster or a hero role) and control it with the keyboard, running the deterministic sim from `@game/shared` at a fixed 20 Hz with smooth interpolated rendering.

**Architecture:** New `packages/client` (Vite + PixiJS). All decision logic lives in small **pure, unit-tested** modules — a fixed-timestep accumulator, isometric projection, position interpolation, keyboard→`Input` mapping, and side→actor selection. The PixiJS renderer, keyboard listeners, and bootstrap are thin **impure glue**, verified by a successful production build (`vite build`) and a dev-server smoke check rather than unit tests. Non-controlled actors emit no input this plan (they stand still); bot AI is Plan 4.

**Tech Stack:** TypeScript, Vite 5, PixiJS 8, Vitest. Depends on `@game/shared` via pnpm workspace.

**Builds on Plans 1–2:** consumes `createInitialState`, `step`, `GameState`, `Input`, `TICK_RATE`, `MAP_WIDTH/HEIGHT`, types — all already exported from `@game/shared`.

---

## Scope notes (deliberate deferrals)

- **Bots:** non-controlled actors send empty input (stand still) — Plan 4 makes them act. So this plan is "playable" in the sense of *render + control one actor + watch the sim resolve*; a real opponent comes next plan.
- **Build placement UI:** pressing the build key builds at the hero's current position with a fixed default building type (Tower). A richer build menu is deferred.
- **Art:** placeholder Pixi `Graphics` shapes + text HUD. No sprites/audio yet.

---

## File Structure

```
packages/client/
├─ package.json            # client pkg: pixi.js, vite, vitest, @game/shared
├─ tsconfig.json
├─ vite.config.ts
├─ vitest.config.ts
├─ index.html              # canvas mount + start-menu overlay
└─ src/
   ├─ main.ts              # IMPURE bootstrap: menu -> app -> loop (build-verified)
   ├─ config.ts            # client constants: TILE_W/H, colors, default build type
   ├─ loop.ts              # PURE fixed-timestep accumulator
   ├─ control.ts          # PURE keyboard->Input + side->actorId
   ├─ input/
   │  └─ keyboard.ts       # PURE applyKey() + IMPURE Keyboard listener class
   └─ render/
      ├─ iso.ts            # PURE world->screen isometric projection
      ├─ interpolate.ts    # PURE lerp / position interpolation
      └─ renderer.ts       # IMPURE PixiJS draw (build-verified)
```

Pure (unit-tested): `loop.ts`, `control.ts`, `input/keyboard.ts` (the `applyKey` fn), `render/iso.ts`, `render/interpolate.ts`.
Impure (build/run-verified): `main.ts`, `render/renderer.ts`, the `Keyboard` class in `input/keyboard.ts`.

---

### Task 1: Scaffold the client package

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/vitest.config.ts`
- Create: `packages/client/index.html`
- Create: `packages/client/src/config.ts`
- Create: `packages/client/src/main.ts` (temporary placeholder)
- Test: `packages/client/src/smoke.test.ts`

- [ ] **Step 1: Create package + config files**

`packages/client/package.json`:
```json
{
  "name": "@game/client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@game/shared": "workspace:*",
    "pixi.js": "^8.2.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

`packages/client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "baseUrl": ".",
    "paths": { "@game/shared": ["../shared/src/index.ts"] }
  },
  "include": ["src"]
}
```

`packages/client/vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
});
```

`packages/client/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node' },
});
```

`packages/client/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Monster City 1v4</title>
    <style>
      html, body { margin: 0; height: 100%; background: #11151c; font-family: system-ui, sans-serif; color: #e6edf3; }
      #app { position: fixed; inset: 0; }
      #menu {
        position: fixed; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px; background: #11151cdd; z-index: 10;
      }
      #menu h1 { font-size: 22px; }
      #menu button {
        font-size: 16px; padding: 10px 18px; cursor: pointer; border: 1px solid #2f81f7;
        background: #161b22; color: #e6edf3; border-radius: 8px; min-width: 220px;
      }
      #menu button:hover { background: #1f6feb33; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <div id="menu">
      <h1>Choose your side</h1>
      <button data-side="monster">Monster</button>
      <button data-side="builder">Hero — Builder</button>
      <button data-side="defender">Hero — Defender</button>
      <button data-side="scout">Hero — Scout</button>
      <button data-side="economy">Hero — Economy</button>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`packages/client/src/config.ts`:
```ts
// Isometric tile size (2:1) and placeholder palette.
export const TILE_W = 32;
export const TILE_H = 16;

export const COLORS = {
  background: 0x11151c,
  ground: 0x1b2430,
  grid: 0x263041,
  monster: 0xff4d4d,
  hero: 0x4da3ff,
  heroControlled: 0x7ee787,
  core: 0xffd24d,
  tower: 0xb392f0,
  generator: 0x39c5cf,
  workshop: 0xf0883e,
  wildlife: 0x57ab5a,
  resource: 0x2f81f7,
  hpBack: 0x30363d,
  hpFill: 0x3fb950,
} as const;

// Default structure built when the build key is pressed (richer menu deferred).
export const DEFAULT_BUILD = 'tower' as const;
```

`packages/client/src/main.ts` (temporary placeholder, replaced in Task 8):
```ts
// Placeholder bootstrap; replaced in Task 8.
export {};
```

- [ ] **Step 2: Add a smoke test**

`packages/client/src/smoke.test.ts`:
```ts
import { TILE_W } from './config';

test('client toolchain runs and config imports', () => {
  expect(TILE_W).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Install and run tests**

Run: `pnpm install`
Then run: `pnpm --filter @game/client test`
Expected: 1 passing test.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(client): scaffold Vite + PixiJS client package"
```

---

### Task 2: Fixed-timestep loop accumulator (pure)

**Files:**
- Create: `packages/client/src/loop.ts`
- Test: `packages/client/src/loop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { stepsToRun, renderAlpha, TICK_MS } from './loop';

test('TICK_MS matches 20 Hz', () => {
  expect(TICK_MS).toBe(50);
});

test('computes whole steps and leftover remainder', () => {
  expect(stepsToRun(120, 50)).toEqual({ steps: 2, remainderMs: 20 });
  expect(stepsToRun(49, 50)).toEqual({ steps: 0, remainderMs: 49 });
  expect(stepsToRun(100, 50)).toEqual({ steps: 2, remainderMs: 0 });
});

test('caps steps to avoid the spiral of death and drops surplus time', () => {
  expect(stepsToRun(10000, 50, 5)).toEqual({ steps: 5, remainderMs: 0 });
});

test('renderAlpha is the clamped fractional progress to the next tick', () => {
  expect(renderAlpha(20, 50)).toBeCloseTo(0.4);
  expect(renderAlpha(0, 50)).toBe(0);
  expect(renderAlpha(80, 50)).toBe(1); // clamped
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test loop`
Expected: FAIL — cannot find module `./loop`.

- [ ] **Step 3: Implement**

```ts
import { TICK_RATE } from '@game/shared';

export const TICK_MS = 1000 / TICK_RATE;

// How many fixed sim steps to run for the accumulated time, plus leftover.
// maxSteps caps work per frame so a long stall can't cause a spiral of death.
export function stepsToRun(
  accumulatorMs: number,
  tickMs: number,
  maxSteps = 5,
): { steps: number; remainderMs: number } {
  if (tickMs <= 0) return { steps: 0, remainderMs: accumulatorMs };
  let steps = Math.floor(accumulatorMs / tickMs);
  if (steps > maxSteps) return { steps: maxSteps, remainderMs: 0 };
  return { steps, remainderMs: accumulatorMs - steps * tickMs };
}

// Fractional progress (0..1) toward the next tick, for render interpolation.
export function renderAlpha(remainderMs: number, tickMs: number): number {
  if (tickMs <= 0) return 0;
  return Math.min(1, Math.max(0, remainderMs / tickMs));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test loop`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/loop.ts packages/client/src/loop.test.ts
git commit -m "feat(client): add fixed-timestep loop accumulator"
```

---

### Task 3: Isometric projection (pure)

**Files:**
- Create: `packages/client/src/render/iso.ts`
- Test: `packages/client/src/render/iso.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { worldToScreen } from './iso';

const origin = { x: 100, y: 50 };

test('world origin maps to the screen origin', () => {
  expect(worldToScreen({ x: 0, y: 0 }, 32, 16, origin)).toEqual({ x: 100, y: 50 });
});

test('+x goes down-right, +y goes down-left (2:1 iso)', () => {
  expect(worldToScreen({ x: 1, y: 0 }, 32, 16, origin)).toEqual({ x: 116, y: 58 });
  expect(worldToScreen({ x: 0, y: 1 }, 32, 16, origin)).toEqual({ x: 84, y: 58 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test iso`
Expected: FAIL — cannot find module `./iso`.

- [ ] **Step 3: Implement**

```ts
import type { Vec2 } from '@game/shared';

export interface ScreenPoint {
  x: number;
  y: number;
}

// 2:1 isometric projection. +x screen-southeast, +y screen-southwest.
export function worldToScreen(
  world: Vec2,
  tileW: number,
  tileH: number,
  origin: ScreenPoint,
): ScreenPoint {
  return {
    x: origin.x + (world.x - world.y) * (tileW / 2),
    y: origin.y + (world.x + world.y) * (tileH / 2),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test iso`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/render/iso.ts packages/client/src/render/iso.test.ts
git commit -m "feat(client): add isometric projection"
```

---

### Task 4: Position interpolation (pure)

**Files:**
- Create: `packages/client/src/render/interpolate.ts`
- Test: `packages/client/src/render/interpolate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { lerp, lerpVec } from './interpolate';

test('lerp blends two scalars', () => {
  expect(lerp(0, 10, 0)).toBe(0);
  expect(lerp(0, 10, 1)).toBe(10);
  expect(lerp(0, 10, 0.25)).toBe(2.5);
});

test('lerpVec blends two points', () => {
  expect(lerpVec({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test interpolate`
Expected: FAIL — cannot find module `./interpolate`.

- [ ] **Step 3: Implement**

```ts
import type { Vec2 } from '@game/shared';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test interpolate`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/render/interpolate.ts packages/client/src/render/interpolate.test.ts
git commit -m "feat(client): add position interpolation helpers"
```

---

### Task 5: Side selection + keyboard→Input mapping (pure)

**Files:**
- Create: `packages/client/src/control.ts`
- Test: `packages/client/src/control.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { actorIdForSide, inputFromKeys, type KeyMap, type Side } from './control';
import { createInitialState } from '@game/shared';

const noKeys: KeyMap = { up: false, down: false, left: false, right: false, feed: false, build: false };

test('actorIdForSide returns the monster id', () => {
  const s = createInitialState(1);
  expect(actorIdForSide(s, 'monster')).toBe(s.monster.id);
});

test('actorIdForSide returns the hero id for a role', () => {
  const s = createInitialState(1);
  const scout = s.heroes.find((h) => h.role === 'scout')!;
  expect(actorIdForSide(s, 'scout')).toBe(scout.id);
});

test('inputFromKeys maps direction keys to a move vector', () => {
  const input = inputFromKeys(7, { ...noKeys, left: true, up: true });
  expect(input).toEqual({ actorId: 7, move: { x: -1, y: -1 } });
});

test('opposing keys cancel out', () => {
  const input = inputFromKeys(7, { ...noKeys, left: true, right: true });
  expect(input.move).toEqual({ x: 0, y: 0 });
});

test('feed key sets the feed action', () => {
  const input = inputFromKeys(7, { ...noKeys, feed: true });
  expect(input.action).toBe('feed');
});

test('build key sets the build action and build type', () => {
  const input = inputFromKeys(7, { ...noKeys, build: true }, 'tower');
  expect(input.action).toBe('build');
  expect(input.buildType).toBe('tower');
});

test('feed takes priority over build when both are held', () => {
  const input = inputFromKeys(7, { ...noKeys, feed: true, build: true }, 'tower');
  expect(input.action).toBe('feed');
});

test('Side type accepts monster and roles', () => {
  const sides: Side[] = ['monster', 'builder', 'defender', 'scout', 'economy'];
  expect(sides).toHaveLength(5);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test control`
Expected: FAIL — cannot find module `./control`.

- [ ] **Step 3: Implement**

```ts
import type { BuildingType, EntityId, GameState, Input, RoleType } from '@game/shared';

export type Side = 'monster' | RoleType;

export interface KeyMap {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  feed: boolean;
  build: boolean;
}

// Maps the chosen side to the entity the player controls.
export function actorIdForSide(state: GameState, side: Side): EntityId | undefined {
  if (side === 'monster') return state.monster.id;
  return state.heroes.find((h) => h.role === side)?.id;
}

// Pure mapping from held keys to a sim Input. feed takes priority over build.
export function inputFromKeys(actorId: EntityId, keys: KeyMap, buildType?: BuildingType): Input {
  let x = 0;
  let y = 0;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) y -= 1;
  if (keys.down) y += 1;

  const input: Input = { actorId, move: { x, y } };
  if (keys.feed) {
    input.action = 'feed';
  } else if (keys.build) {
    input.action = 'build';
    if (buildType) input.buildType = buildType;
  }
  return input;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test control`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/control.ts packages/client/src/control.test.ts
git commit -m "feat(client): add side selection and keyboard input mapping"
```

---

### Task 6: Keyboard state (pure mapping + impure listener)

**Files:**
- Create: `packages/client/src/input/keyboard.ts`
- Test: `packages/client/src/input/keyboard.test.ts`

- [ ] **Step 1: Write the failing test** (tests only the pure `applyKey`)

```ts
import { applyKey, emptyKeyMap } from './keyboard';

test('emptyKeyMap is all false', () => {
  expect(emptyKeyMap()).toEqual({
    up: false, down: false, left: false, right: false, feed: false, build: false,
  });
});

test('WASD and arrows set direction flags', () => {
  let m = emptyKeyMap();
  m = applyKey(m, 'KeyW', true);
  m = applyKey(m, 'KeyA', true);
  expect(m.up).toBe(true);
  expect(m.left).toBe(true);
  m = applyKey(m, 'ArrowDown', true);
  m = applyKey(m, 'ArrowRight', true);
  expect(m.down).toBe(true);
  expect(m.right).toBe(true);
});

test('Space feeds and KeyB builds; release clears', () => {
  let m = emptyKeyMap();
  m = applyKey(m, 'Space', true);
  m = applyKey(m, 'KeyB', true);
  expect(m.feed).toBe(true);
  expect(m.build).toBe(true);
  m = applyKey(m, 'Space', false);
  expect(m.feed).toBe(false);
});

test('unknown keys are ignored and return an unchanged map', () => {
  const m = emptyKeyMap();
  expect(applyKey(m, 'KeyZ', true)).toEqual(m);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test keyboard`
Expected: FAIL — cannot find module `./keyboard`.

- [ ] **Step 3: Implement**

```ts
import type { KeyMap } from '../control';

export function emptyKeyMap(): KeyMap {
  return { up: false, down: false, left: false, right: false, feed: false, build: false };
}

// Maps a KeyboardEvent.code to a KeyMap field; returns a NEW map (pure).
export function applyKey(map: KeyMap, code: string, pressed: boolean): KeyMap {
  const field = CODE_TO_FIELD[code];
  if (!field) return map;
  return { ...map, [field]: pressed };
}

const CODE_TO_FIELD: Record<string, keyof KeyMap | undefined> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'feed',
  KeyB: 'build',
};

// IMPURE: attaches window listeners and tracks the live key map.
// Not unit-tested (DOM glue); covered by build + manual run.
export class Keyboard {
  private map: KeyMap = emptyKeyMap();
  private readonly onDown = (e: KeyboardEvent) => {
    if (e.code in CODE_TO_FIELD) e.preventDefault();
    this.map = applyKey(this.map, e.code, true);
  };
  private readonly onUp = (e: KeyboardEvent) => {
    this.map = applyKey(this.map, e.code, false);
  };

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.onDown);
    target.removeEventListener('keyup', this.onUp);
  }

  state(): KeyMap {
    return this.map;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test keyboard`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/input/keyboard.ts packages/client/src/input/keyboard.test.ts
git commit -m "feat(client): add keyboard state mapping and listener"
```

---

### Task 7: PixiJS renderer (impure — build-verified)

**Files:**
- Create: `packages/client/src/render/renderer.ts`

No unit test (pure draw glue). Verified by `tsc` + `vite build` in Task 9.

- [ ] **Step 1: Implement the renderer**

```ts
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Building, Entity, GameState, Vec2 } from '@game/shared';
import { COLORS, TILE_H, TILE_W } from '../config';
import { worldToScreen, type ScreenPoint } from './iso';
import { lerpVec } from './interpolate';

const BUILDING_COLOR: Record<Building['type'], number> = {
  core: COLORS.core,
  tower: COLORS.tower,
  generator: COLORS.generator,
  workshop: COLORS.workshop,
};

// Draws GameState each frame using immediate-mode Graphics. Few entities -> redraw is cheap.
export class GameRenderer {
  private readonly world = new Container();
  private readonly g = new Graphics();
  private readonly hud: Text;
  private readonly banner: Text;

  constructor(
    private readonly app: Application,
    private readonly controlledId: number,
  ) {
    this.world.addChild(this.g);
    this.app.stage.addChild(this.world);

    this.hud = new Text({ text: '', style: { fill: 0xe6edf3, fontSize: 14 } });
    this.hud.position.set(12, 12);
    this.app.stage.addChild(this.hud);

    this.banner = new Text({ text: '', style: { fill: 0xffffff, fontSize: 40, fontWeight: 'bold' } });
    this.banner.anchor.set(0.5);
    this.app.stage.addChild(this.banner);
  }

  // prev/curr are consecutive sim states; alpha is 0..1 progress between them.
  render(prev: GameState, curr: GameState, alpha: number): void {
    const g = this.g;
    g.clear();

    const screenW = this.app.renderer.width;
    const screenH = this.app.renderer.height;

    // Camera: center the controlled actor (use its interpolated position).
    const controlledPos = this.interpPos(prev, curr, this.controlledId, alpha) ?? curr.monster.pos;
    const camIso = worldToScreen(controlledPos, TILE_W, TILE_H, { x: 0, y: 0 });
    const origin: ScreenPoint = { x: screenW / 2 - camIso.x, y: screenH / 2 - camIso.y };

    const project = (p: Vec2) => worldToScreen(p, TILE_W, TILE_H, origin);

    // Ground diamond (map bounds corners).
    const c0 = project({ x: 0, y: 0 });
    const c1 = project({ x: curr.map.width, y: 0 });
    const c2 = project({ x: curr.map.width, y: curr.map.height });
    const c3 = project({ x: 0, y: curr.map.height });
    g.poly([c0.x, c0.y, c1.x, c1.y, c2.x, c2.y, c3.x, c3.y]).fill(COLORS.ground);

    // Resource + wildlife nodes.
    for (const n of curr.map.wildlifeNodes) this.dot(project(n.pos), 5, COLORS.wildlife);
    for (const n of curr.map.resourceNodes) this.dot(project(n.pos), 5, COLORS.resource);

    // Buildings.
    for (const b of curr.buildings) {
      const p = project(b.pos);
      const size = b.type === 'core' ? 16 : 11;
      g.rect(p.x - size / 2, p.y - size, size, size).fill(BUILDING_COLOR[b.type]);
      this.hpBar(p.x, p.y - size - 6, b.health.hp / b.health.maxHp);
    }

    // Heroes.
    for (const h of curr.heroes) {
      if (!h.alive) continue;
      const p = project(this.interpEntity(prev, curr, h, alpha));
      const color = h.id === this.controlledId ? COLORS.heroControlled : COLORS.hero;
      this.dot(p, 7, color);
      this.hpBar(p.x, p.y - 14, h.health.hp / h.health.maxHp);
    }

    // Monster.
    if (curr.monster.alive) {
      const p = project(this.interpEntity(prev, curr, curr.monster, alpha));
      const radius = 8 + (curr.monster.evolution?.stage ?? 1) * 2;
      this.dot(p, radius, COLORS.monster);
      this.hpBar(p.x, p.y - radius - 6, curr.monster.health.hp / curr.monster.health.maxHp);
    }

    // HUD.
    const m = curr.monster;
    this.hud.text =
      `materials: ${Math.floor(curr.resources.materials)}\n` +
      `monster: stage ${m.evolution?.stage ?? 1}  hp ${Math.ceil(m.health.hp)}/${m.health.maxHp}  xp ${Math.floor(m.evolution?.xp ?? 0)}\n` +
      `tick: ${curr.tick}`;

    // Banner on game end.
    this.banner.position.set(screenW / 2, screenH / 2);
    if (curr.phase === 'monsterWon') this.banner.text = 'MONSTER WINS';
    else if (curr.phase === 'buildersWon') this.banner.text = 'BUILDERS WIN';
    else this.banner.text = '';
  }

  private dot(p: ScreenPoint, r: number, color: number): void {
    this.g.circle(p.x, p.y, r).fill(color);
  }

  private hpBar(cx: number, top: number, frac: number): void {
    const w = 20;
    const clamped = Math.max(0, Math.min(1, frac));
    this.g.rect(cx - w / 2, top, w, 3).fill(COLORS.hpBack);
    this.g.rect(cx - w / 2, top, w * clamped, 3).fill(COLORS.hpFill);
  }

  private interpEntity(prev: GameState, curr: GameState, entity: Entity, alpha: number): Vec2 {
    return this.interpPos(prev, curr, entity.id, alpha) ?? entity.pos;
  }

  private interpPos(prev: GameState, curr: GameState, id: number, alpha: number): Vec2 | undefined {
    const cur = findEntity(curr, id);
    if (!cur) return undefined;
    const old = findEntity(prev, id);
    return old ? lerpVec(old.pos, cur.pos, alpha) : cur.pos;
  }
}

function findEntity(state: GameState, id: number): Entity | undefined {
  if (state.monster.id === id) return state.monster;
  return state.heroes.find((h) => h.id === id);
}
```

- [ ] **Step 2: Type-check (no test yet; renderer is verified in Task 9 build)**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors. (If PixiJS API differs in the installed version, fix calls to match — e.g., `Graphics` fill/poly/rect/circle chaining.)

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/render/renderer.ts
git commit -m "feat(client): add PixiJS renderer"
```

---

### Task 8: Bootstrap + start menu (impure — build/run-verified)

**Files:**
- Modify: `packages/client/src/main.ts`

- [ ] **Step 1: Implement the bootstrap**

Replace `packages/client/src/main.ts` with:
```ts
import { Application } from 'pixi.js';
import { createInitialState, step, type GameState, type InputMap } from '@game/shared';
import { COLORS, DEFAULT_BUILD } from './config';
import { TICK_MS, renderAlpha, stepsToRun } from './loop';
import { actorIdForSide, inputFromKeys, type Side } from './control';
import { Keyboard } from './input/keyboard';
import { GameRenderer } from './render/renderer';

async function startGame(side: Side): Promise<void> {
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'none';

  const app = new Application();
  await app.init({ background: COLORS.background, resizeTo: window });
  document.getElementById('app')!.appendChild(app.canvas);

  let prev: GameState = createInitialState(Date.now() % 1_000_000);
  let curr: GameState = prev;
  const controlledId = actorIdForSide(curr, side) ?? curr.monster.id;

  const keyboard = new Keyboard();
  keyboard.attach();

  const renderer = new GameRenderer(app, controlledId);

  let accumulatorMs = 0;
  let lastMs = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    accumulatorMs += now - lastMs;
    lastMs = now;

    const { steps, remainderMs } = stepsToRun(accumulatorMs, TICK_MS);
    accumulatorMs = remainderMs;

    for (let i = 0; i < steps; i++) {
      const inputs: InputMap = {};
      // Only the controlled actor sends input this plan; others stand still (bots = Plan 4).
      inputs[controlledId] = inputFromKeys(controlledId, keyboard.state(), DEFAULT_BUILD);
      prev = curr;
      curr = step(curr, inputs);
    }

    renderer.render(prev, curr, renderAlpha(accumulatorMs, TICK_MS));
  });
}

function wireMenu(): void {
  const menu = document.getElementById('menu');
  if (!menu) return;
  for (const btn of Array.from(menu.querySelectorAll<HTMLButtonElement>('button[data-side]'))) {
    btn.addEventListener('click', () => {
      void startGame(btn.dataset.side as Side);
    });
  }
}

wireMenu();
```

- [ ] **Step 2: Type-check**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/main.ts
git commit -m "feat(client): add bootstrap, game loop, and start menu"
```

---

### Task 9: Full build, test sweep, and run verification

**Files:**
- Delete: `packages/client/src/smoke.test.ts`

- [ ] **Step 1: Remove the redundant smoke test**

Delete `packages/client/src/smoke.test.ts` (real suites cover the toolchain now).

- [ ] **Step 2: Type-check and run the whole monorepo test suite**

Run: `pnpm -r test`
Expected: PASS — shared (53) + client (loop 4, iso 2, interpolate 2, control 8, keyboard 4 = 20) green.

- [ ] **Step 3: Production build (verifies the impure PixiJS/DOM code compiles & bundles)**

Run: `pnpm --filter @game/client build`
Expected: Vite reports a successful build with a `dist/` output and no errors. If PixiJS v8 API calls mismatch the installed version, fix them until the build is clean.

- [ ] **Step 4: Dev-server smoke check (verifies it serves)**

Start the dev server in the background: `pnpm --filter @game/client dev`
Then verify it responds: fetch `http://localhost:5173/` and confirm an HTTP 200 containing `Choose your side`. Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(client): remove smoke test; finalize playable client"
```

- [ ] **Step 6: Manual playtest (human)**

Tell the user: run `pnpm --filter @game/client dev`, open `http://localhost:5173`, pick a side, and drive with **WASD/arrows**, **Space** to feed (monster), **B** to build a tower (heroes). Note: other actors stand still until Plan 4 adds bots.

---

## Self-Review

**Spec coverage (against the design spec):**
- 2D isometric web rendering of the game world → Tasks 3, 7. ✓
- Fixed 20 Hz sim driven from `@game/shared`, smooth interpolated rendering → Tasks 2, 7, 8. ✓
- Both sides human-selectable at match start → Tasks 1 (menu), 5 (`actorIdForSide`), 8 (wiring). ✓
- Keyboard control incl. feed (monster) and build (heroes) → Tasks 5, 6, 8. ✓
- Single-player-first, sim unchanged (client imports the pure sim) → Task 8 imports `step`/`createInitialState`. ✓
- Bots deferred to Plan 4 (non-controlled actors idle) — noted in Scope notes + Task 8 comment. ✓

**Placeholder scan:** No "TBD/TODO/handle later" steps; every code step has complete code. Impure modules are explicitly build/run-verified rather than unit-tested — a deliberate strategy, not a gap. ✓

**Type consistency:** `KeyMap` defined in `control.ts` (Task 5) and consumed by `keyboard.ts` (Task 6) and `main.ts` (Task 8). `Side` defined in Task 5, used in Tasks 1/8. `worldToScreen`/`ScreenPoint` (Task 3) used by renderer (Task 7). `lerpVec` (Task 4) used by renderer (Task 7). `stepsToRun`/`renderAlpha`/`TICK_MS` (Task 2) used by `main.ts` (Task 8). `actorIdForSide`/`inputFromKeys` (Task 5) used by `main.ts` (Task 8). `GameRenderer.render(prev, curr, alpha)` signature matches its call in Task 8. All `@game/shared` imports (`createInitialState`, `step`, `GameState`, `InputMap`, `Input`, `Vec2`, `Entity`, `Building`, `EntityId`, `RoleType`, `BuildingType`, `TICK_RATE`) are exported by the shared barrel from Plans 1–2. ✓
