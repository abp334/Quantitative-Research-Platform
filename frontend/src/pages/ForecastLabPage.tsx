import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, CalendarClock, Download, FlaskConical, Gauge } from 'lucide-react'
import { api } from '../api/client'
import type { Forecast, Stock } from '../types'
import { IndicatorLineChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton, useToast } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'

const HORIZONS = [5, 10, 20] as const
const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const pct = (v: number, signed = false) => `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

function normalCdf(v: number) {
  const sign = v < 0 ? -1 : 1, x = Math.abs(v) / Math.sqrt(2)
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x))
  return 0.5 * (1 + sign * erf)
}

export function ForecastLabPage() {
  const [params, setParams] = useSearchParams()
  const [symbol, setSymbol] = useState(params.get('symbol') || 'RELIANCE')
  const [request, setRequest] = useState<string | null>(params.has('symbol') ? symbol : null)
  const [selectedHorizon, setSelectedHorizon] = useState(10)
  const [capital, setCapital] = useState(100_000)
  const [reqReturn, setReqReturn] = useState(0.03)
  const [maxLoss, setMaxLoss] = useState(0.06)
  const toast = useToast()

  const stocks = useQuery<Stock[]>({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const lab = useQuery<Forecast[]>({
    queryKey: ['forecast-lab', request],
    queryFn: async () => {
      const results: Forecast[] = []
      for (const h of HORIZONS) results.push(await api.forecast({ symbol: request!, horizon_days: h }) as Forecast)
      return results
    },
    enabled: !!request,
    staleTime: 5 * 60_000,
  })

  const forecasts = lab.data ?? []
  const selected = forecasts.find((f) => f.horizon_days === selectedHorizon) ?? forecasts[0]
  const selectedStock = (stocks.data ?? []).find((s) => s.symbol === (request || symbol))

  const analysis = useMemo(() => {
    if (!selected) return null
    const bear = selected.scenarios.bear.return, bull = selected.scenarios.bull.return
    const sigma = Math.max(Math.abs(bull - bear) / (2 * 1.2816), selected.validation.rmse_percent / 100, 0.002)
    const goalChance = 1 - normalCdf((reqReturn - selected.expected_return) / sigma)
    const lossChance = normalCdf((-maxLoss - selected.expected_return) / sigma)
    const rr = Math.max(bull, 0) / Math.max(Math.abs(Math.min(bear, 0)), 0.0001)
    return { bear, bull, sigma, goalChance, lossChance, rr, expectedPnl: capital * selected.expected_return, bearPnl: capital * bear, bullPnl: capital * bull, positionAtRisk: capital * Math.max(Math.abs(Math.min(bear, 0)), 0.0001), signalQuality: selected.validation.direction_accuracy * 0.45 + selected.validation.interval_coverage * 0.25 + selected.confidence * 0.3 }
  }, [capital, maxLoss, reqReturn, selected])

  const runLab = () => { setRequest(symbol); setParams({ symbol }, { replace: true }) }

  const exportBrief = () => {
    if (!selected || !analysis) return
    const url = URL.createObjectURL(new Blob([JSON.stringify({ symbol: selected.symbol, horizon: selected.horizon_days, forecast: selected, analysis, capital, reqReturn, maxLoss, disclaimer: 'Historical research. Not investment advice.' }, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `${selected.symbol.toLowerCase()}-brief.json`; a.click(); URL.revokeObjectURL(url)
    toast.push('Brief exported')
  }

  const horizonRows = forecasts.map((f) => ({ date: `${f.horizon_days}d`, expected: f.expected_return * 100, lower: f.scenarios.bear.return * 100, upper: f.scenarios.bull.return * 100 }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-tag"><FlaskConical style={{ width: 14, height: 14 }} /> Forecast Lab</div>
          <h1>Multi-Horizon Analysis</h1>
          <p className="page-desc">Run all three horizons, translate ranges into capital outcomes, and stress-test your thresholds.</p>
        </div>
        {selectedStock && <WatchlistButton stock={selectedStock} />}
      </div>

      <Card>
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <label>
            <span className="form-label">Stock</span>
            <select className="form-select" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {(stocks.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}{s.company_name ? ` — ${s.company_name}` : ''}</option>)}
            </select>
          </label>
          <Button onClick={runLab} disabled={lab.isFetching}>{lab.isFetching ? 'Running…' : 'Run All Horizons'}</Button>
        </div>
      </Card>

      {!request && (
        <div className="empty-state">
          <div className="empty-state-icon"><FlaskConical style={{ width: 24, height: 24 }} /></div>
          <h2>One stock, three horizons</h2>
          <p>The lab builds independent 5, 10, and 20-session estimates so you can see how the signal evolves over time.</p>
        </div>
      )}

      {lab.isFetching && forecasts.length === 0 && <PageSkeleton />}
      {lab.error && <ErrorBox message={(lab.error as Error).message} />}

      {forecasts.length > 0 && selected && analysis && (
        <>
          <div className="data-notice">
            <CalendarClock style={{ width: 18, height: 18 }} />
            <div><strong>Historical scenario lab</strong> <span className="data-notice-text">Capital figures are illustrations, not trade estimates.</span></div>
          </div>

          <div className="horizon-grid">
            {forecasts.map((f) => {
              const active = f.horizon_days === selected.horizon_days
              const up = f.expected_return >= 0
              return (
                <button type="button" key={f.horizon_days} className={`horizon-card ${active ? 'active' : ''}`} onClick={() => setSelectedHorizon(f.horizon_days)}>
                  <div className="horizon-label">{f.horizon_days} sessions</div>
                  <div className={`horizon-return ${up ? 'text-green' : 'text-red'}`}>
                    {up ? <ArrowUpRight style={{ width: 18, height: 18 }} /> : <ArrowDownRight style={{ width: 18, height: 18 }} />}
                    {pct(f.expected_return, true)}
                  </div>
                  <div className="horizon-detail">P(up) {pct(f.probability_up)} · acc {pct(f.validation.direction_accuracy)}</div>
                  <div className="horizon-bar"><div className="horizon-bar-fill" style={{ width: `${f.probability_up * 100}%` }} /></div>
                </button>
              )
            })}
          </div>

          <div className="grid xl:grid-cols-[.82fr_1.18fr] gap-4">
            <Card title="Capital Assumptions" subtitle="Adjust values — analysis updates instantly">
              <div className="lab-controls">
                <label>
                  <span>Capital <strong>{money(capital)}</strong></span>
                  <input type="range" min={10_000} max={2_000_000} step={10_000} value={capital} onChange={(e) => setCapital(Number(e.target.value))} />
                </label>
                <label>
                  <span>Required return <strong>{pct(reqReturn)}</strong></span>
                  <input type="range" min={-0.05} max={0.15} step={0.005} value={reqReturn} onChange={(e) => setReqReturn(Number(e.target.value))} />
                </label>
                <label>
                  <span>Max loss <strong>{pct(maxLoss)}</strong></span>
                  <input type="range" min={0.01} max={0.2} step={0.005} value={maxLoss} onChange={(e) => setMaxLoss(Number(e.target.value))} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3" style={{ marginTop: 16 }}>
                <div className="watch-metric">
                  <span>Chance of target</span>
                  <strong className="text-green">{pct(analysis.goalChance)}</strong>
                </div>
                <div className="watch-metric">
                  <span>Chance of loss breach</span>
                  <strong className="text-red">{pct(analysis.lossChance)}</strong>
                </div>
              </div>
            </Card>

            <Card title={`${selected.horizon_days}-Session Capital Map`} subtitle={`Applied to ${money(capital)} at ${money(selected.current_price)}`} action={<Badge tone={selected.expected_return >= 0 ? 'up' : 'down'}>{selected.bias}</Badge>}>
              <div className="capital-map">
                <div className="capital-outcome capital-bear"><span>Bear</span><strong>{money(capital + analysis.bearPnl)}</strong><em>{money(analysis.bearPnl)}</em></div>
                <div className="capital-outcome capital-base"><span>Base</span><strong>{money(capital + analysis.expectedPnl)}</strong><em>{money(analysis.expectedPnl)}</em></div>
                <div className="capital-outcome capital-bull"><span>Bull</span><strong>{money(capital + analysis.bullPnl)}</strong><em>{money(analysis.bullPnl)}</em></div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3" style={{ marginTop: 12 }}>
                <div className="watch-metric"><span>At Risk</span><strong>{money(analysis.positionAtRisk)}</strong></div>
                <div className="watch-metric"><span>Reward/Risk</span><strong>{analysis.rr.toFixed(2)}×</strong></div>
                <div className="watch-metric"><span>Signal Quality</span><strong>{pct(analysis.signalQuality)}</strong></div>
              </div>
              <div className="flex items-start gap-2" style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                <Gauge style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--blue)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>
                  {analysis.goalChance >= 0.6 && analysis.lossChance <= 0.25 ? 'Assumptions fit comfortably inside the forecast distribution.' : analysis.lossChance > 0.4 ? 'Loss threshold is frequently breached. The setup looks fragile.' : 'Balanced but no decisive margin over your target.'}
                </p>
              </div>
            </Card>
          </div>

          <Card title="Forecast Term Structure" subtitle="Expected and boundary returns across horizons">
            <IndicatorLineChart data={horizonRows} lines={[{ key: 'expected', color: '#22c55e', name: 'Expected %' }, { key: 'lower', color: '#ef4444', name: 'Lower %' }, { key: 'upper', color: '#3b82f6', name: 'Upper %' }]} />
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportBrief}><Download style={{ width: 14, height: 14 }} /> Export Brief</Button>
            <Link to={`/app/track-record?symbol=${selected.symbol}&horizon=${selected.horizon_days}`} className="btn btn-primary">
              Track Record <ArrowUpRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
