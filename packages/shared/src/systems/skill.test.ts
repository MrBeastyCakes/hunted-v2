import { skillSystem } from './skill';
import { createInitialState } from '../state';
import type { InputMap } from '../types';

test('a spend input raises the chosen skill when affordable', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 100;
  const inputs: InputMap = {
    [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 }, action: 'spend', skillPath: 'hearing' },
  };
  skillSystem(s, inputs);
  expect(s.monster.evolution!.skills.hearing).toBe(1);
  expect(s.monster.evolution!.level).toBe(2);
});

test('no spend input does nothing', () => {
  const s = createInitialState(1);
  s.monster.evolution!.xp = 100;
  skillSystem(s, {});
  expect(s.monster.evolution!.level).toBe(1);
});
