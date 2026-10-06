import type { Draft, Rung } from '../types'
import { percentHint, percentHintBig } from '../hints'
import { fmt, fmtBig, round, tools } from './util'

const pctOf = (p: number, base: number): Draft => {
  const ans = round((p * base) / 100)
  return { prompt: `${fmt(p)}% of ${fmt(base)}`, answer: ans, display: fmt(ans), hint: percentHint(p, base) }
}

const NEAR_ROUND = [19, 21, 29, 31, 39, 41, 49, 51, 59, 61, 69, 71, 79, 81]
const REVERSE_FRACTIONS: Record<string, [number, number]> = {
  '5': [1, 20], '10': [1, 10], '20': [1, 5], '25': [1, 4], '50': [1, 2], '15': [3, 20], '12.5': [1, 8],
  '35': [7, 20], '45': [9, 20], '7.5': [3, 40], '2.5': [1, 40], '60': [3, 5], '85': [17, 20],
}

const reverse = (p: number, whole: number): Draft => {
  const part = round((p * whole) / 100)
  const [n, d] = REVERSE_FRACTIONS[String(p)]
  const hint = n === 1
    ? `${fmt(p)}% = 1/${d}, so the whole is ${fmt(part)} × ${d} = ${fmt(whole)}`
    : `${fmt(p)}% = ${n}/${d}: ${fmt(part)} ÷ ${n} = ${fmt(round(part / n))} is 1/${d}, × ${d} = ${fmt(whole)}`
  return { prompt: `${fmt(part)} is ${fmt(p)}% of what?`, answer: whole, display: fmt(whole), hint }
}

export const PERCENT_OF: Rung[] = [
  { key: 'anchors', title: 'Anchors: 10%, 50%, 25%, 1%', targetS: 5, gen: (rng) => {
    const { r, pick } = tools(rng)
    const p = pick([10, 50, 25, 1])
    const base = p === 1 ? r(12, 99) * 100 : p === 25 ? r(2, 25) * 20 : r(12, 99) * 10
    return pctOf(p, base)
  } },
  { key: 'build', title: 'Build from 10% and 5%', targetS: 6, gen: (rng) => {
    const { r, pick } = tools(rng)
    return pctOf(pick([20, 30, 40, 5, 75]), r(2, 30) * 20)
  } },
  { key: 'finance', title: 'Round-number finance', targetS: 8, gen: (rng) => {
    const { r, pick } = tools(rng)
    const p = pick([5, 10, 15, 20, 25, 30, 40, 50])
    const base = r(2, 30) * 20 * 1e6
    const ans = (p * base) / 100
    const B = fmtBig(base)
    const prompt = pick([
      `Revenue ${B} at a ${p}% EBITDA margin. EBITDA?`,
      `${p}% stake in a business valued at ${B}. Stake value?`,
      `${p}% fee on a ${B} deal?`,
      `${p}% tax on profit of ${B}?`,
      `Payout ratio ${p}%, net income ${B}. Dividends?`,
    ])
    return { prompt, note: 'k / m / bn accepted', answer: ans, display: fmtBig(ans), relTol: 0.001, hint: percentHintBig(p, base) }
  } },
  { key: 'easyRates', title: '10/20/25/50/75% of round numbers', targetS: 6, gen: (rng) => {
    const { r, pick } = tools(rng)
    return pctOf(pick([10, 20, 25, 50, 75]), r(4, 99) * 20)
  } },
  { key: 'ofHundreds', title: 'Any % of hundreds', targetS: 8, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return pctOf(rNot10(11, 89), r(2, 9) * 100)
  } },
  { key: 'fives', title: '5, 15, 30, 35, 45%', targetS: 9, gen: (rng) => {
    const { r, pick } = tools(rng)
    return pctOf(pick([5, 15, 30, 35, 45]), r(3, 60) * 20)
  } },
  { key: 'eighths', title: 'Eighths: 12.5%, 37.5% …', targetS: 9, gen: (rng) => {
    const { r, pick } = tools(rng)
    return pctOf(pick([12.5, 37.5, 62.5, 87.5]), r(2, 30) * 40)
  } },
  { key: 'twoPointFive', title: 'Build in 2.5% steps', targetS: 11, gen: (rng) => {
    const { r, pick } = tools(rng)
    return pctOf(pick([17.5, 22.5, 27.5, 32.5]), r(2, 30) * 40)
  } },
  { key: 'small', title: 'Small rates (0.25%–7.5%)', targetS: 10, gen: (rng) => {
    const { r, pick } = tools(rng)
    return pctOf(pick([0.5, 1.5, 2.5, 7.5, 0.25, 0.75]), r(12, 99) * 100)
  } },
  { key: 'smallBig', title: 'Small rates of billions', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const p = pick([0.2, 0.3, 0.4, 0.6, 1.2, 2.5, 3.5])
    const base = r(12, 96) * 1e8
    const ans = round((p * base) / 100)
    return { prompt: `${fmt(p)}% of ${fmtBig(base)}`, note: 'give units, e.g. 51.6m', answer: ans, display: fmtBig(ans), relTol: 0.001, hint: percentHintBig(p, base) }
  } },
  { key: 'reverseAnchors', title: 'Reverse: x is 25% of what?', targetS: 9, gen: (rng) => {
    const { r, pick } = tools(rng)
    return reverse(pick([5, 10, 20, 25, 50]), r(4, 60) * 20)
  } },
  { key: 'reverse', title: 'Reverse with any rate', targetS: 14, gen: (rng) => {
    const { r, pick } = tools(rng)
    return reverse(pick([5, 15, 12.5, 35, 45, 7.5, 2.5, 60, 85]), r(4, 80) * 40)
  } },
  { key: 'nearRound', title: 'Near-round rates (29% = 30% − 1%)', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    return pctOf(pick(NEAR_ROUND), r(12, 99) * 10)
  } },
  { key: 'fivesAny', title: 'Multiples of 5% of any base', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    return pctOf(pick([15, 35, 45, 55, 65, 85]), r(12, 99) * 10)
  } },
  { key: 'any', title: 'Any % of any base', targetS: 15, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    return pctOf(rWhere(11, 89, (n) => n % 5 !== 0), r(12, 99) * 10)
  } },
  { key: 'stacked', title: 'Stacked discounts', targetS: 18, gen: (rng) => {
    const { r, pick } = tools(rng)
    const d1 = pick([10, 15, 20, 25, 30])
    const d2 = pick([5, 10, 15, 20])
    const base = r(6, 60) * 20
    const ans = round(base * (1 - d1 / 100) * (1 - d2 / 100))
    return {
      prompt: `${fmt(base)} after a ${d1}% discount, then a further ${d2}% off`, note: 'exact', answer: ans, display: fmt(ans),
      hint: `Multiply the factors: ${fmt(base)} × ${fmt(1 - d1 / 100)} = ${fmt(round(base * (1 - d1 / 100)))}, × ${fmt(1 - d2 / 100)} = ${fmt(ans)} (not ${d1 + d2}% off)`,
    }
  } },
  { key: '1dpHundreds', title: '1-d.p. rates of hundreds', targetS: 10, gen: (rng) => {
    const { r, dec1 } = tools(rng)
    return pctOf(dec1(11, 99), r(2, 9) * 100)
  } },
  { key: '1dpAny', title: '1-d.p. rates of any base', targetS: 18, gen: (rng) => {
    const { r, dec1 } = tools(rng)
    return { ...pctOf(dec1(11, 99), r(12, 99) * 20), note: 'within 0.5%', relTol: 0.005 }
  } },
]
