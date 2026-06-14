# Sim: Senses & Skill Tree (Sub-project 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the monster's auto-evolution with an **XP-spend skill tree**: feeding banks XP, and a `spend` action raises one of three sense paths (vision/hearing/smell, ranks 0–4), which also raises the monster's level and grants a small auto HP/damage bump. Bots auto-spend. Sim + minimal client compat (the renderer reads the reshaped evolution).

**Architecture:** Reshape `Evolution` to `{ xp, level, skills: {vision,hearing,smell} }`. Pure `levelCost` + `spendOnSkill`; a `skillSystem` consumes a `spend` input and replaces `evolutionSystem`. Combat no longer grants XP (feeding is the XP source). The client renderer is updated to read `level`/`skills` so it keeps compiling; the skill **menu** and sense rendering are later sub-projects.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Reshape types/constants/state (+ keep combat & client compiling)

**Files:** `types.ts`, `constants.ts`, `state.ts`, `systems/combat.ts`, `systems/combat.test.ts`, `packages/client/src/render/renderer.ts`

- [ ] **Step 1: types.ts**
  - Add `export type SkillPath = 'vision' | 'hearing' | 'smell';`
  - Replace the `Evolution` interface:
```ts
export interface Evolution {
  xp: number; // spendable bank
  level: number; // 1..; rises each rank bought
  skills: { vision: number; hearing: number; smell: number };
}
```
  - Add `'spend'` to `ActionType`: `'attack' | 'build' | 'ability' | 'craft' | 'spend'`.
  - Add to `Input`: `skillPath?: SkillPath;`

- [ ] **Step 2: constants.ts** — remove `MONSTER_STAGE_XP`, `STAGE_HP_BONUS`, `STAGE_DAMAGE_BONUS`,
  `CITY_DAMAGE_XP`. Add:
```ts
// --- Monster skill tree ---
export const XP_PER_LEVEL_COST = 25; // cost to reach level n is XP_PER_LEVEL_COST * n
export const SKILL_MAX_RANK = 4;
export const LEVEL_HP_BONUS = 25;
export const LEVEL_DAMAGE_BONUS = 2;
```

- [ ] **Step 3: state.ts** — monster's `evolution`:
```ts
    evolution: { xp: 0, level: 1, skills: { vision: 0, hearing: 0, smell: 0 } },
```

- [ ] **Step 4: combat.ts** — remove the building-damage XP block (no more `cityDamageDealt`/
  `CITY_DAMAGE_XP`). The monster still damages buildings; it just doesn't gain XP from it. Replace:
```ts
        target.health.hp -= m.combat.damage;
        m.combat.cooldownRemaining = m.combat.cooldown;
        if (target.isBuilding) {
          m.evolution.cityDamageDealt += m.combat.damage;
          m.evolution.xp += m.combat.damage * CITY_DAMAGE_XP;
        }
```
  with:
```ts
        target.health.hp -= m.combat.damage;
        m.combat.cooldownRemaining = m.combat.cooldown;
```
  Remove the now-unused `CITY_DAMAGE_XP` import and the `m.evolution` guard if it's now only used
  there (keep `m.combat`/`m.alive` guards; drop the `m.evolution &&` if unused).

- [ ] **Step 5: combat.test.ts** — the "monster attacks the city core and gains city-damage XP"
  test: drop the XP/cityDamage assertions, keep the core-hp-dropped assertion:
```ts
test('the monster attacks the nearest building', () => {
  const s = createInitialState(123);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  s.map.mobs = [];
  const startCoreHp = core.health.hp;
  const dmg = s.monster.combat!.damage;
  combatSystem(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  expect(core.health.hp).toBe(startCoreHp - dmg);
});
```
  (Remove `CITY_DAMAGE_XP` import from the test.)

- [ ] **Step 6: client renderer compat** — in `renderer.ts`, `drawMonster` uses `evolution.stage`;
  change to `evolution.level` (capped) and update the HUD line. Replace the radius line:
```ts
    const stage = m.evolution?.stage ?? 1;
    const r = 9 + stage * 2.5;
```
  with:
```ts
    const level = m.evolution?.level ?? 1;
    const r = 9 + Math.min(level, 6) * 2;
```
  And in `render`'s HUD text, replace the monster line:
```ts
      `monster: L${m.evolution?.stage ?? 1}/5  hp ${Math.ceil(m.health.hp)}/${m.health.maxHp}  xp ${Math.floor(m.evolution?.xp ?? 0)}\n` +
```
  with:
```ts
      `monster: L${m.evolution?.level ?? 1}  hp ${Math.ceil(m.health.hp)}/${m.health.maxHp}  xp ${Math.floor(m.evolution?.xp ?? 0)}\n` +
      `senses V${m.evolution?.skills.vision ?? 0} H${m.evolution?.skills.hearing ?? 0} S${m.evolution?.skills.smell ?? 0}\n` +
```

- [ ] **Step 7: Type-check both packages**

