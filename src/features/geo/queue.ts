import { State, retrievability, type SrsFields } from '../../lib/srs'
import type { GeoCardDef } from './types'

export const GEO_DAILY = 15
export const GEO_EXTRA = 10

export interface GeoStored extends SrsFields {
  id: string
  itemId: string
  type: string
  uk: boolean
}

export interface GeoQueueItem {
  def: GeoCardDef
  kind: 'review' | 'new'
}

/** Due cards first (most-forgotten first), then new cards in introduction order. */
export function buildGeoQueue(deck: GeoCardDef[], cards: Map<string, GeoStored>, doneToday: Set<string>, now: Date, endOfDay: Date, size: number): GeoQueueItem[] {
  const byId = new Map(deck.map((d) => [d.id, d]))
  const due = [...cards.values()]
    .filter((c) => c.state !== State.New && c.due <= endOfDay.getTime() && !doneToday.has(c.id) && byId.has(c.id))
    .map((c) => ({ c, r: retrievability(c, now) }))
    .sort((a, b) => a.r - b.r || byId.get(a.c.id)!.order - byId.get(b.c.id)!.order)
  const items: GeoQueueItem[] = due.slice(0, size).map(({ c }) => ({ def: byId.get(c.id)!, kind: 'review' }))
  for (const d of deck) {
    if (items.length >= size) break
    if (!cards.has(d.id) && !doneToday.has(d.id)) items.push({ def: d, kind: 'new' })
  }
  return items
}

/** Estimated share of a set of cards you'd recall now. */
export function recallShare(cards: GeoStored[], ids: string[], now: Date): number {
  if (!ids.length) return 0
  const map = new Map(cards.map((c) => [c.id, c]))
  return ids.reduce((s, id) => s + (map.has(id) ? retrievability(map.get(id)!, now) : 0), 0) / ids.length
}
