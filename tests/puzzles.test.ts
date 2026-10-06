import { describe, expect, it } from 'vitest'
import { generateCountdown, solveAll } from '../src/features/puzzles/countdown'
import { countSolutions, generateKenKen } from '../src/features/puzzles/kenken'
import { score } from '../src/features/puzzles/codebreaker'
import { markGuess, FIVE_LETTER } from '../src/features/puzzles/wordle'
import { FERMI_BANK, fermiRound } from '../src/features/puzzles/fermi'
import { puzzleForDay } from '../src/features/puzzles/rotation'
import { seeded } from '../src/lib/rng'
import { addDays } from '../src/lib/day'

const evalExpr = (e: string) => Function(`return (${e.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')})`)() as number

describe('countdown', () => {
  it('solver finds classic solutions', () => {
    const all = solveAll([25, 50, 75, 100, 3, 6])
    expect(all.has(952)).toBe(true)
    expect(evalExpr(all.get(952)!.expr)).toBe(952)
  })
  it('a year of daily puzzles are all exactly solvable with a valid shown solution', () => {
    let day = '2026-01-01'
    for (let i = 0; i < 365; i++) {
      const hard = i % 7 === 6
      const p = generateCountdown(seeded(`countdown:${day}`), hard)
      expect(p.target).toBeGreaterThanOrEqual(101)
      expect(p.target).toBeLessThanOrEqual(999)
      expect(evalExpr(p.solution), `${day} ${p.solution}`).toBe(p.target)
      // Each number used at most as often as dealt.
      const used = (p.solution.match(/\d+/g) ?? []).map(Number)
      const pool = [...p.numbers]
      for (const u of used) {
        const k = pool.indexOf(u)
        expect(k, `${p.solution} uses ${u} too often`).toBeGreaterThanOrEqual(0)
        pool.splice(k, 1)
      }
      if (hard) expect(p.minNumbers).toBeGreaterThanOrEqual(5)
      day = addDays(day, 1)
    }
  }, 120_000)
})

describe('kenken', () => {
  it.each([4, 5, 6])('%i×%i puzzles have exactly one solution which satisfies every cage', (n) => {
    for (let i = 0; i < (n === 6 ? 15 : 40); i++) {
      const k = generateKenKen(n, seeded(`kk${n}:${i}`))
      expect(countSolutions(k.n, k.cages, 2)).toBe(1)
      for (const cage of k.cages) {
        const v = cage.cells.map((c) => k.solution[c])
        const ok = {
          '=': v[0] === cage.target,
          '+': v.reduce((a, b) => a + b, 0) === cage.target,
          '×': v.reduce((a, b) => a * b, 1) === cage.target,
          '−': Math.abs(v[0] - v[1]) === cage.target,
          '÷': Math.max(...v) === cage.target * Math.min(...v),
        }[cage.op]
        expect(ok).toBe(true)
      }
    }
  }, 120_000)
})

describe('codebreaker', () => {
  it('scores black and white pegs with repeats', () => {
    expect(score([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ black: 4, white: 0 })
    expect(score([0, 0, 1, 1], [1, 1, 0, 0])).toEqual({ black: 0, white: 4 })
    expect(score([0, 1, 1, 2], [1, 1, 1, 1])).toEqual({ black: 2, white: 0 })
    expect(score([0, 1, 2, 3], [3, 0, 5, 5])).toEqual({ black: 0, white: 2 })
  })
})

describe('wordle', () => {
  it('marks repeated letters correctly', () => {
    expect(markGuess('perro', 'error')).toEqual(['present', 'present', 'hit', 'present', 'miss'])
    expect(markGuess('casas', 'sacos')).toEqual(['present', 'hit', 'present', 'miss', 'hit'])
  })
  it('has plenty of 5-letter answers', () => expect(FIVE_LETTER.length).toBeGreaterThan(150))
})

describe('fermi + rotation', () => {
  it('bank ids unique and rounds have 5 distinct questions', () => {
    expect(new Set(FERMI_BANK.map((q) => q.id)).size).toBe(FERMI_BANK.length)
    expect(new Set(fermiRound(3).map((q) => q.id)).size).toBe(5)
  })
  it('one puzzle per weekday, Monday is Countdown', () => {
    expect(puzzleForDay('2026-10-05')).toBe('countdown') // a Monday
    expect(puzzleForDay('2026-10-10')).toBe('countdown-hard')
    expect(puzzleForDay('2026-10-11')).toBe('kenken-6')
  })
})
