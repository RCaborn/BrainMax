import type { Draft, Rung } from '../types'
import { cagrHint } from '../hints'
import { fmt, pct, round, tools } from './util'

const compound = (base: number, rate: number, years: number, opts: { dp?: number; relTol?: number; note?: string } = {}): Draft => {
  const exact = base * (1 + rate / 100) ** years
  const ans = opts.dp === undefined ? round(exact) : round(exact, opts.dp)
  const path: string[] = []
  let v = base
  for (let i = 0; i < Math.min(years, 3); i++) {
    v *= 1 + rate / 100
    path.push(fmt(round(v, 3)))
  }
  const f = round((1 + rate / 100) ** years, 4)
  // Binomial terms: 1 + nr + C(n,2)r² + C(n,3)r³ (the cubic term keeps 6 years at 9% inside 0.1%).
  const r = rate / 100
  const t = [years * r, ((years * (years - 1)) / 2) * r ** 2, ((years * (years - 1) * (years - 2)) / 6) * r ** 3].map((x) => round(x, 4))
  const approx = round(1 + t[0] + t[1] + t[2], 4)
  return {
    prompt: `${fmt(base)} growing ${rate}% a year. Value after ${years} years?`,
    note: opts.note ?? (opts.dp === 1 ? 'to 1 d.p.' : undefined),
    answer: ans, display: fmt(ans), tol: opts.dp === 1 ? 0.051 : 0, relTol: opts.relTol ?? 0,
    hint: years <= 3
      ? `Chain the factor ×${fmt(1 + rate / 100)}: ${fmt(base)} → ${path.join(' → ')}${years === 2 ? ` (or ×${fmt(f)} in one go)` : ''}`
      : `Factor ≈ 1 + nr + n(n−1)/2·r² + n(n−1)(n−2)/6·r³ = 1 + ${t.map((x) => fmt(x)).join(' + ')} = ${fmt(approx)} (exact ${fmt(f)}); × ${fmt(base)} ≈ ${fmt(round(base * approx, 1))}`,
  }
}

const cagr = (start: number, mult: number, years: number, tol = 0.5): Draft => {
  const end = round(start * mult, 2)
  const exact = (mult ** (1 / years) - 1) * 100
  const ans = round(exact, 1)
  return {
    prompt: `CAGR from ${fmt(start)} to ${fmt(end)} over ${years} years?`, note: `in %, ±${fmt(tol)} pp`,
    answer: ans, display: pct(ans), tol, hint: cagrHint(mult, years, exact),
  }
}

/** Multiples that keep CAGRs realistic for the horizon. */
const multsFor = (years: number) => (years <= 2 ? [1.21, 1.3, 1.44, 1.5, 1.6, 1.8] : years <= 4 ? [1.3, 1.5, 1.6, 1.8, 2, 2.5] : [1.5, 1.6, 1.8, 2, 2.5, 3])