Run: `cd packages/shared && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: errors only in `systems/evolution.ts` + its test + `step.ts` (evolution wiring) — fixed in
Task 3. The bot/hunting/state should be clean. Note and proceed.
Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..`
Expected: clean (renderer updated).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sim): reshape monster evolution to xp/level/skills; combat no longer grants xp"
```

---

### Task 2: Pure skill spend logic

**Files:** Create `packages/shared/src/skill.ts`, `packages/shared/src/skill.test.ts`

- [ ] **Step 1: Test**

```ts
import { levelCost, spendOnSkill } from './skill';
import { createInitialState } from './state';
import { LEVEL_DAMAGE_BONUS, LEVEL_HP_BONUS, SKILL_MAX_RANK } from './constants';

test('levelCost is 25 * the target level', () => {
  expect(levelCost(1)).toBe(50); // level 1 -> 2 costs 25*2
  expect(levelCost(2)).toBe(75);
  expect(levelCost(7)).toBe(200);
});

test('spending raises the rank + level, deducts xp, and bumps power', () => {
  const s = createInitialState(1);
  const m = s.monster;
  m.evolution!.xp = 1000;
  const hp = m.health.maxHp;
  const dmg = m.combat!.damage;
  const ok = spendOnSkill(s, 'vision');
  expect(ok).toBe(true);
  expect(m.evolution!.skills.vision).toBe(1);
  expect(m.evolution!.level).toBe(2);
  expect(m.evolution!.xp).toBe(1000 - 50);
  expect(m.health.maxHp).toBe(hp + LEVEL_HP_BONUS);
  expect(m.combat!.damage).toBe(dmg + LEVEL_DAMAGE_BONUS);
});

test('cannot spend without enough xp', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 10;
  expect(spendOnSkill(s, 'vision')).toBe(false);
  expect(s.monster.evolution!.level).toBe(1);
});

