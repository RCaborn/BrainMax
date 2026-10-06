import type { Draft, Rung } from '../types'
import { divisionHint } from '../hints'
import { fmt, round, tools } from './util'

type Mode = 'exact' | '1dp' | 'rel'

const div = (a: number, b: number, mode: Mode = 'exact'): Draft => {
  const exact = a / b
  const ans = mode === 'exact' ? round(exact) : mode === '1dp' ? round(exact, 1) : round(exact, 2)
  return {
    prompt: `${fmt(a)} ÷ ${fmt(b)}`,
    note: mode === '1dp' ? 'to 1 d.p.' : mode === 'rel' ? 'within 0.5%' : undefined,
    answer: ans, display: fmt(mode === 'rel' ? round(exact, 1) : ans),
    tol: mode === '1dp' ? 0.051 : 0, relTol: mode === 'rel' ? 0.005 : 0,
    hint: divisionHint(a, b, mode === 'exact' ? ans : round(exact, 1)),
  }
}

const FRIENDLY_HINT: Record<number, string> = {
  4: 'halve twice', 5: '×2 then ÷10', 20: '÷10 then halve', 25: '×4 then ÷100', 50: '×2 then ÷100',
  12: '÷3 then ÷4', 15: '÷3 then ÷5', 16: 'halve four times', 24: '÷3 then ÷8', 32: 'halve five times', 45: '÷5 then ÷9',
}

const friendly = (a: number, b: number): Draft => ({ ...div(a, b), hint: `÷${b} = ${FRIENDLY_HINT[b]}: ${fmt(a)} → ${fmt(a / b)}` })

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
    const { r, rNot10 } = tools(rng)
    const b = r(3, 9)
    return div(b * rNot10(15, 110), b)
  } },
  { key: '4by1', title: '4-digit ÷ 1-digit', targetS: 11, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    const b = r(3, 9)
    return div(b * rNot10(120, 999), b)
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
  { key: '2digitExact', title: '2-digit divisors, exact', targetS: 15, gen: (rng) => {
    const { r } = tools(rng)
    const b = r(12, 39)
    return div(b * r(12, 60), b)
  } },
  { key: 'decimalBy2', title: 'Decimal ÷ 2-digit', targetS: 12, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    const b = r(12, 29)
    return div(round((b * rNot10(15, 95)) / 10), b)
  } },
  { key: '3by2', title: '3-digit ÷ 2-digit (1 d.p.)', targetS: 16, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const b = r(13, 39)
    return div(rWhere(200, 999, (n) => n % b !== 0), b, '1dp')
  } },
  { key: '4by2exact', title: '4-digit ÷ 2-digit, exact', targetS: 15, gen: (rng) => {
    const { r } = tools(rng)
    const b = r(12, 39)
    return div(b * r(101, 250), b)
  } },
  { key: '4by2', title: '4-digit ÷ 2-digit', targetS: 22, gen: (rng) => {
    const { r } = tools(rng)
    return div(r(1000, 9999), r(13, 49), 'rel')
  } },
  { key: '4by2big', title: '4-digit ÷ 61–99', targetS: 22, gen: (rng) => {
    const { r } = tools(rng)
    return div(r(1000, 9999), r(61, 99), 'rel')
  } },
  { key: '5by2', title: '5-digit ÷ 51–99', targetS: 30, gen: (rng) => {
    const { r } = tools(rng)
    return div(r(10_000, 99_999), r(51, 99), 'rel')
  } },
  { key: '5byFriendly3', title: '5-digit ÷ friendly 3-digit', targetS: 20, gen: (rng) => {
    const { r, pick } = tools(rng)
    return div(r(10_000, 99_999), pick([120, 125, 150, 160, 175, 225, 240, 250, 360, 375]), 'rel')
  } },
  { key: '5by3', title: '5-digit ÷ 3-digit', targetS: 35, gen: (rng) => {
    const { r } = tools(rng)
    return div(r(10_000, 99_999), r(110, 450), 'rel')
  } },
]
