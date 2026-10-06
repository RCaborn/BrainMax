import { useEffect, useMemo, useRef, useState } from 'react'
import { Rating } from 'ts-fsrs'
import { db, getMeta, markDaily, setMeta, type StoredCard } from '../lib/db'
import { dayKey, endOfDay, now } from '../lib/day'
import { mulberry32, seeded } from '../lib/rng'
import { type PlacementMeta, placementKnown, saveSnapshot } from '../lib/progress'
import { type Grade, grade } from '../features/spanish/grading'
import { WORD_BY_ID, englishPrompt, posLabel, spanishDisplay, type Word } from '../features/spanish/words'
import { DAILY_SIZE, EXTRA_SIZE, LEECH_LAPSES, type QueueItem, buildQueue, cardId, review } from '../features/spanish/scheduler'
import { type PlacementAnswer, bandAccuracy, knownWordsFrom, placementItems, shouldStop, BAND_SIZE } from '../features/spanish/placement'

export default function SpanishPage() {
  const [state, setState] = useState<'loading' | 'intro' | 'placement' | 'study'>('loading')
  useEffect(() => {
    void (async () => {
      const p = await getMeta<PlacementMeta | null>('placement', null)
      const n = await db.cards.count()
      setState(p?.done || n > 0 ? 'study' : 'intro')
    })()
  }, [])

  if (state === 'loading') return <p className="muted">Loading…</p>
  if (state === 'intro') return <Intro onPlacement={() => setState('placement')} onSkip={() => setState('study')} />
  if (state === 'placement') return <Placement onDone={() => setState('study')} />
  return <Study />
}

function Intro({ onPlacement, onSkip }: { onPlacement: () => void; onSkip: () => void }) {
  async function skip() {
    await setMeta('placement', { done: true, knownWords: [], bands: [], date: dayKey() } satisfies PlacementMeta)
    onSkip()
  }
  return (
    <div className="card">
      <h1>Spanish: the 2000 most common words</h1>
      <p>
        Each day you get {DAILY_SIZE} typed answers. Words you miss come back sooner and more often; words you know get
        pushed further out, just before you'd forget them (spaced repetition, using the FSRS algorithm).
      </p>
      <p>
        You'll see each word Spanish → English first. Once you know a word, its English → Spanish card unlocks. That's
        the harder direction, and the one that makes you able to speak.
      </p>
      <p className="muted">
        You said you're intermediate, so take the placement test first (~5 min, about 100 words). Frequency bands you score
        90%+ on are marked known and only spot-checked, instead of wasting reps on words like <i>casa</i>.
      </p>
      <div className="row">
        <button className="primary" onClick={onPlacement}>Take placement test</button>
        <button onClick={() => void skip()}>Skip, start from word #1</button>
      </div>
    </div>
  )
}

