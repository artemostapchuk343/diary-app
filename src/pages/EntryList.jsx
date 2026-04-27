import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Lock, BookOpen, FileUp, Calendar, LayoutList, AlignJustify, Paperclip, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../db'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isToday, parseISO,
} from 'date-fns'
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
        <h2 className="text-white text-lg font-semibold mb-1">
          Import {files.length > 1 ? `${files.length} files` : `"${files[0]?.name}"`}
        </h2>
        <p className="text-slate-400 text-sm mb-5">
          Choose the date for {files.length > 1 ? 'these entries' : 'this entry'}.
        </p>

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

function NormalCard({ entry, hasAttachment, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl p-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-white font-semibold text-base truncate">{entry.title || 'Untitled'}</p>
            {hasAttachment && <Paperclip size={13} className="text-slate-500 shrink-0" />}
          </div>
          <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">{entry.body}</p>
        </div>
        <span className="text-slate-500 text-sm whitespace-nowrap mt-0.5">
          {format(new Date(entry.createdAt), 'd MMM yyyy')}
        </span>
      </div>
      {entry.mood && <span className="mt-3 inline-block text-2xl">{entry.mood}</span>}
    </button>
  )
}

function CompactCard({ entry, hasAttachment, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg px-4 py-2.5 transition-colors flex items-center gap-3"
    >
      {entry.mood
        ? <span className="text-xl shrink-0 w-7 text-center">{entry.mood}</span>
        : <span className="w-7 shrink-0" />
      }
      <span className="text-white text-sm font-medium truncate flex-1">{entry.title || 'Untitled'}</span>
      {hasAttachment && <Paperclip size={13} className="text-slate-500 shrink-0" />}
      <span className="text-slate-500 text-xs whitespace-nowrap">{format(new Date(entry.createdAt), 'd MMM yyyy')}</span>
    </button>
  )
}

