import { useState, useRef, useEffect } from 'react'
import { X, Mic, Square } from 'lucide-react'

const LANGUAGES = [
  { code: 'uk-UA', flag: '🇺🇦', label: 'UA' },
  { code: 'pl-PL', flag: '🇵🇱', label: 'PL' },
  { code: 'en-US', flag: '🇬🇧', label: 'EN' },
  { code: 'ru-RU', flag: '🇷🇺', label: 'RU' },
]

const LANG_KEY = 'audio_lang'

async function translateToLang(text, tl) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const data = await resp.json()
    return data[0]?.filter(Boolean).map(s => s[0]).filter(Boolean).join('') || null
  } catch {
    return null
  }
}

function basicCleanup(text) {
  let t = text.trim()
  if (!t) return t
  t = t.charAt(0).toUpperCase() + t.slice(1)
  if (!/[.!?…]$/.test(t)) t += '.'
  return t
}

async function prepareTranscript(text, bcp47, targetLang) {
  const audioLang = bcp47.split('-')[0]
  const tl = targetLang || audioLang
  if (tl !== audioLang) {
    // Cross-language: translate to entry language (adds punctuation naturally)
    return await translateToLang(text, tl) ?? basicCleanup(text)
  }
  // Same-language: just clean up — no translation
  return basicCleanup(text)
}

function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

export default function AudioRecorder({ onInsertText, onSaveAudio, onClose, targetLang }) {
  const [phase, setPhase] = useState('idle') // idle | recording | preview
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'uk-UA')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [elapsed, setElapsed] = useState(0)

  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const finalRef = useRef('')
  const urlRef = useRef(null)

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    clearInterval(timerRef.current)
    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) { try { rec.abort() } catch {} }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
  }

  async function start() {
    finalRef.current = ''
    setTranscript('')
    setInterim('')
    setElapsed(0)
    setAudioUrl(null)
    setAudioBlob(null)
    chunksRef.current = []

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      alert('Microphone access denied.')
      return
    }
    streamRef.current = stream

    const mr = new MediaRecorder(stream)
    mediaRecorderRef.current = mr
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.start()

    if (SR) {
      const rec = new SR()
      rec.lang = lang
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = e => {
        let fin = ''
        let int = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript
          else int += e.results[i][0].transcript
        }
        if (fin) { finalRef.current += fin + ' '; setTranscript(finalRef.current) }
        setInterim(int)
      }
      rec.onerror = () => {}
      rec.onend = () => {
        if (recognitionRef.current === rec) { try { rec.start() } catch {} }
      }
      rec.start()
      recognitionRef.current = rec
    }

    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    setPhase('recording')
  }

  function stop() {
    clearInterval(timerRef.current)
    setInterim('')

    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) { try { rec.stop() } catch {} }

    const mr = mediaRecorderRef.current
    if (mr?.state !== 'inactive') {
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setAudioBlob(blob)
        setAudioUrl(url)
      }
      mr.stop()
    }

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    setTranscript(finalRef.current.trim())
    setPhase('preview')
  }

  function blobToDataUrl(blob) {
    return new Promise(res => {
      const reader = new FileReader()
      reader.onload = e => res(e.target.result)
      reader.readAsDataURL(blob)
    })
  }

  async function handleInsert() {
    const text = await prepareTranscript(transcript, lang, targetLang)
    onInsertText(text)
    onClose()
  }

  async function handleSave() {
    if (!audioBlob) { onClose(); return }
    const ext = audioBlob.type?.includes('ogg') ? 'ogg' : 'webm'
    const name = `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`
    const data = await blobToDataUrl(audioBlob)
    onSaveAudio({ name, type: audioBlob.type || 'audio/webm', size: audioBlob.size, data })
    onClose()
  }

  async function handleBoth() {
    if (transcript) {
      const text = await prepareTranscript(transcript, lang, targetLang)
      onInsertText(text)
    }
    if (audioBlob) {
      const ext = audioBlob.type?.includes('ogg') ? 'ogg' : 'webm'
      const name = `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`
      const data = await blobToDataUrl(audioBlob)
      onSaveAudio({ name, type: audioBlob.type || 'audio/webm', size: audioBlob.size, data })
    }
    onClose()
  }

  function changeLang(code) {
    setLang(code)
    localStorage.setItem(LANG_KEY, code)
  }

  const hasTranscript = transcript.length > 0

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-0 sm:px-6">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-indigo-400" />
            <span className="text-white font-semibold">Voice Note</span>
          </div>
          <button onClick={() => { cleanup(); onClose() }} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Language selector — hidden while recording */}
        {phase !== 'recording' && (
          <div className="flex gap-2 mb-5">
            {LANGUAGES.map(({ code, flag, label }) => (
              <button
                key={code}
                onClick={() => changeLang(code)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  lang === code
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                <span>{flag}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Idle */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-4">
            {!SR && (
              <p className="text-slate-400 text-sm text-center">
                Live transcription not available in this browser — audio will be saved.
              </p>
            )}
            <button
              onClick={start}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg"
            >
              <Mic size={28} className="text-white" />
            </button>
            <span className="text-slate-500 text-sm">Tap to start</span>
          </div>
        )}

        {/* Recording */}
        {phase === 'recording' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-white font-mono text-lg">{fmt(elapsed)}</span>
            </div>
            <div className="min-h-24 max-h-40 overflow-y-auto bg-white/5 rounded-xl p-3 text-sm leading-relaxed">
              {transcript || interim ? (
                <>
                  <span className="text-slate-200">{transcript}</span>
                  <span className="text-slate-500">{interim}</span>
                </>
              ) : (
                <span className="text-slate-600">{SR ? 'Start speaking…' : 'Recording audio…'}</span>
              )}
            </div>
            <button
              onClick={stop}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Square size={15} className="fill-white" />
              Stop
            </button>
          </div>
        )}

        {/* Preview */}
        {phase === 'preview' && (
          <div className="flex flex-col gap-4">
            {hasTranscript && (
              <div className="max-h-40 overflow-y-auto bg-white/5 rounded-xl p-3 text-sm text-slate-200 leading-relaxed">
                {transcript}
              </div>
            )}
            {audioUrl && <audio src={audioUrl} controls className="w-full" />}
            {!hasTranscript && !audioUrl && (
              <p className="text-slate-500 text-sm text-center py-2">Nothing recorded.</p>
            )}

            <div className="flex flex-col gap-2">
              {hasTranscript && audioUrl && (
                <button
                  onClick={handleBoth}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                >
                  Insert text + save audio
                </button>
              )}
              <div className="flex gap-2">
                {hasTranscript && (
                  <button onClick={handleInsert} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors">
                    Insert text
                  </button>
                )}
                {audioUrl && (
                  <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors">
                    Save audio
                  </button>
                )}
              </div>
              <button
                onClick={() => { cleanup(); onClose() }}
                className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
