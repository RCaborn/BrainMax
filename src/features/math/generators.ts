import { type Rng, pick, randInt } from '../../lib/rng'
import { fmt, fmtBig, round } from './format'

export const MIN_LEVEL = 1
export const MAX_LEVEL = 10
export const START_LEVEL = 5

export interface Question {
  category: CategoryId
  level: number
  prompt: string
  /** Optional short note under the prompt, e.g. "to 1 d.p." */
  note?: string
  answer: number
  /** Formatted correct answer shown on review. */
  display: string
  /** Absolute tolerance; the check uses max(tol, relTol·|answer|). */
  tol: number
  relTol: number
  hint: string
  targetMs: number
}

type Draft = Omit<Question, 'category' | 'level' | 'targetMs' | 'tol' | 'relTol'> & { tol?: number; relTol?: number }
type Gen = (level: number, rng: Rng) => Draft

export const CATEGORIES = [
  { id: 'products', name: 'Hard products', baseMs: 10_000 },
  { id: 'decimals', name: 'Decimal arithmetic', baseMs: 10_000 },
  { id: 'percentOf', name: 'Percent of', baseMs: 10_000 },
  { id: 'pctChange', name: '% change & back-solving', baseMs: 14_000 },
  { id: 'fractions', name: 'Fractions ↔ decimals ↔ %', baseMs: 8_000 },
  { id: 'division', name: 'Division to decimals', baseMs: 14_000 },
  { id: 'bigNumbers', name: 'Big numbers & units', baseMs: 14_000 },
  { id: 'multiples', name: 'Financial multiples', baseMs: 15_000 },
  { id: 'growth', name: 'Growth & compounding', baseMs: 18_000 },
  { id: 'estimation', name: 'Estimation (±2%)', baseMs: 15_000 },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id

const clampLevel = (l: number) => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(l)))

/** Target time grows with difficulty: 60% of base at level 1 → 150% at level 10. */
export const targetMsFor = (cat: CategoryId, level: number) => {
  const base = CATEGORIES.find((c) => c.id === cat)!.baseMs
  return Math.round((base * (0.6 + ((level - 1) * 0.9) / 9)) / 500) * 500
}

// ---------- hint helpers ----------

/** Worked shortcut for a×b (integers). */
export function productHint(a: number, b: number): string {
  if (a === b) {
    const near = Math.round(a / 10) * 10
    const d = Math.abs(a - near)
    if (d === 0) return `${a}² = ${fmt(a * a)}`
    const other = 2 * a - near
    return `${a}² = (${a}−${d})(${a}+${d}) + ${d}² = ${Math.min(near, other)}×${Math.max(near, other)} + ${d * d} = ${fmt(near * other)} + ${d * d} = ${fmt(a * a)}`
  }
  if (a >= 85 && a < 100 && b >= 85 && b < 100) {
    const da = 100 - a
    const db = 100 - b
    return `Near 100: ${a} is −${da}, ${b} is −${db}. Cross: ${a}−${db} = ${a - db} → ×100 = ${fmt((a - db) * 100)}; plus ${da}×${db} = ${da * db}. Total ${fmt(a * b)}`
  }
  // Compensation if one factor is within 3 of a round number.
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    const step = x >= 100 ? 100 : 10
    const round10 = Math.round(x / step) * step
    const diff = x - round10
    if (round10 > 0 && diff !== 0 && Math.abs(diff) <= 3 && x >= 10) {
      const sign = diff > 0 ? '+' : '−'
      return `${y}×${x} = ${y}×${round10} ${sign} ${y}×${Math.abs(diff)} = ${fmt(y * round10)} ${sign} ${fmt(y * Math.abs(diff))} = ${fmt(a * b)}`
    }
  }
  // Split the smaller factor into tens and units.
  const [big, small] = a >= b ? [a, b] : [b, a]
  if (small < 10) {
    const hundreds = Math.floor(big / 100) * 100
    const rest = big - hundreds
    const tens = Math.floor(rest / 10) * 10
    const units = rest % 10
    const parts = [hundreds, tens, units].filter((p) => p > 0)
    return `${big}×${small} = ${parts.map((p) => `${p}×${small}`).join(' + ')} = ${parts.map((p) => fmt(p * small)).join(' + ')} = ${fmt(big * small)}`
  }
  const tens = Math.floor(small / 10) * 10
  const units = small % 10
  if (units === 0) return `${big}×${small} = ${big}×${small / 10}×10 = ${fmt(big * small)}`
  return `${big}×${small} = ${big}×${tens} + ${big}×${units} = ${fmt(big * tens)} + ${fmt(big * units)} = ${fmt(big * small)}`
}

