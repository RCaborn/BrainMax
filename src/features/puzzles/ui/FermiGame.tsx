import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../lib/db'
import { dayKey } from '../../../lib/day'
import { fmt, parseAnswer } from '../../math/format'
import { type FermiQ, isHit } from '../fermi'
import type { GameProps } from './common'

export default function FermiGame({ questions, onFinish }: GameProps & { questions: FermiQ[] }) {
  const [vals, setVals] = useState(() => questions.map(() => ({ low: '', high: '' })))
  const [done, setDone] = useState<null | boolean[]>(null)
  const start = useRef(performance.now())
  const history = useLiveQuery(() => db.fermi.toArray(), []) ?? []

  const parsed = vals.map((v) => ({ low: parseAnswer(v.low), high: parseAnswer(v.high) }))
  const ready = parsed.every((p) => p.low !== null && p.high !== null)

  async function submit() {
    if (!ready || done) return
    const hits = questions.map((q, i) => isHit(q, parsed[i].low!, parsed[i].high!))
    setDone(hits)
    const day = dayKey()
    await db.fermi.bulkAdd(questions.map((q, i) => ({ day, qid: q.id, low: parsed[i].low!, high: parsed[i].high!, answer: q.answer, hit: hits[i], ts: Date.now() })))
    const n = hits.filter(Boolean).length
    onFinish({ solved: true, score: n, ms: performance.now() - start.current, detail: { hits: n } })
  }

  const total = history.length
  const hitRate = total ? history.filter((h) => h.hit).length / total : null

  return (
    <div>
      <p className="muted small">
        For each one, give a low and high bound you're <b>90% confident</b> contains the true value. Wide ranges are fine;
        the goal is honest uncertainty. Suffixes k / m / bn work.
      </p>
      <table>
        <thead><tr><th>Question</th><th>Low</th><th>High</th>{done && <th>Answer</th>}</tr></thead>
        <tbody>
          {questions.map((q, i) => (
            <tr key={q.id}>
              <td>{q.q} <span className="muted small">({q.unit})</span></td>
              {(['low', 'high'] as const).map((k) => (
                <td key={k} style={{ width: 120 }}>
                  <input
                    style={{ width: '100%' }}
                    value={vals[i][k]}
                    disabled={!!done}
                    inputMode="decimal"
                    onChange={(e) => setVals(vals.map((v, j) => (j === i ? { ...v, [k]: e.target.value } : v)))}
                  />
                </td>
              ))}
              {done && <td className={done[i] ? 'good' : 'bad'}>{done[i] ? '✓' : '✗'} {fmt(q.answer)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <p />
      {!done && <button className="primary" disabled={!ready} onClick={() => void submit()}>Reveal answers</button>}
      {done && (
        <div className="feedback meh">
          <b>{done.filter(Boolean).length} of {questions.length} inside your ranges.</b>{' '}
          {hitRate !== null && (
            <>All-time hit rate: <b>{Math.round(hitRate * 100)}%</b> over {total} answers (target 90%).{' '}
              {total >= 20 && (hitRate < 0.8 ? 'You are overconfident: widen your ranges.' : hitRate > 0.97 ? 'You are underconfident: tighten your ranges.' : 'Well calibrated.')}</>
          )}
        </div>
      )}
    </div>
  )
}
