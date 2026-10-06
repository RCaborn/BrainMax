import { describe, expect, it } from 'vitest'
import { CATEGORIES, LADDERS, type CategoryId, generate, isCorrect, isCorrectInput, parseFor, rungCount, tierOf } from '../src/features/math/generators'
import { parseAnswer, fmt, round } from '../src/features/math/format'
import { buildDailySet, defaultLevels, freshLevel, unlockedSkills, updateLevel, STARTING_SKILLS, UNLOCK_LEVEL, PREREQS } from '../src/features/math/engine'
import { cagrHint, percentHint, productHint, divisionHint } from '../src/features/math/hints'
import { mulberry32 } from '../src/lib/rng'

const ids = CATEGORIES.map((c) => c.id)

describe('parseAnswer', () => {
  it.each([
    ['1,440', 1440], ['1.44bn', 1.44e9], ['1440m', 1.44e9], ['300k', 3e5], ['−20', -20], ['-20%', -20],
    ['15%', 15], ['8.5x', 8.5], ['.5', 0.5], [' 42 ', 42], ['£3.2m', 3.2e6], ['x1.08', 1.08], ['×0.88', 0.88],
  ])('%s → %d', (s, n) => expect(parseAnswer(s)).toBeCloseTo(n as number, 6))
  it.each(['', 'abc', '1.2.3', '5zz'])('rejects %s', (s) => expect(parseAnswer(s)).toBeNull())
  it('accepts n/d on ?/d questions only', () => {
    expect(parseFor({ fractionOver: 16 }, '11/16')).toBe(11)
    expect(parseFor({ fractionOver: 16 }, '11')).toBe(11)
    expect(parseFor({ fractionOver: 8 }, '11/16')).toBeNull()
  })
})

describe('ladders', () => {
  it('every rung of every skill produces self-consistent questions', () => {
    const rng = mulberry32(42)
    for (const c of ids) {
      for (let level = 1; level <= rungCount(c); level++) {
        for (let i = 0; i < 300; i++) {
          const q = generate(c, level, rng)
          const where = `${c} rung ${level} (${q.rungTitle}): ${q.prompt} = ${q.display}`
          expect(Number.isFinite(q.answer), where).toBe(true)
          expect(isCorrect(q, parseFor(q, q.display)), where).toBe(true)
          for (const text of [q.prompt, q.hint, q.display, q.note ?? '']) expect(text, where).not.toMatch(/NaN|undefined|Infinity|null/)
          expect(q.targetMs).toBeGreaterThanOrEqual(4000)
        }
      }
    }
  })

  it('pure arithmetic prompts match an independent evaluation', () => {
    const rng = mulberry32(7)
    for (const cat of ['products', 'decimals', 'division'] as const) {
      for (let level = 1; level <= rungCount(cat); level++) {
        for (let i = 0; i < 300; i++) {
          const q = generate(cat, level, rng)
          const expr = q.prompt.replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d+)²/, '$1*$1')
          if (!/^[\d.\s*/+-]+$/.test(expr)) continue
          const exact = Function(`return (${expr})`)() as number
          const tol = Math.max(q.tol, q.relTol * Math.abs(exact), 1e-6 * Math.max(1, Math.abs(exact)))
          expect(Math.abs(q.answer - exact), `${q.prompt} → ${q.answer} vs ${exact}`).toBeLessThanOrEqual(tol + 1e-9)
        }
      }
    }
  })

  it('no times-table or whole-number leaks into products/decimals', () => {
    const rng = mulberry32(9)
    for (let level = 1; level <= rungCount('products'); level++) {
      for (let i = 0; i < 300; i++) {
        const q = generate('products', level, rng)
        const nums = q.prompt.replace(/,/g, '').match(/\d+/g)!.map(Number)
        if (level > 1) expect(nums.every((n) => n >= 3), q.prompt).toBe(true)
        if (level > 1 && nums.length === 2) expect(nums.some((n) => n >= 10), q.prompt).toBe(true)
      }
    }
    for (let level = 2; level <= rungCount('decimals'); level++) {
      for (let i = 0; i < 300; i++) {
        const q = generate('decimals', level, rng)
        expect(q.prompt, `rung ${level}`).toMatch(/\d\.\d/)
      }
    }
  })

  it('ladders get harder: rung target times trend upward', () => {
    for (const c of ids) {
      const t = LADDERS[c].map((r) => r.targetS)
      const firstThird = t.slice(0, Math.ceil(t.length / 3))
      const lastThird = t.slice(-Math.ceil(t.length / 3))
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      expect(avg(lastThird), c).toBeGreaterThan(avg(firstThird) * 1.5)
      expect(t[0], c).toBeLessThanOrEqual(9)
    }
  })

  it('every ladder has 12+ rungs, 3 on-ramp and 4 IB-ready', () => {
    for (const c of ids) {
      const n = rungCount(c)
      expect(n, c).toBeGreaterThanOrEqual(12)
      expect(tierOf(c, 3)).toBe('On-ramp')
      expect(tierOf(c, 4)).toBe('Core')
      expect(tierOf(c, n)).toBe('IB-ready')
    }
  })
})

