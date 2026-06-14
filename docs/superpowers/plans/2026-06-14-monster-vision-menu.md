# Monster Vision render + Skill menu (Sub-projects 3 & 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the senses *felt and usable*: when you control the monster, your sight is limited by your Vision rank (blur + a clear bubble + zoom), and tapping your monster opens a **skill menu** to spend XP on Vision/Hearing/Smell. Then redeploy. Client-only (reads the sim skill state from sub-project 1).

**Tech Stack:** TypeScript, Vitest, PixiJS 8.

---

### Task 1: Pure `visionParams`

**Files:** Create `packages/client/src/render/vision.ts`, `packages/client/src/render/vision.test.ts`

- [ ] **Step 1: Test**

```ts
import { visionParams } from './vision';

test('rank 0 is blurry with a small clear bubble; higher ranks clear up', () => {
  const r0 = visionParams(0);
  expect(r0.blur).toBeGreaterThan(0);
  expect(r0.fogRadius).not.toBeNull();
  const r2 = visionParams(2);
  expect(r2.blur).toBe(0);
  expect(r2.fogRadius).toBeNull(); // whole screen clear
});

test('ranks 3 and 4 zoom out progressively', () => {
  expect(visionParams(3).zoom).toBeLessThan(1);
  expect(visionParams(4).zoom).toBeLessThan(visionParams(3).zoom);
});

test('the clear bubble widens from rank 0 to rank 1', () => {
  expect(visionParams(1).fogRadius!).toBeGreaterThan(visionParams(0).fogRadius!);
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @game/client test vision` → FAIL.

- [ ] **Step 3: Implement** `vision.ts`

```ts
export interface VisionParams {
  fogRadius: number | null; // clear-bubble radius in screen px; null = no fog (full clear)
  blur: number; // pixi blur strength (0 = none)
  zoom: number; // world tile scale (<1 = see more)
}

export function visionParams(rank: number): VisionParams {
  switch (rank) {
    case 0:
      return { fogRadius: 90, blur: 6, zoom: 1 };
    case 1:
      return { fogRadius: 170, blur: 3, zoom: 1 };
    case 2:
      return { fogRadius: null, blur: 0, zoom: 1 };
    case 3:
      return { fogRadius: null, blur: 0, zoom: 0.8 };
    default:
      return { fogRadius: null, blur: 0, zoom: 0.62 };
  }
}
```

- [ ] **Step 4: Run** — `pnpm --filter @game/client test vision` → PASS (3).

- [ ] **Step 5: Commit** — `git add ... && git commit -m "feat(client): add visionParams"`.

---

### Task 2: Renderer applies vision (blur + zoom + clear-bubble fog)

**Files:** `packages/client/src/render/renderer.ts`

Apply only when the player controls the monster (`controlledId === monster.id`); heroes see normally.

- [ ] **Step 1: Imports + members** — add to imports:
```ts
import { Application, BlurFilter, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
```
```ts
import { visionParams } from './vision';
```
Add fields:
```ts
  private readonly blurFilter = new BlurFilter({ strength: 0 });
  private readonly fogSprite: Sprite;
```
In the constructor, after `this.app.stage.addChild(this.world);`, build the radial fog texture and
sprite (above the world, below the HUD):
```ts
    this.fogSprite = new Sprite(makeFogTexture());
    this.fogSprite.anchor.set(0.5);
    this.fogSprite.visible = false;
    this.app.stage.addChild(this.fogSprite);
```
(The HUD/banner/campfireLabel are added after, so they stay on top.)

- [ ] **Step 2: Add a `makeFogTexture()` helper** (module scope, bottom of file):
```ts
function makeFogTexture(): Texture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  // tiny transparent center, opaque dark by ~12% so the dark covers the screen at any scale
  g.addColorStop(0.0, 'rgba(8,10,14,0)');
  g.addColorStop(0.06, 'rgba(8,10,14,0)');
  g.addColorStop(0.12, 'rgba(8,10,14,0.96)');
  g.addColorStop(1.0, 'rgba(8,10,14,0.98)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}
```
(The clear-center radius at scale 1 ≈ 0.06 × 512 ≈ 31 px; we scale the sprite to hit `fogRadius`.)

