const MILESTONES = [
  { date: '2027-01', label: 'Expert 1 raise',         detail: '+500–800 PLN/month net',                  type: 'good' },
  { date: '2033-08', label: 'Cash loan fully paid',    detail: '+2,339 PLN/month freed',                  type: 'good' },
  { date: '2035-09', label: 'Subsidy cliff',           detail: '−335 PLN/month (but loan already gone)',  type: 'warn' },
  { date: '2039-03', label: 'Mortgage rate reset',     detail: 'Resets to NBP market rate',               type: 'warn' },
  { date: '2044-02', label: 'Mortgage fully paid',     detail: '+2,895 PLN/month freed',                  type: 'good' },
]

function formatDate(yyyyMM) {
  const [y, m] = yyyyMM.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m,10)-1]} ${y}`
}

export default function MilestoneTimeline() {
  const now = new Date()
  const nowKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-4">Milestones</p>
      <div className="space-y-0">
        {MILESTONES.map((m, i) => {
          const past = m.date < nowKey
          const isLast = i === MILESTONES.length - 1
          return (
            <div key={m.date} className="flex gap-3">
              {/* Spine */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 ${
                  past
                    ? 'bg-slate-600 border-slate-600'
                    : m.type === 'good'
                      ? 'bg-emerald-500/30 border-emerald-500'
                      : 'bg-amber-500/30 border-amber-500'
                }`} />
                {!isLast && <div className="w-px flex-1 bg-white/8 my-1" />}
              </div>
              {/* Content */}
              <div className={`pb-5 ${isLast ? 'pb-0' : ''}`}>
                <p className={`text-xs font-medium ${past ? 'text-slate-500' : 'text-slate-300'}`}>
                  {formatDate(m.date)}
                </p>
                <p className={`text-sm font-semibold ${
                  past ? 'text-slate-600' : m.type === 'good' ? 'text-white' : 'text-amber-300'
                }`}>
                  {m.label}
                </p>
                <p className={`text-xs ${past ? 'text-slate-700' : 'text-slate-500'}`}>{m.detail}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
