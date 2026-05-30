import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Pencil } from 'lucide-react'

const COINS = [
  { id: 'bitcoin',  symbol: 'BTC', label: '₿', color: '#f7931a' },
  { id: 'ethereum', symbol: 'ETH', label: 'Ξ', color: '#627eea' },
  { id: 'solana',   symbol: 'SOL', label: '◎', color: '#9945ff' },
]

const CACHE_MS = 5 * 60 * 1000
let _cache = null
let _cacheAt = 0

async function fetchPrices() {
  if (_cache && Date.now() - _cacheAt < CACHE_MS) return _cache
  const url = 'https://api.coingecko.com/api/v3/simple/price' +
    '?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true'
  const data = await fetch(url).then(r => r.json())
  _cache = data
  _cacheAt = Date.now()
  return data
}

function fmtPLN(n) {
  return n.toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' PLN'
}

function fmtUSD(n) {
  if (n >= 10000) return '$' + Math.round(n).toLocaleString('en-US')
  if (n >= 1000)  return '$' + n.toFixed(0)
  return '$' + n.toFixed(2)
}

export default function WealthPanel({ usdcBalance = 25000, balances, onEditBalances }) {
  const [prices, setPrices] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true); setError(false)
    try { setPrices(await fetchPrices()) }
    catch { setError(true) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const bankMbank      = balances?.mbank ?? null
  const bankMillennium = balances?.millennium ?? null
  const bankTotal      = (bankMbank ?? 0) + (bankMillennium ?? 0)
  const usdcInPln      = Math.round(usdcBalance * 4)

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Liquid assets</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { _cache = null; load() }}
            className="text-slate-600 hover:text-slate-400 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onEditBalances} className="text-slate-600 hover:text-slate-400 transition-colors">
            <Pencil size={13} />
          </button>
        </div>
      </div>

      {/* Bank + Crypto grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white/5 rounded-xl p-3.5">
          <p className="text-slate-500 text-xs mb-2">Bank accounts</p>
          <div className="space-y-1 mb-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">mBank</span>
              <span className="text-slate-400">{bankMbank != null ? fmtPLN(bankMbank) : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Millennium</span>
              <span className="text-slate-400">{bankMillennium != null ? fmtPLN(bankMillennium) : '—'}</span>
            </div>
          </div>
          <p className="text-white text-lg font-bold">{fmtPLN(bankTotal)}</p>
        </div>

        <div className="bg-white/5 rounded-xl p-3.5">
          <p className="text-slate-500 text-xs mb-2">Crypto position</p>
          <p className="text-white text-lg font-bold">
            {usdcBalance.toLocaleString('en-US')}
            <span className="text-slate-400 text-sm font-normal ml-1">USDC</span>
          </p>
          <p className="text-slate-500 text-xs mt-1">≈ {fmtPLN(usdcInPln)}</p>
          <p className="text-slate-700 text-xs mt-0.5">Waiting for market dip</p>
        </div>
      </div>

      {/* Divider + live prices */}
      <div className="border-t border-white/8 pt-4">
        <div className="space-y-3">
          {COINS.map(coin => {
            const p = prices?.[coin.id]
            const change = p?.usd_24h_change ?? 0
            const up = change >= 0
            return (
              <div key={coin.id} className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: coin.color + '22', color: coin.color }}
                >
                  {coin.label}
                </span>
                <span className="text-slate-400 text-sm font-medium w-9 shrink-0">{coin.symbol}</span>
                <span className="text-white text-sm font-semibold flex-1">
                  {loading ? <span className="text-slate-700">—</span>
                    : error ? <span className="text-slate-700">err</span>
                    : fmtUSD(p.usd)}
                </span>
                {!loading && !error && p && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                    {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {up ? '+' : ''}{change.toFixed(2)}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
