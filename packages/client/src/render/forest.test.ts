import { generateForest } from './forest';

test('generateForest is deterministic for a seed', () => {
  const a = generateForest(7, 100, 100, 40, { x: 50, y: 50, r: 18 });
  const b = generateForest(7, 100, 100, 40, { x: 50, y: 50, r: 18 });
  expect(a).toEqual(b);
});

test('props stay in bounds and avoid the excluded center', () => {
  const props = generateForest(3, 100, 100, 60, { x: 50, y: 50, r: 18 });
  expect(props.length).toBeGreaterThan(0);
  for (const p of props) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(100);
    expect(Math.hypot(p.x - 50, p.y - 50)).toBeGreaterThanOrEqual(18);
    expect(['tree', 'bush', 'rock']).toContain(p.kind);
  }
});
