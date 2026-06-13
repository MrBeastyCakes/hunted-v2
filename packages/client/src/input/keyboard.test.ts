import { applyKey, emptyKeyMap } from './keyboard';

test('emptyKeyMap is all false', () => {
  expect(emptyKeyMap()).toEqual({
    up: false, down: false, left: false, right: false, feed: false, build: false,
  });
});

test('WASD and arrows set direction flags', () => {
  let m = emptyKeyMap();
  m = applyKey(m, 'KeyW', true);
  m = applyKey(m, 'KeyA', true);
  expect(m.up).toBe(true);
  expect(m.left).toBe(true);
  m = applyKey(m, 'ArrowDown', true);
  m = applyKey(m, 'ArrowRight', true);
  expect(m.down).toBe(true);
  expect(m.right).toBe(true);
});

test('Space feeds and KeyB builds; release clears', () => {
  let m = emptyKeyMap();
  m = applyKey(m, 'Space', true);
  m = applyKey(m, 'KeyB', true);
  expect(m.feed).toBe(true);
  expect(m.build).toBe(true);
  m = applyKey(m, 'Space', false);
  expect(m.feed).toBe(false);
});

test('unknown keys are ignored and return an unchanged map', () => {
  const m = emptyKeyMap();
  expect(applyKey(m, 'KeyZ', true)).toEqual(m);
});
