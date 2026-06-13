import { buildCost } from './cost';
import { BUILD_COSTS, BUILDER_DISCOUNT } from './constants';

test('non-builder roles pay the full cost', () => {
  expect(buildCost('defender', 'tower')).toBe(BUILD_COSTS.tower);
  expect(buildCost('economy', 'generator')).toBe(BUILD_COSTS.generator);
  expect(buildCost(undefined, 'workshop')).toBe(BUILD_COSTS.workshop);
});

test('the builder role gets the discount (floored)', () => {
  expect(buildCost('builder', 'tower')).toBe(Math.floor(BUILD_COSTS.tower * BUILDER_DISCOUNT));
});
