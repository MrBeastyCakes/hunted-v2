# Day/Night Cycle + 3-Night Survival (Design Spec — Village phase 1)

**Date:** 2026-06-14
**Status:** Approved; first phase of the Human Village expansion (bots-now approach).

## Goal

Reframe the match around the village's real objective: **survive three nights.** Add a day/night
cycle, a survival timer victory, and night-blindness for villagers.

## Time model

- `DAY_TICKS = 8000` (6.67 min @ 20Hz), `NIGHT_TICKS = 4000` (3.33 min), `NIGHTS_TO_SURVIVE = 3`.
- Cycle = day then night = 12000 ticks. Match length `TOTAL_TICKS = 3 * 12000 = 36000`.
- Pure `dayNight(tick) -> { phase: 'day'|'night', cycle: 1..3, isNight, ticksLeftInPhase, ended }`.
  (Durations are tunable constants; the design's exact minutes are the defaults.)

## Victory (winConditionSystem, priority order)

1. Campfire (core) destroyed → **monsterWon**.
2. Monster dead → **buildersWon** (threat eliminated).
3. `dayNight(tick).ended` (survived to end of night 3) → **buildersWon** (survival — the real goal).

## Client

- **HUD:** `Day 2 · 4:12 left` / `Night 3/3 · 1:30 left` derived from `dayNight(curr.tick)`.
- **Night atmosphere:** ground tiles render darker at night (all players).
- **Night-blindness (heroes):** controlling a hero at night applies a clear-bubble fog
  (`HERO_NIGHT_FOG` ≈ 150px); by day, no fog (full view). Reuses the existing fog sprite.
- **Monster:** unaffected by day/night — vision stays governed by its sense skills.
- Generalize the renderer's vision: controlled monster → `visionParams(skill)`; controlled hero →
  night ? night-bubble : none.

## Sim

- `time.ts` (pure): `dayNight`, `TOTAL_TICKS`. Constants in `constants.ts`.
- `winConditionSystem`: add the survival win (reads `state.tick`).
- `bots.integration` guard raised to `TOTAL_TICKS + buffer` so a stalemate ends by survival.
- No change to combat/economy/spawns this phase.

## Out of scope (later phases)

Light sources extending night vision; night changing monster strength or spawns; the roles/economy/
infection phases; real multiplayer.

## Testing

- `dayNight`: day→night boundaries, cycle numbering, `ended` at `TOTAL_TICKS`.
- `winConditionSystem`: survival win at `TOTAL_TICKS`; existing core/monster wins still hold.
- Client `vision`/HUD verified by build + playtest.
