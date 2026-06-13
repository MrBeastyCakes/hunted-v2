import { distance, type Entity, type EntityId, type GameState, type Vec2 } from '@game/shared';

export interface Pick {
  kind: 'monster' | 'hero' | 'building' | 'wildlife';
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
  for (const n of state.map.wildlifeNodes) if (n.amount > 0) consider('wildlife', n.id, n.pos);

  return best;
}
