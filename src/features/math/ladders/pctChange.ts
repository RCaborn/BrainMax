import type { Draft, Rung } from '../types'
import type { Rng } from '../../../lib/rng'
import { fmt, fmtBig, gcd, pct, round, signed, tools } from './util'

/** Simplify to a fraction when one is easy (380/760 = 1/2), otherwise chunk in 10% and 1% steps. */
function changeHint(from: number, to: number, exact: number): string {
  const diff = round(to - from)
  const ad = Math.abs(diff)
  const isExact = round(exact, 6) === round(exact, 2)
  const eq = isExact ? '=' : '≈'
  const shown = pct(round(exact, isExact ? 2 : 1))
  const head = `(new − old) ÷ old = ${fmt(diff)} ÷ ${fmt(from)}`
  if (Number.isInteger(ad) && Number.isInteger(from) && ad > 0) {
    const g = gcd(ad, from)
    const n = ad / g
    const d = from / g
    if (d === 1) return `${head} = ${diff < 0 ? '−' : ''}${n} → ${shown}`
    if (d <= 40) return `${head} = ${diff < 0 ? '−' : ''}${n}/${d} ${eq} ${shown}`
  }
  const ten = from / 10
  const k = Math.floor(ad / ten)
  const rem = round(ad - k * ten)
  const rest = round(rem / (from / 100), 1)
  const tens = k > 0 ? `10% of ${fmt(from)} is ${fmt(ten)}, × ${k} = ${fmt(round(k * ten))}; the other ${fmt(rem)}` : `${fmt(ad)}`
  return `${head}: ${tens} ÷ ${fmt(from / 100)} (1%) ≈ ${fmt(rest)}% → ${shown}`
}

const change = (from: number, to: number, opts: { note?: string; tol?: number; dp?: number; displayDp?: number } = {}): Draft => {
  const exact = ((to - from) / from) * 100
  const ans = opts.dp === undefined ? round(exact) : round(exact, opts.dp)
  return {
    prompt: `% change from ${fmt(from)} to ${fmt(to)}`,
    note: opts.note ?? 'use − for a fall',
    answer: ans, display: pct(opts.displayDp === undefined ? ans : round(exact, opts.displayDp)), tol: opts.tol ?? 0,
    hint: changeHint(from, to, exact),
  }
}

const original = (orig: number, p: number): Draft => {
  const now = round(orig * (1 + p / 100))
  const f = round(1 + p / 100, 4)
  const verb = p > 0 ? `rising ${fmt(p)}%` : `falling ${fmt(-p)}%`
  return {
    prompt: `After ${verb} it is ${fmt(now)}. Original value?`, answer: orig, display: fmt(orig),
    hint: `Divide by the multiplier: ${fmt(now)} ÷ ${fmt(f)} = ${fmt(orig)} (not ${fmt(now)} ${p > 0 ? '−' : '+'} ${fmt(Math.abs(p))}%)`,
  }
}

const steps = (list: number[], dp?: number): Draft => {
  const factor = list.reduce((f, s) => f * (1 + s / 100), 1)
  const ans = dp === undefined ? round((factor - 1) * 100) : round((factor - 1) * 100, dp)
  return {
    prompt: `Net % change of ${list.map(signed).join(', then ')}`,
    note: dp === undefined ? 'exact, − for a fall' : 'to 1 d.p., − for a fall',
    answer: ans, display: pct(ans), tol: dp === undefined ? 0 : 0.051,
    hint: `Multiply the factors: ${list.map((s) => fmt(1 + s / 100)).join(' × ')} = ${fmt(round(factor, 4))} → ${pct(ans)}`,
  }
}

/** Distinct random steps from a list (keeps variety up). */
function drawSteps(rng: Rng, pool: number[], n: number): number[] {
  const { pick } = tools(rng)
  const out: number[] = []
  while (out.length < n) {
    const s = pick(pool)
    if (!out.includes(s) || pool.length < n) out.push(s)
  }
  return out
}

