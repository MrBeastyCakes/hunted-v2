import {
  DT,
  HERD_MIGRATE_STEP,
  HERD_MIGRATE_TICKS,
  HERD_WANDER_RADIUS,
  MOB_FLEE_SPEED,
  MOB_WANDER_SPEED,
  SCATTER_RADIUS,
  SCATTER_TICKS,
} from '../constants';
import { clamp, distance, normalize } from '../math';
import { nextRandom } from '../rng';
import type { GameState, Herd } from '../types';

// Mob movement: herds wander near home, but scatter and flee when the monster is near.
export function herdSystem(state: GameState): void {
  const m = state.monster;

  // 0. Wildlife herds slowly migrate their home across the map.
  if (state.tick > 0 && state.tick % HERD_MIGRATE_TICKS === 0) {
    for (const herd of state.map.herds) {
      if (herd.species !== 'wildlife') continue;
      const ang = nextRandom(state) * Math.PI * 2;
      herd.home.x = clamp(herd.home.x + Math.cos(ang) * HERD_MIGRATE_STEP, 0, state.map.width);
      herd.home.y = clamp(herd.home.y + Math.sin(ang) * HERD_MIGRATE_STEP, 0, state.map.height);
    }
  }

  // 1. Which herds are panicked this tick?
  const panicked = new Set<number>();
  if (m.alive) {
    for (const mob of state.map.mobs) {
      if (distance(m.pos, mob.pos) <= SCATTER_RADIUS) panicked.add(mob.herdId);
    }
  }

  const homeOf = new Map<number, Herd>();
  for (const h of state.map.herds) homeOf.set(h.id, h);

  for (const mob of state.map.mobs) {
    if (panicked.has(mob.herdId)) {
      mob.state = 'fleeing';
      mob.fleeTicks = SCATTER_TICKS;
    }

    if (mob.state === 'fleeing' && mob.fleeTicks > 0 && m.alive) {
      const away = normalize({ x: mob.pos.x - m.pos.x, y: mob.pos.y - m.pos.y });
      mob.pos.x = clamp(mob.pos.x + away.x * MOB_FLEE_SPEED * DT, 0, state.map.width);
      mob.pos.y = clamp(mob.pos.y + away.y * MOB_FLEE_SPEED * DT, 0, state.map.height);
      mob.fleeTicks -= 1;
      if (mob.fleeTicks <= 0) mob.state = 'calm';
      continue;
    }

    // calm wander
    mob.state = 'calm';
    const home = homeOf.get(mob.herdId)?.home ?? mob.pos;
    let dir: { x: number; y: number };
    if (distance(mob.pos, home) > HERD_WANDER_RADIUS) {
      dir = normalize({ x: home.x - mob.pos.x, y: home.y - mob.pos.y });
    } else {
      const ang = nextRandom(state) * Math.PI * 2;
      dir = { x: Math.cos(ang), y: Math.sin(ang) };
    }
    mob.pos.x = clamp(mob.pos.x + dir.x * MOB_WANDER_SPEED * DT, 0, state.map.width);
    mob.pos.y = clamp(mob.pos.y + dir.y * MOB_WANDER_SPEED * DT, 0, state.map.height);
  }
}
