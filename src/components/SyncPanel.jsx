import { useState, useEffect } from 'react'
import { Cloud, CloudOff, RefreshCw, LogOut, AlertCircle } from 'lucide-react'
import { isConfigured, isSignedIn, signIn, signOut, silentSignIn } from '../googleDrive'
import { useSync } from '../useSync'

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(diff / 3600)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(diff / 86400)} d ago`
}

export default function SyncPanel() {
  const [connected, setConnected] = useState(isSignedIn())
  const [connectError] = useState('')
  const [, setTick] = useState(0)
  const { syncing, progress, lastSync, error, result, trigger } = useSync()

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!isConfigured()) return
    silentSignIn().then(ok => {
      setConnected(ok)
      if (ok) trigger()
    })
    function onConnected() {
      setConnected(true)
      trigger()
    }
    window.addEventListener('gdrive-connected', onConnected)
    return () => window.removeEventListener('gdrive-connected', onConnected)
  }, [])

  function handleConnect() {
    signIn()
  }

  function handleDisconnect() {
    signOut()
    setConnected(false)
  }

  if (!isConfigured()) return null

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleTimeString()
    : localStorage.getItem('last_sync')

  return (
    <div className="mt-2 mb-6 bg-white/5 border border-white/10 rounded-xl px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {connected
            ? <Cloud size={20} className="text-indigo-400" />
            : <CloudOff size={20} className="text-slate-500" />
          }
          <div>
            <p className="text-white text-sm font-medium">
              {connected ? 'Google Drive connected' : 'Google Drive'}
            </p>
            {connected && !syncing && !result && lastSyncLabel && (
              <p className="text-slate-500 text-xs">Last sync: {lastSyncLabel}</p>
            )}
            {syncing && <p className="text-slate-400 text-xs">{progress || 'Syncing…'}</p>}
            {result && !syncing && result.uploaded === 0 && result.downloaded === 0 && (
              <p className="text-emerald-400 text-xs">Up to date · {lastSync ? relativeTime(lastSync) : ''}</p>
            )}
            {result && !syncing && (result.uploaded > 0 || result.downloaded > 0) && (
              <p className="text-slate-400 text-xs">
                ↑ {result.uploaded} · ↓ {result.downloaded} · {lastSync ? relativeTime(lastSync) : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <button
                onClick={() => trigger(true)}
                disabled={syncing}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
              <button
                onClick={handleDisconnect}
                className="text-slate-500 hover:text-slate-300 transition-colors p-2"
                title="Disconnect"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Cloud size={15} />
              Connect
            </button>
          )}
        </div>
      </div>

      {(error || connectError) && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle size={14} />
          {connectError || error}
        </div>
      )}
    </div>
  )
}
