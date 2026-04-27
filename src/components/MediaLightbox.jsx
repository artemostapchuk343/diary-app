import { useState, useEffect, useRef } from 'react'
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Video } from 'lucide-react'

export default function MediaLightbox({ media, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const containerRef = useRef()
  const touchStartX = useRef(null)

  const current = media[index]

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function goTo(i) {
    setIndex(i)
    resetView()
  }

  function prev() { goTo((index - 1 + media.length) % media.length) }
  function next() { goTo((index + 1) % media.length) }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index])

  // Non-passive wheel for zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = e => {
      e.preventDefault()
      setZoom(z => {
        const next = e.deltaY < 0 ? Math.min(z * 1.2, 8) : Math.max(z / 1.2, 1)
        if (next <= 1) setPan({ x: 0, y: 0 })
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onMouseDown(e) {
    if (zoom <= 1) return
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  }

  function onMouseMove(e) {
    if (!isDragging) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    })
  }

  function onMouseUp() { setIsDragging(false) }

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 50) { diff > 0 ? prev() : next() }
    touchStartX.current = null
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0 bg-black/40">
        <span className="text-slate-400 text-sm truncate max-w-xs">{current.name}</span>
        <div className="flex items-center gap-1 shrink-0 ml-4">
          {media.length > 1 && (
            <span className="text-slate-500 text-sm mr-3">{index + 1} / {media.length}</span>
          )}
          <button
            onClick={() => setZoom(z => { const n = Math.max(z / 1.5, 1); if (n <= 1) setPan({ x: 0, y: 0 }); return n })}
            disabled={zoom <= 1}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-white/10"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-slate-500 text-xs w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(z * 1.5, 8))}
            disabled={zoom >= 8}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-white/10"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10 ml-2"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onDoubleClick={resetView}
      >
        <div style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s',
        }}>
          {current.type?.startsWith('image/') && (
            <img
              src={current.data}
              alt={current.name}
              draggable={false}
              style={{
                maxWidth: '90vw',
                maxHeight: '72vh',
                objectFit: 'contain',
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease',
              }}
            />
          )}
          {current.type?.startsWith('video/') && (
            <video
              src={current.data}
              controls
              autoPlay
              style={{ maxWidth: '90vw', maxHeight: '72vh' }}
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>

        {media.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); next() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails strip */}
      {media.length > 1 && (
        <div className="flex items-center justify-center gap-2 py-3 px-6 shrink-0 bg-black/40 flex-wrap">
          {media.map((m, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === index ? 'border-indigo-500 opacity-100' : 'border-white/10 opacity-40 hover:opacity-70'
              }`}
            >
              {m.type?.startsWith('image/') ? (
                <img src={m.data} alt={m.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <Video size={18} className="text-slate-400" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
