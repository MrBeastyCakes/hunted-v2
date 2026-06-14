# Visual Overhaul: Iso Terrain & Real Shapes (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make it look like a game: a tiled isometric ground, depth-sorted entities drawn as real shapes (a growing monster, heroes with facing + equipped ring, iso building boxes, critters/villagers, weapon/resource markers) with soft shadows. Code-drawn (PixiJS), no assets. Renderer-only.

**Architecture:** Pure geometry helpers in `render/shapes.ts` (unit-tested); the draw code in `renderer.ts` is build/run-verified. No sim changes.

**Tech Stack:** TypeScript, Vitest, PixiJS 8, Vite.

---

### Task 1: Pure geometry helpers + ground color

**Files:** Create `packages/client/src/render/shapes.ts`, `packages/client/src/render/shapes.test.ts`; modify `packages/client/src/config.ts`

- [ ] **Step 1: Test** (`shapes.test.ts`)

```ts
import { depthKey, diamondPoints, isoBoxFaces } from './shapes';

test('depthKey sorts by x+y', () => {
  expect(depthKey(2, 3)).toBe(5);
  expect(depthKey(0, 0)).toBe(0);
});

test('diamondPoints returns top,right,bottom,left as a flat array', () => {
  expect(diamondPoints(10, 20, 4, 2)).toEqual([10, 18, 14, 20, 10, 22, 6, 20]);
});

test('isoBoxFaces top is the base diamond raised by height', () => {
  const f = isoBoxFaces(0, 0, 4, 2, 10);
  // top diamond points all shifted up by 10 vs a base diamond at y=0
  expect(f.top).toEqual([0, -12, 4, -10, 0, -8, -4, -10]);
  expect(f.left.length).toBe(8);
  expect(f.right.length).toBe(8);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test shapes`
Expected: FAIL — cannot find module `./shapes`.

- [ ] **Step 3: Implement** `shapes.ts`

```ts
// Pure isometric drawing geometry (screen-space).

export function depthKey(x: number, y: number): number {
  return x + y;
}

// A diamond (rotated square) as a flat [x,y,...] array: top, right, bottom, left.
export function diamondPoints(cx: number, cy: number, hw: number, hh: number): number[] {
  return [cx, cy - hh, cx + hw, cy, cx, cy + hh, cx - hw, cy];
}

export interface IsoBoxFaces {
  top: number[];
  left: number[];
  right: number[];
}

// An isometric box: a top diamond raised by `height`, plus the two camera-facing side faces.
export function isoBoxFaces(cx: number, cy: number, hw: number, hh: number, height: number): IsoBoxFaces {
  const top = [cx, cy - hh - height, cx + hw, cy - height, cx, cy + hh - height, cx - hw, cy - height];
  const left = [cx - hw, cy, cx, cy + hh, cx, cy + hh - height, cx - hw, cy - height];
  const right = [cx + hw, cy, cx, cy + hh, cx, cy + hh - height, cx + hw, cy - height];
  return { top, left, right };
}
```

- [ ] **Step 4: Add a second ground shade** to `config.ts` `COLORS`:
```ts
  ground2: 0x202b22,
```
(Keep the existing `ground`.)

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @game/client test shapes`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/render/shapes.ts packages/client/src/render/shapes.test.ts packages/client/src/config.ts
git commit -m "feat(client): add iso geometry helpers and a second ground shade"
```

---

### Task 2: Renderer overhaul

**Files:** Replace `packages/client/src/render/renderer.ts`

- [ ] **Step 1: Replace `renderer.ts`** with the full new renderer:

