import { parseDayKey, weekday } from '../../lib/day'

export type PuzzleType = 'countdown' | 'countdown-hard' | 'kenken' | 'kenken-6' | 'wordle' | 'codebreaker' | 'fermi'

export const PUZZLE_INFO: Record<PuzzleType, { name: string; blurb: string }> = {
  countdown: { name: 'Countdown Numbers', blurb: 'Reach the target using the six numbers, each used at most once, with + − × ÷.' },
  'countdown-hard': { name: 'Countdown Numbers (hard)', blurb: 'Small numbers only and long solutions. Reach the target exactly if you can.' },
  kenken: { name: 'KenKen', blurb: 'Fill the grid so no number repeats in a row or column, and each cage hits its target with its operation.' },
  'kenken-6': { name: 'KenKen 6×6', blurb: 'The big one. Same rules on a 6×6 grid.' },
  wordle: { name: 'Palabra (Spanish Wordle)', blurb: 'Guess the 5-letter Spanish word in 6 tries. Accents are ignored.' },
  codebreaker: { name: 'Code-breaker', blurb: 'Crack the 4-peg code in 8 guesses. Black = right colour and place, white = right colour only.' },
  fermi: { name: 'Calibration', blurb: 'Give a range you are 90% sure contains the answer. Over time you should hit about 9 in 10, no more, no fewer.' },
}

// Sun..Sat
const BY_WEEKDAY: PuzzleType[] = ['kenken-6', 'countdown', 'kenken', 'wordle', 'codebreaker', 'fermi', 'countdown-hard']

export const puzzleForDay = (day: string): PuzzleType => BY_WEEKDAY[weekday(day)]

/** Index of the week since a fixed epoch, used to walk the Fermi bank. */
export const weekIndex = (day: string) => Math.floor((parseDayKey(day).getTime() - new Date(2024, 0, 1, 12).getTime()) / (7 * 86_400_000))
