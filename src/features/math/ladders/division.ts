import type { Draft, Rung } from '../types'
import { divisionHint } from '../hints'
import { fmt, round, tools } from './util'

type Mode = 'exact' | '1dp' | 'rel'

/**
 * "Round the divisor, then adjust": 64,952 ÷ 397 → ÷ 400 = 162.4; 397 is 0.75% under 400, so nudge up → 163.6.
 * Only offered when the rounding is within 4% (the first-order nudge is then good to ~0.2%); otherwise chunk.
 */
function relHint(a: number, b: number): string {
  const shown = round(a / b, 1)
  const R = b >= 100 ? Math.round(b / 100) * 100 : Math.round(b / 10) * 10
  const dev = (R - b) / R
  if (R === b || Math.abs(dev) > 0.04) return divisionHint(a, b, shown)
  const q1 = a / R
  const nudged = round(q1 * (1 + dev), 1)
  const pctDev = fmt(round(Math.abs(dev) * 100, 1))
  return `Round the divisor: ${fmt(a)} ÷ ${fmt(R)} ≈ ${fmt(round(q1, 1))}. ${fmt(b)} is ${pctDev}% ${b < R ? 'below' : 'above'} ${fmt(R)}, so the answer is ~${pctDev}% ${b < R ? 'bigger' : 'smaller'} → ≈ ${fmt(nudged)} (exact ${fmt(shown)})`
}

const div = (a: number, b: number, mode: Mode = 'exact'): Draft => {
  const exact = a / b
  const ans = mode === 'exact' ? round(exact) : mode === '1dp' ? round(exact, 1) : round(exact, 2)
  return {
    prompt: `${fmt(a)} ÷ ${fmt(b)}`,
    note: mode === '1dp' ? 'to 1 d.p.' : mode === 'rel' ? 'within 0.5%' : undefined,
    answer: ans, display: fmt(mode === 'rel' ? round(exact, 1) : ans),
    tol: mode === '1dp' ? 0.051 : 0, relTol: mode === 'rel' ? 0.005 : 0,
    hint: mode === 'rel' ? relHint(a, b) : divisionHint(a, b, mode === 'exact' ? ans : round(exact, 1)),
  }
}

type Op = ['×' | '÷', number]
/** Friendly divisors as a chain of easy steps; "halve" chains are shown as a run of halvings. */
const FRIENDLY: Record<number, { say: string; ops: Op[] }> = {
  4: { say: 'halve twice', ops: [['÷', 2], ['÷', 2]] },
  5: { say: '×2 then ÷10', ops: [['×', 2], ['÷', 10]] },
  20: { say: '÷10 then halve', ops: [['÷', 10], ['÷', 2]] },
  25: { say: '×4 then ÷100', ops: [['×', 4], ['÷', 100]] },
  50: { say: '×2 then ÷100', ops: [['×', 2], ['÷', 100]] },
  12: { say: '÷3 then ÷4', ops: [['÷', 3], ['÷', 4]] },
  15: { say: '÷3 then ÷5', ops: [['÷', 3], ['÷', 5]] },
  16: { say: 'halve four times', ops: [['÷', 2], ['÷', 2], ['÷', 2], ['÷', 2]] },
  24: { say: '÷3 then ÷8', ops: [['÷', 3], ['÷', 8]] },
  32: { say: 'halve five times', ops: [['÷', 2], ['÷', 2], ['÷', 2], ['÷', 2], ['÷', 2]] },
  45: { say: '÷5 then ÷9', ops: [['÷', 5], ['÷', 9]] },
  // Friendly 3-digit divisors.
  120: { say: '÷12 then ÷10', ops: [['÷', 3], ['÷', 4], ['÷', 10]] },
  125: { say: '×8 then ÷1,000', ops: [['×', 8], ['÷', 1000]] },
  150: { say: '÷3, ×2, ÷100', ops: [['÷', 3], ['×', 2], ['÷', 100]] },
  160: { say: 'halve four times, ÷10', ops: [['÷', 2], ['÷', 2], ['÷', 2], ['÷', 2], ['÷', 10]] },
  175: { say: '×4, ÷7, ÷100', ops: [['×', 4], ['÷', 7], ['÷', 100]] },
  225: { say: '×4, ÷9, ÷100', ops: [['×', 4], ['÷', 9], ['÷', 100]] },
  240: { say: '÷3, ÷8, ÷10', ops: [['÷', 3], ['÷', 8], ['÷', 10]] },
  250: { say: '×4 then ÷1,000', ops: [['×', 4], ['÷', 1000]] },
  360: { say: '÷4, ÷9, ÷10', ops: [['÷', 4], ['÷', 9], ['÷', 10]] },
  375: { say: '×8, ÷3, ÷1,000', ops: [['×', 8], ['÷', 3], ['÷', 1000]] },
}

function friendlyHint(a: number, b: number, dp = 4): string {
  const f = FRIENDLY[b]
  let v = a
  const parts: string[] = []
  f.ops.forEach(([op, k], i) => {
    v = op === '×' ? v * k : v / k
    const exact = round(v, 6) === round(v, 2)
    const val = `${exact ? '' : '≈ '}${fmt(round(v, i === f.ops.length - 1 ? dp : 2))}`
    const rhs = val.startsWith('≈') ? val : `= ${val}`
    parts.push(i === 0 ? `${fmt(a)} ${op} ${fmt(k)} ${rhs}` : `${op} ${fmt(k)} ${rhs}`)
  })
  return `÷${fmt(b)} = ${f.say}: ${parts.join('; ')}`
}

