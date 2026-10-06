import type { Draft, Rung } from '../types'
import { decimalProductHint, divisionHint } from '../hints'
import { dp, fmt, round, tools } from './util'

const mul = (a: number, b: number, hint?: string): Draft => {
  const ans = round(a * b)
  return { prompt: `${fmt(a)} × ${fmt(b)}`, answer: ans, display: fmt(ans), hint: hint ?? decimalProductHint(a, b, dp) }
}

const div = (a: number, b: number): Draft => {
  const ans = round(a / b)
  const scale = 10 ** dp(b)
  const friendly: Record<string, string> = { '0.5': '×2', '0.25': '×4', '0.2': '×5', '0.1': '×10', '0.05': '×20' }
  const A = round(a * scale)
  const B = round(b * scale)
  const steps = Number.isInteger(A) && B >= 10 && ans >= 10 ? `; ${divisionHint(A, B, ans)}` : ''
  const hint = friendly[String(b)]
    ? `÷${fmt(b)} = ${friendly[String(b)]}: ${fmt(a)} ${friendly[String(b)]} = ${fmt(ans)}`
    : `Scale both by ${fmt(scale)} so the divisor is whole: ${fmt(A)} ÷ ${fmt(B)} = ${fmt(ans)}${steps}`
  return { prompt: `${fmt(a)} ÷ ${fmt(b)}`, answer: ans, display: fmt(ans), hint }
}