function percentHint(p: number, base: number): string {
  const ten = base / 10
  const pieces: string[] = []
  let rest = p
  const chunks: [number, string][] = [
    [50, `50% = ${fmt(base / 2)}`],
    [25, `25% = ${fmt(base / 4)}`],
    [10, `10% = ${fmt(ten)}`],
    [5, `5% = ${fmt(ten / 2)}`],
    [2.5, `2.5% = ${fmt(ten / 4)}`],
    [1, `1% = ${fmt(base / 100)}`],
    [0.5, `0.5% = ${fmt(base / 200)}`],
    [0.1, `0.1% = ${fmt(base / 1000)}`],
  ]
  for (const [size, label] of chunks) {
    let n = 0
    while (rest >= size - 1e-9 && n < 9) {
      rest = round(rest - size)
      n++
    }
    if (n) pieces.push(n === 1 ? label : `${n}×(${label})`)
  }
  return `Build ${fmt(p)}% from easy pieces of ${fmt(base)}: ${pieces.join(', ')} → ${fmt(round((p * base) / 100))}`
}

const divisionHint = (a: number, b: number, q: number) => {
  const chunk = Math.floor(a / b / 10) * 10
  if (chunk === 0) return `${fmt(a)} ÷ ${fmt(b)}: ${fmt(b)}×${Math.floor(a / b)} = ${fmt(b * Math.floor(a / b))}, remainder ${fmt(round(a - b * Math.floor(a / b)))} → ≈ ${fmt(q)}`
  const rem = round(a - b * chunk)
  return `Chunk it: ${fmt(b)}×${chunk} = ${fmt(b * chunk)}, leaving ${fmt(rem)}; ${fmt(rem)} ÷ ${fmt(b)} ≈ ${fmt(round(rem / b, 2))} → ${fmt(q)}`
}

// ---------- generators ----------

const products: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  let a: number
  let b: number
  switch (level) {
    case 1: a = r(23, 99); b = r(6, 9); break
    case 2: a = r(120, 999); b = r(3, 9); break
    case 3: a = r(13, 39); b = a; break
    case 4: a = r(23, 99); b = r(11, 19); break
    case 5: a = r(21, 79); b = pick(rng, [19, 21, 29, 31, 39, 41, 49, 51, 59, 61, 69, 71, 79, 81, 99, 101]); break
    case 6: a = r(86, 99); b = r(86, 99); break
    case 7: a = r(41, 99); b = a; break
    case 8: a = r(41, 99); b = r(41, 99); break
    case 9: a = r(110, 499); b = r(12, 49); break
    default: a = r(310, 999); b = r(23, 99)
  }
  const ans = a * b
  return { prompt: a === b ? `${a}²` : `${a} × ${b}`, answer: ans, display: fmt(ans), hint: productHint(a, b) }
}

const decimals: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  let a: number, b: number, op = '×'
  switch (level) {
    case 1: a = pick(rng, [0.5, 0.25, 0.75]); b = r(3, 40) * 4; break
    case 2: a = r(11, 95) / 100; b = r(2, 9) * 20; break
    case 3: a = r(11, 99) / 10; b = r(3, 9); break
    case 4: a = r(11, 49) / 10; b = pick(rng, [1.5, 2.5, 3.5, 4.5, 0.4, 0.6, 0.8]); break
    case 5: { b = pick(rng, [0.02, 0.04, 0.05, 0.06, 0.08, 0.3, 0.4, 0.6]); const q = r(3, 60) * 5; a = round(q * b); op = '÷'; break }
    case 6: a = pick(rng, [0.075, 0.125, 0.025, 0.035, 0.045, 0.015]); b = r(2, 30) * 40; break
    case 7: a = pick(rng, [1.25, 2.25, 3.75, 1.75, 2.75, 0.375, 0.625]); b = r(12, 99) / 10 * 4; b = round(b); break
    case 8: a = r(12, 99) / 10; b = r(12, 99) / 10; break
    case 9: { b = r(11, 99) / 100; const q = r(12, 95) * 10; a = round(q * b); op = '÷'; break }
    default: { const x = r(11, 49) / 10; const y = pick(rng, [0.4, 2.5, 0.25, 1.25, 0.8]); const z = r(12, 60) / 10; const ans = round(x * y * z)
      return { prompt: `${fmt(x)} × ${fmt(y)} × ${fmt(z)}`, answer: ans, display: fmt(ans), hint: `Pair the friendly factor first: ${fmt(y)} × ${fmt(x)} = ${fmt(round(x * y))}, then × ${fmt(z)} = ${fmt(ans)}` } }
  }
  const ans = op === '×' ? round(a * b) : round(a / b)
  const hint =
    op === '×'
      ? `Ignore the decimal points: ${fmt(round(a * 10 ** dp(a)))} × ${fmt(round(b * 10 ** dp(b)))} = ${fmt(round(a * 10 ** dp(a) * b * 10 ** dp(b)))}, then shift ${dp(a) + dp(b)} place(s) → ${fmt(ans)}`
      : `Scale both by ${fmt(10 ** dp(b))} to clear the divisor: ${fmt(round(a * 10 ** dp(b)))} ÷ ${fmt(round(b * 10 ** dp(b)))} = ${fmt(ans)}`
  return { prompt: `${fmt(a)} ${op} ${fmt(b)}`, answer: ans, display: fmt(ans), hint }
}

