import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta, markDaily, setMeta } from '../lib/db'
import { dayKey } from '../lib/day'
import { mulberry32 } from '../lib/rng'
import { CATEGORIES, type CategoryId, type Question, categoryName, isCorrect, parseFor, rungCount, rungOf, tierOf } from '../features/math/generators'
import { type Levels, PREREQS, UNLOCK_LEVEL, buildDailySet, drillQuestion, examQuestion, scoreAnswer, unlockedSkills, updateLevel } from '../features/math/engine'
import { type UnlockState, loadLevels, loadRecentAccuracy, markLessonSeen, saveLevel, syncUnlocks } from '../features/math/progress'
import { LESSONS } from '../features/math/lessons'
import { fmt } from '../features/math/format'

type Mode = 'daily' | 'exam' | 'drill'

const MODES: Record<Mode, { title: string; blurb: string; limitMs?: number; count?: number }> = {
  daily: { title: 'Daily 10', blurb: '10 adaptive questions from your unlocked skills: every skill at least once, extra practice where you are weakest, 2 stretch questions one rung up. Worked shortcut after each miss.', count: 10 },
  exam: { title: 'Exam mode', blurb: '10 minutes, mixed questions at your current rungs. Skip allowed. +1 right, −0.25 wrong (a common test convention; check your target firm’s rules).', limitMs: 600_000 },
  drill: { title: 'Speed drill', blurb: '80 quick-fire questions in 8 minutes, two rungs below where you are. Pure speed.', limitMs: 480_000, count: 80 },
}

interface Result {
  q: Question
  given: string
  correct: boolean
  skipped: boolean
  ms: number
}

export default function MathPage() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [lesson, setLesson] = useState<CategoryId | null>(null)
  const [state, setState] = useState<{ levels: Levels; unlock: UnlockState } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const today = dayKey()
  const status = useLiveQuery(() => db.daily.get(today), [today])
  const drillBest = useLiveQuery(() => getMeta<number>('drillBest', 0), [])

  useEffect(() => {
    void (async () => {
      const levels = await loadLevels()
      setState({ levels, unlock: await syncUnlocks(levels) })
    })()
  }, [refresh, mode])

  if (mode) return <MathSession mode={mode} onExit={() => { setMode(null); setRefresh((n) => n + 1) }} />
  if (!state) return <p className="muted">Loading…</p>
  if (lesson) {
    return <LessonView cat={lesson} onClose={() => { void markLessonSeen(lesson).then(() => setRefresh((n) => n + 1)); setLesson(null) }} />
  }

  const { levels, unlock } = state
  const fresh = unlock.unreadLessons.filter((c) => unlock.newToday.includes(c))
  return (
    <>
      <h1>Mental maths</h1>
      <p className="muted">
        A ladder for each skill, from warm-up to investment-banking test level. You start at the bottom with a fast start
        (one rung up per quick correct answer until your first miss), then it settles at about 80% accuracy.
      </p>
      {fresh.map((c) => (
        <div key={c} className="card feedback ok row between">
          <span><b>New skill unlocked: {categoryName(c)}.</b> Read the 1-minute lesson before your next Daily 10.</span>
          <button className="primary small" onClick={() => setLesson(c)}>Read lesson</button>
        </div>
      ))}
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
      <SkillPath levels={levels} unlocked={unlock.unlocked} unread={unlock.unreadLessons} onLesson={setLesson} />
    </>
  )
}

