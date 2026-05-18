import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import LockScreen from './pages/LockScreen'
import EntryList from './pages/EntryList'
import EntryEditor from './pages/EntryEditor'
function Guard({ children }) {
  const unlocked = useAuth(s => s.unlocked)
  const initializing = useAuth(s => s.initializing)
  const init = useAuth(s => s.init)

  useEffect(() => { init() }, [])

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-base">Loading…</p>
      </div>
    )
  }

  return unlocked ? children : <LockScreen />
}

const BG = 'radial-gradient(ellipse 162% 86% at 0% 100%, #0d2e18 0%, transparent 70%), radial-gradient(ellipse 145% 100% at 110% -6%, #1a3d28 0%, transparent 62%), #0e1310'

export default function App() {
  return (
    <BrowserRouter>
      <div className="fixed inset-0 -z-10" style={{ background: BG }} />
      <Guard>
        <Routes>
          <Route path="/" element={<EntryList />} />
          <Route path="/entry/:id" element={<EntryEditor />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Guard>
    </BrowserRouter>
  )
}