/** ×1.5, ×2.5, ×3.5, ×4.5, ×5.5, ×0.4/0.6/0.8 the friendly way. */
function friendlyDecHint(a: number, b: number): string | undefined {
  const ans = fmt(round(a * b))
  const half = fmt(round(a / 2))
  switch (b) {
    case 1.5: return `×1.5 = itself + half: ${fmt(a)} + ${half} = ${ans}`
    case 2.5: return `×2.5 = ×10 ÷ 4: ${fmt(round(a * 10))} ÷ 4 = ${ans}`
    case 3.5: return `×3.5 = ×3 + half: ${fmt(round(a * 3))} + ${half} = ${ans}`
    case 4.5: return `×4.5 = ×5 − half: ${fmt(round(a * 5))} − ${half} = ${ans}`
    case 5.5: return `×5.5 = ×5 + half: ${fmt(round(a * 5))} + ${half} = ${ans}`
    case 0.4: case 0.6: case 0.8: return `×${fmt(b)} = ×${b * 10} then ÷ 10: ${fmt(a)} × ${b * 10} = ${fmt(round(a * b * 10))} → ${ans}`
    default: return undefined
  }
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
  { key: 'quarters', title: 'Halves and quarters of numbers', targetS: 6, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = pick([0.5, 0.25, 0.75])
    const b = r(3, 40) * 4
    return mul(a, b, fractionHint(a, b))
  } },
  { key: 'divFriendly', title: 'Divide by 0.5, 0.25, 0.2, 0.1', targetS: 6, gen: (rng) => {
    const { r, pick } = tools(rng)
    const b = pick([0.5, 0.25, 0.2, 0.1])
    return div(round(r(6, 60) * b), b)
  } },
  { key: '1dpx1', title: '1-d.p. × 1-digit', targetS: 6, gen: (rng) => {
    const { r, dec1 } = tools(rng)
    return mul(dec1(11, 99), r(3, 9))
  } },
  { key: '2dpxtens', title: '2-d.p. × 20, 30, 40, 50', targetS: 7, gen: (rng) => {
    const { pick, rNot10 } = tools(rng)
    return mul(rNot10(11, 95) / 100, pick([20, 30, 40, 50]))
  } },
  { key: 'divEasy', title: 'Divide by 0.5, 0.2, 0.4, 0.3, 0.05', targetS: 8, gen: (rng) => {
    const { r, pick } = tools(rng)
    const b = pick([0.5, 0.2, 0.4, 0.3, 0.05])
    return div(round(r(12, 60) * b), b)
  } },
  { key: '2dpxeven', title: '2-d.p. × 40–180', targetS: 10, gen: (rng) => {
    const { rWhere, rNot10 } = tools(rng)
    return mul(rNot10(11, 95) / 100, 20 * rWhere(2, 9, (k) => k !== 5))
  } },
  { key: '1dpxfriendly', title: '1-d.p. × friendly decimal', targetS: 10, gen: (rng) => {
    const { pick, dec1 } = tools(rng)
    const a = dec1(11, 49)
    const f = pick([1.5, 2.5, 3.5, 4.5, 0.4, 0.6, 0.8])
    return mul(a, f, friendlyDecHint(a, f))
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
  { key: 'three', title: 'Three factors (friendly pair)', targetS: 10, gen: (rng) => {
    const { pick, dec1 } = tools(rng)
    const x = dec1(11, 49)
    const [y, z] = pick([[0.25, 4], [0.25, 8], [2.5, 4], [2.5, 6], [2.5, 8], [0.4, 5], [0.8, 5], [0.4, 7.5]] as const)
    const yz = round(y * z)
    const ans = round(x * yz)
    return { prompt: `${fmt(x)} × ${fmt(y)} × ${fmt(z)}`, answer: ans, display: fmt(ans), hint: `Pair the friendly factors first: ${fmt(y)} × ${fmt(z)} = ${fmt(yz)}, then ${fmt(x)} × ${fmt(yz)} = ${fmt(ans)}` }
  } },
  { key: 'quarterSteps', title: '1.25, 2.75, 3.75 … as quarters', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = pick([1.25, 2.25, 3.75, 1.75, 2.75])
    const b = round(0.4 * r(12, 99), 1)
    return mul(a, b, fractionHint(a, b))
  } },
  { key: '1dpx1dpEasy', title: '1-d.p. × 1.1–2.9 or ×.5', targetS: 12, gen: (rng) => {
    const { pick, dec1, coin } = tools(rng)
    const a = dec1(12, 99)
    const f = coin() ? dec1(11, 29) : pick([1.5, 2.5, 3.5, 4.5, 5.5])
    return mul(a, f, friendlyDecHint(a, f))
  } },
  { key: 'div2dpFriendly', title: 'Divide by friendly 2-d.p. decimals', targetS: 14, gen: (rng) => {
    const { rWhere, pick } = tools(rng)
    const b = pick([0.12, 0.15, 0.16, 0.24, 0.25, 0.35, 0.45, 0.75])
    return div(round(rWhere(120, 950, (n) => n % 10 !== 0) * b), b)
  } },
  { key: '1dpx1dp', title: '1-d.p. × 1-d.p.', targetS: 16, gen: (rng) => {
    const { dec1 } = tools(rng)
    return { ...mul(dec1(12, 99), dec1(12, 99)), note: 'exact' }
  } },
  { key: 'div2dp', title: 'Divide by any 2-d.p. decimal', targetS: 18, gen: (rng) => {
    const { rWhere, rNot10 } = tools(rng)
    const b = rNot10(11, 99) / 100
    return div(round(rWhere(120, 950, (n) => n % 10 !== 0) * b), b)
  } },
  { key: 'threeHard', title: 'Three decimal factors', targetS: 25, gen: (rng) => {
    const { pick, dec1 } = tools(rng)
    const x = dec1(11, 49)
    const y = pick([0.4, 2.5, 0.25, 1.25, 0.8])
    const z = dec1(12, 60)
    // Exact product with ±0.0051: both readings of a tie (28.175 → 28.17 or 28.18) count.
    const exact = round(x * y * z, 6)
    const shown = round(exact, 2)
    return { prompt: `${fmt(x)} × ${fmt(y)} × ${fmt(z)}`, note: 'to 2 d.p.', answer: exact, display: fmt(shown), tol: 0.0051, hint: `Pair the friendly factor first: ${fmt(y)} × ${fmt(x)} = ${fmt(round(x * y))}, then × ${fmt(z)} = ${fmt(exact)} → ${fmt(shown)}` }
  } },
]
