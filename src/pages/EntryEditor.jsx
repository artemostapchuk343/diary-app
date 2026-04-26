import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Paperclip, X, Image } from 'lucide-react'
import { db } from '../db'
import { format } from 'date-fns'
import MoodPicker from '../components/MoodPicker'
import { useSync } from '../useSync'

export default function EntryEditor() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const fileRef = useRef()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mood, setMood] = useState('')
  const [attachments, setAttachments] = useState([])
  const [saving, setSaving] = useState(false)
  const triggerSync = useSync(s => s.trigger)

  useEffect(() => {
    if (!isNew) loadEntry()
  }, [id])

  async function loadEntry() {
    const entry = await db.entries.get(Number(id))
    if (!entry) return navigate('/')
    setTitle(entry.title || '')
    setBody(entry.body || '')
    setMood(entry.mood || '')
    const files = await db.attachments.where('entryId').equals(Number(id)).toArray()
    setAttachments(files)
  }

  async function save() {
    setSaving(true)
    const now = new Date().toISOString()
    if (isNew) {
      const newId = await db.entries.add({ title, body, mood, createdAt: now, updatedAt: now })
      for (const att of attachments) {
        if (!att.id) await db.attachments.add({ ...att, entryId: newId })
      }
      navigate(`/entry/${newId}`, { replace: true })
    } else {
      await db.entries.update(Number(id), { title, body, mood, updatedAt: now })
      for (const att of attachments) {
        if (!att.id) await db.attachments.add({ ...att, entryId: Number(id) })
      }
    }
    setSaving(false)
    triggerSync()
  }

  async function deleteEntry() {
    if (!window.confirm('Delete this entry?')) return
    await db.attachments.where('entryId').equals(Number(id)).delete()
    await db.entries.delete(Number(id))
    navigate('/')
  }

  async function removeAttachment(att) {
    if (att.id) await db.attachments.delete(att.id)
    setAttachments(prev => prev.filter(a => a !== att))
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
      }
      reader.readAsDataURL(file)
    })
  }

  function isImage(att) {
    return att.type?.startsWith('image/')
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex flex-col max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => { navigate('/'); triggerSync() }} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={26} />
        </button>
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm">
            {format(new Date(), 'MMM d, yyyy')}
          </span>
          {!isNew && (
            <button onClick={deleteEntry} className="text-slate-500 hover:text-red-400 transition-colors">
              <Trash2 size={22} />
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-base font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="bg-transparent text-white text-3xl font-semibold placeholder-slate-600 outline-none border-none mb-4 w-full"
      />

      <div className="mb-5">
        <MoodPicker value={mood} onChange={setMood} />
      </div>

      <textarea
        placeholder="Write your thoughts…"
        value={body}
        onChange={e => setBody(e.target.value)}
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
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.md"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileRef.current.click()}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-base transition-colors"
        >
          <Image size={20} />
          <span>Photo</span>
        </button>
        <button
          onClick={() => { fileRef.current.removeAttribute('accept'); fileRef.current.click() }}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-base transition-colors"
        >
          <Paperclip size={20} />
          <span>File</span>
        </button>
      </div>
    </div>
  )
}
