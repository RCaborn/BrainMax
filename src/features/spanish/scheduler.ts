import type { Dir, StoredCard } from '../../lib/db'
import { type Rng, shuffle } from '../../lib/rng'
import { type Grade, Rating, State, bucket as srsBucket, nextFields, retrievability as srsRetrievability, scheduler } from '../../lib/srs'
import { WORDS } from './words'

export { scheduler }
export const DAILY_SIZE = 20
export const EXTRA_SIZE = 10
export const PRODUCTION_UNLOCK_STABILITY = 7 // days
export const SPOT_CHECKS_PER_DAY = 2
export const PROVISIONAL_STABILITY = 30
export const LEECH_LAPSES = 6
export { MATURE_STABILITY } from '../../lib/srs'

export const cardId = (wordId: number, dir: Dir) => `${wordId}:${dir}`

/** Probability you'd recall the card right now (0..1). */
export const retrievability = (s: StoredCard, now: Date) => srsRetrievability(s, now)

/** Applies one graded answer; `spot` marks a correct placement spot-check (gets provisional stability). */
export function review(existing: StoredCard | undefined, wordId: number, dir: Dir, rating: Grade, now: Date, day: string, spot = false): StoredCard {
  const next = nextFields(existing, rating, now, day)
  if (spot && !existing && rating !== Rating.Again) {
    next.stability = Math.max(next.stability, PROVISIONAL_STABILITY)
    next.state = State.Review
    next.scheduled_days = PROVISIONAL_STABILITY
    next.due = now.getTime() + PROVISIONAL_STABILITY * 86_400_000
  }
  return { id: cardId(wordId, dir), wordId, dir, ...next }
}

export type ItemKind = 'review' | 'new' | 'spot'
export interface QueueItem {
  wordId: number
  dir: Dir
  kind: ItemKind
}

export interface QueueInput {
  cards: StoredCard[]
  /** Words marked known by the placement test (no card until spot-checked). */
  placementKnown: Set<number>
  /** Card ids already answered today. */
  doneToday: Set<string>
  now: Date
  endOfDay: Date
  size: number
  rng: Rng
}

/**
 * Picks what to study:
 * 1. Due cards, most-forgotten (lowest retrievability) first. Missed words get short
 *    intervals so they come back often; known words drift out to long intervals.
 * 2. A couple of spot-checks of placement-"known" words.
 * 3. New material: production (EN→ES) cards for words you recognise, alternating with
 *    new recognition words in frequency order.
 */
export function buildQueue(inp: QueueInput): QueueItem[] {
  const { cards, placementKnown, doneToday, now, endOfDay, size, rng } = inp
  const byId = new Map(cards.map((c) => [c.id, c]))
  const due = cards
    .filter((c) => c.state !== State.New && c.due <= endOfDay.getTime() && !doneToday.has(c.id))
    .map((c) => ({ c, r: retrievability(c, now) }))
    .sort((a, b) => a.r - b.r || a.c.wordId - b.c.wordId)
  const items: QueueItem[] = due.slice(0, size).map(({ c }) => ({ wordId: c.wordId, dir: c.dir, kind: 'review' }))
  if (items.length >= size) return items

  const unchecked = [...placementKnown].filter((id) => !byId.has(cardId(id, 'r')) && !doneToday.has(cardId(id, 'r')))
  for (const id of shuffle(rng, unchecked).slice(0, Math.min(SPOT_CHECKS_PER_DAY, size - items.length))) {
    items.push({ wordId: id, dir: 'r', kind: 'spot' })
  }

  const isFresh = (id: string) => !byId.has(id) && !doneToday.has(id)
  const prodNew: number[] = []
  const recNew: number[] = []
  for (const w of WORDS) {
    const r = byId.get(cardId(w.id, 'r'))
    // Once a recognition card exists (e.g. a failed spot check) it decides; otherwise trust the placement test.
    const knowsIt = r ? r.stability >= PRODUCTION_UNLOCK_STABILITY : placementKnown.has(w.id)
    if (knowsIt && isFresh(cardId(w.id, 'p'))) prodNew.push(w.id)
    else if (!placementKnown.has(w.id) && isFresh(cardId(w.id, 'r'))) recNew.push(w.id)
  }
  let i = 0
  let j = 0
  while (items.length < size && (i < prodNew.length || j < recNew.length)) {
    if (j < recNew.length) items.push({ wordId: recNew[j++], dir: 'r', kind: 'new' })
    if (items.length < size && i < prodNew.length) items.push({ wordId: prodNew[i++], dir: 'p', kind: 'new' })
  }
  return items
}

export type { Bucket } from '../../lib/srs'
export const bucket = (c: StoredCard) => srsBucket(c)

/** Estimated number of words you'd recognise today. */
export function recallEstimate(cards: StoredCard[], placementKnown: Set<number>, now: Date): number {
  let sum = 0
  const withCard = new Set<number>()
  for (const c of cards) {
    if (c.dir !== 'r') continue
    withCard.add(c.wordId)
    sum += retrievability(c, now)
  }
  // Unchecked placement words: assume the placement threshold (90%).
  for (const id of placementKnown) if (!withCard.has(id)) sum += 0.9
  return Math.round(sum)
}
