import { TILE_W } from './config';

test('client toolchain runs and config imports', () => {
  expect(TILE_W).toBeGreaterThan(0);
});
