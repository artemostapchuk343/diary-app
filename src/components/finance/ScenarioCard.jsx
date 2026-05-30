import { SCENARIOS, pillowMonthsLeft } from '../../useFinance'
import { useFinance } from '../../useFinance'

function formatPLN(n) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatDate(yyyyMM) {
  const [y, m] = yyyyMM.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m,10)-1]} ${y}`
}

export default function ScenarioCard() {
  const { data, updateSavings, setScenario } = useFinance()
  if (!data) return null

  const { savings } = data
  const scenario = SCENARIOS[savings.scenario]
  const pillowPct = Math.min(100, Math.round((savings.pillow / savings.targetPillow) * 100))
  const monthsLeft = pillowMonthsLeft(savings.pillow, savings.targetPillow, scenario.savingsPerMonth)
  const pillowDone = savings.pillow >= savings.targetPillow

  function handlePillowEdit() {
    const val = window.prompt('Current emergency fund (PLN):', String(savings.pillow))
    if (val === null) return
    const n = parseFloat(val.replace(/[, ]/g, ''))
    if (!isNaN(n) && n >= 0) updateSavings({ pillow: n })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-4">Savings & Scenario</p>

      {/* Pillow */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-white text-sm font-medium">Emergency fund</span>
          <button onClick={handlePillowEdit} className="text-emerald-400 text-sm font-semibold hover:text-emerald-300 transition-colors">
            {formatPLN(savings.pillow)} PLN
          </button>
        </div>
        <div className="h-2.5 bg-white/8 rounded-full overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full transition-all ${pillowDone ? 'bg-emerald-400' : 'bg-emerald-600'}`}
            style={{ width: `${pillowPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>Target: {formatPLN(savings.targetPillow)} PLN</span>
          <span>{pillowDone ? '✓ Done' : `~${monthsLeft} months left`}</span>
        </div>
      </div>

      {/* Scenario picker */}
      <div className="mb-4">
        <p className="text-slate-500 text-xs mb-2">Repayment scenario</p>
        <div className="flex gap-2">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => setScenario(n)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors border ${
                savings.scenario === n
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/8'
              }`}
            >
              {SCENARIOS[n].label}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario details */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-slate-500 text-xs mb-0.5">Fun budget</p>
          <p className="text-white text-sm font-semibold">{formatPLN(scenario.funPerMonth)} PLN/mo</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-slate-500 text-xs mb-0.5">Cash loan free</p>
          <p className="text-white text-sm font-semibold">{formatDate(scenario.loanPayoffDate)}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 col-span-2">
          <p className="text-slate-500 text-xs mb-0.5">Interest saved vs no overpayments</p>
          <p className="text-emerald-400 text-sm font-semibold">~{formatPLN(scenario.interestSaved)} PLN</p>
        </div>
      </div>
    </div>
  )
}
