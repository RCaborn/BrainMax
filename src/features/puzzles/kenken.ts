import { type Rng, shuffle, randInt } from '../../lib/rng'

export type Op = '+' | '−' | '×' | '÷' | '='
export interface Cage {
  cells: number[] // indices r*n+c
  op: Op
  target: number
}
export interface KenKen {
  n: number
  cages: Cage[]
  solution: number[]
}

function latinSquare(n: number, rng: Rng): number[] {
  const rows = shuffle(rng, [...Array(n).keys()])
  const cols = shuffle(rng, [...Array(n).keys()])
  const syms = shuffle(rng, [...Array(n).keys()].map((i) => i + 1))
  const grid: number[] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) grid.push(syms[(rows[r] + cols[c]) % n])
  return grid
}

function makeCages(n: number, sol: number[], rng: Rng): Cage[] {
  const owner = new Array(n * n).fill(-1)
  const cages: Cage[] = []
  const order = shuffle(rng, [...Array(n * n).keys()])
  for (const start of order) {
    if (owner[start] !== -1) continue
    const roll = rng()
    const size = roll < 0.08 ? 1 : roll < 0.55 ? 2 : roll < 0.88 ? 3 : 4
    const cells = [start]
    owner[start] = cages.length
    while (cells.length < size) {
      const frontier: number[] = []
      for (const c of cells) {
        const r = Math.floor(c / n)
        const col = c % n
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr
          const cc = col + dc
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && owner[rr * n + cc] === -1) frontier.push(rr * n + cc)
        }
      }
      if (!frontier.length) break
      const next = frontier[Math.floor(rng() * frontier.length)]
      owner[next] = cages.length
      cells.push(next)
    }
    const vals = cells.map((c) => sol[c])
    let op: Op
    let target: number
    if (cells.length === 1) {
      op = '='
      target = vals[0]
    } else if (cells.length === 2) {
      const [hi, lo] = vals[0] >= vals[1] ? vals : [vals[1], vals[0]]
      const r = rng()
      if (hi % lo === 0 && r < 0.4) { op = '÷'; target = hi / lo }
      else if (r < 0.7) { op = '−'; target = hi - lo }
      else if (r < 0.85) { op = '+'; target = hi + lo }
      else { op = '×'; target = hi * lo }
    } else if (rng() < 0.5) {
      op = '+'
      target = vals.reduce((a, b) => a + b, 0)
    } else {
      op = '×'
      target = vals.reduce((a, b) => a * b, 1)
    }
    cages.push({ cells, op, target })
  }
  return cages
}

function cageOk(cage: Cage, vals: number[], complete: boolean): boolean {
  switch (cage.op) {
    case '=': return vals[0] === cage.target
    case '+': { const s = vals.reduce((a, b) => a + b, 0); return complete ? s === cage.target : s < cage.target + 1 }
    case '×': { const p = vals.reduce((a, b) => a * b, 1); return complete ? p === cage.target : cage.target % p === 0 }
    case '−': return !complete || Math.abs(vals[0] - vals[1]) === cage.target
    case '÷': { if (!complete) return true; const [a, b] = vals; return Math.max(a, b) === cage.target * Math.min(a, b) }
  }
}

/** Counts solutions up to `limit` (backtracking with row/column and cage pruning). */
export function countSolutions(n: number, cages: Cage[], limit = 2): number {
  const grid = new Array(n * n).fill(0)
  const cageOf = new Array(n * n)
  cages.forEach((cg, i) => cg.cells.forEach((c) => (cageOf[c] = i)))
  let found = 0
  const step = (idx: number): void => {
    if (found >= limit) return
    if (idx === n * n) { found++; return }
    const r = Math.floor(idx / n)
    const c = idx % n
    for (let v = 1; v <= n; v++) {
      let clash = false
      for (let k = 0; k < n && !clash; k++) clash = grid[r * n + k] === v || grid[k * n + c] === v
      if (clash) continue
      grid[idx] = v
      const cage = cages[cageOf[idx]]
      const vals = cage.cells.map((x) => grid[x]).filter((x) => x > 0)
      if (cageOk(cage, vals, vals.length === cage.cells.length)) step(idx + 1)
      grid[idx] = 0
    }
  }
  step(0)
  return found
}

export function generateKenKen(n: number, rng: Rng): KenKen {
  for (let attempt = 0; attempt < 500; attempt++) {
    const solution = latinSquare(n, rng)
    const cages = makeCages(n, solution, rng)
    if (cages.filter((c) => c.op === '=').length > Math.max(1, Math.floor(n / 2))) continue
    if (countSolutions(n, cages, 2) === 1) return { n, cages, solution }
  }
  throw new Error('Could not generate a unique KenKen')
}

export const kenkenSizeFor = (weekdayIdx: number, rng: Rng) => (weekdayIdx === 0 ? 6 : randInt(rng, 4, 5))
