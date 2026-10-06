// A "day" rolls over at 4am local time, so a late-night session counts for the day before.
const ROLLOVER_HOURS = 4
const OFFSET_KEY = 'bm.timeOffsetDays'

/** Dev-only clock shift (in days), used to simulate future days without waiting. */
export function getTimeOffsetDays(): number {
  try {
    return Number(localStorage.getItem(OFFSET_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export function setTimeOffsetDays(days: number) {
  try {
    localStorage.setItem(OFFSET_KEY, String(days))
  } catch {
    /* storage unavailable: time travel just won't persist */
  }
}

export function now(): Date {
  return new Date(Date.now() + getTimeOffsetDays() * 86_400_000)
}

export function dayKey(d: Date = now()): string {
  const shifted = new Date(d.getTime() - ROLLOVER_HOURS * 3_600_000)
  const y = shifted.getFullYear()
  const m = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** The instant the given study day ends (next rollover). */
export function endOfDay(d: Date = now()): Date {
  const [y, m, day] = dayKey(d).split('-').map(Number)
  return new Date(y, m - 1, day + 1, ROLLOVER_HOURS)
}

/** Parses a day key as local noon (safe for weekday / arithmetic). */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(key: string, n: number): string {
  const d = parseDayKey(key)
  d.setDate(d.getDate() + n)
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12))
}

export function weekday(key: string): number {
  return parseDayKey(key).getDay()
}