/** Number of decimal places in x. */
function dp(x: number): number {
  const s = round(x, 8).toString()
  return s.includes('.') ? s.split('.')[1].length : 0
}

const percentOf: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  let p: number, base: number
  switch (level) {
    case 1: p = pick(rng, [10, 20, 25, 50, 75]); base = r(4, 99) * 20; break
    case 2: p = pick(rng, [5, 15, 30, 35, 45]); base = r(3, 60) * 20; break
    case 3: p = pick(rng, [12.5, 17.5, 22.5, 37.5, 62.5]); base = r(2, 30) * 40; break
    case 4: p = r(11, 89); base = r(2, 9) * 100; break
    case 5: p = r(11, 89); base = r(12, 99) * 10; break
    case 6: p = pick(rng, [0.5, 1.5, 2.5, 7.5, 0.25, 0.75]); base = r(12, 99) * 100; break
    case 7: {
      p = pick(rng, [0.2, 0.3, 0.4, 0.6, 1.2, 2.5, 3.5])
      base = r(12, 96) * 1e8
      const ans = round((p * base) / 100)
      return { prompt: `${fmt(p)}% of ${fmtBig(base)}`, note: 'k / m / bn accepted', answer: ans, display: fmtBig(ans), hint: `1% of ${fmtBig(base)} = ${fmtBig(base / 100)}; × ${fmt(p)} = ${fmtBig(ans)}` }
    }
    case 8: p = r(11, 99) / 10; base = r(12, 99) * 20; break
    case 9: {
      p = pick(rng, [5, 15, 12.5, 35, 45, 7.5, 2.5, 60, 85])
      const whole = r(4, 80) * 40
      const part = round((p * whole) / 100)
      return { prompt: `${fmt(part)} is ${fmt(p)}% of what?`, answer: whole, display: fmt(whole), hint: `whole = part ÷ rate = ${fmt(part)} ÷ ${fmt(p / 100)} = ${fmt(part)} × ${fmt(round(100 / p, 4))} = ${fmt(whole)}` }
    }
    default: {
      const d1 = pick(rng, [10, 15, 20, 25, 30])
      const d2 = pick(rng, [5, 10, 15, 20])
      base = r(6, 60) * 20
      const ans = round(base * (1 - d1 / 100) * (1 - d2 / 100))
      return { prompt: `${fmt(base)} after a ${d1}% discount, then a further ${d2}% off`, answer: ans, display: fmt(ans), hint: `Multiply the factors: ${fmt(base)} × ${fmt(1 - d1 / 100)} = ${fmt(round(base * (1 - d1 / 100)))}, × ${fmt(1 - d2 / 100)} = ${fmt(ans)} (not ${d1 + d2}% off!)` }
    }
  }
  const ans = round((p * base) / 100)
  return { prompt: `${fmt(p)}% of ${fmt(base)}`, answer: ans, display: fmt(ans), hint: percentHint(p, base) }
}

