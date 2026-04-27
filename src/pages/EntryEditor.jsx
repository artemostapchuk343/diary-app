import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Paperclip, X, Image, Languages } from 'lucide-react'
import { db } from '../db'
import { format } from 'date-fns'
import MoodPicker from '../components/MoodPicker'
import { isSignedIn, markEntryDeleted, uploadSingleEntry, restoreAndUpload } from '../googleDrive'

const STATUS_LABEL = {
  idle: 'Save',
  saving: 'Saving…',
  uploading: 'Uploading…',
  done: 'Saved ✓',
  error: 'Save',
}

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UA' },
  { code: 'pl', label: 'PL' },
]

async function translateText(text, targetLang) {
  if (!text.trim()) return text

  // Split into chunks on paragraph boundaries, max 4000 chars each
  const lines = text.split('\n')
  const chunks = []
  let chunk = ''
  for (const line of lines) {
    const next = chunk ? chunk + '\n' + line : line
    if (next.length > 4000 && chunk) {
      chunks.push(chunk)
      chunk = line
    } else {
      chunk = next
    }
  }
  if (chunk) chunks.push(chunk)

  const results = []
  for (const c of chunks) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(c)}`
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Translation failed: ${resp.status}`)
    const data = await resp.json()
    results.push(data[0].map(s => s[0]).join(''))
  }
  return results.join('\n')
}

