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
  const [big, small] = a >= b ? [a, b] : [b, a]
  // Friendly multipliers first: the rung that teaches ×50 should show ×100 ÷ 2.
  if (a !== b) {
    if (small === 5) return `×5 = ×10 then halve: ${fmt(big * 10)} ÷ 2 = ${ans}`
    if (small === 50) return `×50 = ×100 then halve: ${fmt(big * 100)} ÷ 2 = ${ans}`
    if (small === 25 && big % 4 === 0) return `×25 = ÷4 then ×100: ${fmt(big)} ÷ 4 = ${fmt(big / 4)} → ${ans}`
    if (small === 25) return `×25 = ×100 then ÷4: ${fmt(big * 100)} ÷ 4 = ${ans}`
    if (small === 11 && big < 100) return `×11 = ×10 + itself: ${fmt(big * 10)} + ${big} = ${ans}`
  }
  // Strip zeros: 450 × 20 → 45 × 2, then put the zeros back.
  const za = trailingZeros(a)
  const zb = trailingZeros(b)
  if (za + zb > 0) {
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
  if (big >= 85 && big < 100 && small >= 85) {
    const da = 100 - big
    const db = 100 - small
    return `Near 100: ${big} is ${da} under, ${small} is ${db} under. ${big} − ${db} = ${big - db} → ${fmt((big - db) * 100)}; plus ${da} × ${db} = ${da * db}. Total ${ans}`
  }
  // Compensation: use whichever factor is closest to a round ten (or hundred); prefer the larger on a tie.
  const comp = [big, small]
    .filter((x) => x >= 10)
    .map((x) => {
      const step = x >= 100 ? 100 : 10
      const rounded = Math.round(x / step) * step
      return { x, rounded, diff: x - rounded }
    })
    .filter((c) => c.rounded > 0 && c.diff !== 0 && Math.abs(c.diff) <= 2)
    .sort((p, q) => Math.abs(p.diff) - Math.abs(q.diff) || q.x - p.x)[0]
  if (comp) {
    const y = comp.x === big ? small : big
    const sign = comp.diff > 0 ? '+' : '−'
    return `${fmt(y)} × ${fmt(comp.x)} = ${fmt(y)} × ${fmt(comp.rounded)} ${sign} ${fmt(y)} × ${Math.abs(comp.diff)} = ${fmt(y * comp.rounded)} ${sign} ${fmt(y * Math.abs(comp.diff))} = ${ans}`
  }
  if (small < 10) {
    const parts = [Math.floor(big / 100) * 100, Math.floor((big % 100) / 10) * 10, big % 10].filter((p) => p > 0)
    if (parts.length === 1) return `${fmt(big)} × ${small} = ${ans}`
    return `${fmt(big)} × ${small} = ${parts.map((p) => `${p}×${small}`).join(' + ')} = ${parts.map((p) => fmt(p * small)).join(' + ')} = ${ans}`
  }
  if (small > 10 && small < 20) {
    // Teens: ×10 plus ×units.
    return `${fmt(big)} × ${small} = ${fmt(big)} × 10 + ${fmt(big)} × ${small - 10} = ${fmt(big * 10)} + ${fmt(big * (small - 10))} = ${ans}`
  }
  if (big >= 100) {
    const h = Math.floor(big / 100) * 100
    const rest = big - h
    return `Estimate ≈ ${fmt(Math.round(big / 100) * 100)} × ${small} = ${fmt(Math.round(big / 100) * 100 * small)}. Then ${fmt(big)} × ${small} = ${fmt(h)} × ${small} + ${rest} × ${small} = ${fmt(h * small)} + ${fmt(rest * small)} = ${ans}`
  }
  const tens = Math.floor(small / 10) * 10
  const units = small % 10
  return `${big} × ${small} = ${big} × ${tens} + ${big} × ${units} = ${fmt(big * tens)} + ${fmt(big * units)} = ${ans}`
}

/**
 * p% of base from easy pieces: fraction anchors, "round ten ± a bit", 1% when it is a single digit,
 * otherwise tens of 10% plus units of 1%. Never a one-piece "build" that just restates the answer.
 */
