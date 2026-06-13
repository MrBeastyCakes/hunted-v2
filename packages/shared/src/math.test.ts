import { clamp, length, normalize } from './math';

test('clamp bounds a value', () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-3, 0, 10)).toBe(0);
  expect(clamp(99, 0, 10)).toBe(10);
});

test('length computes magnitude', () => {
  expect(length({ x: 3, y: 4 })).toBe(5);
  expect(length({ x: 0, y: 0 })).toBe(0);
});

test('normalize returns a unit vector, or zero for zero input', () => {
  expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  const n = normalize({ x: 3, y: 4 });
  expect(n.x).toBeCloseTo(0.6);
  expect(n.y).toBeCloseTo(0.8);
});
