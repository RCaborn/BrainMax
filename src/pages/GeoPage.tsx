import { useEffect, useRef, useState } from 'react'
import { db, markDaily } from '../lib/db'
import { dayKey, endOfDay, now } from '../lib/day'
import { mulberry32 } from '../lib/rng'
import { type Grade, Rating, State, nextFields } from '../lib/srs'
import { DECK, ITEM_BY_ID, MAP_DATA } from '../features/geo/data'
import GeoMap, { type Mark } from '../features/geo/GeoMap'
import { gradeClick, gradeName } from '../features/geo/grading'
import { GEO_DAILY, GEO_EXTRA, type GeoQueueItem, type GeoStored, buildGeoQueue } from '../features/geo/queue'
import type { GeoCardDef, GeoItem } from '../features/geo/types'

const KIND_LABEL: Record<string, string> = {
  country: 'country', ukArea: 'county / council area', niCounty: 'county (Northern Ireland)', city: 'city', river: 'river', peak: 'mountain',
  range: 'upland range', nationalPark: 'national park', island: 'island', islandGroup: 'island group', sea: 'sea', ocean: 'ocean',
  firth: 'firth', estuary: 'estuary', bay: 'bay', channel: 'channel', strait: 'strait', gulf: 'gulf', loch: 'loch / lough', lake: 'lake',
  desert: 'desert', canal: 'canal', other: 'feature',
}

type Outcome = { tone: 'good' | 'warn' | 'bad'; rating: Grade; text: string; marks: Mark[]; typed?: string }

interface Entry {
  item: GeoQueueItem
  retry: boolean
}

function promptFor(def: GeoCardDef, it: GeoItem): string {
  switch (def.type) {
    case 'locate': return `Find: ${it.name}`
    case 'name': return `Name this ${KIND_LABEL[it.kind] ?? 'place'}`
    case 'capital': return `Capital of ${it.name}?`
    case 'capitalOf': return `${it.capital![0]} is the capital of?`
    case 'flag': return 'Whose flag is this?'
    case 'fact': return it.facts[def.factIndex!].prompt
  }
}

function acceptedFor(def: GeoCardDef, it: GeoItem, extra: string[]): string[] {
  if (def.type === 'capital') return [...it.capital!, ...extra]
  if (def.type === 'fact') return [it.facts[def.factIndex!].answer, ...it.facts[def.factIndex!].accept, ...extra]
  return [it.name, ...it.alt, ...extra]
}

function answerText(def: GeoCardDef, it: GeoItem): string {
  if (def.type === 'capital') return it.capital!.join(' / ')
  if (def.type === 'fact') return it.facts[def.factIndex!].answer
  return it.name
}

