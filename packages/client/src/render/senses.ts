import { distance, type GameState, type Vec2 } from '@game/shared';

export type SmellCategory = 'rancid' | 'food' | 'living';
export type PerceiveKind = 'critter' | 'medium' | 'large' | 'villager' | 'hero' | 'building';

export interface SmellTarget {
  id: number;
  pos: Vec2;
  category: SmellCategory;
  kind: PerceiveKind;
}

export interface HearTarget {
  id: number;
  pos: Vec2;
  kind: PerceiveKind;
  distance: number;
}

// Per-rank smell detection ranges (world units; 0 = not detected).
export function smellRanges(rank: number): { rancid: number; food: number; living: number } {
  return {
    rancid: rank >= 2 ? 40 : rank >= 1 ? 20 : 0,
    food: rank >= 2 ? 40 : 0,
    living: rank >= 4 ? 20 : rank >= 3 ? 10 : 0,
  };
}

export function smellSpeciesId(rank: number): boolean {
  return rank >= 4;
}

export function smellTargets(state: GameState, rank: number): SmellTarget[] {
  if (rank <= 0) return [];
  const r = smellRanges(rank);
  const from = state.monster.pos;
  const out: SmellTarget[] = [];

  if (r.rancid > 0) {
    for (const mob of state.map.mobs) {
      if (mob.tier === 'large' && distance(from, mob.pos) <= r.rancid) {
        out.push({ id: mob.id, pos: mob.pos, category: 'rancid', kind: 'large' });
      }
    }
  }
  if (r.food > 0) {
    for (const b of state.buildings) {
      if (distance(from, b.pos) <= r.food) {
        out.push({ id: b.id, pos: b.pos, category: 'food', kind: 'building' });
      }
    }
  }
  if (r.living > 0) {
    for (const mob of state.map.mobs) {
      if (mob.tier !== 'large' && distance(from, mob.pos) <= r.living) {
        out.push({ id: mob.id, pos: mob.pos, category: 'living', kind: mob.tier });
      }
    }
    for (const h of state.heroes) {
      if (h.alive && distance(from, h.pos) <= r.living) {
        out.push({ id: h.id, pos: h.pos, category: 'living', kind: 'hero' });
      }
    }
  }
  return out;
}

// Per-rank hearing range (world units; 0 = deaf).
export function hearRange(rank: number): number {
  return rank >= 4 ? 40 : rank >= 2 ? 20 : rank >= 1 ? 10 : 0;
}

export function hearTypes(rank: number): boolean {
  return rank >= 2;
}

export function hearDistance(rank: number): boolean {
  return rank >= 3;
}

export function hearTargets(state: GameState, rank: number): HearTarget[] {
  const range = hearRange(rank);
  if (range <= 0) return [];
  const from = state.monster.pos;
  const out: HearTarget[] = [];
  for (const mob of state.map.mobs) {
    const d = distance(from, mob.pos);
    if (d <= range) out.push({ id: mob.id, pos: mob.pos, kind: mob.tier, distance: d });
  }
  for (const h of state.heroes) {
    if (!h.alive) continue;
    const d = distance(from, h.pos);
    if (d <= range) out.push({ id: h.id, pos: h.pos, kind: 'hero', distance: d });
  }
  return out;
}