const pctChange: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  switch (level) {
    case 1: case 2: case 3: {
      const p = level === 1 ? pick(rng, [10, 20, 25, 50]) : level === 2 ? pick(rng, [5, 15, 30, 35, 40, 12.5]) : -pick(rng, [10, 15, 20, 25, 40])
      const from = r(4, 40) * (level === 2 ? 40 : 20)
      const to = round(from * (1 + p / 100))
      return { prompt: `% change from ${fmt(from)} to ${fmt(to)}`, note: 'use − for a fall', answer: p, display: `${fmt(p)}%`, hint: `(new − old) ÷ old = ${fmt(round(to - from))} ÷ ${fmt(from)} = ${fmt(p)}%` }
    }
    case 4: case 5: case 9: {
      const p = level === 4 ? pick(rng, [10, 20, 25, 50]) : level === 5 ? -pick(rng, [10, 20, 25, 40]) : pick(rng, [15, 35, 8, 12, -15, -35, 60])
      const orig = level === 9 ? r(6, 60) * 20 : r(4, 40) * 20
      const now = round(orig * (1 + p / 100))
      const verb = p > 0 ? `rising ${fmt(p)}%` : `falling ${fmt(-p)}%`
      return { prompt: `After ${verb} it is ${fmt(now)}. Original value?`, answer: orig, display: fmt(orig), hint: `original = now ÷ ${fmt(1 + p / 100)} = ${fmt(now)} ÷ ${fmt(1 + p / 100)} = ${fmt(orig)} (not ${fmt(now)} ${p > 0 ? '−' : '+'} ${fmt(Math.abs(p))}%)` }
    }
    case 6: {
      const from = r(120, 900)
      const to = from + r(-Math.floor(from * 0.4), Math.floor(from * 0.6))
      const ans = round(((to - from) / from) * 100, 1)
      return { prompt: `% change from ${fmt(from)} to ${fmt(to)}`, note: 'to 1 d.p., − for a fall', answer: ans, display: `${fmt(ans)}%`, tol: 0.051, hint: `${fmt(to - from)} ÷ ${fmt(from)}: 1% of ${fmt(from)} is ${fmt(from / 100)}, so ${fmt(to - from)} ÷ ${fmt(from / 100)} ≈ ${fmt(ans)}%` }
    }
    case 7: case 10: {
      const steps = level === 7 ? [pick(rng, [10, 20, 25, 50]), -pick(rng, [10, 20, 25])] : [pick(rng, [10, 15, 20]), -pick(rng, [5, 10, 20]), pick(rng, [5, 10, 25])]
      const factor = steps.reduce((f, s) => f * (1 + s / 100), 1)
      const ans = round((factor - 1) * 100, level === 7 ? 6 : 1)
      const desc = steps.map((s) => (s > 0 ? `+${s}%` : `−${-s}%`)).join(', then ')
      return { prompt: `Net % change of ${desc}`, note: level === 10 ? 'to 1 d.p.' : undefined, answer: ans, display: `${fmt(ans)}%`, tol: level === 10 ? 0.051 : 0, hint: `Multiply factors: ${steps.map((s) => fmt(1 + s / 100)).join(' × ')} = ${fmt(round(factor, 4))} → ${fmt(ans)}%` }
    }
    default: {
      const from = pick(rng, [8, 10, 12, 15, 20, 25])
      const to = from + pick(rng, [1, 2, 3, 4, 5, -2, -3, -5])
      const ans = round(((to - from) / from) * 100, 1)
      return { prompt: `Margin moves from ${from}% to ${to}%. Relative % change?`, note: 'to 1 d.p.; it is not the point change', answer: ans, display: `${fmt(ans)}%`, tol: 0.051, hint: `${to - from} percentage points on a base of ${from} = ${fmt(to - from)}/${from} = ${fmt(ans)}%` }
    }
  }
}

const ANCHORS = '1/7≈14.29%, 1/8=12.5%, 1/9≈11.1%, 1/11≈9.09%, 1/12≈8.33%, 1/16=6.25%'

