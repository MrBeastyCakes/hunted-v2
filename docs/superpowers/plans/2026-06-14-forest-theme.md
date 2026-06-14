# Forest Theme (client-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make it look like you're playing in a forest: greener ground, scattered trees/bushes/rocks (depth-sorted, walk among them), resource nodes drawn as choppable trees that shrink as harvested, and wildlife drawn as forest critters. Client-only; no sim changes. Then redeploy.

**Architecture:** A pure, seeded `generateForest` prop generator (unit-tested) + renderer draw additions/reskins. Forest palette in `config.ts`.

**Tech Stack:** TypeScript, Vitest, PixiJS 8.

---

### Task 1: Forest props generator + palette

**Files:** Create `packages/client/src/render/forest.ts`, `packages/client/src/render/forest.test.ts`; modify `packages/client/src/config.ts`

- [ ] **Step 1: Test** (`forest.test.ts`)

```ts
import { generateForest } from './forest';

test('generateForest is deterministic for a seed', () => {
  const a = generateForest(7, 100, 100, 40, { x: 50, y: 50, r: 18 });
  const b = generateForest(7, 100, 100, 40, { x: 50, y: 50, r: 18 });
  expect(a).toEqual(b);
});

test('props stay in bounds and avoid the excluded center', () => {
  const props = generateForest(3, 100, 100, 60, { x: 50, y: 50, r: 18 });
  expect(props.length).toBeGreaterThan(0);
  for (const p of props) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(100);
    expect(Math.hypot(p.x - 50, p.y - 50)).toBeGreaterThanOrEqual(18);
    expect(['tree', 'bush', 'rock']).toContain(p.kind);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test forest`
Expected: FAIL — cannot find module `./forest`.

- [ ] **Step 3: Implement** `forest.ts`

```ts
export interface ForestProp {
  x: number;
  y: number;
  kind: 'tree' | 'bush' | 'rock';
}

export interface Exclude {
  x: number;
  y: number;
  r: number;
}

// Deterministic scattered forest props, avoiding an excluded circle (the city).
export function generateForest(
  seed: number,
  width: number,
  height: number,
  count: number,
  exclude: Exclude,
): ForestProp[] {
  let s = seed >>> 0;
  const rnd = () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const props: ForestProp[] = [];
  let attempts = 0;
  while (props.length < count && attempts < count * 6) {
    attempts += 1;
    const x = rnd() * width;
    const y = rnd() * height;
    if (Math.hypot(x - exclude.x, y - exclude.y) < exclude.r) continue;
    const r = rnd();
    const kind: ForestProp['kind'] = r < 0.62 ? 'tree' : r < 0.85 ? 'bush' : 'rock';
    props.push({ x, y, kind });
  }
  return props;
}
```

- [ ] **Step 4: Forest palette** — in `config.ts` `COLORS`, change the two ground shades and add
woodland colors:
```ts
  ground: 0x2c3a24,
  ground2: 0x253017,
```
and add (anywhere in `COLORS`):
```ts
  trunk: 0x5b3f27,
  leafDark: 0x2f5a2c,
  leafLight: 0x4a7c3a,
  rock: 0x6b7280,
  critter: 0xb08d57,
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @game/client test forest`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/render/forest.ts packages/client/src/render/forest.test.ts packages/client/src/config.ts
git commit -m "feat(client): forest prop generator + woodland palette"
```

---

### Task 2: Renderer — forest props, tree resources, critters

**Files:** `packages/client/src/render/renderer.ts`

- [ ] **Step 1: Imports + forest field**

Add imports:
```ts
import { RESOURCE_NODE_AMOUNT } from '@game/shared';
import { generateForest, type ForestProp } from './forest';
```
Add a field and initialize it in the constructor (after `this.cameraTargetId = controlledId;`):
```ts
  private readonly forest: ForestProp[];
```
```ts
    this.forest = generateForest(1337, 100, 100, 70, { x: 50, y: 50, r: 18 });
```
(Map is 100×100; the city sits near the center, so exclude a radius around it.)

- [ ] **Step 2: Add forest props to the depth-sorted drawables**

In `render(...)`, where drawables are collected (before the heroes/monster), add:
```ts
    for (const prop of this.forest) {
      drawables.push({ x: prop.x, y: prop.y, render: (p) => this.drawProp(p, prop.kind) });
    }
