import { minClearRadiusPx, visionParams } from './vision';

test('minClearRadiusPx is 4x attack range in iso screen units', () => {
  expect(minClearRadiusPx(2, 32)).toBe(128); // 2 * 4 * (32/2)
});

test('rank 0 has a small clear bubble; rank 2 sees the whole screen', () => {
  expect(visionParams(0).fogRadius).not.toBeNull();
  expect(visionParams(2).fogRadius).toBeNull();
});

test('ranks 3 and 4 zoom out progressively', () => {
  expect(visionParams(3).zoom).toBeLessThan(1);
  expect(visionParams(4).zoom).toBeLessThan(visionParams(3).zoom);
});

test('the clear bubble widens from rank 0 to rank 1', () => {
  expect(visionParams(1).fogRadius!).toBeGreaterThan(visionParams(0).fogRadius!);
});
