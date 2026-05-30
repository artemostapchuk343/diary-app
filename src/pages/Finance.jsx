import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Upload, RefreshCw } from 'lucide-react'
import { useFinance, CATEGORIES, computeFixedTotal, computeBuffer, computeSpendingTotal } from '../useFinance'
import WealthPanel from '../components/finance/WealthPanel'
import MonthlyBarChart from '../components/finance/MonthlyBarChart'
import LoanCard from '../components/finance/LoanCard'
import DonutChart from '../components/finance/DonutChart'
import ScenarioCard from '../components/finance/ScenarioCard'
import MilestoneTimeline from '../components/finance/MilestoneTimeline'
import UpdateModal from '../components/finance/UpdateModal'
import CategoryDetail from '../components/finance/CategoryDetail'

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

function latestBalances(months) {
  const keys = Object.keys(months).sort().reverse()
  for (const k of keys) {
    if (months[k]?.balances) return months[k].balances
  }
  return null
}

export default function Finance() {
  const { data, loaded, load, importMonth } = useFinance()
  const [month, setMonth] = useState(currentMonthKey())
  const [showUpdate, setShowUpdate] = useState(false)
  const [selectedCat, setSelectedCat] = useState(null)

  useEffect(() => { if (!loaded) load() }, [loaded])

  // When Finance page first loads, default to most recent month with data
  useEffect(() => {
    if (!loaded || !data?.months) return
    const keys = Object.keys(data.months).sort()
    if (keys.length && !data.months[month]) {
      setMonth(keys[keys.length - 1])
    }
  }, [loaded])

  if (!loaded || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  const fixedTotal = computeFixedTotal(data.fixedCosts)
  const monthData = data.months?.[month]
  const spending = monthData?.spending ?? {}
  const transactions = monthData?.transactions ?? {}
  const spentTotal = computeSpendingTotal(spending)
  const stale = daysSince(data.lastUpdated) > 25
  const balances = latestBalances(data.months ?? {})

  const donutSegments = Object.entries(CATEGORIES)
    .map(([key, cat]) => ({ key, color: cat.color, value: spending[key] ?? 0, label: cat.label }))
    .filter(s => s.value > 0)

  async function handleBalanceEdit() {
    const mbank = window.prompt('mBank balance (PLN):', String(balances?.mbank ?? ''))
    if (mbank === null) return
    const millennium = window.prompt('Millennium balance (PLN):', String(balances?.millennium ?? ''))
    if (millennium === null) return
    const key = currentMonthKey()
    await importMonth(key, {
      balances: {
        mbank: parseFloat(mbank.replace(/[, ]/g, '')) || null,
        millennium: parseFloat(millennium.replace(/[, ]/g, '')) || 0,
      },
    })
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 md:px-8" style={{ zIndex: 1 }}>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-white text-2xl font-bold">Finance</h1>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 text-xs hidden sm:block">Updated {data.lastUpdated}</span>
            <button
              onClick={() => setShowUpdate(true)}
              className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-400 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
            >
              <Upload size={14} />
              Update
            </button>
          </div>
        </div>

        {/* Stale reminder */}
        {stale && (
          <div className="mb-5 flex items-center gap-3 bg-amber-400/8 border border-amber-400/20 rounded-2xl px-4 py-3">
            <RefreshCw size={16} className="text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 text-sm font-medium">Time to update your statements</p>
              <p className="text-amber-400/70 text-xs">Last updated {daysSince(data.lastUpdated)} days ago</p>
            </div>
            <button onClick={() => setShowUpdate(true)} className="text-amber-400 text-xs font-medium hover:text-amber-300 shrink-0">Update →</button>
          </div>
        )}

        {/* 1 — Wealth panel (bank + crypto + live prices) */}
        <WealthPanel
          usdcBalance={25000}
          balances={balances}
          onEditBalances={handleBalanceEdit}
        />

        {/* 2 — Monthly bar chart */}
        <MonthlyBarChart
          months={data.months ?? {}}
          selectedMonth={month}
          onSelectMonth={setMonth}
        />

        {/* 3 — Spending wheel */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Spending</p>
            <div className="flex items-center gap-1">
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
                  centerLabel={spentTotal >= 1000
                    ? `${(spentTotal / 1000).toFixed(1)}k`
                    : String(Math.round(spentTotal))}
                  centerSub="PLN spent"
                />
              </div>
              <div className="flex-1 w-full space-y-1">
                {Object.entries(CATEGORIES).map(([key, cat]) => {
                  const val = spending[key] ?? 0
                  const pct = spentTotal > 0 ? Math.round((val / spentTotal) * 100) : 0
                  const hasDetail = !!(transactions[key]?.length)
                  const overBudget = val > cat.budget
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCat(key)}
                      className="w-full flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-white/5 transition-colors text-left group"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-slate-400 text-xs flex-1 truncate group-hover:text-slate-300">
                        {cat.label}
                        {hasDetail && <span className="ml-1 text-slate-600">›</span>}
                      </span>
                      <span className={`text-xs font-medium ${overBudget ? 'text-red-400' : 'text-slate-300'}`}>
                        {val > 0 ? val.toLocaleString('pl-PL') : '—'}
                      </span>
                      <span className="text-slate-600 text-xs w-8 text-right">{pct > 0 ? `${pct}%` : ''}</span>
                    </button>
                  )
                })}
                <div className="pt-2 border-t border-white/8 flex justify-between items-center px-2">
                  <span className="text-slate-500 text-xs">vs budget (2,930)</span>
                  <span className={`text-xs font-semibold ${spentTotal > 2930 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {spentTotal > 2930 ? '+' : ''}{(spentTotal - 2930).toLocaleString('pl-PL')} PLN
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4 — Savings & scenario */}
        <div className="mb-5">
          <ScenarioCard />
        </div>

        {/* 5 — Cash loan */}
        <div className="mb-3">
          <LoanCard loan={data.cashLoan} type="cashLoan" />
        </div>

        {/* 6 — Mortgage */}
        <div className="mb-5">
          <LoanCard loan={data.mortgage} type="mortgage" />
        </div>

        {/* 7 — Milestones */}
        <MilestoneTimeline />

      </div>

      {showUpdate && <UpdateModal onClose={() => setShowUpdate(false)} />}

      {selectedCat && (
        <CategoryDetail
          catKey={selectedCat}
          category={CATEGORIES[selectedCat]}
          spending={spending}
          transactions={transactions}
          onClose={() => setSelectedCat(null)}
        />
      )}
    </div>
  )
}
