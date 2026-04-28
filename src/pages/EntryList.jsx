import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Lock, FileUp, Calendar, LayoutList, AlignJustify, Paperclip, ChevronLeft, ChevronRight, NotebookPen, Image, Video, Mic } from 'lucide-react'
import { db } from '../db'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isToday, parseISO,
} from 'date-fns'
import { useAuth } from '../useAuth'
import SyncPanel from '../components/SyncPanel'
import ProfilePic from '../components/ProfilePic'
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

function AttachIcons({ types, size = 13 }) {
  if (!types || types.size === 0) return null
  return (
    <>
      {types.has('image') && <Image size={size} className="text-slate-500 shrink-0" />}
      {types.has('video') && <Video size={size} className="text-slate-500 shrink-0" />}
      {types.has('audio') && <Mic size={size} className="text-slate-500 shrink-0" />}
      {types.has('file') && <Paperclip size={size} className="text-slate-500 shrink-0" />}
    </>
  )
}

function NormalCard({ entry, attTypes, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl p-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-white font-semibold text-base truncate">{entry.title || 'Untitled'}</p>
            <AttachIcons types={attTypes} />
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

function CompactCard({ entry, attTypes, onClick }) {
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
      <AttachIcons types={attTypes} />
      <span className="text-slate-500 text-xs whitespace-nowrap">{format(new Date(entry.createdAt), 'd MMM yyyy')}</span>
    </button>
  )
}

function CalendarSidebar({ entries, attachedEntryIds, attachmentTypes, navigate }) {
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'))

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
  while (cur <= end) { days.push(cur); cur = addDays(cur, 1) }

  function handleDayClick(day) {
    const key = format(day, 'yyyy-MM-dd')
    setSelectedDay(prev => prev === key ? null : key)
    // navigate into month if clicking an out-of-month day
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day))
  }

  const selectedEntries = selectedDay ? (byDate[selectedDay] || []) : []

  return (
    <div className="bg-white/[0.05] border border-white/[0.09] rounded-2xl p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setMonth(m => subMonths(m, 1))}
          className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-white text-sm font-semibold">{format(month, 'MMMM yyyy')}</span>
        <button
          onClick={() => setMonth(m => addMonths(m, 1))}
          className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-slate-500 text-[11px] py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
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
              className={`flex flex-col items-center py-1 rounded-lg transition-colors
                ${!inMonth ? 'opacity-30' : ''}
                ${selected ? 'bg-indigo-600/35 ring-1 ring-inset ring-indigo-500/50' : today ? 'ring-1 ring-inset ring-indigo-500/50' : ''}
                ${hasEntries && !selected ? 'hover:bg-white/8 cursor-pointer' : 'cursor-default'}
              `}
            >
              <span className={`text-[11px] font-medium leading-5
                ${today ? 'text-indigo-400' : inMonth ? 'text-slate-300' : 'text-slate-600'}
              `}>
                {format(day, 'd')}
              </span>
              <div className="h-3 flex items-center justify-center">
                {hasEntries && (
                  dayEntries[0].mood
                    ? <span className="text-[10px] leading-none">{dayEntries[0].mood}</span>
                    : <span className="w-1 h-1 rounded-full bg-indigo-400 block" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day entries */}
      <div className="mt-4 pt-4 border-t border-white/8">
        {selectedDay ? (
          <>
            <p className="text-slate-500 text-xs mb-2.5">
              {format(parseISO(selectedDay), 'd MMMM yyyy')}
              {selectedEntries.length > 0 && (
                <span className="ml-1 text-slate-600">· {selectedEntries.length} {selectedEntries.length === 1 ? 'entry' : 'entries'}</span>
              )}
            </p>
            {selectedEntries.length > 0 ? (
              <div className="space-y-1.5">
                {selectedEntries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => navigate(`/entry/${e.id}`)}
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl p-3 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      {e.mood && <span className="text-base shrink-0">{e.mood}</span>}
                      <span className="text-white text-xs font-semibold truncate">{e.title || 'Untitled'}</span>
                      {attachedEntryIds.has(e.id) && (
                        <span className="ml-auto flex items-center gap-0.5">
                          <AttachIcons types={attachmentTypes?.[e.id]} size={11} />
                        </span>
                      )}
                    </div>
                    {e.body && (
                      <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{e.body}</p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 text-xs">No entries this day.</p>
            )}
          </>
        ) : (
          <p className="text-slate-600 text-xs">Select a day to see entries.</p>
        )}
      </div>
    </div>
  )
}

const VIEW_MODES = [
  { id: 'normal',  Icon: LayoutList,   title: 'List view' },
  { id: 'compact', Icon: AlignJustify, title: 'Compact view' },
]

export default function EntryList() {
  const [entries, setEntries] = useState([])
  const [attachedEntryIds, setAttachedEntryIds] = useState(new Set())
  const [attachmentTypes, setAttachmentTypes] = useState({})
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [pendingFiles, setPendingFiles] = useState(null)
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('diary_view')
    // migrate away from old 'calendar' value
    return (saved === 'calendar' || !saved) ? 'normal' : saved
  })
  const [showCalendar, setShowCalendar] = useState(false)
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
    const types = {}
    atts.forEach(a => {
      if (!types[a.entryId]) types[a.entryId] = new Set()
      if (a.type?.startsWith('image/')) types[a.entryId].add('image')
      else if (a.type?.startsWith('video/')) types[a.entryId].add('video')
      else if (a.type?.startsWith('audio/')) types[a.entryId].add('audio')
      else types[a.entryId].add('file')
    })
    setAttachmentTypes(types)
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
    <div className="min-h-screen py-8 px-4 md:px-8 relative" style={{ zIndex: 1 }}>
      {pendingFiles && (
        <ImportModal files={pendingFiles} onConfirm={confirmImport} onCancel={() => setPendingFiles(null)} />
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ProfilePic size="sm" editable />
            <h1 className="text-2xl font-semibold text-white">My Diary</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalendar(s => !s)}
              title="Calendar"
              className={`lg:hidden p-1.5 rounded-lg transition-colors ${showCalendar ? 'bg-indigo-600/30 text-indigo-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
            >
              <Calendar size={20} />
            </button>
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
            <button onClick={lock} title="Lock" className="text-slate-500 hover:text-slate-300 transition-colors">
              <Lock size={20} />
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Left — entries */}
          <div className="flex-1 min-w-0 w-full">
            <SyncPanel />

            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => navigate('/entry/new')}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl py-3 transition-colors"
              >
                <Plus size={17} />
                New Entry
              </button>
              <button
                onClick={() => importRef.current.click()}
                disabled={importing}
                title="Import from file"
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
              >
                <FileUp size={16} />
                Import
              </button>
              <input
                ref={importRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.rtf,.text"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

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

            {showCalendar && (
              <div className="lg:hidden mb-5">
                <CalendarSidebar entries={entries} attachedEntryIds={attachedEntryIds} attachmentTypes={attachmentTypes} navigate={navigate} />
              </div>
            )}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <NotebookPen size={48} className="mb-4 opacity-30" />
                <p className="text-base">{query ? 'No entries found.' : 'No entries yet. Start writing!'}</p>
              </div>
            )}
            <div className={viewMode === 'compact' ? 'space-y-1.5' : 'space-y-3'}>
              {filtered.map(entry =>
                viewMode === 'compact'
                  ? <CompactCard key={entry.id} entry={entry} attTypes={attachmentTypes[entry.id]} onClick={() => navigate(`/entry/${entry.id}`)} />
                  : <NormalCard key={entry.id} entry={entry} attTypes={attachmentTypes[entry.id]} onClick={() => navigate(`/entry/${entry.id}`)} />
              )}
            </div>
          </div>

          {/* Right — calendar sidebar (desktop only) */}
          <div className="hidden lg:block w-64 shrink-0 sticky top-8">
            <CalendarSidebar
              entries={entries}
              attachedEntryIds={attachedEntryIds}
              attachmentTypes={attachmentTypes}
              navigate={navigate}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
