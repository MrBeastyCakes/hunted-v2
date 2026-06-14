# Client: Blacksmith Craft Menu, Weapon Rack & Equipping (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the blacksmith/weapons system playable: build a Blacksmith from the campfire menu, tap it to open a craft menu (Sword/Bow), see weapons on the rack, and tap a weapon to walk over and equip it; armed heroes show an indicator. Then redeploy.

**Architecture:** Pure pointer logic gains weapon picking + an `openCraftMenu` intent; the craft menu reuses the menu-overlay pattern; the renderer draws weapon pickups + an equipped ring. The sim (Plan 1) is unchanged.

**Tech Stack:** TypeScript, Vitest, PixiJS 8, Vite.

---

### Task 1: Pointer — pick weapons, blacksmith craft intent, blueprint

**Files:** `packages/client/src/pointer.ts`, `packages/client/src/pointer.test.ts`, `packages/client/src/buildFlow.ts`, `packages/client/src/buildFlow.test.ts`

- [ ] **Step 1: Tests** — in `pointer.test.ts` add:
```ts
test('pickTarget grabs a weapon pickup', () => {
  const s = createInitialState(1);
  s.map.weapons = [{ id: 9001, type: 'sword', pos: { x: 50, y: 50 } }];
  s.map.mobs = [];
  const pick = pickTarget(s, { x: 50, y: 50 }, 3.5);
  expect(pick).toEqual({ kind: 'weapon', id: 9001, pos: { x: 50, y: 50 } });
});

test('a hero tapping a blacksmith opens the craft menu', () => {
  const s = createInitialState(1);
  s.buildings.push({ id: 9002, type: 'blacksmith', pos: { x: 60, y: 60 }, health: { hp: 35, maxHp: 35 }, level: 1 });
  s.map.mobs = [];
  const intent = resolveTapIntent(s, s.heroes[0].id, { x: 60, y: 60 }, 3.5);
  expect(intent).toEqual({ kind: 'openCraftMenu' });
});

test('a hero tapping a weapon moves to it (to equip)', () => {
  const s = createInitialState(1);
  s.map.weapons = [{ id: 9003, type: 'bow', pos: { x: 40, y: 40 } }];
  s.map.mobs = [];
  const intent = resolveTapIntent(s, s.heroes[0].id, { x: 40, y: 40 }, 3.5);
  expect(intent).toEqual({ kind: 'move', point: { x: 40, y: 40 } });
});
```
In `buildFlow.test.ts`, update the BLUEPRINTS test:
```ts
test('BLUEPRINTS are the buildable structures', () => {
  expect(BLUEPRINTS).toEqual(['tower', 'generator', 'workshop', 'blacksmith']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/client test pointer`
Run: `pnpm --filter @game/client test buildFlow`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `pointer.ts`: add `'weapon'` to `Pick['kind']`; in `pickTarget`, after mobs:
```ts
  for (const w of state.map.weapons) consider('weapon', w.id, w.pos);
```
Add to `TapIntent`: `| { kind: 'openCraftMenu' }`.
In `resolveTapIntent`, inside `if (pick) {`, after the core-building branch and before the closing brace, add the blacksmith + weapon handling:
```ts
    if (!isMonster && pick.kind === 'building') {
      const building = state.buildings.find((b) => b.id === pick.id);
      if (building?.type === 'core') return { kind: 'openBuildMenu' };
      if (building?.type === 'blacksmith') return { kind: 'openCraftMenu' };
    }
    if (pick.kind === 'weapon') return { kind: 'move', point: { x: pick.pos.x, y: pick.pos.y } };
```
In `applyIntent`, add `openCraftMenu` to the no-op case:
```ts
    case 'spectate':
    case 'openBuildMenu':
    case 'openCraftMenu':
      return control;
```
In `buildFlow.ts`, add blacksmith to `BLUEPRINTS`:
```ts
export const BLUEPRINTS: BuildableType[] = ['tower', 'generator', 'workshop', 'blacksmith'];
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/client test pointer`
Run: `pnpm --filter @game/client test buildFlow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/pointer.ts packages/client/src/pointer.test.ts packages/client/src/buildFlow.ts packages/client/src/buildFlow.test.ts
git commit -m "feat(client): pick weapons, blacksmith craft intent, blacksmith blueprint"
```

---

### Task 2: Craft menu overlay

**Files:** `packages/client/src/buildMenu.ts`

- [ ] **Step 1: Add a craft-menu overlay** (append to `buildMenu.ts`)

```ts
import type { WeaponType } from '@game/shared';

export interface WeaponItemChoice {
  type: WeaponType;
  cost: number;
  affordable: boolean;
}

let craftPanel: HTMLDivElement | undefined;

function ensureCraftPanel(): HTMLDivElement {
  if (craftPanel) return craftPanel;
  craftPanel = document.createElement('div');
  craftPanel.id = 'craftmenu';
  Object.assign(craftPanel.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    display: 'none',
    gap: '8px',
    padding: '10px',
    background: '#161b22ee',
    border: '1px solid #f2b66d',
    borderRadius: '10px',
    zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(craftPanel);
  return craftPanel;
}

// Shows the weapon craft menu; calls onSelect(type) or onCancel and hides itself.
export function showCraftMenu(
  items: WeaponItemChoice[],
  onSelect: (type: WeaponType) => void,
  onCancel: () => void,
): void {
  const el = ensureCraftPanel();
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
      hideCraftMenu();
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
    hideCraftMenu();
    onCancel();
  });
  el.appendChild(cancel);
}

export function hideCraftMenu(): void {
  if (craftPanel) craftPanel.style.display = 'none';
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/buildMenu.ts
git commit -m "feat(client): add weapon craft menu overlay"
```

