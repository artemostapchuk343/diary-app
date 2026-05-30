import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Upload, RefreshCw } from 'lucide-react'
import { useFinance, CATEGORIES, computeFixedTotal, computeBuffer, computeSpendingTotal } from '../useFinance'
import LoanCard from '../components/finance/LoanCard'
import DonutChart from '../components/finance/DonutChart'
import ScenarioCard from '../components/finance/ScenarioCard'
import MilestoneTimeline from '../components/finance/MilestoneTimeline'
import UpdateModal from '../components/finance/UpdateModal'

function formatPLN(n, decimals = 0) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' PLN'
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function prevMonth(key) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(key) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function Finance() {
  const { data, loaded, load } = useFinance()
  const [month, setMonth] = useState(currentMonthKey())
  const [showUpdate, setShowUpdate] = useState(false)

  useEffect(() => { if (!loaded) load() }, [loaded])

  if (!loaded || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  const fixedTotal = computeFixedTotal(data.fixedCosts)
  const buffer = computeBuffer(data.income, data.fixedCosts)
  const monthData = data.months?.[month]
  const spending = monthData?.spending ?? {}
  const spentTotal = computeSpendingTotal(spending)
  const stale = daysSince(data.lastUpdated) > 25

  const donutSegments = Object.entries(CATEGORIES)
    .map(([key, cat]) => ({ color: cat.color, value: spending[key] ?? 0, label: cat.label }))
    .filter(s => s.value > 0)

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 md:px-8" style={{ zIndex: 1 }}>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-white text-2xl font-bold">Finance</h1>
          <div className="flex items-center gap-2">
            {data.lastUpdated && (
              <span className="text-slate-600 text-xs">Updated {data.lastUpdated}</span>
            )}
            <button
              onClick={() => setShowUpdate(true)}
              className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
            >
              <Upload size={14} />
              Update
            </button>
          </div>
        </div>

        {/* Stale data reminder */}
        {stale && (
          <div className="mb-5 flex items-center gap-3 bg-amber-400/8 border border-amber-400/20 rounded-2xl px-4 py-3">
            <RefreshCw size={16} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-amber-300 text-sm font-medium">Time to update your statements</p>
              <p className="text-amber-400/70 text-xs">Last updated {daysSince(data.lastUpdated)} days ago</p>
            </div>
            <button onClick={() => setShowUpdate(true)} className="ml-auto text-amber-400 text-xs font-medium hover:text-amber-300">
              Update →
            </button>
          </div>
        )}

        {/* Overview strip */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
            <p className="text-slate-500 text-xs mb-1">Salary</p>
            <p className="text-white text-base font-semibold">
              {(data.income.monthlySalary / 1000).toFixed(1)}k
            </p>
            <p className="text-slate-600 text-xs">PLN</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
            <p className="text-slate-500 text-xs mb-1">Fixed</p>
            <p className="text-white text-base font-semibold">
              {(fixedTotal / 1000).toFixed(1)}k
            </p>
            <p className="text-slate-600 text-xs">PLN</p>
          </div>
          <div className="bg-white/5 border border-emerald-800/30 bg-emerald-950/20 rounded-xl px-3 py-3 text-center">
            <p className="text-slate-500 text-xs mb-1">Buffer</p>
            <p className="text-emerald-400 text-base font-semibold">
              {(buffer / 1000).toFixed(1)}k
            </p>
            <p className="text-slate-600 text-xs">PLN</p>
          </div>
        </div>

        {/* Loans */}
        <div className="space-y-3 mb-5">
          <LoanCard loan={data.mortgage} type="mortgage" />
          <LoanCard loan={data.cashLoan} type="cashLoan" />
        </div>

        {/* Expense wheel */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          {/* Month selector */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Spending</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth(prevMonth(month))} className="text-slate-500 hover:text-slate-300 p-1">
                <ChevronLeft size={16} />
              </button>
              <span className="text-white text-sm font-medium min-w-28 text-center">{monthLabel(month)}</span>
              <button
                onClick={() => setMonth(nextMonth(month))}
                disabled={month >= currentMonthKey()}
                className="text-slate-500 hover:text-slate-300 p-1 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {!monthData ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">No data for this month</p>
              <button onClick={() => setShowUpdate(true)} className="mt-2 text-emerald-400 text-sm hover:text-emerald-300">
                Import statements →
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0">
                <DonutChart
                  segments={donutSegments}
                  centerLabel={formatPLN(spentTotal)}
                  centerSub="spent"
                />
              </div>
              <div className="flex-1 w-full space-y-2">
                {Object.entries(CATEGORIES).map(([key, cat]) => {
                  const val = spending[key] ?? 0
                  const pct = spentTotal > 0 ? Math.round((val / spentTotal) * 100) : 0
                  const overBudget = val > cat.budget
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-slate-400 text-xs flex-1 truncate">{cat.label}</span>
                      <span className={`text-xs font-medium ${overBudget ? 'text-red-400' : 'text-slate-300'}`}>
                        {val.toLocaleString('pl-PL')}
                      </span>
                      <span className="text-slate-600 text-xs w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-white/8 flex justify-between items-center">
                  <span className="text-slate-500 text-xs">vs budget</span>
                  <span className={`text-xs font-semibold ${spentTotal > 2930 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {spentTotal > 2930 ? '+' : ''}{(spentTotal - 2930).toLocaleString('pl-PL')} PLN
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scenario card */}
        <div className="mb-5">
          <ScenarioCard />
        </div>

        {/* Timeline */}
        <MilestoneTimeline />

      </div>

      {showUpdate && <UpdateModal onClose={() => setShowUpdate(false)} />}
    </div>
  )
}
