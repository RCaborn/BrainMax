import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import countries from './data/countries.json'
import ukAreas from './data/ukAreas.json'
import worldTopo from './data/world.topo.json'
import ukTopo from './data/uk.topo.json'
import curated from './data/curated.json'
import { type CountryRow, type UkAreaRow, buildDeck, countryItems, curatedItems, ukAreaItems } from './deck'
import type { MapData } from './GeoMap'
import type { Curated, GeoItem } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
const c = curated as unknown as { uk: Curated[]; world: Curated[] }

export const ITEMS: GeoItem[] = [
  ...countryItems(countries as CountryRow[]),
  ...ukAreaItems(ukAreas as UkAreaRow[]),
  ...curatedItems(c.uk, true),
  ...curatedItems(c.world, false),
]
export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]))
export const DECK = buildDeck(ITEMS)
export const CARD_BY_ID = new Map(DECK.map((d) => [d.id, d]))

const world = feature(worldTopo as any, (worldTopo as any).objects.countries) as unknown as FeatureCollection<Geometry, { id: string }>
// world-atlas keeps the id on the feature, not in properties.
for (const f of world.features as any[]) f.properties = { id: String(f.id) }

export const MAP_DATA: MapData = {
  world,
  ukAreas: feature(ukTopo as any, (ukTopo as any).objects.areas) as any,
  ukNations: feature(ukTopo as any, (ukTopo as any).objects.nations) as any,
}
