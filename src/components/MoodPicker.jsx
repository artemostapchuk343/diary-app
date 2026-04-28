import { useState, useRef, useEffect } from 'react'
import { Smile } from 'lucide-react'

const MOODS = [
  '😊', '😔', '😤', '😴', '🥰', '😰', '🤔', '🎉', '😌', '🔥',
  '😂', '😭', '😍', '🥺', '😎', '🤯', '😇', '🤩', '😏', '😒',
  '😳', '🥴', '😵', '🤧', '😷', '🤒', '😬', '🙄', '😶', '🤐',
  '😡', '🤬', '😈', '💀', '🫠', '🥹', '🫡', '🤫', '🫢', '😮',
  '❤️', '💔', '💪', '🙏', '✨', '🌙', '☀️', '🌧️', '⚡', '🌈',
  '🍀', '🌸', '🎵', '🎯', '💡', '📚', '💤', '🏃', '🧘', '🍕',
]

export default function MoodPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(emoji) {
    onChange(value === emoji ? '' : emoji)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-base transition-colors border ${
          value
            ? 'border-indigo-500/50 bg-indigo-600/20 text-white'
            : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:border-white/20'
        }`}
      >
        {value ? (
          <span className="text-2xl leading-none">{value}</span>
        ) : (
          <Smile size={20} />
        )}
        <span>{value ? 'Mood' : 'Add mood'}</span>
        {value && (
          <span
            className="ml-1 text-slate-400 hover:text-white text-lg leading-none"
            onClick={e => { e.stopPropagation(); onChange('') }}
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 shadow-2xl w-64 sm:w-80">
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-1">
            {MOODS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => select(emoji)}
                className={`text-2xl p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                  value === emoji ? 'bg-indigo-600/30 ring-1 ring-indigo-500' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
