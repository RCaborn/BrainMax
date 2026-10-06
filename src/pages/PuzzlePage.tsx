import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, markDaily } from '../lib/db'
import { dayKey } from '../lib/day'
import { hashString } from '../lib/rng'
import { PUZZLE_INFO, type PuzzleType, puzzleForDay, weekIndex } from '../features/puzzles/rotation'
import { fermiRound } from '../features/puzzles/fermi'
import type { GameResult } from '../features/puzzles/ui/common'
import { fmtTime } from '../features/puzzles/ui/common'
import CountdownGame from '../features/puzzles/ui/CountdownGame'
import KenKenGame from '../features/puzzles/ui/KenKenGame'
import WordleGame from '../features/puzzles/ui/WordleGame'
import CodebreakerGame from '../features/puzzles/ui/CodebreakerGame'
import FermiGame from '../features/puzzles/ui/FermiGame'

const PRACTICE_TYPES: PuzzleType[] = ['countdown', 'countdown-hard', 'kenken', 'kenken-6', 'wordle', 'codebreaker', 'fermi']

function Game({ type, seed, onFinish }: { type: PuzzleType; seed: string; onFinish: (r: GameResult) => void }) {
  switch (type) {
    case 'countdown': return <CountdownGame seed={seed} hard={false} onFinish={onFinish} />
    case 'countdown-hard': return <CountdownGame seed={seed} hard onFinish={onFinish} />
    case 'kenken': return <KenKenGame seed={seed} big={false} onFinish={onFinish} />
    case 'kenken-6': return <KenKenGame seed={seed} big onFinish={onFinish} />
    case 'wordle': return <WordleGame seed={seed} onFinish={onFinish} />
    case 'codebreaker': return <CodebreakerGame seed={seed} onFinish={onFinish} />
    case 'fermi': {
      // Daily rounds walk the bank week by week; practice rounds jump elsewhere in it.
      const round = seed.includes(':practice:') ? hashString(seed) % 1000 : weekIndex(seed.split(':')[1])
      return <FermiGame seed={seed} questions={fermiRound(round)} onFinish={onFinish} />
    }
  }
}

export default function PuzzlePage() {
  const today = dayKey()
  const todayType = puzzleForDay(today)
  const [practice, setPractice] = useState<{ type: PuzzleType; n: number } | null>(null)
  const [justFinished, setJustFinished] = useState(false)
  const daily = useLiveQuery(() => db.puzzles.where('day').equals(today).filter((p) => p.daily).first(), [today])

  const type = practice?.type ?? todayType
  const seed = practice ? `${type}:${today}:practice:${practice.n}` : `${type}:${today}`

  async function onFinish(r: GameResult) {
    await db.puzzles.add({ day: today, type, daily: !practice, solved: r.solved, score: r.score, ms: Math.round(r.ms), ts: Date.now(), detail: r.detail })
    if (!practice) {
      await markDaily(today, { puzzle: true })
      setJustFinished(true)
    }
  }

  const showDailyGame = !practice && (!daily || justFinished)

  return (
    <>
      <div className="row between">
        <h1>{practice ? `Practice: ${PUZZLE_INFO[type].name}` : `Today: ${PUZZLE_INFO[todayType].name}`}</h1>
        {practice && <button onClick={() => setPractice(null)}>Back to today's</button>}
      </div>
      <p className="muted">{PUZZLE_INFO[type].blurb}</p>

      {(practice || showDailyGame) && (
        <div className="card">
          <Game key={seed} type={type} seed={seed} onFinish={(r) => void onFinish(r)} />
        </div>
      )}

      {!practice && daily && !justFinished && (
        <div className="card feedback ok">
          Done today: {daily.solved ? 'solved' : 'not solved'}, {daily.score} points, {fmtTime(daily.ms)}. A new puzzle unlocks tomorrow.
        </div>
      )}

      <div className="card">
        <h2>Practice (unranked)</h2>
        <p className="muted small">Doesn't count toward the daily streak. The weekly rotation is Mon Countdown · Tue KenKen · Wed Palabra · Thu Code-breaker · Fri Calibration · Sat hard Countdown · Sun KenKen 6×6.</p>
        <div className="row">
          {PRACTICE_TYPES.map((t) => (
            <button key={t} className="small" onClick={() => setPractice({ type: t, n: Date.now() })}>{PUZZLE_INFO[t].name}</button>
          ))}
        </div>
      </div>
    </>
  )
}