function CalendarView({ entries, attachedEntryIds, navigate, month, onMonthChange }) {
  const [selectedDay, setSelectedDay] = useState(null)

  const byDate = {}
  entries.forEach(e => {
    const d = e.createdAt?.slice(0, 10)
    if (d) {
      if (!byDate[d]) byDate[d] = []
      byDate[d].push(e)
    }
  })

  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = []
  let cur = start
  while (cur <= end) {
    days.push(cur)
    cur = addDays(cur, 1)
  }

  function handleDayClick(day) {
    const key = format(day, 'yyyy-MM-dd')
    const dayEntries = byDate[key] || []
    if (!dayEntries.length) return
    if (dayEntries.length === 1) {
      navigate(`/entry/${dayEntries[0].id}`)
    } else {
      setSelectedDay(prev => prev === key ? null : key)
    }
  }

  function handleMonthChange(dir) {
    onMonthChange(dir === -1 ? subMonths(month, 1) : addMonths(month, 1))
    setSelectedDay(null)
  }

  const selectedEntries = selectedDay ? (byDate[selectedDay] || []) : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => handleMonthChange(-1)} className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-white font-semibold">{format(month, 'MMMM yyyy')}</h2>
        <button onClick={() => handleMonthChange(1)} className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="text-center text-slate-500 text-xs py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEntries = byDate[key] || []
          const inMonth = isSameMonth(day, month)
          const today = isToday(day)
          const selected = selectedDay === key
          const hasEntries = dayEntries.length > 0

          return (
            <button
              key={i}
              onClick={() => handleDayClick(day)}
              disabled={!hasEntries}
              className={`flex flex-col items-center pt-1.5 pb-2 rounded-xl min-h-[56px] transition-colors
                ${!inMonth ? 'opacity-25' : ''}
                ${selected ? 'bg-indigo-600/30 ring-1 ring-indigo-500/50' : today ? 'ring-1 ring-indigo-500/60' : ''}
                ${hasEntries && !selected ? 'bg-white/5 hover:bg-white/10 cursor-pointer' : ''}
                ${!hasEntries ? 'cursor-default' : ''}
              `}
            >
              <span className={`text-xs font-medium ${today ? 'text-indigo-400' : inMonth ? 'text-slate-300' : 'text-slate-600'}`}>
                {format(day, 'd')}
              </span>
              {hasEntries && (
                <div className="flex flex-col items-center mt-0.5 gap-px">
                  {dayEntries.slice(0, 2).map((e, j) =>
                    e.mood
                      ? <span key={j} className="text-sm leading-tight">{e.mood}</span>
                      : <span key={j} className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-0.5" />
                  )}
                  {dayEntries.length > 2 && (
                    <span className="text-slate-500 text-[9px] leading-tight">+{dayEntries.length - 2}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="mt-5 space-y-2">
          <p className="text-slate-500 text-sm mb-3">{format(parseISO(selectedDay), 'd MMMM yyyy')}</p>
          {selectedEntries.map(e => (
            <button
              key={e.id}
              onClick={() => navigate(`/entry/${e.id}`)}
              className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors flex items-center gap-3"
            >
              {e.mood && <span className="text-xl shrink-0">{e.mood}</span>}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{e.title || 'Untitled'}</p>
                {e.body && <p className="text-slate-400 text-xs mt-0.5 truncate">{e.body}</p>}
              </div>
              {attachedEntryIds.has(e.id) && <Paperclip size={13} className="text-slate-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const VIEW_MODES = [
  { id: 'normal',   Icon: LayoutList,   title: 'List view' },
  { id: 'compact',  Icon: AlignJustify, title: 'Compact view' },
  { id: 'calendar', Icon: Calendar,     title: 'Calendar view' },
]

export default function EntryList() {
  const [entries, setEntries] = useState([])
  const [attachedEntryIds, setAttachedEntryIds] = useState(new Set())
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [pendingFiles, setPendingFiles] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('diary_view') || 'normal')
  const [calMonth, setCalMonth] = useState(new Date())
  const importRef = useRef()
  const navigate = useNavigate()
  const lock = useAuth(s => s.lock)
  const triggerSync = useSync(s => s.trigger)
  const lastSync = useSync(s => s.lastSync)

  useEffect(() => { triggerSync() }, [])
  useEffect(() => { loadEntries() }, [lastSync])

  async function loadEntries() {
    const [all, atts] = await Promise.all([
      db.entries.orderBy('createdAt').reverse().toArray(),
      db.attachments.toArray(),
    ])
    setEntries(all)
    setAttachedEntryIds(new Set(atts.map(a => a.entryId)))
  }

  function setView(mode) {
    setViewMode(mode)
    localStorage.setItem('diary_view', mode)
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
    const isoDate = new Date(`${dateStr}T12:00:00`).toISOString()
    try {
      let lastId = null
      for (const file of pendingFiles) {
        const content = await file.text()
        const { title, body, mood } = parseImportedFile(file.name, content)
        lastId = await db.entries.add({ sourceId: crypto.randomUUID(), title, body, mood, createdAt: isoDate, updatedAt: isoDate })
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
    ? entries.filter(e => {
        const q = query.toLowerCase()
        if (e.title?.toLowerCase().includes(q)) return true
        if (e.body?.toLowerCase().includes(q)) return true
        return Object.values(e.translations || {}).some(t =>
          t.title?.toLowerCase().includes(q) || t.body?.toLowerCase().includes(q)
        )
      })
    : entries

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-6 py-8 relative" style={{ zIndex: 1 }}>
      {pendingFiles && (
        <ImportModal files={pendingFiles} onConfirm={confirmImport} onCancel={() => setPendingFiles(null)} />
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BookOpen size={28} className="text-indigo-400" />
          <h1 className="text-2xl font-semibold text-white">My Diary</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/5 rounded-lg p-1 gap-px mr-1">
            {VIEW_MODES.map(({ id, Icon, title }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                title={title}
                className={`p-1.5 rounded-md transition-colors ${viewMode === id ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/entry/new')}
            title="New entry"
            className="text-slate-500 hover:text-white transition-colors"
          >
            <Plus size={22} />
          </button>
          <button
            onClick={() => importRef.current.click()}
            disabled={importing}
            title="Import from file"
            className="text-slate-500 hover:text-slate-300 disabled:opacity-50 transition-colors"
          >
            <FileUp size={20} />
          </button>
          <button onClick={lock} title="Lock" className="text-slate-500 hover:text-slate-300 transition-colors">
            <Lock size={20} />
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

      {viewMode !== 'calendar' && (
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
      )}

      <div className="flex-1">
        {viewMode === 'calendar' ? (
          <CalendarView
            entries={entries}
            attachedEntryIds={attachedEntryIds}
            navigate={navigate}
            month={calMonth}
            onMonthChange={setCalMonth}
          />
        ) : (
          <>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <BookOpen size={48} className="mb-4 opacity-30" />
                <p className="text-base">{query ? 'No entries found.' : 'No entries yet. Start writing!'}</p>
              </div>
            )}
            <div className={viewMode === 'compact' ? 'space-y-1.5' : 'space-y-3'}>
              {filtered.map(entry =>
                viewMode === 'compact'
                  ? <CompactCard key={entry.id} entry={entry} hasAttachment={attachedEntryIds.has(entry.id)} onClick={() => navigate(`/entry/${entry.id}`)} />
                  : <NormalCard key={entry.id} entry={entry} hasAttachment={attachedEntryIds.has(entry.id)} onClick={() => navigate(`/entry/${entry.id}`)} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
