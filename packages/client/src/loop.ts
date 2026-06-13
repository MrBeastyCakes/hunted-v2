import { TICK_RATE } from '@game/shared';

export const TICK_MS = 1000 / TICK_RATE;

// How many fixed sim steps to run for the accumulated time, plus leftover.
// maxSteps caps work per frame so a long stall can't cause a spiral of death.
export function stepsToRun(
  accumulatorMs: number,
  tickMs: number,
  maxSteps = 5,
): { steps: number; remainderMs: number } {
  if (tickMs <= 0) return { steps: 0, remainderMs: accumulatorMs };
  const steps = Math.floor(accumulatorMs / tickMs);
  if (steps > maxSteps) return { steps: maxSteps, remainderMs: 0 };
  return { steps, remainderMs: accumulatorMs - steps * tickMs };
}

// Fractional progress (0..1) toward the next tick, for render interpolation.
export function renderAlpha(remainderMs: number, tickMs: number): number {
  if (tickMs <= 0) return 0;
  return Math.min(1, Math.max(0, remainderMs / tickMs));
}
