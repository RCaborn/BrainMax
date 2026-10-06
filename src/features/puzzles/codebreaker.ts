import { type Rng, randInt } from '../../lib/rng'

export const PEGS = 4
export const COLOURS = 6
export const MAX_GUESSES = 8

export const generateCode = (rng: Rng) => Array.from({ length: PEGS }, () => randInt(rng, 0, COLOURS - 1))

/** Black = right colour, right place. White = right colour, wrong place. */
export function score(code: number[], guess: number[]): { black: number; white: number } {
  let black = 0
  const codeLeft: number[] = Array(COLOURS).fill(0)
  const guessLeft: number[] = Array(COLOURS).fill(0)
  for (let i = 0; i < code.length; i++) {
    if (code[i] === guess[i]) black++
    else {
      codeLeft[code[i]]++
      guessLeft[guess[i]]++
    }
  }
  let white = 0
  for (let c = 0; c < COLOURS; c++) white += Math.min(codeLeft[c], guessLeft[c])
  return { black, white }
}
