import { describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import { grade, normalizeEn } from '../src/features/spanish/grading'
import { WORDS, WORD_BY_ID, spanishDisplay } from '../src/features/spanish/words'
import { buildQueue, review, cardId, DAILY_SIZE } from '../src/features/spanish/scheduler'
import { knownWordsFrom, placementItems, shouldStop } from '../src/features/spanish/placement'
import type { StoredCard } from '../src/lib/db'
import { mulberry32 } from '../src/lib/rng'

const find = (es: string) => WORDS.find((w) => w.es[0] === es)!

describe('word list', () => {
  it('has 2000 unique words with meanings', () => {
    expect(WORDS).toHaveLength(2000)
    expect(new Set(WORDS.map((w) => w.es[0])).size).toBe(2000)
    for (const w of WORDS) expect(w.en.length).toBeGreaterThan(0)
  })
  it('shows articles, including el for stressed-a feminine nouns', () => {
    expect(spanishDisplay(find('casa'))).toBe('la casa')
    expect(spanishDisplay(find('agua'))).toBe('el agua')
    expect(spanishDisplay(find('hablar'))).toBe('hablar')
  })
})

describe('grading: recognition (ES → EN)', () => {
  const casa = find('casa')
  const hablar = find('hablar')
  it('accepts any listed meaning, case/article/"to" insensitive', () => {
    expect(grade(casa, 'r', 'House', 5000, false).result).toBe('correct')
    expect(grade(casa, 'r', 'the home', 5000, false).result).toBe('correct')
    expect(grade(hablar, 'r', 'to speak', 5000, false).result).toBe('correct')
    expect(grade(hablar, 'r', 'talk', 5000, false).result).toBe('correct')
  })
  it('one-letter typo on 6+ letter English word is Hard; short words must be exact', () => {
    const g = grade(find('ayer'), 'r', 'yesterdy', 5000, false)
    expect(g.result).toBe('typo')
    expect(g.rating).toBe(Rating.Hard)
    expect(grade(casa, 'r', 'cat', 5000, false).result).toBe('wrong')
    expect(grade(find('mes'), 'r', 'moth', 5000, false).result).toBe('wrong')
  })
  it('wrong is Again, slow correct is Hard, fast review is Easy, fast new is Good', () => {
    expect(grade(casa, 'r', 'car', 2000, true).rating).toBe(Rating.Again)
    expect(grade(casa, 'r', 'house', 9000, true).rating).toBe(Rating.Hard)
    expect(grade(casa, 'r', 'house', 2000, true).rating).toBe(Rating.Easy)
    expect(grade(casa, 'r', 'house', 2000, false).rating).toBe(Rating.Good)
  })
  it('user-accepted answers count', () => {
    expect(grade(casa, 'r', 'dwelling', 5000, false, ['dwelling']).result).toBe('correct')
  })
  it('normalizeEn strips noise', () => expect(normalizeEn('  To  Speak! ')).toBe('speak'))
})

describe('grading: production (EN → ES)', () => {
  it('article optional, accents graded Hard, ñ counts as accent', () => {
    expect(grade(find('casa'), 'p', 'la casa', 5000, false).result).toBe('correct')
    expect(grade(find('casa'), 'p', 'casa', 5000, false).result).toBe('correct')
    const g = grade(find('teléfono'), 'p', 'telefono', 5000, false)
    expect(g.result).toBe('accent')
    expect(g.rating).toBe(Rating.Hard)
    expect(grade(find('año'), 'p', 'ano', 5000, false).result).toBe('accent')
  })
  it('accepts feminine adjectives and listed variants', () => {
    expect(grade(find('nuevo'), 'p', 'nueva', 5000, false).result).toBe('correct')
    expect(grade(find('quizá'), 'p', 'quizás', 5000, false).result).toBe('correct')
  })
  it('a valid synonym asks again without grading', () => {
    // "pelo" and "cabello" both mean hair
    const g = grade(find('cabello'), 'p', 'pelo', 5000, false)
    expect(g.result).toBe('synonym')
    expect(g.rating).toBeNull()
  })
  it('typo within 1 on long words', () => {
    expect(grade(find('ventana'), 'p', 'ventena', 5000, false).result).toBe('typo')
    expect(grade(find('ventana'), 'p', 'puerta', 5000, false).result).toBe('wrong')
  })
})

const DAY = 86_400_000
const t0 = new Date(2026, 0, 1, 12)
const dayOf = (d: Date) => d.toISOString().slice(0, 10)

describe('queue', () => {
  it('due cards first, most-forgotten first, then new words in frequency order', () => {
    const now = new Date(t0.getTime() + 20 * DAY)
    const strong = review(undefined, 5, 'r', Rating.Easy, t0, dayOf(t0))
    const weak = review(undefined, 9, 'r', Rating.Again, t0, dayOf(t0))
    const q = buildQueue({ cards: [strong, weak], placementKnown: new Set(), doneToday: new Set(), now, endOfDay: new Date(now.getTime() + DAY / 2), size: 5, rng: mulberry32(1) })
    expect(q[0]).toMatchObject({ wordId: 9, kind: 'review' })
    expect(q[1]).toMatchObject({ wordId: 5, kind: 'review' })
    expect(q.slice(2).filter((i) => i.dir === 'r').map((i) => i.wordId)).toEqual([1, 2])
    // word 5 is now well known, so its EN→ES card unlocks
    expect(q.slice(2)).toContainEqual({ wordId: 5, dir: 'p', kind: 'new' })
  })
  it('caps at size; overflow stays due', () => {
    const cards: StoredCard[] = []
    for (let id = 1; id <= 30; id++) cards.push(review(undefined, id, 'r', Rating.Again, t0, dayOf(t0)))
    const now = new Date(t0.getTime() + 3 * DAY)
    const q = buildQueue({ cards, placementKnown: new Set(), doneToday: new Set(), now, endOfDay: now, size: DAILY_SIZE, rng: mulberry32(1) })
    expect(q).toHaveLength(20)
    expect(q.every((i) => i.kind === 'review')).toBe(true)
  })
  it('placement-known words get spot checks and unlock production', () => {
    const now = t0
    const q = buildQueue({ cards: [], placementKnown: new Set([1, 2, 3, 4]), doneToday: new Set(), now, endOfDay: now, size: 8, rng: mulberry32(1) })
    expect(q.filter((i) => i.kind === 'spot')).toHaveLength(2)
    expect(q.some((i) => i.dir === 'p' && i.kind === 'new')).toBe(true)
    expect(q.some((i) => i.dir === 'r' && i.kind === 'new' && i.wordId === 5)).toBe(true)
  })
})

describe('30-day simulation', () => {
  it('missed words recur far more often than known words', () => {
    // Simulated learner: knows even ranks well (95%), struggles with odd ranks (55%).
    const rng = mulberry32(11)
    const cards = new Map<string, StoredCard>()
    const seen = new Map<number, number>()
    for (let d = 0; d < 30; d++) {
      const now = new Date(t0.getTime() + d * DAY)
      const q = buildQueue({ cards: [...cards.values()], placementKnown: new Set(), doneToday: new Set(), now, endOfDay: new Date(now.getTime() + DAY / 2), size: DAILY_SIZE, rng })
      for (const item of q) {
        const p = item.wordId % 2 === 0 ? 0.95 : 0.55
        const ok = rng() < p
        const id = cardId(item.wordId, item.dir)
        cards.set(id, review(cards.get(id), item.wordId, item.dir, ok ? Rating.Good : Rating.Again, now, dayOf(now)))
        seen.set(item.wordId, (seen.get(item.wordId) ?? 0) + 1)
      }
    }
    const introduced = [...seen.keys()].filter((id) => id <= 40)
    const avg = (pred: (id: number) => boolean) => {
      const ids = introduced.filter(pred)
      return ids.reduce((s, id) => s + seen.get(id)!, 0) / ids.length
    }
    const hard = avg((id) => id % 2 === 1)
    const easy = avg((id) => id % 2 === 0)
    expect(hard).toBeGreaterThan(easy * 1.4)
    // New words keep flowing in.
    expect(Math.max(...seen.keys())).toBeGreaterThan(60)
  })
})

describe('placement', () => {
  it('samples 10 per band and marks ≥90% bands as known, minus misses', () => {
    const items = placementItems()
    expect(items).toHaveLength(100)
    const answers = items.map((it) => ({ band: it.band, wordId: it.word.id, correct: it.band < 3 || (it.band === 3 && it.word.id % 2 === 0) }))
    // band 0-2 perfect → 600 known
    const known = knownWordsFrom(answers)
    expect(known).toHaveLength(600)
    expect(WORD_BY_ID.get(known[0])).toBeDefined()
  })
  it('stops after two weak bands', () => {
    const items = placementItems().slice(0, 30)
    const answers = items.map((it) => ({ band: it.band, wordId: it.word.id, correct: it.band === 0 }))
    expect(shouldStop(answers)).toBe(true)
    expect(shouldStop(answers.slice(0, 20))).toBe(false)
  })
})

describe('production unlock', () => {
  it('a failed spot check of a placement-known word does not unlock EN→ES', () => {
    const failed = review(undefined, 3, 'r', Rating.Again, t0, dayOf(t0))
    const q = buildQueue({ cards: [failed], placementKnown: new Set([3, 4]), doneToday: new Set([failed.id]), now: t0, endOfDay: t0, size: 40, rng: mulberry32(2) })
    expect(q.some((i) => i.wordId === 3 && i.dir === 'p')).toBe(false)
    expect(q.some((i) => i.wordId === 4 && i.dir === 'p')).toBe(true)
  })
})
