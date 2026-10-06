import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportAll, getMeta, importAll, setMeta } from '../lib/db'
import { dayKey, getTimeOffsetDays, setTimeOffsetDays } from '../lib/day'

export default function SettingsPage() {
  const [msg, setMsg] = useState('')
  const lastBackup = useLiveQuery(() => getMeta<string | null>('lastBackup', null), [])
  const [offset, setOffset] = useState(getTimeOffsetDays())
  const showDev = import.meta.env.DEV || location.search.includes('dev') || offset !== 0

  async function doExport() {
    const json = await exportAll()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `brainmax-backup-${dayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
    await setMeta('lastBackup', new Date().toISOString())
    setMsg('Backup downloaded.')
  }

  async function doImport(file: File) {
    if (!confirm('Replace ALL current progress with this backup?')) return
    try {
      await importAll(await file.text())
      setMsg('Backup restored.')
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    }
  }

  async function reset() {
    if (!confirm('Delete ALL progress? This cannot be undone. Download a backup first if unsure.')) return
    await db.delete()
    location.reload()
  }

  function travel(days: number) {
    setTimeOffsetDays(days)
    setOffset(days)
    location.reload()
  }

  return (
    <>
      <h1>Settings</h1>
      <div className="card">
        <h2>Backup</h2>
        <p className="muted">
          Progress is stored in this browser (IndexedDB). Clearing site data, or opening the app on a different port or
          browser, starts from scratch, so back up now and then.
        </p>
        <p className="small">Last backup: {lastBackup ? new Date(lastBackup).toLocaleString() : 'never'}</p>
        <div className="row">
          <button className="primary" onClick={() => void doExport()}>Download backup</button>
          <label className="btn">
            Restore from file
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
          </label>
        </div>
        {msg && <p className="small" style={{ marginTop: 10 }}>{msg}</p>}
      </div>

      {showDev && (
        <div className="card">
          <h2>Developer: time travel</h2>
          <p className="muted small">Shifts the app's clock to test spaced repetition over days. Current offset: {offset} day(s).</p>
          <div className="row">
            <button onClick={() => travel(offset + 1)}>+1 day</button>
            <button onClick={() => travel(offset + 7)}>+7 days</button>
            <button onClick={() => travel(0)}>Back to today</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Danger zone</h2>
        <button onClick={() => void reset()} style={{ color: 'var(--bad)' }}>Delete all progress</button>
      </div>
    </>
  )
}
