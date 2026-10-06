import type { Draft, Rung } from '../types'
import { fmt, fmtBig as B, round, tools } from './util'

const UNITS = 'k / m / bn accepted'

const ev = (m: number, e: number, rel = 0.001): Draft => {
  const ans = round(m * e)
  const whole = Math.floor(m)
  const frac = round(m - whole)
  const hint = frac
    ? `${fmt(m)}x = ${whole}x + ${fmt(frac)}x: ${whole} × ${B(e)} = ${B(whole * e)}; ${fmt(frac)} × ${B(e)} = ${B(round(frac * e))}; EV = ${B(ans)}`
    : `EV = multiple × EBITDA = ${m} × ${B(e)} = ${B(ans)}`
  return { prompt: `EBITDA ${B(e)} at ${fmt(m)}x EV/EBITDA. EV?`, note: rel > 0.001 ? `within 0.5%; ${UNITS}` : UNITS, answer: ans, display: B(ans), relTol: rel, hint }
}

const bridge = (evv: number, amt: number, cash: boolean): Draft => {
  const ans = cash ? evv + amt : evv - amt
  return {
    prompt: `EV ${B(evv)}, ${cash ? 'net cash' : 'net debt'} ${B(amt)}. Equity value?`, note: UNITS, answer: ans, display: B(ans), relTol: 0.001,
    hint: `Equity = EV − net debt (net cash is added): ${B(evv)} ${cash ? '+' : '−'} ${B(amt)} = ${B(ans)}`,
  }
}

