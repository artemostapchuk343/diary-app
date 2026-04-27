import { create } from 'zustand'
import { hasPassword, loadPasswordConfig } from './crypto'

const TODAY_KEY = 'diary_unlocked_date'

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
      const { silentSignIn, downloadPasswordConfig } = await import('./googleDrive')
      const ok = await silentSignIn()
      if (ok) {
        const config = await downloadPasswordConfig()
        if (config?.salt && config?.verify) {
          loadPasswordConfig(config)
        }
      }
    } catch (e) {
      console.error('Auth init failed:', e)
    }
    set({ initializing: false })
  },

  restoreFromDrive: async () => {
    localStorage.removeItem('diary_verify')
    localStorage.removeItem('diary_salt')
    localStorage.removeItem('diary_unlocked_date')
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
