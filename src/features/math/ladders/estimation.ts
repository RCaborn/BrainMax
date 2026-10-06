import type { Draft, Rung } from '../types'
import type { Rng } from '../../../lib/rng'
import { fmt, round, tools } from './util'

/** Round to 2 significant figures. */
const sf2 = (x: number) => {
  const p = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 1)
  return Math.round(x / p) * p
}

const within = (rel: number) => `estimate, within ${fmt(rel * 100)}%`

/** a × b with a rounded to 2 s.f., then nudged back by the rounding error. */
function productEstimate(a: number, b: number, rel: number): Draft {
  const exact = a * b
  const a2 = sf2(a)
  const off = (a - a2) / a2
  const rough = a2 * b
  const nudged = rough * (1 + off)
  const showNudge = Math.abs(off) > rel / 3
  return {
    prompt: `≈ ${fmt(a)} × ${fmt(b)}`, note: within(rel), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: rel,
    hint: `Round ${fmt(a)} to ${fmt(a2)} (${off >= 0 ? '−' : '+'}${fmt(round(Math.abs(off) * 100, 1))}%): ${fmt(a2)} × ${fmt(b)} = ${fmt(round(rough, 2))}${showNudge ? `; nudge ${off >= 0 ? 'up' : 'down'} ${fmt(round(Math.abs(off) * 100, 1))}% → ≈ ${fmt(round(nudged, 1))}` : ''} (exact ${fmt(round(exact, 1))})`,
  }
}

const RECIP: Record<string, number> = { '0.125': 8, '0.2': 5, '0.25': 4, '0.4': 2.5, '0.5': 2, '0.75': 4 / 3, '0.8': 1.25 }

function nearFriendlyDiv(rng: Rng, a: number, rel: number): Draft {
  const { pick, rWhere } = tools(rng)
  const F = pick([0.125, 0.2, 0.25, 0.4, 0.5, 0.75, 0.8])
  const v = rWhere(-15, 15, (k) => Math.abs(k) >= 3) / 1000
  const b = round(F * (1 + v), 3)
  const exact = a / b
  const viaF = a * RECIP[String(F)]
  return {
    prompt: `≈ ${fmt(a)} ÷ ${fmt(b)}`, note: within(rel), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: rel,
    hint: `${fmt(b)} ≈ ${fmt(F)}, and ÷${fmt(F)} = ×${fmt(round(RECIP[String(F)], 3))}: ${fmt(a)} → ${fmt(round(viaF, 1))}. The divisor is ${v > 0 ? 'bigger' : 'smaller'} by ${fmt(round(Math.abs(v) * 100, 1))}%, so nudge ${v > 0 ? 'down' : 'up'} → ≈ ${fmt(round(viaF / (1 + v), 1))}`,
  }
}

