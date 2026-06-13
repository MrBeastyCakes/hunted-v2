import { stepsToRun, renderAlpha, TICK_MS } from './loop';

test('TICK_MS matches 20 Hz', () => {
  expect(TICK_MS).toBe(50);
});

test('computes whole steps and leftover remainder', () => {
  expect(stepsToRun(120, 50)).toEqual({ steps: 2, remainderMs: 20 });
  expect(stepsToRun(49, 50)).toEqual({ steps: 0, remainderMs: 49 });
  expect(stepsToRun(100, 50)).toEqual({ steps: 2, remainderMs: 0 });
});

test('caps steps to avoid the spiral of death and drops surplus time', () => {
  expect(stepsToRun(10000, 50, 5)).toEqual({ steps: 5, remainderMs: 0 });
});

test('renderAlpha is the clamped fractional progress to the next tick', () => {
  expect(renderAlpha(20, 50)).toBeCloseTo(0.4);
  expect(renderAlpha(0, 50)).toBe(0);
  expect(renderAlpha(80, 50)).toBe(1); // clamped
});
