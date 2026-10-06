import { type Rng, randInt, shuffle } from '../../lib/rng'

export interface CountdownPuzzle {
  numbers: number[]
  target: number
  /** Fewest numbers any exact solution needs. */
  minNumbers: number
  solution: string
}

interface Entry {
  expr: string
  count: number
}

/**
 * Exhaustive solver over subsets (bitmasks): reach[mask] maps every value reachable using
 * exactly the numbers in `mask` (each at most once) to an expression. Only positive integer
 * intermediate results are allowed, as in the TV game.
 */
export function solveAll(numbers: number[]): Map<number, Entry> {
  const n = numbers.length
  const reach: Map<number, Entry>[] = Array.from({ length: 1 << n }, () => new Map())
  for (let i = 0; i < n; i++) reach[1 << i].set(numbers[i], { expr: String(numbers[i]), count: 1 })
  const masks = Array.from({ length: (1 << n) - 1 }, (_, i) => i + 1).sort((a, b) => popcount(a) - popcount(b))
  for (const mask of masks) {
    if (popcount(mask) < 2) continue
    const out = reach[mask]
    // Iterate unordered splits {a, b} with a < b to halve the work.
    for (let a = (mask - 1) & mask; a > 0; a = (a - 1) & mask) {
      const b = mask ^ a
      if (a > b) continue
      for (const [x, ex] of reach[a]) {
        for (const [y, ey] of reach[b]) {
          const count = ex.count + ey.count
          const [hi, lo, ehi, elo] = x >= y ? [x, y, ex, ey] : [y, x, ey, ex]
          add(out, hi + lo, `(${ehi.expr} + ${elo.expr})`, count)
          if (lo !== 1) add(out, hi * lo, `${wrap(ehi.expr)} × ${wrap(elo.expr)}`, count)
          if (hi !== lo) add(out, hi - lo, `(${ehi.expr} − ${elo.expr})`, count)
          if (lo !== 1 && hi % lo === 0) add(out, hi / lo, `${wrap(ehi.expr)} ÷ ${wrap(elo.expr)}`, count)
        }
      }
    }
  }
  const all = new Map<number, Entry>()
  for (const m of reach) for (const [v, e] of m) {
    const cur = all.get(v)
    if (!cur || e.count < cur.count) all.set(v, { ...e, expr: tidy(e.expr) })
  }
  return all
}

/** Parenthesise compound operands of × and ÷ (sums/differences already carry parens). */
const wrap = (e: string) => (/^\d+$/.test(e) || (e.startsWith('(') && e.endsWith(')') && balanced(e.slice(1, -1))) ? e : `(${e})`)
function add(m: Map<number, Entry>, v: number, expr: string, count: number) {
  if (!m.has(v)) m.set(v, { expr, count })
}
const tidy = (e: string) => (e.startsWith('(') && e.endsWith(')') && balanced(e.slice(1, -1)) ? e.slice(1, -1) : e)
function balanced(s: string): boolean {
  let d = 0
  for (const ch of s) {
    if (ch === '(') d++
    if (ch === ')' && --d < 0) return false
  }
  return d === 0
}
function popcount(x: number): number {
  let c = 0
  while (x) {
    x &= x - 1
    c++
  }
  return c
}

const LARGE = [25, 50, 75, 100]

/** Normal: 1–2 large numbers, needs ≥3 numbers. Hard: 0–1 large, needs ≥5 numbers. */
export function generateCountdown(rng: Rng, hard: boolean): CountdownPuzzle {
  for (let attempt = 0; attempt < 200; attempt++) {
    const largeCount = hard ? randInt(rng, 0, 1) : randInt(rng, 1, 2)
    const smallPool = shuffle(rng, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10])
    const numbers = [...shuffle(rng, LARGE).slice(0, largeCount), ...smallPool.slice(0, 6 - largeCount)]
    const all = solveAll(numbers)
    const need = hard ? 5 : 3
    const candidates = [...all.entries()].filter(([v, e]) => v >= 101 && v <= 999 && e.count >= need)
    if (!candidates.length) continue
    const [target, entry] = candidates[Math.floor(rng() * candidates.length)]
    return { numbers, target, minNumbers: entry.count, solution: entry.expr }
  }
  throw new Error('Could not generate a countdown puzzle')
}

export function countdownScore(target: number, best: number | null): number {
  if (best === null) return 0
  const d = Math.abs(target - best)
  return d === 0 ? 10 : d <= 5 ? 7 : d <= 10 ? 5 : 0
}
