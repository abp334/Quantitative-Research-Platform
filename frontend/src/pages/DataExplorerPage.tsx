import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { OhlcvBar, Stock } from '../types'
import { CandlestickChart, IndicatorLineChart, PriceVolumeChart, RsiChart } from '../components/charts'
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
  const [symbol, setSymbol] = useState('RELIANCE')
  const [range, setRange] = useState(252)
  const stocks = useQuery({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const ohlcv = useQuery({ queryKey: ['ohlcv', symbol], queryFn: () => api.ohlcv(symbol, { limit: 1000 }) as Promise<OhlcvBar[]> })
  const bars = useMemo(() => (ohlcv.data ?? []).slice(-range), [ohlcv.data, range])
  const rows = useMemo(() => indicators(bars), [bars])

  return <div className="space-y-6">
    <div><p className="eyebrow w-fit">Market charts</p><h1 className="display text-3xl md:text-4xl font-bold mt-4">Explore price behaviour</h1><p className="text-[var(--color-muted)] mt-2">Review historical price, trading activity and momentum for any available stock.</p></div>
    <Card>
      <div className="flex flex-wrap gap-3">
        <label className="flex-1 min-w-64"><span className="text-xs text-[var(--color-muted)] block mb-2">Stock</span><select className="market-input w-full" value={symbol} onChange={(e) => setSymbol(e.target.value)}>{(stocks.data ?? []).map(s => <option key={s.symbol} value={s.symbol}>{s.symbol}{s.company_name ? ` — ${s.company_name}` : ''}</option>)}</select></label>
        <label><span className="text-xs text-[var(--color-muted)] block mb-2">Range</span><select className="market-input" value={range} onChange={(e) => setRange(Number(e.target.value))}><option value={90}>3 months</option><option value={252}>1 year</option><option value={504}>2 years</option><option value={1000}>All available</option></select></label>
      </div>
    </Card>
    {ohlcv.isLoading && <PageSkeleton />}
    {ohlcv.error && <ErrorBox message={(ohlcv.error as Error).message} />}
    {bars.length > 0 && <>
      <Card title={`${symbol} price`} subtitle={`${bars[0].date} to ${bars[bars.length - 1]?.date}`}><CandlestickChart data={bars} /></Card>
      <Card title="Trading volume" subtitle="Daily market participation"><PriceVolumeChart data={bars} /></Card>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Trend" subtitle="Closing price with 20 and 50-session averages"><IndicatorLineChart data={rows} lines={[{key:'close',color:'#e8eef8',name:'Close'},{key:'sma20',color:'#3ddea8',name:'20-day average'},{key:'sma50',color:'#5b8cff',name:'50-day average'}]} /></Card>
        <Card title="Momentum" subtitle="RSI highlights unusually strong or weak movement"><RsiChart data={rows.map(r => ({date:r.date,rsi:r.rsi}))} /></Card>
      </div>
    </>}
  </div>
}
