import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, MapPin, Calendar, Wallet, Pencil, Plus, Trash2, Check, X, Loader2 } from 'lucide-react'
import { useTravelData } from '../useTravelData'

function fmtPLN(n) {
  return Number(n).toLocaleString('pl-PL') + ' PLN'
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Derive totals from items so they stay accurate after edits
function calcTotals(sections) {
  return sections.map(s => ({
    ...s,
    total: s.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
  }))
}

function totalFromSections(sections) {
  return sections.reduce((sum, s) => sum + s.items.reduce((si, it) => si + (Number(it.amount) || 0), 0), 0)
}

// ── View mode ─────────────────────────────────────────────────────────────────

function SectionBar({ pct, color }) {
  return (
    <div className="h-1 bg-white/8 rounded-full overflow-hidden mt-2 mb-3">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  )
}

// ── Edit mode ─────────────────────────────────────────────────────────────────

function EditItem({ item, onChange, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <input
          value={item.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Item name"
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-600"
        />
        <input
          value={item.note ?? ''}
          onChange={e => onChange('note', e.target.value)}
          placeholder="note"
          className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 placeholder:text-slate-700 outline-none focus:border-emerald-600"
        />
      </div>
      <input
        type="number"
        value={item.amount}
        onChange={e => onChange('amount', parseFloat(e.target.value) || 0)}
        className="w-20 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-right outline-none focus:border-emerald-600"
      />
      <button
        onClick={onDelete}
        className="text-slate-700 hover:text-red-400 transition-colors p-1 shrink-0"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function EditSection({ section, color, onChangeLabel, onChangeIcon, onChangeItem, onDeleteItem, onAddItem }) {
  const total = section.items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  return (
    <div className="px-5 py-4 border-b border-white/[0.04]">
      <div className="flex items-center gap-2 mb-3">
        <input
          value={section.icon}
          onChange={e => onChangeIcon(e.target.value)}
          className="w-8 bg-transparent text-base text-center outline-none"
          maxLength={2}
        />
        <input
          value={section.label}
          onChange={e => onChangeLabel(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white outline-none focus:border-emerald-600"
        />
        <span className="text-slate-400 text-xs font-medium shrink-0 w-20 text-right">
          {total.toLocaleString('pl-PL')}
        </span>
      </div>

      <div className="space-y-0.5 mb-2">
        {section.items.map((item, i) => (
          <EditItem
            key={i}
            item={item}
            onChange={(field, val) => onChangeItem(i, field, val)}
            onDelete={() => onDeleteItem(i)}
          />
        ))}
      </div>

      <button
        onClick={onAddItem}
        className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-400 transition-colors py-1"
      >
        <Plus size={13} />
        Add item
      </button>
    </div>
  )
}

// ── Trip card ─────────────────────────────────────────────────────────────────

function TripCard({ trip, onSave }) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(trip)))
    setOpen(true)
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(null)
    setEditing(false)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const sections = calcTotals(draft.sections)
      const totalPLN = totalFromSections(sections)
      await onSave({ ...draft, sections, totalPLN })
      setDraft(null)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function setDraftField(field, value) {
    setDraft(d => ({ ...d, [field]: value }))
  }

  function setSectionField(sIdx, field, value) {
    setDraft(d => {
      const sections = d.sections.map((s, i) => i === sIdx ? { ...s, [field]: value } : s)
      return { ...d, sections }
    })
  }

  function setItemField(sIdx, iIdx, field, value) {
    setDraft(d => {
      const sections = d.sections.map((s, si) => {
        if (si !== sIdx) return s
        const items = s.items.map((it, ii) => ii === iIdx ? { ...it, [field]: value } : it)
        return { ...s, items }
      })
      return { ...d, sections }
    })
  }

  function deleteItem(sIdx, iIdx) {
    setDraft(d => {
      const sections = d.sections.map((s, si) => {
        if (si !== sIdx) return s
        return { ...s, items: s.items.filter((_, ii) => ii !== iIdx) }
      })
      return { ...d, sections }
    })
  }

  function addItem(sIdx) {
    setDraft(d => {
      const sections = d.sections.map((s, si) => {
        if (si !== sIdx) return s
        return { ...s, items: [...s.items, { name: '', amount: 0, note: '' }] }
      })
      return { ...d, sections }
    })
  }

  const data = editing ? draft : trip
  const dateFrom = fmtDate(data.dates.from)
  const dateTo   = fmtDate(data.dates.to)
  const liveTotal = editing ? totalFromSections(data.sections) : data.totalPLN

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-4">

      {/* Header */}
      <div
        className="px-5 py-5"
        style={{
          background: `linear-gradient(135deg, ${data.color}30 0%, ${data.color}10 100%)`,
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        {editing ? (
          /* ── Edit header ── */
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={data.flag}
                onChange={e => setDraftField('flag', e.target.value)}
                className="w-12 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xl text-center outline-none focus:border-emerald-600"
                maxLength={2}
              />
              <input
                value={data.destination}
                onChange={e => setDraftField('destination', e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-lg font-bold text-white outline-none focus:border-emerald-600"
              />
            </div>
            <input
              value={data.subtitle}
              onChange={e => setDraftField('subtitle', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-emerald-600"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-slate-600 text-xs mb-1">From</p>
                <input
                  type="date"
                  value={data.dates.from}
                  onChange={e => setDraftField('dates', { ...data.dates, from: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-600 [color-scheme:dark]"
                />
              </div>
              <div className="flex-1">
                <p className="text-slate-600 text-xs mb-1">To</p>
                <input
                  type="date"
                  value={data.dates.to}
                  onChange={e => {
                    const from = new Date(data.dates.from)
                    const to = new Date(e.target.value)
                    const days = Math.max(1, Math.round((to - from) / 86400000) + 1)
                    setDraft(d => ({ ...d, dates: { ...d.dates, to: e.target.value }, days }))
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-600 [color-scheme:dark]"
                />
              </div>
            </div>
            {/* Save / Cancel */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={cancelEdit}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-xl py-2.5 transition-colors"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
              >
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : <><Check size={14} /> Save</>
                }
              </button>
            </div>
          </div>
        ) : (
          /* ── View header ── */
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => setOpen(o => !o)} className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{data.flag}</span>
                <h2 className="text-white text-xl font-bold tracking-tight">{data.destination}</h2>
              </div>
              <p className="text-slate-400 text-sm">{data.subtitle}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Calendar size={12} />
                  <span>{dateFrom} — {dateTo}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <MapPin size={12} />
                  <span>{data.days} days</span>
                </div>
              </div>
            </button>
            <div className="text-right shrink-0 flex flex-col items-end gap-2">
              <p className="text-white text-xl font-bold">{fmtPLN(liveTotal)}</p>
              <p className="text-slate-500 text-xs">
                ~{Math.round(liveTotal / data.days).toLocaleString('pl-PL')} PLN/day
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={startEdit}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  <Pencil size={14} />
                </button>
                <button onClick={() => setOpen(o => !o)} className="text-slate-500 p-1">
                  {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed mini bars */}
        {!open && !editing && (
          <div className="flex gap-1 mt-4 h-1.5 rounded-full overflow-hidden">
            {data.sections.map(s => (
              <div
                key={s.id}
                className="h-full rounded-full"
                style={{ flex: s.total, background: data.color, opacity: 0.4 + (s.total / liveTotal) * 0.6 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {open && (
        editing ? (
          /* ── Edit sections ── */
          <div>
            {data.sections.map((section, sIdx) => (
              <EditSection
                key={section.id}
                section={section}
                color={data.color}
                onChangeLabel={v => setSectionField(sIdx, 'label', v)}
                onChangeIcon={v => setSectionField(sIdx, 'icon', v)}
                onChangeItem={(iIdx, field, val) => setItemField(sIdx, iIdx, field, val)}
                onDeleteItem={iIdx => deleteItem(sIdx, iIdx)}
                onAddItem={() => addItem(sIdx)}
              />
            ))}
            {/* Live total */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: `${data.color}08` }}>
              <div className="flex items-center gap-2">
                <Wallet size={15} className="text-slate-400" />
                <span className="text-slate-300 text-sm font-semibold">Calculated total</span>
              </div>
              <span className="text-white text-base font-bold">{fmtPLN(liveTotal)}</span>
            </div>
          </div>
        ) : (
          /* ── View sections ── */
          <div className="divide-y divide-white/[0.04]">
            {data.sections.map(section => {
              const pct = liveTotal > 0 ? Math.round((section.total / liveTotal) * 100) : 0
              return (
                <div key={section.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{section.icon}</span>
                      <span className="text-white text-sm font-semibold">{section.label}</span>
                      <span className="text-slate-600 text-xs">{pct}%</span>
                    </div>
                    <span className="text-slate-300 text-sm font-semibold">{fmtPLN(section.total)}</span>
                  </div>
                  <SectionBar pct={pct} color={data.color} />
                  <div className="space-y-2">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <span className="text-slate-600 text-xs w-4 shrink-0 text-right">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-slate-300 text-xs">{item.name}</span>
                          {item.note && <span className="text-slate-600 text-xs ml-1.5">· {item.note}</span>}
                        </div>
                        <span className="text-slate-400 text-xs font-medium shrink-0">
                          {Number(item.amount).toLocaleString('pl-PL')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: `${data.color}08` }}>
              <div className="flex items-center gap-2">
                <Wallet size={15} className="text-slate-400" />
                <span className="text-slate-300 text-sm font-semibold">Total trip cost</span>
              </div>
              <span className="text-white text-base font-bold">{fmtPLN(liveTotal)}</span>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Travel() {
  const { trips, loaded, load, updateTrip } = useTravelData()

  useEffect(() => { if (!loaded) load() }, [loaded])

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  const grandTotal = trips.reduce((s, t) => s + t.totalPLN, 0)

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 md:px-8" style={{ zIndex: 1 }}>
      <div className="max-w-xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-2xl font-bold">Travel</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'} · {fmtPLN(grandTotal)} total
            </p>
          </div>
        </div>

        {trips.map(trip => (
          <TripCard
            key={trip.id}
            trip={trip}
            onSave={updated => updateTrip(trip.id, updated)}
          />
        ))}

        {trips.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">✈️</p>
            <p className="text-slate-400 text-base font-medium">No trips yet</p>
          </div>
        )}

      </div>
    </div>
  )
}