export const PCT_CHANGE: Rung[] = [
  { key: 'multipliers', title: 'Multipliers: up 15% = ×1.15', targetS: 5, gen: (rng) => {
    const { pick, coin } = tools(rng)
    const p = pick([5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75])
    const sign = coin() ? 1 : -1
    const m = round(1 + (sign * p) / 100)
    if (coin()) {
      return { prompt: `${sign > 0 ? 'Up' : 'Down'} ${p}%: multiply by?`, answer: m, display: fmt(m), hint: `Up p% = ×(1 + p/100); down p% = ×(1 − p/100) → ×${fmt(m)}` }
    }
    return { prompt: `×${fmt(m)} is what % change?`, note: 'use − for a fall', answer: sign * p, display: pct(sign * p), hint: `${fmt(m)} − 1 = ${fmt(round(m - 1))} → ${pct(sign * p)}` }
  } },
  { key: 'apply', title: 'Apply a change', targetS: 6, gen: (rng) => {
    const { r, pick, coin } = tools(rng)
    const p = pick([10, 20, 25, 50]) * (coin() ? 1 : -1)
    const base = r(2, 30) * 20
    const ans = round(base * (1 + p / 100))
    return { prompt: `${fmt(base)} ${p > 0 ? 'up' : 'down'} ${Math.abs(p)}%. New value?`, answer: ans, display: fmt(ans), hint: `${Math.abs(p)}% of ${fmt(base)} = ${fmt(round((Math.abs(p) * base) / 100))}, so ${fmt(base)} ${p > 0 ? '+' : '−'} that = ${fmt(ans)}` }
  } },
  { key: 'finance', title: 'Round-number finance growth', targetS: 7, gen: (rng) => {
    const { r, pick } = tools(rng)
    const p = pick([10, 20, 25, 50, 100])
    const from = r(2, 20) * 20
    const to = from * (1 + p / 100)
    const T = pick(['revenue', 'ebitda', 'price', 'costs'])
    const m = (v: number) => (T === 'price' ? fmt(v) : fmtBig(v * 1e6))
    const prompt =
      T === 'revenue' ? `Revenue went from ${m(from)} to ${m(to)}. Growth?`
        : T === 'ebitda' ? `EBITDA moved from ${m(from)} to ${m(to)}. % change?`
          : T === 'price' ? `Share price moved from ${m(from)} to ${m(to)}. Return?`
            : `Costs went from ${m(from)} to ${m(to)}. % change?`
    return { prompt, note: 'in %', answer: p, display: pct(p), hint: changeHint(from, to, p) }
  } },
  { key: 'falls', title: '% change: falls', targetS: 9, gen: (rng) => {
    const { r, pick } = tools(rng)
    const from = r(4, 40) * 20
    return change(from, round(from * (1 - pick([10, 15, 20, 25, 40]) / 100)))
  } },
  { key: 'applyOdd', title: 'Apply a non-anchor change', targetS: 9, gen: (rng) => {
    const { r, pick } = tools(rng)
    const p = pick([5, 15, 30, 35, 40, -15, -35])
    const base = r(4, 40) * 20
    const ans = round(base * (1 + p / 100))
    return { prompt: `${fmt(base)} ${p > 0 ? 'up' : 'down'} ${Math.abs(p)}%. New value?`, answer: ans, display: fmt(ans), hint: `× ${fmt(1 + p / 100)}: ${fmt(base)} × ${fmt(1 + p / 100)} = ${fmt(ans)}` }
  } },
  { key: 'oddRise', title: '% change: 5–40% and 12.5% rises', targetS: 10, gen: (rng) => {
    const { r, pick } = tools(rng)
    const from = r(4, 40) * 40
    return change(from, round(from * (1 + pick([5, 15, 30, 35, 40, 12.5]) / 100)), { note: 'in %' })
  } },
  { key: 'origRise', title: 'Original value after a rise', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    return original(r(4, 40) * 20, pick([10, 20, 25, 50]))
  } },
  { key: 'origFall', title: 'Original value after a fall', targetS: 13, gen: (rng) => {
    const { r, pick } = tools(rng)
    return original(r(4, 40) * 20, -pick([10, 20, 25, 40]))
  } },
  { key: 'twoAnchor', title: 'Two anchor steps', targetS: 12, gen: (rng) => {
    const { pick } = tools(rng)
    return steps([pick([10, 20, 25, 50]), -pick([10, 20, 25])])
  } },
  { key: 'margin', title: 'Percentage points vs per cent', targetS: 12, gen: (rng) => {
    const { pick, rWhere } = tools(rng)
    const from = pick([8, 10, 12, 15, 20, 25])
    const to = from + rWhere(-5, 5, (d) => d !== 0 && from + d > 0)
    const ans = round(((to - from) / from) * 100, 1)
    return {
      prompt: `Margin moves from ${from}% to ${to}%. Relative % change?`, note: 'to 1 d.p.; not the point change', answer: ans, display: pct(ans), tol: 0.051,
      hint: `${fmt(to - from)} point${Math.abs(to - from) === 1 ? '' : 's'} on a base of ${from}: ${fmt(to - from)} ÷ ${from} = ${pct(round(((to - from) / from) * 100, 2))}`,
    }
  } },
  { key: 'wholeAnswer', title: '% change with a whole-number answer', targetS: 14, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const from = r(4, 40) * 25
    const p = 4 * rWhere(-10, 19, (k) => k !== 0)
    return change(from, from * (1 + p / 100))
  } },
  { key: 'origOdd', title: 'Original after 5/15/30/40/60% moves', targetS: 15, gen: (rng) => {
    const { r, pick } = tools(rng)
    return original(r(4, 40) * 20, pick([5, 15, 30, 40, 60, -5, -15, -30, -40]))
  } },
  { key: 'origHard', title: 'Original after 8/12/15/35/60% moves', targetS: 20, gen: (rng) => {
    const { r, pick } = tools(rng)
    return original(r(3, 30) * 100, pick([8, 12, 15, 35, -15, -35, 60]))
  } },
  { key: 'twoOdd', title: 'Two odd steps (1 d.p.)', targetS: 16, gen: (rng) => steps(drawSteps(rng, [5, 8, 12, 15, -5, -8, -15], 2), 1) },
  { key: 'nearestWhole', title: '% change to the nearest whole %', targetS: 16, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const from = r(12, 99) * 10
    const to = from + rWhere(Math.ceil(-0.4 * from), Math.floor(0.6 * from), (d) => Math.abs(d) >= from * 0.02)
    // Unrounded answer with ±0.5, so only the true nearest whole number counts.
    return change(from, to, { note: 'nearest whole %, − for a fall', tol: 0.5, displayDp: 0 })
  } },
  { key: 'oneDp', title: '% change to 1 d.p.', targetS: 25, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const from = r(120, 900)
    const to = from + rWhere(Math.ceil(-0.4 * from), Math.floor(0.6 * from), (d) => Math.abs(d) >= from * 0.02)
    return change(from, to, { note: 'to 1 d.p. (±0.2), − for a fall', tol: 0.2, dp: 1 })
  } },
  { key: 'threeSteps', title: 'Three steps (1 d.p.)', targetS: 22, gen: (rng) => {
    const { pick } = tools(rng)
    return steps([pick([5, 8, 10, 12, 15, 20]), -pick([5, 8, 10, 15, 20]), pick([4, 5, 6, 10, 25])], 1)
  } },
]
