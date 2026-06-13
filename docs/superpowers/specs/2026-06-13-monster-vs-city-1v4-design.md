# Monster vs City — 1v4 Asymmetric Web Game (Design Spec)

**Date:** 2026-06-13
**Working title:** Monster City 1v4 (rename freely)
**Status:** Approved design — ready for implementation planning

## 1. Concept

An asymmetric **1v4** real-time, browser-based game. One player controls a growing
**monster**; four players cooperatively run a single **RPG city builder**. Both sides
climb a power curve in parallel — it's a **race**:

- **Monster wins** by razing the **City Core** (HP → 0).
- **Builders win** by killing the **fully-grown monster** (HP → 0).

The monster starts weak. Its only early aggression is the high-risk gamble of picking
off an isolated hero; otherwise it hides and feeds. The builders must gather, build, and
out-tech the monster before it grows strong enough to assault the city core.

### Pacing — pressure escalation
Continuous real-time (no hard phases). The monster can act anytime but is too weak early
to threaten the city; the threat **escalates** through evolution stages.

### Monster growth — hybrid feeding
- **Early:** feed on neutral **wildlife nodes** out in the map (safe XP) — keeps the
  monster away from the city, creating map-control / scouting tension.
- **Late:** the biggest evolution jumps require **risky attacks on the city**, exposing
  the monster to defenders.

### The 4-player side — shared city, specialized roles
All four co-op build **one shared city** and draw from a **shared resource pool**, but
each player owns a **specialized role + a hero avatar** (vulnerable units in the world):
- **Builder** — builds/repairs faster
- **Defender** — tanky melee, draws monster aggro
- **Scout** — fast, ranged, reveals the monster
- **Economy** — boosts resource generation

Losing a teammate genuinely hurts because of the role interdependence, which is what makes
the monster's "pick off the isolated hero" play strategically valuable.

## 2. Goals & constraints

- **North star:** a *shippable* web game (Steam/itch eventually). Quality bar matters.
- **First milestone:** a **vertical slice** — the smallest version that proves the
  kill-vs-raze tension is fun.
- **Platform:** browser (2D **isometric / top-down**).
- **Developer:** experienced; wants a strong collaborator, not hand-holding.

## 3. Build strategy — single-player first, networked-shaped

The user chose **single-player first** for fast, fun-focused iteration. To avoid the
classic failure (writing local code that must be torn out for multiplayer), the
**simulation is built transport-agnostic from day one**:

- The sim is a pure, headless module driven **in-process** now (browser runs it locally,
  bots fill the other seats).
- Later, the **exact same sim module** runs on an authoritative **Colyseus** server;
  clients send inputs and receive state. **Networking becomes a wrapper, not a rewrite.**

Guiding principle for the eventual online version: **authoritative server, thin clients**
(server is truth; clients send intent + render). This is designed in now, implemented later.

## 4. Tech stack

TypeScript end-to-end, **pnpm monorepo**:

```
game/
├─ packages/
│  ├─ shared/     ← the headless sim + all types & balance constants
│  │   ├─ sim/    ← pure functions: step(state, inputs) → state
│  │   ├─ types/  ← Entity, GameState, Input, components, etc.
│  │   └─ data/   ← balance numbers (monster stages, building costs…)
│  ├─ client/     ← PixiJS renderer + input capture + bot drivers (Vite)
│  └─ server/     ← (stub for now) Colyseus room that will later wrap shared/sim
└─ pnpm-workspace.yaml
```

- **Renderer:** PixiJS (fast 2D WebGL). *(Alt considered: Phaser — more batteries-included.)*
- **Server (later):** Node + Colyseus (room-based authoritative netcode, ideal for 1v4
  rooms). *(Alt considered: geckos.io/WebRTC, only if UDP-level latency ever needed — overkill.)*
- **Bundler:** Vite (client).

## 5. Simulation core (`shared/sim`) — the heart

A pure, **deterministic, fixed-timestep** simulation:

- Fixed tick rate **20 Hz**. `step(state, inputsThisTick) → nextState`.
- **No Pixi, no DOM, no networking, no unseeded randomness.** RNG is seeded
  (`rngSeed` in state). This is what makes it transport-agnostic and testable.
- State is plain serializable data (so it can later be diffed/sent over the wire).
- Organized as a lightweight **ECS**: entities + components + systems. Systems are
  independently testable, e.g. `MovementSystem`, `FeedingSystem`, `EvolutionSystem`,
  `CombatSystem`, `BuildingSystem`, `WinConditionSystem`.

