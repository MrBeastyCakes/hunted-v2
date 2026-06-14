# Smell + Hearing senses (monster sub-projects 5 & 6)

> REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Render the smell + hearing perception effects (client-only, monster-view only, drawn over
the fog): smell = colored outline rings + off-screen edge arrows on scent sources; hearing = pulsing
rings (+ distance label at rank 3) on nearby creatures. Pure selectors + render glue. Then deploy.

---

### Task 1: Pure perception selectors

- [ ] Create `render/senses.ts`: `smellRanges(rank)`, `smellTargets(state, rank)`, `smellSpeciesId(rank)`,
  `hearRange(rank)`, `hearTargets(state, rank)`, `hearDistance(rank)`. Types `SmellTarget`,
  `HearTarget`, `SmellCategory`, `PerceiveKind`. (Mapping per design: rancid=large, food=buildings,
  living=other creatures+heroes; hearing=all creatures in range.)
- [ ] `render/senses.test.ts`: per-rank ranges; smell rank 0 empty; rank 1 grabs a nearby large as
  rancid; rank 3 grabs a nearby critter as living; hearing range table; hearTargets within range only.
- [ ] `pnpm --filter @game/client test senses` → PASS. Commit.

### Task 2: Renderer sense overlay

- [ ] `renderer.ts`: add a `senseOverlay` Graphics on the stage **above the fog sprite, below the HUD**,
  and a `hearLabels: Text[]` pool. When `controlledId === monster && alive`:
  - smell: for each `smellTargets(curr, smell)` draw an outline ring at its projected pos (color =
    category tint, or species tint at rank 4); if off-screen, draw an edge arrow toward it.
  - hearing: for each `hearTargets(curr, hearing)` draw a ring whose radius pulses with the tick
    (color generic, or by type at rank ≥ 2); at rank ≥ 3 show a `${round(distance)}m` label.
  - else clear the overlay + hide labels.
- [ ] color helpers map `PerceiveKind`/category → `COLORS`. tsc + build. Commit.

### Task 3: Sweep + deploy

- [ ] `pnpm -r test`, build, merge, push, verify live.
