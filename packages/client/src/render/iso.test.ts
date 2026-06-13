import { screenToWorld, worldToScreen } from './iso';

const origin = { x: 100, y: 50 };

test('screenToWorld inverts worldToScreen', () => {
  const o = { x: 137, y: 42 };
  for (const world of [{ x: 0, y: 0 }, { x: 3, y: 7 }, { x: 12.5, y: -4 }]) {
    const back = screenToWorld(worldToScreen(world, 32, 16, o), 32, 16, o);
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  }
});

test('screenToWorld maps the origin to world (0,0)', () => {
  const p = screenToWorld({ x: 100, y: 50 }, 32, 16, { x: 100, y: 50 });
  expect(p.x).toBeCloseTo(0);
  expect(p.y).toBeCloseTo(0);
});

test('world origin maps to the screen origin', () => {
  expect(worldToScreen({ x: 0, y: 0 }, 32, 16, origin)).toEqual({ x: 100, y: 50 });
});

test('+x goes down-right, +y goes down-left (2:1 iso)', () => {
  expect(worldToScreen({ x: 1, y: 0 }, 32, 16, origin)).toEqual({ x: 116, y: 58 });
  expect(worldToScreen({ x: 0, y: 1 }, 32, 16, origin)).toEqual({ x: 84, y: 58 });
});
