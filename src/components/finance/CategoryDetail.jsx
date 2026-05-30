import { X } from 'lucide-react'

export default function CategoryDetail({ category, catKey, spending, transactions, onClose }) {
  const total = spending?.[catKey] ?? 0
  const items = transactions?.[catKey]

  const sorted = items
    ? [...items].sort((a, b) => b.amount - a.amount)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#141d15] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[75vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: category.color }} />
            <div>
              <p className="text-white font-semibold">{category.label}</p>
              <p className="text-slate-500 text-xs">
                {total.toLocaleString('pl-PL')} PLN · budget {category.budget.toLocaleString('pl-PL')} PLN
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Budget bar */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${total > category.budget ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, (total / category.budget) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1.5">
            <span>{Math.round((total / category.budget) * 100)}% of budget</span>
            <span className={total > category.budget ? 'text-red-400' : 'text-emerald-400'}>
              {total > category.budget ? '+' : ''}{(total - category.budget).toLocaleString('pl-PL')} PLN
            </span>
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {!sorted ? (
            <div className="py-8 text-center">
              <p className="text-slate-500 text-sm">No transaction details yet</p>
              <p className="text-slate-600 text-xs mt-1">
                Include a <code className="text-slate-500">transactions</code> field in your monthly JSON import
              </p>
            </div>
          ) : (
            <div className="space-y-1 pt-2">
              {sorted.map((item, i) => {
                const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                    <span className="text-slate-600 text-xs w-5 text-right shrink-0">{i + 1}</span>
                    <span className="text-slate-300 text-sm flex-1 truncate">{item.name}</span>
                    {item.date && (
                      <span className="text-slate-600 text-xs shrink-0">{item.date}</span>
                    )}
                    <span className="text-white text-sm font-medium shrink-0">
                      {item.amount.toLocaleString('pl-PL')}
                    </span>
                    <span className="text-slate-600 text-xs w-9 text-right shrink-0">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
