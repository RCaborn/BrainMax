import type { Draft, Rung } from '../types'
import type { Rng } from '../../../lib/rng'
import { fmt, gcd, pct, round, tools } from './util'

const ANCHOR: Record<number, string> = {
  3: '1/3 ≈ 33.33%', 6: '1/6 ≈ 16.67%', 7: '1/7 ≈ 14.29%', 8: '1/8 = 12.5%', 9: '1/9 ≈ 11.11%', 11: '1/11 ≈ 9.09%',
  12: '1/12 ≈ 8.33%', 13: '1/13 ≈ 7.69%', 14: '1/14 ≈ 7.14%', 15: '1/15 ≈ 6.67%', 16: '1/16 = 6.25%', 17: '1/17 ≈ 5.88%',
  18: '1/18 ≈ 5.56%', 19: '1/19 ≈ 5.26%', 20: '1/20 = 5%', 25: '1/25 = 4%', 40: '1/40 = 2.5%', 4: '1/4 = 25%', 5: '1/5 = 20%', 10: '1/10 = 10%', 32: '1/32 = 3.125%', 2: '1/2 = 50%',
}

function coprime(rng: Rng, d: number, lo = 1, hi = d - 1): number {
  const { rWhere } = tools(rng)
  return rWhere(lo, hi, (n) => gcd(n, d) === 1)
}

const asPct = (n: number, d: number, oneDp: boolean): Draft => {
  const exact = (n / d) * 100
  const ans = oneDp ? round(exact, 1) : round(exact)
  const near = n > d / 2 && d > 6
  const hint = near
    ? `Complement: ${d - n}/${d} = ${fmt(round(((d - n) / d) * 100, 2))}%, so ${n}/${d} = 100 − that = ${fmt(round(exact, 2))}% → ${pct(ans)} (${ANCHOR[d] ?? ''})`
    : n === 1
      ? `${ANCHOR[d] ?? `1/${d} = ${fmt(round(100 / d, 3))}%`} → ${pct(ans)}`
      : `${ANCHOR[d] ?? `1/${d} = ${fmt(round(100 / d, 3))}%`}; × ${n} = ${fmt(round(exact, 2))}% → ${pct(ans)} (keep an extra digit until the end)`
  return { prompt: `${n}/${d} as a %`, note: oneDp ? 'to 1 d.p.' : undefined, answer: ans, display: pct(ans), tol: oneDp ? 0.051 : 0, hint }
}

const asDec = (n: number, d: number): Draft => {
  const ans = round(n / d)
  const unit = `1/${d} = ${fmt(round(1 / d, 6), 6)}`
  return { prompt: `${n}/${d} as a decimal`, answer: ans, display: fmt(ans, 6), hint: n === 1 ? unit : `${unit}; × ${n} = ${fmt(ans, 6)}` }
}

const BENCH: [number, number][] = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [9, 10]]

