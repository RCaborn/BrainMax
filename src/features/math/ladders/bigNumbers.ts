import type { Draft, Rung } from '../types'
import { fmt, fmtBig, round, tools } from './util'

/** Plain value and unit word: 3.2e6 → [3.2, 'm']. */
function unitOf(x: number): [number, string] {
  const a = Math.abs(x)
  if (a >= 1e9) return [round(x / 1e9), 'bn']
  if (a >= 1e6) return [round(x / 1e6), 'm']
  if (a >= 1e3) return [round(x / 1e3), 'k']
  return [x, '']
}

const STEP: Record<string, number> = { '': 0, k: 1, m: 2, bn: 3 }

const UNIT_NAMES = ['', 'k', 'm', 'bn', 'tn']

/**
 * "3.2m × 450: 3.2 × 450 = 1,440 → 1,440m = 1.44bn"
 * Division by a nearby unit goes to a common unit: "26,600m ÷ 70m = 380".
 */
function bigHint(x: number, y: number, op: '×' | '÷', ans: number): string {
  const [vx, ux] = unitOf(x)
  const [vy, uy] = unitOf(y)
  if (op === '×') {
    const core = round(vx * vy)
    const unit = UNIT_NAMES[STEP[ux] + STEP[uy]]
    const raw = `${fmt(core)}${unit}`
    return `Plain parts: ${fmt(vx)} × ${fmt(vy)} = ${fmt(core)}; units ${ux || 'none'} × ${uy || 'none'} → ${raw}${raw === fmtBig(ans) ? '' : ` = ${fmtBig(ans)}`}`
  }
  const diff = STEP[ux] - STEP[uy]
  if (diff <= 1) {
    const u = STEP[ux] < STEP[uy] ? ux : uy
    const sx = round(x / 1000 ** STEP[u])
    const sy = round(y / 1000 ** STEP[u])
    return `Same unit: ${fmt(sx)}${u} ÷ ${fmt(sy)}${u} = ${fmtBig(ans)}`
  }
  const core = round(vx / vy, 4)
  return `Plain parts: ${fmt(vx)} ÷ ${fmt(vy)} = ${fmt(core)}; ${ux} ÷ ${uy || 'units'} leaves ${UNIT_NAMES[diff]} → ${fmt(core)}${UNIT_NAMES[diff]} = ${fmtBig(ans)}`
}

const big = (x: number, y: number, op: '×' | '÷', opts: { rel?: number; plainY?: boolean } = {}): Draft => {
  const ans = op === '×' ? round(x * y) : round(x / y)
  const plainAnswer = Math.abs(ans) < 1e4
  return {
    prompt: `${fmtBig(x)} ${op} ${opts.plainY ? fmt(y) : fmtBig(y)}`,
    note: opts.rel ? 'within 0.5%; k / m / bn accepted' : plainAnswer ? undefined : 'k / m / bn accepted',
    answer: ans, display: plainAnswer ? fmt(ans) : fmtBig(ans), relTol: opts.rel ?? 0.001,
    hint: bigHint(x, y, op, ans),
  }
}

