/**
 * Rounds half away from zero, ignoring float noise: round(0.1 + 0.2, 6) === 0.3 and
 * round(28.174999999999997, 2) === 28.18 (the product 4.9 × 1.25 × 4.6 is exactly 28.175).
 */
export function round(x: number, dp = 6): number {
  const f = 10 ** dp
  const scaled = Number((Math.abs(x) * f).toPrecision(12))
  return (Math.sign(x) * Math.round(scaled)) / f
}

/** 12345.5 → "12,345.5" (trims trailing zeros, max 4 dp). */
export function fmt(n: number, maxDp = 4): string {
  const r = round(n, maxDp)
  const [int, dec] = Math.abs(r).toString().split('.')
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (r < 0 ? '−' : '') + withCommas + (dec ? '.' + dec : '')
}

/** 1_440_000_000 → "1.44bn", 300_000 → "300k". */
export function fmtBig(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e12) return fmt(n / 1e12, 3) + 'tn'
  if (abs >= 1e9) return fmt(n / 1e9, 3) + 'bn'
  if (abs >= 1e6) return fmt(n / 1e6, 3) + 'm'
  if (abs >= 1e4) return fmt(n / 1e3, 3) + 'k'
  return fmt(n)
}

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, mn: 1e6, mm: 1e6, b: 1e9, bn: 1e9, tn: 1e12, t: 1e12 }

/** Parses typed answers: "1,440", "1.44bn", "−20", "15%", "8.5x", "300k". Returns null if unparseable. */
export function parseAnswer(raw: string): number | null {
  let s = raw.trim().toLowerCase().replace(/[\s,£$€]/g, '').replace(/[−–—]/g, '-')
  if (!s) return null
  s = s.replace(/^[x×]/, '').replace(/[%x×]$/, '')
  const m = s.match(/^(-?\d*\.?\d+)([a-z]*)$/)
  if (!m) return null
  const value = Number(m[1])
  if (!Number.isFinite(value)) return null
  if (!m[2]) return value
  const mult = SUFFIX[m[2]]
  return mult ? value * mult : null
}
