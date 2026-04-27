import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Lock, BookOpen, FileUp } from 'lucide-react'
import { db } from '../db'
import { format } from 'date-fns'
import { useAuth } from '../useAuth'
import SyncPanel from '../components/SyncPanel'
import { useSync } from '../useSync'
import { markdownToEntry } from '../googleDrive'

function parseImportedFile(filename, content) {
  const ext = filename.split('.').pop().toLowerCase()
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')

  // Try markdown frontmatter first
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

  // Plain text / rtf / anything else — use filename as title, content as body
  // Strip RTF control words if needed
  let body = content
  if (ext === 'rtf') {
    body = content
      .replace(/\{\\[^}]*\}/g, '')   // remove RTF groups
      .replace(/\\[a-z]+\d* ?/g, '')  // remove control words
      .replace(/[{}\\]/g, '')          // remove remaining braces/backslashes
      .trim()
  }

  return { title: nameWithoutExt, body, mood: '' }
}

export default function EntryList() {
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
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

  async function handleImport(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setImporting(true)
    try {
      const now = new Date().toISOString()
      let lastId = null
      for (const file of files) {
        const content = await file.text()
        const { title, body, mood } = parseImportedFile(file.name, content)
        lastId = await db.entries.add({ title, body, mood, createdAt: now, updatedAt: now })
      }
      await loadEntries()
      // Navigate to the imported entry if only one file
      if (files.length === 1 && lastId) navigate(`/entry/${lastId}`)
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      setImporting(false)
      e.target.value = ''
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
          onChange={handleImport}
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
