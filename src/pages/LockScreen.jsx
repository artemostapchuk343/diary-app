import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { verifyPassword, savePasswordVerifier, hasPassword } from '../crypto'
import { useAuth } from '../useAuth'

export default function LockScreen() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [isNew] = useState(!hasPassword())
  const unlock = useAuth(s => s.unlock)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (isNew) {
      if (password.length < 4) return setError('Password must be at least 4 characters.')
      if (password !== confirm) return setError('Passwords do not match.')
      await savePasswordVerifier(password)
      unlock()
    } else {
      const ok = await verifyPassword(password)
      if (!ok) return setError('Wrong password.')
      unlock()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f13]">
      <div className="w-full max-w-md px-8">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center mb-5">
            <Lock size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-white">My Diary</h1>
          <p className="text-slate-400 text-base mt-2">
            {isNew ? 'Set a password to protect your diary' : 'Enter your password to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-lg placeholder-slate-500 outline-none focus:border-indigo-500 pr-14"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {show ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
          </div>

          {isNew && (
            <input
              type={show ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-lg placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          )}

          {error && <p className="text-red-400 text-base">{error}</p>}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-medium rounded-xl py-4 transition-colors"
          >
            {isNew ? 'Create Password' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
