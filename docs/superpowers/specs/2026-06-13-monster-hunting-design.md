# Monster Hunting Overhaul + 5-Level Evolution (Design Spec)

**Date:** 2026-06-13
**Status:** Approved design — ready for implementation planning
**Motivation:** Playtest feedback — "the monster has nothing to do but die." Passive feeding
(tap a static node) gave no agency, and the leveling arc was shallow. This replaces feeding
with an active **hunt of scattering herds** and deepens evolution to **five levels** with an
XP economy that pushes the monster from the wilds into the city as it grows.

## Goal

The monster's core loop becomes hunting: stalk herds of **wildlife** in the wild for the early
levels, then — because the XP needed per level grows large — hunt **villagers** at the campfire
and **devour buildings** for the big late-game food. Animals never stop working, but reaching
the top levels on critters alone is impractically slow, so the monster is drawn into the
defended city: escalating risk, escalating reward.

## Out of scope (deliberate — next iteration)

- **Win-path balance** (surviving the full assault). This pass gives the late game *purpose and
  food*; tuning whether the monster can actually win the siege is a separate iteration.
- **Builder-side stake in villagers** (e.g., losing villagers hurting the builders). Villagers
  are monster food only for now.
- The `food` resource (still unused).

## The hunt model

### Entities
- **Mob** — `{ id, herdId, species: 'wildlife' | 'villager', pos, state: 'calm' | 'fleeing', fleeTicks }`.
- **Herd** — `{ id, species, home: Vec2 }`. Mobs reference `herdId`; `home` is the roam/regroup point.
- `GameState.map` gains `mobs: Mob[]` and `herds: Herd[]` and **drops `wildlifeNodes`**.
  `resourceNodes` stays (still unused/deferred).
- **Wildlife herds** spawn at spread-out points in the wild; **one villager herd** homes at the
  campfire (so hunting villagers means entering the defended city).

### Behavior (deterministic — seeded RNG in `GameState.rngState`)
- **Calm:** a mob takes a small step in a seeded random direction; if it has drifted beyond
  `HERD_WANDER_RADIUS` of its home it steps back toward home. Speed `MOB_WANDER_SPEED`.
- **Scatter trigger:** if the monster is within `SCATTER_RADIUS` of any mob in a herd, every mob
  in that herd flips to `fleeing` with `fleeTicks = SCATTER_TICKS`.
