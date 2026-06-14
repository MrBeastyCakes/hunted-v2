import { LEVEL_DAMAGE_BONUS, LEVEL_HP_BONUS, SKILL_MAX_RANK, XP_PER_LEVEL_COST } from './constants';
import type { GameState, SkillPath } from './types';

// XP cost to go from `level` to `level + 1`.
export function levelCost(level: number): number {
  return XP_PER_LEVEL_COST * (level + 1);
}

// Spend banked XP to raise one sense path a rank (also raises level + power). Returns success.
export function spendOnSkill(state: GameState, path: SkillPath): boolean {
  const m = state.monster;
  if (!m.alive || !m.evolution || !m.combat) return false;
  const evo = m.evolution;
  if (evo.skills[path] >= SKILL_MAX_RANK) return false;
  const cost = levelCost(evo.level);
  if (evo.xp < cost) return false;

  evo.xp -= cost;
  evo.skills[path] += 1;
  evo.level += 1;
  m.health.maxHp += LEVEL_HP_BONUS;
  m.health.hp += LEVEL_HP_BONUS;
  m.combat.damage += LEVEL_DAMAGE_BONUS;
  return true;
}
