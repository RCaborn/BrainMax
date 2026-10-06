import { type Card, type Grade, Rating, State, createEmptyCard, fsrs } from 'ts-fsrs'

// One graded answer per card per day; in-session retries are handled by each session, so
// FSRS short-term (minute-level) steps are disabled.
export const scheduler = fsrs({ request_retention: 0.9, enable_short_term: false, enable_fuzz: true, maximum_interval: 3650 })

/** The FSRS fields every stored card carries (Spanish and geography). */
export interface SrsFields {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: number | null
  created: string // day key
}

export function toCard(s: SrsFields): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  }
}

export function fromCard(c: Card, created: string): SrsFields {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.getTime() : null,
    created,
  }
}

/** Applies one graded answer to a card's memory state (a new card if `existing` is undefined). */
export function nextFields(existing: SrsFields | undefined, rating: Grade, now: Date, day: string): SrsFields {
  const base = existing ? toCard(existing) : createEmptyCard(now)
  return fromCard(scheduler.next(base, now, rating).card, existing?.created ?? day)
}

/** Probability you'd recall the card right now (0..1). */
export function retrievability(s: SrsFields, now: Date): number {
  if (s.state === State.New || !s.last_review) return 0
  return scheduler.get_retrievability(toCard(s), now, false)
}

export type Bucket = 'learning' | 'young' | 'mature'
export const MATURE_STABILITY = 21
export function bucket(c: SrsFields): Bucket {
  if (c.state === State.Learning || c.state === State.Relearning || c.stability < 7) return 'learning'
  return c.stability >= MATURE_STABILITY ? 'mature' : 'young'
}

export { Rating, State }
export type { Grade }
