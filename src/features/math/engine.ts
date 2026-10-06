import { type Rng, shuffle, pick } from '../../lib/rng'
import { CATEGORIES, type CategoryId, type Question, generate, MAX_LEVEL, MIN_LEVEL, START_LEVEL } from './generators'

export interface LevelState {
  level: number
  streak: number
}

/**
 * 3-up / 1-down staircase: three correct answers within target time step the level up;
 * a wrong answer steps it down. A correct-but-slow answer only resets the streak.
 * On accuracy alone a 3-up/1-down staircase converges near 79% correct.
 */
export function updateLevel(s: LevelState, correct: boolean, withinTarget: boolean): LevelState {
  if (!correct) return { level: Math.max(MIN_LEVEL, s.level - 1), streak: 0 }
  if (!withinTarget) return { level: s.level, streak: 0 }
  const streak = s.streak + 1
  if (streak >= 3) return { level: Math.min(MAX_LEVEL, s.level + 1), streak: 0 }
  return { level: s.level, streak }
}

export type Levels = Record<CategoryId, LevelState>

export const defaultLevels = (): Levels =>
  Object.fromEntries(CATEGORIES.map((c) => [c.id, { level: START_LEVEL, streak: 0 }])) as Levels

/** Recent accuracy per category (0..1), undefined when no data. */
export type RecentAccuracy = Partial<Record<CategoryId, number>>

/**
 * Ranks categories weakest first: lower level, then lower recent accuracy.
 * Unknown accuracy counts as 0.8 so untried categories sit mid-pack.
 */
export function weakestFirst(levels: Levels, acc: RecentAccuracy): CategoryId[] {
  return CATEGORIES.map((c) => c.id)
    .map((id) => ({ id, score: levels[id].level + (acc[id] ?? 0.8) * 3 }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.id)
}

/**
 * The daily 10: 4 from the weakest categories, 4 interleaved across the rest,
 * 2 stretch questions one level above current. Order is shuffled (interleaving).
 */
export function buildDailySet(levels: Levels, acc: RecentAccuracy, rng: Rng): Question[] {
  const ranked = weakestFirst(levels, acc)
  const weak = ranked.slice(0, 4)
  const others = shuffle(rng, ranked.slice(4))
  const mixed = others.slice(0, 4)
  const stretch = [pick(rng, ranked.slice(0, 5)), pick(rng, others.slice(4).length ? others.slice(4) : ranked)]
  const plan: [CategoryId, number][] = [
    ...weak.map((c): [CategoryId, number] => [c, levels[c].level]),
    ...mixed.map((c): [CategoryId, number] => [c, levels[c].level]),
    ...stretch.map((c): [CategoryId, number] => [c, levels[c].level + 1]),
  ]
  return shuffle(rng, plan).map(([c, l]) => generate(c, l, rng))
}

/** Speed drill: quick-fire arithmetic two levels below current, from the "core" categories. */
export function drillQuestion(levels: Levels, rng: Rng): Question {
  const cat = pick(rng, ['products', 'decimals', 'percentOf', 'fractions', 'division'] as CategoryId[])
  return generate(cat, levels[cat].level - 2, rng)
}

/** Exam mode: mixed questions at current level. */
export function examQuestion(levels: Levels, rng: Rng): Question {
  const cat = pick(rng, CATEGORIES.map((c) => c.id))
  return generate(cat, levels[cat].level, rng)
}

/** Points for one answer: 100 at target time, up to 150 if faster, down to 50 if slower; 0 if wrong. */
export function scoreAnswer(correct: boolean, ms: number, targetMs: number): number {
  if (!correct) return 0
  return Math.round(100 * Math.max(0.5, Math.min(1.5, targetMs / Math.max(ms, 1))))
}