function DeletedPromptModal({ onRestore, onKeepLocal, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
      <div className="bg-[#1a1a22] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-white text-lg font-semibold mb-2">Note was previously deleted</h2>
        <p className="text-slate-400 text-sm mb-6">
          This note was deleted from Drive on another device. Do you want to upload it again as a new note, or keep it only on this device?
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onRestore} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-base font-medium rounded-xl py-3 transition-colors">
            Upload as new note
          </button>
          <button onClick={onKeepLocal} className="w-full bg-white/5 hover:bg-white/10 text-slate-300 text-base font-medium rounded-xl py-3 transition-colors">
            Keep on this device only
          </button>
          <button onClick={onCancel} className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EntryEditor() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const photoRef = useRef()
  const fileRef = useRef()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mood, setMood] = useState('')
  const [attachments, setAttachments] = useState([])
  const [saveStatus, setSaveStatus] = useState('idle')
  const [dirty, setDirty] = useState(isNew)
  const [entryMeta, setEntryMeta] = useState(null)
  const [deletedPromptEntry, setDeletedPromptEntry] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState('')

  useEffect(() => {
    if (!isNew) loadEntry()
  }, [id])

  async function loadEntry() {
    const entry = await db.entries.get(Number(id))
    if (!entry) return navigate('/')
    setTitle(entry.title || '')
    setBody(entry.body || '')
    setMood(entry.mood || '')
    setEntryMeta({ id: entry.id, sourceId: entry.sourceId || null, createdAt: entry.createdAt })
    const files = await db.attachments.where('entryId').equals(Number(id)).toArray()
    setAttachments(files)
  }

  async function save() {
    if (saveStatus !== 'idle' && saveStatus !== 'error') return
    setSaveStatus('saving')
    const now = new Date().toISOString()
    let savedMeta = entryMeta

    try {
      if (isNew) {
        const sourceId = crypto.randomUUID()
        const newId = await db.entries.add({ sourceId, title, body, mood, createdAt: now, updatedAt: now })
        for (const att of attachments) {
          if (!att.id) await db.attachments.add({ ...att, entryId: newId })
        }
        savedMeta = { id: newId, sourceId, createdAt: now }
        setEntryMeta(savedMeta)
        navigate(`/entry/${newId}`, { replace: true })
      } else {
        await db.entries.update(Number(id), { title, body, mood, updatedAt: now })
        for (const att of attachments) {
          if (!att.id) await db.attachments.add({ ...att, entryId: Number(id) })
        }
      }

      if (isSignedIn() && savedMeta) {
        setSaveStatus('uploading')
        const entry = { ...savedMeta, title, body, mood, updatedAt: now, attachments }
        const result = await uploadSingleEntry(entry)
        if (result.status === 'previously_deleted') {
          setDeletedPromptEntry(entry)
          setSaveStatus('idle')
          return
        }
      }

      setSaveStatus('done')
      setDirty(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      console.error('Save failed:', e)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  async function handleRestore() {
    if (!deletedPromptEntry) return
    setDeletedPromptEntry(null)
    setSaveStatus('uploading')
    try {
      await restoreAndUpload(deletedPromptEntry)
      setSaveStatus('done')
      setDirty(false)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      console.error('Restore failed:', e)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  async function deleteEntry() {
    if (!window.confirm('Delete this entry?')) return
    await db.attachments.where('entryId').equals(Number(id)).delete()
    await db.entries.delete(Number(id))
    if (isSignedIn() && entryMeta) markEntryDeleted(entryMeta).catch(() => {})
    navigate('/')
  }

  async function handleTranslate(langCode) {
    if (translating || (!title && !body)) return
    setTranslating(true)
    setTranslateError('')
    try {
      const [newTitle, newBody] = await Promise.all([
        title ? translateText(title, langCode) : Promise.resolve(title),
        body ? translateText(body, langCode) : Promise.resolve(body),
      ])
      setTitle(newTitle)
      setBody(newBody)
      setDirty(true)
    } catch (e) {
      console.error('Translation failed:', e)
      setTranslateError('Translation failed. Try again.')
      setTimeout(() => setTranslateError(''), 3000)
    } finally {
      setTranslating(false)
    }
  }

  async function removeAttachment(att) {
    if (att.id) await db.attachments.delete(att.id)
    setAttachments(prev => prev.filter(a => a !== att))
    setDirty(true)
  }

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result,
        }])
        setDirty(true)
      }
      reader.readAsDataURL(file)
    })
  }

  function isImage(att) {
    return att.type?.startsWith('image/')
  }

  const busy = saveStatus === 'saving' || saveStatus === 'uploading'
  const saveDisabled = busy || translating || (!dirty && saveStatus !== 'done')

  return (
    <div className="min-h-screen bg-[#0f0f13] flex flex-col max-w-2xl mx-auto px-6 py-8">
      {deletedPromptEntry && (
        <DeletedPromptModal
          onRestore={handleRestore}
          onKeepLocal={() => setDeletedPromptEntry(null)}
          onCancel={() => setDeletedPromptEntry(null)}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={26} />
        </button>
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm">
            {format(entryMeta ? new Date(entryMeta.createdAt) : new Date(), 'MMM d, yyyy')}
          </span>
          {!isNew && (
            <button onClick={deleteEntry} disabled={busy} className="text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors">
              <Trash2 size={22} />
            </button>
          )}
          <button
            onClick={save}
            disabled={saveDisabled}
            className={`text-white text-base font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40
              ${saveStatus === 'done' ? 'bg-green-600' : saveStatus === 'error' ? 'bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            {STATUS_LABEL[saveStatus]}
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={e => { setTitle(e.target.value); setDirty(true) }}
        className="bg-transparent text-white text-3xl font-semibold placeholder-slate-600 outline-none border-none mb-4 w-full"
      />

      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <MoodPicker value={mood} onChange={v => { setMood(v); setDirty(true) }} />
        <div className="flex items-center gap-1.5 ml-auto">
          <Languages size={15} className="text-slate-500" />
          {LANGS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => handleTranslate(code)}
              disabled={translating}
              title={`Translate to ${label}`}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-indigo-600/30 hover:text-indigo-300 text-slate-400 transition-colors disabled:opacity-40"
            >
              {translating ? '…' : label}
            </button>
          ))}
        </div>
        {translateError && (
          <p className="w-full text-red-400 text-xs mt-1">{translateError}</p>
        )}
      </div>

      <textarea
        placeholder="Write your thoughts…"
        value={body}
        onChange={e => { setBody(e.target.value); setDirty(true) }}
        className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 outline-none border-none resize-none text-lg leading-relaxed min-h-72 w-full"
        autoFocus={isNew}
      />

      {attachments.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {attachments.map((att, i) => (
            <div key={i} className="relative bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {isImage(att) ? (
                <img src={att.data} alt={att.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="flex items-center gap-3 p-4">
                  <Paperclip size={16} className="text-slate-400 shrink-0" />
                  <span className="text-slate-300 text-sm truncate">{att.name}</span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(att)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-5">
        <input
          ref={photoRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <button
          onClick={() => photoRef.current.click()}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-base transition-colors"
        >
          <Image size={20} />
          <span>Photo</span>
        </button>
        <button
          onClick={() => fileRef.current.click()}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-base transition-colors"
        >
          <Paperclip size={20} />
          <span>File</span>
        </button>
      </div>
    </div>
  )
}
