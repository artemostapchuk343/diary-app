import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'

const COINS = [
  { id: 'bitcoin',  symbol: 'BTC', color: '#f7931a' },
  { id: 'ethereum', symbol: 'ETH', color: '#627eea' },
  { id: 'solana',   symbol: 'SOL', color: '#9945ff' },
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

function fmt(n) {
  if (n >= 10000) return '$' + Math.round(n).toLocaleString('en-US')
  if (n >= 1000)  return '$' + n.toFixed(0).toLocaleString('en-US')
  return '$' + n.toFixed(2)
}

export default function CryptoWidget({ usdcBalance = 25000 }) {
  const [prices, setPrices] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchPrices()
      setPrices(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Crypto</p>
        <button onClick={() => { _cache = null; load() }} className="text-slate-600 hover:text-slate-400 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Live prices */}
      <div className="space-y-2.5 mb-4">
        {COINS.map(coin => {
          const p = prices?.[coin.id]
          const change = p?.usd_24h_change ?? 0
          const up = change >= 0
          return (
            <div key={coin.id} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: coin.color + '22', color: coin.color }}>
                {coin.symbol[0]}
              </span>
              <span className="text-slate-300 text-sm font-medium w-10">{coin.symbol}</span>
              <span className="text-white text-sm font-semibold flex-1">
                {loading ? <span className="text-slate-600">—</span> : error ? <span className="text-slate-600">err</span> : fmt(p.usd)}
              </span>
              {!loading && !error && p && (
                <div className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {up ? '+' : ''}{change.toFixed(2)}%
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Position */}
      <div className="border-t border-white/8 pt-3 flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs">My position</p>
          <p className="text-white text-sm font-semibold mt-0.5">
            {usdcBalance.toLocaleString('en-US')} <span className="text-slate-400 font-normal">USDC</span>
          </p>
          <p className="text-slate-600 text-xs">Waiting for dip to deploy</p>
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-xs">≈ PLN</p>
          <p className="text-slate-300 text-sm font-medium">~{Math.round(usdcBalance * 4).toLocaleString('pl-PL')}</p>
          <p className="text-slate-600 text-xs">at 4.00 PLN/USD</p>
        </div>
      </div>
    </div>
  )
}
