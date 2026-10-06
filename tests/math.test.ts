import { describe, expect, it } from 'vitest'
import { CATEGORIES, LADDERS, type CategoryId, generate, isCorrect, parseFor, rungCount, tierOf } from '../src/features/math/generators'
import { parseAnswer, fmt } from '../src/features/math/format'
import { buildDailySet, defaultLevels, freshLevel, unlockedSkills, updateLevel, STARTING_SKILLS, UNLOCK_LEVEL, PREREQS } from '../src/features/math/engine'
import { percentHint, productHint, divisionHint } from '../src/features/math/hints'
import { mulberry32 } from '../src/lib/rng'

const ids = CATEGORIES.map((c) => c.id)

describe('parseAnswer', () => {
  it.each([
    ['1,440', 1440], ['1.44bn', 1.44e9], ['1440m', 1.44e9], ['300k', 3e5], ['−20', -20], ['-20%', -20],
    ['15%', 15], ['8.5x', 8.5], ['.5', 0.5], [' 42 ', 42], ['£3.2m', 3.2e6],
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
