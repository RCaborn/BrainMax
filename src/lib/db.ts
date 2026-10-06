import Dexie, { type Table } from 'dexie'

export type Dir = 'r' | 'p' // recognition (ES→EN) | production (EN→ES)

export interface StoredCard {
  id: string // `${wordId}:${dir}`
  wordId: number
  dir: Dir
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: number | null
  created: string // day key
}

export interface ReviewLog {
  id?: number
  cardId: string
  wordId: number
  dir: Dir
  ts: number
  day: string
  rating: number
  result: string
  ms: number
  answer: string
}

export interface MathAttempt {
  id?: number
  sessionId: number
  ts: number
  day: string
  mode: string
  category: string
  level: number
  prompt: string
  answer: number
  given: string
  correct: boolean
  ms: number
  targetMs: number
}

export interface MathSession {
  id?: number
  day: string
  ts: number
  mode: string
  correct: number
  total: number
  totalMs: number
  score: number
}

export interface MathLevel {
  category: string
  level: number
  streak: number
}

export interface PuzzleResult {
  id?: number
  day: string
  type: string
  daily: boolean
  solved: boolean
  score: number
  ms: number
  ts: number
  detail?: unknown
}

export interface FermiAnswer {
  id?: number
  day: string
  qid: number
  low: number
  high: number
  answer: number
  hit: boolean
  ts: number
}

export interface DailyStatus {
  day: string
  math: boolean
  spanish: boolean
  puzzle: boolean
  spanishCount: number
}

export interface Snapshot {
  day: string
  recallEstimate: number
  learning: number
  young: number
  mature: number
  production: number
}

export interface Accepted {
  key: string // `${wordId}:${dir}`
  answers: string[]
}

export interface Meta {
  key: string
  value: unknown
}

export class BrainDb extends Dexie {
  cards!: Table<StoredCard, string>
  reviews!: Table<ReviewLog, number>
  mathAttempts!: Table<MathAttempt, number>
  mathSessions!: Table<MathSession, number>
  mathLevels!: Table<MathLevel, string>
  puzzles!: Table<PuzzleResult, number>
  fermi!: Table<FermiAnswer, number>
  daily!: Table<DailyStatus, string>
  snapshots!: Table<Snapshot, string>
  accepted!: Table<Accepted, string>
  meta!: Table<Meta, string>

  constructor(name = 'brainmax') {
    super(name)
    this.version(1).stores({
      cards: 'id, wordId, dir, due, state',
      reviews: '++id, cardId, wordId, day, ts',
      mathAttempts: '++id, sessionId, day, category, ts',
      mathSessions: '++id, day, mode, ts',
      mathLevels: 'category',
      puzzles: '++id, day, type, ts',
      fermi: '++id, day, qid',
      daily: 'day',
      snapshots: 'day',
      accepted: 'key',
      meta: 'key',
    })
  }
}

export const db = new BrainDb()

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value })

export async function markDaily(day: string, patch: Partial<Omit<DailyStatus, 'day'>>) {
  await db.transaction('rw', db.daily, async () => {
    const cur = (await db.daily.get(day)) ?? { day, math: false, spanish: false, puzzle: false, spanishCount: 0 }
    await db.daily.put({ ...cur, ...patch })
  })
}

const TABLES = [
  'cards', 'reviews', 'mathAttempts', 'mathSessions', 'mathLevels',
  'puzzles', 'fermi', 'daily', 'snapshots', 'accepted', 'meta',
] as const

export async function exportAll(): Promise<string> {
  const out: Record<string, unknown[]> = {}
  for (const t of TABLES) out[t] = await db.table(t).toArray()
  return JSON.stringify({ app: 'brainmax', version: 1, exported: new Date().toISOString(), data: out })
}

export async function importAll(json: string) {
  const parsed = JSON.parse(json)
  if (parsed?.app !== 'brainmax' || !parsed.data) throw new Error('Not a BrainMax backup file')
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      const rows = parsed.data[t]
      if (Array.isArray(rows)) await db.table(t).bulkPut(rows)
    }
  })
}
