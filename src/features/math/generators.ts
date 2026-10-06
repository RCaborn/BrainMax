import type { Rng } from '../../lib/rng'
import type { Question, Rung, Tier } from './types'
import { parseAnswer } from './format'
import { PRODUCTS } from './ladders/products'
import { DECIMALS } from './ladders/decimals'
import { PERCENT_OF } from './ladders/percentOf'
import { PCT_CHANGE } from './ladders/pctChange'
import { FRACTIONS } from './ladders/fractions'
import { DIVISION } from './ladders/division'
import { BIG_NUMBERS } from './ladders/bigNumbers'
import { MULTIPLES } from './ladders/multiples'
import { GROWTH } from './ladders/growth'
import { ESTIMATION } from './ladders/estimation'

export type { Question } from './types'

export const CATEGORIES = [
  { id: 'products', name: 'Hard products' },
  { id: 'decimals', name: 'Decimal arithmetic' },
  { id: 'percentOf', name: 'Percent of' },
  { id: 'pctChange', name: '% change & back-solving' },
  { id: 'fractions', name: 'Fractions ↔ decimals ↔ %' },
  { id: 'division', name: 'Division' },
  { id: 'bigNumbers', name: 'Big numbers & units' },
  { id: 'multiples', name: 'Financial multiples' },
  { id: 'growth', name: 'Growth & compounding' },
  { id: 'estimation', name: 'Estimation' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const LADDERS: Record<CategoryId, Rung[]> = {
  products: PRODUCTS,
  decimals: DECIMALS,
  percentOf: PERCENT_OF,
  pctChange: PCT_CHANGE,
  fractions: FRACTIONS,
  division: DIVISION,
  bigNumbers: BIG_NUMBERS,
  multiples: MULTIPLES,
  growth: GROWTH,
  estimation: ESTIMATION,
}

export const MIN_LEVEL = 1
/** Number of rungs: levels run 1..rungCount(cat). */
export const rungCount = (cat: CategoryId) => LADDERS[cat].length
export const ON_RAMP_RUNGS = 3

export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id

export const clampLevel = (cat: CategoryId, l: number) => Math.max(MIN_LEVEL, Math.min(rungCount(cat), Math.round(l)))

export function tierOf(cat: CategoryId, level: number): Tier {
  const n = rungCount(cat)
  if (level <= ON_RAMP_RUNGS) return 'On-ramp'
  if (level > n - 4) return 'IB-ready'
  return 'Core'
}

export const rungOf = (cat: CategoryId, level: number) => LADDERS[cat][clampLevel(cat, level) - 1]

export const targetMsFor = (cat: CategoryId, level: number) => rungOf(cat, level).targetS * 1000

export function generate(category: CategoryId, level: number, rng: Rng): Question {
  const l = clampLevel(category, level)
  const rung = rungOf(category, l)
  const d = rung.gen(rng)
  return {
    prompt: d.prompt, note: d.note, answer: d.answer, display: d.display, hint: d.hint, fractionOver: d.fractionOver,
    tol: d.tol ?? 0, relTol: d.relTol ?? 0,
    category, level: l, rungTitle: rung.title, tier: tierOf(category, l), targetMs: rung.targetS * 1000,
  }
}

/** Parses typed input for a question: also accepts "11/16" on "?/16" questions. */
export function parseFor(q: Pick<Question, 'fractionOver'>, raw: string): number | null {
  const m = raw.trim().match(/^(-?\d+)\s*\/\s*(\d+)$/)
  if (m && q.fractionOver && Number(m[2]) === q.fractionOver) return Number(m[1])
  return parseAnswer(raw)
}

export function isCorrect(q: Pick<Question, 'answer' | 'tol' | 'relTol'>, given: number | null): boolean {
  if (given === null || !Number.isFinite(given)) return false
  const tol = Math.max(q.tol, q.relTol * Math.abs(q.answer), 1e-9 * Math.max(1, Math.abs(q.answer)))
  return Math.abs(given - q.answer) <= tol
}
