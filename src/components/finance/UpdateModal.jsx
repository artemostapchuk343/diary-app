import { useState } from 'react'
import { X, ClipboardPaste, CheckCircle } from 'lucide-react'
import { useFinance } from '../../useFinance'

const EXAMPLE = `{
  "month": "2026-06",
  "income": 11700,
  "freelance": 0,
  "balances": { "mbank": 5000, "millennium": 3000 },
  "spending": {
    "groceries": 650,
    "dining": 200,
    "bars": 280,
    "transport": 420,
    "health": 150,
    "clothing": 0,
    "shopping": 350,
    "entertainment": 80,
    "cash": 500
  },
  "transactions": {
    "groceries": [
      { "name": "Biedronka", "amount": 280, "date": "06-03" },
      { "name": "Lidl", "amount": 210, "date": "06-10" },
      { "name": "Żabka", "amount": 160, "date": "06-15" }
    ]
  },
  "mortgage": { "remainingBalance": 459000, "installmentsPaid": 27 },
  "cashLoan":  { "remainingBalance": 139000, "installmentsPaid": 10 }
}`

export default function UpdateModal({ onClose }) {
  const { importMonth } = useFinance()
  const [text, setText] = useState('')
  const [status, setStatus] = useState(null) // null | 'ok' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  async function handleImport() {
    try {
      const json = JSON.parse(text.trim())
      const { month, spending, income, freelance, mortgage, cashLoan, savings } = json
      if (!month || !spending) throw new Error('Missing "month" or "spending" fields')
      await importMonth(month, { spending, income, freelance, mortgage, cashLoan, savings })
      setStatus('ok')
      setTimeout(onClose, 1200)
    } catch (e) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/60">
      <div className="bg-[#141d15] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <p className="text-white font-semibold">Import monthly data</p>
            <p className="text-slate-500 text-xs mt-0.5">Paste the JSON Claude generates from your bank statements</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Instructions */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-slate-400 text-xs mb-2">Tell Claude:</p>
          <div className="bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-xs text-slate-300 font-mono leading-relaxed">
            "Update my finance dashboard for [month]. Here are my bank statements: [paste PDF text / transactions]. Return JSON in this format:"
          </div>
          <details className="mt-2">
            <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400">Show expected JSON format</summary>
            <pre className="mt-2 bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-xs text-slate-400 font-mono overflow-x-auto">{EXAMPLE}</pre>
          </details>
        </div>

        {/* Paste area */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setStatus(null) }}
            placeholder="Paste JSON here…"
            className="w-full h-40 bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 outline-none focus:border-emerald-600 resize-none"
          />
          {status === 'error' && (
            <p className="text-red-400 text-xs mt-2">{errorMsg}</p>
          )}
          {status === 'ok' && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm mt-2">
              <CheckCircle size={15} /> Imported successfully
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-xl py-3 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!text.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl py-3 transition-colors flex items-center justify-center gap-2"
          >
            <ClipboardPaste size={15} /> Import
          </button>
        </div>
      </div>
    </div>
  )
}
