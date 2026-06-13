import { evolutionSystem } from './evolution';
import { createInitialState } from '../state';
import {
  STAGE2_XP,
  STAGE3_XP,
  STAGE3_CITY_DAMAGE_REQ,
  STAGE_DAMAGE_BONUS,
  STAGE_HP_BONUS,
} from '../constants';

test('reaches stage 2 at the XP threshold and gains HP + damage', () => {
  const s = createInitialState(123);
  const m = s.monster;
  const baseMaxHp = m.health.maxHp;
  const baseDmg = m.combat!.damage;
  m.evolution!.xp = STAGE2_XP;
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(2);
  expect(m.health.maxHp).toBe(baseMaxHp + STAGE_HP_BONUS);
  expect(m.combat!.damage).toBe(baseDmg + STAGE_DAMAGE_BONUS);
});

test('stage 3 is gated behind city damage even with enough XP', () => {
  const s = createInitialState(123);
  const m = s.monster;
  m.evolution!.xp = STAGE3_XP;
  m.evolution!.cityDamageDealt = 0;
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(2); // capped at 2 until the city has been hit enough
});

test('stage 3 unlocks once the city-damage requirement is met', () => {
  const s = createInitialState(123);
  const m = s.monster;
  m.evolution!.xp = STAGE3_XP;
  m.evolution!.cityDamageDealt = STAGE3_CITY_DAMAGE_REQ;
  evolutionSystem(s);
  expect(m.evolution!.stage).toBe(3);
});

test('evolution only moves upward and is idempotent', () => {
  const s = createInitialState(123);
  const m = s.monster;
  m.evolution!.xp = STAGE2_XP;
  evolutionSystem(s);
  const maxHpAfterFirst = m.health.maxHp;
  evolutionSystem(s); // no further XP gained
  expect(m.evolution!.stage).toBe(2);
  expect(m.health.maxHp).toBe(maxHpAfterFirst);
});