const fractions: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  const coprime = (d: number) => { let n: number; do { n = r(1, d - 1) } while (gcd(n, d) !== 1); return n }
  const asPct = (n: number, d: number, dp1: boolean): Draft => {
    const ans = dp1 ? round((n / d) * 100, 1) : round((n / d) * 100)
    return { prompt: `${n}/${d} as a %`, note: dp1 ? 'to 1 d.p.' : undefined, answer: ans, display: `${fmt(ans)}%`, tol: dp1 ? 0.051 : 0, hint: `1/${d} = ${fmt(round(100 / d, 3))}%, × ${n} = ${fmt(ans)}%. Anchors: ${ANCHORS}` }
  }
  const asDec = (n: number, d: number): Draft => {
    const ans = round(n / d)
    return { prompt: `${n}/${d} as a decimal`, answer: ans, display: fmt(ans, 5), hint: `1/${d} = ${fmt(round(1 / d, 5), 5)}, × ${n} = ${fmt(ans, 5)}` }
  }
  switch (level) {
    case 1: { const d = pick(rng, [4, 5, 20, 25]); return asPct(coprime(d), d, false) }
    case 2: return asDec(coprime(8), 8)
    case 3: { const d = pick(rng, [3, 6]); return asPct(coprime(d), d, true) }
    case 4: { const d = pick(rng, [16, 40, 32]); return asDec(coprime(d), d) }
    case 5: return asPct(coprime(7), 7, true)
    case 6: { const d = pick(rng, [9, 11, 12, 15]); return asPct(coprime(d), d, true) }
    case 7: {
      const d = pick(rng, [8, 16])
      const n = coprime(d)
      return { prompt: `${fmt(round(n / d))} = ?/${d}`, answer: n, display: `${n}/${d}`, hint: `1/${d} = ${fmt(1 / d, 5)}; ${fmt(round(n / d))} ÷ ${fmt(1 / d, 5)} = ${n}` }
    }
    case 8: {
      const a = pick(rng, [7, 8, 9, 11, 12])
      let b = pick(rng, [5, 6, 7, 8, 9, 11, 12]); if (b === a) b = 4
      const ans = round((1 / a + 1 / b) * 100, 1)
      return { prompt: `1/${a} + 1/${b} as a %`, note: 'to 1 d.p.', answer: ans, display: `${fmt(ans)}%`, tol: 0.051, hint: `${fmt(round(100 / a, 2))}% + ${fmt(round(100 / b, 2))}% = ${fmt(ans)}%` }
    }
    case 9: {
      const d = pick(rng, [7, 8, 9, 12, 15, 16])
      const n = coprime(d)
      const base = d * r(6, 80)
      const ans = (base / d) * n
      return { prompt: `${n}/${d} of ${fmt(base)}`, answer: ans, display: fmt(ans), hint: `${fmt(base)} ÷ ${d} = ${fmt(base / d)}, × ${n} = ${fmt(ans)}` }
    }
    default: { const d = pick(rng, [13, 17, 19, 14, 18]); return asPct(coprime(d), d, true) }
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

const division: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  let a: number, b: number, exact = false
  switch (level) {
    case 1: b = r(3, 9); a = b * r(15, 110); exact = true; break
    case 2: b = r(3, 9); a = b * r(120, 999); exact = true; break
    case 3: b = r(3, 9); a = r(101, 999); break
    case 4: b = r(12, 39); a = b * r(12, 60); exact = true; break
    case 5: b = r(13, 39); a = r(200, 999); break
    case 6: b = r(13, 49); a = r(1000, 9999); break
    case 7: b = r(12, 29); a = round((b * r(15, 95)) / 10); exact = true; break
    case 8: b = r(61, 99); a = r(1000, 9999); break
    case 9: b = r(110, 450); a = r(10_000, 99_999); break
    default: b = r(51, 99); a = r(10_000, 99_999)
  }
  const ans = exact ? round(a / b) : round(a / b, 1)
  return { prompt: `${fmt(a)} ÷ ${fmt(b)}`, note: exact ? undefined : 'to 1 d.p.', answer: ans, display: fmt(ans), tol: exact ? 0 : 0.051, hint: divisionHint(a, b, ans) }
}

const bigNumbers: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  const mk = (x: number, y: number, op: '×' | '÷', fx = fmtBig, fy = fmtBig): Draft => {
    const ans = op === '×' ? round(x * y) : round(x / y)
    const [mx, ex] = split(x)
    const [my, ey] = split(y)
    const mant = op === '×' ? round(mx * my) : round(mx / my)
    const exp = op === '×' ? ex + ey : ex - ey
    return {
      prompt: `${fx(x)} ${op} ${fy(y)}`, note: 'k / m / bn accepted', answer: ans, display: fmtBig(ans), relTol: 0.001,
      hint: `Split numbers and powers: ${fmt(mx)} ${op} ${fmt(my)} = ${fmt(mant)}; 10^${ex} ${op} 10^${ey} = 10^${exp} → ${fmtBig(ans)}`,
    }
  }
  switch (level) {
    case 1: return mk(r(2, 9) * 1e6, r(3, 9), '×')
    case 2: return mk(r(12, 48) * 1e5, pick(rng, [20, 30, 40, 50, 60]), '×')
    case 3: { const y = r(2, 9) * 1e7; return mk(y * r(11, 40) * 10, y, '÷') }
    case 4: return mk(r(12, 48) * 1e5, r(12, 90) * 10, '×')
    case 5: { const y = pick(rng, [1.5, 2.5, 1.2, 4, 7.5]) * 1e3; return mk(y * r(12, 90) * 1e4, y, '÷') }
    case 6: return mk(r(12, 96) * 1e8, pick(rng, [0.35, 0.15, 0.45, 0.08, 0.12]), '×', fmtBig, fmt)
    case 7: return mk(r(12, 90) * 1e3 / 2, r(2, 24) * 1e3, '×')
    case 8: { const y = r(15, 90) / 10 * 1e6; return mk(round(y * r(4, 30) * 100), y, '÷') }
    case 9: {
      const emp = r(12, 90) * 1e3
      const per = r(15, 90) * 1e4
      const rev = emp * per
      return { prompt: `Revenue ${fmtBig(rev)}, ${fmtBig(emp)} employees. Revenue per employee?`, note: 'k / m / bn accepted', answer: per, display: fmtBig(per), relTol: 0.001, hint: `${fmtBig(rev)} ÷ ${fmtBig(emp)}: ${fmt(split(rev)[0])} ÷ ${fmt(split(emp)[0])} and fix the powers → ${fmtBig(per)}` }
    }
    default: {
      const base = (r(12, 96) * 1e8) / 4
      const rate = pick(rng, [0.04, 0.05, 0.06, 0.08, 0.12])
      const years = pick(rng, [1, 2, 3])
      const ans = round(base * rate * years)
      return { prompt: `Simple interest on ${fmtBig(base)} at ${fmt(rate * 100)}% a year for ${years} year${years > 1 ? 's' : ''}`, note: 'k / m / bn accepted', answer: ans, display: fmtBig(ans), relTol: 0.001, hint: `${fmtBig(base)} × ${fmt(rate)} = ${fmtBig(base * rate)} per year × ${years} = ${fmtBig(ans)}` }
    }
  }
}

