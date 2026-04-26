import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import LockScreen from './pages/LockScreen'
import EntryList from './pages/EntryList'
import EntryEditor from './pages/EntryEditor'

function Guard({ children }) {
  const unlocked = useAuth(s => s.unlocked)
  return unlocked ? children : <LockScreen />
}

export default function App() {
  return (
    <BrowserRouter>
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
