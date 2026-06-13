import { nextRandom, randomRange } from './rng';
import type { GameState } from './types';

function stub(seed: number): GameState {
  return { rngSeed: seed, rngState: seed } as GameState;
}

test('nextRandom returns a float in [0, 1)', () => {
  const s = stub(42);
  for (let i = 0; i < 100; i++) {
    const r = nextRandom(s);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  }
});

test('same seed produces the same sequence', () => {
  const a = stub(7);
  const b = stub(7);
  const seqA = [nextRandom(a), nextRandom(a), nextRandom(a)];
  const seqB = [nextRandom(b), nextRandom(b), nextRandom(b)];
  expect(seqA).toEqual(seqB);
});

test('different seeds diverge', () => {
  const a = stub(1);
  const b = stub(2);
  expect(nextRandom(a)).not.toBe(nextRandom(b));
});

test('randomRange stays within bounds', () => {
  const s = stub(99);
  for (let i = 0; i < 100; i++) {
    const r = randomRange(s, 10, 20);
    expect(r).toBeGreaterThanOrEqual(10);
    expect(r).toBeLessThan(20);
  }
});