- **Fleeing:** the mob moves directly away from the monster at `MOB_FLEE_SPEED` (just under the
  monster's speed — a committed chase catches a straggler, but the herd sprays apart);
  `fleeTicks` counts down to `calm`.
- **Eat on contact:** any mob within `CATCH_RANGE` of the living monster is removed and grants
  flat XP by species (`WILDLIFE_XP` or `VILLAGER_XP`). No action button — eating is automatic.
- **Respawn:** every `HERD_RESPAWN_TICKS`, each herd below its target size spawns one mob at its
  home (the wild repopulates; the city keeps producing villagers).

## Five-level evolution + XP economy

- **5 stages.** `monster.evolution.stage` runs 1→5; `evolutionSystem` sets the stage to the
  highest threshold reached. Each stage gained adds `STAGE_HP_BONUS` (and heals) and
  `STAGE_DAMAGE_BONUS`.
- **Widening thresholds** make late levels expensive, so flat-XP critters can't realistically
  carry you to the top — villagers/buildings can.
- **The old hard "stage-3 requires city damage" gate is removed** — the XP economy creates that
  pressure naturally. (`cityDamageDealt` may remain as a stat; it no longer gates evolution.)
- **Food values (flat):** wildlife small, villagers large, building damage large (the existing
  combat city-damage XP). Eating a critter at L5 is the same XP as at L1 — there's just far more
  XP between levels.

### Constants (first-draft, tuned in playtest)
```
// evolution
MONSTER_STAGE_XP = [0, 100, 300, 800, 1800]  // xp to be at stage 1..5
STAGE_HP_BONUS = 40
STAGE_DAMAGE_BONUS = 4
// food
WILDLIFE_XP = 25
VILLAGER_XP = 120
CITY_DAMAGE_XP = 3          // monster xp per point of building damage (was 2)
// herds / mobs
WILDLIFE_HERD_COUNT = 3
MOB_PER_HERD = 5
VILLAGERS_AT_START = 5      // the single villager herd at the campfire
MOB_WANDER_SPEED = 2
MOB_FLEE_SPEED = 5.5        // monster speed is 6
HERD_WANDER_RADIUS = 6
SCATTER_RADIUS = 10
SCATTER_TICKS = 40
CATCH_RANGE = 1.5
HERD_RESPAWN_TICKS = 100
```

## Simulation changes (`@game/shared`)

- **Remove** `feedingSystem`, `map.wildlifeNodes`, and the `'feed'` path.
- **Add** pure systems:
  - `herdSystem(state)` — calm wander + scatter/flee for all mobs (both species).
  - `huntingSystem(state)` — eat-on-contact (species XP) + respawn.
- **Rework** `evolutionSystem` to 5 stages via `MONSTER_STAGE_XP` (threshold-only; no gate).
- **`step()` order:** `movement → herd → hunting → economy → building → combat → evolution →
  winCondition`.
- **`createInitialState`** spawns wildlife herds + one villager herd at the campfire; no wildlife
  nodes; `evolution.stage` starts 1.
- **`monsterBot`** hunts: move toward the nearest mob (prefer wildlife early is fine; nearest is
  enough). Eating is automatic.
- Determinism preserved (mobs use only seeded RNG).

## Client changes (`@game/client`)

- **Controls:** tapping a mob sets a **chase** target; the monster re-steers toward that mob's
  live position each tick until eaten or gone (`PointerControl.chaseMobId` replaces `feedNodeId`;
  `controlToInput` steers toward the chased mob). The `'feed'` tap intent and wildlife-node
  picking are removed; `pickTarget` returns `mob` picks (wildlife and villagers).
- **Rendering:** draw mobs — wildlife and villagers in distinct tints, with a flash/tint while
  fleeing; stop drawing wildlife nodes. HUD shows the monster level as `L/5`.

## Testing

- **herdSystem:** calm mobs stay near home; entering `SCATTER_RADIUS` flips the whole herd to
  fleeing and moves mobs away from the monster; `fleeTicks` decays to calm; same seed → same
  positions.
- **huntingSystem:** a wildlife mob in `CATCH_RANGE` grants `WILDLIFE_XP` and is removed; a
  villager grants `VILLAGER_XP`; respawn refills a depleted herd on the respawn tick.
- **evolutionSystem:** crossing each `MONSTER_STAGE_XP` threshold advances the stage (up to 5),
  adding HP + damage; idempotent; only upward.
- **integration:** eating wildlife reaches stage 2–3; reaching stage 5 within a sane tick budget
  requires villager/building XP (wildlife-only is slow). Replaces the old feed-then-stage-3 test.
- **monsterBot:** moves toward the nearest mob.
- **client:** `pickTarget` finds mobs; tapping a mob produces a chase; `controlToInput` steers
  toward the chased mob and stops when it's gone.

## Decomposition (two plans)

- **Plan A — Sim hunting + 5-level evolution:** mob/herd types + constants, `createInitialState`
  (wild + villager herds), `herdSystem`, `huntingSystem`, reworked `evolutionSystem`, wire
  `step()` (remove feeding), update `monsterBot`, fix shared tests.
- **Plan B — Client hunting:** mob rendering (wildlife vs villagers), tap-to-chase pointer logic,
  HUD `L/5`, remove feed UI, fix client tests; build + serve verification.

After Plan A the sim/bots hunt and level to 5 (proven in tests); Plan B makes it playable and visible.
