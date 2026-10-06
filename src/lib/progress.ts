import { db, getMeta, type DailyStatus } from './db'
import { addDays, dayKey, now } from './day'
import { bucket, recallEstimate } from '../features/spanish/scheduler'

export interface PlacementMeta {
  done: boolean
  knownWords: number[]
  bands: [number, number][] // [band, accuracy]
  date: string
}

export async function placementKnown(): Promise<Set<number>> {
  const p = await getMeta<PlacementMeta | null>('placement', null)
  return new Set(p?.knownWords ?? [])
}

/** Geography became a 4th daily task on this day; earlier days count as complete with 3 tasks. */
export async function geoLaunchDay(): Promise<string> {
  const d = await getMeta<string | null>('geoLaunch', null)
  if (d) return d
  const today = dayKey()
  await db.meta.put({ key: 'geoLaunch', value: today })
  return today
}

const needsGeo = (d: DailyStatus, geoLaunch: string | null) => !!geoLaunch && d.day >= geoLaunch

export const isComplete = (d: DailyStatus | undefined, geoLaunch: string | null = null) =>
  !!d && d.math && d.spanish && d.puzzle && (!needsGeo(d, geoLaunch) || !!d.geo)

export const taskCount = (day: string, geoLaunch: string | null) => (geoLaunch && day >= geoLaunch ? 4 : 3)

export const tasksDone = (d?: DailyStatus) => (d ? Number(d.math) + Number(d.spanish) + Number(d.puzzle) + Number(!!d.geo) : 0)

/** Consecutive days (ending today, or yesterday if today isn't finished yet) with every task done. */
export function streak(days: DailyStatus[], today = dayKey(), geoLaunch: string | null = null): number {
  const map = new Map(days.map((d) => [d.day, d]))
  let cur = isComplete(map.get(today), geoLaunch) ? today : addDays(today, -1)
  let n = 0
  while (isComplete(map.get(cur), geoLaunch)) {
    n++
    cur = addDays(cur, -1)
  }
  return n
}

export function bestStreak(days: DailyStatus[], geoLaunch: string | null = null): number {
  const done = days.filter((d) => isComplete(d, geoLaunch)).map((d) => d.day).sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of done) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Records today's Spanish knowledge snapshot (for the progress-over-time chart). */
export async function saveSnapshot() {
  const cards = await db.cards.toArray()
  const known = await placementKnown()
  const t = now()
  const counts = { learning: 0, young: 0, mature: 0 }
  let production = 0
  for (const c of cards) {
    if (c.dir === 'p') {
      if (c.stability >= 7) production++
      continue
    }
    counts[bucket(c)]++
  }
  await db.snapshots.put({ day: dayKey(t), recallEstimate: recallEstimate(cards, known, t), ...counts, production })
}
