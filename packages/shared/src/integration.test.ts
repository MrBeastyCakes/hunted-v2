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
  for (const h of s.heroes) h.pos = { ...s.monster.pos };
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
  expect(finished.monster.evolution!.cityDamageDealt).toBeGreaterThan(0);
});

test('feeding then risking the city carries the monster to stage 3', () => {
  let s = createInitialState(3);
  s = structuredClone(s);
  const node = s.map.wildlifeNodes[0];
  node.amount = 100000; // effectively unlimited for the test
  s.monster.pos = { ...node.pos };
  // Phase A: feed in place until well past the stage-3 XP threshold.
  s = run(s, 2000, (state) => ({
    [state.monster.id]: { actorId: state.monster.id, move: { x: 0, y: 0 }, action: 'feed' },
  }));
  expect(s.monster.evolution!.stage).toBe(2); // XP is high, but no city damage yet -> capped at 2

  // Phase B: teleport onto the core and attack until stage 3 unlocks.
  s = structuredClone(s);
  const core = s.buildings.find((b) => b.type === 'core')!;
  core.health.hp = 100000; // keep the core alive long enough to evolve
  s.monster.pos = { ...core.pos };
  for (const h of s.heroes) h.pos = { x: 0, y: 0 };
  s = run(s, 2000, (state) => ({
    [state.monster.id]: { actorId: state.monster.id, move: { x: 0, y: 0 } },
  }));
  expect(s.monster.evolution!.stage).toBe(3);
});
