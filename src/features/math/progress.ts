import { db, getMeta, setMeta } from '../../lib/db'
import { dayKey } from '../../lib/day'
import { CATEGORIES, type CategoryId } from './generators'
import { type LevelState, type Levels, type RecentAccuracy, STARTING_SKILLS, defaultLevels, unlockedSkills } from './engine'

/** Bumped when the ladders are rebuilt; older saved levels are reset to rung 1 with fast start. */
export const LADDER_VERSION = 2

export async function loadLevels(): Promise<Levels> {
  const levels = defaultLevels()
  const version = await getMeta<number>('mathLadderVersion', 1)
  if (version < LADDER_VERSION) {
    // Old levels were on a different scale; start everyone at rung 1 with fast start. History stays.
    await db.mathLevels.clear()
    await setMeta('mathLadderVersion', LADDER_VERSION)
    return levels
  }
  for (const r of await db.mathLevels.toArray()) {
    if (r.category in levels) levels[r.category as CategoryId] = { level: r.level, streak: r.streak, calibrating: r.calibrating ?? false }
  }
  return levels
}

export const saveLevel = (category: CategoryId, s: LevelState) => db.mathLevels.put({ category, ...s })

export async function loadRecentAccuracy(): Promise<RecentAccuracy> {
  const recent = await db.mathAttempts.orderBy('ts').reverse().limit(400).toArray()
  const acc: RecentAccuracy = {}
  for (const c of CATEGORIES) {
    const rows = recent.filter((a) => a.category === c.id && a.mode !== 'drill').slice(0, 20)
    if (rows.length >= 3) acc[c.id] = rows.filter((a) => a.correct).length / rows.length
  }
  return acc
}

export interface UnlockState {
  unlocked: CategoryId[]
  /** Unlocked today (not counting the starting skills): get extra practice slots. */
  newToday: CategoryId[]
  /** Unlocked skills whose lesson hasn't been opened yet. */
  unreadLessons: CategoryId[]
}

/** Records unlock dates for newly unlocked skills and reports what's new. */
export async function syncUnlocks(levels: Levels): Promise<UnlockState> {
  const today = dayKey()
  const unlocked = unlockedSkills(levels)
  const dates = await getMeta<Partial<Record<CategoryId, string>>>('mathUnlocks', {})
  let changed = false
  for (const c of unlocked) {
    if (!dates[c]) {
      dates[c] = today
      changed = true
    }
  }
  if (changed) await setMeta('mathUnlocks', dates)
  const seen = new Set(await getMeta<CategoryId[]>('lessonsSeen', []))
  return {
    unlocked,
    newToday: unlocked.filter((c) => dates[c] === today && !STARTING_SKILLS.includes(c)),
    unreadLessons: unlocked.filter((c) => !seen.has(c)),
  }
}

export async function markLessonSeen(c: CategoryId) {
  const seen = new Set(await getMeta<CategoryId[]>('lessonsSeen', []))
  seen.add(c)
  await setMeta('lessonsSeen', [...seen])
}
