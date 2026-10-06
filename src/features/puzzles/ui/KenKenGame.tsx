import { useEffect, useMemo, useRef, useState } from 'react'
import { randInt, seeded } from '../../../lib/rng'
import { generateKenKen } from '../kenken'
import { type GameProps, fmtTime } from './common'
import { useTicker } from './useTicker'

export default function KenKenGame({ seed, onFinish, big }: GameProps & { big: boolean }) {
  const puzzle = useMemo(() => {
    const rng = seeded(seed)
    return generateKenKen(big ? 6 : randInt(rng, 4, 5), rng)
  }, [seed, big])
  const { n, cages, solution } = puzzle
  const [grid, setGrid] = useState<number[]>(() => Array(n * n).fill(0))
  const [sel, setSel] = useState(0)
  const [errors, setErrors] = useState<Set<number>>(new Set())
  const [checks, setChecks] = useState(0)
  const [done, setDone] = useState<null | { solved: boolean }>(null)
  const start = useRef(performance.now())
  const boardRef = useRef<HTMLDivElement>(null)
  useTicker(!done)

  const cageOf = useMemo(() => {
    const m = Array(n * n).fill(0)
    cages.forEach((c, i) => c.cells.forEach((x) => (m[x] = i)))
    return m
  }, [cages, n])
  const labelAt = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of cages) m.set(Math.min(...c.cells), c.op === '=' ? String(c.target) : `${c.target}${c.op}`)
    return m
  }, [cages])

  useEffect(() => boardRef.current?.focus(), [])

  function finish(solved: boolean) {
    setDone({ solved })
    const score = solved ? Math.max(1, 10 - checks * 2) : 0
    onFinish({ solved, score, ms: performance.now() - start.current, detail: { n, checks } })
  }

  function setCell(i: number, v: number) {
    if (done) return
    const g = [...grid]
    g[i] = v
    setGrid(g)
    setErrors(new Set())
    if (g.every((x, k) => x === solution[k])) finish(true)
  }

  function onKey(e: React.KeyboardEvent) {
    const r = Math.floor(sel / n)
    const c = sel % n
    if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) setCell(sel, Number(e.key))
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') setCell(sel, 0)
    else if (e.key === 'ArrowUp') setSel(((r + n - 1) % n) * n + c)
    else if (e.key === 'ArrowDown') setSel(((r + 1) % n) * n + c)
    else if (e.key === 'ArrowLeft') setSel(r * n + ((c + n - 1) % n))
    else if (e.key === 'ArrowRight') setSel(r * n + ((c + 1) % n))
    else return
    e.preventDefault()
  }

  function check() {
    setChecks(checks + 1)
    setErrors(new Set(grid.flatMap((v, i) => (v && v !== solution[i] ? [i] : []))))
  }

  const shown = done && !done.solved ? solution : grid
  return (
    <div className="stack-center">
      <div className="muted small mono">{fmtTime(performance.now() - start.current)} · {n}×{n} · checks used {checks}</div>
      <div
        ref={boardRef}
        tabIndex={0}
        onKeyDown={onKey}
        className="kk"
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, outline: 'none' }}
      >
        {shown.map((v, i) => {
          const r = Math.floor(i / n)
          const c = i % n
          const cls = [
            'kk-cell',
            i === sel && !done ? 'sel' : '',
            errors.has(i) ? 'err' : '',
            r > 0 && cageOf[i - n] !== cageOf[i] ? 'bt' : '',
            c > 0 && cageOf[i - 1] !== cageOf[i] ? 'bl' : '',
          ].join(' ')
          return (
            <div key={i} className={cls} onClick={() => { setSel(i); boardRef.current?.focus() }}>
              {labelAt.has(i) && <span className="lbl">{labelAt.get(i)}</span>}
              {v || ''}
            </div>
          )
        })}
      </div>
      {!done && (
        <>
          <div className="row" style={{ justifyContent: 'center' }}>
            {Array.from({ length: n }, (_, k) => (
              <button key={k} className="tile" style={{ minWidth: 44, padding: '8px 0' }} onClick={() => setCell(sel, k + 1)}>{k + 1}</button>
            ))}
            <button className="tile" style={{ minWidth: 44, padding: '8px 0' }} onClick={() => setCell(sel, 0)}>⌫</button>
          </div>
          <div className="muted small">Click a cell, type a number. Arrow keys move. Each check costs 2 points.</div>
          <div className="row">
            <button onClick={check}>Check</button>
            <button className="ghost" onClick={() => finish(false)}>Give up</button>
          </div>
        </>
      )}
      {done && (
        <div className={`feedback ${done.solved ? 'ok' : 'no'}`}>
          {done.solved ? `Solved in ${fmtTime(performance.now() - start.current)}.` : 'Solution shown above.'}
        </div>
      )}
    </div>
  )
}
