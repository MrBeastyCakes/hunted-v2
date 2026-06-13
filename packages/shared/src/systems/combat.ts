import { CITY_DAMAGE_XP, WORKSHOP_HERO_DAMAGE_BONUS } from '../constants';
import { distance } from '../math';
import type { Combat, GameState, Health, InputMap, Vec2 } from '../types';

function tickCooldown(c: Combat): void {
  if (c.cooldownRemaining > 0) c.cooldownRemaining -= 1;
}

interface MonsterTarget {
  health: Health;
  pos: Vec2;
  isBuilding: boolean;
}

function nearestMonsterTarget(state: GameState): MonsterTarget | undefined {
  const m = state.monster;
  if (!m.combat) return undefined;
  const range = m.combat.range;
  let best: MonsterTarget | undefined;
  let bestDist = Infinity;
  for (const h of state.heroes) {
    if (!h.alive) continue;
    const d = distance(m.pos, h.pos);
    if (d <= range && d < bestDist) {
      bestDist = d;
      best = { health: h.health, pos: h.pos, isBuilding: false };
    }
  }
  for (const b of state.buildings) {
    const d = distance(m.pos, b.pos);
    if (d <= range && d < bestDist) {
      bestDist = d;
      best = { health: b.health, pos: b.pos, isBuilding: true };
    }
  }
  return best;
}

// Resolves all attacks for one tick: monster vs heroes/buildings, heroes/towers vs monster.
export function combatSystem(state: GameState, inputs: InputMap): void {
  const m = state.monster;

  // 1. Tick down every cooldown.
  if (m.combat) tickCooldown(m.combat);
  for (const h of state.heroes) if (h.combat) tickCooldown(h.combat);
  for (const b of state.buildings) if (b.combat) tickCooldown(b.combat);

  const heroBonus = state.buildings.some((b) => b.type === 'workshop')
    ? WORKSHOP_HERO_DAMAGE_BONUS
    : 0;

  // 2. Monster attacks nearest enemy (unless feeding this tick).
  const mInput = inputs[m.id];
  if (m.alive && m.combat && m.evolution && mInput?.action !== 'feed') {
    if (m.combat.cooldownRemaining <= 0) {
      const target = nearestMonsterTarget(state);
      if (target) {
        target.health.hp -= m.combat.damage;
        m.combat.cooldownRemaining = m.combat.cooldown;
        if (target.isBuilding) {
          m.evolution.cityDamageDealt += m.combat.damage;
          m.evolution.xp += m.combat.damage * CITY_DAMAGE_XP;
        }
      }
    }
  }

  // 3. Heroes and towers attack the monster.
  if (m.alive) {
    for (const h of state.heroes) {
      if (!h.alive || !h.combat) continue;
      if (h.combat.cooldownRemaining > 0) continue;
      if (distance(h.pos, m.pos) <= h.combat.range) {
        m.health.hp -= h.combat.damage + heroBonus;
        h.combat.cooldownRemaining = h.combat.cooldown;
      }
    }
    for (const b of state.buildings) {
      if (b.type !== 'tower' || !b.combat) continue;
      if (b.combat.cooldownRemaining > 0) continue;
      if (distance(b.pos, m.pos) <= b.combat.range) {
        m.health.hp -= b.combat.damage;
        b.combat.cooldownRemaining = b.combat.cooldown;
      }
    }
  }

  // 4. Resolve deaths.
  if (m.health.hp <= 0) {
    m.health.hp = 0;
    m.alive = false;
  }
  for (const h of state.heroes) {
    if (h.health.hp <= 0) {
      h.health.hp = 0;
      h.alive = false;
    }
  }
  state.buildings = state.buildings.filter((b) => b.type === 'core' || b.health.hp > 0);
  const core = state.buildings.find((b) => b.type === 'core');
  if (core && core.health.hp < 0) core.health.hp = 0;
}
