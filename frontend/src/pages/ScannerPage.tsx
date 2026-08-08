import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, CalendarClock, Filter, Search, SlidersHorizontal } from 'lucide-react'
import { api } from '../api/client'
import type { ScannerItem } from '../types'
import { Badge, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'
import { TickerStrip } from '../components/TickerStrip'

type DirectionFilter = 'all' | 'bullish' | 'bearish'
type SortKey = 'score' | 'return' | 'probability' | 'risk'

const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const pct = (v: number, signed = false) => `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

export function ScannerPage() {
  const [params, setParams] = useSearchParams()
  const [horizon, setHorizon] = useState([5, 10, 20].includes(Number(params.get('horizon'))) ? Number(params.get('horizon')) : 5)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<DirectionFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('score')

  const scanner = useQuery<ScannerItem[]>({
    queryKey: ['market-scanner', horizon],
    queryFn: () => api.scanner(horizon) as Promise<ScannerItem[]>,
  })

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (scanner.data ?? [])
      .filter((item) => {
        const matchSearch = !term || item.symbol.toLowerCase().includes(term) || (item.company_name ?? '').toLowerCase().includes(term) || (item.industry ?? '').toLowerCase().includes(term)
        const matchDir = direction === 'all' || (direction === 'bullish' && item.expected_return >= 0) || (direction === 'bearish' && item.expected_return < 0)
        return matchSearch && matchDir
      })
      .sort((a, b) => {
        if (sortBy === 'return') return b.expected_return - a.expected_return
        if (sortBy === 'probability') return b.probability_up - a.probability_up
        if (sortBy === 'risk') return a.volatility - b.volatility
        return b.score - a.score
      })
  }, [direction, scanner.data, search, sortBy])

  const summary = useMemo(() => {
    const all = scanner.data ?? []
    const bullish = all.filter((i) => i.expected_return >= 0).length
    const avgProb = all.length ? all.reduce((s, i) => s + i.probability_up, 0) / all.length : 0
    const leader = all.reduce<ScannerItem | null>((best, i) => (!best || i.score > best.score ? i : best), null)
    return { bullish, avgProb, leader }
  }, [scanner.data])

  return (
    <div className="space-y-4">
      {scanner.data && <TickerStrip items={(scanner.data ?? []).slice(0, 12)} />}

      <div className="page-header">
        <div className="page-tag"><SlidersHorizontal style={{ width: 12, height: 12 }} /> Quantitative Screener</div>
        <h1>Equity Factor Screener & Ranking</h1>
        <p className="page-desc">Rank NIFTY equities by multi-horizon expected return, directional hit-rate, volatility, and multi-factor quant score.</p>
      </div>

      <div className="p-3 rounded bg-[#111520] border border-[#1e2536]">
        <div className="grid lg:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <label>
            <span className="form-label">Search Symbol or Industry</span>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: 9, width: 14, height: 14, color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter equities..." />
            </div>
          </label>
          <label>
            <span className="form-label">Horizon</span>
            <select className="form-select" style={{ minWidth: 130 }} value={horizon} onChange={(e) => { setHorizon(Number(e.target.value)); setParams({ horizon: e.target.value }, { replace: true }) }}>
              <option value={5}>5 sessions</option>
              <option value={10}>10 sessions</option>
              <option value={20}>20 sessions</option>
            </select>
          </label>
          <label>
            <span className="form-label">Direction Filter</span>
            <select className="form-select" style={{ minWidth: 130 }} value={direction} onChange={(e) => setDirection(e.target.value as DirectionFilter)}>
              <option value="all">All Trends</option>
              <option value="bullish">Positive Return</option>
              <option value="bearish">Negative Return</option>
            </select>
          </label>
          <label>
            <span className="form-label">Sort Metric</span>
            <select className="form-select" style={{ minWidth: 140 }} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
              <option value="score">Quant Score</option>
              <option value="return">Expected Return</option>
              <option value="probability">Upside Probability</option>
              <option value="risk">Lowest Volatility</option>
            </select>
          </label>
        </div>
      </div>

      {scanner.isLoading && <PageSkeleton />}
      {scanner.error && <ErrorBox message={(scanner.error as Error).message} />}

      {scanner.data && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="metric-tile">
              <span className="metric-label">Positive Outlook Equities</span>
              <span className="metric-value">{summary.bullish}<small style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}> / {scanner.data.length}</small></span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Average Upside Probability</span>
              <span className="metric-value">{pct(summary.avgProb)}</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Top Quant Score Asset</span>
              <span className="metric-value">{summary.leader ? `${summary.leader.symbol} · ${summary.leader.score.toFixed(1)}` : '—'}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Screener Results ({rows.length} Equities)</h2>
              <Badge tone="info">{horizon}D Horizon Model</Badge>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Symbol / Company</th>
                    <th className="text-right">Last Close</th>
                    <th className="text-right">Expected Return</th>
                    <th className="text-right">Prob Φ(z)</th>
                    <th className="text-right">Backtest Hit Rate</th>
                    <th className="text-right">Ann. Volatility</th>
                    <th className="text-right">Quant Score</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, i) => {
                    const up = item.expected_return >= 0
                    return (
                      <tr key={item.symbol}>
                        <td className="mono text-muted">{String(i + 1).padStart(2, '0')}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Badge tone={up ? 'up' : 'down'}>{item.symbol}</Badge>
                            <div>
                              <div style={{ fontWeight: 600 }}>{item.company_name || item.symbol}</div>
                              {item.industry && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.industry}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="text-right mono">{money(item.last_price)}</td>
                        <td className={`text-right mono ${up ? 'text-green' : 'text-red'}`} style={{ fontWeight: 700 }}>
                          <span className="inline-flex items-center gap-0.5">
                            {up ? <ArrowUpRight style={{ width: 14, height: 14 }} /> : <ArrowDownRight style={{ width: 14, height: 14 }} />}
                            {pct(item.expected_return, true)}
                          </span>
                        </td>
                        <td className="text-right mono">{pct(item.probability_up)}</td>
                        <td className="text-right mono">{pct(item.validation_accuracy)}</td>
                        <td className="text-right mono">{pct(item.volatility)}</td>
                        <td className="text-right mono" style={{ fontWeight: 700 }}>
                          {item.score.toFixed(1)}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <WatchlistButton stock={item} compact />
                            <Link to={`/app?symbol=${item.symbol}&horizon=${horizon}`} className="btn btn-ghost btn-sm">
                              Inspect →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
