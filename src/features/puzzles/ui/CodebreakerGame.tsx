import { useMemo, useRef, useState } from 'react'
import { seeded } from '../../../lib/rng'
import { COLOURS, MAX_GUESSES, PEGS, generateCode, score } from '../codebreaker'
import { type GameProps, fmtTime } from './common'
import { useTicker } from './useTicker'

// Each colour also carries a number, so the game never relies on colour alone.
const PALETTE = ['#e5484d', '#3987e5', '#2fb36b', '#f5b942', '#9b6cf0', '#e7e7e7']
const INK = ['#fff', '#fff', '#fff', '#111', '#fff', '#111']

function Peg({ c, onClick }: { c: number | null; onClick?: () => void }) {
  if (c === null) return <span className="peg empty" onClick={onClick} />
  return (
    <span className="peg" onClick={onClick} style={{ background: PALETTE[c], borderColor: PALETTE[c], color: INK[c], display: 'inline-grid', placeItems: 'center', fontWeight: 800, fontSize: 13, cursor: onClick ? 'pointer' : undefined }}>
      {c + 1}
    </span>
  )
}

export default function CodebreakerGame({ seed, onFinish }: GameProps) {
  const code = useMemo(() => generateCode(seeded(seed)), [seed])
  const [history, setHistory] = useState<{ guess: number[]; black: number; white: number }[]>([])
  const [cur, setCur] = useState<(number | null)[]>(Array(PEGS).fill(null))
  const [done, setDone] = useState<null | { solved: boolean }>(null)
  const start = useRef(performance.now())
  useTicker(!done)

  function add(c: number) {
    const i = cur.indexOf(null)
    if (i === -1 || done) return
    const next = [...cur]
    next[i] = c
    setCur(next)
  }

  function submit() {
    if (cur.includes(null) || done) return
    const guess = cur as number[]
    const s = score(code, guess)
    const h = [...history, { guess, ...s }]
    setHistory(h)
    setCur(Array(PEGS).fill(null))
    if (s.black === PEGS || h.length >= MAX_GUESSES) {
      const solved = s.black === PEGS
      setDone({ solved })
      onFinish({ solved, score: solved ? MAX_GUESSES + 1 - h.length : 0, ms: performance.now() - start.current, detail: { guesses: h.length } })
    }
  }

  return (
    <div className="stack-center">
      <div className="muted small mono">{fmtTime(performance.now() - start.current)} · guess {Math.min(history.length + 1, MAX_GUESSES)} of {MAX_GUESSES}</div>
      <div>
        {history.map((h, r) => (
          <div className="cb-row" key={r}>
            <span className="muted small mono" style={{ width: 18 }}>{r + 1}</span>
            {h.guess.map((c, i) => <Peg key={i} c={c} />)}
            <span className="keys" title={`${h.black} black, ${h.white} white`}>
              {Array.from({ length: PEGS }, (_, k) => <i key={k} className={k < h.black ? 'b' : k < h.black + h.white ? 'w' : ''} />)}
            </span>
            <span className="small muted mono">{h.black}● {h.white}○</span>
          </div>
        ))}
        {!done && (
          <div className="cb-row">
            <span style={{ width: 18 }} />
            {cur.map((c, i) => <Peg key={i} c={c} onClick={() => { const n = [...cur]; n[i] = null; setCur(n) }} />)}
          </div>
        )}
      </div>
      {!done && (
        <>
          <div className="row" style={{ justifyContent: 'center' }}>
            {Array.from({ length: COLOURS }, (_, c) => (
              <button key={c} className="ghost" style={{ padding: 4, border: 'none' }} onClick={() => add(c)}><Peg c={c} /></button>
            ))}
          </div>
          <div className="muted small">● = right colour, right place · ○ = right colour, wrong place. Click a placed peg to remove it. Colours can repeat.</div>
          <button className="primary" disabled={cur.includes(null)} onClick={submit}>Guess</button>
        </>
      )}
      {done && (
        <div className={`feedback ${done.solved ? 'ok' : 'no'}`}>
          <div className="row">
            <b>{done.solved ? `Cracked in ${history.length}.` : 'The code was:'}</b>
            {code.map((c, i) => <Peg key={i} c={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}
