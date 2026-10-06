import { geoMercator, geoNaturalEarth1, geoTransverseMercator, type GeoProjection } from 'd3-geo'
import type { MapView } from './types'

export const W = 800
export const H = 600

/** Points spanning each view (lon, lat); fitting to them frames the region. */
const FRAMES: Record<MapView, [number, number][]> = {
  // Natural Earth is widest at the equator, so frame on it or the far Pacific gets cropped.
  world: [[-180, 0], [180, 0], [-170, -56], [180, -56], [-170, 78], [180, 78]],
  europe: [[-24, 35], [44, 35], [-24, 70], [44, 70]],
  asia: [[26, -10], [148, -10], [26, 55], [148, 55]],
  africa: [[-19, -35], [52, -35], [-19, 37], [52, 37]],
  oceania: [[112, -47], [-172, -47], [112, 2], [-172, 2], [180, -20]],
  northAmerica: [[-168, 8], [-52, 8], [-168, 72], [-52, 72]],
  southAmerica: [[-82, -56], [-34, -56], [-82, 13], [-34, 13]],
  uk: [[-8.2, 49.9], [1.8, 49.9], [-8.2, 60.9], [1.8, 60.9]],
}

const cache = new Map<MapView, GeoProjection>()

export function projectionFor(view: MapView): GeoProjection {
  let p = cache.get(view)
  if (!p) {
    const base = view === 'uk' ? geoTransverseMercator().rotate([2, 0]) : view === 'world' ? geoNaturalEarth1() : view === 'oceania' ? geoMercator().rotate([-160, 0]) : geoMercator()
    p = base.fitExtent([[12, 12], [W - 12, H - 12]], { type: 'MultiPoint', coordinates: FRAMES[view] })
    cache.set(view, p)
  }
  return p
}

/** True when every [lat, lon] point lands on the visible map for this view. */
export function fitsView(view: MapView, points: [number, number][]): boolean {
  const p = projectionFor(view)
  return points.every(([lat, lon]) => {
    const xy = p([lon, lat])
    return !!xy && xy[0] >= 4 && xy[0] <= W - 4 && xy[1] >= 4 && xy[1] <= H - 4
  })
}