export const ESTIMATION: Rung[] = [
  { key: 'magnitude', title: 'Near-round magnitude (±10%)', targetS: 6, gen: (rng) => {
    const { pick, coin, rWhere } = tools(rng)
    const A = pick([2, 3, 4, 5, 6, 8]) * pick([100, 1000])
    const a = Math.round(A * (1 + rWhere(-30, 30, (k) => k !== 0) / 1000))
    const B = pick([20, 30, 40, 50, 60, 80])
    const b = B + pick([-1, 1])
    if (A >= 1000 && coin(0.3)) {
      const exact = a / b
      return { prompt: `≈ ${fmt(a)} ÷ ${b}`, note: within(0.1), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.1, hint: `${fmt(A)} ÷ ${B} = ${fmt(A / B)} (exact ${fmt(round(exact, 1))})` }
    }
    return { prompt: `≈ ${fmt(a)} × ${b}`, note: within(0.1), answer: a * b, display: fmt(a * b), relTol: 0.1, hint: `${fmt(A)} × ${B} = ${fmt(A * B)} (exact ${fmt(a * b)})` }
  } },
  { key: 'sf2tens', title: '2 s.f., × round tens (±5%)', targetS: 9, gen: (rng) => {
    const { r } = tools(rng)
    return productEstimate(r(1200, 9800), 10 * r(2, 9), 0.05)
  } },
  { key: 'friendlyTricks', title: 'Friendly-factor tricks (±5%)', targetS: 9, gen: (rng) => {
    const { r, pick, coin, rWhere } = tools(rng)
    const a = r(120, 980) * pick([1, 10])
    const B = pick([20, 25, 40, 50])
    const b = round(B * (1 + rWhere(-20, 20, (k) => Math.abs(k) >= 3) / 1000), 1)
    if (coin()) {
      const exact = a / b
      return { prompt: `≈ ${fmt(a)} ÷ ${fmt(b)}`, note: within(0.05), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.05, hint: `÷${fmt(b)} ≈ ÷${B}: ${fmt(a)} ÷ ${B} = ${fmt(round(a / B, 2))} (exact ${fmt(round(exact, 1))})` }
    }
    return { prompt: `≈ ${fmt(a)} × ${fmt(b)}`, note: within(0.05), answer: round(a * b, 4), display: fmt(round(a * b, 1)), relTol: 0.05, hint: `×${fmt(b)} ≈ ×${B}: ${fmt(a)} × ${B} = ${fmt(a * B)} (exact ${fmt(round(a * b, 1))})` }
  } },
  { key: 'x2digit5', title: '4-digit × 2-digit (±5%)', targetS: 15, gen: (rng) => {
    const { r } = tools(rng)
    return productEstimate(r(1200, 9800), r(13, 89), 0.05)
  } },
  { key: 'x2digit3', title: '4-digit × 2-digit (±3%)', targetS: 18, gen: (rng) => {
    const { r } = tools(rng)
    return productEstimate(r(1200, 9800), r(13, 89), 0.03)
  } },
  { key: 'x2digit2', title: '4-digit × 2-digit (±2%)', targetS: 20, gen: (rng) => {
    const { r } = tools(rng)
    return productEstimate(r(1200, 9800), r(13, 89), 0.02)
  } },
  { key: 'xDecimal', title: '× a 2-d.p. decimal (±2%)', targetS: 20, gen: (rng) => {
    const { r, rNot10 } = tools(rng)
    return productEstimate(r(1200, 9800), rNot10(11, 89) / 100, 0.02)
  } },
  { key: 'divNearFriendly', title: '÷ a near-friendly decimal (±2%)', targetS: 25, gen: (rng) => nearFriendlyDiv(rng, tools(rng).r(1200, 9800), 0.02) },
  { key: 'mixed', title: '× or ÷ any 3-d.p. decimal (±2%)', targetS: 30, gen: (rng) => {
    const { r, coin } = tools(rng)
    const a = r(1200, 9800)
    const b = r(105, 895) / 1000
    if (coin()) return productEstimate(a, b, 0.02)
    const exact = a / b
    const b2 = sf2(b)
    return {
      prompt: `≈ ${fmt(a)} ÷ ${fmt(b)}`, note: within(0.02), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.02,
      hint: `${fmt(b)} ≈ ${fmt(b2)}: ${fmt(a)} ÷ ${fmt(b2)} = ${fmt(round(a / b2, 1))}; the divisor moved ${fmt(round(((b2 - b) / b) * 100, 1))}%, so nudge the answer the other way → ≈ ${fmt(round((a / b2) * (b2 / b), 1))}`,
    }
  } },
  { key: 'threeFriendly', title: 'Three factors, friendly middle (±3%)', targetS: 18, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = r(1200, 9800)
    const b = pick([0.02, 0.025, 0.04, 0.05, 0.075])
    const c = 10 * r(2, 9)
    const exact = a * b * c
    const a2 = sf2(a)
    return { prompt: `≈ ${fmt(a)} × ${fmt(b)} × ${c}`, note: within(0.03), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.03, hint: `${fmt(a)} ≈ ${fmt(a2)}; × ${fmt(b)} = ${fmt(round(a2 * b, 2))}; × ${c} = ${fmt(round(a2 * b * c, 1))} (exact ${fmt(round(exact, 1))})` }
  } },
  { key: 'three', title: 'Three factors (±2%)', targetS: 35, gen: (rng) => {
    const { r } = tools(rng)
    const a = r(1200, 9800)
    const b = r(12, 95) / 1000
    const c = r(21, 97)
    const exact = a * b * c
    return { prompt: `≈ ${fmt(a)} × ${fmt(b)} × ${c}`, note: within(0.02), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.02, hint: `Do ${fmt(a)} × ${fmt(b)} ≈ ${fmt(round(a * b, 1))} first (round one factor up and the other down), then × ${c} ≈ ${fmt(round(exact, 1))}` }
  } },
  { key: 'mulDiv', title: 'a × b ÷ c (±2%)', targetS: 35, gen: (rng) => {
    const { r } = tools(rng)
    const a = r(1200, 9800)
    const b = r(13, 89)
    const c = r(13, 89)
    const exact = (a * b) / c
    return { prompt: `≈ ${fmt(a)} × ${b} ÷ ${c}`, note: within(0.02), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.02, hint: `Divide first where it's friendlier: ${b} ÷ ${c} ≈ ${fmt(round(b / c, 3))}, × ${fmt(a)} ≈ ${fmt(round(exact, 1))}` }
  } },
]
