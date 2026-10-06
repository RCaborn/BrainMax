import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta, markDaily, setMeta } from '../lib/db'
import { dayKey } from '../lib/day'
import { mulberry32 } from '../lib/rng'
import { CATEGORIES, type CategoryId, type Question, categoryName, isCorrect } from '../features/math/generators'
import { type Levels, type RecentAccuracy, buildDailySet, defaultLevels, drillQuestion, examQuestion, scoreAnswer, updateLevel } from '../features/math/engine'
import { fmt, parseAnswer } from '../features/math/format'

type Mode = 'daily' | 'exam' | 'drill'

const MODES: Record<Mode, { title: string; blurb: string; limitMs?: number; count?: number }> = {
  daily: { title: 'Daily 10', blurb: '10 adaptive questions: your 4 weakest areas, 4 mixed, 2 stretch. Worked shortcut after each miss.', count: 10 },
  exam: { title: 'Exam mode', blurb: '10 minutes, mixed questions at your level. Skip allowed. +1 right, −0.25 wrong (a common test convention; check your target firm’s rules).', limitMs: 600_000 },
  drill: { title: 'Speed drill', blurb: '80 quick-fire questions in 8 minutes, a couple of levels below your current level. Pure speed.', limitMs: 480_000, count: 80 },
}

interface Result {
  q: Question
  given: string
  correct: boolean
  skipped: boolean
  ms: number
}

async function loadLevels(): Promise<Levels> {
  const rows = await db.mathLevels.toArray()
  const levels = defaultLevels()
  for (const r of rows) if (r.category in levels) levels[r.category as CategoryId] = { level: r.level, streak: r.streak }
  return levels
}

async function loadRecentAccuracy(): Promise<RecentAccuracy> {
  const recent = await db.mathAttempts.orderBy('ts').reverse().limit(300).toArray()
  const acc: RecentAccuracy = {}
  for (const c of CATEGORIES) {
    const rows = recent.filter((a) => a.category === c.id && a.mode !== 'drill').slice(0, 20)
    if (rows.length >= 3) acc[c.id] = rows.filter((a) => a.correct).length / rows.length
  }
  return acc
}

