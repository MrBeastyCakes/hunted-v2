import { evolutionSystem } from './evolution';
import { createInitialState } from '../state';
import { MONSTER_STAGE_XP, STAGE_DAMAGE_BONUS, STAGE_HP_BONUS } from '../constants';

test('reaching a threshold advances the stage with HP + damage gains', () => {
  const s = createInitialState(1);
  const m = s.monster;
  const baseMaxHp = m.health.maxHp;
  const baseDmg = m.combat!.damage;
  m.evolution!.xp = MONSTER_STAGE_XP[1]; // enough for stage 2
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(2);
  expect(m.health.maxHp).toBe(baseMaxHp + STAGE_HP_BONUS);
  expect(m.combat!.damage).toBe(baseDmg + STAGE_DAMAGE_BONUS);
});

test('enough xp jumps multiple stages at once (heals + buffs per stage)', () => {
  const s = createInitialState(1);
  const m = s.monster;
  const baseMaxHp = m.health.maxHp;
  m.evolution!.xp = MONSTER_STAGE_XP[2]; // stage 3
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(3);
  expect(m.health.maxHp).toBe(baseMaxHp + 2 * STAGE_HP_BONUS);
});

test('caps at stage 5', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = MONSTER_STAGE_XP[4] + 99999;
  evolutionSystem(s);
  expect(s.monster.evolution!.stage).toBe(5);
});

test('evolution only moves upward and is idempotent', () => {
  const s = createInitialState(1);
  const m = s.monster;
  m.evolution!.xp = MONSTER_STAGE_XP[1];
  evolutionSystem(s);
  const hp = m.health.maxHp;
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(2);
  expect(m.health.maxHp).toBe(hp);
});