### Game state shape

```ts
GameState {
  tick: number
  phase: 'lobby' | 'playing' | 'monsterWon' | 'buildersWon'
  rngSeed: number
  map: { width, height, terrain, wildlifeNodes[], resourceNodes[] }
  monster: Entity        // 1
  heroes: Entity[]       // up to 4, one per role
  buildings: Building[]  // incl. the City Core
  resources: { materials, food }   // shared team pool
}
```

Components include `Position`, `Health`, `Velocity`, `Combat` (dmg/range/cooldown),
`Evolution` (xp/stage), `Role` (builder/defender/scout/economy), `AI`.

### Input model — intent, never state

Each controllable actor emits a small `Input` per tick:

```ts
Input { actorId, move: {x,y}, action?: 'attack'|'feed'|'build'|'ability', target?: id|pos }
```

The sim consumes inputs and *decides* outcomes; clients never mutate state directly.
This rule makes the eventual networked build cheat-resistant and lets bots and humans be
interchangeable.

### Bots = input producers

`botThink(state, actorId) → Input`. A bot and a human are identical from the sim's view,
so single-player (you + bots) and multiplayer (5 humans) are the **same code path** with
different input sources. Both a **monster bot** and **role bots** are built (also needed
later to fill empty seats online).

### Client frame loop (now)

```
gather local Input  ─┐
bot Inputs          ─┼─► step(state, allInputs) ─► render(state) w/ interpolation
                     ─┘   (fixed 20Hz sim; render at display refresh)
```

## 6. Rendering (`packages/client`)

- PixiJS draws an iso/top-down view of `GameState` each display frame, **interpolating**
  between the latest two 20 Hz states for smooth motion.
- Renderer is a **pure function of state** — reads, never writes.
- Camera follows the player's controlled entity.
- **Placeholder art** (colored sprites/shapes) for the slice; art polish is a later pass.

## 7. Vertical-slice scope

The smallest build containing the whole loop (feed→evolve→raze vs gather→build→slay).

**Map:** one small fixed iso map. Center = city zone. ~4 **wildlife/feeding nodes**
(monster XP) + ~3 **resource nodes** (builder materials). A few obstacles.
**No fog-of-war yet** (added later; scouting becomes meaningful then).

**Monster:**
- Move, basic melee, **feed** on wildlife → XP.
- **3 evolution stages.** S1: weak/fast/fragile (hide & pick-off gamble). S2: gains AoE
  attack + more HP. S3: can credibly assault the city. Biggest stage jumps require
  **city damage**, not just wildlife (hybrid mechanic).
- Has HP; killable if builders out-tech it.

**4 hero roles** (each one distinct ability, as in §1).

**City:**
- **City Core** (HP — monster's win target).
- 3 buildable structures: **Generator** (resources), **Tower** (auto-attacks monster in
  range), **Workshop** (upgrades hero combat power). Building/upgrading spends shared
  `materials`.

**Win math (the race):**
- *Monster wins* → City Core HP = 0.
- *Builders win* → monster HP = 0. Their damage scales with Towers + Workshop hero
  upgrades, so "can we kill it before it razes us?" is the live question each match.

**Playable sides:** **both selectable from match start** (day 1). The human takes one
seat (monster or any hero); bots run the rest. Requires competent-enough AI for both sides.

### Explicitly out of scope for the slice (later passes)
Networking/Colyseus integration, accounts/matchmaking/lobby, fog-of-war, art & audio
polish, deep tech trees / many buildings, additional monster types or maps, progression
between matches.

## 8. Testing approach

Because the sim is pure and deterministic, it is unit-testable with **no engine, no
browser, no network**. Sim is built **test-first (TDD)**:

- **Per-system tests:** feeding adds correct XP; evolution triggers at thresholds; tower
  deals damage in range; building spends resources; win conditions fire correctly.
- **Whole-match determinism test:** same seed + same input log → identical final state.
  (This guarantee is also what makes networking reliable later.)
- Rendering and bots are tested more loosely by playing.

## 9. Open questions / future decisions

- Resource model depth: keep `materials` + `food`, or collapse to one for the slice?
  (Default: keep both; revisit if it adds friction.)
- Exact balance numbers (stage XP thresholds, building costs, HP/damage) — to be tuned
  during slice playtesting, captured in `shared/data`.
- Hero respawn rules after a pick-off (permadeath for the match vs timed respawn) —
  decide during slice playtesting.
