import { seeded, shuffle } from '../../lib/rng'
import { WORDS, type Word } from './words'

export const BAND_SIZE = 200
export const PER_BAND = 10
export const KNOWN_THRESHOLD = 0.9

export interface PlacementItem {
  band: number
  word: Word
}

/** 10 sampled words from each 200-rank band, easiest band first. */
export function placementItems(seed = 'placement-v1'): PlacementItem[] {
  const rng = seeded(seed)
  const bands = Math.ceil(WORDS.length / BAND_SIZE)
  const out: PlacementItem[] = []
  for (let b = 0; b < bands; b++) {
    const band = WORDS.slice(b * BAND_SIZE, (b + 1) * BAND_SIZE)
    for (const word of shuffle(rng, band).slice(0, PER_BAND)) out.push({ band: b, word })
  }
  return out
}

export interface PlacementAnswer {
  band: number
  wordId: number
  correct: boolean
}

/** Stop early once two consecutive completed bands score under 50%. */
export function shouldStop(answers: PlacementAnswer[]): boolean {
  const acc = bandAccuracy(answers)
  const done = [...acc.entries()].filter(([b]) => answers.filter((a) => a.band === b).length === PER_BAND)
  if (done.length < 2) return false
  const [x, y] = done.slice(-2)
  return x[1] < 0.5 && y[1] < 0.5
}

export function bandAccuracy(answers: PlacementAnswer[]): Map<number, number> {
  const m = new Map<number, { ok: number; n: number }>()
  for (const a of answers) {
    const s = m.get(a.band) ?? { ok: 0, n: 0 }
    s.n++
    if (a.correct) s.ok++
    m.set(a.band, s)
  }
  return new Map([...m].map(([b, s]) => [b, s.ok / s.n]))
}

/**
 * Bands scoring ≥90% are treated as known: every word in them is spot-checked over time
 * instead of taught. Sampled words you missed are excluded so they get taught.
 */
export function knownWordsFrom(answers: PlacementAnswer[]): number[] {
  const acc = bandAccuracy(answers)
  const missed = new Set(answers.filter((a) => !a.correct).map((a) => a.wordId))
  const known: number[] = []
  for (const [band, a] of acc) {
    if (a < KNOWN_THRESHOLD) continue
    for (const w of WORDS.slice(band * BAND_SIZE, (band + 1) * BAND_SIZE)) if (!missed.has(w.id)) known.push(w.id)
  }
  return known
}
