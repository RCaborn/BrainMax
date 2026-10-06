import { type ReactNode, useMemo, useRef } from 'react'
import { geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeoItem, MapView } from './types'
import { H, W, projectionFor } from './projection'

export interface MapData {
  world: FeatureCollection<Geometry, { id: string }>
  ukAreas: FeatureCollection<Geometry, { id: string; name: string; nation: string }>
  ukNations: FeatureCollection<Geometry, { name: string }>
}

export interface Mark {
  lat: number
  lon: number
  tone: 'good' | 'bad' | 'warn'
}

interface Props {
  view: MapView
  data: MapData
  /** Item to show (filled polygon, point or river line). */
  show?: GeoItem
  showTone?: 'accent' | 'good'
  marks?: Mark[]
  onClick?: (latlon: [number, number], shapeId: string | null) => void
}

export default function GeoMap({ view, data, show, showTone = 'accent', marks = [], onClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const projection = useMemo(() => projectionFor(view), [view])
  const path = useMemo(() => geoPath(projection), [projection])
  const worldPaths = useMemo(() => data.world.features.map((f) => ({ id: f.properties.id, d: path(f) ?? '' })), [data, path])
  const ukPaths = useMemo(
    () => (view === 'uk' ? data.ukAreas.features.map((f) => ({ id: f.properties.id, nation: f.properties.nation, d: path(f) ?? '' })) : []),
    [data, path, view],
  )
  const nationPaths = useMemo(() => (view === 'uk' ? data.ukNations.features.map((f) => path(f) ?? '') : []), [data, path, view])

  const fill = showTone === 'good' ? 'var(--good)' : 'var(--accent)'
  let highlight: ReactNode = null
  if (show) {
    const shapeFeature: Feature | undefined = show.shape
      ? show.shape.map === 'world'
        ? data.world.features.find((f) => f.properties.id === show.shape!.id)
        : data.ukAreas.features.find((f) => f.properties.id === show.shape!.id)
      : undefined
    const pt = projection([show.lon, show.lat])
    if (show.path) {
      const line = { type: 'LineString' as const, coordinates: show.path.map(([la, lo]) => [lo, la]) }
      highlight = <path d={path(line) ?? ''} fill="none" stroke={fill} strokeWidth={4} strokeLinecap="round" />
    } else if (shapeFeature) {
      highlight = (
        <>
          <path d={path(shapeFeature) ?? ''} fill={fill} fillOpacity={0.85} stroke={fill} strokeWidth={1} />
          {show.radiusKm > 0 && pt && <circle cx={pt[0]} cy={pt[1]} r={9} fill="none" stroke={fill} strokeWidth={2.5} />}
        </>
      )
    } else if (pt) {
      highlight = <circle cx={pt[0]} cy={pt[1]} r={8} fill={fill} stroke="var(--surface)" strokeWidth={2} />
    }
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onClick || !svgRef.current) return
    const pt = svgRef.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svgRef.current.getScreenCTM()
    if (!ctm) return
    const p = pt.matrixTransform(ctm.inverse())
    const ll = projection.invert?.([p.x, p.y])
    if (!ll) return
    const target = e.target as SVGElement
    onClick([ll[1], ll[0]], target.dataset?.id ?? null)
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="geo-map"
      onClick={handleClick}
      style={{ cursor: onClick ? 'crosshair' : 'default' }}
      role="img"
      aria-label="Map"
    >
      <rect width={W} height={H} fill="var(--sea)" />
      {worldPaths.map((p) => (
        <path key={p.id} d={p.d} data-id={view === 'uk' ? undefined : p.id} fill="var(--land)" stroke="var(--border-strong)" strokeWidth={0.6} />
      ))}
      {ukPaths.map((p) => (
        <path key={p.id} d={p.d} data-id={p.id} fill="var(--land-uk)" stroke="var(--border-strong)" strokeWidth={0.5} />
      ))}
      {nationPaths.map((d, i) => (
        <path key={i} d={d} fill={i === 3 ? 'var(--land-uk)' : 'none'} stroke="var(--text-2)" strokeWidth={1.1} pointerEvents={i === 3 ? 'auto' : 'none'} />
      ))}
      {highlight}
      {marks.map((m, i) => {
        const p = projection([m.lon, m.lat])
        if (!p) return null
        const c = m.tone === 'good' ? 'var(--good)' : m.tone === 'warn' ? 'var(--warn)' : 'var(--bad)'
        return (
          <g key={i}>
            <line x1={p[0] - 7} y1={p[1] - 7} x2={p[0] + 7} y2={p[1] + 7} stroke={c} strokeWidth={3} />
            <line x1={p[0] - 7} y1={p[1] + 7} x2={p[0] + 7} y2={p[1] - 7} stroke={c} strokeWidth={3} />
          </g>
        )
      })}
    </svg>
  )
}
