# "Make It a Game" Pass: Visuals + Gathering + Roaming (Design Spec)

**Date:** 2026-06-14
**Status:** Approved design — ready for planning
**Motivation:** Player request — "make this look more like a game, enhance the AI, animals should
wander." Three cohesive improvements that make the world feel alive and give heroes a reason to
leave the campfire (reviving the monster's ambush fantasy).

## Build order: visuals first, then gathering/roaming, then redeploy.

## Part 1 — Visual overhaul (Plan B, first)

All **code-drawn** (PixiJS Graphics, no art assets). Renderer-only (`@game/client`).

- **Isometric tiled ground:** a checkerboard of iso diamond tiles across the map bounds (two
  grass shades) instead of one flat slab, with subtle edges.
- **Real entity shapes** (replace flat dots), each with a soft **shadow ellipse** for grounding
  and **depth-sorted** by `world.x + world.y` so nearer things overlap farther:
  - **Monster:** a large menacing body (spiky polygon) that visibly **grows with level**, outlined.
  - **Heroes:** a rounded body in role color, an **equipped ring** (sword/bow tint), and a small
    **facing** triangle in the move direction.
  - **Buildings:** short **isometric boxes** (top diamond + two shaded side faces) per type; the
    campfire (core) larger/brighter.
  - **Mobs:** wildlife = tiny critter; villager = little figure (body + head).
  - **Weapons on rack:** small sword/bow markers.
- HP bars and the existing HUD/menus stay (lightly restyled if cheap).

## Part 2 — Resource gathering (Plan A, second)

Sim + AI (`@game/shared`), small client tap support.

- The map's `resourceNodes` become **harvestable**: a hero within `GATHER_RANGE` of a node drains
  `GATHER_RATE`/tick into the shared `materials` pool, depleting the node's `amount`. Depleted
  nodes **replenish slowly** (or are plentiful) so gathering is sustainable.
- **Hero bots venture out:** when not threatened and not mid-arming, a hero walks to the nearest
  non-empty resource node and harvests, then returns to building. This exposes lone heroes to the
  monster (emergent ambush gameplay).
- **Player gathering:** tapping a resource node makes the hero walk to it and harvest on contact.
- Gathering **supplements** the existing generators (does not replace them). Building **upgrades**
  (levels) are out of scope this round.

## Part 3 — Animals roam (Plan A, with gathering)

- Wildlife herds wander a **wider radius** and **slowly migrate** (the herd `home` drifts over
  time within map bounds), so prey moves across the map and the world feels alive. Villagers still
  cluster at the campfire. Stays deterministic (seeded RNG).

## Constants (first-draft)
```
GATHER_RANGE = 2.5
GATHER_RATE = 4         // materials/tick while harvesting
RESOURCE_NODE_AMOUNT = 300   // per node (raise from 100)
NODE_RESPAWN_TICKS = 300     // depleted node regains some amount
NODE_RESPAWN_AMOUNT = 100
// roaming
HERD_WANDER_RADIUS: 6 -> 14
HERD_MIGRATE_TICKS = 120     // how often a wildlife herd's home drifts
HERD_MIGRATE_STEP = 6        // how far home drifts
```

## Architecture / isolation

- **Plan B (visuals):** confined to `renderer.ts` + `config.ts`; pure helpers (`isoBox` corner
  math, `depthKey`) get unit tests; the draw code is build/run-verified. No sim changes.
- **Plan A (gathering + roaming):** new pure `gatheringSystem` (harvest + node respawn) wired into
  `step()`; `herdSystem` gains wider wander + periodic home migration; `heroBot` gains a gather
  behavior; client `pointer` lets a hero tap a resource node (move-to, harvest on contact). All
  deterministic; unit-tested.

## Testing

- Visuals: pure helpers tested; overall verified by build + dev-serve + playtest.
- Gathering: a hero on a node drains it and gains materials; depleted node respawns on its tick;
  hero bot walks to the nearest node when idle/safe.
- Roaming: wildlife wander radius is wider; a herd's home migrates after `HERD_MIGRATE_TICKS`;
  determinism preserved.

## Out of scope (later)

Building/core upgrade levels; carry capacity / deposit-at-campfire; fog-of-war; sprite art;
win-path balance.