/** 3_200_000 → [3.2, 6]. */
function split(x: number): [number, number] {
  if (x === 0) return [0, 0]
  const e = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
  return [round(x / 10 ** e), e]
}

const multiples: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  const B = fmtBig
  switch (level) {
    case 1: { const m = r(5, 12); const e = r(4, 30) * 1e7; return { prompt: `EBITDA ${B(e)} at ${m}x EV/EBITDA. EV?`, note: 'k / m / bn accepted', answer: m * e, display: B(m * e), relTol: 0.001, hint: `EV = multiple × EBITDA = ${m} × ${B(e)} = ${B(m * e)}` } }
    case 2: { const rev = r(2, 20) * 1e8; const mg = pick(rng, [5, 8, 10, 12, 15, 20, 25, 30]); const ebit = rev * mg / 100; return { prompt: `Revenue ${B(rev)}, EBIT ${B(ebit)}. EBIT margin?`, note: 'in %', answer: mg, display: `${mg}%`, hint: `margin = EBIT ÷ revenue = ${B(ebit)} ÷ ${B(rev)} = ${mg}%` } }
    case 3: { const sh = r(2, 20) * 1e7; const eps = r(4, 40) / 4; const ni = round(sh * eps); return { prompt: `Net income ${B(ni)}, ${B(sh)} shares. EPS?`, answer: eps, display: fmt(eps), hint: `EPS = net income ÷ shares = ${B(ni)} ÷ ${B(sh)} = ${fmt(eps)}` } }
    case 4: { const eps = r(4, 24) / 4; const pe = r(8, 30); const p = round(eps * pe); return { prompt: `Share price ${fmt(p)}, EPS ${fmt(eps)}. P/E?`, answer: pe, display: `${pe}x`, hint: `P/E = price ÷ EPS = ${fmt(p)} ÷ ${fmt(eps)} = ${pe}x` } }
    case 5: { const m = pick(rng, [6.5, 7.5, 8.5, 9.5, 10.5, 11.5]); const e = r(6, 40) * 1e7; const ev = round(m * e); return { prompt: `EBITDA ${B(e)} at ${fmt(m)}x. EV?`, note: 'k / m / bn accepted', answer: ev, display: B(ev), relTol: 0.001, hint: `${fmt(m)} × ${B(e)} = ${fmt(Math.floor(m))}×${B(e)} + ${fmt(m - Math.floor(m))}×${B(e)} = ${B(Math.floor(m) * e)} + ${B(round((m - Math.floor(m)) * e))} = ${B(ev)}` } }
    case 6: { const pe = r(8, 30); const eps = r(4, 24) / 4; const p = round(pe * eps); return { prompt: `Peers trade at ${pe}x P/E; EPS is ${fmt(eps)}. Implied share price?`, answer: p, display: fmt(p), hint: `price = P/E × EPS = ${pe} × ${fmt(eps)} = ${fmt(p)}` } }
    case 7: { const ev = r(10, 60) * 1e8; const nd = r(1, 9) * 1e8 * (rng() < 0.2 ? -1 : 1); const eq = ev - nd; return { prompt: `EV ${B(ev)}, net debt ${B(nd)}. Equity value?`, note: 'k / m / bn accepted', answer: eq, display: B(eq), relTol: 0.001, hint: `equity = EV − net debt = ${B(ev)} − ${B(nd)} = ${B(eq)}${nd < 0 ? ' (net cash adds)' : ''}` } }
    case 8: { const m = pick(rng, [6, 7, 8, 9, 10, 12, 6.5, 7.5, 8.5]); const e = r(6, 40) * 1e7; const ev = round(m * e); return { prompt: `EV ${B(ev)}, EBITDA ${B(e)}. EV/EBITDA?`, answer: m, display: `${fmt(m)}x`, hint: `${B(ev)} ÷ ${B(e)} = ${fmt(m)}x` } }
    case 9: { const sh = r(5, 40) * 1e7; const price = r(8, 80); const eq = sh * price; const nd = r(1, 9) * 1e8; const ev = eq + nd; return { prompt: `EV ${B(ev)}, net debt ${B(nd)}, ${B(sh)} shares. Implied share price?`, answer: price, display: fmt(price), hint: `equity = ${B(ev)} − ${B(nd)} = ${B(eq)}; ÷ ${B(sh)} shares = ${fmt(price)}` } }
    default: { const rev = r(4, 30) * 1e8; const mg = pick(rng, [12, 15, 18, 20, 22, 25]); const m = pick(rng, [6, 7.5, 8, 9, 10, 12]); const ev = round(rev * mg / 100 * m); return { prompt: `Revenue ${B(rev)}, EBITDA margin ${mg}%, ${fmt(m)}x EV/EBITDA. EV?`, note: 'k / m / bn accepted', answer: ev, display: B(ev), relTol: 0.001, hint: `EBITDA = ${mg}% × ${B(rev)} = ${B(rev * mg / 100)}; × ${fmt(m)} = ${B(ev)}` } }
  }
}

