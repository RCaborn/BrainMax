import { describe, expect, it } from 'vitest'
import { CATEGORIES, MAX_LEVEL, generate, isCorrect } from '../src/features/math/generators'
import { parseAnswer, fmt } from '../src/features/math/format'
import { updateLevel, buildDailySet, defaultLevels } from '../src/features/math/engine'
import { mulberry32 } from '../src/lib/rng'

describe('parseAnswer', () => {
  it.each([
    ['1,440', 1440], ['1.44bn', 1.44e9], ['1440m', 1.44e9], ['300k', 3e5], ['−20', -20], ['-20%', -20],
    ['15%', 15], ['8.5x', 8.5], ['.5', 0.5], [' 42 ', 42], ['£3.2m', 3.2e6],
  ])('%s → %d', (s, n) => expect(parseAnswer(s)).toBeCloseTo(n as number, 6))
  it.each(['', 'abc', '1.2.3', '5zz'])('rejects %s', (s) => expect(parseAnswer(s)).toBeNull())
})

describe('generators', () => {
  it('every category and level produces a self-consistent question', () => {
    const rng = mulberry32(42)
    for (const c of CATEGORIES) {
      for (let level = 1; level <= MAX_LEVEL; level++) {
        for (let i = 0; i < 200; i++) {
          const q = generate(c.id, level, rng)
          expect(Number.isFinite(q.answer), `${c.id} L${level} ${q.prompt}`).toBe(true)
          // The displayed answer must itself be marked correct when typed in.
          const typed = q.display.replace(/\/\d+$/, '')
          expect(isCorrect(q, parseAnswer(typed)), `${c.id} L${level}: ${q.prompt} = ${q.display}`).toBe(true)
          expect(q.prompt).not.toMatch(/NaN|undefined|Infinity/)
          expect(q.hint).not.toMatch(/NaN|undefined|Infinity/)
        }
      }
    }
  })

  it('pure arithmetic prompts match an independent evaluation', () => {
    const rng = mulberry32(7)
    for (const cat of ['products', 'decimals', 'division'] as const) {
      for (let level = 1; level <= MAX_LEVEL; level++) {
        for (let i = 0; i < 200; i++) {
          const q = generate(cat, level, rng)
          const expr = q.prompt.replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d+)²/, '$1*$1')
          const exact = Function(`return (${expr})`)() as number
          const expected = q.note?.includes('1 d.p.') ? Math.round(exact * 10) / 10 : exact
          expect(Math.abs(q.answer - expected), `${q.prompt}`).toBeLessThan(1e-6 * Math.max(1, Math.abs(expected)))
        }
      }
    }
  })

  it('tolerances accept near-misses only where intended', () => {
    const q = { answer: 23, tol: 0, relTol: 0 }
    expect(isCorrect(q, 23)).toBe(true)
    expect(isCorrect(q, 23.01)).toBe(false)
    const est = { answer: 1000, tol: 0, relTol: 0.02 }
    expect(isCorrect(est, 1019)).toBe(true)
    expect(isCorrect(est, 1021)).toBe(false)
  })

  it('fmt formats with commas and minus sign', () => {
    expect(fmt(1234567.5)).toBe('1,234,567.5')
    expect(fmt(-20)).toBe('−20')
  })
})

describe('staircase', () => {
  it('3 fast correct → up, wrong → down, slow correct → reset only', () => {
    let s = { level: 5, streak: 0 }
    s = updateLevel(s, true, true); s = updateLevel(s, true, true); s = updateLevel(s, true, true)
    expect(s).toEqual({ level: 6, streak: 0 })
    s = updateLevel(s, false, true)
    expect(s.level).toBe(5)
    s = updateLevel({ level: 5, streak: 2 }, true, false)
    expect(s).toEqual({ level: 5, streak: 0 })
  })

  it('converges to roughly 80% accuracy for a simulated user', () => {
    // Simulated user: P(correct) falls off with level around an ability of 6.
    const rng = mulberry32(1)
    const pCorrect = (level: number) => 1 / (1 + Math.exp(level - 7.5))
    let s = { level: 5, streak: 0 }
    let correct = 0
    const N = 20000
    for (let i = 0; i < N; i++) {
      const ok = rng() < pCorrect(s.level)
      if (ok) correct++
      s = updateLevel(s, ok, true)
    }
    const acc = correct / N
    expect(acc).toBeGreaterThan(0.72)
    expect(acc).toBeLessThan(0.86)
  })

  it('daily set has 10 questions with 2 stretch above level', () => {
    const set = buildDailySet(defaultLevels(), {}, mulberry32(3))
    expect(set).toHaveLength(10)
    expect(set.filter((q) => q.level === 6)).toHaveLength(2)
  })
})
