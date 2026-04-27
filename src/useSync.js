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

  trigger: async (force = false) => {
    const { syncing, lastSync } = get()
    if (syncing) return
    if (!isSignedIn()) return
    if (!force && lastSync && Date.now() - lastSync < MIN_INTERVAL_MS) return

    set({ syncing: true, error: '', result: null, progress: 'Syncing…' })

    try {
      const [entries, allAttachments] = await Promise.all([
        db.entries.toArray(),
        db.attachments.toArray(),
      ])

      const attsByEntryId = {}
      allAttachments.forEach(att => {
        if (!attsByEntryId[att.entryId]) attsByEntryId[att.entryId] = []
        attsByEntryId[att.entryId].push(att)
      })

      const entriesWithAtts = entries.map(e => ({
        ...e,
        attachments: attsByEntryId[e.id] || [],
      }))

      const res = await sync(entriesWithAtts, {
        onProgress: msg => set({ progress: msg }),
        onNewEntry: async parsed => {
          const existing = await db.entries.where('sourceId').equals(String(parsed.id || '')).first()
            || await db.entries.where('createdAt').equals(parsed.createdAt || '').first()
          if (existing) return existing.id
          const newId = await db.entries.add({
            sourceId: String(parsed.id || ''),
            title: parsed.title || '',
            body: parsed.body || '',
            mood: parsed.mood || '',
            createdAt: parsed.createdAt || new Date().toISOString(),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          })
          return newId
        },
        onSaveAttachment: async (localEntryId, attachment) => {
          if (!localEntryId) return
          const existing = await db.attachments
            .where('entryId').equals(Number(localEntryId))
            .and(a => a.name === attachment.name)
            .first()
          if (!existing) {
            await db.attachments.add({ ...attachment, entryId: Number(localEntryId) })
          }
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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    useSync.getState().trigger()
  }
})