const growth: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  const compound = (base: number, rate: number, years: number, dp1: boolean): Draft => {
    const exact = base * (1 + rate / 100) ** years
    const ans = dp1 ? round(exact, 1) : round(exact)
    const steps: string[] = []
    let v = base
    for (let i = 0; i < Math.min(years, 3); i++) { v = v * (1 + rate / 100); steps.push(fmt(round(v, 2))) }
    return { prompt: `${fmt(base)} growing ${rate}% a year for ${years} years`, note: dp1 ? 'to 1 d.p.' : undefined, answer: ans, display: fmt(ans), tol: dp1 ? 0.051 : 0, hint: `Year by year: ${steps.join(' → ')}${years > 3 ? ' → …' : ''} = ${fmt(ans)}` }
  }
  switch (level) {
    case 1: return compound(r(1, 9) * 100, 10, 2, false)
    case 2: { const rate = pick(rng, [2, 3, 4, 6, 8, 9, 12, 18, 24]); const ans = 72 / rate; return { prompt: `Rule of 72: years to double at ${rate}% a year?`, answer: ans, display: fmt(ans), hint: `72 ÷ ${rate} = ${fmt(ans)} years` } }
    case 3: return compound(r(1, 9) * 100, 10, 3, true)
    case 4: { const n = pick(rng, [3, 4, 6, 8, 9, 12, 18]); const ans = 72 / n; return { prompt: `Rule of 72: annual rate to double in ${n} years?`, note: 'in %', answer: ans, display: `${fmt(ans)}%`, hint: `72 ÷ ${n} = ${fmt(ans)}%` } }
    case 5: return compound(r(2, 9) * 100, pick(rng, [5, 20]), 3, true)
    case 6: case 10: {
      const years = level === 6 ? pick(rng, [2, 3, 4]) : pick(rng, [4, 5, 6, 7])
      const start = r(2, 9) * 10
      const mult = pick(rng, [1.3, 1.5, 1.6, 1.8, 2, 2.5, 3])
      const end = round(start * mult)
      const exact = (mult ** (1 / years) - 1) * 100
      const ans = round(exact, 1)
      return { prompt: `CAGR from ${fmt(start)} to ${fmt(end)} over ${years} years?`, note: 'in %, ±0.5 pp', answer: ans, display: `${fmt(ans)}%`, tol: 0.5, hint: `${fmt(mult)}x in ${years}y. Rule of 72 gives a feel (2x in ${years}y ≈ ${fmt(round(72 / years, 1))}%); more precisely ln(${fmt(mult)}) ≈ ${fmt(round(Math.log(mult), 3))}, ÷ ${years} ≈ ${fmt(round(Math.log(mult) / years * 100, 1))}%, nudge up for compounding → ${fmt(ans)}%` }
    }
    case 7: { const nom = r(4, 12); const inf = r(1, Math.min(8, nom - 1)); const exact = ((1 + nom / 100) / (1 + inf / 100) - 1) * 100; const ans = round(exact, 2); return { prompt: `Nominal return ${nom}%, inflation ${inf}%. Real return?`, note: 'in %, ±0.15 pp', answer: ans, display: `${fmt(ans)}%`, tol: 0.15, hint: `≈ ${nom} − ${inf} = ${nom - inf}%; exactly 1.${String(nom).padStart(2, '0')}/1.${String(inf).padStart(2, '0')} − 1 = ${fmt(ans)}%` } }
    case 8: { const base = r(1, 9) * 1000; const rate = pick(rng, [6, 7, 8, 9]); const years = pick(rng, [5, 6]); const ans = round(base * (1 + rate / 100) ** years, 1); const simple = base * (1 + (rate * years) / 100); return { prompt: `${fmt(base)} at ${rate}% compound for ${years} years`, note: 'within 1%', answer: ans, display: fmt(ans), relTol: 0.01, hint: `Simple growth gives ${fmt(simple)}; compounding adds roughly another ${fmt(round(ans - simple, 0))} → ${fmt(ans)}` } }
    default: { const rate = pick(rng, [5, 10, 20]); const years = pick(rng, [1, 2]); const pv = r(2, 20) * 100; const fv = round(pv * (1 + rate / 100) ** years); return { prompt: `PV of ${fmt(fv)} received in ${years} year${years > 1 ? 's' : ''} at ${rate}%?`, answer: pv, display: fmt(pv), hint: `PV = ${fmt(fv)} ÷ ${fmt(1 + rate / 100)}${years > 1 ? `^${years} = ${fmt(fv)} ÷ ${fmt(round((1 + rate / 100) ** years, 4))}` : ''} = ${fmt(pv)}` } }
  }
}