---

### Task 3: Renderer — weapon pickups + equipped indicator

**Files:** `packages/client/src/config.ts`, `packages/client/src/render/renderer.ts`

- [ ] **Step 1: Colors** — add to `config.ts` `COLORS`:
```ts
  sword: 0xe6edf3,
  bow: 0x9ad1ff,
```

- [ ] **Step 2: Draw weapon pickups** in `renderer.ts` — after the mob loop, add:
```ts
    for (const w of curr.map.weapons) {
      this.dot(project(w.pos), 4, w.type === 'bow' ? COLORS.bow : COLORS.sword);
    }
```

- [ ] **Step 3: Equipped indicator** — in the heroes loop, after drawing the hero dot + hp bar,
add a ring for armed heroes:
```ts
      if (h.equipped) {
        const ring = h.equipped === 'bow' ? COLORS.bow : COLORS.sword;
        this.g.circle(p.x, p.y, 9).stroke({ color: ring, width: 1.5 });
      }
```

- [ ] **Step 4: Type-check**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/config.ts packages/client/src/render/renderer.ts
git commit -m "feat(client): render weapon pickups and equipped indicator"
```

---

### Task 4: main.ts wiring (craft menu + one-shot craft input)

**Files:** `packages/client/src/main.ts`

- [ ] **Step 1: Imports** — extend the `@game/shared` import with `CRAFT_COST` and `type WeaponType`;
extend the `buildMenu` import with `showCraftMenu`.

- [ ] **Step 2: State** — after `let pendingBuild ...` add:
```ts
  let craftOpen = false;
  let pendingCraft: WeaponType | undefined;
```

- [ ] **Step 3: Guard taps while the craft menu is open** — change the early return in the pointer
handler:
```ts
    if (flow.phase === 'menu' || craftOpen) return; // handled by overlay buttons
```

- [ ] **Step 4: Handle the craft intent** — in the idle-phase intent handling (next to the
`openBuildMenu` branch), add:
```ts
    if (intent.kind === 'openCraftMenu') {
      craftOpen = true;
      const types: WeaponType[] = ['sword', 'bow'];
      const items = types.map((type) => ({
        type,
        cost: CRAFT_COST[type],
        affordable: curr.resources.materials >= CRAFT_COST[type],
      }));
      showCraftMenu(
        items,
        (type) => {
          craftOpen = false;
          pendingCraft = type;
        },
        () => {
          craftOpen = false;
        },
      );
      return;
    }
```

- [ ] **Step 5: One-shot craft input** — in the controlled-input block, add a `pendingCraft` branch
alongside `pendingBuild`:
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
        } else if (pendingCraft) {
          inputs[controlledId] = {
            actorId: controlledId,
            move: { x: 0, y: 0 },
            action: 'craft',
            craftType: pendingCraft,
          };
          pendingCraft = undefined;
        } else {
          const k = keyboard.state();
          const keyboardActive = k.up || k.down || k.left || k.right || k.build;
          inputs[controlledId] = keyboardActive
            ? inputFromKeys(controlledId, k, DEFAULT_BUILD)
            : controlToInput(curr, controlledId, control, MOVE_ARRIVAL_EPS);
        }
      }
```

- [ ] **Step 6: Type-check + build**

Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Run: `pnpm --filter @game/client build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/main.ts
git commit -m "feat(client): blacksmith craft menu wiring + one-shot craft input"
```

---

### Task 5: Sweep, build, serve, deploy

- [ ] **Step 1: Full sweep**

Run: `pnpm -r test`
Expected: PASS (shared + client).

- [ ] **Step 2: Dev-server smoke check**

Start `pnpm --filter @game/client dev`; fetch `http://localhost:5173/` (HTTP 200, `Choose your side`); stop the server.

- [ ] **Step 3: Finish + deploy**

Merge to `master`, delete the branch, and `git push origin master` (triggers the Pages workflow).
Watch the run to success and confirm the live URL still serves.

- [ ] **Step 4: Manual playtest (human)**

Play a hero: tap the campfire → build a Blacksmith; tap the Blacksmith → craft a Sword/Bow; tap
the weapon on the rack to walk over and equip it (a ring shows you're armed). Play the monster:
heroes start unarmed and only become dangerous once they've armed up.

---

## Self-Review

**Spec coverage:** blacksmith blueprint (Task 1) ✓; tap-blacksmith craft menu (Tasks 1,2,4) ✓;
weapon rack rendering + equipped indicator (Task 3) ✓; tap-weapon-to-equip (Task 1 move + sim
pickup) ✓; deploy (Task 5) ✓.

**Placeholder scan:** complete code in each step. ✓

**Type consistency:** `Pick.kind` `'weapon'` + `TapIntent` `openCraftMenu` (Task 1) handled in
`main.ts` (Task 4) and `applyIntent`. `BLUEPRINTS` includes `'blacksmith'` (a `BuildableType`).
`showCraftMenu(items, onSelect, onCancel)` (Task 2) matches its call (Task 4). `CRAFT_COST`/
`WeaponType` from `@game/shared`. `COLORS.sword`/`bow` (Task 3) used in renderer. ✓
