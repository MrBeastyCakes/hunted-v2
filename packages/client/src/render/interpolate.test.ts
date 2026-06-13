import { lerp, lerpVec } from './interpolate';

test('lerp blends two scalars', () => {
  expect(lerp(0, 10, 0)).toBe(0);
  expect(lerp(0, 10, 1)).toBe(10);
  expect(lerp(0, 10, 0.25)).toBe(2.5);
});

test('lerpVec blends two points', () => {
  expect(lerpVec({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
});