export default function MathPage() {
  const [mode, setMode] = useState<Mode | null>(null)
  const today = dayKey()
  const status = useLiveQuery(() => db.daily.get(today), [today])
  const levelRows = useLiveQuery(() => db.mathLevels.toArray(), []) ?? []
  const drillBest = useLiveQuery(() => getMeta<number>('drillBest', 0), [])

  if (mode) return <MathSession mode={mode} onExit={() => setMode(null)} />

  const levelOf = (id: string) => levelRows.find((r) => r.category === id)?.level ?? 5
  return (
    <>
      <h1>Mental maths</h1>
      <p className="muted">Pitched at investment-banking numerical-test level. Difficulty adapts per skill to keep you at roughly 80% accuracy.</p>
      <div className="grid cols-3">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <div className="card" key={m} style={{ display: 'flex', flexDirection: 'column' }}>
            <h2>
              {MODES[m].title} {m === 'daily' && status?.math && <span className="pill accent">done today</span>}
            </h2>
            <p className="muted small" style={{ flex: 1 }}>{MODES[m].blurb}</p>
            {m === 'drill' && drillBest ? <p className="small">Personal best: <b>{drillBest}</b> correct</p> : null}
            <button className={m === 'daily' ? 'primary' : ''} onClick={() => setMode(m)}>Start</button>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Your levels</h2>
        <table>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="num" style={{ width: '50%' }}>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <div className="progress" style={{ flex: 1, maxWidth: 220 }}>
                      <div style={{ width: `${levelOf(c.id) * 10}%` }} />
                    </div>
                    <span className="mono">{levelOf(c.id)}/10</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function MathSession({ mode, onExit }: { mode: Mode; onExit: () => void }) {
  const cfg = MODES[mode]
  const rng = useMemo(() => mulberry32(Date.now() >>> 0), [])
  const sessionId = useMemo(() => Date.now(), [])
  const [levels, setLevels] = useState<Levels | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'answer' | 'feedback' | 'done'>('answer')
  const [results, setResults] = useState<Result[]>([])
  const [flash, setFlash] = useState<Result | null>(null)
  const [tick, setTick] = useState(0)
  const qStart = useRef(performance.now())
  const sessionStart = useRef(performance.now())
  const inputRef = useRef<HTMLInputElement>(null)
  const finished = useRef(false)

  useEffect(() => {
    void (async () => {
      const lv = await loadLevels()
      const acc = await loadRecentAccuracy()
      setLevels(lv)
      setQuestions(mode === 'daily' ? buildDailySet(lv, acc, rng) : [mode === 'exam' ? examQuestion(lv, rng) : drillQuestion(lv, rng)])
      qStart.current = performance.now()
      sessionStart.current = performance.now()
    })()
  }, [mode, rng])

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 100)
    return () => clearInterval(t)
  }, [])

  const elapsed = performance.now() - sessionStart.current
  const remaining = cfg.limitMs ? Math.max(0, cfg.limitMs - elapsed) : null
  void tick

  useEffect(() => {
    if (remaining === 0 && phase !== 'done' && levels) void finish(results)
  })

  useEffect(() => {
    inputRef.current?.focus()
  }, [idx, phase, questions.length])

  async function finish(all: Result[]) {
    if (finished.current) return
    finished.current = true
    setPhase('done')
    const answered = all.filter((r) => !r.skipped)
    const correct = answered.filter((r) => r.correct).length
    const score = all.reduce((s, r) => s + scoreAnswer(r.correct, r.ms, r.q.targetMs), 0)
    await db.mathSessions.add({
      day: dayKey(), ts: sessionId, mode, correct, total: all.length,
      totalMs: Math.round(performance.now() - sessionStart.current), score,
    })
    if (mode === 'daily' && all.length >= 10) await markDaily(dayKey(), { math: true })
    if (mode === 'drill') {
      const best = await getMeta<number>('drillBest', 0)
      if (correct > best) await setMeta('drillBest', correct)
    }
  }

  async function record(q: Question, given: string, correct: boolean, ms: number, skipped: boolean) {
    const r: Result = { q, given, correct, skipped, ms }
    const all = [...results, r]
    setResults(all)
    if (!skipped) {
      await db.mathAttempts.add({
        sessionId, ts: Date.now(), day: dayKey(), mode, category: q.category, level: q.level, prompt: q.prompt,
        answer: q.answer, given, correct, ms: Math.round(ms), targetMs: q.targetMs,
      })
    }
    if (mode !== 'drill' && levels && !skipped) {
      // Stretch questions only move the level when answered correctly.
      const cur = levels[q.category]
      const isStretch = q.level > cur.level
      const next = isStretch && !correct ? cur : updateLevel(cur, correct, ms <= q.targetMs)
      const updated = { ...levels, [q.category]: next }
      setLevels(updated)
      await db.mathLevels.put({ category: q.category, ...next })
    }
    return { r, all }
  }

  async function submit(skip = false) {
    if (phase !== 'answer' || !questions[idx]) return
    const q = questions[idx]
    const parsed = parseAnswer(input)
    if (!skip && parsed === null) return
    const ms = performance.now() - qStart.current
    const correct = !skip && isCorrect(q, parsed)
    const { r, all } = await record(q, input, correct, ms, skip)
    if (mode === 'daily') {
      setPhase('feedback')
      return
    }
    setFlash(r)
    if (cfg.count && all.length >= cfg.count) return finish(all)
    const lv = levels ?? defaultLevels()
    setQuestions((qs) => [...qs, mode === 'exam' ? examQuestion(lv, rng) : drillQuestion(lv, rng)])
    setIdx((i) => i + 1)
    setInput('')
    qStart.current = performance.now()
  }

  function next() {
    if (idx + 1 >= questions.length) return void finish(results)
    setIdx((i) => i + 1)
    setInput('')
    setPhase('answer')
    qStart.current = performance.now()
  }

  if (!levels || !questions.length) return <p className="muted">Loading…</p>
  if (phase === 'done') return <Summary mode={mode} results={results} onExit={onExit} />

  const q = questions[idx]
  const last = results[results.length - 1]
  const qMs = phase === 'answer' ? performance.now() - qStart.current : last?.ms ?? 0
  const pctTarget = Math.min(100, (qMs / q.targetMs) * 100)

  return (
    <div className="card stack-center">
      <div className="row between" style={{ width: '100%' }}>
        <span className="pill">{cfg.title}</span>
        <span className="muted small">{categoryName(q.category)} · L{q.level}</span>
        <span className="mono">
          {remaining !== null ? clock(remaining) : `${idx + 1} / ${questions.length}`}
          {mode === 'drill' ? ` · ${results.filter((r) => r.correct).length} ✓` : ''}
        </span>
      </div>
      <div className="progress" style={{ width: '100%' }}>
        <div style={{ width: `${pctTarget}%`, background: qMs > q.targetMs ? 'var(--warn)' : 'var(--accent)' }} />
      </div>
      <div className={`prompt ${q.prompt.length > 28 ? 'long' : ''}`}>{q.prompt}</div>
      {q.note && <div className="note">{q.note}</div>}
      <input
        ref={inputRef}
        className="answer-input"
        inputMode="decimal"
        autoComplete="off"
        value={input}
        readOnly={phase !== 'answer'}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (phase === 'answer') void submit()
          else next()
        }}
        placeholder="answer, then Enter"
      />
      <div className="muted small mono">
        {(qMs / 1000).toFixed(1)}s · target {(q.targetMs / 1000).toFixed(1)}s
      </div>
      {mode === 'exam' && phase === 'answer' && (
        <button className="ghost small" onClick={() => void submit(true)}>Skip</button>
      )}
      {phase === 'feedback' && last && (
        <div className={`feedback ${last.correct ? 'ok' : 'no'}`}>
          <b>{last.correct ? `✓ Correct, ${(last.ms / 1000).toFixed(1)}s` : `✗ Answer: ${q.display}`}</b>
          {last.correct && last.ms > q.targetMs && <span className="warn"> (over target time)</span>}
          <div className="small" style={{ marginTop: 6 }}>{q.hint}</div>
          <div className="muted small" style={{ marginTop: 8 }}>Press Enter to continue</div>
        </div>
      )}
      {flash && !flash.correct && phase === 'answer' && (
        <div className="muted small">
          {flash.skipped ? 'Skipped' : '✗'} {flash.q.prompt} = <b>{flash.q.display}</b>
        </div>
      )}
      <button className="ghost small" onClick={() => void finish(results)}>End session</button>
    </div>
  )
}