- [ ] **Step 3: Compute vision in `render` and apply zoom** — at the top of `render`, after computing
`screenW/screenH`, add:
```ts
    const isMonsterView = this.controlledId === curr.monster.id && curr.monster.alive;
    const vis = isMonsterView
      ? visionParams(curr.monster.evolution?.skills.vision ?? 0)
      : { fogRadius: null as number | null, blur: 0, zoom: 1 };
    const tw = TILE_W * vis.zoom;
    const th = TILE_H * vis.zoom;
```
Then **replace every `TILE_W`/`TILE_H` usage inside `render`** (the `camIso` line, the `project`
closure, and the ground-tile `project` calls already go through `project`) — specifically change:
```ts
    const camIso = worldToScreen(camPos, TILE_W, TILE_H, { x: 0, y: 0 });
```
to `worldToScreen(camPos, tw, th, { x: 0, y: 0 });` and
```ts
    const project = (p: Vec2) => worldToScreen(p, TILE_W, TILE_H, origin);
```
to `worldToScreen(p, tw, th, origin)`. (All drawing uses `project`, so this zooms everything.)

- [ ] **Step 4: Apply blur + fog** — near the end of `render` (after drawing, before/after HUD):
```ts
    this.blurFilter.strength = vis.blur;
    this.world.filters = vis.blur > 0 ? [this.blurFilter] : [];

    if (vis.fogRadius !== null) {
      this.fogSprite.visible = true;
      this.fogSprite.position.set(screenW / 2, screenH / 2);
      const clearPx = (this.fogSprite.texture.width / 2) * 0.06;
      this.fogSprite.scale.set(vis.fogRadius / clearPx);
    } else {
      this.fogSprite.visible = false;
    }
```