```

- [ ] **Step 3: Reskin resources as trees** — replace `drawResource`:
```ts
  private drawResource(p: ScreenPoint, amount: number): void {
    if (amount <= 0) return;
    const scale = 0.6 + 0.6 * Math.min(1, amount / RESOURCE_NODE_AMOUNT);
    this.drawTree(p, scale, true);
  }
```

- [ ] **Step 4: Reskin wildlife as critters** — in `drawMob`, replace the wildlife branch (`else`
block) with a little deer-ish critter:
```ts
    } else {
      const c = mob.state === 'fleeing' ? COLORS.mobFlee : COLORS.critter;
      this.g.ellipse(p.x, p.y - 3, 4, 2.3).fill(c); // body
      this.g.circle(p.x + 3.5, p.y - 5, 1.6).fill(c); // head
      this.g.poly([p.x + 3.5, p.y - 6.5, p.x + 2.8, p.y - 8.5, p.x + 4.2, p.y - 8.5]).fill(c); // ear/antler
    }
```

- [ ] **Step 5: Add prop draw helpers** — add these methods to the class:
```ts
  private drawProp(p: ScreenPoint, kind: ForestProp['kind']): void {
    if (kind === 'tree') this.drawTree(p, 1, false);
    else if (kind === 'bush') this.drawBush(p);
    else this.drawRock(p);
  }

  private drawTree(p: ScreenPoint, scale: number, harvestable: boolean): void {
    this.shadow(p, 6 * scale);
    const th = 10 * scale;
    this.g.rect(p.x - 1.5 * scale, p.y - th, 3 * scale, th).fill(COLORS.trunk);
    const top = p.y - th;
    const r = 8 * scale;
    this.g.circle(p.x, top - r * 0.4, r).fill(harvestable ? COLORS.leafLight : COLORS.leafDark);
    this.g.circle(p.x - r * 0.6, top + r * 0.2, r * 0.7).fill(COLORS.leafDark);
    this.g.circle(p.x + r * 0.6, top + r * 0.2, r * 0.7).fill(COLORS.leafLight);
  }

  private drawBush(p: ScreenPoint): void {
    this.shadow(p, 5);
    this.g.circle(p.x, p.y - 3, 4).fill(COLORS.leafDark);
    this.g.circle(p.x - 3, p.y - 2, 3).fill(COLORS.leafLight);
    this.g.circle(p.x + 3, p.y - 2, 3).fill(COLORS.leafDark);
  }

  private drawRock(p: ScreenPoint): void {
    this.shadow(p, 5);
    this.g.ellipse(p.x, p.y - 2, 5, 3).fill(COLORS.rock);
    this.g.ellipse(p.x - 1, p.y - 3, 2.5, 1.6).fill(0x8b929c);
  }
```

- [ ] **Step 6: Type-check + build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/render/renderer.ts
git commit -m "feat(client): forest props, tree resources, forest critters"
```

---

### Task 3: Sweep, serve, deploy

- [ ] **Step 1: Full sweep**

Run: `pnpm -r test`
Expected: PASS.

- [ ] **Step 2: Serve smoke**

Start `pnpm --filter @game/client dev`; fetch `http://localhost:5173/` (HTTP 200, `Choose your side`); stop.

- [ ] **Step 3: Merge + deploy**

Merge `feat/forest-theme` to `master`, delete branch, `git push origin master`; watch the Pages
workflow to success; confirm the live URL serves.

- [ ] **Step 4: Manual playtest (human)**

Open it: a green forest floor scattered with trees/bushes/rocks you move among, resource nodes are
trees that shrink as heroes log them, and wildlife are little critters roaming the woods.

---

## Self-Review

**Coverage:** forest ground (Task 1) ✓; scattered depth-sorted props (Task 2) ✓; resources as
shrinking trees (Task 2) ✓; wildlife critters (Task 2) ✓; deterministic props tested (Task 1) ✓;
client-only (no sim changes) ✓; deploy (Task 3) ✓.

**Placeholder scan:** complete code; no TBD. ✓

**Type consistency:** `generateForest`/`ForestProp` (Task 1) used by renderer (Task 2). `RESOURCE_NODE_AMOUNT`
imported from `@game/shared` for the tree-shrink ratio. New `COLORS` keys (trunk/leafDark/leafLight/
rock/critter) used in the draw helpers. Pixi v8 `circle/ellipse/rect/poly().fill()` as used elsewhere. ✓