export const BIG_NUMBERS: Rung[] = [
  { key: 'units', title: 'Unit ladder: k, m, bn', targetS: 6, gen: (rng) => {
    const { r, pick } = tools(rng)
    const shape = pick(['bn2m', 'm2bn', 'k2m', 'm2k'])
    if (shape === 'bn2m') {
      const v = r(11, 99) / 10
      return { prompt: `How many millions is ${fmt(v)}bn?`, note: 'plain number', answer: v * 1000, display: fmt(v * 1000), hint: `1bn = 1,000m, so ${fmt(v)} × 1,000 = ${fmt(v * 1000)}` }
    }
    if (shape === 'm2bn') {
      const v = r(11, 99) * 100
      return { prompt: `Write ${fmt(v)}m in billions`, note: 'plain number', answer: v / 1000, display: fmt(v / 1000), hint: `÷ 1,000: ${fmt(v)}m = ${fmt(v / 1000)}bn` }
    }
    if (shape === 'k2m') {
      const v = r(5, 95) * 10
      return { prompt: `Write ${fmt(v)}k in millions`, note: 'plain number', answer: v / 1000, display: fmt(v / 1000), hint: `÷ 1,000: ${fmt(v)}k = ${fmt(v / 1000)}m` }
    }
    const v = pick([0.25, 0.4, 0.75, 1.5, 2.5])
    return { prompt: `How many thousands is ${fmt(v)}m?`, note: 'plain number', answer: v * 1000, display: fmt(v * 1000), hint: `1m = 1,000k, so ${fmt(v)} × 1,000 = ${fmt(v * 1000)}` }
  } },
  { key: 'crossRound', title: '× across a unit, round numbers', targetS: 7, gen: (rng) => {
    const { pick } = tools(rng)
    for (;;) {
      const x = pick([1.5, 2.5, 4, 6, 8, 12, 15, 25, 40, 60, 120, 150, 250]) * pick([1e3, 1e6])
      const y = pick([4, 5, 20, 40, 50, 200, 400, 500, 2000, 4000])
      const ans = x * y
      if (ans >= 1e4 && STEP[unitOf(ans)[1]] > STEP[unitOf(x)[1]]) return big(x, y, '×', { plainY: true })
    }
  } },
  { key: 'divFinance', title: '÷ across units: price, per head', targetS: 8, gen: (rng) => {
    const { pick } = tools(rng)
    const f = pick(['price', 'head', 'plain'])
    if (f === 'price') {
      const shares = pick([2, 3, 4, 5, 6, 8]) * 1e8
      const price = pick([5, 8, 12, 15, 20, 25, 30, 40, 50])
      return { prompt: `Market cap ${fmtBig(shares * price)}, ${fmtBig(shares)} shares. Share price?`, answer: price, display: fmt(price), hint: `${fmtBig(shares * price)} ÷ ${fmtBig(shares)}: ${fmt((shares * price) / 1e6)}m ÷ ${fmt(shares / 1e6)}m = ${price}` }
    }
    if (f === 'head') {
      const emp = pick([2, 4, 5, 8]) * pick([1e3, 1e4])
      const per = pick([2, 3, 4, 5, 6]) * 1e5
      return { prompt: `Revenue ${fmtBig(emp * per)}, ${fmt(emp)} employees. Revenue per employee?`, note: 'k / m / bn accepted', answer: per, display: fmtBig(per), relTol: 0.001, hint: bigHint(emp * per, emp, '÷', per) }
    }
    const d = pick([2, 3, 4, 5, 6, 8]) * pick([1e7, 1e8])
    const q = pick([20, 30, 40, 50, 200, 300, 500])
    return big(d * q, d, '÷')
  } },
  { key: 'mx1', title: 'Hundreds of millions × 1-digit', targetS: 8, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return big(rNot10(12, 95) * 1e7, r(3, 9), '×', { plainY: true })
  } },
  { key: 'mxtens', title: 'millions × 20–60', targetS: 8, gen: (rng) => {
    const { pick, rNot10 } = tools(rng)
    return big(rNot10(12, 48) * 1e5, pick([20, 30, 40, 50, 60]), '×', { plainY: true })
  } },
  { key: 'divOneFact', title: 'bn ÷ m (one fact)', targetS: 9, gen: (rng) => {
    const { r, pick } = tools(rng)
    const y = r(2, 9) * 1e7
    return big(y * r(2, 9) * pick([10, 100]), y, '÷')
  } },
  { key: 'divBnM', title: 'bn ÷ m', targetS: 14, gen: (rng) => {
    const { r } = tools(rng)
    const y = r(2, 9) * 1e7
    return big(y * r(11, 40) * 10, y, '÷')
  } },
  { key: 'mxhundreds', title: 'millions × hundreds', targetS: 10, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return big(rNot10(12, 48) * 1e5, r(2, 9) * 100, '×', { plainY: true })
  } },
  { key: 'mx3digit', title: 'millions × 3-digit', targetS: 20, gen: (rng) => {
    const { rNot10 } = tools(rng)
    return big(rNot10(12, 48) * 1e5, rNot10(12, 90) * 10, '×', { plainY: true, rel: 0.005 })
  } },
  { key: 'divK', title: '÷ thousands', targetS: 18, gen: (rng) => {
    const { r, pick } = tools(rng)
    const y = pick([1.5, 2.5, 1.2, 4, 7.5]) * 1e3
    return big(y * r(12, 90) * 1e4, y, '÷')
  } },
  { key: 'share', title: '× a decimal share', targetS: 15, gen: (rng) => {
    const { r, pick } = tools(rng)
    const x = r(12, 96) * 1e8
    const y = pick([0.35, 0.15, 0.45, 0.08, 0.12])
    const ans = round(x * y)
    return { prompt: `${fmtBig(x)} × ${fmt(y)}`, note: 'k / m / bn accepted', answer: ans, display: fmtBig(ans), relTol: 0.001, hint: `1% of ${fmtBig(x)} = ${fmtBig(x / 100)}; × ${fmt(y * 100)} = ${fmtBig(ans)}` }
  } },
  { key: 'interest', title: 'Simple interest', targetS: 15, gen: (rng) => {
    const { r, pick } = tools(rng)
    const base = (r(12, 96) * 1e8) / 4
    const rate = pick([4, 5, 6, 8, 12])
    const years = pick([1, 2, 3])
    const ans = round((base * rate * years) / 100)
    return { prompt: `Simple interest on ${fmtBig(base)} at ${rate}% a year for ${years} year${years > 1 ? 's' : ''}`, note: 'k / m / bn accepted', answer: ans, display: fmtBig(ans), relTol: 0.001, hint: `1% of ${fmtBig(base)} = ${fmtBig(base / 100)}; × ${rate} = ${fmtBig((base * rate) / 100)} a year; × ${years} = ${fmtBig(ans)}` }
  } },
  { key: 'kxthousands', title: 'k × thousands', targetS: 12, gen: (rng) => {
    const { r } = tools(rng)
    return big(r(12, 90) * 500, r(2, 9) * 1e3, '×')
  } },
  { key: 'kxk', title: 'k × k', targetS: 18, gen: (rng) => {
    const { r } = tools(rng)
    return big((r(12, 90) * 1e3) / 2, r(11, 24) * 1e3, '×', { rel: 0.005 })
  } },
  { key: 'perHeadFriendly', title: 'Revenue per employee (friendly)', targetS: 14, gen: (rng) => {
    const { r, pick } = tools(rng)
    const emp = pick([20, 25, 40, 50, 80]) * 1e3
    const per = r(15, 90) * 1e4
    return { prompt: `Revenue ${fmtBig(emp * per)}, ${fmtBig(emp)} employees. Revenue per employee?`, note: 'k / m / bn accepted', answer: per, display: fmtBig(per), relTol: 0.001, hint: bigHint(emp * per, emp, '÷', per) }
  } },
  { key: 'divBnM2', title: 'bn ÷ m (2-digit)', targetS: 20, gen: (rng) => {
    const { r } = tools(rng)
    const y = (r(15, 90) / 10) * 1e6
    return big(round(y * r(4, 30) * 100), y, '÷')
  } },
  { key: 'perHead', title: 'Revenue per employee', targetS: 25, gen: (rng) => {
    const { r } = tools(rng)
    const emp = r(12, 90) * 1e3
    const per = r(15, 90) * 1e4
    return { prompt: `Revenue ${fmtBig(emp * per)}, ${fmtBig(emp)} employees. Revenue per employee?`, note: 'within 0.5%; k / m / bn accepted', answer: per, display: fmtBig(per), relTol: 0.005, hint: bigHint(emp * per, emp, '÷', per) }
  } },
  { key: 'interestHard', title: 'Interest: odd rates and part-years', targetS: 25, gen: (rng) => {
    const { r, pick } = tools(rng)
    const base = r(4, 40) * 1e8
    const rate = pick([3.5, 4.5, 6.5, 7.5, 8.5])
    const years = pick([0.5, 1.5, 2.5, 3.5])
    const ans = round((base * rate * years) / 100)
    return { prompt: `Simple interest on ${fmtBig(base)} at ${fmt(rate)}% a year for ${fmt(years)} years`, note: 'within 0.5%; k / m / bn accepted', answer: ans, display: fmtBig(ans), relTol: 0.005, hint: `1% of ${fmtBig(base)} = ${fmtBig(base / 100)}; × ${fmt(rate)} = ${fmtBig((base * rate) / 100)} a year; × ${fmt(years)} = ${fmtBig(ans)}` }
  } },
]
