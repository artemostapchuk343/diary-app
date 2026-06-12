import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Trash2, Paperclip, X, Image, Languages, Mic, Sparkles } from 'lucide-react'
import MediaLightbox from '../components/MediaLightbox'
import AudioRecorder from '../components/AudioRecorder'
import { db } from '../db'
import { format } from 'date-fns'
import MoodPicker from '../components/MoodPicker'
import { isSignedIn, markEntryDeleted, uploadSingleEntry, restoreAndUpload } from '../googleDrive'

const VOICE_INSTRUCTIONS = {
  preserve: `Fix ONLY transcription errors, spelling, and grammar. Preserve EVERY sentence and idea — do NOT summarize, shorten, condense, or remove any content. If not in English, translate to English. Keep the personal voice and style exactly as spoken. Return the full corrected text, nothing else.`,
  summarize: `This is a personal diary voice note. Summarize it to roughly half the length — keep the key events, feelings, and decisions, cut filler and repetition. If not in English, translate to English. Return only the summary, no explanations.`,
}

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
  { code: 'ru', label: 'RU', name: 'Russian' },
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
  const langName = { en: 'English', uk: 'Ukrainian', pl: 'Polish', ru: 'Russian' }

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
  const location = useLocation()
  const preselectedDate = isNew ? (location.state?.date ?? null) : null
  const photoRef = useRef()
  const fileRef = useRef()
  const textareaRef = useRef()

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
  const [detectedLang, setDetectedLang] = useState(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [tidyModal, setTidyModal] = useState(null) // null | 'menu' | 'custom' | 'loading' | 'preview'
  const [tidyCustomPrompt, setTidyCustomPrompt] = useState('')
  const [tidyPreview, setTidyPreview] = useState('')
  const [tidyError, setTidyError] = useState('')
  const [attTranscribe, setAttTranscribe] = useState({}) // { [idx]: { loading, result, error } }
  const [attPick, setAttPick] = useState({}) // { [idx]: 'menu' | 'custom' | false }
  const [attCustom, setAttCustom] = useState({}) // { [idx]: string }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [body, editing])

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
    setDetectedLang(null)
    setDirty(false)
    const files = await db.attachments.where('entryId').equals(Number(id)).toArray()
    setAttachments(files)
    detectLanguage(entry.body || entry.title || '')
  }

  function detectLanguage(text) {
    const sample = text.slice(0, 200).trim()
    if (!sample) return
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(sample)}`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const lang = data[2]
        if (lang && LANGS.some(l => l.code === lang)) setDetectedLang(lang)
      })
      .catch(() => {})
  }

  async function handleLangClick(lang) {
    if (translating) return

    // When on a translation, clicking the primary (detected) language returns to primary
    if (activeLang && detectedLang === lang) {
      setActiveLang(null)
      setTitle(entryData.title || '')
      setBody(entryData.body || '')
      setDirty(false)
      return
    }

    // Already viewing primary — can't re-select the detected lang
    if (!activeLang && detectedLang === lang) return

    // Clicking the active lang returns to primary
    if (activeLang === lang) {
      setActiveLang(null)
      setTitle(entryData.title || '')
      setBody(entryData.body || '')
      setDirty(false)
      return
    }

    const saved = entryData?.translations?.[lang]
    if (saved && !dirty) {
      setActiveLang(lang)
      setTitle(saved.title || '')
      setBody(saved.body || '')
      setDirty(false)
      return
    }

    // Translate from the current primary state (not entryData) so unsaved audio text is included
    const sourceTitle = activeLang ? (entryData?.title || '') : title
    const sourceBody = activeLang ? (entryData?.body || '') : body

    setActiveLang(lang)
    setTitle('')
    setBody('')
    setTranslating(true)
    setTranslateError('')
    try {
      const [newTitle, newBody] = await Promise.all([
        sourceTitle ? translateText(sourceTitle, lang) : Promise.resolve(''),
        sourceBody ? translateText(sourceBody, lang) : Promise.resolve(''),
      ])
      setTitle(newTitle)
      setBody(newBody)
      setDirty(true)
    } catch (e) {
      console.error('Translation failed:', e)
      setTranslateError('Translation failed. Try again.')
      setTimeout(() => setTranslateError(''), 3000)
      setActiveLang(null)
      setTitle(sourceTitle)
      setBody(sourceBody)
    } finally {
      setTranslating(false)
    }
  }

  async function save() {
    if (saveStatus !== 'idle' && saveStatus !== 'error') return
    setSaveStatus('saving')
    const now = new Date().toISOString()
    const createdAt = preselectedDate
      ? new Date(`${preselectedDate}T12:00:00`).toISOString()
      : now
    let currentEntryData = entryData

    try {
      if (isNew) {
        const sourceId = crypto.randomUUID()
        const newId = await db.entries.add({
          sourceId, title, body, mood,
          translations: {},
          createdAt, updatedAt: now,
        })
        for (const att of attachments) {
          if (!att.id) await db.attachments.add({ ...att, entryId: newId })
        }
        currentEntryData = { id: newId, sourceId, title, body, mood, translations: {}, createdAt, updatedAt: now }
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

  const TIDY_INSTRUCTIONS = {
    tidy: 'Fix grammar and spelling mistakes. If the text is in a non-English language, translate it to English. Keep the original voice and style — this is a personal diary, not formal writing. Only make small targeted fixes; do not rewrite sentences, do not make it sound polished or literary.',
    shorten: 'Fix grammar and spelling mistakes. If the text is in a non-English language, translate it to English. Condense to the key points, cutting filler and repetition. Keep the original voice and style — this is a personal diary, not formal writing. Do not rewrite or over-polish.',
  }

  async function callTidy(instructions) {
    setTidyModal('loading')
    setTidyError('')
    try {
      const resp = await fetch('https://raspberrypi.tail51efc.ts.net/api/tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body, instructions }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setTidyPreview(data.result)
      setTidyModal('preview')
    } catch (e) {
      setTidyError('Tidy Up failed. Is the server on?')
      setTidyModal('menu')
      setTimeout(() => setTidyError(''), 4000)
    }
  }

  function handleTidyOption(mode) {
    if (mode === 'custom') { setTidyModal('custom'); return }
    callTidy(TIDY_INSTRUCTIONS[mode])
  }

  async function transcribeAttachment(idx, dataUrl, instructions) {
    setAttPick(prev => ({ ...prev, [idx]: false }))
    setAttTranscribe(prev => ({ ...prev, [idx]: { loading: true, result: '', error: '' } }))
    try {
      const base64 = dataUrl.split(',')[1]
      const resp = await fetch('https://raspberrypi.tail51efc.ts.net/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: dataUrl.split(';')[0].split(':')[1] || '', instructions }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setAttTranscribe(prev => ({ ...prev, [idx]: { loading: false, result: data.result || '', error: '' } }))
    } catch (e) {
      setAttTranscribe(prev => ({ ...prev, [idx]: { loading: false, result: '', error: e.message } }))
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
    const isCurrent = detectedLang === code
    const isSaved = !!entryData?.translations?.[code]
    if (isActive) return 'bg-indigo-600 text-white'
    if (isCurrent && !activeLang) return 'bg-sky-600/20 text-sky-300 border border-sky-500/30 cursor-default'
    if (isCurrent) return 'bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30'
    if (isSaved) return 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40'
    return 'bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
  }

  return (
    <div className="min-h-screen py-8 px-4 relative" style={{ zIndex: 1 }}>
      {deletedPromptEntry && (
        <DeletedPromptModal
          onRestore={handleRestore}
          onKeepLocal={() => setDeletedPromptEntry(null)}
          onCancel={() => setDeletedPromptEntry(null)}
        />
      )}
      {showRecorder && (
        <AudioRecorder
          onInsertText={text => { setBody(prev => prev ? prev + '\n\n' + text : text); setDirty(true) }}
          onSaveAudio={att => { setAttachments(prev => [...prev, att]); setDirty(true) }}
          onClose={() => setShowRecorder(false)}
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
      {tidyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
          <div className="bg-[#1a1a22] border border-white/10 rounded-2xl p-6 w-full max-w-lg flex flex-col gap-4 max-h-[85vh]">

            {tidyModal === 'menu' && (
              <>
                <h2 className="text-white text-lg font-semibold">Tidy Up</h2>
                <div className="flex flex-col gap-2">
                  {[
                    { mode: 'tidy', label: 'Only tidy up', desc: 'Fix grammar, translate to English' },
                    { mode: 'shorten', label: 'Tidy up and shorten', desc: 'Also condenses to key points' },
                    { mode: 'custom', label: 'Custom', desc: 'Specify what to do' },
                  ].map(({ mode, label, desc }) => (
                    <button key={mode} onClick={() => handleTidyOption(mode)}
                      className="flex flex-col items-start gap-0.5 px-4 py-3 bg-white/5 hover:bg-violet-600/20 hover:border-violet-500/30 border border-white/10 rounded-xl text-left transition-colors">
                      <span className="text-white font-medium">{label}</span>
                      <span className="text-slate-500 text-sm">{desc}</span>
                    </button>
                  ))}
                </div>
                {tidyError && <p className="text-red-400 text-xs">{tidyError}</p>}
                <button onClick={() => setTidyModal(null)} className="text-slate-500 hover:text-slate-300 text-sm py-1 transition-colors">Cancel</button>
              </>
            )}

            {tidyModal === 'custom' && (
              <>
                <h2 className="text-white text-lg font-semibold">Custom instructions</h2>
                <p className="text-slate-400 text-sm -mt-2">Translates to English by default unless you say otherwise.</p>
                <textarea
                  autoFocus
                  value={tidyCustomPrompt}
                  onChange={e => setTidyCustomPrompt(e.target.value)}
                  placeholder="e.g. Make it more formal and concise"
                  rows={4}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 text-slate-200 placeholder-slate-600 outline-none resize-none text-base leading-relaxed"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && tidyCustomPrompt.trim()) callTidy(tidyCustomPrompt + '\n\nAlso translate to English unless specifically told not to.') }}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => callTidy(tidyCustomPrompt + '\n\nAlso translate to English unless specifically told not to.')}
                    disabled={!tidyCustomPrompt.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-xl py-3 transition-colors"
                  >
                    Process
                  </button>
                  <button onClick={() => setTidyModal('menu')} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl py-3 transition-colors">Back</button>
                </div>
              </>
            )}

            {tidyModal === 'loading' && (
              <>
                <h2 className="text-white text-lg font-semibold">Processing…</h2>
                <div className="flex items-center justify-center py-10">
                  <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                </div>
              </>
            )}

            {tidyModal === 'preview' && (
              <>
                <h2 className="text-white text-lg font-semibold shrink-0">Preview</h2>
                <textarea
                  value={tidyPreview}
                  onChange={e => setTidyPreview(e.target.value)}
                  className="flex-1 overflow-y-auto bg-white/5 border border-white/10 rounded-xl p-4 text-slate-200 text-base leading-relaxed outline-none resize-none min-h-40"
                  rows={12}
                />
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() => { setBody(tidyPreview); setDirty(true); setTidyModal(null) }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl py-3 transition-colors"
                  >
                    Apply
                  </button>
                  <button onClick={() => setTidyModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl py-3 transition-colors">Cancel</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Header — outside the card */}
        <div className="flex items-center justify-between mb-4 px-1">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={26} />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm">
              {format(entryData ? new Date(entryData.createdAt) : preselectedDate ? new Date(`${preselectedDate}T12:00:00`) : new Date(), 'd MMM yyyy')}
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
                  className="text-slate-400 hover:text-white text-sm sm:text-base font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saveDisabled}
                  className={`text-white text-sm sm:text-base font-medium px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-colors disabled:opacity-40
                    ${saveStatus === 'done' ? 'bg-green-600' : saveStatus === 'error' ? 'bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                >
                  {STATUS_LABEL[saveStatus]}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-white text-sm sm:text-base font-medium px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.05] border border-white/[0.09] rounded-2xl p-6 md:p-8">
          {/* Title */}
          {editing ? (
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={e => { setTitle(e.target.value); setDirty(true) }}
              className="bg-transparent text-white text-2xl sm:text-3xl font-semibold placeholder-slate-600 outline-none border-none mb-4 w-full"
              autoFocus={isNew}
            />
          ) : (
            <h1 className="text-white text-2xl sm:text-3xl font-semibold mb-4 leading-snug">
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
                    title={detectedLang === code ? 'Entry is already in this language' : undefined}
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
              ref={textareaRef}
              placeholder="Write your thoughts…"
              value={body}
              onChange={e => { setBody(e.target.value); setDirty(true) }}
              className="bg-transparent text-slate-200 placeholder-slate-600 outline-none border-none resize-none text-lg leading-relaxed w-full min-h-64 overflow-hidden"
            />
          ) : (
            <div className="text-slate-200 text-lg leading-relaxed whitespace-pre-wrap">
              {body || <span className="text-slate-600">No content</span>}
            </div>
          )}

          {/* Attachments — right after body */}
          {!activeLang && attachments.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {attachments.map((att, i) => {
                const mediaList = attachments.filter(a => a.type?.startsWith('image/') || a.type?.startsWith('video/'))
                const mediaIdx = mediaList.indexOf(att)
                return (
                  <div key={i} className={`relative bg-white/5 border border-white/10 rounded-xl overflow-hidden group${att.type?.startsWith('audio/') ? ' col-span-2' : ''}`}>
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
                    ) : att.type?.startsWith('audio/') ? (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <Mic size={16} className="text-indigo-400 shrink-0" />
                          <audio src={att.data} controls className="flex-1 h-9 min-w-0" />
                          {attTranscribe[i]?.loading
                            ? <span className="shrink-0 w-4 h-4 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                            : !attTranscribe[i]?.result && (
                              <button
                                onClick={() => setAttPick(prev => ({ ...prev, [i]: prev[i] ? false : 'menu' }))}
                                className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${attPick[i] ? 'bg-indigo-600/40 text-indigo-200' : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300'}`}
                                title="Transcribe with AI"
                              >
                                <Sparkles size={12} />
                              </button>
                            )
                          }
                        </div>
                        {attPick[i] === 'menu' && (
                          <div className="px-4 pb-3 flex gap-2">
                            <button onClick={() => transcribeAttachment(i, att.data, VOICE_INSTRUCTIONS.preserve)} className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium transition-colors">Preserve</button>
                            <button onClick={() => transcribeAttachment(i, att.data, VOICE_INSTRUCTIONS.summarize)} className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium transition-colors">Summarize</button>
                            <button onClick={() => setAttPick(prev => ({ ...prev, [i]: 'custom' }))} className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium transition-colors">Custom</button>
                          </div>
                        )}
                        {attPick[i] === 'custom' && (
                          <div className="px-4 pb-3 flex flex-col gap-2">
                            <textarea
                              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500"
                              rows={2}
                              placeholder="Instructions for Claude…"
                              value={attCustom[i] || ''}
                              onChange={e => setAttCustom(prev => ({ ...prev, [i]: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => transcribeAttachment(i, att.data, (attCustom[i] || '') + '\n\nThis is a voice recording transcript. Translate to English unless told otherwise.')}
                                disabled={!(attCustom[i] || '').trim()}
                                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                              >Go</button>
                              <button onClick={() => setAttPick(prev => ({ ...prev, [i]: 'menu' }))} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-xs transition-colors">Back</button>
                            </div>
                          </div>
                        )}

                        {attTranscribe[i]?.error && (
                          <p className="px-4 pb-2 text-red-400 text-xs">{attTranscribe[i].error}</p>
                        )}
                        {attTranscribe[i]?.result && (
                          <div className="px-4 pb-3 flex flex-col gap-2">
                            <textarea
                              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-slate-200 resize-none focus:outline-none focus:border-indigo-500"
                              rows={3}
                              value={attTranscribe[i].result}
                              onChange={e => setAttTranscribe(prev => ({ ...prev, [i]: { ...prev[i], result: e.target.value } }))}
                            />
                            <div className="flex gap-2">
                              {editing && (
                                <button
                                  onClick={() => { setBody(prev => prev ? prev + '\n\n' + attTranscribe[i].result : attTranscribe[i].result); setDirty(true); setAttTranscribe(prev => ({ ...prev, [i]: { ...prev[i], result: '' } })) }}
                                  className="flex-1 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                                >Insert into note</button>
                              )}
                              <button
                                onClick={() => setAttTranscribe(prev => ({ ...prev, [i]: { ...prev[i], result: '' } }))}
                                className="flex-1 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-400 text-xs transition-colors"
                              >Dismiss</button>
                            </div>
                          </div>
                        )}
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

          {/* Photo / File buttons — edit mode only */}
          {!activeLang && editing && (
            <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-5 flex-wrap">
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
              <button onClick={() => setShowRecorder(true)} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-base transition-colors">
                <Mic size={20} />
                <span>Voice</span>
              </button>
              <button
                onClick={() => { if (body.trim()) setTidyModal('menu') }}
                disabled={!body.trim()}
                className="flex items-center gap-2 text-slate-400 hover:text-violet-300 disabled:opacity-40 text-base transition-colors ml-auto"
              >
                <Sparkles size={20} />
                <span>Tidy Up</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxIndex !== null && (
        <MediaLightbox
          media={attachments.filter(a => a.type?.startsWith('image/') || a.type?.startsWith('video/'))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
