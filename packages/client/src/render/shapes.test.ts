import { depthKey, diamondPoints, isoBoxFaces } from './shapes';

test('depthKey sorts by x+y', () => {
  expect(depthKey(2, 3)).toBe(5);
  expect(depthKey(0, 0)).toBe(0);
});

test('diamondPoints returns top,right,bottom,left as a flat array', () => {
  expect(diamondPoints(10, 20, 4, 2)).toEqual([10, 18, 14, 20, 10, 22, 6, 20]);
});

test('isoBoxFaces top is the base diamond raised by height', () => {
  const f = isoBoxFaces(0, 0, 4, 2, 10);
  expect(f.top).toEqual([0, -12, 4, -10, 0, -8, -4, -10]);
  expect(f.left.length).toBe(8);
  expect(f.right.length).toBe(8);
});
