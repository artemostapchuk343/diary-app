import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Lock, BookOpen, FileUp, Calendar } from 'lucide-react'
import { db } from '../db'
import { format } from 'date-fns'
import { useAuth } from '../useAuth'
import SyncPanel from '../components/SyncPanel'
import { useSync } from '../useSync'
import { markdownToEntry } from '../googleDrive'

function parseImportedFile(filename, content) {
  const ext = filename.split('.').pop().toLowerCase()
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')

  if (ext === 'md' || ext === 'markdown') {
    const parsed = markdownToEntry(content)
    if (parsed) {
      return {
        title: parsed.title || nameWithoutExt,
        body: parsed.body || '',
        mood: parsed.mood || '',
      }
    }
  }

  let body = content
  if (ext === 'rtf') {
    body = content
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/\\[a-z]+\d* ?/g, '')
      .replace(/[{}\\]/g, '')
      .trim()
  }

  return { title: nameWithoutExt, body, mood: '' }
}

function ImportModal({ files, onConfirm, onCancel }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
      <div className="bg-[#1a1a22] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-white text-lg font-semibold mb-1">Import {files.length > 1 ? `${files.length} files` : `"${files[0]?.name}"`}</h2>
        <p className="text-slate-400 text-sm mb-5">Choose the date for {files.length > 1 ? 'these entries' : 'this entry'}.</p>

        <label className="block text-slate-400 text-sm mb-2">Entry date</label>
        <div className="relative mb-6">
          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white text-base outline-none focus:border-indigo-500 [color-scheme:dark]"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-base font-medium rounded-xl py-3 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(date)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-base font-medium rounded-xl py-3 transition-colors"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EntryList() {
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [pendingFiles, setPendingFiles] = useState(null)
  const importRef = useRef()
  const navigate = useNavigate()
  const lock = useAuth(s => s.lock)
  const triggerSync = useSync(s => s.trigger)

  useEffect(() => {
    loadEntries()
    triggerSync()
  }, [])

  async function loadEntries() {
    const all = await db.entries.orderBy('createdAt').reverse().toArray()
    setEntries(all)
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setPendingFiles(files)
    e.target.value = ''
  }

  async function confirmImport(dateStr) {
    setPendingFiles(null)
    setImporting(true)
    // Use noon local time to avoid date shifting across timezones
    const isoDate = new Date(`${dateStr}T12:00:00`).toISOString()
    try {
      let lastId = null
      for (const file of pendingFiles) {
        const content = await file.text()
        const { title, body, mood } = parseImportedFile(file.name, content)
        lastId = await db.entries.add({ title, body, mood, createdAt: isoDate, updatedAt: isoDate })
      }
      await loadEntries()
      if (pendingFiles.length === 1 && lastId) navigate(`/entry/${lastId}`)
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      setImporting(false)
    }
  }

  const filtered = query.trim()
    ? entries.filter(e =>
        e.title?.toLowerCase().includes(query.toLowerCase()) ||
        e.body?.toLowerCase().includes(query.toLowerCase())
      )
    : entries

  return (
    <div className="min-h-screen bg-[#0f0f13] flex flex-col max-w-2xl mx-auto px-6 py-8">
      {pendingFiles && (
        <ImportModal
          files={pendingFiles}
          onConfirm={confirmImport}
          onCancel={() => setPendingFiles(null)}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BookOpen size={28} className="text-indigo-400" />
          <h1 className="text-2xl font-semibold text-white">My Diary</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => importRef.current.click()}
            disabled={importing}
            title="Import from file"
            className="text-slate-500 hover:text-slate-300 disabled:opacity-50 transition-colors"
          >
            <FileUp size={22} />
          </button>
          <button onClick={lock} className="text-slate-500 hover:text-slate-300 transition-colors">
            <Lock size={22} />
          </button>
        </div>
        <input
          ref={importRef}
          type="file"
          multiple
          accept=".txt,.md,.markdown,.rtf,.text"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <SyncPanel />

      <div className="relative mb-5">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search entries..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-5 py-3.5 text-white text-base placeholder-slate-500 outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex-1 space-y-3">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <BookOpen size={48} className="mb-4 opacity-30" />
            <p className="text-base">{query ? 'No entries found.' : 'No entries yet. Start writing!'}</p>
          </div>
        )}
        {filtered.map(entry => (
          <button
            key={entry.id}
            onClick={() => navigate(`/entry/${entry.id}`)}
            className="w-full text-left bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl p-5 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base truncate">
                  {entry.title || 'Untitled'}
                </p>
                <p className="text-slate-400 text-sm mt-1.5 line-clamp-2 leading-relaxed">{entry.body}</p>
              </div>
              <span className="text-slate-500 text-sm whitespace-nowrap mt-0.5">
                {format(new Date(entry.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
            {entry.mood && (
              <span className="mt-3 inline-block text-2xl">{entry.mood}</span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => navigate('/entry/new')}
        className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-900/50 transition-colors"
      >
        <Plus size={28} className="text-white" />
      </button>
    </div>
  )
}
