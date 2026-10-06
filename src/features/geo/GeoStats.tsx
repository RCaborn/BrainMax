import { useMemo } from 'react'
import { geoNaturalEarth1, geoPath, geoTransverseMercator } from 'd3-geo'
import type { GeoCard, GeoReview } from '../../lib/db'
import { now } from '../../lib/day'
import { bucket, retrievability } from '../../lib/srs'
import { DECK, ITEM_BY_ID, MAP_DATA } from './data'
import { recallShare } from './queue'

interface Colors {
  seq: string[]
  grid: string
}

const W = 520
const H = 300

/** Buckets recall into the 4-step sequential ramp: not seen, weak, okay, strong. */
const step = (r: number | undefined) => (r === undefined ? 0 : r < 0.5 ? 1 : r < 0.85 ? 2 : 3)

function Choropleth({ kind, recallOf, colors, label }: { kind: 'world' | 'uk'; recallOf: (shapeId: string) => number | undefined; colors: Colors; label: string }) {
  const paths = useMemo(() => {
    const fc = kind === 'world' ? MAP_DATA.world : MAP_DATA.ukAreas
    const proj = kind === 'world' ? geoNaturalEarth1().fitSize([W, H], fc) : geoTransverseMercator().rotate([2, 0]).fitSize([W / 2, H * 1.4], fc)
    const p = geoPath(proj)
    return fc.features.map((f) => ({ id: (f.properties as { id: string }).id, name: (f.properties as { name?: string }).name, d: p(f) ?? '' }))
  }, [kind])
  return (
    <svg viewBox={kind === 'world' ? `0 0 ${W} ${H}` : `0 0 ${W / 2} ${H * 1.4}`} className="geo-map" role="img" aria-label={label} style={{ maxHeight: 420 }}>
      {paths.map((p) => {
        const r = recallOf(p.id)
        return (
          <path key={p.id} d={p.d} fill={colors.seq[step(r)]} stroke={colors.grid} strokeWidth={0.4}>
            <title>{`${p.name ?? ITEM_BY_ID.get(`country-${p.id}`)?.name ?? ''}: ${r === undefined ? 'not seen yet' : `${Math.round(r * 100)}% recall`}`}</title>
          </path>
        )
      })}
    </svg>
  )
}

export function GeoSection({ cards, reviews, colors }: { cards: GeoCard[]; reviews: GeoReview[]; colors: Colors }) {
  const t = now()
  const byId = new Map(cards.map((c) => [c.id, c]))
  const ids = (pred: (id: string, type: string) => boolean) => DECK.filter((d) => pred(d.itemId, d.type)).map((d) => d.id)
  const share = (pred: (id: string, type: string) => boolean) => Math.round(recallShare(cards, ids(pred), t) * 100)
  const kpis = [
    { label: 'of countries you could find on a map', v: share((id, ty) => id.startsWith('country-') && ty === 'locate') },
    { label: 'of capitals you know', v: share((id, ty) => id.startsWith('country-') && ty === 'capital') },
    { label: 'of flags you know', v: share((_, ty) => ty === 'flag') },
    { label: 'of UK counties & areas you could place', v: share((id, ty) => (id.startsWith('uk-area-') || id.startsWith('uk-ni-')) && ty === 'locate') },
    { label: 'of the UK deck known', v: share((id) => id.startsWith('uk-')) },
  ]
  const recallFor = (prefix: string) => (shapeId: string) => {
    const c = byId.get(`locate:${prefix}${shapeId}`)
    return c ? retrievability(c, t) : undefined
  }
  const countryRecall = (ccn3: string) => {
    const item = [...ITEM_BY_ID.values()].find((i) => i.shape?.map === 'world' && i.shape.id === ccn3)
    const c = item ? byId.get(`locate:${item.id}`) : undefined
    return c ? retrievability(c, t) : undefined
  }
  const counts = { learning: 0, young: 0, mature: 0 }
  for (const c of cards) counts[bucket(c)]++
  const missed = [...cards].filter((c) => c.lapses > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 8)
  const firstTry = reviews.length ? Math.round((reviews.filter((r) => r.result === 'good' || r.result === 'override').length / reviews.length) * 100) : null

  return (
    <>
      <h2 style={{ marginTop: 24 }}>Geography</h2>
      <div className="grid cols-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {kpis.map((k) => (
          <div key={k.label} className="card stat"><div className="value">{k.v}%</div><div className="label">{k.label}</div></div>
        ))}
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h3>How well you know each country (finding it on a map)</h3>
          <Choropleth kind="world" recallOf={countryRecall} colors={colors} label="World map shaded by recall" />
          <Legend colors={colors} />
        </div>
        <div className="card">
          <h3>UK counties and council areas</h3>
          <Choropleth kind="uk" recallOf={recallFor('uk-area-')} colors={colors} label="UK map shaded by recall" />
          <Legend colors={colors} />
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h3>Cards by memory strength</h3>
          <table>
            <tbody>
              <tr><td>Learning (interval under 7 days)</td><td className="num">{counts.learning}</td></tr>
              <tr><td>Young (7–20 days)</td><td className="num">{counts.young}</td></tr>
              <tr><td>Mature (21+ days)</td><td className="num">{counts.mature}</td></tr>
              <tr><td>Not started yet</td><td className="num">{DECK.length - cards.length}</td></tr>
            </tbody>
          </table>
          {firstTry !== null && <p className="muted small" style={{ marginTop: 8 }}>First-try accuracy: {firstTry}% over {reviews.length} answers.</p>}
        </div>
        <div className="card">
          <h3>Most-missed</h3>
          {missed.length ? (
            <table>
              <tbody>
                {missed.map((m) => (
                  <tr key={m.id}>
                    <td>{ITEM_BY_ID.get(m.itemId)?.name} <span className="muted small">· {m.type}</span></td>
                    <td className="num">{m.lapses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted small">No misses yet.</p>}
        </div>
      </div>
    </>
  )
}

function Legend({ colors }: { colors: Colors }) {
  const labels = ['not seen', 'weak', 'okay', 'strong']
  return (
    <div className="row small muted" style={{ gap: 10, marginTop: 6 }}>
      {labels.map((l, i) => (
        <span key={l} className="row" style={{ gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: colors.seq[i], display: 'inline-block' }} />
          {l}
        </span>
      ))}
    </div>
  )
}
