import type { Rng } from '../../lib/rng'
import { stripAccents } from '../spanish/grading'
import { type Word, WORDS } from '../spanish/words'

export const WORD_LEN = 5
export const MAX_TRIES = 6

export const wordleKey = (w: Word) => stripAccents(w.es[0].toLowerCase())

/** Five-letter single words (accents stripped, ñ kept as n). */
export const FIVE_LETTER = WORDS.filter((w) => /^[a-z]{5}$/.test(wordleKey(w)))

/** Prefers words you've already learned; falls back to the 600 most common. */
export function pickAnswer(rng: Rng, learnedIds: Set<number>): Word {
  const learned = FIVE_LETTER.filter((w) => learnedIds.has(w.id))
  const pool = learned.length >= 10 ? learned : FIVE_LETTER.filter((w) => w.id <= 600)
  return pool[Math.floor(rng() * pool.length)]
}

export type Mark = 'hit' | 'present' | 'miss'

/** Standard Wordle marking with correct handling of repeated letters. */
export function markGuess(answer: string, guess: string): Mark[] {
  const marks: Mark[] = Array(guess.length).fill('miss')
  const left = new Map<string, number>()
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'hit'
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1)
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'hit') continue
    const n = left.get(guess[i]) ?? 0
    if (n > 0) {
      marks[i] = 'present'
      left.set(guess[i], n - 1)
    }
  }
  return marks
}
