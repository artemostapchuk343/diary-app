import { CATEGORIES } from '../../useFinance'

const W = 420
const H = 170
const PAD_T = 22  // space for amount label
const PAD_B = 24  // space for month label
const GAP = 6     // gap between bars
const CHART_H = H - PAD_T - PAD_B

function shortMonth(key) {
  const [y, m] = key.split('-').map(Number)
  const label = new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short' })
  return `${label} '${String(y).slice(2)}`
}

const CAT_ORDER = ['cash', 'shopping', 'clothing', 'health', 'transport', 'bars', 'dining', 'entertainment', 'groceries']

export default function MonthlyBarChart({ months, onSelectMonth, selectedMonth }) {
  const keys = Object.keys(months).sort()
  if (keys.length === 0) return null

  const totals = keys.map(k => {
    const sp = months[k]?.spending ?? {}
    const total = Object.values(sp).reduce((s, v) => s + v, 0)
    return { key: k, total, spending: sp }
  })

  const maxVal = Math.max(...totals.map(t => t.total), 3000)
  const n = totals.length
  const barW = Math.floor((W - (n - 1) * GAP) / n)

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 pt-4 pb-2 mb-5">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">Monthly spending</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {/* Budget reference line at 2930 */}
        {(() => {
          const refY = PAD_T + CHART_H - (2930 / maxVal) * CHART_H
          return (
            <g>
              <line x1={0} y1={refY} x2={W} y2={refY} stroke="#334155" strokeWidth={1} strokeDasharray="4 3" />
              <text x={W - 2} y={refY - 3} textAnchor="end" fill="#334155" fontSize={8}>budget</text>
            </g>
          )
        })()}

        {totals.map(({ key, total, spending }, i) => {
          const x = i * (barW + GAP)
          const barH = Math.round((total / maxVal) * CHART_H)
          const barY = PAD_T + CHART_H - barH
          const isSelected = key === selectedMonth
          let segY = PAD_T + CHART_H

          return (
            <g
              key={key}
              onClick={() => onSelectMonth?.(key)}
              style={{ cursor: 'pointer' }}
            >
              {/* Selection highlight */}
              {isSelected && (
                <rect
                  x={x - 3} y={PAD_T - 4}
                  width={barW + 6} height={CHART_H + 8}
                  rx={4} fill="white" opacity={0.05}
                />
              )}

              {/* Stacked segments, bottom → top */}
              {CAT_ORDER.map(cat => {
                const val = spending[cat] ?? 0
                if (val === 0) return null
                const sh = Math.round((val / maxVal) * CHART_H)
                segY -= sh
                const color = CATEGORIES[cat]?.color ?? '#94a3b8'
                return (
                  <rect
                    key={cat}
                    x={x} y={segY}
                    width={barW} height={sh}
                    fill={color}
                    opacity={isSelected ? 1 : 0.75}
                    rx={cat === CAT_ORDER[CAT_ORDER.length - 1] || segY === barY ? 2 : 0}
                  />
                )
              })}

              {/* Rounded top cap */}
              <rect x={x} y={barY} width={barW} height={4} rx={2}
                fill={spending[CAT_ORDER.find(c => (spending[c] ?? 0) > 0)] ?? '#94a3b8'}
                opacity={0}
              />

              {/* Amount label */}
              <text
                x={x + barW / 2} y={barY - 4}
                textAnchor="middle"
                fill={isSelected ? '#e2e8f0' : '#64748b'}
                fontSize={9}
                fontWeight={isSelected ? 600 : 400}
              >
                {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
              </text>

              {/* Month label */}
              <text
                x={x + barW / 2} y={H - 4}
                textAnchor="middle"
                fill={isSelected ? '#a3e635' : '#475569'}
                fontSize={9}
                fontWeight={isSelected ? 600 : 400}
              >
                {shortMonth(key)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 pb-1">
        {CAT_ORDER.slice().reverse().map(cat => (
          <div key={cat} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORIES[cat]?.color }} />
            <span className="text-slate-600 text-xs">{CATEGORIES[cat]?.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
