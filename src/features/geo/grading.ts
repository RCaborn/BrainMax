import type { GeoItem } from './types'

const R = 6371

/** Great-circle distance in km between [lat, lon] points. */
export function haversine(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180
  const dLat = (b[0] - a[0]) * toRad
  const dLon = (b[1] - a[1]) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Distance in km from a point to a polyline of [lat, lon] (local equirectangular approximation per segment). */
export function distanceToPath(p: [number, number], path: [number, number][]): number {
  if (path.length === 1) return haversine(p, path[0])
  let best = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const [a, b] = [path[i], path[i + 1]]
    const k = Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180))
    const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    best = Math.min(best, haversine(p, [ay + t * dy, (ax + t * dx) / k]))
  }
  return best
}

export type ClickResult = 'correct' | 'near' | 'wrong'

/**
 * Grades a map click at [lat, lon].
 * `inside`: whether the click is inside the item's polygon (null if it has none).
 * `clickedNeighbour`: whether the click landed in a country/area bordering the target.
 */
export function gradeClick(item: GeoItem, click: [number, number], inside: boolean | null, clickedNeighbour: boolean): { result: ClickResult; km: number } {
  const km = item.path ? distanceToPath(click, item.path) : haversine(click, [item.lat, item.lon])
  if (inside) return { result: 'correct', km: 0 }
  if (inside === null || item.radiusKm > 0) {
    if (km <= item.radiusKm) return { result: 'correct', km }
  }
  const nearKm = inside === null ? item.radiusKm * 2.5 : Math.max(item.radiusKm * 2.5, 150)
  if (clickedNeighbour || km <= nearKm) return { result: 'near', km }
  return { result: 'wrong', km }
}

// ---------- typed names ----------

export function normalizeName(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bst\./g, 'st')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|county|co) /, '')
    .replace(/^(river|mount|mt|lake|loch|lough|isle of|island of) /, '')
}

function lev(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

export type NameResult = 'correct' | 'typo' | 'wrong'

/** Typo tolerance grows with length: 1 edit from 5 letters, 2 from 10. */
export function gradeName(input: string, accepted: string[]): { result: NameResult; matched?: string } {
  const g = normalizeName(input)
  if (!g) return { result: 'wrong' }
  for (const a of accepted) if (normalizeName(a) === g) return { result: 'correct', matched: a }
  for (const a of accepted) {
    const n = normalizeName(a)
    const allowed = n.length >= 10 ? 2 : n.length >= 5 ? 1 : 0
    if (allowed && lev(n, g) <= allowed) return { result: 'typo', matched: a }
  }
  return { result: 'wrong' }
}