describe('hints', () => {
  it('percent hints add up for awkward small rates', () => {
    expect(percentHint(0.25, 3400)).toContain('8.5')
    expect(percentHint(29, 640)).toContain('30% − 1%')
    expect(percentHint(37.5, 520)).toContain('3/8')
  })
  it('product hints are never degenerate', () => {
    expect(productHint(50, 7)).not.toMatch(/= 50×7 = 350 = 350/)
    expect(productHint(37, 11)).toContain('370 + 37')
    expect(productHint(93, 88)).toContain('Near 100')
  })
  it('division hint uses place-value chunks', () => {
    expect(divisionHint(7758, 9, 862)).toContain('9 × 800 = 7,200')
  })
  it('fmt formats with commas and minus sign', () => {
    expect(fmt(1234567.5)).toBe('1,234,567.5')
    expect(fmt(-20)).toBe('−20')
  })
})

/** Draws from one rung until `ok` holds. */
function find(cat: CategoryId, key: string, ok: (q: ReturnType<typeof generate>) => boolean) {
  const level = LADDERS[cat].findIndex((r) => r.key === key) + 1
  expect(level, key).toBeGreaterThan(0)
  const rng = mulberry32(3)
  for (let i = 0; i < 20_000; i++) {
    const q = generate(cat, level, rng)
    if (ok(q)) return q
  }
  throw new Error(`no sample for ${cat}/${key}`)
}

describe('review fixes', () => {
  it('round() is half-up despite float noise', () => {
    expect(round(4.9 * 1.25 * 4.6, 2)).toBe(28.18)
    expect(round(-2.675, 2)).toBe(-2.68)
  })
  it('unit questions accept the unit; big-money questions accept a bare number in the prompt unit', () => {
    const conv = find('bigNumbers', 'units', (q) => q.unitSuffix === 'bn')
    expect(isCorrectInput(conv, `${conv.display}bn`)).toBe(true)
    expect(isCorrectInput(conv, conv.display)).toBe(true)
    const ev = find('multiples', 'oneStep', (q) => q.prompt.startsWith('EBITDA') && q.answer < 1e9)
    expect(isCorrectInput(ev, String(ev.answer / 1e6))).toBe(true)
    expect(isCorrectInput(ev, `${ev.answer / 1e6}m`)).toBe(true)
    expect(isCorrectInput(ev, `${ev.answer / 1e6}k`)).toBe(false)
  })
  it('3-factor 2-d.p. ties accept either neighbour', () => {
    const q = find('decimals', 'threeHard', (x) => Math.abs(x.answer * 1000 - Math.round(x.answer * 1000)) < 1e-6 && Math.round(x.answer * 1000) % 10 === 5)
    expect(isCorrect(q, round(q.answer - 0.005, 2))).toBe(true)
    expect(isCorrect(q, round(q.answer + 0.005, 2))).toBe(true)
  })
  it('nearest-whole % change rejects the wrong neighbour', () => {
    const rng = mulberry32(11)
    const level = LADDERS.pctChange.findIndex((r) => r.key === 'nearestWhole') + 1
    for (let i = 0; i < 2000; i++) {
      const q = generate('pctChange', level, rng)
      const right = Math.round(q.answer)
      expect(isCorrect(q, right), q.prompt).toBe(true)
      expect(isCorrect(q, right + (q.answer < right ? -1 : 1)), q.prompt).toBe(Math.abs(q.answer - right) === 0.5)
    }
  })
  it('fraction hints multiply the anchor they show and land inside the tolerance', () => {
    for (const key of ['thirds', 'sevenths', 'ninths', 'bridge', 'primes']) {
      const rng = mulberry32(17)
      const level = LADDERS.fractions.findIndex((r) => r.key === key) + 1
      for (let i = 0; i < 400; i++) {
        const q = generate('fractions', level, rng)
        const shown = Number(q.hint.match(/→ (\d+(?:\.\d+)?)%/)?.[1])
        expect(isCorrect(q, shown), q.hint).toBe(true)
        // The last product printed before the arrow, rounded to 1 d.p., is accepted too.
        const route = q.hint.match(/(\d+\.\d+)% → [\d.]+%/)?.[1]
        if (route) expect(isCorrect(q, round(Number(route), 1)), q.hint).toBe(true)
      }
    }
  })
  it('real return: plain subtraction is never accepted, a correct 1-d.p. answer is', () => {
    const rng = mulberry32(5)
    const level = LADDERS.growth.findIndex((r) => r.key === 'real') + 1
    for (let i = 0; i < 2000; i++) {
      const q = generate('growth', level, rng)
      const [nom, inf] = q.prompt.match(/\d+/g)!.map(Number)
      expect(isCorrect(q, nom - inf), q.prompt).toBe(false)
      expect(isCorrect(q, round(q.answer, 1)), q.prompt).toBe(true)
    }
  })
  it('hints teach the rung\'s method', () => {
    expect(productHint(94, 50)).toContain('×100 then halve')
    expect(productHint(58, 81)).toContain('58 × 80 + 58 × 1')
    expect(productHint(174, 17)).toContain('174 × 10 + 174 × 7')
    expect(percentHint(30, 140)).toBe('10% = 14, × 3 = 42')
    expect(percentHint(0.25, 6700)).toContain('a quarter of 1% (67)')
    expect(percentHint(43, 590)).toContain('1% = 5.9, × 3 = 17.7')
    expect(percentHint(77, 300)).toBe('1% of 300 = 3; × 77 = 231')
    expect(percentHint(17.5, 440)).toContain('10% + 5% + 2.5%')
    expect(cagrHint(1.6, 2, 26.49)).toContain('square root')
    for (const p of [0.25, 0.5, 2.5, 7.5, 12, 29, 43, 55, 9.5]) expect(percentHint(p, 6700)).not.toMatch(/Build/)
  })
  it('ladders have no big target dips (difficulty climbs)', () => {
    for (const c of ids) {
      const t = LADDERS[c].map((r) => r.targetS)
      for (let i = 1; i < t.length; i++) expect(t[i], `${c} rung ${i + 1}`).toBeGreaterThanOrEqual(t[i - 1] * 0.75)
    }
  })
})

