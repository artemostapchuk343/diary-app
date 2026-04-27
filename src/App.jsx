import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import LockScreen from './pages/LockScreen'
import EntryList from './pages/EntryList'
import EntryEditor from './pages/EntryEditor'
import NatureBackground from './components/NatureBackground'

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

export default function App() {
  return (
    <BrowserRouter>
      <NatureBackground />
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
