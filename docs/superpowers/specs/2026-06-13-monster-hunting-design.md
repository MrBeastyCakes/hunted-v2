# Monster Hunting Overhaul (Design Spec)

**Date:** 2026-06-13
**Status:** Approved design — ready for implementation planning
**Motivation:** Playtest feedback — "the monster has nothing to do but die." The monster's
early game (tap a static wildlife node to passively drain XP) has no agency. This replaces
it with an active, skillful **hunt of roaming herds**.

## Goal

Give the monster a compelling core activity: **stalk and eat herds of passive mobs.**
Herds wander the map; approaching scatters them; the monster commits to a target, cuts off a
straggler, and eats it for evolution XP. Replaces static wildlife nodes + the "feed" action.

## Out of scope (deliberate — next iteration)

- **Win-path balance.** Assaulting a defended campfire is still hard; this spec does NOT fix
  that. We change one thing at a time so the hunt can be felt on its own. Stage thresholds and
  the stage-3 city-damage gate are unchanged.
- Builders interacting with mobs (mobs are monster food only).
- The `food` resource (still unused).

## The hunt model

### Entities
- **Mob** — a passive critter: `{ id, herdId, pos, state: 'calm' | 'fleeing', fleeTicks }`.
- **Herd** — `{ id, home: Vec2 }`. Mobs reference their `herdId`; `home` is the roam/regroup point.
- `GameState.map` gains `mobs: Mob[]` and `herds: Herd[]`, and **drops `wildlifeNodes`**.
  `resourceNodes` stays (still unused/deferred).

### Behavior (all deterministic — seeded RNG in `GameState.rngState`)
- **Calm:** a mob makes a small step; if it has drifted beyond `HERD_WANDER_RADIUS` of its
  herd home it steps back toward home, otherwise it steps in a seeded random direction
  (`nextRandom`), at `MOB_WANDER_SPEED`.
- **Scatter trigger:** if the monster is within `SCATTER_RADIUS` of *any* mob in a herd, every
  mob in that herd enters `fleeing` with `fleeTicks = SCATTER_TICKS`.
- **Fleeing:** the mob moves directly away from the monster at `MOB_FLEE_SPEED` (just under the
  monster's speed, so a committed chase catches a straggler but the herd sprays apart);
  `fleeTicks` counts down; at 0 it returns to `calm`.
- **Eat on contact:** any mob within `CATCH_RANGE` of the living monster is removed and grants
  `XP_PER_MOB` to `monster.evolution.xp`. No action button — eating is automatic.
- **Respawn:** every `HERD_RESPAWN_TICKS`, each herd below `MOB_PER_HERD` spawns one new mob at
  its home, keeping the hunt sustainable.

### Constants (first-draft values, tuned in playtest)
```
HERD_COUNT = 3
MOB_PER_HERD = 5
MOB_WANDER_SPEED = 2
MOB_FLEE_SPEED = 5.5        // monster speed is 6
HERD_WANDER_RADIUS = 6
SCATTER_RADIUS = 10
SCATTER_TICKS = 40          // 2s at 20Hz
CATCH_RANGE = 1.5
XP_PER_MOB = 25             // ~4 mobs -> stage 2 (STAGE2_XP 100)
HERD_RESPAWN_TICKS = 100    // every 5s
```

## Simulation changes (`@game/shared`)

- **Remove** `feedingSystem` and `map.wildlifeNodes`; remove the `'feed'` path. (`ActionType`
  keeps its other values; `'feed'` becomes unused and may be dropped.)
- **Add** two pure systems under `systems/`:
  - `herdSystem(state)` — calm wander + scatter/flee movement for all mobs.
  - `huntingSystem(state)` — eat-on-contact (XP) + periodic respawn.
- **`step()` order:** `movement → herd → hunting → economy → building → combat → evolution →
  winCondition`. (Hunting adds XP before evolution reads it, same as feeding did.)
- **`createInitialState`** spawns `HERD_COUNT` herds with `MOB_PER_HERD` mobs each at spread-out
  homes; no more wildlife nodes.
- **`monsterBot`** hunts: move toward the nearest mob (eating is automatic). Replaces feed logic.
- Determinism preserved (mobs use only seeded RNG); the determinism test still holds.

## Client changes (`@game/client`)

- **Controls:** tapping a mob sets a **chase** target — the monster re-steers toward that mob's
  live position each tick until it's eaten or gone. `PointerControl` replaces `feedNodeId` with
  `chaseMobId`; `controlToInput` steers toward the chased mob. The `'feed'` tap intent is
  removed; `pickTarget` returns `mob` picks instead of `wildlife`.
- **Rendering:** draw mobs as small dots (a distinct tint while fleeing); stop drawing wildlife
  nodes. The monster, heroes, buildings, campfire label, ghost, HUD, banner are unchanged.

## Architecture & isolation

Each new unit has one job and is independently testable:
- `herdSystem` — mob movement only (calm + scatter). Pure, deterministic.
- `huntingSystem` — eat + respawn only. Pure, deterministic.
- Client `pointer` chase logic — pure (`controlToInput` steers toward a mob by id).
- Renderer mob drawing — thin, build-verified.

## Testing

- **herdSystem:** mobs stay near home while calm; entering `SCATTER_RADIUS` flips the whole
  herd to fleeing and moves mobs away from the monster; `fleeTicks` decays to calm; same seed →
  same positions (determinism).
- **huntingSystem:** a mob within `CATCH_RANGE` is removed and grants `XP_PER_MOB`; respawn
  refills a depleted herd on the respawn tick.
- **monsterBot:** moves toward the nearest mob.
- **integration:** the monster eats enough mobs to reach stage 2 (replaces the old
  "feed-then-stage-3" test, which becomes "hunt-then-stage-3").
- **client:** `pickTarget` finds mobs; tapping a mob produces a chase; `controlToInput` steers
  toward the chased mob and stops when it's gone.

## Decomposition (two plans)

- **Plan A — Sim hunting:** types/constants, `createInitialState` herds, `herdSystem`,
  `huntingSystem`, wire `step()` (remove feeding), update `monsterBot`, fix shared tests.
- **Plan B — Client hunting:** mob rendering, tap-to-chase pointer logic, remove feed UI, fix
  client tests; build + serve verification.

Each plan leaves the game working: after Plan A the sim/bots hunt (proven in tests); Plan B makes
it playable and visible.
