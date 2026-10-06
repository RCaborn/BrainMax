import { useEffect, useState } from 'react'

/** Re-renders every `ms` while active (for live timers). */
export function useTicker(active: boolean, ms = 500) {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [active, ms])
}
