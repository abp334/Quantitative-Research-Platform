import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { api } from '../api/client'
import type { OhlcvBar, Stock } from '../types'
import { ComprehensiveTechnicalChart, IndicatorLineChart, RsiChart } from '../components/charts'
import { Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'

function indicators(bars: OhlcvBar[]) {
  const closes = bars.map((b) => b.close)
  return bars.map((b, i) => {
    const avg = (n: number) => i < n - 1 ? null : closes.slice(i - n + 1, i + 1).reduce((a, x) => a + x, 0) / n
    let rsi: number | null = null
    if (i >= 14) {
      const diffs = closes.slice(i - 14, i + 1).slice(1).map((v, j) => v - closes[i - 14 + j])
      const gains = diffs.reduce((a, x) => a + Math.max(x, 0), 0) / 14
      const losses = diffs.reduce((a, x) => a + Math.max(-x, 0), 0) / 14
      rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses)
    }
    return { date: b.date.slice(0, 10), close: b.close, sma20: avg(20), sma50: avg(50), rsi }
  })
}

export function DataExplorerPage() {
  const [params, setParams] = useSearchParams()
  const [symbol, setSymbol] = useState(params.get('symbol') || 'RELIANCE')
  const [range, setRange] = useState([90, 252, 504, 1000].includes(Number(params.get('range'))) ? Number(params.get('range')) : 252)
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const ohlcv = useQuery({ queryKey: ['ohlcv', symbol], queryFn: () => api.ohlcv(symbol, { limit: 1000 }) as Promise<OhlcvBar[]> })
  const bars = useMemo(() => (ohlcv.data ?? []).slice(-range), [ohlcv.data, range])
  const rows = useMemo(() => indicators(bars), [bars])

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div className="page-tag"><BarChart3 style={{ width: 12, height: 12 }} /> Technical Workstation</div>
        <h1>Multi-Pane Technical Indicator Analysis</h1>
        <p className="page-desc">Comprehensive price, volume, moving average, Bollinger Band, RSI, and MACD technical workstation for NIFTY equities.</p>
      </div>

      <div className="p-3 rounded bg-[#111520] border border-[#1e2536]">
        <div className="flex flex-wrap gap-3">
          <label style={{ flex: 1, minWidth: 240 }}>
            <span className="form-label">Equity Symbol</span>
            <select className="form-select" value={symbol} onChange={(e) => { setSymbol(e.target.value); setParams({ symbol: e.target.value, range: String(range) }, { replace: true }) }}>
              {(stocks.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}{s.company_name ? ` — ${s.company_name}` : ''}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">Lookback History</span>
            <select className="form-select" style={{ minWidth: 140 }} value={range} onChange={(e) => { setRange(Number(e.target.value)); setParams({ symbol, range: e.target.value }, { replace: true }) }}>
              <option value={90}>3 Months</option>
              <option value={252}>1 Year</option>
              <option value={504}>2 Years</option>
              <option value={1000}>All Available</option>
            </select>
          </label>
        </div>
      </div>

      {ohlcv.isLoading && <PageSkeleton />}
      {ohlcv.error && <ErrorBox message={(ohlcv.error as Error).message} />}

      {bars.length > 0 && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>{symbol} Multi-Pane Technical Workstation</h2>
              <span className="mono text-xs text-slate-400">{bars[0].date.slice(0, 10)} to {bars[bars.length - 1]?.date.slice(0, 10)}</span>
            </div>
            <div className="p-3">
              <ComprehensiveTechnicalChart data={bars} />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Trend Moving Averages" subtitle="Close price relative to 20 & 50 period simple moving averages">
              <IndicatorLineChart data={rows} lines={[{ key: 'close', color: '#e2e8f0', name: 'Close Price' }, { key: 'sma20', color: '#3b82f6', name: 'SMA 20' }, { key: 'sma50', color: '#10b981', name: 'SMA 50' }]} />
            </Card>
            <Card title="Relative Strength Index (RSI)" subtitle="14-period momentum indicator with 70/30 threshold bands">
              <RsiChart data={rows.map((r) => ({ date: r.date, rsi: r.rsi }))} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
