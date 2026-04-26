import { create } from 'zustand'

const TODAY_KEY = 'diary_unlocked_date'

function isUnlockedToday() {
  return localStorage.getItem(TODAY_KEY) === new Date().toDateString()
}

export const useAuth = create(set => ({
  unlocked: isUnlockedToday(),
  unlock: () => {
    localStorage.setItem(TODAY_KEY, new Date().toDateString())
    set({ unlocked: true })
  },
  lock: () => {
    localStorage.removeItem(TODAY_KEY)
    set({ unlocked: false })
  },
}))
