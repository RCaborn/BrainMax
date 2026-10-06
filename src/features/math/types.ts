import type { Rng } from '../../lib/rng'

export type Tier = 'On-ramp' | 'Core' | 'IB-ready'

/** What a rung generator returns. */
export interface Draft {
  prompt: string
  /** Short line under the prompt, e.g. "to 1 d.p." */
  note?: string
  answer: number
  /** Correct answer as shown after answering. */
  display: string
  /** Absolute tolerance (default 0). */
  tol?: number
  /** Relative tolerance (default 0). The check uses max(tol, relTol·|answer|). */
  relTol?: number
  hint: string
  /** For "0.6875 = ?/16" questions: also accept "11/16" typed with this denominator. */
  fractionOver?: number
}

export interface Rung {
  key: string
  title: string
  /** Fair target time in seconds for this rung (from the difficulty audit). */
  targetS: number
  gen: (rng: Rng) => Draft
}

export interface Question extends Required<Pick<Draft, 'prompt' | 'answer' | 'display' | 'hint'>> {
  note?: string
  fractionOver?: number
  tol: number
  relTol: number
  category: string
  level: number
  rungTitle: string
  tier: Tier
  targetMs: number
}
