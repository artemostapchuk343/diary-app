import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import LockScreen from './pages/LockScreen'
import EntryList from './pages/EntryList'
import EntryEditor from './pages/EntryEditor'
import Finance from './pages/Finance'
import Travel from './pages/Travel'
import TabBar from './components/TabBar'

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

function Layout({ children }) {
  const { pathname } = useLocation()
  const hideTab = pathname.startsWith('/entry/')
  return (
    <>
      {children}
      {!hideTab && <TabBar />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="bg-layer" aria-hidden="true" />
      <Guard>
        <Layout>
          <Routes>
            <Route path="/" element={<EntryList />} />
            <Route path="/entry/:id" element={<EntryEditor />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/travel" element={<Travel />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </Guard>
    </BrowserRouter>
  )
}
