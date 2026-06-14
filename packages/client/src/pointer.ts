import {
  distance,
  type Entity,
  type EntityId,
  type GameState,
  type Input,
  type Vec2,
} from '@game/shared';

export interface Pick {
  kind: 'monster' | 'hero' | 'building' | 'mob' | 'weapon' | 'resource';
  id: EntityId;
  pos: Vec2;
}

export function findActor(state: GameState, id: EntityId): Entity | undefined {
  if (state.monster.id === id) return state.monster;
  return state.heroes.find((h) => h.id === id);
}

// Nearest interactable within `radius` world units of the tapped point, or undefined.
export function pickTarget(state: GameState, world: Vec2, radius: number): Pick | undefined {
  let best: Pick | undefined;
  let bestDist = radius;
  const consider = (kind: Pick['kind'], id: EntityId, pos: Vec2) => {
    const d = distance(world, pos);
    if (d <= bestDist) {
      bestDist = d;
      best = { kind, id, pos };
    }
  };

  if (state.monster.alive) consider('monster', state.monster.id, state.monster.pos);
  for (const h of state.heroes) if (h.alive) consider('hero', h.id, h.pos);
  for (const b of state.buildings) consider('building', b.id, b.pos);
  for (const mob of state.map.mobs) consider('mob', mob.id, mob.pos);
  for (const w of state.map.weapons) consider('weapon', w.id, w.pos);
  for (const n of state.map.resourceNodes) if (n.amount > 0) consider('resource', n.id, n.pos);

  return best;
}

export type TapIntent =
  | { kind: 'move'; point: Vec2 }
  | { kind: 'chase'; mobId: EntityId }
  | { kind: 'attack'; point: Vec2 }
  | { kind: 'spectate'; actorId: EntityId }
  | { kind: 'openBuildMenu' }
  | { kind: 'openCraftMenu' };

// Maps a tapped world point to an intent, given who the player controls.
export function resolveTapIntent(
  state: GameState,
  controlledId: EntityId,
  world: Vec2,
  pickRadius: number,
): TapIntent {
  const controlled = findActor(state, controlledId);
  const spectating = !controlled || !controlled.alive;
  const pick = pickTarget(state, world, pickRadius);

  if (spectating) {
    if (pick && (pick.kind === 'hero' || pick.kind === 'monster')) {
      return { kind: 'spectate', actorId: pick.id };
    }
    return { kind: 'move', point: world };
  }

  const isMonster = controlledId === state.monster.id;
  if (pick) {
    if (isMonster && pick.kind === 'mob') return { kind: 'chase', mobId: pick.id };
    if (isMonster && (pick.kind === 'building' || pick.kind === 'hero')) {
      return { kind: 'attack', point: pick.pos };
    }
    if (!isMonster && pick.kind === 'monster') return { kind: 'attack', point: pick.pos };
    if (!isMonster && pick.kind === 'building') {
      const building = state.buildings.find((b) => b.id === pick.id);
      if (building?.type === 'core') return { kind: 'openBuildMenu' };
      if (building?.type === 'blacksmith') return { kind: 'openCraftMenu' };
    }
    if (pick.kind === 'weapon' || pick.kind === 'resource') {
      return { kind: 'move', point: { x: pick.pos.x, y: pick.pos.y } };
    }
  }
  return { kind: 'move', point: world };
}

export interface PointerControl {
  moveTarget?: Vec2;
  chaseMobId?: EntityId;
}

export function moveTargetToInput(
  actorId: EntityId,
  from: Vec2,
  target: Vec2,
  arrivalEps: number,
): Input {
  if (distance(from, target) <= arrivalEps) return { actorId, move: { x: 0, y: 0 } };
  return { actorId, move: { x: target.x - from.x, y: target.y - from.y } };
}

// Folds a tap intent into the persistent pointer-control state.
export function applyIntent(control: PointerControl, intent: TapIntent): PointerControl {
  switch (intent.kind) {
    case 'move':
    case 'attack':
      return { moveTarget: { ...intent.point } };
    case 'chase':
      return { chaseMobId: intent.mobId };
    case 'spectate':
    case 'openBuildMenu':
    case 'openCraftMenu':
      return control; // handled elsewhere (camera / menus), not by movement
  }
}

// Produces the per-tick Input for the controlled actor from the pointer-control state.
export function controlToInput(
  state: GameState,
  controlledId: EntityId,
  control: PointerControl,
  arrivalEps: number,
): Input {
  const actor = findActor(state, controlledId);
  if (!actor) return { actorId: controlledId, move: { x: 0, y: 0 } };

  if (control.chaseMobId !== undefined) {
    const mob = state.map.mobs.find((m) => m.id === control.chaseMobId);
    if (mob) return moveTargetToInput(controlledId, actor.pos, mob.pos, arrivalEps);
  }
  if (control.moveTarget) {
    return moveTargetToInput(controlledId, actor.pos, control.moveTarget, arrivalEps);
  }
  return { actorId: controlledId, move: { x: 0, y: 0 } };
}
