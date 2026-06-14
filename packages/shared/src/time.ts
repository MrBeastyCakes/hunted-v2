import { DAY_TICKS, NIGHT_TICKS, NIGHTS_TO_SURVIVE } from './constants';

export const CYCLE_TICKS = DAY_TICKS + NIGHT_TICKS;
export const TOTAL_TICKS = NIGHTS_TO_SURVIVE * CYCLE_TICKS;

export interface DayNight {
  phase: 'day' | 'night';
  cycle: number; // 1..NIGHTS_TO_SURVIVE
  isNight: boolean;
  ticksLeftInPhase: number;
  ended: boolean; // survived to the end of the final night
}

export function dayNight(tick: number): DayNight {
  if (tick >= TOTAL_TICKS) {
    return { phase: 'night', cycle: NIGHTS_TO_SURVIVE, isNight: true, ticksLeftInPhase: 0, ended: true };
  }
  const inCycle = tick % CYCLE_TICKS;
  const isNight = inCycle >= DAY_TICKS;
  return {
    phase: isNight ? 'night' : 'day',
    cycle: Math.floor(tick / CYCLE_TICKS) + 1,
    isNight,
    ticksLeftInPhase: isNight ? CYCLE_TICKS - inCycle : DAY_TICKS - inCycle,
    ended: false,
  };
}
