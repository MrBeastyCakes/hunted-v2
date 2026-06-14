# Blacksmith & Equippable Weapons (Design Spec)

**Date:** 2026-06-14
**Status:** Approved design — ready for implementation planning
**Motivation:** Playtest feedback — heroes have effective "ranged" attacks from the start
(hero attack range 3 > monster bite range 2). Defense should be *earned*: heroes start
unarmed, and the builders must build a **Blacksmith** and craft **swords/bows** to arm.

## Goal

Heroes begin as weak unarmed townsfolk. The builders invest in a **Blacksmith** to craft
**weapons** that appear on a **rack** beside it; a hero **taps a weapon to walk over and equip
it**. Swords make a hero a strong melee fighter; bows give ranged defense. Bots do the same, so
the AI defenders arm up over a match.

## Core rules

- **Unarmed heroes:** short reach, low damage (`UNARMED_RANGE` 1.4, `UNARMED_DAMAGE` 2). The
  monster (bite range 2) out-reaches them early.
- **Blacksmith:** a new buildable (placed via the campfire build menu, like other structures).
- **Crafting:** tapping the Blacksmith opens a **craft menu** (Sword / Bow, each costing
  materials). Crafting spawns a **weapon pickup** on the rack — a fixed offset beside the
  Blacksmith (multiple stack with small offsets).
- **Equip by tapping:** tap a weapon on the rack; your hero walks to it and **equips on contact**
  (the pickup is removed). Equipping replaces the hero's current weapon. Sets the hero's combat:
  - **Sword:** `SWORD_RANGE` 1.8, `SWORD_DAMAGE` 8 (strong melee).
  - **Bow:** `BOW_RANGE` 9, `BOW_DAMAGE` 4 (ranged).
- **Combat** keeps using `hero.combat` (range/damage/cooldown); equipping mutates those fields.
  The Workshop's `+damage` buff still stacks on top.
- **Bots arm up:** a hero bot builds a Blacksmith if none exists, crafts a weapon if unarmed and
  none is on the rack, and walks to grab a weapon on the rack. Defenders prefer swords, scouts
  prefer bows.

## Data model (`@game/shared`)

- `WeaponType = 'sword' | 'bow'`.
- `WeaponItem { id, type: WeaponType, pos: Vec2 }` — a world pickup on a rack.
- `GameState.map.weapons: WeaponItem[]`.
- `Entity.equipped?: WeaponType` (heroes; undefined = unarmed).
- `BuildingType` gains `'blacksmith'`; `BuildableType` (cost.ts) gains `'blacksmith'`.
- `ActionType` gains `'craft'`; `Input` gains `craftType?: WeaponType`.

### Constants (first-draft)
```
UNARMED_RANGE = 1.4   UNARMED_DAMAGE = 2
SWORD_RANGE   = 1.8   SWORD_DAMAGE   = 8
BOW_RANGE     = 9     BOW_DAMAGE     = 4
CRAFT_COST    = { sword: 30, bow: 45 }
BLACKSMITH cost 60 / hp 35
PICKUP_RANGE = 1.2
RACK_OFFSET  = { x: +3, y: -2 } from the blacksmith (stack extras by index)
```

## Systems (`@game/shared`)

- **`craftingSystem(state, inputs)`** — a hero whose input has `action: 'craft'` + `craftType`,
  when a Blacksmith exists and materials ≥ `CRAFT_COST[type]`, spends materials and spawns a
  `WeaponItem` at the (first) Blacksmith's rack (offset by current weapon count for spacing).
- **`equipSystem(state)`** — for each weapon pickup, if a hero is within `PICKUP_RANGE`, the
  nearest such hero equips it: set `equipped`, set `hero.combat.range/damage` to the weapon's;
  remove the pickup.
- **`buildingSystem`** — extended to allow building `'blacksmith'`.
- **`combatSystem`** — unchanged (heroes already read `hero.combat`, which equipping updates).
- **`step()` order:** `movement → herd → hunting → economy → building → crafting → equip →
  combat → evolution → winCondition`.
- **`createInitialState`** — heroes start unarmed (`UNARMED_*` combat, `equipped: undefined`);
  `map.weapons = []`.
- **`heroBot`** — arming priority (below swarm-when-threatened): grab a rack weapon if unarmed →
  else craft if a blacksmith exists & affordable → else build a blacksmith if none & affordable →
  else existing build/hold behavior.

## Client (`@game/client`)

- **Pointer:** `pickTarget` includes weapons (`kind: 'weapon'`) and the blacksmith building.
  `resolveTapIntent`: a hero tapping a **weapon** → move to its position (equip on contact); a
  hero tapping a **Blacksmith** → `openCraftMenu`. (Monster tapping a building still attacks.)
- **Craft menu:** tapping the Blacksmith opens a small menu (Sword / Bow + costs, greyed if
  unaffordable) — same pattern as the campfire build menu; selecting emits a one-shot `craft`
  input.
- **Rendering:** draw the Blacksmith (distinct color), weapon pickups on the rack (sword vs bow
  tint), and a small **equipped indicator** on armed heroes (e.g., a ring/tint by weapon).
- **Build menu:** add **Blacksmith** to the campfire blueprint list.

## Decomposition (two plans)

- **Plan 1 — Sim:** types/constants, unarmed heroes, blacksmith building, `craftingSystem`,
  `equipSystem`, weapon-based combat, step wiring, bot arming, tests.
- **Plan 2 — Client:** craft menu, weapon-rack rendering + equipped indicator, tap-to-equip /
  tap-blacksmith, blacksmith blueprint, tests + build; then **redeploy**.

After Plan 1 the sim arms heroes (proven by tests + the autonomous match). Plan 2 makes it
playable/visible and ships it.

## Out of scope (later)

Weapon tiers/upgrades, ammo, durability, dropping weapons back on death, per-role stat
differences beyond weapon choice, win-path balance.