```ts
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Building, Entity, GameState, Mob, Vec2, WeaponType } from '@game/shared';
import { COLORS, TILE_H, TILE_W } from '../config';
import { worldToScreen, type ScreenPoint } from './iso';
import { lerpVec } from './interpolate';
import { isoBoxFaces } from './shapes';

const GROUND_STEP = 10;

const BUILDING_STYLE: Record<Building['type'], { hw: number; hh: number; h: number; color: number }> = {
  core: { hw: 16, hh: 8, h: 20, color: COLORS.core },
  tower: { hw: 9, hh: 4.5, h: 24, color: COLORS.tower },
  generator: { hw: 11, hh: 5.5, h: 12, color: COLORS.generator },
  workshop: { hw: 11, hh: 5.5, h: 14, color: COLORS.workshop },
  blacksmith: { hw: 12, hh: 6, h: 16, color: COLORS.blacksmith },
};

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

interface Drawable {
  x: number;
  y: number;
  render: (p: ScreenPoint) => void;
}

export class GameRenderer {
  private readonly world = new Container();
  private readonly g = new Graphics();
  private readonly hud: Text;
  private readonly banner: Text;
  private readonly campfireLabel: Text;
  private cameraTargetId: number;
  private lastOrigin: ScreenPoint = { x: 0, y: 0 };
  private ghost?: { pos: Vec2; type: Building['type'] };

  constructor(
    private readonly app: Application,
    private readonly controlledId: number,
  ) {
    this.cameraTargetId = controlledId;
    this.world.addChild(this.g);
    this.app.stage.addChild(this.world);

    this.hud = new Text({ text: '', style: { fill: 0xe6edf3, fontSize: 14 } });
    this.hud.position.set(12, 12);
    this.app.stage.addChild(this.hud);

    this.banner = new Text({ text: '', style: { fill: 0xffffff, fontSize: 40, fontWeight: 'bold' } });
    this.banner.anchor.set(0.5);
    this.app.stage.addChild(this.banner);

    this.campfireLabel = new Text({ text: 'Campfire', style: { fill: 0xffd24d, fontSize: 12 } });
    this.campfireLabel.anchor.set(0.5, 1);
    this.app.stage.addChild(this.campfireLabel);
  }

  setCameraTarget(id: number): void {
    this.cameraTargetId = id;
  }

  cameraOrigin(): ScreenPoint {
    return this.lastOrigin;
  }

  setGhost(pos: Vec2 | undefined, type?: Building['type']): void {
    this.ghost = pos && type ? { pos, type } : undefined;
  }

  render(prev: GameState, curr: GameState, alpha: number): void {
    const g = this.g;
    g.clear();

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    const camPos = this.interpPos(prev, curr, this.cameraTargetId, alpha) ?? curr.monster.pos;
    const camIso = worldToScreen(camPos, TILE_W, TILE_H, { x: 0, y: 0 });
    const origin: ScreenPoint = { x: screenW / 2 - camIso.x, y: screenH / 2 - camIso.y };
    this.lastOrigin = origin;
    const project = (p: Vec2) => worldToScreen(p, TILE_W, TILE_H, origin);

    // Isometric tiled ground (checkerboard).
    const W = curr.map.width;
    const H = curr.map.height;
    for (let i = 0; i * GROUND_STEP < W; i++) {
      for (let j = 0; j * GROUND_STEP < H; j++) {
        const a = project({ x: i * GROUND_STEP, y: j * GROUND_STEP });
        const b = project({ x: (i + 1) * GROUND_STEP, y: j * GROUND_STEP });
        const c = project({ x: (i + 1) * GROUND_STEP, y: (j + 1) * GROUND_STEP });
        const d = project({ x: i * GROUND_STEP, y: (j + 1) * GROUND_STEP });
        const color = (i + j) % 2 === 0 ? COLORS.ground : COLORS.ground2;
        g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]).fill(color);
      }
    }

    // Collect depth-sorted drawables.
    const drawables: Drawable[] = [];
    for (const n of curr.map.resourceNodes) {
      drawables.push({ x: n.pos.x, y: n.pos.y, render: (p) => this.drawResource(p, n.amount) });
    }
    for (const b of curr.buildings) {
      drawables.push({ x: b.pos.x, y: b.pos.y, render: (p) => this.drawBuilding(p, b) });
    }
    for (const mob of curr.map.mobs) {
      drawables.push({ x: mob.pos.x, y: mob.pos.y, render: (p) => this.drawMob(p, mob) });
    }
    for (const w of curr.map.weapons) {
      drawables.push({ x: w.pos.x, y: w.pos.y, render: (p) => this.drawWeapon(p, w.type) });
    }
    for (const h of curr.heroes) {
      if (!h.alive) continue;
      const pos = this.interpEntity(prev, curr, h, alpha);
      const facing = this.facing(prev, curr, h.id);
      drawables.push({ x: pos.x, y: pos.y, render: (p) => this.drawHero(p, h, facing) });
    }
    if (curr.monster.alive) {
      const pos = this.interpEntity(prev, curr, curr.monster, alpha);
      drawables.push({ x: pos.x, y: pos.y, render: (p) => this.drawMonster(p, curr.monster) });
    }

    drawables.sort((p, q) => p.x + p.y - (q.x + q.y));
    for (const d of drawables) d.render(project({ x: d.x, y: d.y }));

    // Build ghost (translucent top diamond).
    if (this.ghost) {
      const gp = project(this.ghost.pos);
      const st = BUILDING_STYLE[this.ghost.type];
      const f = isoBoxFaces(gp.x, gp.y, st.hw, st.hh, st.h);
      g.poly(f.top).fill({ color: st.color, alpha: 0.4 });
    }

    // Campfire label.
    const core = curr.buildings.find((b) => b.type === 'core');
    if (core) {
      const cp = project(core.pos);
      this.campfireLabel.position.set(cp.x, cp.y - BUILDING_STYLE.core.h - 8);
      this.campfireLabel.visible = true;
    } else {
      this.campfireLabel.visible = false;
    }

    // HUD + banner.
    const m = curr.monster;
    const me = findEntity(curr, this.controlledId);
    const spectating = me ? !me.alive : false;
    this.hud.text =
      `materials: ${Math.floor(curr.resources.materials)}\n` +
      `monster: L${m.evolution?.stage ?? 1}/5  hp ${Math.ceil(m.health.hp)}/${m.health.maxHp}  xp ${Math.floor(m.evolution?.xp ?? 0)}\n` +
      `tick: ${curr.tick}` +
      (spectating ? `\nSPECTATING — Tab/Space to cycle` : '');

    this.banner.position.set(screenW / 2, screenH / 2);
    if (curr.phase === 'monsterWon') this.banner.text = 'MONSTER WINS';
    else if (curr.phase === 'buildersWon') this.banner.text = 'BUILDERS WIN';
    else this.banner.text = '';
  }

  private shadow(p: ScreenPoint, rw: number): void {
    this.g.ellipse(p.x, p.y, rw, rw * 0.5).fill({ color: 0x000000, alpha: 0.25 });
  }

  private hpBar(cx: number, top: number, frac: number): void {
    const w = 20;
    const c = Math.max(0, Math.min(1, frac));
    this.g.rect(cx - w / 2, top, w, 3).fill(COLORS.hpBack);
    this.g.rect(cx - w / 2, top, w * c, 3).fill(COLORS.hpFill);
  }

  private drawBuilding(p: ScreenPoint, b: Building): void {
    const st = BUILDING_STYLE[b.type];
    this.shadow(p, st.hw);
    const f = isoBoxFaces(p.x, p.y, st.hw, st.hh, st.h);
    this.g.poly(f.left).fill(shade(st.color, 0.6));
    this.g.poly(f.right).fill(shade(st.color, 0.8));
    this.g.poly(f.top).fill(st.color).stroke({ color: shade(st.color, 0.5), width: 1 });
    this.hpBar(p.x, p.y - st.h - st.hh - 6, b.health.hp / b.health.maxHp);
  }

  private drawMonster(p: ScreenPoint, m: Entity): void {
    const stage = m.evolution?.stage ?? 1;
    const r = 9 + stage * 2.5;
    this.shadow(p, r);
    const n = 8;
    const spikes: number[] = [];
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2;
      const rr = k % 2 === 0 ? r + 4 : r;
      spikes.push(p.x + Math.cos(ang) * rr, p.y - r * 0.6 + Math.sin(ang) * rr * 0.7);
    }
    this.g.poly(spikes).fill(COLORS.monster).stroke({ color: 0x7a1010, width: 1.5 });
    this.g.circle(p.x - r * 0.35, p.y - r * 0.7, 2).fill(0xffffff);
    this.g.circle(p.x + r * 0.35, p.y - r * 0.7, 2).fill(0xffffff);
    this.hpBar(p.x, p.y - r - 12, m.health.hp / m.health.maxHp);
  }

  private drawHero(p: ScreenPoint, h: Entity, facing: Vec2): void {
    this.shadow(p, 6);
    const color = h.id === this.controlledId ? COLORS.heroControlled : COLORS.hero;
    this.g.circle(p.x, p.y - 7, 6).fill(color).stroke({ color: 0x0d1117, width: 1 });
    const len = Math.hypot(facing.x, facing.y);
    if (len > 0) {
      const fx = facing.x / len;
      const fy = facing.y / len;
      const tipx = p.x + fx * 9;
      const tipy = p.y - 7 + fy * 4.5;
      this.g
        .poly([tipx, tipy, p.x - fy * 3, p.y - 7 + fx * 1.5, p.x + fy * 3, p.y - 7 - fx * 1.5])
        .fill(0xe6edf3);
    }
    if (h.equipped) {
      const ring = h.equipped === 'bow' ? COLORS.bow : COLORS.sword;
      this.g.circle(p.x, p.y - 7, 9).stroke({ color: ring, width: 1.5 });
    }
    this.hpBar(p.x, p.y - 18, h.health.hp / h.health.maxHp);
  }

  private drawMob(p: ScreenPoint, mob: Mob): void {
    this.shadow(p, 3);
    if (mob.species === 'villager') {
      const c = mob.state === 'fleeing' ? COLORS.mobFlee : COLORS.villager;
      this.g.rect(p.x - 2, p.y - 7, 4, 6).fill(c);
      this.g.circle(p.x, p.y - 8, 2).fill(c);
    } else {
      const c = mob.state === 'fleeing' ? COLORS.mobFlee : COLORS.wildlife;
      this.g.ellipse(p.x, p.y - 3, 4, 2.5).fill(c);
      this.g.circle(p.x + 3, p.y - 4, 1.6).fill(c);
    }
  }

  private drawWeapon(p: ScreenPoint, type: WeaponType): void {
    const c = type === 'bow' ? COLORS.bow : COLORS.sword;
    this.g.poly([p.x, p.y - 6, p.x + 3, p.y - 3, p.x, p.y, p.x - 3, p.y - 3]).fill(c);
  }

  private drawResource(p: ScreenPoint, amount: number): void {
    if (amount <= 0) return;
    this.shadow(p, 4);
    this.g.poly([p.x, p.y - 8, p.x + 5, p.y - 2, p.x, p.y, p.x - 5, p.y - 2]).fill(COLORS.resource);
  }

  private facing(prev: GameState, curr: GameState, id: number): Vec2 {
    const a = findEntity(prev, id);
    const b = findEntity(curr, id);
    if (!a || !b) return { x: 0, y: 0 };
    return { x: b.pos.x - a.pos.x, y: b.pos.y - a.pos.y };
  }

  private interpEntity(prev: GameState, curr: GameState, e: Entity, alpha: number): Vec2 {
    return this.interpPos(prev, curr, e.id, alpha) ?? e.pos;
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

- [ ] **Step 2: Type-check + build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client build`
Expected: clean. (If any PixiJS v8 Graphics call mismatches, fix to match the installed API.)

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/render/renderer.ts
git commit -m "feat(client): iso tiled ground + depth-sorted shaped entities"
```

---

### Task 3: Sweep + serve

- [ ] **Step 1: Full sweep**

Run: `pnpm -r test`
Expected: PASS (renderer is untested directly; shapes + all prior suites green).

- [ ] **Step 2: Dev-server smoke check**

Start `pnpm --filter @game/client dev`; fetch `http://localhost:5173/` (HTTP 200, `Choose your side`); stop the server.

- [ ] **Step 3: Manual playtest (human)**

Open it: tiled ground, a chunky monster that grows with level, hero figures with facing + weapon
rings, iso building boxes, critters/villagers, weapon/resource markers, all with shadows and
correct overlap (depth). (Deploy happens after Plan A — gathering + roaming.)

---

## Self-Review

**Spec coverage:** iso tiled ground (Task 2) ✓; real shapes for monster/heroes/buildings/mobs/
weapons/resources + shadows + depth sort + facing + equipped ring + monster grows with level
(Task 2) ✓; pure geometry tested (Task 1) ✓. No sim changes. Gathering/roaming = Plan A.

**Placeholder scan:** complete code; no TBD. ✓

**Type consistency:** `isoBoxFaces`/`diamondPoints`/`depthKey` (Task 1) used by renderer; `Mob`/
`WeaponType`/`Building`/`Entity` from `@game/shared`; `COLORS.ground2` added (Task 1) used in
renderer; `BUILDING_STYLE` keyed by `Building['type']` (all 5 building types). Pixi v8 Graphics
chaining (`poly().fill().stroke()`, `circle`, `ellipse`, `rect`) as used elsewhere. ✓
