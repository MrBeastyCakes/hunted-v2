import { visionParams } from './vision';

test('rank 0 is blurry with a small clear bubble; higher ranks clear up', () => {
  const r0 = visionParams(0);
  expect(r0.blur).toBeGreaterThan(0);
  expect(r0.fogRadius).not.toBeNull();
  const r2 = visionParams(2);
  expect(r2.blur).toBe(0);
  expect(r2.fogRadius).toBeNull();
});

test('ranks 3 and 4 zoom out progressively', () => {
  expect(visionParams(3).zoom).toBeLessThan(1);
  expect(visionParams(4).zoom).toBeLessThan(visionParams(3).zoom);
});

test('the clear bubble widens from rank 0 to rank 1', () => {
  expect(visionParams(1).fogRadius!).toBeGreaterThan(visionParams(0).fogRadius!);
});