export const FRACTIONS: Rung[] = [
  { key: 'bench', title: 'Benchmark fractions', targetS: 4, gen: (rng) => {
    const { pick, coin } = tools(rng)
    const [n, d] = pick(BENCH)
    return coin(0.7) ? asPct(n, d, false) : asDec(n, d)
  } },
  { key: 'reverseEasy', title: '% or decimal → fraction', targetS: 5, gen: (rng) => {
    const { pick, coin } = tools(rng)
    if (coin(0.3)) {
      const p = pick([50, 25, 20, 10, 5, 4, 2, 12.5])
      return { prompt: `${fmt(p)}% = 1/?`, note: 'type the missing number', answer: 100 / p, display: fmt(100 / p), hint: `${fmt(p)}% = ${fmt(p)}/100 = 1/${fmt(100 / p)}` }
    }
    const d = pick([4, 5, 10, 20])
    const n = coprime(rng, d)
    const asPercent = coin(4 / 7)
    const shown = asPercent ? `${fmt((100 * n) / d)}%` : fmt(n / d)
    return { prompt: `${shown} = ?/${d}`, note: 'type the missing number', answer: n, display: `${n}/${d}`, fractionOver: d, hint: `${shown} = ${fmt((100 * n) / d)}/100; scale to /${d}: ÷ ${100 / d} → ${n}/${d}` }
  } },
  { key: 'simplify', title: 'Simplify, then convert', targetS: 6, gen: (rng) => {
    const { pick, rWhere } = tools(rng)
    const [n, d] = pick(BENCH.filter(([, dd]) => dd !== 2))
    const k = rWhere(3, 15, (x) => [3, 4, 6, 7, 8, 9, 12, 15].includes(x) && d * x <= 100)
    const ans = (100 * n) / d
    return { prompt: `${n * k}/${d * k} as a %`, answer: ans, display: pct(ans), hint: `Divide top and bottom by ${k}: ${n * k}/${d * k} = ${n}/${d} = ${pct(ans)}` }
  } },
  { key: 'twentieths', title: '20ths and 25ths as %', targetS: 5, gen: (rng) => {
    const { pick } = tools(rng)
    const d = pick([20, 25, 4, 5])
    return asPct(coprime(rng, d), d, false)
  } },
  { key: 'eighths', title: 'Eighths as decimals', targetS: 5, gen: (rng) => asDec(coprime(rng, 8), 8) },
  { key: 'backTo8', title: 'Decimal → ?/8 or ?/16', targetS: 6, gen: (rng) => {
    const { pick } = tools(rng)
    const d = pick([8, 16])
    const n = coprime(rng, d)
    return {
      prompt: `${fmt(round(n / d))} = ?/${d}`, note: 'type the missing number', answer: n, display: `${n}/${d}`, fractionOver: d,
      hint: `${fmt(round(n / d))} × ${d} = ${n}${d === 16 ? ' (or think in eighths: 1/16 = 0.0625)' : ' (1/8 = 0.125)'}`,
    }
  } },
  { key: 'thirds', title: 'Thirds and sixths (1 d.p.)', targetS: 6, gen: (rng) => {
    const { pick } = tools(rng)
    const d = pick([3, 6])
    return asPct(coprime(rng, d), d, true)
  } },
  { key: 'sixteenths', title: '16ths and 40ths as decimals', targetS: 8, gen: (rng) => {
    const { pick } = tools(rng)
    const d = pick([16, 40])
    return asDec(coprime(rng, d), d)
  } },
  { key: 'fractionOf', title: 'Fraction of a number', targetS: 7, gen: (rng) => {
    const { r, pick } = tools(rng)
    const d = pick([3, 4, 5, 6, 8])
    const n = coprime(rng, d)
    const base = d * 5 * r(2, 30)
    const ans = (base / d) * n
    return { prompt: `${n}/${d} of ${fmt(base)}`, answer: ans, display: fmt(ans), hint: `${fmt(base)} ÷ ${d} = ${fmt(base / d)}, × ${n} = ${fmt(ans)}` }
  } },
  { key: 'sevenths', title: 'Sevenths (1 d.p.)', targetS: 8, gen: (rng) => asPct(coprime(rng, 7), 7, true) },
  { key: 'ninths', title: '9ths, 11ths, 12ths, 15ths (1 d.p.)', targetS: 9, gen: (rng) => {
    const { pick } = tools(rng)
    const d = pick([9, 11, 12, 15])
    return asPct(coprime(rng, d), d, true)
  } },
  { key: 'reverseHard', title: '% → ?/7, ?/9, ?/11, ?/12', targetS: 9, gen: (rng) => {
    const { pick } = tools(rng)
    const d = pick([7, 9, 11, 12])
    const n = coprime(rng, d)
    const shown = round((n / d) * 100, 1)
    return {
      prompt: `${fmt(shown)}% = ?/${d}`, note: 'type the missing number', answer: n, display: `${n}/${d}`, fractionOver: d,
      hint: `${ANCHOR[d]}: ${fmt(shown)} ÷ ${fmt(round(100 / d, 2))} ≈ ${n}`,
    }
  } },
  { key: 'sumUnits', title: 'Sum of two unit fractions', targetS: 12, gen: (rng) => {
    const { pick, rWhere } = tools(rng)
    const a = pick([7, 8, 9, 11, 12])
    const b = rWhere(5, 12, (x) => x !== a && x !== 10)
    const ans = round((1 / a + 1 / b) * 100, 1)
    return { prompt: `1/${a} + 1/${b} as a %`, note: 'to 1 d.p.', answer: ans, display: pct(ans), tol: 0.051, hint: `${fmt(round(100 / a, 2))}% + ${fmt(round(100 / b, 2))}% = ${fmt(round((1 / a + 1 / b) * 100, 2))}% → ${pct(ans)}` }
  } },
  { key: 'fractionOfBig', title: 'Fraction of a bigger number', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const d = pick([7, 8, 9, 12, 15, 16])
    const n = coprime(rng, d, 2)
    const base = d * r(6, 80)
    const ans = (base / d) * n
    return { prompt: `${n}/${d} of ${fmt(base)}`, answer: ans, display: fmt(ans), hint: `${fmt(base)} ÷ ${d} = ${fmt(base / d)}, × ${n} = ${fmt(ans)}` }
  } },
  { key: 'thirtySeconds', title: '32nds as decimals', targetS: 12, gen: (rng) => asDec(coprime(rng, 32), 32) },
  { key: 'bridge', title: '14ths, 18ths and near-whole fractions', targetS: 12, gen: (rng) => {
    const { pick, coin } = tools(rng)
    if (coin()) {
      const d = pick([14, 18])
      return asPct(coprime(rng, d), d, true)
    }
    const d = pick([13, 17, 19])
    return asPct(d - pick([1, 2]), d, true)
  } },
  { key: 'primes', title: '13ths, 17ths, 19ths (1 d.p.)', targetS: 16, gen: (rng) => {
    const { pick } = tools(rng)
    const d = pick([13, 17, 19])
    return asPct(coprime(rng, d), d, true)
  } },
]