function Placement({ onDone }: { onDone: () => void }) {
  const items = useMemo(() => placementItems(), [])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<PlacementAnswer[]>([])
  const [input, setInput] = useState('')
  const [last, setLast] = useState<{ word: Word; ok: boolean } | null>(null)
  const [result, setResult] = useState<PlacementMeta | null>(null)
  const [finishing, setFinishing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function complete(all: PlacementAnswer[]) {
    const known = knownWordsFrom(all)
    const knownSet = new Set(known)
    const t = now()
    const day = dayKey(t)
    // Correct answers outside known bands become real cards; misses are taught as new words.
    for (const a of all) {
      if (!a.correct || knownSet.has(a.wordId)) continue
      await db.cards.put(review(undefined, a.wordId, 'r', Rating.Good, t, day))
    }
    const meta: PlacementMeta = { done: true, knownWords: known, bands: [...bandAccuracy(all)], date: day }
    await setMeta('placement', meta)
    await saveSnapshot()
    setResult(meta)
  }

  function answer(text: string) {
    if (finishing) return
    const it = items[idx]
    const g = grade(it.word, 'r', text, 5000, false)
    const ok = g.result === 'correct' || g.result === 'typo'
    const all = [...answers, { band: it.band, wordId: it.word.id, correct: ok }]
    setAnswers(all)
    setLast({ word: it.word, ok })
    setInput('')
    inputRef.current?.focus()
    if (idx + 1 >= items.length || shouldStop(all)) {
      setFinishing(true)
      void complete(all)
    }
    else setIdx(idx + 1)
  }

  if (result) {
    return (
      <div className="card">
        <h1>Placement done</h1>
        <p>
          Marked <b>{result.knownWords.length}</b> words as known (spot-checked a couple a day). New words start from rank{' '}
          <b>{firstUnknownRank(result)}</b>.
        </p>
        <table>
          <thead><tr><th>Frequency band</th><th className="num">Score</th><th></th></tr></thead>
          <tbody>
            {result.bands.map(([b, acc]) => (
              <tr key={b}>
                <td>Words {b * BAND_SIZE + 1}–{(b + 1) * BAND_SIZE}</td>
                <td className="num">{Math.round(acc * 100)}%</td>
                <td>{acc >= 0.9 ? <span className="pill accent">known</span> : <span className="pill">to learn</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p />
        <button className="primary" onClick={onDone}>Start today's words</button>
      </div>
    )
  }

  const it = items[idx]
  return (
    <div className="card stack-center">
      <div className="row between" style={{ width: '100%' }}>
        <span className="pill">Placement</span>
        <span className="muted small">Band {it.band + 1} of 10 · word {idx + 1} of {items.length}</span>
      </div>
      <div className="progress" style={{ width: '100%' }}><div style={{ width: `${(idx / items.length) * 100}%` }} /></div>
      <div className="prompt">{spanishDisplay(it.word)}</div>
      <div className="note">{posLabel(it.word.pos)} · type the English</div>
      <input
        ref={inputRef}
        autoFocus
        className="answer-input"
        value={input}
        autoComplete="off"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && input.trim()) answer(input)
        }}
      />
      <button className="ghost small" onClick={() => answer('')}>Don't know</button>
      {last && (
        <div className={`small ${last.ok ? 'good' : 'bad'}`}>
          {last.ok ? '✓' : '✗'} {spanishDisplay(last.word)} = {last.word.en.join(', ')}
        </div>
      )}
      <p className="muted small">The test stops early after two weak bands in a row.</p>
    </div>
  )
}

function firstUnknownRank(p: PlacementMeta): number {
  const known = new Set(p.knownWords)
  for (let id = 1; id <= 2000; id++) if (!known.has(id)) return id
  return 2000
}

interface Entry {
  item: QueueItem
  retry: boolean
}

function Study() {
  const [loaded, setLoaded] = useState(false)
  const [queue, setQueue] = useState<Entry[]>([])
  const [pos, setPos] = useState(0)
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'answer' | 'feedback'>('answer')
  const [g, setG] = useState<Grade | null>(null)
  const [given, setGiven] = useState('')
  const [synonym, setSynonym] = useState<string | null>(null)
  const [overridden, setOverridden] = useState(false)
  const [doneToday, setDoneToday] = useState(0)
  const [sessionStats, setSessionStats] = useState({ right: 0, wrong: 0 })
  const cards = useRef(new Map<string, StoredCard>())
  const accepted = useRef(new Map<string, string[]>())
  const qStart = useRef(performance.now())
  const inputRef = useRef<HTMLInputElement>(null)

  async function load(size?: number) {
    const all = await db.cards.toArray()
    cards.current = new Map(all.map((c) => [c.id, c]))
    accepted.current = new Map((await db.accepted.toArray()).map((a) => [a.key, a.answers]))
    const today = dayKey()
    const reviewed = new Set((await db.reviews.where('day').equals(today).toArray()).map((r) => r.cardId))
    setDoneToday(reviewed.size)
    const want = size ?? Math.max(0, DAILY_SIZE - reviewed.size)
    const q = want
      ? buildQueue({
          cards: all, placementKnown: await placementKnown(), doneToday: reviewed, now: now(), endOfDay: endOfDay(),
          size: want, rng: seeded(`spanish:${today}:${reviewed.size}`),
        })
      : []
    setQueue(q.map((item) => ({ item, retry: false })))
    setPos(0)
    setPhase('answer')
    setInput('')
    setLoaded(true)
    qStart.current = performance.now()
  }

  useEffect(() => {
    void load()
  }, [])
  useEffect(() => {
    inputRef.current?.focus()
  }, [pos, phase, synonym])

  if (!loaded) return <p className="muted">Loading…</p>

  const entry = queue[pos]
  if (!entry) {
    return (
      <div className="card">
        <h1>{doneToday >= DAILY_SIZE ? '¡Hecho! Today’s words are done' : 'Nothing left to study'}</h1>
        <p>
          {doneToday} words answered today.
          {sessionStats.right + sessionStats.wrong > 0 && ` This session: ${sessionStats.right} right first time, ${sessionStats.wrong} missed (and re-drilled).`}
        </p>
        <p className="muted">
          The daily 20 is the minimum. With both directions, 2000 words at 20 a day takes well over a year, so extra rounds
          on good days help a lot.
        </p>
        <button className="primary" onClick={() => void load(EXTRA_SIZE)}>+{EXTRA_SIZE} more</button>
      </div>
    )
  }

  const word = WORD_BY_ID.get(entry.item.wordId)!
  const id = cardId(word.id, entry.item.dir)
  const existing = cards.current.get(id)
  const isLeech = (existing?.lapses ?? 0) >= LEECH_LAPSES
  const dir = entry.item.dir
  const firstCount = queue.filter((e) => !e.retry).length
  const firstDone = queue.slice(0, pos).filter((e) => !e.retry).length

  function submit(text: string) {
    if (phase !== 'answer') return
    const ms = performance.now() - qStart.current
    const isReview = !!existing && existing.state !== 0
    const res = grade(word, dir, text, ms, isReview, accepted.current.get(id) ?? [])
    if (res.result === 'synonym') {
      setSynonym(res.detail ?? '')
      setInput('')
      return
    }
    setSynonym(null)
    setGiven(text)
    setG(res)
    setOverridden(false)
    setPhase('feedback')
  }

  async function override() {
    if (!given.trim()) return
    setOverridden(true)
    const list = [...(accepted.current.get(id) ?? []), given.trim()]
    accepted.current.set(id, list)
    await db.accepted.put({ key: id, answers: list })
  }

  async function next() {
    if (!g) return
    const wrong = g.result === 'wrong' && !overridden
    if (!entry.retry) {
      const t = now()
      const day = dayKey(t)
      const rating = overridden ? Rating.Good : g.rating!
      const card = review(existing, word.id, dir, rating as Rating.Again | Rating.Hard | Rating.Good | Rating.Easy, t, day, entry.item.kind === 'spot')
      cards.current.set(id, card)
      await db.cards.put(card)
      await db.reviews.add({
        cardId: id, wordId: word.id, dir, ts: t.getTime(), day, rating, result: overridden ? 'override' : g.result,
        ms: Math.round(performance.now() - qStart.current), answer: given,
      })
      const count = doneToday + 1
      setDoneToday(count)
      await markDaily(day, { spanishCount: count, ...(count >= DAILY_SIZE ? { spanish: true } : {}) })
      setSessionStats((s) => (wrong ? { ...s, wrong: s.wrong + 1 } : { ...s, right: s.right + 1 }))
    }
    let q = queue
    if (wrong) {
      // Re-drill a miss a few cards later until it's typed correctly (ungraded).
      const at = Math.min(q.length, pos + 3 + Math.floor(mulberry32(Date.now() >>> 0)() * 3))
      q = [...q.slice(0, at), { item: entry.item, retry: true }, ...q.slice(at)]
      setQueue(q)
    }
    if (pos + 1 >= q.length) {
      await saveSnapshot()
      // Finishing the queue completes the day (it is only shorter than 20 when nothing else is available).
      await markDaily(dayKey(), { spanish: true })
    }
    setPos(pos + 1)
    setInput('')
    setG(null)
    setPhase('answer')
    qStart.current = performance.now()
  }

  const kindLabel = entry.retry ? 'retry' : entry.item.kind === 'spot' ? 'spot check' : entry.item.kind
  return (
    <div className="card stack-center">
      <div className="row between" style={{ width: '100%' }}>
        <span className="row" style={{ gap: 6 }}>
          <span className="pill">{dir === 'r' ? 'ES → EN' : 'EN → ES'}</span>
          <span className="pill accent">{kindLabel}</span>
          {isLeech && <span className="pill bad">leech</span>}
        </span>
        <span className="muted small mono">
          {firstDone}/{firstCount} · today {doneToday}
        </span>
      </div>
      <div className="progress" style={{ width: '100%' }}><div style={{ width: `${(firstDone / Math.max(1, firstCount)) * 100}%` }} /></div>
      <div className={`prompt ${dir === 'p' && englishPrompt(word).length > 22 ? 'long' : ''}`}>
        {dir === 'r' ? spanishDisplay(word) : englishPrompt(word)}
      </div>
      <div className="note">
        {posLabel(word.pos)} · type the {dir === 'r' ? 'English' : 'Spanish'}
        {dir === 'p' && ' (article optional, accents matter)'}
      </div>
      <input
        ref={inputRef}
        className="answer-input"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={input}
        readOnly={phase !== 'answer'}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (phase === 'answer') {
            if (input.trim()) submit(input)
          } else void next()
        }}
      />
      {phase === 'answer' && <button className="ghost small" onClick={() => submit('')}>Don't know</button>}
      {synonym && phase === 'answer' && (
        <div className="feedback meh small">
          <b>{synonym}</b> fits too, but this card wants a different word. It starts with <b>{word.es[0][0]}</b>. Try again.
        </div>
      )}
      {phase === 'feedback' && g && (
        <Feedback word={word} dir={dir} g={g} overridden={overridden} onOverride={() => void override()} leech={isLeech} lapses={existing?.lapses ?? 0} />
      )}
      {phase === 'feedback' && <button className="primary" onClick={() => void next()}>Next (Enter)</button>}
    </div>
  )
}

function Feedback(props: { word: Word; dir: 'r' | 'p'; g: Grade; overridden: boolean; onOverride: () => void; leech: boolean; lapses: number }) {
  const { word, dir, g, overridden } = props
  const full = `${spanishDisplay(word)} = ${word.en.join(', ')}`
  if (overridden) return <div className="feedback ok">Counted as correct, and your answer is saved as accepted. {full}</div>
  if (g.result === 'correct') return <div className="feedback ok">✓ {full}</div>
  if (g.result === 'accent') return <div className="feedback meh">Accepted, but watch the accent: <b>{g.detail}</b>. {full}</div>
  if (g.result === 'typo') return <div className="feedback meh">Accepted as a typo of <b>{g.detail}</b>. {full}</div>
  return (
    <div className="feedback no">
      <div>
        ✗ <b>{dir === 'r' ? word.en.join(', ') : spanishDisplay(word)}</b>
        <span className="muted"> ({full})</span>
      </div>
      {props.leech && (
        <div className="small" style={{ marginTop: 6 }}>
          You've missed this {props.lapses} times. Make a silly mental image linking the sound of <b>{word.es[0]}</b> to “{word.en[0]}”.
        </div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="small" onClick={props.onOverride}>I was right</button>
        <span className="muted small">Use this when your answer is a valid translation the key doesn't list.</span>
      </div>
    </div>
  )
}
