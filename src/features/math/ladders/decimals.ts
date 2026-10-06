import type { Draft, Rung } from '../types'
import { decimalProductHint } from '../hints'
import { dp, fmt, round, tools } from './util'

const mul = (a: number, b: number, hint?: string): Draft => {
  const ans = round(a * b)
  return { prompt: `${fmt(a)} × ${fmt(b)}`, answer: ans, display: fmt(ans), hint: hint ?? decimalProductHint(a, b, dp) }
}

const div = (a: number, b: number): Draft => {
  const ans = round(a / b)
  const scale = 10 ** dp(b)
  const friendly: Record<string, string> = { '0.5': '×2', '0.25': '×4', '0.2': '×5', '0.1': '×10', '0.05': '×20' }
  const hint = friendly[String(b)]
    ? `÷${fmt(b)} = ${friendly[String(b)]}: ${fmt(a)} ${friendly[String(b)]} = ${fmt(ans)}`
    : `Scale both by ${fmt(scale)} so the divisor is whole: ${fmt(round(a * scale))} ÷ ${fmt(round(b * scale))} = ${fmt(ans)}`
  return { prompt: `${fmt(a)} ÷ ${fmt(b)}`, answer: ans, display: fmt(ans), hint }
}

/** "0.375 = 3/8: 64 ÷ 8 = 8, × 3 = 24" */
function fractionHint(a: number, b: number): string {
  const FR: Record<string, [number, number]> = {
    '0.5': [1, 2], '0.25': [1, 4], '0.75': [3, 4], '0.125': [1, 8], '0.375': [3, 8], '0.625': [5, 8], '0.875': [7, 8],
    '1.25': [5, 4], '1.75': [7, 4], '2.25': [9, 4], '2.75': [11, 4], '3.75': [15, 4],
  }
  const [n, d] = FR[String(a)]
  const part = round(b / d)
  return `${fmt(a)} = ${n}/${d}: ${fmt(b)} ÷ ${d} = ${fmt(part)}${n > 1 ? `, × ${n} = ${fmt(round(part * n))}` : ''}`
}

