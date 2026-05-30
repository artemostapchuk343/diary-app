import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, MapPin, Calendar, Wallet } from 'lucide-react'
import { useTravelData } from '../useTravelData'

function fmtPLN(n) {
  return n.toLocaleString('pl-PL') + ' PLN'
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SectionBar({ pct, color }) {
  return (
    <div className="h-1 bg-white/8 rounded-full overflow-hidden mt-2 mb-3">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function TripCard({ trip }) {
  const [open, setOpen] = useState(true)

  const dateFrom = fmtDate(trip.dates.from)
  const dateTo   = fmtDate(trip.dates.to)

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-4">

      {/* Header banner */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
      >
        <div
          className="px-5 py-5 relative"
          style={{
            background: `linear-gradient(135deg, ${trip.color}30 0%, ${trip.color}10 100%)`,
            borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{trip.flag}</span>
                <h2 className="text-white text-xl font-bold tracking-tight">{trip.destination}</h2>
              </div>
              <p className="text-slate-400 text-sm">{trip.subtitle}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Calendar size={12} />
                  <span>{dateFrom} — {dateTo}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <MapPin size={12} />
                  <span>{trip.days} days</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white text-xl font-bold">{fmtPLN(trip.totalPLN)}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                ~{Math.round(trip.totalPLN / trip.days).toLocaleString('pl-PL')} PLN/day
              </p>
              <div className="mt-2 flex justify-end">
                {open
                  ? <ChevronUp size={16} className="text-slate-500" />
                  : <ChevronDown size={16} className="text-slate-500" />
                }
              </div>
            </div>
          </div>

          {/* Mini section bars (collapsed summary) */}
          {!open && (
            <div className="flex gap-1 mt-4 h-1.5 rounded-full overflow-hidden">
              {trip.sections.map(s => (
                <div
                  key={s.id}
                  className="h-full rounded-full"
                  style={{
                    flex: s.total,
                    background: trip.color,
                    opacity: 0.4 + (s.total / trip.totalPLN) * 0.6,
                  }}
                  title={`${s.label}: ${fmtPLN(s.total)}`}
                />
              ))}
            </div>
          )}
        </div>
      </button>

      {/* Expense sections */}
      {open && (
        <div className="divide-y divide-white/[0.04]">
          {trip.sections.map(section => {
            const pct = Math.round((section.total / trip.totalPLN) * 100)
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

                <SectionBar pct={pct} color={trip.color} />

                <div className="space-y-2">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-baseline gap-2">
                      <span className="text-slate-600 text-xs w-4 shrink-0 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-300 text-xs">{item.name}</span>
                        {item.note && (
                          <span className="text-slate-600 text-xs ml-1.5">· {item.note}</span>
                        )}
                      </div>
                      <span className="text-slate-400 text-xs font-medium shrink-0">
                        {item.amount.toLocaleString('pl-PL')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Total row */}
          <div className="px-5 py-4 flex items-center justify-between"
               style={{ background: `${trip.color}08` }}>
            <div className="flex items-center gap-2">
              <Wallet size={15} className="text-slate-400" />
              <span className="text-slate-300 text-sm font-semibold">Total trip cost</span>
            </div>
            <span className="text-white text-base font-bold">{fmtPLN(trip.totalPLN)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Travel() {
  const { trips, loaded, load } = useTravelData()

  useEffect(() => { if (!loaded) load() }, [loaded])

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 md:px-8" style={{ zIndex: 1 }}>
      <div className="max-w-xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-2xl font-bold">Travel</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'} · {fmtPLN(trips.reduce((s, t) => s + t.totalPLN, 0))} total
            </p>
          </div>
        </div>

        {trips.map(trip => (
          <TripCard key={trip.id} trip={trip} />
        ))}

        {trips.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">✈️</p>
            <p className="text-slate-400 text-base font-medium">No trips yet</p>
            <p className="text-slate-600 text-sm mt-1">Add your first travel note</p>
          </div>
        )}

      </div>
    </div>
  )
}
