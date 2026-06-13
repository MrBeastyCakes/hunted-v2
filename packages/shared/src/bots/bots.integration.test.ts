import { botThink } from './index';
import { step } from '../step';
import { createInitialState } from '../state';
import type { InputMap } from '../types';

// Everyone is a bot: the monster vs four hero bots. The match must conclude.
test('a fully autonomous bot match reaches a conclusion', () => {
  let s = createInitialState(42);
  let guard = 0;
  while (s.phase === 'playing' && guard < 30000) {
    const inputs: InputMap = {};
    inputs[s.monster.id] = botThink(s, s.monster.id);
    for (const h of s.heroes) {
      if (h.alive) inputs[h.id] = botThink(s, h.id);
    }
    s = step(s, inputs);
    guard += 1;
  }
  expect(s.phase).not.toBe('playing');
  expect(['monsterWon', 'buildersWon']).toContain(s.phase);
});

test('the autonomous match is deterministic for a given seed', () => {
  function play(seed: number) {
    let s = createInitialState(seed);
    let guard = 0;
    while (s.phase === 'playing' && guard < 30000) {
      const inputs: InputMap = {};
      inputs[s.monster.id] = botThink(s, s.monster.id);
      for (const h of s.heroes) if (h.alive) inputs[h.id] = botThink(s, h.id);
      s = step(s, inputs);
      guard += 1;
    }
    return { phase: s.phase, tick: s.tick };
  }
  expect(play(7)).toEqual(play(7));
});
