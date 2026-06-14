import { maxId } from './ids';
import { createInitialState } from './state';

test('maxId returns the largest id across all collections', () => {
  const s = createInitialState(1);
  const max = maxId(s);
  const all = [
    s.monster.id,
    ...s.heroes.map((h) => h.id),
    ...s.buildings.map((b) => b.id),
    ...s.map.resourceNodes.map((n) => n.id),
    ...s.map.mobs.map((m) => m.id),
  ];
  expect(max).toBe(Math.max(...all));
});
