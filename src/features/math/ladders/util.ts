import { type Rng, pick as pickFrom, randInt } from '../../../lib/rng'
import { fmt, round } from '../format'

export { fmt, round }
export { fmtBig } from '../format'

/** Bound helpers for one generator call. */
export function tools(rng: Rng) {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  const pick = <T,>(arr: readonly T[]) => pickFrom(rng, arr)
  /** Random int in [lo, hi] for which `ok` holds (falls back to lo after many tries). */
  const rWhere = (lo: number, hi: number, ok: (n: number) => boolean) => {
    for (let i = 0; i < 200; i++) {
      const n = r(lo, hi)
      if (ok(n)) return n
    }
    return lo
  }
  /** Not a multiple of 10: keeps times-table-like round cases out. */
  const rNot10 = (lo: number, hi: number) => rWhere(lo, hi, (n) => n % 10 !== 0)
  /** k/10 that is not a whole number, e.g. 3.7. */
  const dec1 = (lo: number, hi: number) => rWhere(lo, hi, (n) => n % 10 !== 0) / 10
  const coin = (p = 0.5) => rng() < p
  return { r, pick, rWhere, rNot10, dec1, coin }
}

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/** Number of decimal places in x (up to 8). */
export function dp(x: number): number {
  const s = round(x, 8).toString()
  return s.includes('.') ? s.split('.')[1].length : 0
}

/** Signed percentage for display: 15 → "15%", −6.25 → "−6.25%". */
export const pct = (p: number) => `${fmt(p)}%`

export const signed = (p: number) => (p > 0 ? `+${fmt(p)}%` : `${fmt(p)}%`)
