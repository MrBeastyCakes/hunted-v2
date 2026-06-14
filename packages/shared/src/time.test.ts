import { dayNight, CYCLE_TICKS, TOTAL_TICKS } from './time';
import { DAY_TICKS, NIGHTS_TO_SURVIVE } from './constants';

test('tick 0 is day 1', () => {
  const d = dayNight(0);
  expect(d.phase).toBe('day');
  expect(d.cycle).toBe(1);
  expect(d.ended).toBe(false);
});

test('crossing DAY_TICKS flips to night of the same cycle', () => {
  expect(dayNight(DAY_TICKS - 1).isNight).toBe(false);
  const n = dayNight(DAY_TICKS);
  expect(n.isNight).toBe(true);
  expect(n.cycle).toBe(1);
});

test('cycle number advances each full day+night', () => {
  expect(dayNight(CYCLE_TICKS).cycle).toBe(2);
  expect(dayNight(2 * CYCLE_TICKS).cycle).toBe(3);
});

test('the match ends at TOTAL_TICKS', () => {
  expect(dayNight(TOTAL_TICKS - 1).ended).toBe(false);
  expect(dayNight(TOTAL_TICKS).ended).toBe(true);
  expect(TOTAL_TICKS).toBe(NIGHTS_TO_SURVIVE * CYCLE_TICKS);
});

test('ticksLeftInPhase counts down within a phase', () => {
  expect(dayNight(0).ticksLeftInPhase).toBe(DAY_TICKS);
  expect(dayNight(DAY_TICKS).ticksLeftInPhase).toBe(CYCLE_TICKS - DAY_TICKS);
});
