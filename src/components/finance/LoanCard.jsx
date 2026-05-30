import { AlertTriangle, Info } from 'lucide-react'

function formatPLN(n) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' PLN'
}

function formatDate(yyyyMM) {
  const [y, m] = yyyyMM.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

export default function LoanCard({ loan, type }) {
  const isMortgage = type === 'mortgage'
  const pct = Math.round((loan.installmentsPaid / loan.totalInstallments) * 100)
  const remaining = loan.totalInstallments - loan.installmentsPaid
  const totalBalance = isMortgage ? 461365.64 : 150000

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-0.5">
            {isMortgage ? 'Mortgage · BK2%' : 'Cash Loan · Renovation'}
          </p>
          <p className="text-white text-2xl font-semibold">
            {formatPLN(loan.remainingBalance)}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">remaining balance</p>
        </div>
        <div className="text-right">
          <p className="text-emerald-400 text-lg font-semibold">
            {formatPLN(loan.monthlyPayment)}
          </p>
          <p className="text-slate-500 text-xs">/month</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{loan.installmentsPaid} of {loan.totalInstallments} paid</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-slate-600 text-xs mt-1">{remaining} installments left · ends {formatDate(loan.payoffDate)}</p>
      </div>

      {/* Key info */}
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="text-xs bg-white/5 border border-white/8 rounded-lg px-2.5 py-1 text-slate-300">
          {loan.interestRate}% {isMortgage ? 'fixed' : 'variable'}
        </span>
        {isMortgage && (
          <span className="text-xs bg-white/5 border border-white/8 rounded-lg px-2.5 py-1 text-slate-300">
            +{formatPLN(loan.subsidyAmount)} subsidy/mo
          </span>
        )}
      </div>

      {/* Warnings */}
      {isMortgage && (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/15 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Subsidy ends {formatDate(loan.subsidyEnds)} · rate resets {formatDate(loan.rateResetDate)}</span>
        </div>
      )}
      {!isMortgage && (
        <div className="mt-3 flex items-start gap-2 text-xs text-blue-400/80 bg-blue-400/5 border border-blue-400/15 rounded-xl px-3 py-2.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>Variable rate — every NBP 1% change ≈ ±125 PLN/month. Overpay here first.</span>
        </div>
      )}
    </div>
  )
}
