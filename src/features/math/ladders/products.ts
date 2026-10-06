import type { Draft, Rung } from '../types'
import { productHint } from '../hints'
import { fmt, tools } from './util'

const prod = (a: number, b: number): Draft => ({
  prompt: a === b ? `${a}²` : `${fmt(a)} × ${fmt(b)}`,
  answer: a * b,
  display: fmt(a * b),
  hint: productHint(a, b),
})

const NEAR_ROUND = [19, 21, 29, 31, 39, 41, 49, 51, 59, 61, 69, 71, 79, 81]

export const PRODUCTS: Rung[] = [
  { key: 'zeros', title: 'Round numbers and zeros', targetS: 5, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = pick([12, 15, 25, 35, 45]) * pick([1, 10])
    const b = r(2, 9) * (a >= 100 ? 10 : pick([10, 100]))
    return prod(a, b)
  } },
  { key: 'x3to5', title: '2-digit × 3–5', targetS: 5, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return prod(rNot10(13, 59), r(3, 5))
  } },
  { key: 'friendly', title: 'Friendly multipliers (×5, ×11, ×25, ×50)', targetS: 6, gen: (rng) => {
    const { r, pick, rNot10 } = tools(rng)
    const b = pick([5, 11, 25, 50])
    return prod(b === 25 ? 4 * r(4, 24) : rNot10(13, 98), b)
  } },
  { key: '2x1', title: '2-digit × 6–9', targetS: 6, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return prod(rNot10(23, 99), r(6, 9))
  } },
  { key: '3x3to5', title: '3-digit × 3–5', targetS: 7, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return prod(rNot10(120, 499), r(3, 5))
  } },
  { key: '3x1', title: '3-digit × 1-digit', targetS: 9, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return prod(rNot10(120, 999), r(3, 9))
  } },
  { key: 'sq39', title: 'Squares up to 39', targetS: 9, gen: (rng) => {
    const a = tools(rng).rNot10(13, 39)
    return prod(a, a)
  } },
  { key: 'teens', title: '2-digit × teens', targetS: 10, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return prod(rNot10(23, 99), r(11, 19))
  } },
  { key: 'nearRound', title: 'Near-round multipliers (×39 = ×40 − 1)', targetS: 10, gen: (rng) => {
    const { pick, rNot10 } = tools(rng)
    return prod(rNot10(21, 79), pick(NEAR_ROUND))
  } },
  { key: 'near100easy', title: 'Near 100 (one factor 95–99)', targetS: 9, gen: (rng) => {
    const { r, rWhere, coin } = tools(rng)
    const a = r(95, 99)
    const b = rWhere(86, 99, (n) => n !== a)
    return coin() ? prod(a, b) : prod(b, a)
  } },
  { key: 'near100', title: 'Near 100 (both 86–99)', targetS: 11, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const a = r(86, 99)
    return prod(a, rWhere(86, 99, (n) => n !== a))
  } },
  { key: 'sq99', title: 'Squares 41–99', targetS: 13, gen: (rng) => {
    const a = tools(rng).rNot10(41, 99)
    return prod(a, a)
  } },
  { key: '2x2small', title: '2-digit × 2-digit (smaller)', targetS: 12, gen: (rng) => {
    const { rNot10, rWhere } = tools(rng)
    return prod(rNot10(23, 59), rWhere(21, 39, (n) => ![0, 1, 9].includes(n % 10)))
  } },
  { key: '2x2', title: '2-digit × 2-digit', targetS: 18, gen: (rng) => {
    const { rNot10, rWhere } = tools(rng)
    const a = rNot10(41, 99)
    return prod(a, rWhere(41, 99, (n) => n % 10 !== 0 && n !== a))
  } },
  { key: '3xteens', title: '3-digit × teens or 25', targetS: 14, gen: (rng) => {
    const { pick, rNot10 } = tools(rng)
    return prod(rNot10(110, 499), pick([11, 12, 13, 14, 15, 16, 17, 18, 19, 25]))
  } },
  { key: '3x2', title: '3-digit × 2-digit', targetS: 22, gen: (rng) => {
    const { rNot10 } = tools(rng)
    return prod(rNot10(110, 499), rNot10(12, 49))
  } },
  { key: '3xnearRound', title: '3-digit × near-round 2-digit', targetS: 15, gen: (rng) => {
    const { pick, rNot10 } = tools(rng)
    return prod(rNot10(310, 999), pick([...NEAR_ROUND, 89, 91, 99]))
  } },
  { key: '3x2big', title: '3-digit × 2-digit (large)', targetS: 30, gen: (rng) => {
    const { rNot10 } = tools(rng)
    return prod(rNot10(310, 999), rNot10(23, 99))
  } },
]
