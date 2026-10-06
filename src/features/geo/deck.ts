import type { Curated, GeoCardDef, GeoItem, MapView } from './types'
import { fitsView } from './projection'

export interface CountryRow {
  id: string
  ccn3: string
  flag: string
  name: string
  alt: string[]
  capital: string[]
  region: string
  subregion: string
  lat: number
  lon: number
  borders: string[]
  area: number
  pop: number | null
}

export interface UkAreaRow {
  id: string
  name: string
  nation: string
  alt: string[]
  lat: number
  lon: number
  areaKm2: number
  neighbours: string[]
}

/** Northern Ireland's six counties (point-based: no clean boundary data). Approximate centres. */
export const NI_COUNTIES: { name: string; lat: number; lon: number; alt: string[] }[] = [
  { name: 'Antrim', lat: 54.85, lon: -6.2, alt: ['County Antrim'] },
  { name: 'Armagh', lat: 54.3, lon: -6.6, alt: ['County Armagh'] },
  { name: 'Down', lat: 54.35, lon: -5.9, alt: ['County Down'] },
  { name: 'Fermanagh', lat: 54.35, lon: -7.6, alt: ['County Fermanagh'] },
  { name: 'Londonderry', lat: 54.92, lon: -6.9, alt: ['County Londonderry', 'Derry', 'County Derry'] },
  { name: 'Tyrone', lat: 54.6, lon: -7.25, alt: ['County Tyrone'] },
]

export function viewForCountry(c: Pick<CountryRow, 'region' | 'subregion'>): MapView {
  if (c.region === 'Europe') return 'europe'
  if (c.region === 'Asia') return 'asia'
  if (c.region === 'Africa') return 'africa'
  if (c.region === 'Oceania') return 'oceania'
  if (c.subregion === 'South America') return 'southAmerica'
  if (c.region === 'Americas') return 'northAmerica'
  return 'world'
}

const VIEW_BY_REGION: Record<string, MapView> = {
  Europe: 'europe', Asia: 'asia', Africa: 'africa', Oceania: 'oceania', Australia: 'oceania',
  'North America': 'northAmerica', 'Central America': 'northAmerica', 'South America': 'southAmerica',
}

export function countryItems(rows: CountryRow[]): GeoItem[] {
  return rows.map((c, rank) => ({
    id: `country-${c.id}`,
    name: c.name,
    alt: c.alt,
    kind: 'country',
    uk: false,
    region: c.region,
    view: viewForCountry(c),
    lat: c.lat,
    lon: c.lon,
    // Tiny countries may not be clickable as polygons: accept clicks near their centre.
    radiusKm: c.area < 2_000 ? 80 : c.area < 25_000 ? 50 : 0,
    shape: { map: 'world', id: c.ccn3 },
    familiarity: rank < 30 ? 1 : rank < 80 ? 2 : rank < 140 ? 3 : 4,
    capital: c.capital,
    flag: c.flag,
    borders: c.borders.map((b) => `country-${b}`),
    facts: [],
  }))
}

export function ukAreaItems(rows: UkAreaRow[]): GeoItem[] {
  const areas: GeoItem[] = rows.map((a) => ({
    id: `uk-area-${a.id}`,
    name: a.name,
    alt: a.alt,
    kind: 'ukArea',
    uk: true,
    region: a.nation,
    view: 'uk',
    lat: a.lat,
    lon: a.lon,
    radiusKm: a.areaKm2 < 400 ? 12 : 0,
    shape: { map: 'uk', id: a.id },
    familiarity: a.nation === 'England' ? 2 : a.areaKm2 > 3000 ? 2 : 3,
    borders: a.neighbours.map((n) => `uk-area-${n}`),
    facts: [],
  }))
  const ni: GeoItem[] = NI_COUNTIES.map((c) => ({
    id: `uk-ni-${c.name.toLowerCase()}`,
    name: c.name,
    alt: c.alt,
    kind: 'niCounty',
    uk: true,
    region: 'Northern Ireland',
    view: 'uk',
    lat: c.lat,
    lon: c.lon,
    radiusKm: 30,
    familiarity: 3,
    facts: [],
  }))
  return [...areas, ...ni]
}

/** The continent map when the whole feature (point and path) is on it, else the world map. Oceans always use the world map. */
function regionalView(c: Curated): MapView {
  const v = VIEW_BY_REGION[c.region]
  const pts: [number, number][] = [[c.lat, c.lon], ...((c.path ?? []) as [number, number][])]
  return v && c.radiusKm < 1500 && fitsView(v, pts) ? v : 'world'
}

export function curatedItems(list: Curated[], uk: boolean): GeoItem[] {
  return list.map((c) => ({
    id: `${uk ? 'uk' : 'world'}-${c.id}`,
    name: c.name,
    alt: c.altNames,
    kind: c.kind,
    uk,
    region: c.region,
    view: uk ? 'uk' : regionalView(c),
    lat: c.lat,
    lon: c.lon,
    radiusKm: Math.max(c.radiusKm, uk ? 8 : 40),
    path: c.path?.length ? (c.path as [number, number][]) : undefined,
    familiarity: c.familiarity,
    facts: c.facts,
  }))
}

/**
 * Card definitions with an introduction order. Within each item the easier card types come first,
 * spaced out so an item's later cards arrive after others have been introduced.
 * UK and world cards are interleaved about 35:65.
 */
export function buildDeck(items: GeoItem[], ukShare = 0.35): GeoCardDef[] {
  const uk: GeoCardDef[] = []
  const world: GeoCardDef[] = []
  const byFamiliarity = [...items].sort((a, b) => a.familiarity - b.familiarity)
  const idx = new Map<string, number>()
  byFamiliarity.forEach((it, i) => idx.set(it.id, i))

  for (const it of items) {
    const base = idx.get(it.id)!
    const list = it.uk ? uk : world
    const add = (type: GeoCardDef['type'], offset: number, factIndex?: number) =>
      list.push({ id: factIndex === undefined ? `${type}:${it.id}` : `fact:${it.id}:${factIndex}`, itemId: it.id, type, factIndex, uk: it.uk, order: base + offset })
    if (it.kind === 'country') {
      add('locate', 0)
      add('capital', 15)
      add('flag', 45)
      add('name', 80)
      add('capitalOf', 120)
    } else {
      add('locate', 0)
      if (it.kind === 'ukArea') add('name', 40)
      it.facts.forEach((_, i) => add('fact', 20 + i * 15, i))
    }
  }
  uk.sort((a, b) => a.order - b.order)
  world.sort((a, b) => a.order - b.order)

  // Interleave by share: always take from whichever list is furthest behind its target share.
  const out: GeoCardDef[] = []
  let u = 0
  let w = 0
  while (u < uk.length || w < world.length) {
    const takeUk = w >= world.length || (u < uk.length && u <= ukShare * (out.length + 1) - 1e-9)
    const card = takeUk ? uk[u++] : world[w++]
    out.push({ ...card, order: out.length })
  }
  return out
}
