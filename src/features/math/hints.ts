import { fmt, fmtBig, round } from './format'

const trailingZeros = (n: number) => {
  let z = 0
  while (n !== 0 && n % 10 === 0) {
    n /= 10
    z++
  }
  return z
}

/** Worked mental shortcut for a × b (positive integers). */
export function productHint(a: number, b: number): string {
  const ans = fmt(a * b)
  // Strip zeros first: 450 × 20 → 45 × 2, then put the zeros back.
  const za = trailingZeros(a)
  const zb = trailingZeros(b)
  if (za + zb > 0 && (a / 10 ** za) * (b / 10 ** zb) < 1000) {
    const ca = a / 10 ** za
    const cb = b / 10 ** zb
    return `Multiply the cores: ${ca} × ${cb} = ${fmt(ca * cb)}, then add back ${za + zb} zero${za + zb > 1 ? 's' : ''} → ${ans}`
  }
  if (a === b) {
    const near = Math.round(a / 10) * 10
    const d = Math.abs(a - near)
    if (d === 0) return `${a}² = ${ans}`
    const other = 2 * a - near
    return `${a}² = (${a}−${d})(${a}+${d}) + ${d}² = ${Math.min(near, other)} × ${Math.max(near, other)} + ${d * d} = ${fmt(near * other)} + ${d * d} = ${ans}`
  }
  const [big, small] = a >= b ? [a, b] : [b, a]
  // Friendly multipliers.
  if (small === 5) return `×5 = ×10 then halve: ${fmt(big * 10)} ÷ 2 = ${ans}`
  if (small === 50) return `×50 = ×100 then halve: ${fmt(big * 100)} ÷ 2 = ${ans}`
  if (small === 25 && big % 4 === 0) return `×25 = ÷4 then ×100: ${big} ÷ 4 = ${big / 4} → ${ans}`
  if (small === 25) return `×25 = ×100 then ÷4: ${fmt(big * 100)} ÷ 4 = ${ans}`
  if (small === 11 && big < 100) return `×11 = ×10 + itself: ${fmt(big * 10)} + ${big} = ${ans}`
  if (big >= 85 && big < 100 && small >= 85) {
    const da = 100 - big
    const db = 100 - small
    return `Near 100: ${big} is ${da} under, ${small} is ${db} under. ${big} − ${db} = ${big - db} → ${fmt((big - db) * 100)}; plus ${da} × ${db} = ${da * db}. Total ${ans}`
  }
  // Compensation: one factor within 2 of a round ten (or hundred).
  for (const [x, y] of [
    [small, big],
    [big, small],
  ]) {
    if (x < 10) continue
    const step = x >= 100 ? 100 : 10
    const rounded = Math.round(x / step) * step
    const diff = x - rounded
    if (rounded > 0 && diff !== 0 && Math.abs(diff) <= 2) {
      const sign = diff > 0 ? '+' : '−'
      return `${fmt(y)} × ${fmt(x)} = ${fmt(y)} × ${fmt(rounded)} ${sign} ${fmt(y)} × ${Math.abs(diff)} = ${fmt(y * rounded)} ${sign} ${fmt(y * Math.abs(diff))} = ${ans}`
    }
  }
  if (small < 10) {
    const parts = [Math.floor(big / 100) * 100, Math.floor((big % 100) / 10) * 10, big % 10].filter((p) => p > 0)
    if (parts.length === 1) return `${fmt(big)} × ${small} = ${ans}`
    return `${fmt(big)} × ${small} = ${parts.map((p) => `${p}×${small}`).join(' + ')} = ${parts.map((p) => fmt(p * small)).join(' + ')} = ${ans}`
  }
  if (big >= 100) {
    // Split the 3-digit factor into hundreds and the rest, estimating first.
    const h = Math.floor(big / 100) * 100
    const rest = big - h
    const est = Math.round(big / 100) * 100 * Math.round(small / 10) * 10
    return `Estimate ≈ ${fmt(est)}. Then ${fmt(big)} × ${small} = ${fmt(h)} × ${small} + ${rest} × ${small} = ${fmt(h * small)} + ${fmt(rest * small)} = ${ans}`
  }
  const tens = Math.floor(small / 10) * 10
  const units = small % 10
  if (units === 0) return `${big} × ${small} = ${big} × ${small / 10} × 10 = ${ans}`
  return `${big} × ${small} = ${big} × ${tens} + ${big} × ${units} = ${fmt(big * tens)} + ${fmt(big * units)} = ${ans}`
}

/**
 * Builds p% of base from easy pieces. Uses "round ten ± a bit" for rates like 29% or 81%,
 * fraction anchors where they exist, and checks the pieces add up before showing them.
 */
