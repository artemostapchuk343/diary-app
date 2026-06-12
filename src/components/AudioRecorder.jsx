import { useState, useRef, useEffect } from 'react'
import { X, Mic, Square } from 'lucide-react'


const INSTRUCTIONS = {
  preserve: `Fix ONLY transcription errors, spelling, and grammar. Preserve EVERY sentence and idea — do NOT summarize, shorten, condense, or remove any content. If not in English, translate to English. Keep the personal voice and style exactly as spoken. Return the full corrected text, nothing else.`,
  summarize: `This is a personal diary voice note. Summarize it to roughly half the length — keep the key events, feelings, and decisions, cut filler and repetition. If not in English, translate to English. Return only the summary, no explanations.`,
}

function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

function blobToBase64(blob) {
  return new Promise(res => {
    const reader = new FileReader()
    reader.onload = e => res(e.target.result.split(',')[1])
    reader.readAsDataURL(blob)
  })
}

function blobToDataUrl(blob) {
  return new Promise(res => {
    const reader = new FileReader()
    reader.onload = e => res(e.target.result)
    reader.readAsDataURL(blob)
  })
}

export default function AudioRecorder({ onInsertText, onSaveAudio, onClose }) {
  const [phase, setPhase] = useState('idle') // idle | recording | processing | preview
  const [elapsed, setElapsed] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState('preserve') // preserve | summarize | custom
  const [customPrompt, setCustomPrompt] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const urlRef = useRef(null)
  const wakeLockRef = useRef(null)

  useEffect(() => () => cleanup(), [])

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {}
  }

  function releaseWakeLock() {
    try { wakeLockRef.current?.release() } catch {}
    wakeLockRef.current = null
  }

  function cleanup() {
    clearInterval(timerRef.current)
    releaseWakeLock()
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
  }

  async function start() {
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

    await acquireWakeLock()
    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    setPhase('recording')
  }

  function stop() {
    clearInterval(timerRef.current)

    const mr = mediaRecorderRef.current
    if (mr?.state !== 'inactive') {
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const ext = blob.type?.includes('ogg') ? 'ogg' : blob.type?.includes('mp4') ? 'mp4' : 'webm'
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setAudioBlob({ blob, ext, type: blob.type || 'audio/webm', size: blob.size })
        setAudioUrl(url)
        await sendToServer(blob)
      }
      mr.stop()
    }

    releaseWakeLock()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setPhase('processing')
  }

  async function sendToServer(blob) {
    setError('')
    const instructions = mode === 'custom' && customPrompt
      ? customPrompt + '\n\nThis is a voice recording transcript. Translate to English unless told otherwise.'
      : INSTRUCTIONS[mode] || INSTRUCTIONS.preserve

    try {
      const audioBase64 = await blobToBase64(blob)
      const resp = await fetch('https://raspberrypi.tail51efc.ts.net/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioBase64, instructions, mimeType: blob.type || '' }),
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setResult(data.result || '')
    } catch (e) {
      setError('Transcription failed: ' + e.message)
    }
    setPhase('preview')
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
              {['preserve', 'summarize', 'custom'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${mode === m ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  {m === 'preserve' ? 'Preserve' : m === 'summarize' ? 'Summarize' : 'Custom'}
                </button>
              ))}
            </div>

            {mode === 'custom' && (
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
                disabled={mode === 'custom' && !customPrompt.trim()}
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
            <span className="text-slate-400 text-sm">Transcribing…</span>
          </div>
        )}

        {/* Preview */}
        {phase === 'preview' && (
          <div className="flex flex-col gap-4">
            {error && <p className="text-red-400 text-sm">{error}</p>}
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
