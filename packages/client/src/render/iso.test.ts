import { worldToScreen } from './iso';

const origin = { x: 100, y: 50 };

test('world origin maps to the screen origin', () => {
  expect(worldToScreen({ x: 0, y: 0 }, 32, 16, origin)).toEqual({ x: 100, y: 50 });
});

test('+x goes down-right, +y goes down-left (2:1 iso)', () => {
  expect(worldToScreen({ x: 1, y: 0 }, 32, 16, origin)).toEqual({ x: 116, y: 58 });
  expect(worldToScreen({ x: 0, y: 1 }, 32, 16, origin)).toEqual({ x: 84, y: 58 });
});
