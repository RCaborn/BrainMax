import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta } from '../lib/db'
import { dayKey, parseDayKey } from '../lib/day'
import { bestStreak, geoLaunchDay, streak, taskCount } from '../lib/progress'
import { PUZZLE_INFO, puzzleForDay } from '../features/puzzles/rotation'
import { DAILY_SIZE } from '../features/spanish/scheduler'

export default function TodayPage() {
  const today = dayKey()
  const status = useLiveQuery(() => db.daily.get(today), [today])
  const days = useLiveQuery(() => db.daily.toArray(), []) ?? []
  const geoLaunch = useLiveQuery(() => geoLaunchDay(), []) ?? null
  const backup = useLiveQuery(async () => {
    const last = await getMeta<string | null>('lastBackup', null)
    const hasData = (await db.reviews.count()) + (await db.mathSessions.count()) > 0
    return { last, hasData }
  }, [])
  const puzzle = puzzleForDay(today)
  const date = parseDayKey(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const total = taskCount(today, geoLaunch)
  const doneCount = status ? Number(status.math) + Number(status.spanish) + Number(status.puzzle) + Number(!!status.geo) : 0
  const staleBackup =
    backup?.hasData && (!backup.last || Date.now() - new Date(backup.last).getTime() > 7 * 86_400_000)

  const tasks = [
    { done: !!status?.math, to: '/math', title: 'Mental maths', sub: '10 timed questions, IB-assessment style' },
    {
      done: !!status?.spanish,
      to: '/spanish',
      title: 'Spanish',
      sub: `${DAILY_SIZE} words${status?.spanishCount ? ` · ${status.spanishCount} answered today` : ''}`,
    },
    {
      done: !!status?.geo,
      to: '/geo',
      title: 'Geography',
      sub: `15 cards: maps, capitals, flags, UK${status?.geoCount ? ` · ${status.geoCount} answered today` : ''}`,
    },
    { done: !!status?.puzzle, to: '/puzzle', title: 'Daily puzzle', sub: PUZZLE_INFO[puzzle].name },
  ]

  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <h1>{date}</h1>
          <p className="muted">{doneCount >= total ? 'All done today. See you tomorrow.' : `${doneCount} of ${total} done today`}</p>
        </div>
        <div className="row">
          <div className="card stat" style={{ margin: 0, padding: '10px 16px' }}>
            <div className="value">{streak(days, today, geoLaunch)}</div>
            <div className="label">day streak</div>
          </div>
          <div className="card stat" style={{ margin: 0, padding: '10px 16px' }}>
            <div className="value">{bestStreak(days, geoLaunch)}</div>
            <div className="label">best</div>
          </div>
        </div>
      </div>

      {tasks.map((t) => (
        <Link key={t.to} to={t.to} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={`card task ${t.done ? 'done' : ''}`}>
            <div className="check">{t.done ? '✓' : ''}</div>
            <div className="grow">
              <h2 style={{ margin: 0 }}>{t.title}</h2>
              <div className="muted small">{t.sub}</div>
            </div>
            <span className="btn">{t.done ? 'Again' : 'Start'}</span>
          </div>
        </Link>
      ))}

      {staleBackup && (
        <div className="card feedback meh">
          Your progress lives in this browser only. <Link to="/settings">Download a backup</Link>
          {backup?.last ? " (it's been over a week)." : '. You haven’t made one yet.'}
        </div>
      )}

      <p className="muted small" style={{ marginTop: 24 }}>
        Straight talk: these drills make you faster at mental maths and better at Spanish, which are real skills.
        The evidence that brain-training games raise general intelligence is weak, so treat this as skill practice,
        not an IQ boost. Sleep and exercise still matter more.
      </p>
    </>
  )
}
