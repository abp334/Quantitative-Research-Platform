import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, History, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { api } from '../api/client'
import type { Forecast, Stock } from '../types'
import { ValidationChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'

const pct = (v: number, signed = false) => `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

export function TrackRecordPage() {
  const [params] = useSearchParams()
  const [symbol, setSymbol] = useState(params.get('symbol') || 'RELIANCE')
  const requestedHorizon = Number(params.get('horizon'))
  const [horizon, setHorizon] = useState([5, 10, 20].includes(requestedHorizon) ? requestedHorizon : 5)

  const stocks = useQuery<Stock[]>({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })
  const forecast = useQuery<Forecast>({
    queryKey: ['forecast-validation', symbol, horizon],
    queryFn: () => api.forecast({ symbol, horizon_days: horizon }) as Promise<Forecast>,
    enabled: Boolean(symbol),
  })

  const validation = forecast.data?.validation
  const recent = useMemo(() => [...(validation?.recent ?? [])].reverse(), [validation?.recent])
  const correctRecent = validation?.recent.filter((row) => row.direction_correct).length ?? 0

  const assessment = useMemo(() => {
    if (!validation) return null
    if (validation.direction_accuracy >= 0.6) {
      return {
        tone: 'up' as const,
        title: 'Historically Consistent Direction Signal',
        body: `Model correctly identified direction in ${pct(validation.direction_accuracy)} of held-out historical observations.`,
      }
    }
    if (validation.direction_accuracy >= 0.5) {
      return {
        tone: 'neutral' as const,
        title: 'Moderate Direction Signal',
        body: `Direction hit-rate is ${pct(validation.direction_accuracy)}. Use scenario ranges and risk bounds alongside directional bias.`,
      }
    }
    return {
      tone: 'down' as const,
      title: 'Uncertain Direction Signal',
      body: `Historical accuracy is lower (${pct(validation.direction_accuracy)}). Exercise caution for this horizon.`,
    }
  }, [validation])

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="page-tag"><History style={{ width: 14, height: 14 }} /> Track Record</div>
        <h1>Historical Validation & Accuracy</h1>
        <p className="page-desc">Review predictions made on unseen historical data to check model reliability.</p>
      </div>

      <Card>
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <label>
            <span className="form-label">Stock</span>
            <select className="form-select" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {(stocks.data ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}{s.company_name ? ` — ${s.company_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">Validation Horizon</span>
            <select className="form-select" style={{ minWidth: 160 }} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              <option value={5}>5 sessions</option>
              <option value={10}>10 sessions</option>
              <option value={20}>20 sessions</option>
            </select>
          </label>
          <Button variant="ghost" onClick={() => forecast.refetch()} disabled={forecast.isFetching}>
            <RefreshCw style={{ width: 14, height: 14 }} className={forecast.isFetching ? 'animate-spin' : ''} />
            {forecast.isFetching ? 'Checking…' : 'Refresh'}
          </Button>
        </div>
      </Card>

      {(stocks.isLoading || forecast.isLoading) && <PageSkeleton />}
      {stocks.error && <ErrorBox message={(stocks.error as Error).message} />}
      {forecast.error && <ErrorBox message={(forecast.error as Error).message} />}

      {forecast.data && validation && assessment && (
        <>
          <div className="data-notice">
            <CalendarClock style={{ width: 18, height: 18 }} />
            <div>
              <strong>Historical backtest evaluation</strong>{' '}
              <span className="data-notice-text">
                Evaluated on chronologically held-out archive data ending {forecast.data.as_of_date}.
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="metric-tile">
              <span className="metric-label">Direction Accuracy</span>
              <span className="metric-value text-green">{pct(validation.direction_accuracy)}</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Mean Absolute Error</span>
              <span className="metric-value">{validation.mae_percent.toFixed(2)}%</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Root Mean Sq Error (RMSE)</span>
              <span className="metric-value">{validation.rmse_percent.toFixed(2)}%</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Range Coverage</span>
              <span className="metric-value">{pct(validation.interval_coverage)}</span>
            </div>
          </div>

          <div className="validation-banner">
            <div className="validation-info">
              {assessment.tone === 'up' ? (
                <CheckCircle2 style={{ width: 20, height: 20, color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
              ) : (
                <ShieldCheck style={{ width: 20, height: 20, color: 'var(--blue)', flexShrink: 0, marginTop: 2 }} />
              )}
              <div>
                <h3>{assessment.title}</h3>
                <p>{assessment.body} Evaluated over {validation.validation_samples} held-out test periods.</p>
              </div>
            </div>
            <Link to={`/app?symbol=${symbol}&horizon=${horizon}`} className="btn btn-ghost btn-sm">
              View Current Forecast
            </Link>
          </div>

          <Card
            title="Predicted Return vs Actual Realised Return"
            subtitle={`Recent held-out ${horizon}-session test cases for ${symbol}`}
            action={<Badge tone="info">{correctRecent}/{validation.recent.length} recent direction hits</Badge>}
          >
            {validation.recent.length ? (
              <ValidationChart data={validation.recent} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No recent validation points available.
              </div>
            )}
          </Card>

          <Card title="Validation Observation Table" subtitle="Comparing each historical model prediction against actual market result">
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Predicted Return</th>
                    <th className="text-right">Actual Return</th>
                    <th className="text-right">Error</th>
                    <th className="text-right">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 12).map((row) => {
                    const pUp = row.predicted_return >= 0
                    const aUp = row.actual_return >= 0
                    return (
                      <tr key={row.date}>
                        <td className="mono">{row.date}</td>
                        <td className={`text-right mono ${pUp ? 'text-green' : 'text-red'}`}>
                          <span className="inline-flex items-center gap-1">
                            {pUp ? <ArrowUpRight style={{ width: 14, height: 14 }} /> : <ArrowDownRight style={{ width: 14, height: 14 }} />}
                            {pct(row.predicted_return, true)}
                          </span>
                        </td>
                        <td className={`text-right mono ${aUp ? 'text-green' : 'text-red'}`}>{pct(row.actual_return, true)}</td>
                        <td className="text-right mono text-muted">{pct(row.predicted_return - row.actual_return, true)}</td>
                        <td className="text-right">
                          <Badge tone={row.direction_correct ? 'up' : 'down'}>
                            {row.direction_correct ? 'Correct' : 'Missed'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
