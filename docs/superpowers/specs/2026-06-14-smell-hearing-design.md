# Smell & Hearing Senses (Design Spec)

**Date:** 2026-06-14
**Status:** Draft for review, then build.
**Context:** Monster sub-projects 5 (Smell) & 6 (Hearing). The skill menu already sells these ranks;
this adds their *perception effects*. Both are **client-only** (read sim state), apply **only when
controlling the monster**, and render **on top of the fog** so they let you perceive things in the
dark — the whole payoff of investing in a non-vision sense.

## Shared approach

- A pure selector per sense decides *what is currently perceivable* given the monster's rank +
  world state (positions/tiers). Unit-tested.
- A render overlay (above the fog sprite, below the HUD) draws the indicators each frame.
- "Creatures" = mobs (critter/medium/large/villager) + heroes. The monster never perceives itself.

## Smell — track scents (outline + directional pointer)

Scent **categories** and their sources:
- **rancid** — large creatures (big, foul beasts). (Carcasses later.)
- **cooked food** — the city's buildings (the settlement smells of cooking); strongest at the campfire.
- **living** — other living creatures: critters, medium, villagers, heroes.

Per-rank detection range (world units), non-decreasing:
| rank | rancid | cooked food | living | species ID |
|---|---|---|---|---|
| 0 | – | – | – | no |
| 1 | 20 | – | – | no |
| 2 | 40 | 40 | – | no |
| 3 | 40 | 40 | 10 | no |
| 4 | 40 | 40 | 20 | **yes** |

Render: each smellable source within range gets a **colored outline ring** at its position (drawn
over the fog, so visible in the dark). Color = category tint by default; at **rank 4** color encodes
the **species/type** (critter vs medium vs large vs villager vs building). If a source projects
**off-screen**, draw an **arrow at the screen edge** pointing toward it ("points to them").

Pure selector: `smellTargets(state, rank) -> { id, pos, category, kind }[]`.

## Hearing — sound-pings for unseen creatures

Reveals **creatures** within range as **pulsing sound rings** at their location (over the fog).
| rank | range | tell types | show distance |
|---|---|---|---|
| 0 | deaf | – | – |
| 1 | 10 | no (generic ping) | no |
| 2 | 20 | **yes** (ring color by type) | no |
| 3 | 20 | yes | **yes** (distance label) |
| 4 | 40 | yes | yes |

Render: for each audible creature, a **ring that pulses** (radius animates with the tick) at its
screen position; color generic at rank 1, by creature type at rank ≥ 2; a small **distance number**
(in metres = world units) at rank ≥ 3. Pings draw over the fog, so you "hear" things you can't see.

Pure selector: `hearTargets(state, rank) -> { id, pos, kind, distance }[]`.

## Render order (renderer)

world (entities, zoomed/clipped) → fog sprite → **sense overlay (smell outlines + edge arrows,
hearing pings + labels)** → HUD/banner. The sense overlay is a Graphics on the stage above the fog.

## Architecture / testing

- `render/senses.ts` (pure): `smellTargets`, `hearTargets`, plus small helpers (per-rank ranges,
  type→color). Unit-tested with `createInitialState`.
- `renderer.ts`: a `senseOverlay` Graphics; draw smell outlines/arrows + hearing pulses each frame
  when `controlledId === monster`. Verified by build + playtest.
- No `@game/shared` changes.

## Decisions to confirm

1. **Scent mapping:** rancid = large beasts, cooked food = buildings, living = other creatures. (OK?)
2. **Render styles:** smell = outline ring + off-screen edge arrow; hearing = pulsing ring + distance
   label at rank 3. (OK?)
3. Build order: **Smell first, then Hearing.**

## Out of scope (later)

Real audio for hearing; carcass/scent-trail decay; smelling dropped weapons/resources; minimap.
