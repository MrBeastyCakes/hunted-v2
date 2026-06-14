# Fixes: deblur core (drop global blur) + economy caps

> REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** (1) Vision is sharp (remove the global blur; keep darkness + clear bubble). (2) Stop infinite building & runaway materials: per-type building caps + a materials cap; bots respect caps.

---

### Task 1: Remove global vision blur (client)

- [ ] `render/vision.ts`: drop `blur` from `VisionParams` and `visionParams` (keep `fogRadius`, `zoom`).
- [ ] `render/vision.test.ts`: stop asserting blur; assert rank0 has a fog bubble and rank2 has none.
- [ ] `render/renderer.ts`: remove `BlurFilter` import + `blurFilter` field + the `this.world.filters` blur application (leave `this.world.filters = []` or omit).
- [ ] tsc + `pnpm --filter @game/client test vision` → PASS. Commit.

### Task 2: Economy caps (sim)

- [ ] `constants.ts`: add
```ts
export const BUILDING_CAP: Record<'generator' | 'tower' | 'workshop' | 'blacksmith', number> = {
  generator: 3, tower: 6, workshop: 1, blacksmith: 1,
};
export const MATERIALS_CAP = 400;
```
- [ ] `systems/building.ts`: before building, count existing of that type; if `>= BUILDING_CAP[type]`, skip.
- [ ] `systems/economy.ts`: clamp `state.resources.materials` to `MATERIALS_CAP` after adding income.
- [ ] `systems/gathering.ts`: clamp materials to `MATERIALS_CAP` after harvesting.
- [ ] tests: building cap (can't exceed), economy clamp, gathering clamp. Commit.

### Task 3: Bots respect caps

- [ ] `bots/hero.ts`: when the role's `buildChoice` is at its `BUILDING_CAP`, skip building and gather instead.
- [ ] `bots/hero.test.ts`: a builder at the tower cap gathers rather than building. Commit.

### Task 4: Sweep + deploy

- [ ] `pnpm -r test`, client build, merge, push, verify live.
