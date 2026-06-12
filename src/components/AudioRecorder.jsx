import { useState, useRef, useEffect } from 'react'
import { X, Mic, Square } from 'lucide-react'

const LANGUAGES = [
  { code: 'uk-UA', flag: '🇺🇦', label: 'UA' },
  { code: 'pl-PL', flag: '🇵🇱', label: 'PL' },
  { code: 'en-US', flag: '🇬🇧', label: 'EN' },
  { code: 'ru-RU', flag: '🇷🇺', label: 'RU' },
]

const LANG_KEY = 'audio_lang'

const DEFAULT_INSTRUCTIONS = `This is a raw voice-to-text transcript from a personal diary audio recording. Fix transcription errors, grammar, and spelling. If not in English, translate to English. Keep the personal voice and style — this is a diary, not formal writing. Return only the cleaned text, no explanations.`

function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

export default function AudioRecorder({ onInsertText, onSaveAudio, onClose }) {
  const [phase, setPhase] = useState('idle') // idle | recording | processing | preview
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'uk-UA')
  const [elapsed, setElapsed] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')

  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const finalRef = useRef('')
  const urlRef = useRef(null)

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
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
    setElapsed(0)
    setAudioUrl(null)
    setAudioBlob(null)
    setResult('')
    setError('')
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
      rec.interimResults = false
      rec.onresult = e => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript + ' '
        }
      }
      rec.onerror = () => {}
      // On mobile, don't restart — the beep-on-restart loop makes it unusable
      rec.onend = () => {
        if (!isMobile && recognitionRef.current === rec) { try { rec.start() } catch {} }
      }
      rec.start()
      recognitionRef.current = rec
    }

    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    setPhase('recording')
  }

  function stop() {
    clearInterval(timerRef.current)

    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) { try { rec.stop() } catch {} }

    const mr = mediaRecorderRef.current
    if (mr?.state !== 'inactive') {
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const ext = blob.type?.includes('ogg') ? 'ogg' : blob.type?.includes('mp4') ? 'mp4' : 'webm'
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setAudioBlob({ blob, ext, type: blob.type || 'audio/webm', size: blob.size })
        setAudioUrl(url)
        sendToServer(finalRef.current.trim())
      }
      mr.stop()
    } else {
      sendToServer(finalRef.current.trim())
    }

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setPhase('processing')
  }

  async function sendToServer(rawTranscript, instructions) {
    setPhase('processing')
    setError('')
    const inst = instructions || (customMode && customPrompt
      ? customPrompt + '\n\nThis is a voice recording transcript. Translate to English unless told otherwise.'
      : DEFAULT_INSTRUCTIONS)

    if (!rawTranscript) {
      setResult('')
      setPhase('preview')
      return
    }

    try {
      const resp = await fetch('https://raspberrypi.tail51efc.ts.net/api/tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawTranscript, instructions: inst }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setResult(data.result)
    } catch {
      setError('Failed to process. You can still save the audio note.')
      setResult(rawTranscript)
    }
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
    if (result) onInsertText(result)
    onClose()
  }

  async function handleSaveAudio() {
    if (!audioBlob) { onClose(); return }
    const name = `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${audioBlob.ext}`
    const data = await blobToDataUrl(audioBlob.blob)
    onSaveAudio({ name, type: audioBlob.type, size: audioBlob.size, data })
    onClose()
  }

  async function handleBoth() {
    if (result) onInsertText(result)
    if (audioBlob) {
      const name = `voice-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${audioBlob.ext}`
      const data = await blobToDataUrl(audioBlob.blob)
      onSaveAudio({ name, type: audioBlob.type, size: audioBlob.size, data })
    }
    onClose()
  }

  function changeLang(code) {
    setLang(code)
    localStorage.setItem(LANG_KEY, code)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-0 sm:px-6">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-indigo-400" />
            <span className="text-white font-semibold">Voice Note</span>
          </div>
          <button onClick={() => { cleanup(); onClose() }} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Idle */}
        {phase === 'idle' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {LANGUAGES.map(({ code, flag, label }) => (
                <button
                  key={code}
                  onClick={() => changeLang(code)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    lang === code ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                  }`}
                >
                  <span>{flag}</span><span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCustomMode(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!customMode ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                Default
              </button>
              <button
                onClick={() => setCustomMode(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${customMode ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                Custom
              </button>
            </div>

            {customMode && (
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500"
                rows={3}
                placeholder="Instructions for Claude…"
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
              />
            )}

            <div className="flex flex-col items-center gap-2 py-2">
              <button
                onClick={start}
                disabled={customMode && !customPrompt.trim()}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-40 flex items-center justify-center transition-colors shadow-lg"
              >
                <Mic size={28} className="text-white" />
              </button>
              <span className="text-slate-500 text-sm">Tap to start</span>
            </div>
          </div>
        )}

        {/* Recording */}
        {phase === 'recording' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-white font-mono text-lg">{fmt(elapsed)}</span>
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

        {/* Processing */}
        {phase === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Claude is processing…</span>
          </div>
        )}

        {/* Preview */}
        {phase === 'preview' && (
          <div className="flex flex-col gap-4">
            {error && <p className="text-amber-400 text-sm">{error}</p>}
            {result ? (
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-slate-200 leading-relaxed resize-none focus:outline-none focus:border-indigo-500"
                rows={6}
                value={result}
                onChange={e => setResult(e.target.value)}
              />
            ) : null}
            {audioUrl && <audio src={audioUrl} controls className="w-full" />}

            <div className="flex flex-col gap-2">
              {result && audioUrl && (
                <button onClick={handleBoth} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                  Insert text + save audio
                </button>
              )}
              <div className="flex gap-2">
                {result && (
                  <button onClick={handleInsert} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors">
                    Insert text only
                  </button>
                )}
                {audioUrl && (
                  <button onClick={handleSaveAudio} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors">
                    Save audio only
                  </button>
                )}
              </div>
              <button onClick={() => { cleanup(); onClose() }} className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-300 text-sm transition-colors">
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