const estimation: Gen = (level, rng) => {
  const r = (lo: number, hi: number) => randInt(rng, lo, hi)
  let prompt: string, ans: number, hint: string
  if (level <= 3) {
    const a = r(1200, 9800); const b = r(13, 89)
    ans = a * b; prompt = `${fmt(a)} × ${b}`
    hint = `Round: ${fmt(Math.round(a / 100) * 100)} × ${b} = ${fmt(Math.round(a / 100) * 100 * b)}; correct for the rounding → ${fmt(ans)}`
  } else if (level <= 6) {
    const a = r(1200, 9800); const b = r(105, 895) / 1000
    if (rng() < 0.5) { ans = a * b; prompt = `${fmt(a)} × ${fmt(b)}`; hint = `${fmt(b)} ≈ ${fmt(round(b, 2))}: ${fmt(a)} × ${fmt(round(b, 2))} ≈ ${fmt(round(a * round(b, 2)))}, exact ${fmt(round(ans, 1))}` }
    else { ans = a / b; prompt = `${fmt(a)} ÷ ${fmt(b)}`; hint = `Dividing by ${fmt(b)} ≈ multiplying by ${fmt(round(1 / b, 3))} → ${fmt(round(ans, 1))}` }
  } else {
    const a = r(1200, 9800); const b = r(12, 95) / 1000; const c = r(21, 97)
    ans = a * b * c; prompt = `${fmt(a)} × ${fmt(b)} × ${c}`
    hint = `Do ${fmt(a)} × ${fmt(b)} ≈ ${fmt(round(a * b, 1))} first, then × ${c} ≈ ${fmt(round(ans, 1))}`
  }
  return { prompt, note: 'estimate, within 2%', answer: round(ans, 4), display: fmt(round(ans, 1)), relTol: 0.02, hint }
}

const GENERATORS: Record<CategoryId, Gen> = { products, decimals, percentOf, pctChange, fractions, division, bigNumbers, multiples, growth, estimation }

export function generate(category: CategoryId, level: number, rng: Rng): Question {
  const l = clampLevel(level)
  const d = GENERATORS[category](l, rng)
  return { tol: 0, relTol: 0, ...d, category, level: l, targetMs: targetMsFor(category, l) }
}

export function isCorrect(q: Pick<Question, 'answer' | 'tol' | 'relTol'>, given: number | null): boolean {
  if (given === null || !Number.isFinite(given)) return false
  const tol = Math.max(q.tol, q.relTol * Math.abs(q.answer), 1e-9 * Math.max(1, Math.abs(q.answer)))
  return Math.abs(given - q.answer) <= tol
}
