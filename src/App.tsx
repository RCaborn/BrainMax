import { NavLink, Route, Routes } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import TodayPage from './pages/TodayPage'
import MathPage from './pages/MathPage'
import SpanishPage from './pages/SpanishPage'
import PuzzlePage from './pages/PuzzlePage'
import SettingsPage from './pages/SettingsPage'
import { geoLaunchDay, saveSnapshot } from './lib/progress'
import { getTimeOffsetDays } from './lib/day'

// Charts are heavy; load them only when the dashboard opens.
const StatsPage = lazy(() => import('./pages/StatsPage'))
// Maps, flags and geo data load only when Geography opens.
const GeoPage = lazy(() => import('./pages/GeoPage'))

export default function App() {
  useEffect(() => {
    void saveSnapshot()
    void geoLaunchDay()
  }, [])
  const offset = getTimeOffsetDays()
  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">
          Brain<span>Max</span>
        </div>
        <NavLink to="/" end>Today</NavLink>
        <NavLink to="/math">Maths</NavLink>
        <NavLink to="/spanish">Spanish</NavLink>
        <NavLink to="/geo">Geography</NavLink>
        <NavLink to="/puzzle">Puzzle</NavLink>
        <NavLink to="/stats">Progress</NavLink>
        <span className="spacer" />
        {offset !== 0 && <span className="pill bad">time travel +{offset}d</span>}
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/math" element={<MathPage />} />
        <Route path="/spanish" element={<SpanishPage />} />
        <Route path="/puzzle" element={<PuzzlePage />} />
        <Route path="/geo" element={<Suspense fallback={<p className="muted">Loading maps…</p>}><GeoPage /></Suspense>} />
        <Route path="/stats" element={<Suspense fallback={<p className="muted">Loading…</p>}><StatsPage /></Suspense>} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  )
}
