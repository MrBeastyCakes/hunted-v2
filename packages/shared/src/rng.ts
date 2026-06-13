import type { GameState } from './types';

// Mulberry32: fast, deterministic. Advances state.rngState and returns [0, 1).
export function nextRandom(state: GameState): number {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(state: GameState, min: number, max: number): number {
  return min + nextRandom(state) * (max - min);
}
