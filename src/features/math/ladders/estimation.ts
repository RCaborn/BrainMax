import type { Draft, Rung } from '../types'
import type { Rng } from '../../../lib/rng'
import { fmt, round, tools } from './util'

/** Round to 2 significant figures. */
const sf2 = (x: number) => {
  const p = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 1)
  return round(Math.round(x / p) * p, 10)
}

const within = (rel: number) => `estimate, within ${fmt(rel * 100)}%`

/** "(+0.8%)", or nothing when the rounding moved less than 0.05%. */
const moved = (from: number, to: number) => {
  const off = (to - from) / from
  return Math.abs(off) < 0.0005 ? '' : ` (${off > 0 ? '+' : '−'}${fmt(round(Math.abs(off) * 100, 1))}%)`
}

/** Nearest multiple of 5, used only when that moves b by 3% or less. */
const friendly5 = (b: number) => {
  const b5 = Math.round(b / 5) * 5
  return b5 > 0 && Math.abs(b5 - b) / b <= 0.03 ? b5 : b
}

/**
 * The working for a × b: round a to 2 s.f. (and b when `b2` differs), multiply, then nudge back by the
 * net rounding error when it matters for the tolerance.
 */
function estimateLine(a: number, b: number, b2: number, rel: number): string {
  const a2 = sf2(a)
  const rough = a2 * b2
  const net = rough / (a * b) - 1
  const rounds = [a2 !== a ? `${fmt(a)} ≈ ${fmt(a2)}${moved(a, a2)}` : '', b2 !== b ? `${fmt(b)} ≈ ${fmt(b2)}${moved(b, b2)}` : ''].filter(Boolean)
  const head = rounds.length ? `Round ${rounds.join(', ')}: ` : ''
  const nudge = Math.abs(net) > rel / 3 && Math.abs(net) >= 0.0005
    ? `; that is ${fmt(round(Math.abs(net) * 100, 1))}% ${net > 0 ? 'high' : 'low'}, so nudge ${net > 0 ? 'down' : 'up'} → ≈ ${fmt(round(rough * (1 - net), 1))}`
    : ''
  return `${head}${fmt(a2)} × ${fmt(b2)} = ${fmt(round(rough, 2))}${nudge}`
}

/** a × b: round a to 2 s.f.; for looser tolerances also round b to a friendly neighbour (one up, one down where it can). */
function productEstimate(a: number, b: number, rel: number, roundB: 'none' | 'friendly' | 'sf2' = rel >= 0.03 ? 'friendly' : 'none'): Draft {
  const exact = a * b
  const b2 = roundB === 'friendly' && Number.isInteger(b) ? friendly5(b) : roundB === 'sf2' ? sf2(b) : b
  return {
    prompt: `≈ ${fmt(a)} × ${fmt(b)}`, note: within(rel), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: rel,
    hint: `${estimateLine(a, b, b2, rel)} (exact ${fmt(round(exact, 1))})`,
  }
}

const RECIP: Record<string, number> = { '0.125': 8, '0.2': 5, '0.25': 4, '0.4': 2.5, '0.5': 2, '0.75': 4 / 3, '0.8': 1.25 }

