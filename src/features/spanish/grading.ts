import { Rating } from 'ts-fsrs'
import type { Dir } from '../../lib/db'
import { type Word, WORDS } from './words'

export type Result = 'correct' | 'accent' | 'typo' | 'wrong' | 'synonym'

export interface Grade {
  result: Result
  rating: Rating | null // null for 'synonym' (ask again, not graded)
  /** For synonym: the other word they typed. For accent/typo: the exact expected form. */
  detail?: string
}

export const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

// English is full of short near-neighbours (month/moth), so it needs longer words before a typo is forgiven.
const typoAllowed = (s: string, minLen: number) => (s.length >= minLen ? 1 : 0)

export function normalizeEn(s: string): string {
  let t = stripAccents(s.toLowerCase())
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  t = t.replace(/^(to|the|a|an) /, '')
  return t
}

export function normalizeEs(s: string): string {
  return s
    .toLowerCase()
    .replace(/[¿?¡!.,;:"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(el|la|los|las|un|una|el\/la) /, '')
}

/** Spanish forms accepted for a word: listed variants plus feminine of -o adjectives. */
export function spanishForms(w: Word): string[] {
  const forms = w.es.map((f) => f.toLowerCase())
  if (w.pos === 'adj') for (const f of [...forms]) if (f.endsWith('o')) forms.push(f.slice(0, -1) + 'a')
  return forms
}

// English meaning → words that carry it (for spotting valid synonyms in production).
const BY_MEANING = new Map<string, Word[]>()
for (const w of WORDS) {
  for (const m of w.en) {
    const k = normalizeEn(m)
    const list = BY_MEANING.get(k) ?? []
    list.push(w)
    BY_MEANING.set(k, list)
  }
}

export interface Timing {
  fastMs: number
  slowMs: number
}
export const TIMING: Record<Dir, Timing> = { r: { fastMs: 3000, slowMs: 8000 }, p: { fastMs: 4000, slowMs: 10000 } }

function ratingFor(result: Result, ms: number, dir: Dir, isReview: boolean): Rating | null {
  if (result === 'synonym') return null
  if (result === 'wrong') return Rating.Again
  if (result !== 'correct') return Rating.Hard
  const t = TIMING[dir]
  if (ms > t.slowMs) return Rating.Hard
  if (ms < t.fastMs && isReview) return Rating.Easy
  return Rating.Good
}

/**
 * Grades a typed answer.
 * dir 'r': Spanish shown, English typed. dir 'p': English shown, Spanish typed.
 * `extra` holds answers the user previously marked as correct for this card.
 */
export function grade(w: Word, dir: Dir, input: string, ms: number, isReview: boolean, extra: string[] = []): Grade {
  const result = dir === 'r' ? gradeRecognition(w, input, extra) : gradeProduction(w, input, extra)
  return { ...result, rating: ratingFor(result.result, ms, dir, isReview) }
}

function gradeRecognition(w: Word, input: string, extra: string[]): Omit<Grade, 'rating'> {
  const given = normalizeEn(input)
  if (!given) return { result: 'wrong' }
  const targets = [...w.en, ...extra].map(normalizeEn)
  const squash = (s: string) => s.replace(/[\s'-]/g, '')
  if (targets.some((t) => t === given || squash(t) === squash(given))) return { result: 'correct' }
  const near = targets.find((t) => levenshtein(t, given) <= typoAllowed(t, 6))
  if (near) return { result: 'typo', detail: near }
  return { result: 'wrong' }
}

function gradeProduction(w: Word, input: string, extra: string[]): Omit<Grade, 'rating'> {
  const given = normalizeEs(input)
  if (!given) return { result: 'wrong' }
  const targets = [...spanishForms(w), ...extra.map((e) => normalizeEs(e))]
  if (targets.includes(given)) return { result: 'correct' }
  const bare = stripAccents(given)
  const accentMiss = targets.find((t) => stripAccents(t) === bare)
  if (accentMiss) return { result: 'accent', detail: accentMiss }
  const near = targets.find((t) => levenshtein(stripAccents(t), bare) <= typoAllowed(t, 5))
  if (near) return { result: 'typo', detail: near }
  // A different word that also means one of the prompted meanings: ask again, ungraded.
  for (const m of w.en.slice(0, 3)) {
    for (const other of BY_MEANING.get(normalizeEn(m)) ?? []) {
      if (other.id !== w.id && spanishForms(other).some((f) => stripAccents(f) === bare)) {
        return { result: 'synonym', detail: other.es[0] }
      }
    }
  }
  return { result: 'wrong' }
}
