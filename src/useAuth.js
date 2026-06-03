import { create } from 'zustand'
import { hasPassword, loadPasswordConfig } from './crypto'

// One-time migration: diary_unlocked_date → dashboard_unlocked_date
;(function () {
  const old = localStorage.getItem('diary_unlocked_date')
  if (old !== null && localStorage.getItem('dashboard_unlocked_date') === null) {
    localStorage.setItem('dashboard_unlocked_date', old)
    localStorage.removeItem('diary_unlocked_date')
  }
})()

const TODAY_KEY = 'dashboard_unlocked_date'
const HIDDEN_AT_KEY = 'dashboard_hidden_at'
const AUTO_LOCK_MS = 2 * 60 * 60 * 1000

function isUnlockedToday() {
  return localStorage.getItem(TODAY_KEY) === new Date().toDateString()
}

export const useAuth = create((set) => ({
  unlocked: isUnlockedToday(),
  initializing: !isUnlockedToday() && !hasPassword(),

  unlock: () => {
    localStorage.setItem(TODAY_KEY, new Date().toDateString())
    set({ unlocked: true })
  },
  lock: () => {
    localStorage.removeItem(TODAY_KEY)
    set({ unlocked: false })
  },

  init: async () => {
    if (hasPassword()) {
      set({ initializing: false })
      return
    }
    try {
      const { silentSignIn, downloadPasswordConfig, isConfigured, signIn } = await import('./googleDrive')
      const ok = await silentSignIn()
      if (ok) {
        const config = await downloadPasswordConfig()
        if (config?.salt && config?.verify) {
          loadPasswordConfig(config)
        }
      } else if (isConfigured() && !sessionStorage.getItem('gdrive_auth_attempted')) {
        sessionStorage.setItem('gdrive_auth_attempted', '1')
        signIn()
        return
      }
    } catch (e) {
      console.error('Auth init failed:', e)
    }
    set({ initializing: false })
  },

  checkAutoLock: () => {
    const hiddenAt = sessionStorage.getItem(HIDDEN_AT_KEY)
    if (!hiddenAt) return
    sessionStorage.removeItem(HIDDEN_AT_KEY)
    if (Date.now() - Number(hiddenAt) > AUTO_LOCK_MS) {
      localStorage.removeItem(TODAY_KEY)
      set({ unlocked: false })
    }
  },

  restoreFromDrive: async () => {
    localStorage.removeItem('dashboard_verify')
    localStorage.removeItem('dashboard_salt')
    localStorage.removeItem('dashboard_unlocked_date')
    set({ initializing: true, unlocked: false })
    try {
      const { silentSignIn, downloadPasswordConfig, signIn } = await import('./googleDrive')
      const ok = await silentSignIn()
      if (ok) {
        const config = await downloadPasswordConfig()
        if (config?.salt && config?.verify) {
          loadPasswordConfig(config)
        }
      } else {
        signIn()
        return
      }
    } catch (e) {
      console.error('Restore failed:', e)
    }
    set({ initializing: false })
  },
}))

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sessionStorage.setItem(HIDDEN_AT_KEY, String(Date.now()))
  } else if (document.visibilityState === 'visible') {
    useAuth.getState().checkAutoLock()
  }
})
