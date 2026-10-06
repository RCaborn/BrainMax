import { type Rng, pick, shuffle } from '../../lib/rng'
import { CATEGORIES, type CategoryId, type Question, clampLevel, generate, rungCount } from './generators'

export interface LevelState {
  level: number
  streak: number
  /** Fast start: climb one rung per fast correct answer until the first miss. */
  calibrating: boolean
}

export const freshLevel = (): LevelState => ({ level: 1, streak: 0, calibrating: true })

/**
 * Staircase:
 * - fast start (calibrating): each correct answer within target moves up a rung; the first miss ends it (and steps down).
 * - then 3-up/1-down: 3 correct within target → up; wrong → down.
 * - correct but slow: within 2× target keeps the streak; slower than that resets it. Never a step down.
 */
export function updateLevel(cat: CategoryId, s: LevelState, correct: boolean, ms: number, targetMs: number): LevelState {
  const max = rungCount(cat)
  if (!correct) return { level: Math.max(1, s.level - 1), streak: 0, calibrating: false }
  if (ms <= targetMs) {
    if (s.calibrating) return { level: Math.min(max, s.level + 1), streak: 0, calibrating: true }
    const streak = s.streak + 1
    if (streak >= 3) return { level: Math.min(max, s.level + 1), streak: 0, calibrating: false }
    return { ...s, streak }
  }
  if (ms <= 2 * targetMs) return s
  return { ...s, streak: 0 }
}

export type Levels = Record<CategoryId, LevelState>

export const defaultLevels = (): Levels => Object.fromEntries(CATEGORIES.map((c) => [c.id, freshLevel()])) as Levels

/** Recent accuracy per category (0..1), undefined when no data. */
export type RecentAccuracy = Partial<Record<CategoryId, number>>

// ---------- skill path ----------

export const STARTING_SKILLS: CategoryId[] = ['products', 'percentOf', 'fractions']

export const PREREQS: Record<CategoryId, CategoryId[]> = {
  products: [],
  percentOf: [],
  fractions: [],
  decimals: ['products'],
  division: ['products', 'fractions'],
  pctChange: ['percentOf'],
  bigNumbers: ['products', 'division'],
  estimation: ['products', 'decimals', 'division'],
  growth: ['percentOf', 'pctChange', 'decimals'],
  multiples: ['products', 'bigNumbers', 'percentOf'],
}

/** A prerequisite counts as done once its on-ramp (rungs 1-3) is cleared. */
export const UNLOCK_LEVEL = 4

export function unlockedSkills(levels: Levels): CategoryId[] {
  const out = new Set<CategoryId>(STARTING_SKILLS)
  let changed = true
  while (changed) {
    changed = false
    for (const c of CATEGORIES.map((x) => x.id)) {
      if (out.has(c)) continue
      if (PREREQS[c].every((p) => out.has(p) && levels[p].level >= UNLOCK_LEVEL)) {
        out.add(c)
        changed = true
      }
    }
  }
  return CATEGORIES.map((x) => x.id).filter((c) => out.has(c))
}

// ---------- session builders ----------

const weight = (acc: number | undefined) => 0.5 + (1 - (acc ?? 0.8)) * 3

function weightedPick(rng: Rng, cats: CategoryId[], acc: RecentAccuracy): CategoryId {
  const ws = cats.map((c) => weight(acc[c]))
  let x = rng() * ws.reduce((a, b) => a + b, 0)
  for (let i = 0; i < cats.length; i++) {
    x -= ws[i]
    if (x <= 0) return cats[i]
  }
  return cats[cats.length - 1]
}

/**
 * The daily 10, from unlocked skills only:
 * - a skill unlocked today gets 3 questions (its first practice after the lesson);
 * - every other unlocked skill appears at least once (interleaving), if there is room;
 * - 2 stretch questions one rung up;
 * - the rest weighted towards low recent accuracy, with replacement.
 */
export function buildDailySet(levels: Levels, acc: RecentAccuracy, unlocked: CategoryId[], newToday: CategoryId[], rng: Rng): Question[] {
  const SIZE = 10
  const plan: [CategoryId, number][] = []
  const fresh = newToday.filter((c) => unlocked.includes(c)).slice(0, 2)
  for (const c of fresh) for (let i = 0; i < 3; i++) plan.push([c, levels[c].level])
  const others = unlocked.filter((c) => !fresh.includes(c))
  const pool = others.length ? others : unlocked
  const stretchCount = Math.min(2, SIZE - plan.length)
  for (const c of shuffle(rng, others)) if (plan.length < SIZE - stretchCount) plan.push([c, levels[c].level])
  for (let i = 0; i < stretchCount; i++) {
    const c = pick(rng, pool)
    plan.push([c, clampLevel(c, levels[c].level + 1)])
  }
  while (plan.length < SIZE) {
    const c = weightedPick(rng, pool, acc)
    plan.push([c, levels[c].level])
  }
  return shuffle(rng, plan).map(([c, l]) => generate(c, l, rng))
}

const DRILL_SKILLS: CategoryId[] = ['products', 'decimals', 'percentOf', 'fractions', 'division']

/** Speed drill: quick-fire, two rungs below current, from unlocked core skills. */
export function drillQuestion(levels: Levels, unlocked: CategoryId[], rng: Rng): Question {
  const cats = DRILL_SKILLS.filter((c) => unlocked.includes(c))
  const cat = pick(rng, cats.length ? cats : unlocked)
  return generate(cat, Math.max(1, levels[cat].level - 2), rng)
}

/** Exam mode: mixed questions at the current rung of unlocked skills. */
export function examQuestion(levels: Levels, unlocked: CategoryId[], rng: Rng): Question {
  const cat = pick(rng, unlocked)
  return generate(cat, levels[cat].level, rng)
}

/** Points for one answer: 100 at target time, up to 150 if faster, down to 50 if slower; 0 if wrong. */
export function scoreAnswer(correct: boolean, ms: number, targetMs: number): number {
  if (!correct) return 0
  return Math.round(100 * Math.max(0.5, Math.min(1.5, targetMs / Math.max(ms, 1))))
}
