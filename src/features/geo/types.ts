export type MapView = 'uk' | 'world' | 'europe' | 'asia' | 'africa' | 'oceania' | 'northAmerica' | 'southAmerica'

export interface Fact {
  prompt: string
  answer: string
  accept: string[]
}

/** Anything that can be quizzed: a country, a UK area, a city, a river … */
export interface GeoItem {
  id: string
  name: string
  alt: string[]
  /** country | ukArea | niCounty | city | river | peak | range | nationalPark | island | islandGroup | sea | … */
  kind: string
  uk: boolean
  /** Continent / UK nation. */
  region: string
  view: MapView
  lat: number
  lon: number
  /** Click tolerance for point-like items (km). */
  radiusKm: number
  /** Polygon to test clicks against, if the item has one. */
  shape?: { map: 'world'; id: string } | { map: 'uk'; id: string }
  /** Rivers: [lat, lon] points from source to mouth. */
  path?: [number, number][]
  /** 1 = everyone knows it … 5 = specialist. */
  familiarity: number
  /** Countries only. */
  capital?: string[]
  flag?: string
  borders?: string[]
  facts: Fact[]
}

export type CardType = 'locate' | 'name' | 'capital' | 'capitalOf' | 'flag' | 'fact'

export interface GeoCardDef {
  id: string
  itemId: string
  type: CardType
  factIndex?: number
  uk: boolean
  /** Introduction order (lower = earlier). */
  order: number
}

export interface Curated {
  id: string
  name: string
  altNames: string[]
  kind: string
  region: string
  lat: number
  lon: number
  radiusKm: number
  path?: number[][]
  facts: Fact[]
  familiarity: number
}
