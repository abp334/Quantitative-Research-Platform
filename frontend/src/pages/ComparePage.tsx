import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, CalendarClock, GitCompareArrows, Plus, RotateCcw, X } from 'lucide-react'
import { api } from '../api/client'
import type { OhlcvBar, Stock } from '../types'
import { IndicatorLineChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']
const DEFAULT_SYMBOLS = ['RELIANCE', 'TCS', 'INFY']
const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const pct = (v: number, signed = false) => `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

type Metric = { symbol: string; startPrice: number; endPrice: number; return: number; volatility: number; maxDrawdown: number; bestDay: number; worstDay: number }

export function ComparePage() {
  const [params, setParams] = useSearchParams()
  const initial = (params.get('symbols')?.split(',') ?? DEFAULT_SYMBOLS).map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 4)
  const [selected, setSelected] = useState(initial.length >= 2 ? initial : DEFAULT_SYMBOLS)
  const [range, setRange] = useState([90, 252, 504, 1000].includes(Number(params.get('range'))) ? Number(params.get('range')) : 252)
  const [candidate, setCandidate] = useState('')

  const stocks = useQuery<Stock[]>({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const priceQueries = useQueries({ queries: selected.map((sym) => ({ queryKey: ['ohlcv', sym], queryFn: () => api.ohlcv(sym, { limit: 1000 }) as Promise<OhlcvBar[]>, staleTime: 5 * 60_000 })) })

  useEffect(() => { setParams({ symbols: selected.join(','), range: String(range) }, { replace: true }) }, [range, selected, setParams])

  const stockMap = useMemo(() => new Map((stocks.data ?? []).map((s) => [s.symbol, s])), [stocks.data])
  const available = (stocks.data ?? []).filter((s) => !selected.includes(s.symbol))
  const loading = priceQueries.some((q) => q.isLoading)

  const analysis = useMemo(() => {
    const datasets = priceQueries.map((q, i) => ({ symbol: selected[i], bars: ((q.data as OhlcvBar[] | undefined) ?? []).slice(-range) }))
    const metrics = datasets.map(({ symbol, bars }) => calcMetrics(symbol, bars)).filter((m): m is Metric => m !== null)

    const dates = [...new Set(datasets.flatMap(({ bars }) => bars.map((b) => b.date)))].sort()
    const normalizedRows: Array<Record<string, string | number | null>> = dates.map((d) => ({ date: d.slice(0, 10) }))
    datasets.forEach(({ symbol, bars }) => {
      if (!bars.length) return
      const base = bars[0].close
      const byDate = new Map(bars.map((b) => [b.date, b.close]))
      normalizedRows.forEach((row, i) => { row[symbol] = byDate.get(dates[i]) == null ? null : ((byDate.get(dates[i])! / base) * 100) })
    })

    const returnMaps = new Map<string, Map<string, number>>()
    datasets.forEach(({ symbol, bars }) => {
      const map = new Map<string, number>()
      for (let i = 1; i < bars.length; i++) map.set(bars[i].date, bars[i].close / bars[i - 1].close - 1)
      returnMaps.set(symbol, map)
    })
    const correlations = selected.map((l) => selected.map((r) => corr(returnMaps.get(l), returnMaps.get(r))))
    return { metrics, normalizedRows, correlations }
  }, [priceQueries, range, selected])

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-tag"><GitCompareArrows style={{ width: 14, height: 14 }} /> Compare</div>
          <h1>Side-by-Side Comparison</h1>
          <p className="page-desc">Normalize performance, compare risk and drawdown, and check correlation before opening forecasts.</p>
        </div>
        <Button variant="ghost" onClick={() => { setSelected(DEFAULT_SYMBOLS); setRange(252) }}>
          <RotateCcw style={{ width: 14, height: 14 }} /> Reset
        </Button>
      </div>

      <Card>
        <div className="grid lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <label>
            <span className="form-label">Add stock (max 4)</span>
            <select className="form-select" value={candidate} disabled={selected.length >= 4} onChange={(e) => setCandidate(e.target.value)}>
              <option value="">{selected.length >= 4 ? 'Limit reached' : 'Choose…'}</option>
              {available.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}{s.company_name ? ` — ${s.company_name}` : ''}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">Window</span>
            <select className="form-select" style={{ minWidth: 140 }} value={range} onChange={(e) => setRange(Number(e.target.value))}>
              <option value={90}>3 months</option>
              <option value={252}>1 year</option>
              <option value={504}>2 years</option>
              <option value={1000}>All</option>
            </select>
          </label>
          <Button onClick={() => { if (candidate) { setSelected((c) => [...c, candidate]); setCandidate('') } }} disabled={!candidate || selected.length >= 4}>
            <Plus style={{ width: 14, height: 14 }} /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
          {selected.map((sym, i) => (
            <span className="comparison-chip" key={sym}>
              <span className="chip-dot" style={{ background: COLORS[i] }} />
              {sym}
              <button onClick={() => selected.length > 2 && setSelected((c) => c.filter((s) => s !== sym))} disabled={selected.length <= 2} title={selected.length <= 2 ? 'Keep at least 2' : `Remove ${sym}`}>
                <X style={{ width: 12, height: 12 }} />
              </button>
            </span>
          ))}
        </div>
      </Card>

      {(stocks.isLoading || loading) && <PageSkeleton />}
      {stocks.error && <ErrorBox message={(stocks.error as Error).message} />}

      {!loading && analysis.metrics.length >= 2 && (
        <>
          <div className="data-notice">
            <CalendarClock style={{ width: 18, height: 18 }} />
            <div><strong>Historical comparison</strong> <span className="data-notice-text">Ends with the bundled archive.</span></div>
          </div>

          <Card title="Relative Performance" subtitle="Each stock rebased to 100 at the start" action={<Badge>Normalised</Badge>}>
            <IndicatorLineChart data={analysis.normalizedRows} lines={selected.map((sym, i) => ({ key: sym, color: COLORS[i], name: sym }))} />
          </Card>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {analysis.metrics.map((m, i) => {
              const stock = stockMap.get(m.symbol)
              const up = m.return >= 0
              return (
                <div className="comparison-card" key={m.symbol}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="chip-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i] }} />
                        <strong>{m.symbol}</strong>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{stock?.company_name || 'NIFTY equity'}</p>
                    </div>
                    <WatchlistButton stock={stock ?? { symbol: m.symbol }} compact />
                  </div>
                  <div className={`return-badge ${up ? 'up' : 'down'}`} style={{ fontSize: 20, marginTop: 10 }}>
                    {up ? <ArrowUpRight /> : <ArrowDownRight />} {pct(m.return, true)}
                  </div>
                  <div className="grid grid-cols-2 gap-2" style={{ marginTop: 12, fontSize: 12 }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Start</span><br /><strong className="mono">{money(m.startPrice)}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>End</span><br /><strong className="mono">{money(m.endPrice)}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Volatility</span><br /><strong className="mono">{pct(m.volatility)}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Max DD</span><br /><strong className="mono text-red">{pct(m.maxDrawdown)}</strong></div>
                  </div>
                  <Link to={`/app?symbol=${m.symbol}&horizon=10`} className="btn btn-ghost btn-sm" style={{ marginTop: 12, width: '100%' }}>
                    Open Forecast <ArrowUpRight style={{ width: 12, height: 12 }} />
                  </Link>
                </div>
              )
            })}
          </div>

          <Card title="Return Correlation" subtitle="Daily return correlation over the selected period">
            <div className="correlation-grid" style={{ gridTemplateColumns: `70px repeat(${selected.length}, minmax(50px, 1fr))` }}>
              <span />
              {selected.map((s) => <strong key={s}>{s}</strong>)}
              {selected.flatMap((l, r) => [
                <strong key={`${l}-l`}>{l}</strong>,
                ...selected.map((right, c) => {
                  const v = analysis.correlations[r][c]
                  return (
                    <span key={`${l}-${right}`} style={{ background: v >= 0 ? `rgba(34,197,94,${0.06 + Math.abs(v) * 0.3})` : `rgba(239,68,68,${0.06 + Math.abs(v) * 0.3})` }}>
                      {v.toFixed(2)}
                    </span>
                  )
                }),
              ])}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function calcMetrics(sym: string, bars: OhlcvBar[]): Metric | null {
  if (bars.length < 2) return null
  const returns = bars.slice(1).map((b, i) => b.close / bars[i].close - 1)
  const mean = returns.reduce((s, v) => s + v, 0) / returns.length
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(returns.length - 1, 1)
  let peak = bars[0].close, maxDD = 0
  bars.forEach((b) => { peak = Math.max(peak, b.close); maxDD = Math.min(maxDD, b.close / peak - 1) })
  return { symbol: sym, startPrice: bars[0].close, endPrice: bars[bars.length - 1].close, return: bars[bars.length - 1].close / bars[0].close - 1, volatility: Math.sqrt(variance * 252), maxDrawdown: maxDD, bestDay: Math.max(...returns), worstDay: Math.min(...returns) }
}

function corr(l?: Map<string, number>, r?: Map<string, number>) {
  if (!l || !r) return 0
  if (l === r) return 1
  const pairs = [...l.entries()].filter(([d]) => r.has(d)).map(([d, v]) => [v, r.get(d)!])
  if (pairs.length < 2) return 0
  const mL = pairs.reduce((s, p) => s + p[0], 0) / pairs.length
  const mR = pairs.reduce((s, p) => s + p[1], 0) / pairs.length
  let num = 0, dL = 0, dR = 0
  pairs.forEach(([a, b]) => { num += (a - mL) * (b - mR); dL += (a - mL) ** 2; dR += (b - mR) ** 2 })
  const den = Math.sqrt(dL * dR)
  return den ? num / den : 0
}
