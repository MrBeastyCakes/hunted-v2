# The Full Monster: Senses, Skill Tree & Prey Tiers (Design Spec)

**Date:** 2026-06-14
**Status:** Draft for review — defines the complete monster experience; decomposed into sub-projects.
**Motivation:** Player's monster design — a sensory-deprivation predator that **feeds to buy back its
senses** via a skill tree. Starts nearly blind, deaf, and scentless; spends XP to perceive the world
and hunt ever-bigger prey.

## The fantasy

You wake as a near-senseless thing: a small blurred bubble of sight, no hearing, no smell. Everything
beyond your nose is darkness. You **feed** to gain XP and **spend** it on three senses — **Vision,
Hearing, Smell** — each opening up how you perceive and hunt. Small prey is free calories; bigger prey
must be run down, killed, or fought; the tastiest prey (the townsfolk — the human players) is the most
dangerous. Specialize: you can't max everything in one life.

## How this fits the existing game

- The existing **1v4** stays: one monster (you) vs four builder-players. The **builders are the
  "villagers"** — player-controlled, 100 XP when you down and feed on one.
- **Critters** = today's wildlife mobs. We add **Medium** and **Large** neutral creature tiers.
- This **replaces the current auto-evolution** (`MONSTER_STAGE_XP` → HP/damage per stage) with an
  **XP-spend skill tree**; leveling still grants a small auto power bump so you can kill bigger prey.
- Reuses today's mob HP / bite-down hunting, herds/roaming, tap-to-move/chase, and the menu-overlay
  pattern (build/craft menus → a new skill menu).

## Decisions (locked unless you change them)

1. **XP is spent**, not just accumulated. Feeding banks XP; buying a rank deducts its cost.
2. **Level cost = 25 × level** (L2 50 … L8 200, continuing +25). 12 ranks exist (3 paths × 4) so you
   typically afford ~7–8 in a match → forced specialization.
3. **Each level also grants** +`LEVEL_HP_BONUS` and +`LEVEL_DAMAGE_BONUS` (auto), so perception and
   power rise together. Senses remain the only *chosen* upgrades.
4. **Skill tree UI:** tap your own monster → skill menu (Vision/Hearing/Smell, next rank + cost,
   greyed if unaffordable). One tap buys the next rank in a path.
5. **Hearing renders as visual sound-pings** (creature-type icon + direction) for in-range unseen
   creatures; optional real audio later.
6. **Villagers = the 4 hero players**; Medium/Large = new neutral wildlife species.

## Progression

- **Feed → XP** (banked, spendable):
  - Critter **10**, Medium **20**, Large **40**, Villager (hero) **100**.
- **Spend XP** to raise a sense path one rank. Cost to go from level *n* → *n+1* is `25 × (n+1)`.
  (Your overall **monster level** = total ranks bought + 1; starts at level 1.)
- Each rank bought (level gained) auto-adds `LEVEL_HP_BONUS` (e.g. 25) and `LEVEL_DAMAGE_BONUS`
  (e.g. 2). Senses themselves give perception, not combat.

### Sense paths (sim stores `vision`, `hearing`, `smell` ranks 0–4)

**Vision** — how much of the world you see clearly (clear radius + blur + zoom).
- 0 (base): small clear radius (~6m), heavy blur beyond, black past the blur.
- 1: blur lessened.
- 2: whole visible area unblurred.
- 3: zoom out (see more of the map).
- 4: zoom out more.

**Hearing** — perceive creatures you can't see, as sound-pings.
- 0: deaf (no info on unseen things).
- 1: hear creatures within **10m** (generic ping + direction).
- 2: **20m**; tell sound types apart (ping icon differs by tier).
- 3: clear — exact direction **and distance** shown.
- 4: **40m**.

**Smell** — track scents: highlight qualifying targets in range + a pointer to them.
- 1: highlight **rancid** smells (carcasses / large creatures) within **20m**.
- 2: **40m**; includes **cooked food** (the city's resources/economy).
- 3: smell **living creatures** within **10m**.
- 4: tell **species** apart; creatures to **20m**, other smells to **30m**.
(Smell rank 0 = no smell.)

## Prey tiers (neutral creatures + the player villagers)

| Tier | XP | Feeding | Behavior |
|---|---|---|---|
| **Critter** (small) | 10 | feed with no effort (low HP, dies in ~1 bite) | flees |
| **Medium** | 20 | must **kill/knock out** first (more HP) | flees; tougher |
| **Large** | 40 | must **kill** first | **attacks you**; may flee |
| **Villager** (hero) | 100 | must down the hero, then feed | player-controlled, unpredictable |

- Implemented on today's mob HP + bite-down: tiers differ in **HP, flee/attack AI, and XP**.
- "Knock out" (medium) = reduced to 0 HP non-lethally then fed on; for v1 we treat down==feedable
  (the knockout flavor/animation is a later polish).
- **Large attacks**: a large creature has a small `Combat` and damages the monster in melee, so
  fighting one is a real risk — incentive to upgrade power (via leveling) before hunting large.
- Feeding a **villager/hero**: when a hero's HP hits 0 (downed), the monster feeding on the corpse
  grants 100 XP (ties leveling to the "pick off a player" fantasy).

## Architecture & decomposition (sub-projects, each its own plan)

This is large; build it in order, each shippable:

1. **Sim — Senses & skill-tree progression.** Replace `evolutionSystem` with a `skillTree`
   (`monster.skills = { vision, hearing, smell }`, `monster.xp` spendable, `monster.level`); a pure
   `spendOnSkill(state, path)` (validates cost `25×level`, deducts, raises rank, applies level
   power bump). Hunting grants XP per tier instead of auto-evolving. Bots auto-spend XP (pick a
   path). Tests + determinism.
2. **Sim — Prey tiers.** Add `tier`/species to mobs (critter/medium/large) with HP, flee-vs-attack
   AI, and XP; large creatures attack the monster; villager(hero) feed-on-down = 100 XP. Spawn a mix
   of tiers in herds. Tests.
3. **Client — Vision system.** A fog/darkness overlay with a clear circle around the monster, a
   blurred band, black beyond; camera zoom + blur strength driven by `vision` rank. Pure helpers for
   radius/zoom/blur per rank (tested); overlay is render glue.
4. **Client — Skill-tree menu.** Tap the monster → skill menu (3 paths, next rank + cost, affordability);
   buy emits a one-shot "spend" input. Reuses the menu-overlay pattern.
5. **Client — Smell system.** Outline/highlight qualifying targets in range by `smell` rank + a
   directional pointer. Pure "what's smellable" selection (tested); render glue.
6. **Client — Hearing system.** Visual sound-pings (type icon + direction, distance at rank 3) for
   in-range unseen creatures by `hearing` rank. Pure "what's audible" selection (tested); render glue
   (+ optional audio later).

Recommended build order: **1 → 3 → 4** (you can see, level, and spend), then **2** (real prey to
hunt), then **5 → 6** (smell, hearing). Each plan ends green + deployable.

## Out of scope (later)

Real audio for hearing; knockout animations; per-species smell variety beyond the ranks above; a
respec; balancing the full 1v4 win condition around the new monster.

## Testing themes

- Pure & deterministic where it counts: `spendOnSkill` (cost/deduct/cap), tier XP on kill, per-rank
  vision radius/zoom, smellable/audible target selection. Render overlays verified by build + playtest.