export default function GeoPage() {
  const [loaded, setLoaded] = useState(false)
  const [queue, setQueue] = useState<Entry[]>([])
  const [pos, setPos] = useState(0)
  const [input, setInput] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [overridden, setOverridden] = useState(false)
  const [doneToday, setDoneToday] = useState(0)
  const [stats, setStats] = useState({ right: 0, wrong: 0 })
  const cards = useRef(new Map<string, GeoStored>())
  const accepted = useRef(new Map<string, string[]>())
  const qStart = useRef(performance.now())
  const inputRef = useRef<HTMLInputElement>(null)

  async function load(size?: number) {
    const all = (await db.geoCards.toArray()) as GeoStored[]
    cards.current = new Map(all.map((c) => [c.id, c]))
    accepted.current = new Map((await db.accepted.where('key').startsWith('geo:').toArray()).map((a) => [a.key.slice(4), a.answers]))
    const today = dayKey()
    const reviewed = new Set((await db.geoReviews.where('day').equals(today).toArray()).map((r) => r.cardId))
    setDoneToday(reviewed.size)
    const want = size ?? Math.max(0, GEO_DAILY - reviewed.size)
    const q = want ? buildGeoQueue(DECK, cards.current, reviewed, now(), endOfDay(), want) : []
    setQueue(q.map((item) => ({ item, retry: false })))
    setPos(0)
    setOutcome(null)
    setInput('')
    setLoaded(true)
    qStart.current = performance.now()
  }

  useEffect(() => {
    void load()
  }, [])
  useEffect(() => {
    inputRef.current?.focus()
  }, [pos, outcome])

  if (!loaded) return <p className="muted">Loading…</p>
  const entry = queue[pos]
  if (!entry) {
    return (
      <div className="card">
        <h1>{doneToday >= GEO_DAILY ? 'Geography done for today' : 'Nothing left to study'}</h1>
        <p>
          {doneToday} cards answered today.
          {stats.right + stats.wrong > 0 && ` This session: ${stats.right} right first time, ${stats.wrong} missed (and re-drilled).`}
        </p>
        <p className="muted">
          The deck has {DECK.length.toLocaleString()} cards ({Math.round((DECK.filter((d) => d.uk).length / DECK.length) * 100)}% UK). New ones
          come in best-known first; misses come back sooner.
        </p>
        <button className="primary" onClick={() => void load(GEO_EXTRA)}>+{GEO_EXTRA} more</button>
      </div>
    )
  }

  const def = entry.item.def
  const it = ITEM_BY_ID.get(def.itemId)!
  const stored = cards.current.get(def.id)
  const isReview = !!stored && stored.state !== State.New
  const typed = def.type !== 'locate'
  const firstCount = queue.filter((e) => !e.retry).length
  const firstDone = queue.slice(0, pos).filter((e) => !e.retry).length

  function rate(ok: 'correct' | 'near' | 'wrong'): Grade {
    if (ok === 'wrong') return Rating.Again
    if (ok === 'near') return Rating.Hard
    const ms = performance.now() - qStart.current
    return ms < 4000 && isReview ? Rating.Easy : ms > 15000 ? Rating.Hard : Rating.Good
  }

  function onMapClick(latlon: [number, number], shapeId: string | null) {
    if (outcome || def.type !== 'locate') return
    const inside = it.shape ? shapeId === it.shape.id : null
    const clickedItemId = shapeId ? (it.shape?.map === 'world' ? `country-${shapeId}` : `uk-area-${shapeId}`) : null
    const neighbour = !!clickedItemId && !!it.borders?.some((b) => b === clickedItemId || ITEM_BY_ID.get(b)?.shape?.id === shapeId)
    const g = gradeClick(it, latlon, inside, neighbour)
    const km = Math.round(g.km)
    setOutcome({
      tone: g.result === 'correct' ? 'good' : g.result === 'near' ? 'warn' : 'bad',
      rating: rate(g.result),
      text: g.result === 'correct' ? `✓ ${it.name}` : g.result === 'near' ? `Close: ${it.name} is highlighted${km ? ` (${km} km off)` : ''}.` : `✗ That's not it. ${it.name} is highlighted${km ? ` (${km.toLocaleString()} km off)` : ''}.`,
      marks: [{ lat: latlon[0], lon: latlon[1], tone: g.result === 'correct' ? 'good' : g.result === 'near' ? 'warn' : 'bad' }],
    })
  }

  function submitTyped(text: string) {
    if (outcome) return
    const g = gradeName(text, acceptedFor(def, it, accepted.current.get(def.id) ?? []))
    const ok = g.result === 'correct' ? 'correct' : g.result === 'typo' ? 'near' : 'wrong'
    setOverridden(false)
    setOutcome({
      tone: ok === 'correct' ? 'good' : ok === 'near' ? 'warn' : 'bad',
      rating: rate(ok),
      typed: text,
      text: ok === 'correct' ? `✓ ${answerText(def, it)}` : ok === 'near' ? `Accepted with a typo: ${g.matched}` : `✗ ${answerText(def, it)}`,
      marks: [],
    })
  }

  async function override() {
    if (!outcome?.typed?.trim()) return
    setOverridden(true)
    const list = [...(accepted.current.get(def.id) ?? []), outcome.typed.trim()]
    accepted.current.set(def.id, list)
    await db.accepted.put({ key: `geo:${def.id}`, answers: list })
  }

  async function next() {
    if (!outcome) return
    const wrong = outcome.tone === 'bad' && !overridden
    if (!entry.retry) {
      const t = now()
      const day = dayKey(t)
      const rating = overridden ? Rating.Good : outcome.rating
      const card: GeoStored = { id: def.id, itemId: def.itemId, type: def.type, uk: def.uk, ...nextFields(stored, rating, t, day) }
      cards.current.set(def.id, card)
      await db.geoCards.put(card)
      await db.geoReviews.add({ cardId: def.id, itemId: def.itemId, type: def.type, uk: def.uk, ts: t.getTime(), day, rating, result: overridden ? 'override' : outcome.tone, ms: Math.round(performance.now() - qStart.current), answer: outcome.typed ?? '' })
      const count = doneToday + 1
      setDoneToday(count)
      await markDaily(day, { geoCount: count, ...(count >= GEO_DAILY ? { geo: true } : {}) })
      setStats((s) => (wrong ? { ...s, wrong: s.wrong + 1 } : { ...s, right: s.right + 1 }))
    }
    let q = queue
    if (wrong) {
      const at = Math.min(q.length, pos + 3 + Math.floor(mulberry32(Date.now() >>> 0)() * 3))
      q = [...q.slice(0, at), { item: entry.item, retry: true }, ...q.slice(at)]
      setQueue(q)
    }
    if (pos + 1 >= q.length) await markDaily(dayKey(), { geo: true })
    setPos(pos + 1)
    setInput('')
    setOutcome(null)
    qStart.current = performance.now()
  }

  // Locate asks you to click; "name" shows the place as the question; every card shows it after answering.
  const showOnMap = def.type === 'name' || !!outcome
  const showMap = def.type === 'locate' || def.type === 'name' || !!outcome

  return (
    <div className="card stack-center">
      <div className="row between" style={{ width: '100%' }}>
        <span className="row" style={{ gap: 6 }}>
          <span className="pill">{it.uk ? 'UK' : 'World'}</span>
          <span className="pill accent">{entry.retry ? 'retry' : entry.item.kind}</span>
          <span className="pill">{KIND_LABEL[it.kind] ?? it.kind}</span>
        </span>
        <span className="muted small mono">{firstDone}/{firstCount} · today {doneToday}</span>
      </div>
      <div className="progress" style={{ width: '100%' }}><div style={{ width: `${(firstDone / Math.max(1, firstCount)) * 100}%` }} /></div>
      <div className={`prompt ${promptFor(def, it).length > 26 ? 'long' : ''}`}>{promptFor(def, it)}</div>
      {def.type === 'locate' && !outcome && <div className="note">Click it on the map</div>}
      {def.type === 'flag' && <img className="flag-img" src={`${import.meta.env.BASE_URL}flags/${it.flag}.svg`} alt="A country's flag" />}
      {showMap && (
        <GeoMap
          view={it.view}
          data={MAP_DATA}
          show={showOnMap ? it : undefined}
          showTone={outcome ? 'good' : 'accent'}
          marks={outcome?.marks}
          onClick={def.type === 'locate' && !outcome ? onMapClick : undefined}
        />
      )}
      {typed && (
        <input
          ref={inputRef}
          className="answer-input"
          autoComplete="off"
          spellCheck={false}
          value={input}
          readOnly={!!outcome}
          placeholder="type, then Enter"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (!outcome) {
              if (input.trim()) submitTyped(input)
            } else void next()
          }}
        />
      )}
      {typed && !outcome && <button className="ghost small" onClick={() => submitTyped('')}>Don't know</button>}
      {outcome && (
        <div className={`feedback ${overridden || outcome.tone === 'good' ? 'ok' : outcome.tone === 'warn' ? 'meh' : 'no'}`}>
          <b>{overridden ? 'Counted as correct, and your answer is saved.' : outcome.text}</b>
          {def.type !== 'locate' && def.type !== 'name' && <span className="muted"> · {it.name}{it.capital && def.type !== 'capital' ? ` (capital ${it.capital[0]})` : ''}</span>}
          {typed && outcome.tone === 'bad' && !overridden && outcome.typed && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="small" onClick={() => void override()}>I was right</button>
              <span className="muted small">If your answer is a valid alternative name.</span>
            </div>
          )}
        </div>
      )}
      {outcome && <button className="primary" onClick={() => void next()}>Next (Enter)</button>}
      {outcome && !typed && <KeyNext onNext={() => void next()} />}
    </div>
  )
}

/** Enter advances after a map answer (there's no text box to catch the key). */
function KeyNext({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Enter' && onNext()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onNext])
  return null
}