function Summary({ mode, results, onExit }: { mode: Mode; results: Result[]; onExit: () => void }) {
  const answered = results.filter((r) => !r.skipped)
  const correct = answered.filter((r) => r.correct).length
  const wrong = answered.length - correct
  const score = results.reduce((s, r) => s + scoreAnswer(r.correct, r.ms, r.q.targetMs), 0)
  const totalMs = results.reduce((s, r) => s + r.ms, 0)
  const misses = results.filter((r) => !r.correct)
  return (
    <>
      <div className="card">
        <h1>{MODES[mode].title}: done</h1>
        <div className="grid cols-3">
          <div className="stat"><div className="value">{correct}/{results.length}</div><div className="label">correct</div></div>
          {mode === 'exam' ? (
            <div className="stat"><div className="value">{fmt(correct - wrong * 0.25)}</div><div className="label">net score (−0.25 per wrong)</div></div>
          ) : (
            <div className="stat"><div className="value">{score}</div><div className="label">speed-weighted points</div></div>
          )}
          <div className="stat"><div className="value">{(totalMs / 1000 / Math.max(1, results.length)).toFixed(1)}s</div><div className="label">avg per question</div></div>
        </div>
      </div>
      {misses.length > 0 && (
        <div className="card">
          <h2>Review your misses</h2>
          <table>
            <thead><tr><th>Question</th><th>You</th><th>Answer</th><th>Shortcut</th></tr></thead>
            <tbody>
              {misses.map((r, i) => (
                <tr key={i}>
                  <td>{r.q.prompt}</td>
                  <td className="bad mono">{r.skipped ? 'skipped' : r.given}</td>
                  <td className="mono">{r.q.display}</td>
                  <td className="small muted">{r.q.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button className="primary" onClick={onExit}>Back</button>
    </>
  )
}

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