export const MULTIPLES: Rung[] = [
  { key: 'oneStep', title: 'One step, round numbers', targetS: 7, gen: (rng) => {
    const { r, pick } = tools(rng)
    const f = pick(['ev', 'price', 'bridge'])
    if (f === 'ev') return ev(pick([5, 6, 8, 10, 12, 15]), pick([20, 30, 40, 50, 60, 80, 100]) * 1e6)
    if (f === 'price') {
      const pe = pick([10, 12, 15, 20, 25])
      const eps = pick([1, 2, 3, 4, 5])
      return { prompt: `EPS ${eps}, P/E ${pe}x. Share price?`, answer: pe * eps, display: fmt(pe * eps), hint: `Price = P/E × EPS = ${pe} × ${eps} = ${pe * eps}` }
    }
    return bridge(r(4, 20) * 1e8, r(1, 3) * 1e8, false)
  } },
  { key: 'reverse', title: 'Reverse, round numbers', targetS: 8, gen: (rng) => {
    const { pick } = tools(rng)
    const f = pick(['evm', 'pe', 'margin'])
    if (f === 'evm') {
      const m = pick([4, 5, 6, 8, 10, 12, 15, 20])
      const e = pick([20, 25, 40, 50, 100, 200]) * 1e6
      return { prompt: `EV ${B(m * e)}, EBITDA ${B(e)}. EV/EBITDA?`, answer: m, display: `${m}x`, hint: `${B(m * e)} ÷ ${B(e)} = ${m}x` }
    }
    if (f === 'pe') {
      const eps = pick([1, 2, 4, 5])
      const pe = pick([8, 10, 12, 15, 20, 25])
      return { prompt: `Share price ${pe * eps}, EPS ${eps}. P/E?`, answer: pe, display: `${pe}x`, hint: `P/E = price ÷ EPS = ${pe * eps} ÷ ${eps} = ${pe}x` }
    }
    const rev = pick([100, 200, 400, 500, 800, 1000]) * 1e6
    const mg = pick([10, 20, 25, 30, 40, 50])
    return { prompt: `Revenue ${B(rev)}, EBITDA ${B((rev * mg) / 100)}. EBITDA margin?`, note: 'in %', answer: mg, display: `${mg}%`, hint: `Margin = EBITDA ÷ revenue = ${mg}%` }
  } },
  { key: 'crossover', title: 'Unit crossover and the EV bridge', targetS: 9, gen: (rng) => {
    const { r, pick, coin } = tools(rng)
    const f = pick(['ev', 'bridge', 'mcap'])
    if (f === 'ev') return ev(r(4, 10), r(4, 19) * 1e7)
    if (f === 'bridge') return bridge(r(10, 40) * 1e8, r(2, 9) * 5e7, coin(0.25))
    const shares = pick([10, 20, 25, 50, 100]) * 1e6
    const price = r(5, 40)
    return { prompt: `${B(shares)} shares at ${price}. Market cap?`, note: UNITS, answer: shares * price, display: B(shares * price), relTol: 0.001, hint: `${fmt(shares / 1e6)}m × ${price} = ${fmt((shares / 1e6) * price)}m = ${B(shares * price)}` }
  } },
  { key: 'ev', title: 'EV from EBITDA', targetS: 10, gen: (rng) => {
    const { r } = tools(rng)
    return ev(r(5, 12), r(4, 30) * 1e7)
  } },
  { key: 'margin', title: 'EBIT margin', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const rev = r(2, 20) * 1e8
    const mg = pick([5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 25, 30])
    return { prompt: `Revenue ${B(rev)}, EBIT ${B((rev * mg) / 100)}. EBIT margin?`, note: 'in %', answer: mg, display: `${mg}%`, hint: `Margin = EBIT ÷ revenue: 1% of ${B(rev)} is ${B(rev / 100)}, and ${B((rev * mg) / 100)} ÷ ${B(rev / 100)} = ${mg}%` }
  } },
  { key: 'epsFriendly', title: 'EPS with friendly share counts', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const shares = pick([20, 25, 40, 50, 100, 200, 250]) * 1e6
    const eps = r(2, 16) / 2
    return { prompt: `Net income ${B(shares * eps)}, ${B(shares)} shares. EPS?`, answer: eps, display: fmt(eps), hint: `EPS = net income ÷ shares = ${fmt((shares * eps) / 1e6)}m ÷ ${fmt(shares / 1e6)}m = ${fmt(eps)}` }
  } },
  { key: 'priceFromPE', title: 'Share price from P/E', targetS: 15, gen: (rng) => {
    const { r } = tools(rng)
    const pe = r(8, 30)
    const eps = r(4, 24) / 4
    const p = round(pe * eps)
    return { prompt: `Peers trade at ${pe}x P/E; EPS is ${fmt(eps)}. Implied share price?`, answer: p, display: fmt(p), hint: `Price = P/E × EPS = ${pe} × ${fmt(eps)} = ${fmt(p)}` }
  } },
  { key: 'pe', title: 'P/E', targetS: 15, gen: (rng) => {
    const { r } = tools(rng)
    const eps = r(4, 24) / 4
    const pe = r(8, 30)
    return { prompt: `Share price ${fmt(round(eps * pe))}, EPS ${fmt(eps)}. P/E?`, answer: pe, display: `${pe}x`, hint: `P/E = price ÷ EPS = ${fmt(round(eps * pe))} ÷ ${fmt(eps)} = ${pe}x` }
  } },
  { key: 'evHalf', title: 'EV with half-turn multiples', targetS: 15, gen: (rng) => {
    const { r, pick } = tools(rng)
    return ev(pick([6.5, 7.5, 8.5, 9.5, 10.5, 11.5]), r(6, 40) * 1e7, 0.005)
  } },
  { key: 'bridgeHard', title: 'Equity bridge, odd amounts', targetS: 12, gen: (rng) => {
    const { r, coin } = tools(rng)
    return bridge(r(10, 60) * 1e8, r(11, 99) * 1e7, coin(0.25))
  } },
  { key: 'impliedMultiple', title: 'Implied EV/EBITDA', targetS: 15, gen: (rng) => {
    const { r, pick } = tools(rng)
    const m = pick([5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12, 13, 14])
    const e = r(6, 40) * 1e7
    return { prompt: `EV ${B(round(m * e))}, EBITDA ${B(e)}. EV/EBITDA?`, answer: m, display: `${fmt(m)}x`, tol: 0.05, hint: `Estimate then check: ${Math.floor(m)} × ${B(e)} = ${B(Math.floor(m) * e)}${m % 1 ? `, and the rest is half of EBITDA → ${fmt(m)}x` : ` → ${m}x`}` }
  } },
  { key: 'priceFromEquity', title: 'Share price from equity value', targetS: 12, gen: (rng) => {
    const { r, pick } = tools(rng)
    const shares = pick([20, 25, 40, 50, 80, 100, 200]) * 1e6
    const price = r(8, 60)
    return { prompt: `Equity value ${B(shares * price)}, ${B(shares)} shares. Share price?`, answer: price, display: fmt(price), hint: `${fmt((shares * price) / 1e6)}m ÷ ${fmt(shares / 1e6)}m = ${price}` }
  } },
  { key: 'eps', title: 'EPS', targetS: 20, gen: (rng) => {
    const { r } = tools(rng)
    const shares = r(2, 20) * 1e7
    const eps = r(4, 40) / 4
    return { prompt: `Net income ${B(round(shares * eps))}, ${B(shares)} shares. EPS?`, answer: eps, display: fmt(eps), hint: `EPS = net income ÷ shares = ${fmt(round((shares * eps) / 1e6))}m ÷ ${fmt(shares / 1e6)}m = ${fmt(eps)}` }
  } },
  { key: 'impliedPrice', title: 'Implied share price from EV', targetS: 25, gen: (rng) => {
    const { r } = tools(rng)
    const shares = r(5, 40) * 1e7
    const price = r(8, 80)
    const nd = r(1, 9) * 1e8
    const evv = shares * price + nd
    return { prompt: `EV ${B(evv)}, net debt ${B(nd)}, ${B(shares)} shares. Implied share price?`, answer: price, display: fmt(price), hint: `Equity = ${B(evv)} − ${B(nd)} = ${B(shares * price)}; ÷ ${B(shares)} = ${price}` }
  } },
  { key: 'evFromRevenueEasy', title: 'EV from revenue (friendly)', targetS: 15, gen: (rng) => {
    const { r, pick } = tools(rng)
    const rev = r(4, 30) * 1e8
    const mg = pick([10, 20, 25])
    const m = pick([5, 6, 8, 10])
    const ans = round(((rev * mg) / 100) * m)
    return { prompt: `Revenue ${B(rev)}, ${mg}% EBITDA margin, ${m}x EV/EBITDA. EV?`, note: UNITS, answer: ans, display: B(ans), relTol: 0.001, hint: `EBITDA = ${mg}% × ${B(rev)} = ${B((rev * mg) / 100)}; × ${m} = ${B(ans)}` }
  } },
  { key: 'evFromRevenue', title: 'EV from revenue and margin', targetS: 25, gen: (rng) => {
    const { r, pick } = tools(rng)
    const rev = r(4, 30) * 1e8
    const mg = pick([12, 15, 18, 20, 22, 25])
    const m = pick([6, 7.5, 8, 9, 10, 12])
    const ans = round(((rev * mg) / 100) * m)
    return { prompt: `Revenue ${B(rev)}, ${mg}% EBITDA margin, ${fmt(m)}x EV/EBITDA. EV?`, note: `within 0.5%; ${UNITS}`, answer: ans, display: B(ans), relTol: 0.005, hint: `EBITDA = ${mg}% × ${B(rev)} = ${B((rev * mg) / 100)}; × ${fmt(m)} = ${B(ans)}` }
  } },
]
