import { create } from 'zustand'
import { isSignedIn, sync } from './googleDrive'
import { db } from './db'

const MIN_INTERVAL_MS = 30_000

export const useSync = create((set, get) => ({
  syncing: false,
  lastSync: null,
  progress: '',
  error: '',
  result: null,

  trigger: async () => {
    const { syncing, lastSync } = get()
    if (syncing) return
    if (!isSignedIn()) return
    if (lastSync && Date.now() - lastSync < MIN_INTERVAL_MS) return

    set({ syncing: true, error: '', result: null, progress: 'Syncing…' })

    try {
      const entries = await db.entries.toArray()

      const res = await sync(entries, {
        onProgress: msg => set({ progress: msg }),
        onNewEntry: async parsed => {
          await db.entries.add({
            title: parsed.title || '',
            body: parsed.body || '',
            mood: parsed.mood || '',
            createdAt: parsed.createdAt || new Date().toISOString(),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          })
        },
        onUpdateEntry: async (id, parsed) => {
          await db.entries.update(id, {
            title: parsed.title,
            body: parsed.body,
            mood: parsed.mood,
            updatedAt: parsed.updatedAt,
          })
        },
        onDeleteEntry: async id => {
          await db.attachments.where('entryId').equals(Number(id)).delete()
          await db.entries.delete(Number(id))
        },
      })

      const now = Date.now()
      localStorage.setItem('last_sync', new Date(now).toLocaleTimeString())
      set({ result: res, lastSync: now })
    } catch (e) {
      console.error('Auto-sync error:', e)
      set({ error: e.message })
    } finally {
      set({ syncing: false, progress: '' })
    }
  },
}))
