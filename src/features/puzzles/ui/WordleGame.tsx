import { useEffect, useRef, useState } from 'react'
import { db } from '../../../lib/db'
import { seeded } from '../../../lib/rng'
import { placementKnown } from '../../../lib/progress'
import { stripAccents } from '../../spanish/grading'
import { spanishDisplay, type Word } from '../../spanish/words'
import { MAX_TRIES, WORD_LEN, type Mark, markGuess, pickAnswer, wordleKey } from '../wordle'
import type { GameProps } from './common'

const RANK: Record<Mark, number> = { miss: 0, present: 1, hit: 2 }

export default function WordleGame({ seed, onFinish }: GameProps) {
  const [answer, setAnswer] = useState<Word | null>(null)
  const [guesses, setGuesses] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [done, setDone] = useState<null | { solved: boolean }>(null)
  const start = useRef(performance.now())

  useEffect(() => {
    void (async () => {
      const learned = new Set((await db.cards.where('dir').equals('r').toArray()).filter((c) => c.reps > 0).map((c) => c.wordId))
      for (const id of await placementKnown()) learned.add(id)
      setAnswer(pickAnswer(seeded(seed), learned))
      start.current = performance.now()
    })()
  }, [seed])

  if (!answer) return <p className="muted">Loading…</p>
  const key = wordleKey(answer)

  function submit() {
    const g = stripAccents(input.toLowerCase()).replace(/[^a-z]/g, '')
    if (g.length !== WORD_LEN || done) return
    const all = [...guesses, g]
    setGuesses(all)
    setInput('')
    const solved = g === key
    if (solved || all.length >= MAX_TRIES) {
      setDone({ solved })
      onFinish({ solved, score: solved ? MAX_TRIES + 1 - all.length : 0, ms: performance.now() - start.current, detail: { tries: all.length } })
    }
  }

  const letterState = new Map<string, Mark>()
  for (const g of guesses) {
    markGuess(key, g).forEach((m, i) => {
      const prev = letterState.get(g[i])
      if (!prev || RANK[m] > RANK[prev]) letterState.set(g[i], m)
    })
  }
  const rows = Array.from({ length: MAX_TRIES }, (_, r) => guesses[r] ?? (r === guesses.length && !done ? input.toLowerCase().padEnd(WORD_LEN).slice(0, WORD_LEN) : ''))

  return (
    <div className="stack-center">
      <div>
        {rows.map((g, r) => {
          const marks = guesses[r] ? markGuess(key, guesses[r]) : null
          return (
            <div className="wd-row" key={r}>
              {Array.from({ length: WORD_LEN }, (_, i) => (
                <div key={i} className={`wd-cell ${marks ? marks[i] : ''}`}>{g[i]?.trim() ?? ''}</div>
              ))}
            </div>
          )
        })}
      </div>
      {!done && (
        <input
          autoFocus
          className="answer-input"
          maxLength={WORD_LEN}
          value={input}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => setInput(e.target.value.replace(/[^a-zA-ZñÑáéíóúüÁÉÍÓÚÜ]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="5 letters, Enter"
        />
      )}
      <div className="kb">
        {'qwertyuiopasdfghjklzxcvbnm'.split('').map((l) => (
          <span key={l} className={letterState.get(l) ?? ''}>{l}</span>
        ))}
      </div>
      <div className="muted small">Green: right spot. Gold: in the word, wrong spot. Accents are ignored (ñ counts as n).</div>
      {done && (
        <div className={`feedback ${done.solved ? 'ok' : 'no'}`}>
          <b>{done.solved ? `¡Bien! ${guesses.length}/${MAX_TRIES}` : 'Not this time.'}</b> The word was <b>{spanishDisplay(answer)}</b>, meaning {answer.en.join(', ')}.
        </div>
      )}
    </div>
  )
}
