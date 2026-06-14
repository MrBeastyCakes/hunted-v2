import { levelCost, spendOnSkill } from './skill';
import { createInitialState } from './state';
import { LEVEL_DAMAGE_BONUS, LEVEL_HP_BONUS, SKILL_MAX_RANK } from './constants';

test('levelCost is 25 * the next level', () => {
  expect(levelCost(1)).toBe(50);
  expect(levelCost(2)).toBe(75);
  expect(levelCost(7)).toBe(200);
});

test('spending raises the rank + level, deducts xp, and bumps power', () => {
  const s = createInitialState(1);
  const m = s.monster;
  m.evolution!.xp = 1000;
  const hp = m.health.maxHp;
  const dmg = m.combat!.damage;
  const ok = spendOnSkill(s, 'vision');
  expect(ok).toBe(true);
  expect(m.evolution!.skills.vision).toBe(1);
  expect(m.evolution!.level).toBe(2);
  expect(m.evolution!.xp).toBe(1000 - 50);
  expect(m.health.maxHp).toBe(hp + LEVEL_HP_BONUS);
  expect(m.combat!.damage).toBe(dmg + LEVEL_DAMAGE_BONUS);
});

test('cannot spend without enough xp', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 10;
  expect(spendOnSkill(s, 'vision')).toBe(false);
  expect(s.monster.evolution!.level).toBe(1);
});

test('a path caps at SKILL_MAX_RANK', () => {
  const s = createInitialState(1);
  const m = s.monster;
  m.evolution!.xp = 100000;
  for (let i = 0; i < SKILL_MAX_RANK; i++) spendOnSkill(s, 'smell');
  expect(m.evolution!.skills.smell).toBe(SKILL_MAX_RANK);
  expect(spendOnSkill(s, 'smell')).toBe(false);
});