const friendly = (a: number, b: number): Draft => ({ ...div(a, b), hint: friendlyHint(a, b) })

export const DIVISION: Rung[] = [
  { key: 'friendly', title: 'Friendly divisors (4, 5, 20, 25, 50)', targetS: 6, gen: (rng) => {
    const { r, pick } = tools(rng)
    const b = pick([4, 5, 20, 25, 50])
    return friendly(b * (b <= 5 ? r(12, 99) : r(12, 60)), b)
  } },
  { key: '1digit2', title: '1-digit divisor, 2-digit answer', targetS: 7, gen: (rng) => {
    const { pick, rNot10 } = tools(rng)
    const b = pick([3, 4, 6, 7, 8, 9])
    return div(b * rNot10(12, 39), b)
  } },
  { key: 'remainder', title: 'Remainder → exact decimal', targetS: 7, gen: (rng) => {
    const { pick, rWhere } = tools(rng)
    const b = pick([4, 5, 8, 20, 25])
    const a = b <= 8 ? rWhere(11, 99, (n) => n % b !== 0) : rWhere(21, 199, (n) => n % b !== 0)
    const q = Math.floor(a / b)
    const rem = a - q * b
    return { ...div(a, b), note: 'exact decimal', hint: `${a} ÷ ${b} = ${q} remainder ${rem}; ${rem}/${b} = ${fmt(round(rem / b))} → ${fmt(round(a / b))}` }
  } },
  { key: '3by1', title: '3-digit ÷ 1-digit', targetS: 8, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const b = r(3, 9)
    return div(b * rWhere(15, 333, (q) => q % 10 !== 0 && b * q >= 100 && b * q <= 999), b)
  } },
  { key: '4by1', title: '4-digit ÷ 1-digit', targetS: 11, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const b = r(3, 9)
    return div(b * rWhere(Math.ceil(1000 / b), 999, (q) => q % 10 !== 0 && b * q <= 9999), b)
  } },
  { key: 'notExact1', title: '1-digit divisor, not exact (1 d.p.)', targetS: 10, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const b = r(3, 9)
    return div(rWhere(101, 999, (n) => n % b !== 0), b, '1dp')
  } },
  { key: 'friendly2', title: 'Friendly 2-digit divisors', targetS: 10, gen: (rng) => {
    const { r, pick } = tools(rng)
    const b = pick([12, 15, 16, 24, 25, 32, 45])
    return friendly(b * r(12, 80), b)
  } },
  { key: 'decimalBy2', title: 'Decimal ÷ 2-digit', targetS: 15, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const b = r(12, 29)
    const k = rWhere(15, 95, (n) => n % 10 !== 0 && (b * n) % 10 !== 0)
    const a = round((b * k) / 10)
    return { ...div(a, b), hint: `×10 to make it whole: ${fmt(b * k)} ÷ ${b}. ${divisionHint(b * k, b, k)}; ÷ 10 → ${fmt(round(k / 10))}` }
  } },
  { key: '2digitExact', title: '2-digit divisors, exact', targetS: 15, gen: (rng) => {
    const { rNot10 } = tools(rng)
    const b = rNot10(12, 39)
    return div(b * rNot10(12, 60), b)
  } },
  { key: '3by2', title: '3-digit ÷ 2-digit (1 d.p.)', targetS: 16, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const b = r(13, 39)
    return div(rWhere(200, 999, (n) => n % b !== 0), b, '1dp')
  } },
  { key: '4by2exact', title: '4-digit ÷ 2-digit, exact', targetS: 20, gen: (rng) => {
    const { rNot10, rWhere } = tools(rng)
    const b = rNot10(12, 39)
    return div(b * rWhere(101, 250, (q) => q % 10 !== 0 && b * q >= 1000), b)
  } },
  { key: '4by2', title: '4-digit ÷ 2-digit', targetS: 22, gen: (rng) => {
    const { r } = tools(rng)
    return div(r(1000, 9999), r(13, 49), 'rel')
  } },
  { key: '4by2big', title: '4-digit ÷ 61–99', targetS: 22, gen: (rng) => {
    const { r } = tools(rng)
    return div(r(1000, 9999), r(61, 99), 'rel')
  } },
  { key: '5byFriendly3', title: '5-digit ÷ friendly 3-digit', targetS: 22, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = r(10_000, 99_999)
    const b = pick([120, 125, 150, 160, 175, 225, 240, 250, 360, 375])
    return { ...div(a, b, 'rel'), hint: friendlyHint(a, b, 1) }
  } },
  { key: '5by2', title: '5-digit ÷ 51–99', targetS: 30, gen: (rng) => {
    const { r } = tools(rng)
    return div(r(10_000, 99_999), r(51, 99), 'rel')
  } },
  { key: '5by3', title: '5-digit ÷ 3-digit', targetS: 35, gen: (rng) => {
    const { r } = tools(rng)
    return div(r(10_000, 99_999), r(110, 450), 'rel')
  } },
]