function nearFriendlyDiv(rng: Rng, a: number, rel: number): Draft {
  const { pick, rWhere } = tools(rng)
  const F = pick([0.125, 0.2, 0.25, 0.4, 0.5, 0.75, 0.8])
  let b = F
  for (let i = 0; i < 50 && Math.abs(b / F - 1) < 0.003; i++) b = round(F * (1 + rWhere(-15, 15, (k) => Math.abs(k) >= 3) / 1000), 3)
  // The deviation actually shown, after rounding b to 3 d.p.
  const v = b / F - 1
  const exact = a / b
  const viaF = a * RECIP[String(F)]
  return {
    prompt: `≈ ${fmt(a)} ÷ ${fmt(b)}`, note: within(rel), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: rel,
    hint: `${fmt(b)} ≈ ${fmt(F)}, and ÷${fmt(F)} = ×${fmt(round(RECIP[String(F)], 3))}: ${fmt(a)} → ${fmt(round(viaF, 1))}. The divisor is ${v > 0 ? 'bigger' : 'smaller'} than ${fmt(F)} by ${fmt(round(Math.abs(v) * 100, 1))}%, so nudge ${v > 0 ? 'down' : 'up'} → ≈ ${fmt(round(viaF * (1 - v), 1))} (exact ${fmt(round(exact, 1))})`,
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
      return { prompt: `≈ ${fmt(a)} ÷ ${b}`, note: within(0.1), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.1, hint: `${fmt(A)} ÷ ${B} ≈ ${fmt(round(A / B, 1))} (exact ${fmt(round(exact, 1))})` }
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
  { key: 'threeFriendly', title: 'Three factors, friendly pair (±3%)', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const a = r(1200, 9800)
    const b = pick([0.02, 0.025, 0.04, 0.05, 0.075])
    const c = 10 * r(2, 9)
    const bc = round(b * c)
    const exact = a * b * c
    const rest = bc === 1 ? `${fmt(a)} × 1 = ${fmt(a)}` : estimateLine(a, bc, bc, 0.03)
    return { prompt: `≈ ${fmt(a)} × ${fmt(b)} × ${c}`, note: within(0.03), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.03, hint: `Pair the friendly factors first: ${fmt(b)} × ${c} = ${fmt(bc)}. ${rest} (exact ${fmt(round(exact, 1))})` }
  } },
  { key: 'x2digit5', title: '4-digit × 2-digit (±5%)', targetS: 18, gen: (rng) => {
    const { r } = tools(rng)
    return productEstimate(r(1200, 9800), r(13, 89), 0.05)
  } },
  { key: 'x2digit3', title: '4-digit × 2-digit (±3%)', targetS: 20, gen: (rng) => {
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
    if (coin()) return productEstimate(a, b, 0.02, 'sf2')
    const exact = a / b
    const b2 = sf2(b)
    const up = b2 > b
    const off = fmt(round(Math.abs((b2 - b) / b) * 100, 1))
    const tail = b2 === b
      ? ''
      : `. You rounded the divisor ${up ? 'up' : 'down'} by ${off}%, so that answer is ${off}% too ${up ? 'small' : 'big'}: nudge it ${up ? 'up' : 'down'} → ≈ ${fmt(round((a / b2) * (1 + (b2 - b) / b), 1))}`
    return {
      prompt: `≈ ${fmt(a)} ÷ ${fmt(b)}`, note: within(0.02), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.02,
      hint: `${b2 === b ? '' : `${fmt(b)} ≈ ${fmt(b2)}: `}${fmt(a)} ÷ ${fmt(b2)} = ${fmt(round(a / b2, 1))}${tail}${b2 === b ? '' : ` (exact ${fmt(round(exact, 1))})`}`,
    }
  } },
  { key: 'three', title: 'Three factors (±2%)', targetS: 35, gen: (rng) => {
    const { r } = tools(rng)
    const a = r(1200, 9800)
    const b = r(12, 95) / 1000
    const c = r(21, 97)
    const exact = a * b * c
    const a2 = sf2(a)
    const s1 = round(a2 * b, 4)
    const net = a2 / a - 1
    const nudge = Math.abs(net) > 0.02 / 3 ? `; ${fmt(a2)} was ${fmt(round(Math.abs(net) * 100, 1))}% ${net > 0 ? 'high' : 'low'}, so nudge ${net > 0 ? 'down' : 'up'} → ≈ ${fmt(round(s1 * c * (1 - net), 1))}` : ''
    return { prompt: `≈ ${fmt(a)} × ${fmt(b)} × ${c}`, note: within(0.02), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.02, hint: `${a2 !== a ? `Round ${fmt(a)} ≈ ${fmt(a2)}${moved(a, a2)}. ` : ''}${fmt(a2)} × ${fmt(b)} = ${fmt(s1)}; × ${c} = ${fmt(round(s1 * c, 2))}${nudge} (exact ${fmt(round(exact, 1))})` }
  } },
  { key: 'mulDiv', title: 'a × b ÷ c (±2%)', targetS: 35, gen: (rng) => {
    const { r, rWhere } = tools(rng)
    const a = r(1200, 9800)
    const b = r(13, 89)
    const c = rWhere(13, 89, (k) => k !== b)
    const exact = (a * b) / c
    const ratio = b / c
    const r2 = sf2(ratio)
    const a2 = sf2(a)
    const rough = a2 * r2
    const net = rough / exact - 1
    const nudge = Math.abs(net) > 0.02 / 3 ? `; net ${fmt(round(Math.abs(net) * 100, 1))}% ${net > 0 ? 'high' : 'low'}, so nudge ${net > 0 ? 'down' : 'up'} → ≈ ${fmt(round(rough * (1 - net), 1))}` : ''
    const rounds = [a2 !== a ? `${fmt(a)} ≈ ${fmt(a2)}${moved(a, a2)}` : ''].filter(Boolean)
    return { prompt: `≈ ${fmt(a)} × ${b} ÷ ${c}`, note: within(0.02), answer: round(exact, 4), display: fmt(round(exact, 1)), relTol: 0.02, hint: `Divide the small pair first: ${b} ÷ ${c} ≈ ${fmt(r2)}${moved(ratio, r2)}${rounds.length ? `; ${rounds.join(', ')}` : ''}. ${fmt(a2)} × ${fmt(r2)} = ${fmt(round(rough, 2))}${nudge} (exact ${fmt(round(exact, 1))})` }
  } },
]