export const GROWTH: Rung[] = [
  { key: 'r72', title: 'Rule of 72 (both ways)', targetS: 5, gen: (rng) => {
    const { pick, coin } = tools(rng)
    if (coin()) {
      const rate = pick([2, 3, 4, 6, 8, 9, 12, 18, 24])
      return { prompt: `Rule of 72: years to double at ${rate}% a year?`, answer: 72 / rate, display: fmt(72 / rate), hint: `Years ≈ 72 ÷ rate = 72 ÷ ${rate} = ${fmt(72 / rate)}` }
    }
    const n = pick([3, 4, 6, 8, 9, 12, 18])
    return { prompt: `Rule of 72: annual rate to double in ${n} years?`, note: 'in %', answer: 72 / n, display: pct(72 / n), hint: `Rate ≈ 72 ÷ years = 72 ÷ ${n} = ${pct(72 / n)}` }
  } },
  { key: 'oneYear', title: 'One year of growth', targetS: 7, gen: (rng) => {
    const { r, pick, coin } = tools(rng)
    if (coin()) {
      const base = r(2, 20) * 100
      const rate = pick([5, 10, 15, 20, 25, 50])
      const ans = round(base * (1 + rate / 100))
      return { prompt: `Revenue ${fmt(base)} grows ${rate}%. Next year?`, answer: ans, display: fmt(ans), hint: `×${fmt(1 + rate / 100)}: ${fmt(base)} + ${rate}% (${fmt(round((base * rate) / 100))}) = ${fmt(ans)}` }
    }
    const start = r(2, 10) * 100
    const rate = pick([10, 20, 25, 50])
    const end = start * (1 + rate / 100)
    return { prompt: `Revenue goes from ${fmt(start)} to ${fmt(end)}. Growth rate?`, note: 'in %', answer: rate, display: pct(rate), hint: `(${fmt(end)} − ${fmt(start)}) ÷ ${fmt(start)} = ${pct(rate)}` }
  } },
  { key: 'twoFriendly', title: 'Two years, friendly factors', targetS: 9, gen: (rng) => {
    const { r, pick, coin } = tools(rng)
    const d = coin(0.7) ? compound(r(1, 9) * 100, pick([20, 50]), 2) : compound(pick([400, 800, 1200, 1600]), 25, 2)
    return { ...d, hint: `${d.hint}. Square the factor (1.2² = 1.44, 1.25² = 1.5625, 1.5² = 2.25): not 2 × the rate` }
  } },
  { key: 'discount1', title: 'One-year discounting', targetS: 9, gen: (rng) => {
    const { r, pick } = tools(rng)
    const rate = pick([10, 20, 25, 50])
    const pv = r(2, 20) * 100
    const fv = round(pv * (1 + rate / 100))
    return { prompt: `PV of ${fmt(fv)} received in 1 year at ${rate}%?`, answer: pv, display: fmt(pv), hint: `Divide by ${fmt(1 + rate / 100)}${rate === 25 ? ' (same as × 0.8)' : rate === 50 ? ' (same as × 2/3)' : ''}: ${fmt(fv)} ÷ ${fmt(1 + rate / 100)} = ${fmt(pv)}` }
  } },
  { key: 'ten2', title: '10% for 2 years', targetS: 10, gen: (rng) => compound(tools(rng).r(1, 9) * 100, 10, 2) },
  { key: 'ten3', title: '10% for 3 years', targetS: 14, gen: (rng) => compound(tools(rng).r(1, 9) * 100, 10, 3, { dp: 1 }) },
  { key: 'two5to20', title: '2 years at 5%, 15% or 20%', targetS: 18, gen: (rng) => {
    const { r, pick } = tools(rng)
    return compound(r(2, 9) * 100, pick([5, 15, 20]), 2, { note: 'exact' })
  } },
  { key: 'pv', title: 'PV over 1–2 years', targetS: 18, gen: (rng) => {
    const { r, pick } = tools(rng)
    const rate = pick([5, 10, 20])
    const years = pick([1, 2])
    const pv = r(2, 20) * 100
    const fv = round(pv * (1 + rate / 100) ** years)
    const f = round((1 + rate / 100) ** years, 4)
    const g = fmt(1 + rate / 100)
    const hint = years === 1
      ? `PV = ${fmt(fv)} ÷ ${g} = ${fmt(pv)}`
      : `Divide by ${g} twice: ${fmt(fv)} ÷ ${g} = ${fmt(round(fv / (1 + rate / 100), 4))}; ÷ ${g} = ${fmt(pv)} (check: ${fmt(pv)} × ${fmt(f)} = ${fmt(fv)})`
    return { prompt: `PV of ${fmt(fv)} received in ${years} year${years > 1 ? 's' : ''} at ${rate}%?`, answer: pv, display: fmt(pv), hint }
  } },
  { key: 'cagrPerfect', title: 'CAGR from perfect powers', targetS: 15, gen: (rng) => {
    const { r, pick, coin } = tools(rng)
    const years = coin(0.7) ? 2 : 3
    const rate = years === 2 ? pick([5, 10, 20, 25, 50]) : pick([10, 20])
    const mult = round((1 + rate / 100) ** years, 6)
    const g = fmt(1 + rate / 100)
    const d = cagr(r(2, 9) * 100, mult, years)
    return { ...d, hint: `End ÷ start = ${fmt(mult)}, which is ${g}${years === 2 ? '²' : '³'} (${[g, g, g].slice(0, years).join(' × ')} = ${fmt(mult)}), so CAGR = ${rate}%` }
  } },
  { key: 'cagr72', title: 'CAGR with the rule of 72', targetS: 15, gen: (rng) => {
    const { r, pick, coin } = tools(rng)
    const mult = coin() ? 2 : 4
    const years = mult === 2 ? pick([6, 8, 9, 10, 12]) : pick([12, 16, 18, 20, 24])
    const d = cagr(r(2, 9) * 10, mult, years)
    return { ...d, hint: `${mult === 4 ? `4x is two doublings, so one doubling takes ${years / 2} years. ` : ''}Rule of 72: 72 ÷ ${mult === 4 ? years / 2 : years} ≈ ${fmt(round(72 / (mult === 4 ? years / 2 : years), 1))}% (exact ${d.display})` }
  } },
  { key: 'real', title: 'Real return (exact)', targetS: 20, gen: (rng) => {
    const { r } = tools(rng)
    // nominal − inflation ≥ 3 and inflation ≥ 2 keep plain subtraction at least 0.059 pp off, outside ±0.05.
    const nom = r(5, 12)
    const inf = r(2, Math.min(8, nom - 3))
    const exact = ((1 + nom / 100) / (1 + inf / 100) - 1) * 100
    const ans = round(exact, 2)
    return { prompt: `Nominal return ${nom}%, inflation ${inf}%. Real return?`, note: 'exact (Fisher), in %, ±0.05', answer: round(exact, 6), display: pct(ans), tol: 0.05, hint: `(1 + nominal) ÷ (1 + inflation) − 1 = (nominal − inflation) ÷ (1 + inflation) = ${nom - inf} ÷ ${fmt(1 + inf / 100)} = ${pct(ans)} (plain ${nom} − ${inf} overstates it)` }
  } },
  { key: 'cagr2', title: 'CAGR over 2 years', targetS: 20, gen: (rng) => {
    const { r, pick } = tools(rng)
    return cagr(r(2, 9) * 10, pick(multsFor(2)), 2)
  } },
  { key: 'three', title: '3 years at 5% or 20%', targetS: 25, gen: (rng) => {
    const { r, pick } = tools(rng)
    return compound(r(2, 9) * 100, pick([5, 20]), 3, { dp: 1, relTol: 0.002, note: 'within 0.2%' })
  } },
  { key: 'longCompound', title: 'Compounding 5–6 years (within 1%)', targetS: 25, gen: (rng) => {
    const { r, pick } = tools(rng)
    return compound(r(1, 9) * 1000, pick([6, 7, 8, 9]), pick([5, 6]), { dp: 1, relTol: 0.01, note: 'within 1%' })
  } },
  { key: 'cagr34', title: 'CAGR over 3–4 years', targetS: 30, gen: (rng) => {
    const { r, pick } = tools(rng)
    const years = pick([3, 4])
    return cagr(r(2, 9) * 10, pick(multsFor(years)), years)
  } },
  { key: 'cagrLong', title: 'CAGR over 4–7 years', targetS: 35, gen: (rng) => {
    const { r, pick } = tools(rng)
    const years = pick([4, 5, 6, 7])
    return cagr(r(2, 9) * 10, pick(multsFor(years)), years)
  } },
]