export function percentHint(p: number, base: number): string {
  const ans = round((p * base) / 100)
  const onePct = base / 100
  const FRACTIONS: Record<string, string> = { '50': '1/2', '25': '1/4', '75': '3/4', '12.5': '1/8', '37.5': '3/8', '62.5': '5/8', '87.5': '7/8', '20': '1/5' }
  const frac = FRACTIONS[String(p)]
  if (frac) {
    const [n, d] = frac.split('/').map(Number)
    return `${fmt(p)}% = ${frac}: ${fmt(base)} ÷ ${d} = ${fmt(base / d)}${n > 1 ? `, × ${n} = ${fmt(ans)}` : ''}`
  }
  const ANCHORS: Record<string, string> = {
    '10': `10% = move the point one place: ${fmt(base / 10)}`,
    '1': `1% = move the point two places: ${fmt(base / 100)}`,
    '5': `5% = half of 10% (${fmt(base / 10)}) = ${fmt(base / 20)}`,
  }
  if (ANCHORS[String(p)]) return ANCHORS[String(p)]
  if (Number.isInteger(p) && p > 10) {
    const near = Math.round(p / 10) * 10
    const d = p - near
    if (Math.abs(d) <= 2 && d !== 0) {
      const sign = d > 0 ? '+' : '−'
      return `${p}% = ${near}% ${sign} ${Math.abs(d)}%: ${fmt((near * base) / 100)} ${sign} ${fmt(round(Math.abs(d) * onePct))} = ${fmt(ans)}`
    }
  }
  // 1-d.p. rates like 4.3%: go via 1%.
  if (!Number.isInteger(p) && !Number.isInteger(p * 4)) return `1% of ${fmt(base)} = ${fmt(onePct)}; × ${fmt(p)} = ${fmt(ans)}`
  // Pieces: tens of 10%, then 5%, 2.5%, 1%, 0.5%, 0.25%.
  const units = [10, 5, 2.5, 1, 0.5, 0.25]
  let rest = p
  const pieces: [number, number][] = []
  for (const u of units) {
    const k = Math.floor(round(rest / u, 6))
    if (k > 0) {
      pieces.push([k, u])
      rest = round(rest - k * u, 6)
    }
  }
  const total = round(pieces.reduce((s, [k, u]) => s + (k * u * base) / 100, 0))
  if (rest === 0 && pieces.length <= 3 && total === ans) {
    const label = (k: number, u: number) => {
      const v = round((u * base) / 100)
      return k === 1 ? `${fmt(u)}% = ${fmt(v)}` : `${k} × ${fmt(u)}% = ${fmt(round(k * v))}`
    }
    return `Build ${fmt(p)}% from pieces of ${fmt(base)}: ${pieces.map(([k, u]) => label(k, u)).join(', ')} → ${fmt(ans)}`
  }
  return `1% of ${fmt(base)} = ${fmt(onePct)}; × ${fmt(p)} = ${fmt(ans)}`
}

/** Big-number version: "1% of 3.7bn = 37m; × 8 = 296m". */
export function percentHintBig(p: number, base: number): string {
  return `1% of ${fmtBig(base)} = ${fmtBig(base / 100)}; × ${fmt(p)} = ${fmtBig(round((p * base) / 100))}`
}

/** Place-value chunking: 7,758 ÷ 9 → 9 × 800 = 7,200; 9 × 60 = 540; 9 × 2 = 18. */
export function divisionHint(a: number, b: number, shown: number): string {
  const q = Math.floor(a / b)
  const steps: string[] = []
  let left = a
  for (const place of [1000, 100, 10, 1]) {
    const digit = Math.floor(Math.floor(left / b) / place)
    if (digit > 0) {
      const chunk = digit * place
      steps.push(`${fmt(b)} × ${fmt(chunk)} = ${fmt(b * chunk)}`)
      left = round(left - b * chunk)
    }
  }
  const remainder = round(a - b * q)
  const tail = remainder > 0 ? `; remainder ${fmt(remainder)} ÷ ${fmt(b)} ≈ ${fmt(round(remainder / b, 2))}` : ''
  return `Chunk it: ${steps.join('; ')}${tail} → ${fmt(shown)}`
}

/** Decimal × decimal: drop the points, multiply, put the places back. */
export function decimalProductHint(a: number, b: number, places: (x: number) => number): string {
  const pa = places(a)
  const pb = places(b)
  const ia = Math.round(a * 10 ** pa)
  const ib = Math.round(b * 10 ** pb)
  const ans = round(a * b)
  if (pa + pb === 0) return `${fmt(a)} × ${fmt(b)} = ${fmt(ans)}`
  return `Drop the points: ${fmt(ia)} × ${fmt(ib)} = ${fmt(ia * ib)}; the factors have ${pa + pb} decimal place${pa + pb > 1 ? 's' : ''} → ${fmt(ans)}`
}

/** e^x − 1 ≈ x + x²/2 + x³/6: a CAGR approximation that stays accurate for big multiples. */
export function cagrHint(mult: number, years: number, exactPct: number): string {
  const ln = Math.log(mult)
  const x = ln / years
  return `${fmt(round(mult, 3))}x in ${years} years: ln(${fmt(round(mult, 3))}) ≈ ${fmt(round(ln, 3))}, ÷ ${years} = ${fmt(round(x, 3))}. Growth = e^${fmt(round(x, 3))} − 1 ≈ x + x²/2 + x³/6 = ${fmt(round(x * 100, 1))}% + ${fmt(round(((x * x) / 2) * 100, 1))}% + ${fmt(round(((x ** 3) / 6) * 100, 1))}% ≈ ${fmt(round(exactPct, 1))}%`
}
