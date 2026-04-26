import Dexie from 'dexie'

export const db = new Dexie('DiaryDB')

db.version(1).stores({
  entries: '++id, date, createdAt, updatedAt',
  attachments: '++id, entryId',
  settings: 'key',
})