export function percentHint(p: number, base: number): string {
  const ans = round((p * base) / 100)
  const onePct = base / 100
  const ten = base / 10
  const FRACTIONS: Record<string, string> = { '50': '1/2', '25': '1/4', '75': '3/4', '12.5': '1/8', '37.5': '3/8', '62.5': '5/8', '87.5': '7/8', '20': '1/5' }
  const frac = FRACTIONS[String(p)]
  if (frac) {
    const [n, d] = frac.split('/').map(Number)
    return `${fmt(p)}% = ${frac}: ${fmt(base)} ÷ ${d} = ${fmt(base / d)}${n > 1 ? `, × ${n} = ${fmt(ans)}` : ''}`
  }
  const SMALL: Record<string, string> = {
    '10': `10% = move the point one place: ${fmt(ten)}`,
    '1': `1% = move the point two places: ${fmt(onePct)}`,
    '5': `5% = half of 10% (${fmt(ten)}) = ${fmt(ans)}`,
    '0.5': `0.5% = half of 1% (${fmt(onePct)}) = ${fmt(ans)}`,
    '0.25': `0.25% = a quarter of 1% (${fmt(onePct)}) = ${fmt(ans)}`,
    '2.5': `2.5% = a quarter of 10% (${fmt(ten)}) = ${fmt(ans)}`,
    '7.5': `7.5% = 10% − 2.5%: ${fmt(ten)} − ${fmt(ten / 4)} = ${fmt(ans)}`,
    '1.5': `1.5% = 1% + half of 1%: ${fmt(onePct)} + ${fmt(onePct / 2)} = ${fmt(ans)}`,
    '0.75': `0.75% = 1% − a quarter of 1%: ${fmt(onePct)} − ${fmt(onePct / 4)} = ${fmt(ans)}`,
  }
  if (SMALL[String(p)]) return SMALL[String(p)]
  if (Number.isInteger(p) && p > 10) {
    const near = Math.round(p / 10) * 10
    const d = p - near
    if (Math.abs(d) <= 2 && d !== 0) {
      const sign = d > 0 ? '+' : '−'
      const nearVal = round((near * base) / 100)
      const dVal = round(Math.abs(d) * onePct)
      const tenLine = near === 10 ? `10% = ${fmt(ten)}` : `10% = ${fmt(ten)}, so ${near}% = ${fmt(nearVal)}`
      return `${p}% = ${near}% ${sign} ${Math.abs(d)}%: ${tenLine}; ${Math.abs(d)}% = ${fmt(dVal)} → ${fmt(nearVal)} ${sign} ${fmt(dVal)} = ${fmt(ans)}`
    }
  }
  if (Number.isInteger(onePct) && onePct < 10) return `1% of ${fmt(base)} = ${fmt(onePct)}; × ${fmt(p)} = ${fmt(ans)}`
  if (Number.isInteger(p)) {
    const t = Math.floor(p / 10)
    const u = p % 10
    const parts = [
      t ? `10% = ${fmt(ten)}${t > 1 ? `, × ${t} = ${fmt(round(t * ten))}` : ''}` : '',
      u ? `1% = ${fmt(onePct)}${u > 1 ? `, × ${u} = ${fmt(round(u * onePct))}` : ''}` : '',
    ].filter(Boolean)
    return parts.length > 1 ? `${parts.join('; ')} → ${fmt(ans)}` : parts[0]
  }
  if (p > 2.5 && Number.isInteger(p / 2.5)) {
    // 17.5% = 10% + 5% + 2.5%, 32.5% = 3 × 10% + 2.5%.
    const rest = p - 2.5
    const t = Math.floor(rest / 10)
    const five = rest % 10 === 5
    const parts = [
      t ? `10% = ${fmt(ten)}${t > 1 ? `, × ${t} = ${fmt(round(t * ten))}` : ''}` : '',
      five ? `5% = ${fmt(round(ten / 2))}` : '',
      `2.5% = ${fmt(round(ten / 4))}`,
    ].filter(Boolean)
    return `${fmt(p)}% = ${[t ? `${t > 1 ? `${t} × ` : ''}10%` : '', five ? '5%' : '', '2.5%'].filter(Boolean).join(' + ')}: ${parts.join('; ')} → ${fmt(ans)}`
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
  const tail = remainder > 0 && round(remainder / b, 2) > 0 ? `; remainder ${fmt(remainder)} ÷ ${fmt(b)} ≈ ${fmt(round(remainder / b, 2))}` : ''
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
  const m = fmt(round(mult, 3))
  if (years === 2) {
    // A 2-year CAGR is a square root: guess, square, adjust.
    const root = Math.sqrt(mult)
    const lo = Math.floor(root * 100) / 100
    const hi = round(lo + 0.01, 2)
    return `2 years → square root of ${m}: ${fmt(lo)}² = ${fmt(round(lo * lo, 4))}, ${fmt(hi)}² = ${fmt(round(hi * hi, 4))}, so √${m} ≈ ${fmt(round(root, 3))} → CAGR ≈ ${fmt(round(exactPct, 1))}%`
  }
  const ln = Math.log(mult)
  const x = ln / years
  const terms = [x, (x * x) / 2, x ** 3 / 6].map((t) => round(t * 100, 1))
  const sum = round(terms[0] + terms[1] + terms[2], 1)
  return `${m}x in ${years} years: ln(${m}) ≈ ${fmt(round(ln, 3))}, ÷ ${years} = ${fmt(round(x, 3))}. Growth = e^${fmt(round(x, 3))} − 1 ≈ x + x²/2 + x³/6 = ${terms.map((t) => `${fmt(t)}%`).join(' + ')} = ${fmt(sum)}% (exact ${fmt(round(exactPct, 1))}%)`
}