export const DECIMALS: Rung[] = [
  { key: 'point', title: 'Where does the point go?', targetS: 5, gen: (rng) => {
    const { r, pick, coin } = tools(rng)
    const a = pick([0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.12, 0.15, 0.25])
    const b = coin(0.8) ? r(2, 9) * pick([10, 100]) : pick([0.2, 0.3, 0.4, 0.5, 0.6])
    return mul(a, b)
  } },
  { key: 'dxsmall', title: 'Decimal × small whole number', targetS: 5, gen: (rng) => {
    const { r, dec1 } = tools(rng)
    return mul(dec1(11, 49), r(2, 6))
  } },
  { key: 'divFriendly', title: 'Divide by 0.5, 0.25, 0.2, 0.1', targetS: 5, gen: (rng) => {
    const { r, pick } = tools(rng)
    const b = pick([0.5, 0.25, 0.2, 0.1])
    return div(round(r(6, 60) * b), b)
  } },
  { key: 'quarters', title: 'Halves and quarters of numbers', targetS: 6, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = pick([0.5, 0.25, 0.75])
    const b = r(3, 40) * 4
    return mul(a, b, fractionHint(a, b))
  } },
  { key: '1dpx1', title: '1-d.p. × 1-digit', targetS: 6, gen: (rng) => {
    const { r, dec1 } = tools(rng)
    return mul(dec1(11, 99), r(3, 9))
  } },
  { key: '2dpxtens', title: '2-d.p. × 20, 30, 40, 50', targetS: 7, gen: (rng) => {
    const { pick, rNot10 } = tools(rng)
    return mul(rNot10(11, 95) / 100, pick([20, 30, 40, 50]))
  } },
  { key: '2dpxeven', title: '2-d.p. × 40–180', targetS: 10, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return mul(rNot10(11, 95) / 100, 20 * r(2, 9))
  } },
  { key: '1dpxfriendly', title: '1-d.p. × friendly decimal', targetS: 10, gen: (rng) => {
    const { pick, dec1 } = tools(rng)
    return mul(dec1(11, 49), pick([1.5, 2.5, 3.5, 4.5, 0.4, 0.6, 0.8]))
  } },
  { key: 'divEasy', title: 'Divide by 0.5, 0.2, 0.4, 0.3, 0.05', targetS: 8, gen: (rng) => {
    const { r, pick } = tools(rng)
    const b = pick([0.5, 0.2, 0.4, 0.3, 0.05])
    return div(round(r(12, 60) * b), b)
  } },
  { key: 'divSmall', title: 'Divide by small decimals', targetS: 10, gen: (rng) => {
    const { r, pick } = tools(rng)
    const b = pick([0.02, 0.04, 0.05, 0.06, 0.08, 0.3, 0.4, 0.6])
    return div(round(r(3, 60) * 5 * b), b)
  } },
  { key: 'eighths', title: 'Eighths (0.125, 0.375 …) of numbers', targetS: 10, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = pick([0.125, 0.375, 0.625, 0.875])
    const b = 8 * r(3, 40)
    return mul(a, b, fractionHint(a, b))
  } },
  { key: 'quarterSteps', title: '1.25, 2.75, 3.75 … as quarters', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = pick([1.25, 2.25, 3.75, 1.75, 2.75])
    const b = round(0.4 * r(12, 99), 1)
    return mul(a, b, fractionHint(a, b))
  } },
  { key: '1dpx1dpEasy', title: '1-d.p. × 1.1–2.9 or ×.5', targetS: 12, gen: (rng) => {
    const { pick, dec1, coin } = tools(rng)
    return mul(dec1(12, 99), coin() ? dec1(11, 29) : pick([1.5, 2.5, 3.5, 4.5, 5.5]))
  } },
  { key: '1dpx1dp', title: '1-d.p. × 1-d.p.', targetS: 16, gen: (rng) => {
    const { dec1 } = tools(rng)
    return { ...mul(dec1(12, 99), dec1(12, 99)), note: 'exact' }
  } },
  { key: 'div2dpFriendly', title: 'Divide by friendly 2-d.p. decimals', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const b = pick([0.12, 0.15, 0.16, 0.24, 0.25, 0.35, 0.45, 0.75])
    return div(round(10 * r(12, 95) * b), b)
  } },
  { key: 'div2dp', title: 'Divide by any 2-d.p. decimal', targetS: 18, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    const b = rNot10(11, 99) / 100
    return div(round(10 * r(12, 95) * b), b)
  } },
  { key: 'three', title: 'Three factors (friendly middle)', targetS: 12, gen: (rng) => {
    const { r, pick, dec1 } = tools(rng)
    const x = dec1(11, 49)
    const y = pick([0.25, 0.4, 2.5, 0.8])
    const z = r(3, 9)
    const ans = round(x * y * z)
    return { prompt: `${fmt(x)} × ${fmt(y)} × ${z}`, answer: ans, display: fmt(ans), hint: `Pair the friendly factor first: ${fmt(y)} × ${z} = ${fmt(round(y * z))}, then × ${fmt(x)} = ${fmt(ans)}` }
  } },
  { key: 'threeHard', title: 'Three decimal factors', targetS: 25, gen: (rng) => {
    const { pick, dec1 } = tools(rng)
    const x = dec1(11, 49)
    const y = pick([0.4, 2.5, 0.25, 1.25, 0.8])
    const z = dec1(12, 60)
    const ans = round(x * y * z, 2)
    return { prompt: `${fmt(x)} × ${fmt(y)} × ${fmt(z)}`, note: 'to 2 d.p.', answer: ans, display: fmt(ans), tol: 0.0051, hint: `Pair the friendly factor first: ${fmt(y)} × ${fmt(x)} = ${fmt(round(x * y))}, then × ${fmt(z)} = ${fmt(round(x * y * z, 4))} → ${fmt(ans)}` }
  } },
]
