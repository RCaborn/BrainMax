import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../lib/db'
import { addDays, dayKey, now } from '../lib/day'
import { streak, bestStreak, tasksDone, placementKnown, readGeoLaunch, taskCount } from '../lib/progress'
import { GeoSection } from '../features/geo/GeoStats'
import { recallEstimate } from '../features/spanish/scheduler'
import { WORD_BY_ID, TOTAL_WORDS, spanishDisplay } from '../features/spanish/words'
import { CATEGORIES, type CategoryId, rungCount, targetMsFor, tierOf } from '../features/math/generators'
import { unlockedSkills, defaultLevels } from '../features/math/engine'
import { PUZZLE_INFO, type PuzzleType } from '../features/puzzles/rotation'
import { fmtTime } from '../features/puzzles/ui/common'

function useColors() {
  return useMemo(() => {
    const s = getComputedStyle(document.documentElement)
    const v = (n: string) => s.getPropertyValue(n).trim()
    return {
      s1: v('--series-1'), s2: v('--series-2'), s3: v('--series-3'),
      grid: v('--border'), muted: v('--muted'), text: v('--text'),
      seq: [v('--seq-0'), v('--seq-1'), v('--seq-2'), v('--seq-3')],
    }
  }, [])
}

const shortDay = (d: string) => d.slice(5)
const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function Tip({ active, payload, label, unit = '' }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="muted small">{label}</div>
      {payload.map((p) => (
        <div key={p.name}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.color, marginRight: 6 }} />
          {p.name}: <b>{Math.round(p.value * 10) / 10}{unit}</b>
        </div>
      ))}
    </div>
  )
}

const Empty = ({ text = 'No data yet. Do a session and come back.' }) => <p className="muted small">{text}</p>

