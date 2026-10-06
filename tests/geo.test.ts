import { describe, expect, it } from 'vitest'
import { DECK, ITEMS, ITEM_BY_ID, MAP_DATA } from '../src/features/geo/data'
import { buildDeck } from '../src/features/geo/deck'
import { distanceToPath, gradeClick, gradeName, haversine, normalizeName } from '../src/features/geo/grading'
import { buildGeoQueue, type GeoStored } from '../src/features/geo/queue'
import { Rating, nextFields } from '../src/lib/srs'
import { geoContains } from 'd3-geo'

describe('data', () => {
  it('has 195 countries, 101 GB areas + 6 NI counties, and curated UK + world items', () => {
    expect(ITEMS.filter((i) => i.kind === 'country')).toHaveLength(195)
    expect(ITEMS.filter((i) => i.kind === 'ukArea')).toHaveLength(101)
    expect(ITEMS.filter((i) => i.kind === 'niCounty')).toHaveLength(6)
    expect(ITEMS.filter((i) => i.uk && i.kind !== 'ukArea' && i.kind !== 'niCounty').length).toBeGreaterThan(100)
    expect(ITEMS.filter((i) => !i.uk && i.kind !== 'country').length).toBeGreaterThan(80)
  })
  it('ids are unique and every card points at a real item', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
    expect(new Set(DECK.map((d) => d.id)).size).toBe(DECK.length)
    for (const d of DECK) expect(ITEM_BY_ID.has(d.itemId)).toBe(true)
  })
  it('deck is ~1,800+ cards with a 30–40% UK share, interleaved from the start', () => {
    expect(DECK.length).toBeGreaterThan(1500)
    const share = DECK.filter((d) => d.uk).length / DECK.length
    expect(share).toBeGreaterThan(0.28)
    expect(share).toBeLessThan(0.42)
    const first100 = DECK.slice(0, 100).filter((d) => d.uk).length
    expect(first100).toBeGreaterThan(25)
    expect(first100).toBeLessThan(45)
  })
  it('every country has map geometry or a point fallback; every polygon id exists', () => {
    const worldIds = new Set(MAP_DATA.world.features.map((f) => f.properties.id))
    const ukIds = new Set(MAP_DATA.ukAreas.features.map((f) => f.properties.id))
    for (const it of ITEMS) {
      if (it.shape?.map === 'world' && !worldIds.has(it.shape.id)) expect(it.radiusKm, it.name).toBeGreaterThan(0)
      if (it.shape?.map === 'uk') expect(ukIds.has(it.shape.id), it.name).toBe(true)
    }
  })
  it('every UK point lies in or very near the UK, and UK areas contain their own centroid area', () => {
    for (const it of ITEMS.filter((i) => i.uk)) {
      expect(it.lat, it.name).toBeGreaterThan(49.8)
      expect(it.lat, it.name).toBeLessThan(61)
      expect(it.lon, it.name).toBeGreaterThan(-8.7)
      expect(it.lon, it.name).toBeLessThan(2)
    }
    // Spot-check: London's centroid is inside Greater London.
    const gl = MAP_DATA.ukAreas.features.find((f) => f.properties.id === 'greater-london')!
    expect(geoContains(gl, [-0.12, 51.5])).toBe(true)
  })
  it('countries have capitals and flags; every fact has an answer', () => {
    for (const it of ITEMS.filter((i) => i.kind === 'country')) {
      expect(it.capital?.length, it.name).toBeGreaterThan(0)
      expect(it.flag).toMatch(/^[a-z]{2}$/)
    }
    for (const it of ITEMS) for (const f of it.facts) expect(f.answer.trim().length, `${it.name}: ${f.prompt}`).toBeGreaterThan(0)
  })
})

describe('grading', () => {
  it('haversine: London → Paris ≈ 344 km', () => {
    expect(haversine([51.5074, -0.1278], [48.8566, 2.3522])).toBeGreaterThan(330)
    expect(haversine([51.5074, -0.1278], [48.8566, 2.3522])).toBeLessThan(355)
  })
  it('distance to a river path', () => {
    const path: [number, number][] = [[51.5, -1], [51.5, 0]]
    expect(distanceToPath([51.5, -0.5], path)).toBeLessThan(1)
    expect(distanceToPath([51.6, -0.5], path)).toBeGreaterThan(10)
  })
  it('clicks: inside polygon = correct; neighbour = near; far = wrong; points use the radius', () => {
    const kenya = ITEM_BY_ID.get('country-KEN')!
    expect(gradeClick(kenya, [0, 37], true, false).result).toBe('correct')
    expect(gradeClick(kenya, [-6, 35], false, true).result).toBe('near')
    expect(gradeClick(kenya, [48, 2], false, false).result).toBe('wrong')
    const antrim = ITEM_BY_ID.get('uk-ni-antrim')!
    expect(gradeClick(antrim, [antrim.lat + 0.1, antrim.lon], null, false).result).toBe('correct')
    expect(gradeClick(antrim, [52, -1], null, false).result).toBe('wrong')
  })
  it('names: accents, articles, prefixes and typos', () => {
    expect(normalizeName('The River Thames')).toBe('thames')
    expect(gradeName('cote d ivoire', ["Côte d'Ivoire", 'Ivory Coast']).result).toBe('correct')
    expect(gradeName('ivory coast', ["Côte d'Ivoire", 'Ivory Coast']).result).toBe('correct')
    expect(gradeName('Kazakstan', ['Kazakhstan']).result).toBe('typo')
    expect(gradeName('Peru', ['Chad']).result).toBe('wrong')
    expect(gradeName('St Lucia', ['Saint Lucia']).result).toBe('correct')
  })
})

describe('queue', () => {
  const t0 = new Date(2026, 0, 1, 12)
  const DAY = 86_400_000
  it('first day: 15 new cards in deck order; misses come back sooner than known cards', () => {
    const deck = buildDeck(ITEMS)
    const q0 = buildGeoQueue(deck, new Map(), new Set(), t0, t0, 15)
    expect(q0).toHaveLength(15)
    expect(q0.map((x) => x.def.id)).toEqual(deck.slice(0, 15).map((d) => d.id))
    const cards = new Map<string, GeoStored>()
    q0.forEach((x, i) => {
      const f = nextFields(undefined, i % 3 === 0 ? Rating.Again : Rating.Good, t0, '2026-01-01')
      cards.set(x.def.id, { id: x.def.id, itemId: x.def.itemId, type: x.def.type, uk: x.def.uk, ...f })
    })
    const t1 = new Date(t0.getTime() + DAY)
    const q1 = buildGeoQueue(deck, cards, new Set(), t1, new Date(t1.getTime() + DAY / 2), 15)
    const reviewIds = q1.filter((x) => x.kind === 'review').map((x) => x.def.id)
    expect(reviewIds.length).toBeGreaterThan(0)
    for (const id of reviewIds) expect(q0.findIndex((x) => x.def.id === id) % 3).toBe(0)
  })
})
