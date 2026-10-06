export interface GameResult {
  solved: boolean
  score: number
  ms: number
  detail?: unknown
}

export interface GameProps {
  seed: string
  onFinish: (r: GameResult) => void
}

export const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