- [ ] **Step 5: Type-check + build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client build`
Expected: clean. (If the Pixi v8 `BlurFilter`/`Texture.from` signatures differ in the installed
version, adjust to match.)

- [ ] **Step 6: Commit** — `git add ... && git commit -m "feat(client): monster vision (blur/zoom/clear-bubble)"`.

---

### Task 3: Pointer — tap your monster opens the skill menu

**Files:** `packages/client/src/pointer.ts`, `packages/client/src/pointer.test.ts`

- [ ] **Step 1: Test** (append)

```ts
test('the monster tapping itself opens the skill menu', () => {
  const s = createInitialState(1);
  s.map.mobs = [];
  const intent = resolveTapIntent(s, s.monster.id, { ...s.monster.pos }, 3.5);
  expect(intent).toEqual({ kind: 'openSkillMenu' });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — add `'openSkillMenu'` to `TapIntent`; add it to the no-op case in
`applyIntent`; in `resolveTapIntent`, at the very start of the `if (pick) {` block, add:
```ts
    if (isMonster && pick.kind === 'monster') return { kind: 'openSkillMenu' };
```
(So the monster tapping itself opens the menu; mobs/buildings handled below as before.)

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(client): tap monster opens skill menu intent"`.

---

### Task 4: Skill menu overlay + main wiring

**Files:** `packages/client/src/buildMenu.ts` (add a skill menu), `packages/client/src/main.ts`

- [ ] **Step 1: Add a skill-menu overlay** to `buildMenu.ts`:
```ts
import type { BuildableType, SkillPath, WeaponType } from '@game/shared';

export interface SkillChoice {
  path: SkillPath;
  rank: number;
  cost: number;
  affordable: boolean;
  maxed: boolean;
}

let skillPanel: HTMLDivElement | undefined;

function ensureSkillPanel(): HTMLDivElement {
  if (skillPanel) return skillPanel;
  skillPanel = document.createElement('div');
  Object.assign(skillPanel.style, {
    position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
    display: 'none', gap: '8px', padding: '10px', background: '#161b22ee',
    border: '1px solid #7ee787', borderRadius: '10px', zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(skillPanel);
  return skillPanel;
}

export function showSkillMenu(
  items: SkillChoice[],
  onSelect: (path: SkillPath) => void,
  onCancel: () => void,
): void {
  const el = ensureSkillPanel();
  el.innerHTML = '';
  el.style.display = 'flex';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.textContent = item.maxed ? `${item.path} MAX` : `${item.path} ${item.rank}→${item.rank + 1} (${item.cost})`;
    const usable = item.affordable && !item.maxed;
    btn.disabled = !usable;
    styleButton(btn, usable);
    btn.addEventListener('click', () => {
      hideSkillMenu();
      onSelect(item.path);
    });
    el.appendChild(btn);
  }
  const cancel = document.createElement('button');
  cancel.textContent = 'Close';
  styleButton(cancel, true);
  cancel.addEventListener('click', () => {
    hideSkillMenu();
    onCancel();
  });
  el.appendChild(cancel);
}

export function hideSkillMenu(): void {
  if (skillPanel) skillPanel.style.display = 'none';
}
```
(Reuses the existing `styleButton`; extend its import line to include `SkillPath`.)

- [ ] **Step 2: Wire `main.ts`** — imports:
```ts
import { /* existing… */ levelCost, SKILL_MAX_RANK, type SkillPath } from '@game/shared';
import { /* existing… */ showSkillMenu } from './buildMenu';
```
State (near `craftOpen`):
```ts
  let skillOpen = false;
  let pendingSpend: SkillPath | undefined;
```
Guard taps while open — extend the early return:
```ts
    if (flow.phase === 'menu' || craftOpen || skillOpen) return;
```
Handle the intent (next to `openCraftMenu`):
```ts
    if (intent.kind === 'openSkillMenu') {
      skillOpen = true;
      const evo = curr.monster.evolution!;
      const paths: SkillPath[] = ['vision', 'hearing', 'smell'];
      const cost = levelCost(evo.level);
      const items = paths.map((path) => ({
        path,
        rank: evo.skills[path],
        cost,
        affordable: curr.resources != null && curr.monster.evolution!.xp >= cost,
        maxed: evo.skills[path] >= SKILL_MAX_RANK,
      }));
      showSkillMenu(items, (path) => { skillOpen = false; pendingSpend = path; }, () => { skillOpen = false; });
      return;
    }
```
One-shot spend in the controlled-input block (before the keyboard/control branch, alongside
`pendingBuild`/`pendingCraft`):
```ts
        } else if (pendingSpend) {
          inputs[controlledId] = { actorId: controlledId, move: { x: 0, y: 0 }, action: 'spend', skillPath: pendingSpend };
          pendingSpend = undefined;
        }
```

- [ ] **Step 3: Type-check + build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client build`
Expected: clean.

- [ ] **Step 4: Commit** — `git commit -m "feat(client): skill menu (tap monster to spend XP on senses)"`.

---

### Task 5: Sweep + deploy

- [ ] **Step 1:** `pnpm -r test` → PASS.
- [ ] **Step 2:** dev-serve smoke (HTTP 200 + `Choose your side`), stop.
- [ ] **Step 3:** Merge to `master`, delete branch, `git push origin master`; watch Pages run to success;
  verify live.
- [ ] **Step 4 (human playtest):** Play the monster — sight starts blurry with a small bubble; tap
  yourself to open the skill menu and spend banked XP on Vision (watch it clear/widen/zoom),
  Hearing, or Smell (effects for hearing/smell arrive in the next sub-projects).

---

## Self-Review

**Coverage:** vision blur/zoom/clear-bubble by rank, monster-view only (Tasks 1–2) ✓; tap-monster
skill menu + spend (Tasks 3–4) ✓; deploy (Task 5) ✓. Hearing/smell rendering + prey tiers remain
later sub-projects.

**Placeholder scan:** complete code; no TBD. ✓

**Type consistency:** `visionParams` (Task 1) used in renderer (Task 2). `TapIntent 'openSkillMenu'`
(Task 3) handled in `main.ts` (Task 4) + `applyIntent` no-op. `levelCost`/`SKILL_MAX_RANK`/`SkillPath`
imported from `@game/shared`. `showSkillMenu`/`SkillChoice` (Task 4) match the call. Pixi v8
`BlurFilter`/`Sprite`/`Texture` imports. ✓