function SkillPath({ levels, unlocked, unread, onLesson }: { levels: Levels; unlocked: CategoryId[]; unread: CategoryId[]; onLesson: (c: CategoryId) => void }) {
  const order = [...CATEGORIES.map((c) => c.id)].sort((a, b) => Number(unlocked.includes(b)) - Number(unlocked.includes(a)))
  return (
    <div className="card">
      <h2>Your skill path</h2>
      <p className="muted small">Skills unlock once their building blocks reach rung {UNLOCK_LEVEL} (the end of the on-ramp).</p>
      <table>
        <tbody>
          {order.map((c) => {
            const open = unlocked.includes(c)
            const lv = levels[c]
            const n = rungCount(c)
            return (
              <tr key={c} style={{ opacity: open ? 1 : 0.55 }}>
                <td>
                  <div><b>{categoryName(c)}</b> {open && unread.includes(c) && <span className="pill accent">new lesson</span>}</div>
                  <div className="muted small">
                    {open
                      ? `Rung ${lv.level} of ${n} · ${tierOf(c, lv.level)} · ${rungOf(c, lv.level).title}${lv.calibrating ? ' · fast start' : ''}`
                      : `Locked: needs ${PREREQS[c].map((p) => `${categoryName(p)} (rung ${Math.min(levels[p].level, UNLOCK_LEVEL)}/${UNLOCK_LEVEL})`).join(' and ')}`}
                  </div>
                </td>
                <td className="num" style={{ width: '38%' }}>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <div className="progress" style={{ flex: 1, maxWidth: 200 }}>
                      <div style={{ width: `${open ? (lv.level / n) * 100 : 0}%` }} />
                    </div>
                    {open && <button className="small ghost" onClick={() => onLesson(c)}>Lesson</button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LessonView({ cat, onClose }: { cat: CategoryId; onClose: () => void }) {
  const l = LESSONS[cat]
  return (
    <div className="card">
      <span className="pill accent">Lesson</span>
      <h1 style={{ marginTop: 10 }}>{categoryName(cat)}</h1>
      <p><b>{l.idea}</b></p>
      <ul>
        {l.moves.map((m) => <li key={m} style={{ marginBottom: 6 }}>{m}</li>)}
      </ul>
      <div className="feedback meh"><b>Worked example.</b> {l.example}</div>
      <p />
      <button className="primary" onClick={onClose}>Got it</button>
    </div>
  )
}

function MathSession({ mode, onExit }: { mode: Mode; onExit: () => void }) {
  const cfg = MODES[mode]
  const rng = useMemo(() => mulberry32(Date.now() >>> 0), [])
  const sessionId = useMemo(() => Date.now(), [])
  const [levels, setLevels] = useState<Levels | null>(null)
  const [unlocked, setUnlocked] = useState<CategoryId[]>([])
  const [newUnlocks, setNewUnlocks] = useState<CategoryId[]>([])
  // Levels change after every answer; a ref avoids stale state when answers come quickly.
  const levelsRef = useRef<Levels | null>(null)
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
      const u = await syncUnlocks(lv)
      setLevels(lv)
      levelsRef.current = lv
      setUnlocked(u.unlocked)
      setQuestions(mode === 'daily' ? buildDailySet(lv, acc, u.unlocked, u.newToday, rng) : [mode === 'exam' ? examQuestion(lv, u.unlocked, rng) : drillQuestion(lv, u.unlocked, rng)])
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
    if (levelsRef.current) {
      const now = unlockedSkills(levelsRef.current)
      setNewUnlocks(now.filter((c) => !unlocked.includes(c)))
      await syncUnlocks(levelsRef.current)
    }
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
    const lv = levelsRef.current
    if (mode !== 'drill' && lv && !skipped) {
      // Stretch questions only move the level when answered correctly.
      const cat = q.category as CategoryId
      const cur = lv[cat]
      const isStretch = q.level > cur.level
      const next = isStretch && !correct ? cur : updateLevel(cat, cur, correct, ms, q.targetMs)
      const updated = { ...lv, [cat]: next }
      levelsRef.current = updated
      setLevels(updated)
      await saveLevel(cat, next)
    }
    return { r, all }
  }

  async function submit(skip = false) {
    if (phase !== 'answer' || !questions[idx]) return
    const q = questions[idx]
    const parsed = parseFor(q, input)
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
    const lv = levelsRef.current!
    setQuestions((qs) => [...qs, mode === 'exam' ? examQuestion(lv, unlocked, rng) : drillQuestion(lv, unlocked, rng)])
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
  if (phase === 'done') return <Summary mode={mode} results={results} newUnlocks={newUnlocks} onExit={onExit} />

  const q = questions[idx]
  const last = results[results.length - 1]
  const qMs = phase === 'answer' ? performance.now() - qStart.current : last?.ms ?? 0
  const pctTarget = Math.min(100, (qMs / q.targetMs) * 100)

  return (
    <div className="card stack-center">
      <div className="row between" style={{ width: '100%' }}>
        <span className="pill">{cfg.title}</span>
        <span className="muted small">{categoryName(q.category)} · rung {q.level}/{rungCount(q.category as CategoryId)} · {q.tier}</span>
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
        inputMode={q.fractionOver ? 'text' : 'decimal'}
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

function Summary({ mode, results, newUnlocks, onExit }: { mode: Mode; results: Result[]; newUnlocks: CategoryId[]; onExit: () => void }) {
  const answered = results.filter((r) => !r.skipped)
  const correct = answered.filter((r) => r.correct).length
  const wrong = answered.length - correct
  const score = results.reduce((s, r) => s + scoreAnswer(r.correct, r.ms, r.q.targetMs), 0)
  const totalMs = results.reduce((s, r) => s + r.ms, 0)
  const misses = results.filter((r) => !r.correct)
  return (
    <>
      {newUnlocks.map((c) => (
        <div key={c} className="card feedback ok">
          <b>New skill unlocked: {categoryName(c)}!</b> There's a 1-minute lesson waiting on the Maths page, and it gets extra slots in tomorrow's Daily 10.
        </div>
      ))}
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
