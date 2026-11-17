import { BALANCE, MINUTES_PER_DAY } from '../data/balance';

export const dayOf = (minute: number): number => Math.floor(minute / MINUTES_PER_DAY) + 1;
export const minuteOfDay = (minute: number): number => ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
export const hourOf = (minute: number): number => Math.floor(minuteOfDay(minute) / 60);
export const dayStart = (day: number): number => (day - 1) * MINUTES_PER_DAY;

export function formatClock(minute: number): string {
  const m = minuteOfDay(minute);
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  if (h < 48) return `${h}h ${total % 60}m`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * The "broadcast day" a minute belongs to. It runs from wake-up (08:00) to the next
 * wake-up, so late-night streams and yesterday's VODs stay reachable until morning.
 */
export const streamDayOf = (minute: number): number => dayOf(minute - BALANCE.wakeHour * 60);

/** Minutes until the next wake-up time (08:00). */
export function minutesUntilWake(minute: number): number {
  const mod = minuteOfDay(minute);
  const wake = BALANCE.wakeHour * 60;
  return mod < wake ? wake - mod : MINUTES_PER_DAY - mod + wake;
}

/** Days until rent is next charged (rent is charged at the start of day 8, 15, ...). */
export function daysUntilRent(minute: number): number {
  const day = dayOf(minute);
  const every = BALANCE.rent.everyDays;
  const next = Math.floor((day - 1) / every + 1) * every + 1;
  return next - day;
}

/** 0 = midnight, 0.5 = noon. Used by the world for lighting. */
export const dayProgress = (minute: number): number => minuteOfDay(minute) / MINUTES_PER_DAY;
