# Mobile-Compatible Pointer Controls (Design Spec)

**Date:** 2026-06-13
**Status:** Approved design — ready for implementation planning
**Builds on:** the completed vertical slice (Plans 1–5).

## Goal

Make the game playable on phones/tablets with touch, using a **unified pointer model**
that also works with a mouse on desktop. **No on-screen buttons** — you tap to move and
tap things to interact. Building is done through the **campfire** (the level-1 form of the
city core), which doubles as the build menu.

## Decisions (locked)

- **Pointer-unified, both platforms.** Tap/click controls work on mobile and desktop;
  **WASD/arrows remain an optional desktop fallback** (the keyboard path from Plan 3 stays).
- **The core stays type `core`.** Its level-1 display name is **"Campfire"**; it upgrades
  into higher-level structures over time (future work). The existing `Building.level` field
  carries this. No sim type rename.

## Interaction model

All interactions are driven by a single pointer (touch or mouse). A tap resolves to a
**world point** (inverse isometric projection) and then to an **intent**:

- **Tap empty ground** → set a persistent **move target**; the controlled actor walks
  toward it each tick until it arrives (within an arrival epsilon), then stops. The client
  turns "current pos → move target" into the per-tick `Input.move` vector. **No sim change.**
- **Tap a wildlife node** (monster) → move to it; when within `FEED_RANGE`, emit `action:'feed'`.
- **Tap a building** (monster) or **tap the monster** (hero) → move into range; combat
  auto-resolves (Plan 2). No explicit action needed.
- **While spectating** (dead hero) → tap a living actor to follow them (replaces Tab/Space
  cycling on touch; cycling stays for keyboard).

Hit-testing: a tap picks the nearest interactable (node / building / monster / hero) within
a screen-space pick radius; if none, it's a move tap.

## Campfire build menu (heroes)

- **Tap the campfire** (a `core` building) → open a **build menu**: blueprints
  **Tower / Generator / Workshop** with costs, greyed/disabled when unaffordable.
- **Select a blueprint** → enter **placement mode**:
  - **Double-tap** a spot → drop a translucent **ghost** of the building there (re-double-tap
    to reposition).
  - **Single-tap the ghost** → confirm; emit a build `Input` with `buildType` and
    `target` = the ghost's world position (the sim already builds at a target position).
  - **Tap the campfire again** (or a menu close control) → cancel placement.
- The **monster** tapping the campfire does **not** open a menu — it attacks (move into range).

## Mobile viewport hardening

- Disable browser pinch-zoom, scroll, and double-tap-zoom on the canvas
  (`touch-action: none` + `preventDefault` on pointer events; viewport meta already present).
- Respect **device pixel ratio** so rendering is crisp on high-DPI screens.
- Size the HUD/menu text and the start menu for small screens.

## Architecture

Keep logic in **pure, unit-tested** modules; keep DOM/Pixi glue thin (build/run-verified).

- **Pure (tested):**
  - `screenToWorld(screen, tileW, tileH, origin)` — inverse of `worldToScreen` (Plan 3).
  - `pickTarget(state, worldPoint, pickRadius)` — nearest interactable + its kind, or none.
  - `moveTargetToInput(actor, target, arrivalEps)` — per-tick `Input.move` toward a target,
    zero when arrived.
  - `resolveTapIntent(state, controlledId, worldPoint, pickRadius)` — maps a tap to an intent
    (move-to-point / interact-with-target), the brain shared by both sides.
  - Build-menu helpers: `affordableBlueprints(state)`, blueprint cost lookup.
- **Impure (build/run-verified):**
  - Pointer event listeners (replace/augment keyboard), translating events into the pure
    resolvers and updating a small controller state (current move target / interact target /
    placement mode + ghost position).
  - Build-menu DOM overlay + ghost rendering in the PixiJS scene.
  - Viewport/DPR/canvas hardening.

The sim (`@game/shared`) is unchanged except possibly exporting a couple of constants already
present. Bots, determinism, and all existing tests stay intact.

## Decomposition (two plans)

- **Plan 6 — Pointer control + viewport hardening:** `screenToWorld`, `pickTarget`,
  `moveTargetToInput`, `resolveTapIntent`; pointer wiring into the loop (tap-to-move,
  tap-to-interact, spectate tap); DPR + zoom/scroll hardening; "Campfire" display label on
  the core. Keyboard fallback retained.
- **Plan 7 — Campfire build menu + ghost placement:** tap-campfire menu, blueprint select,
  double-tap ghost placement, single-tap confirm → build-at-target; affordability gating.

Each plan ships working, testable software on its own (Plan 6 is fully playable by
touch/mouse for moving and fighting; Plan 7 adds touch building).

## Out of scope (later)

Core upgrade levels beyond Campfire; multi-touch gestures; gamepad; haptics; full art pass.
```