test('a path caps at SKILL_MAX_RANK', () => {
  const s = createInitialState(1);
  const m = s.monster;
  m.evolution!.xp = 100000;
  for (let i = 0; i < SKILL_MAX_RANK; i++) spendOnSkill(s, 'smell');
  expect(m.evolution!.skills.smell).toBe(SKILL_MAX_RANK);
  expect(spendOnSkill(s, 'smell')).toBe(false); // capped
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test skill`
Expected: FAIL — cannot find module `./skill`.

- [ ] **Step 3: Implement** `skill.ts`

```ts
import { LEVEL_DAMAGE_BONUS, LEVEL_HP_BONUS, SKILL_MAX_RANK, XP_PER_LEVEL_COST } from './constants';
import type { GameState, SkillPath } from './types';

// XP cost to go from `level` to `level + 1`.
export function levelCost(level: number): number {
  return XP_PER_LEVEL_COST * (level + 1);
}

// Spend banked XP to raise one sense path a rank (also raises level + power). Returns success.
export function spendOnSkill(state: GameState, path: SkillPath): boolean {
  const m = state.monster;
  if (!m.alive || !m.evolution || !m.combat) return false;
  const evo = m.evolution;
  if (evo.skills[path] >= SKILL_MAX_RANK) return false;
  const cost = levelCost(evo.level);
  if (evo.xp < cost) return false;

  evo.xp -= cost;
  evo.skills[path] += 1;
  evo.level += 1;
  m.health.maxHp += LEVEL_HP_BONUS;
  m.health.hp += LEVEL_HP_BONUS;
  m.combat.damage += LEVEL_DAMAGE_BONUS;
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @game/shared test skill`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/skill.ts packages/shared/src/skill.test.ts
git commit -m "feat(sim): add pure skill-spend logic (levelCost, spendOnSkill)"
```

---

### Task 3: skillSystem replaces evolutionSystem

**Files:** Create `packages/shared/src/systems/skill.ts`, `packages/shared/src/systems/skill.test.ts`; modify `step.ts`, `index.ts`; delete `systems/evolution.ts`, `systems/evolution.test.ts`; fix `integration.test.ts`

- [ ] **Step 1: Test** (`systems/skill.test.ts`)

```ts
import { skillSystem } from './skill';
import { createInitialState } from '../state';
import type { InputMap } from '../types';

test('a spend input raises the chosen skill when affordable', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 100;
  const inputs: InputMap = {
    [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 }, action: 'spend', skillPath: 'hearing' },
  };
  skillSystem(s, inputs);
  expect(s.monster.evolution!.skills.hearing).toBe(1);
  expect(s.monster.evolution!.level).toBe(2);
});

test('no spend input does nothing', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 100;
  skillSystem(s, {});
  expect(s.monster.evolution!.level).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test systems/skill`
Expected: FAIL — cannot find module `./skill`.

- [ ] **Step 3: Implement** `systems/skill.ts`

```ts
import { spendOnSkill } from '../skill';
import type { GameState, InputMap } from '../types';

// Consumes the monster's 'spend' action to raise a sense path.
export function skillSystem(state: GameState, inputs: InputMap): void {
  const input = inputs[state.monster.id];
  if (input?.action === 'spend' && input.skillPath) {
    spendOnSkill(state, input.skillPath);
  }
}
```

- [ ] **Step 4: Wire `step.ts`** — replace the `evolutionSystem` import + call with `skillSystem`:
```ts
import { skillSystem } from './systems/skill';
```
```ts
  combatSystem(next, inputs);
  skillSystem(next, inputs);
  winConditionSystem(next);
```

- [ ] **Step 5: `index.ts`** — replace the `evolutionSystem` export with:
```ts
export { skillSystem } from './systems/skill';
export { spendOnSkill, levelCost } from './skill';
```

- [ ] **Step 6: Delete** `packages/shared/src/systems/evolution.ts` and
  `packages/shared/src/systems/evolution.test.ts`.

- [ ] **Step 7: Fix `integration.test.ts`** — the "hunting mobs levels the monster up" test relied on
  auto-evolution. Leveling now needs spending, so assert XP is **banked** instead:
```ts
test('hunting mobs banks XP to spend on skills', () => {
  let s = createInitialState(3);
  for (let i = 0; i < 120 && s.map.mobs.length > 0; i++) {
    const target = s.map.mobs[0];
    s = structuredClone(s);
    s.monster.pos = { ...target.pos };
    s = step(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  }
  expect(s.monster.evolution!.xp).toBeGreaterThan(0);
});
```

- [ ] **Step 8: Run shared tests**

Run: `pnpm --filter @game/shared test`
Expected: PASS (no evolution suite; skill + systems/skill green; integration banks xp). `bots.integration`
may need Task 4 first if the monster never spends — but it should still terminate (monster hunts/assaults).
If `bots.integration` fails to terminate, proceed to Task 4 (bot spending) then re-run.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(sim): skillSystem replaces evolutionSystem; spend-driven leveling"
```

---

### Task 4: Monster bot auto-spends XP

**Files:** `packages/shared/src/bots/monster.ts`, `packages/shared/src/bots/monster.test.ts`

- [ ] **Step 1: Test** (append to `monster.test.ts`)

```ts
import { levelCost } from '../skill';

test('the monster bot spends banked XP on a sense when it can afford a level', () => {
  const s = createInitialState(123);
  s.monster.evolution!.xp = levelCost(s.monster.evolution!.level) + 5;
  const input = monsterBot(s);
  expect(input.action).toBe('spend');
  expect(['vision', 'hearing', 'smell']).toContain(input.skillPath);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @game/shared test bots/monster`
Expected: FAIL.

- [ ] **Step 3: Implement** — in `monster.ts`, before the hunting logic, add a spend check:
```ts
import { levelCost } from '../skill';
import { SKILL_MAX_RANK } from '../constants';
import type { SkillPath } from '../types';
```
At the top of `monsterBot`, after `const id = m.id;`:
```ts
  const evo = m.evolution;
  if (evo && evo.xp >= levelCost(evo.level)) {
    // spend on the lowest-rank sense (spread investment), among those not maxed
    const paths: SkillPath[] = ['vision', 'hearing', 'smell'];
    const available = paths.filter((p) => evo.skills[p] < SKILL_MAX_RANK);
    if (available.length > 0) {
      available.sort((a, b) => evo.skills[a] - evo.skills[b]);
      return { actorId: id, move: { x: 0, y: 0 }, action: 'spend', skillPath: available[0] };
    }
  }
```

- [ ] **Step 4: Run bot + integration**

Run: `pnpm --filter @game/shared test bots`
Expected: PASS (incl. bots.integration terminating; the monster now levels by spending).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/bots/monster.ts packages/shared/src/bots/monster.test.ts
git commit -m "feat(sim): monster bot auto-spends XP on senses"
```

---

### Task 5: Full sweep (both packages green)

- [ ] **Step 1:** Run: `pnpm -r test` — expect PASS (shared + client).
- [ ] **Step 2:** Run: `cd packages/client && ../../node_modules/.bin/tsc.cmd --noEmit && cd ../..` — clean.
- [ ] **Step 3:** Commit anything incidental. (No deploy yet — the skill **menu** + sense rendering are
  the next sub-projects; merge to master locally.)

---

## Self-Review

**Coverage:** XP-spend skill tree replacing auto-evolution (Tasks 1–3) ✓; level cost 25×level + power
bump (Task 2) ✓; bot auto-spend (Task 4) ✓; feeding still banks XP (hunting unchanged) ✓; combat no
longer grants XP (Task 1) ✓; client compiles via renderer compat (Task 1) ✓. Vision/menu/smell/hearing
are later sub-projects.

**Placeholder scan:** complete code; no TBD. ✓

**Type consistency:** `Evolution {xp,level,skills}` + `SkillPath` (Task 1) used by `skill.ts` (Task 2),
`systems/skill.ts` (Task 3), bot (Task 4), renderer (Task 1). `ActionType 'spend'` + `Input.skillPath`
handled in `skillSystem`. `levelCost`/`spendOnSkill` exported (Task 3). Removed `MONSTER_STAGE_XP`/
`STAGE_*`/`CITY_DAMAGE_XP` references (combat + tests updated). ✓
