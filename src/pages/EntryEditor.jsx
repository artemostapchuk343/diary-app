import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Paperclip, X, Image, Languages } from 'lucide-react'
import MediaLightbox from '../components/MediaLightbox'
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
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'uk', label: 'UA', name: 'Ukrainian' },
  { code: 'pl', label: 'PL', name: 'Polish' },
]

async function translateText(text, targetLang) {
  if (!text.trim()) return text
  const lines = text.split('\n')
  const chunks = []
  let chunk = ''
  for (const line of lines) {
    const next = chunk ? chunk + '\n' + line : line
    if (next.length > 4000 && chunk) { chunks.push(chunk); chunk = line }
    else chunk = next
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

function DeleteModal({ activeLang, savedLangs, onDeleteAll, onDeleteTranslation, onPromotePrimary, onCancel }) {
  const [choosingPrimary, setChoosingPrimary] = useState(false)
  const langName = { en: 'English', uk: 'Ukrainian', pl: 'Polish' }

  if (choosingPrimary) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
        <div className="bg-[#1a1a22] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
          <h2 className="text-white text-lg font-semibold mb-2">Choose new primary</h2>
          <p className="text-slate-400 text-sm mb-5">Which translation becomes the main version?</p>
          <div className="flex flex-col gap-2">
            {savedLangs.map(lang => (
              <button key={lang} onClick={() => onPromotePrimary(lang)}
                className="w-full bg-white/5 hover:bg-indigo-600/30 hover:text-indigo-300 text-white font-medium rounded-xl py-3 transition-colors">
                {langName[lang] || lang}
              </button>
            ))}
            <button onClick={onCancel} className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
      <div className="bg-[#1a1a22] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-white text-lg font-semibold mb-2">Delete note?</h2>
        {savedLangs.length > 0 && (
          <p className="text-slate-400 text-sm mb-1">
            Saved translations: {savedLangs.map(l => langName[l] || l).join(', ')}
          </p>
        )}
        <div className="flex flex-col gap-2 mt-4">
          <button onClick={onDeleteAll}
            className="w-full bg-red-600/20 hover:bg-red-500/30 border border-red-500/20 text-red-400 font-medium rounded-xl py-3 transition-colors">
            Delete entire note
          </button>
          {activeLang && savedLangs.includes(activeLang) && (
            <button onClick={() => onDeleteTranslation(activeLang)}
              className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl py-3 transition-colors">
              Delete only {langName[activeLang] || activeLang} translation
            </button>
          )}
          {!activeLang && savedLangs.length > 0 && (
            <button onClick={() => setChoosingPrimary(true)}
              className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl py-3 transition-colors">
              Remove primary, promote a translation
            </button>
          )}
          <button onClick={onCancel}
            className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function DeletedPromptModal({ onRestore, onKeepLocal, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
      <div className="bg-[#1a1a22] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-white text-lg font-semibold mb-2">Note was previously deleted</h2>
        <p className="text-slate-400 text-sm mb-6">
          This note was deleted from Drive on another device. Upload it again, or keep it only on this device?
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

  const [entryData, setEntryData] = useState(null)
  const [activeLang, setActiveLang] = useState(null) // null = viewing primary
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mood, setMood] = useState('')
  const [attachments, setAttachments] = useState([])
  const [saveStatus, setSaveStatus] = useState('idle')
  const [dirty, setDirty] = useState(isNew)
  const [deletedPromptEntry, setDeletedPromptEntry] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [editing, setEditing] = useState(isNew)

  useEffect(() => {
    if (!isNew) loadEntry()
  }, [id])

  async function loadEntry() {
    const entry = await db.entries.get(Number(id))
    if (!entry) return navigate('/')
    setEntryData(entry)
    setTitle(entry.title || '')
    setBody(entry.body || '')
    setMood(entry.mood || '')
    setActiveLang(null)
    setDirty(false)
    const files = await db.attachments.where('entryId').equals(Number(id)).toArray()
    setAttachments(files)
  }

  async function handleLangClick(lang) {
    if (translating) return

    // Clicking the active lang returns to primary
    if (activeLang === lang) {
      setActiveLang(null)
      setTitle(entryData.title || '')
      setBody(entryData.body || '')
      setDirty(false)
      return
    }

    const saved = entryData?.translations?.[lang]
    if (saved) {
      setActiveLang(lang)
      setTitle(saved.title || '')
      setBody(saved.body || '')
      setDirty(false)
      return
    }

    // No saved translation — auto-translate from primary
    setActiveLang(lang)
    setTitle('')
    setBody('')
    setTranslating(true)
    setTranslateError('')
    try {
      const [newTitle, newBody] = await Promise.all([
        entryData?.title ? translateText(entryData.title, lang) : Promise.resolve(''),
        entryData?.body ? translateText(entryData.body, lang) : Promise.resolve(''),
      ])
      setTitle(newTitle)
      setBody(newBody)
      setDirty(true)
    } catch (e) {
      console.error('Translation failed:', e)
      setTranslateError('Translation failed. Try again.')
      setTimeout(() => setTranslateError(''), 3000)
      setActiveLang(null)
      setTitle(entryData?.title || '')
      setBody(entryData?.body || '')
    } finally {
      setTranslating(false)
    }
  }

  async function save() {
    if (saveStatus !== 'idle' && saveStatus !== 'error') return
    setSaveStatus('saving')
    const now = new Date().toISOString()
    let currentEntryData = entryData

    try {
      if (isNew) {
        const sourceId = crypto.randomUUID()
        const newId = await db.entries.add({
          sourceId, title, body, mood,
          translations: {},
          createdAt: now, updatedAt: now,
        })
        for (const att of attachments) {
          if (!att.id) await db.attachments.add({ ...att, entryId: newId })
        }
        currentEntryData = { id: newId, sourceId, title, body, mood, translations: {}, createdAt: now, updatedAt: now }
        setEntryData(currentEntryData)
        navigate(`/entry/${newId}`, { replace: true })
      } else if (activeLang) {
        // Save translation
        const newTranslations = { ...(entryData.translations || {}), [activeLang]: { title, body } }
        await db.entries.update(Number(id), { translations: newTranslations, updatedAt: now })
        currentEntryData = { ...entryData, translations: newTranslations, updatedAt: now }
        setEntryData(currentEntryData)
      } else {
        // Save primary
        await db.entries.update(Number(id), { title, body, mood, updatedAt: now })
        for (const att of attachments) {
          if (!att.id) await db.attachments.add({ ...att, entryId: Number(id) })
        }
        currentEntryData = { ...entryData, title, body, mood, updatedAt: now }
        setEntryData(currentEntryData)
      }

      if (isSignedIn() && currentEntryData?.id) {
        setSaveStatus('uploading')
        const entryForUpload = { ...currentEntryData, attachments }
        const result = await uploadSingleEntry(entryForUpload)
        if (result.status === 'previously_deleted') {
          setDeletedPromptEntry(entryForUpload)
          setSaveStatus('idle')
          return
        }
      }

      setSaveStatus('done')
      setDirty(false)
      setTimeout(() => { setSaveStatus('idle'); setEditing(false) }, 2000)
    } catch (e) {
      console.error('Save failed:', e)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  function cancelEdit() {
    if (isNew) { navigate('/'); return }
    if (activeLang) {
      const saved = entryData?.translations?.[activeLang]
      setTitle(saved?.title || '')
      setBody(saved?.body || '')
    } else {
      setTitle(entryData?.title || '')
      setBody(entryData?.body || '')
      setMood(entryData?.mood || '')
    }
    setDirty(false)
    setEditing(false)
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

  async function deleteEntireEntry() {
    setShowDeleteModal(false)
    await db.attachments.where('entryId').equals(Number(id)).delete()
    await db.entries.delete(Number(id))
    if (isSignedIn() && entryData) markEntryDeleted(entryData).catch(() => {})
    navigate('/')
  }

  async function deleteTranslation(lang) {
    setShowDeleteModal(false)
    const newTranslations = { ...(entryData.translations || {}) }
    delete newTranslations[lang]
    const now = new Date().toISOString()
    await db.entries.update(Number(id), { translations: newTranslations, updatedAt: now })
    const updated = { ...entryData, translations: newTranslations, updatedAt: now }
    setEntryData(updated)
    if (activeLang === lang) {
      setActiveLang(null)
      setTitle(entryData.title || '')
      setBody(entryData.body || '')
      setDirty(false)
    }
    if (isSignedIn()) uploadSingleEntry({ ...updated, attachments }).catch(() => {})
  }

  async function promoteToPrimary(lang) {
    setShowDeleteModal(false)
    const translation = entryData.translations?.[lang]
    if (!translation) return
    const newTranslations = { ...(entryData.translations || {}) }
    delete newTranslations[lang]
    const now = new Date().toISOString()
    await db.entries.update(Number(id), {
      title: translation.title,
      body: translation.body,
      translations: newTranslations,
      updatedAt: now,
    })
    const updated = { ...entryData, title: translation.title, body: translation.body, translations: newTranslations, updatedAt: now }
    setEntryData(updated)
    setActiveLang(null)
    setTitle(translation.title || '')
    setBody(translation.body || '')
    setDirty(false)
    if (isSignedIn()) uploadSingleEntry({ ...updated, attachments }).catch(() => {})
  }

  function handleDeleteClick() {
    const savedLangs = Object.keys(entryData?.translations || {})
    if (savedLangs.length > 0) {
      setShowDeleteModal(true)
    } else {
      if (window.confirm('Delete this entry?')) deleteEntireEntry()
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
        setAttachments(prev => [...prev, { name: file.name, type: file.type, size: file.size, data: e.target.result }])
        setDirty(true)
      }
      reader.readAsDataURL(file)
    })
  }

  const savedLangs = Object.keys(entryData?.translations || {})
  const busy = saveStatus === 'saving' || saveStatus === 'uploading'
  const saveDisabled = busy || translating || (!dirty && saveStatus !== 'done')

  function langButtonClass(code) {
    const isActive = activeLang === code
    const isSaved = !!entryData?.translations?.[code]
    if (isActive) return 'bg-indigo-600 text-white'
    if (isSaved) return 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40'
    return 'bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex flex-col max-w-2xl mx-auto px-6 py-8">
      {deletedPromptEntry && (
        <DeletedPromptModal
          onRestore={handleRestore}
          onKeepLocal={() => setDeletedPromptEntry(null)}
          onCancel={() => setDeletedPromptEntry(null)}
        />
      )}
      {showDeleteModal && (
        <DeleteModal
          activeLang={activeLang}
          savedLangs={savedLangs}
          onDeleteAll={deleteEntireEntry}
          onDeleteTranslation={deleteTranslation}
          onPromotePrimary={promoteToPrimary}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={26} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-sm">
            {format(entryData ? new Date(entryData.createdAt) : new Date(), 'd MMM yyyy')}
          </span>
          {!isNew && (
            <button onClick={handleDeleteClick} disabled={busy} className="text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors">
              <Trash2 size={22} />
            </button>
          )}
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                className="text-slate-400 hover:text-white text-base font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saveDisabled}
                className={`text-white text-base font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40
                  ${saveStatus === 'done' ? 'bg-green-600' : saveStatus === 'error' ? 'bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
              >
                {STATUS_LABEL[saveStatus]}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-white text-base font-medium px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      {editing ? (
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={e => { setTitle(e.target.value); setDirty(true) }}
          className="bg-transparent text-white text-3xl font-semibold placeholder-slate-600 outline-none border-none mb-4 w-full"
          autoFocus={isNew}
        />
      ) : (
        <h1 className="text-white text-3xl font-semibold mb-4 leading-snug">
          {title || <span className="text-slate-600">Untitled</span>}
        </h1>
      )}

      {/* Mood + language row */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        {!activeLang && editing && (
          <MoodPicker value={mood} onChange={v => { setMood(v); setDirty(true) }} />
        )}
        {!activeLang && !editing && mood && (
          <span className="text-2xl">{mood}</span>
        )}
        {activeLang && mood && <span className="text-2xl">{mood}</span>}

        {!isNew && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Languages size={15} className="text-slate-500 shrink-0" />
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => handleLangClick(code)}
                disabled={translating}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${langButtonClass(code)}`}
              >
                {translating && activeLang === code ? '…' : label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeLang && (
        <p className="text-xs text-slate-500 mb-3">
          {LANGS.find(l => l.code === activeLang)?.name} translation
          {entryData?.translations?.[activeLang] ? ' · saved' : ' · not saved yet — click Edit then Save to keep it'}
        </p>
      )}

      {translateError && <p className="text-red-400 text-xs mb-3">{translateError}</p>}

      {/* Body */}
      {editing ? (
        <textarea
          placeholder="Write your thoughts…"
          value={body}
          onChange={e => { setBody(e.target.value); setDirty(true) }}
          className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 outline-none border-none resize-none text-lg leading-relaxed min-h-72 w-full"
        />
      ) : (
        <div className="flex-1 text-slate-200 text-lg leading-relaxed whitespace-pre-wrap min-h-72">
          {body || <span className="text-slate-600">No content</span>}
        </div>
      )}

      {/* Attachments */}
      {!activeLang && attachments.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {attachments.map((att, i) => {
            const mediaList = attachments.filter(a => a.type?.startsWith('image/') || a.type?.startsWith('video/'))
            const mediaIdx = mediaList.indexOf(att)
            return (
              <div key={i} className="relative bg-white/5 border border-white/10 rounded-xl overflow-hidden group">
                {att.type?.startsWith('image/') ? (
                  <img
                    src={att.data}
                    alt={att.name}
                    onClick={() => setLightboxIndex(mediaIdx)}
                    className="w-full h-40 object-cover cursor-zoom-in"
                  />
                ) : att.type?.startsWith('video/') ? (
                  <div
                    onClick={() => setLightboxIndex(mediaIdx)}
                    className="w-full h-40 bg-black flex items-center justify-center cursor-pointer relative"
                  >
                    <video src={att.data} className="w-full h-full object-cover opacity-70" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-[8px] border-b-[8px] border-l-[14px] border-t-transparent border-b-transparent border-l-white ml-1" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4">
                    <Paperclip size={16} className="text-slate-400 shrink-0" />
                    <span className="text-slate-300 text-sm truncate">{att.name}</span>
                  </div>
                )}
                {editing && (
                  <button
                    onClick={() => removeAttachment(att)}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          media={attachments.filter(a => a.type?.startsWith('image/') || a.type?.startsWith('video/'))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Photo / File buttons — edit mode only */}
      {!activeLang && editing && (
        <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-5">
          <input ref={photoRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          <button onClick={() => photoRef.current.click()} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-base transition-colors">
            <Image size={20} />
            <span>Photo</span>
          </button>
          <button onClick={() => fileRef.current.click()} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-base transition-colors">
            <Paperclip size={20} />
            <span>File</span>
          </button>
        </div>
      )}
    </div>
  )
}