export default function StatsPage() {
  const c = useColors()
  const data = useLiveQuery(async () => ({
    days: await db.daily.toArray(),
    snapshots: await db.snapshots.orderBy('day').toArray(),
    cards: await db.cards.toArray(),
    reviews: await db.reviews.toArray(),
    sessions: await db.mathSessions.orderBy('ts').toArray(),
    attempts: await db.mathAttempts.toArray(),
    levels: await db.mathLevels.toArray(),
    puzzles: await db.puzzles.toArray(),
    fermi: await db.fermi.toArray(),
    known: await placementKnown(),
    geoLaunch: await readGeoLaunch(),
    geoCards: await db.geoCards.toArray(),
    geoReviews: await db.geoReviews.toArray(),
  }), [])

  if (!data) return <p className="muted">Loading…</p>
  const today = dayKey()
  const t = now()
  const axis = { stroke: c.grid, tick: { fill: c.muted, fontSize: 12 }, tickLine: false }

  // --- headline numbers
  const recall = recallEstimate(data.cards, data.known, t)
  const production = data.cards.filter((x) => x.dir === 'p' && x.stability >= 7).length
  const lvOf = (id: CategoryId) => data.levels.find((l) => l.category === id)?.level ?? 1
  const ladderPct = Math.round((CATEGORIES.reduce((s, c) => s + lvOf(c.id) / rungCount(c.id), 0) / CATEGORIES.length) * 100)
  const activeDays = data.days.filter((d) => tasksDone(d) > 0).length

  // --- heatmap: 53 weeks ending this week
  const byDay = new Map(data.days.map((d) => [d.day, d]))
  const startOffset = 52 * 7 + new Date().getDay()
  const cells = Array.from({ length: startOffset + 1 }, (_, i) => addDays(today, i - startOffset))

  // --- spanish
  const reviewDays = new Map<string, { ok: number; n: number }>()
  for (const r of data.reviews) {
    const s = reviewDays.get(r.day) ?? { ok: 0, n: 0 }
    s.n++
    if (r.result !== 'wrong') s.ok++
    reviewDays.set(r.day, s)
  }
  const accuracySeries = [...reviewDays].sort().map(([day, s]) => ({ day: shortDay(day), Accuracy: (s.ok / s.n) * 100 }))
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i)
    const end = new Date(t.getTime() + (i + 1) * 86_400_000).getTime()
    const startT = i === 0 ? 0 : new Date(t.getTime() + i * 86_400_000).getTime()
    return { day: i === 0 ? 'today' : shortDay(d), Due: data.cards.filter((x) => x.due > startT && x.due <= end && x.state !== 0).length }
  })
  const missed = [...data.cards].filter((x) => x.lapses > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 10)
  const snapSeries = data.snapshots.map((s) => ({ day: shortDay(s.day), Learning: s.learning, Young: s.young, Mature: s.mature }))

  // --- maths
  const daily = data.sessions.filter((s) => s.mode === 'daily')
  const mathSeries = daily.map((s) => ({ day: shortDay(s.day), Accuracy: (s.correct / s.total) * 100, Seconds: s.totalMs / 1000 / s.total }))
  const levelsForUnlock = defaultLevels()
  for (const l of data.levels) if (l.category in levelsForUnlock) levelsForUnlock[l.category as CategoryId].level = l.level
  const unlocked = new Set(unlockedSkills(levelsForUnlock))
  const levelBars = CATEGORIES.map((cat) => ({ name: cat.name, Progress: unlocked.has(cat.id) ? Math.round((lvOf(cat.id) / rungCount(cat.id)) * 100) : 0 }))

  // --- puzzles
  const types = Object.keys(PUZZLE_INFO) as PuzzleType[]
  const fermiHits = data.fermi.filter((f) => f.hit).length

  return (
    <>
      <h1>Progress</h1>
      <div className="grid cols-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="card stat"><div className="value">{streak(data.days, today, data.geoLaunch)}</div><div className="label">day streak (best {bestStreak(data.days, data.geoLaunch)})</div></div>
        <div className="card stat"><div className="value">{activeDays}</div><div className="label">active days</div></div>
        <div className="card stat"><div className="value">~{recall}</div><div className="label">of {TOTAL_WORDS} words you'd recognise today</div></div>
        <div className="card stat"><div className="value">{production}</div><div className="label">words you can produce (EN→ES)</div></div>
        <div className="card stat"><div className="value">{ladderPct}%</div><div className="label">of the way up the maths ladders</div></div>
      </div>

      <div className="card">
        <h2>Daily activity</h2>
        <div className="heatmap" role="img" aria-label="Tasks completed per day over the last year">
          {cells.map((d) => {
            const n = tasksDone(byDay.get(d))
            const total = taskCount(d, data.geoLaunch)
            return <div key={d} title={`${d}: ${n}/${total} tasks`} style={{ background: c.seq[Math.round((n / total) * 3)] }} />
          })}
        </div>
        <div className="row small muted" style={{ gap: 6, marginTop: 6 }}>
          none {c.seq.map((col, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: col, display: 'inline-block' }} />)} all tasks
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Spanish</h2>
      <div className="grid cols-2">
        <div className="card">
          <h3>Words by memory strength</h3>
          {snapSeries.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={snapSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="day" {...axis} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: c.muted }} />
                <Area type="monotone" dataKey="Learning" stackId="1" stroke={c.s2} fill={c.s2} fillOpacity={0.5} strokeWidth={2} />
                <Area type="monotone" dataKey="Young" stackId="1" stroke={c.s1} fill={c.s1} fillOpacity={0.5} strokeWidth={2} />
                <Area type="monotone" dataKey="Mature" stackId="1" stroke={c.s3} fill={c.s3} fillOpacity={0.5} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty />}
          <p className="muted small">Learning: interval under 7 days. Young: 7 to 20 days. Mature: 21+ days. Placement-known words aren't counted until spot-checked.</p>
        </div>
        <div className="card">
          <h3>First-try accuracy per day</h3>
          {accuracySeries.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={accuracySeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="day" {...axis} />
                <YAxis {...axis} domain={[0, 100]} unit="%" />
                <Tooltip content={<Tip unit="%" />} />
                <Line type="monotone" dataKey="Accuracy" stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
          <p className="muted small">Around 85 to 90% is healthy. FSRS schedules for 90% recall.</p>
        </div>
        <div className="card">
          <h3>Reviews due, next 7 days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecast} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="day" {...axis} />
              <YAxis {...axis} allowDecimals={false} />
              <Tooltip content={<Tip />} cursor={{ fill: c.grid, opacity: 0.4 }} />
              <Bar dataKey="Due" fill={c.s1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Most-missed words</h3>
          {missed.length ? (
            <table>
              <thead><tr><th>Word</th><th>Direction</th><th className="num">Misses</th></tr></thead>
              <tbody>
                {missed.map((m) => {
                  const w = WORD_BY_ID.get(m.wordId)!
                  return (
                    <tr key={m.id}>
                      <td>{spanishDisplay(w)} <span className="muted">· {w.en[0]}</span> {m.lapses >= 6 && <span className="pill bad">leech</span>}</td>
                      <td className="small muted">{m.dir === 'r' ? 'ES→EN' : 'EN→ES'}</td>
                      <td className="num">{m.lapses}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <Empty text="No lapses yet." />}
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Mental maths</h2>
      <div className="grid cols-2">
        <div className="card">
          <h3>Progress up each skill ladder</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={levelBars} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={c.grid} />
              <XAxis type="number" domain={[0, 100]} {...axis} ticks={[0, 25, 50, 75, 100]} unit="%" />
              <YAxis type="category" dataKey="name" {...axis} width={150} />
              <Tooltip content={<Tip unit="%" />} cursor={{ fill: c.grid, opacity: 0.4 }} />
              <Bar dataKey="Progress" fill={c.s1} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Daily-10 accuracy</h3>
          {mathSeries.length ? (
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={mathSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="day" {...axis} />
                <YAxis {...axis} domain={[0, 100]} unit="%" />
                <Tooltip content={<Tip unit="%" />} />
                <Line type="monotone" dataKey="Accuracy" stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
          <h3 style={{ marginTop: 12 }}>Seconds per question</h3>
          {mathSeries.length ? (
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={mathSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="day" {...axis} />
                <YAxis {...axis} unit="s" />
                <Tooltip content={<Tip unit="s" />} />
                <Line type="monotone" dataKey="Seconds" stroke={c.s2} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty />}
          <p className="muted small">Accuracy staying near 80% while the levels climb is the goal. The questions get harder as you improve.</p>
        </div>
      </div>
      <div className="card">
        <h3>Skill breakdown (last 50 answers per skill, excluding speed drills)</h3>
        <table>
          <thead><tr><th>Skill</th><th className="num">Rung</th><th>Tier</th><th className="num">Answers</th><th className="num">Accuracy</th><th className="num">Median time</th><th className="num">Target now</th></tr></thead>
          <tbody>
            {CATEGORIES.map((cat) => {
              const rows = data.attempts.filter((a) => a.category === cat.id && a.mode !== 'drill').sort((a, b) => b.ts - a.ts).slice(0, 50)
              const acc = rows.length ? Math.round((rows.filter((r) => r.correct).length / rows.length) * 100) : null
              return (
                <tr key={cat.id}>
                  <td>{cat.name}</td>
                  <td className="num">{unlocked.has(cat.id) ? `${lvOf(cat.id)}/${rungCount(cat.id)}` : 'locked'}</td>
                  <td className="small muted">{unlocked.has(cat.id) ? tierOf(cat.id, lvOf(cat.id)) : ''}</td>
                  <td className="num">{rows.length}</td>
                  <td className="num">{acc === null ? '–' : `${acc}%`}</td>
                  <td className="num">{rows.length ? `${(median(rows.map((r) => r.ms)) / 1000).toFixed(1)}s` : '–'}</td>
                  <td className="num">{(targetMsFor(cat.id, lvOf(cat.id)) / 1000).toFixed(1)}s</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <GeoSection cards={data.geoCards} reviews={data.geoReviews} colors={c} />

      <h2 style={{ marginTop: 24 }}>Puzzles</h2>
      <div className="grid cols-2">
        <div className="card">
          <table>
            <thead><tr><th>Puzzle</th><th className="num">Played</th><th className="num">Solved</th><th className="num">Avg time</th></tr></thead>
            <tbody>
              {types.map((ty) => {
                const rows = data.puzzles.filter((p) => p.type === ty)
                return (
                  <tr key={ty}>
                    <td>{PUZZLE_INFO[ty].name}</td>
                    <td className="num">{rows.length}</td>
                    <td className="num">{rows.length ? `${Math.round((rows.filter((r) => r.solved).length / rows.length) * 100)}%` : '–'}</td>
                    <td className="num">{rows.length ? fmtTime(rows.reduce((s, r) => s + r.ms, 0) / rows.length) : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="card stat">
          <h3>Calibration</h3>
          <div className="value">{data.fermi.length ? `${Math.round((fermiHits / data.fermi.length) * 100)}%` : '–'}</div>
          <div className="label">of your “90% sure” ranges contained the answer ({data.fermi.length} answers, target 90%)</div>
          {data.fermi.length >= 20 && (
            <p className="small" style={{ marginTop: 8 }}>
              {fermiHits / data.fermi.length < 0.8 ? 'Overconfident: your ranges are too narrow.' : fermiHits / data.fermi.length > 0.97 ? 'Underconfident: you can afford tighter ranges.' : 'Well calibrated.'}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
