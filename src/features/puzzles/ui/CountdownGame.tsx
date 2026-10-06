import { useMemo, useRef, useState } from 'react'
import { seeded } from '../../../lib/rng'
import { countdownScore, generateCountdown } from '../countdown'
import { type GameProps, fmtTime } from './common'
import { useTicker } from './useTicker'

type Op = '+' | '−' | '×' | '÷'
interface Tile { id: number; value: number; used: boolean }
interface Step { aId: number; bId: number; tile: number; text: string }

export default function CountdownGame({ seed, onFinish, hard }: GameProps & { hard: boolean }) {
  const puzzle = useMemo(() => generateCountdown(seeded(seed), hard), [seed, hard])
  const initial = () => puzzle.numbers.map((value, id) => ({ id, value, used: false }))
  const [tiles, setTiles] = useState<Tile[]>(initial)
  const [steps, setSteps] = useState<Step[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<null | { best: number; score: number }>(null)
  const start = useRef(performance.now())
  useTicker(!done)

  const best = tiles.reduce((b, t) => (Math.abs(t.value - puzzle.target) < Math.abs(b - puzzle.target) ? t.value : b), tiles[0].value)

  function finish(bestValue: number) {
    const score = countdownScore(puzzle.target, bestValue)
    setDone({ best: bestValue, score })
    onFinish({ solved: bestValue === puzzle.target, score, ms: performance.now() - start.current, detail: { best: bestValue, steps: steps.map((s) => s.text) } })
  }

  function clickTile(t: Tile) {
    if (done || t.used) return
    setError('')
    if (sel === null || op === null) return setSel(t.id === sel ? null : t.id)
    if (t.id === sel) return
    const a = tiles.find((x) => x.id === sel)!.value
    const b = t.value
    let v: number
    if (op === '+') v = a + b
    else if (op === '×') v = a * b
    else if (op === '−') v = a - b
    else v = a / b
    if (v <= 0 || !Number.isInteger(v)) {
      setError(op === '−' ? 'Results must stay positive.' : 'Division must come out whole.')
      return
    }
    const id = Math.max(...tiles.map((x) => x.id)) + 1
    const next = tiles.map((x) => (x.id === sel || x.id === t.id ? { ...x, used: true } : x)).concat({ id, value: v, used: false })
    setTiles(next)
    setSteps([...steps, { aId: sel, bId: t.id, tile: id, text: `${a} ${op} ${b} = ${v}` }])
    setSel(null)
    setOp(null)
    if (v === puzzle.target) finish(v)
  }

  function undo() {
    const last = steps[steps.length - 1]
    if (!last || done) return
    const restored = tiles
      .filter((t) => t.id !== last.tile)
      .map((t) => (t.id === last.aId || t.id === last.bId ? { ...t, used: false } : t))
    setTiles(restored)
    setSteps(steps.slice(0, -1))
  }

  return (
    <div className="stack-center">
      <div className="target">{puzzle.target}</div>
      <div className="muted small mono">{fmtTime(performance.now() - start.current)} {hard ? '· hard' : ''}</div>
      <div className="tiles">
        {tiles.filter((t) => !t.used).map((t) => (
          <button key={t.id} className={`tile ${sel === t.id ? 'sel' : ''}`} onClick={() => clickTile(t)}>{t.value}</button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {(['+', '−', '×', '÷'] as Op[]).map((o) => (
          <button key={o} className={`tile ${op === o ? 'sel' : ''}`} disabled={sel === null || !!done} onClick={() => setOp(op === o ? null : o)}>{o}</button>
        ))}
      </div>
      <div className="muted small">Pick a number, an operation, then another number.</div>
      {error && <div className="bad small">{error}</div>}
      {steps.length > 0 && <div className="mono small">{steps.map((s) => s.text).join('  ·  ')}</div>}
      {!done && (
        <div className="row">
          <button onClick={undo} disabled={!steps.length}>Undo</button>
          <button onClick={() => { setTiles(initial()); setSteps([]); setSel(null); setOp(null) }}>Reset</button>
          <button className="primary" onClick={() => finish(best)}>Done (closest: {best})</button>
        </div>
      )}
      {done && (
        <div className={`feedback ${done.best === puzzle.target ? 'ok' : 'meh'}`}>
          <b>{done.best === puzzle.target ? 'Exact! 10 points.' : `You got ${done.best}, ${Math.abs(done.best - puzzle.target)} away: ${done.score} points.`}</b>
          <div className="small">One solution: <span className="mono">{puzzle.solution} = {puzzle.target}</span></div>
        </div>
      )}
    </div>
  )
}
