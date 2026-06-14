import { step } from './step';
import { createInitialState } from './state';
import type { GameState, InputMap } from './types';

// Advance the sim N ticks (or until it ends) with a per-tick input builder.
function run(s0: GameState, ticks: number, build: (s: GameState) => InputMap): GameState {
  let s = s0;
  for (let i = 0; i < ticks && s.phase === 'playing'; i++) {
    s = step(s, build(s));
  }
  return s;
}

test('builders win: heroes stand on the monster and grind it down', () => {
  let s = createInitialState(1);
  // Put all four heroes on top of the monster so every hero attacks it.
  s = structuredClone(s);
  for (const h of s.heroes) {
    h.pos = { ...s.monster.pos };
    h.equipped = 'sword';
    h.combat!.damage = 8;
    h.combat!.range = 1.8;
  }
  const finished = run(s, 2000, (state) => {
    const inputs: InputMap = {};
    for (const h of state.heroes) {
      inputs[h.id] = { actorId: h.id, move: { x: 0, y: 0 } }; // stay put; combat is automatic
    }
    return inputs;
  });
  expect(finished.phase).toBe('buildersWon');
  expect(finished.monster.alive).toBe(false);
});

test('monster wins: it sits on the core and razes it while heroes are away', () => {
  let s = createInitialState(2);
  s = structuredClone(s);
  const core = s.buildings.find((b) => b.type === 'core')!;
  s.monster.pos = { ...core.pos };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 }; // heroes nowhere near the fight
  const finished = run(s, 2000, (state) => ({
    [state.monster.id]: { actorId: state.monster.id, move: { x: 0, y: 0 } }, // auto-attacks the core
  }));
  expect(finished.phase).toBe('monsterWon');
});

test('hunting mobs banks XP to spend on skills', () => {
  let s = createInitialState(3);
  for (let i = 0; i < 120 && s.map.mobs.length > 0; i++) {
    const target = s.map.mobs[0];
    s = structuredClone(s);
    s.monster.pos = { ...target.pos }; // sit on a mob and bite it down
    s = step(s, { [s.monster.id]: { actorId: s.monster.id, move: { x: 0, y: 0 } } });
  }
  expect(s.monster.evolution!.xp).toBeGreaterThan(0);
});