describe('progression', () => {
  const T = 10_000
  it('fast start climbs one rung per fast correct, then ends on the first miss', () => {
    let s = freshLevel()
    s = updateLevel('products', s, true, 5000, T)
    s = updateLevel('products', s, true, 5000, T)
    expect(s).toEqual({ level: 3, streak: 0, calibrating: true })
    s = updateLevel('products', s, false, 5000, T)
    expect(s).toEqual({ level: 2, streak: 0, calibrating: false })
  })
  it('3-up/1-down after calibration; slow-correct never wipes progress unless very slow', () => {
    let s = { level: 5, streak: 0, calibrating: false }
    s = updateLevel('products', s, true, 5000, T)
    s = updateLevel('products', s, true, 15_000, T) // slow but within 2x: keep streak
    expect(s.streak).toBe(1)
    s = updateLevel('products', s, true, 5000, T)
    s = updateLevel('products', s, true, 5000, T)
    expect(s).toEqual({ level: 6, streak: 0, calibrating: false })
    s = updateLevel('products', { level: 6, streak: 2, calibrating: false }, true, 25_000, T)
    expect(s).toEqual({ level: 6, streak: 0, calibrating: false })
  })
  it('levels are capped at the top rung', () => {
    const top = rungCount('growth')
    expect(updateLevel('growth', { level: top, streak: 0, calibrating: true }, true, 1, T).level).toBe(top)
  })

  it('converges to roughly 80% accuracy for a simulated user', () => {
    const rng = mulberry32(1)
    const pCorrect = (level: number) => 1 / (1 + Math.exp(level - 10.5))
    let s = freshLevel()
    let correct = 0
    const N = 20000
    for (let i = 0; i < N; i++) {
      const ok = rng() < pCorrect(s.level)
      if (ok) correct++
      s = updateLevel('products', s, ok, 1, T)
    }
    expect(correct / N).toBeGreaterThan(0.72)
    expect(correct / N).toBeLessThan(0.86)
  })

  it('skill path: starts with 3 skills and unlocks along prerequisites', () => {
    const lv = defaultLevels()
    expect(unlockedSkills(lv)).toEqual(STARTING_SKILLS.slice().sort((a, b) => ids.indexOf(a) - ids.indexOf(b)))
    lv.products.level = UNLOCK_LEVEL
    expect(unlockedSkills(lv)).toContain('decimals')
    expect(unlockedSkills(lv)).not.toContain('division')
    lv.fractions.level = UNLOCK_LEVEL
    expect(unlockedSkills(lv)).toContain('division')
    // Everything is reachable.
    for (const c of ids) lv[c as CategoryId].level = UNLOCK_LEVEL
    expect(unlockedSkills(lv)).toHaveLength(10)
    for (const c of ids) for (const p of PREREQS[c as CategoryId]) expect(ids).toContain(p)
  })

  it('daily set: 10 questions from unlocked skills only; new skill gets 3; 2 stretch', () => {
    const lv = defaultLevels()
    const unlocked = unlockedSkills(lv)
    for (let seed = 0; seed < 50; seed++) {
      const set = buildDailySet(lv, {}, unlocked, [], mulberry32(seed))
      expect(set).toHaveLength(10)
      expect(set.every((q) => unlocked.includes(q.category as CategoryId))).toBe(true)
      expect(set.filter((q) => q.level === 2)).toHaveLength(2)
    }
    lv.products.level = UNLOCK_LEVEL
    const withNew = buildDailySet(lv, {}, unlockedSkills(lv), ['decimals'], mulberry32(3))
    expect(withNew.filter((q) => q.category === 'decimals').length).toBeGreaterThanOrEqual(3)
  })
})
