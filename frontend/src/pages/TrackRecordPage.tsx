import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
  XCircle,
  CalendarClock,
} from 'lucide-react'
import { api } from '../api/client'
import type { Forecast, Stock } from '../types'
import { ValidationChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'

const percent = (value: number, signed = false) =>
  `${signed && value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

export function TrackRecordPage() {
  const [params] = useSearchParams()
  const requestedHorizon = Number(params.get('horizon'))
  const [symbol, setSymbol] = useState(params.get('symbol') || 'RELIANCE')
  const [horizon, setHorizon] = useState([5, 10, 20].includes(requestedHorizon) ? requestedHorizon : 5)

  const stocks = useQuery<Stock[]>({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })
  const forecast = useQuery<Forecast>({
    queryKey: ['forecast-validation', symbol, horizon],
    queryFn: () =>
      api.forecast({ symbol, horizon_days: horizon }) as Promise<Forecast>,
    enabled: Boolean(symbol),
  })

  const validation = forecast.data?.validation
  const recent = useMemo(
    () => [...(validation?.recent ?? [])].reverse(),
    [validation?.recent],
  )
  const correctRecent = validation?.recent.filter((row) => row.direction_correct).length ?? 0

  const assessment = useMemo(() => {
    if (!validation) return null
    if (validation.direction_accuracy >= 0.6) {
      return {
        tone: 'up' as const,
        title: 'Historically consistent direction signal',
        body: `The forecast identified the correct direction in ${percent(validation.direction_accuracy)} of the held-out observations shown by this validation window.`,
      }
    }
    if (validation.direction_accuracy >= 0.5) {
      return {
        tone: 'neutral' as const,
        title: 'Mixed historical direction signal',
        body: 'The historical validation is modest. Treat the forecast range and downside case as more important than its headline direction.',
      }
    }
    return {
      tone: 'down' as const,
      title: 'Historically uncertain direction signal',
      body: 'Recent held-out observations show an inconsistent direction signal. Extra caution is appropriate for this stock and horizon.',
    }
  }, [validation])

  return (
    <div className="space-y-6">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] text-[var(--color-accent)] mb-3">
            <ClipboardCheck className="h-3.5 w-3.5" /> Forecast track record
          </div>
          <h1 className="display text-3xl md:text-5xl font-bold tracking-tight">
            See how the forecast held up
          </h1>
          <p className="text-[var(--color-muted)] mt-3 max-w-2xl">
            Review predictions made on unseen historical periods and compare each expected
            return with what happened next.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
          Historical validation · No training details exposed
        </div>
      </section>

      <Card>
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <label className="block">
            <span className="text-xs text-[var(--color-muted)] block mb-2">Stock</span>
            <select
              className="market-input w-full"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
            >
              {(stocks.data ?? []).map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol}
                  {stock.company_name ? ` — ${stock.company_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">
              Validation horizon
            </span>
            <select
              className="market-input min-w-44"
              value={horizon}
              onChange={(event) => setHorizon(Number(event.target.value))}
            >
              <option value={5}>5 sessions</option>
              <option value={10}>10 sessions</option>
              <option value={20}>20 sessions</option>
            </select>
          </label>
          <Button onClick={() => forecast.refetch()} disabled={forecast.isFetching}>
            <span className="inline-flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${forecast.isFetching ? 'animate-spin' : ''}`} />
              {forecast.isFetching ? 'Checking…' : 'Refresh'}
            </span>
          </Button>
        </div>
      </Card>

      {(stocks.isLoading || forecast.isLoading) && <PageSkeleton />}
      {stocks.error && <ErrorBox message={(stocks.error as Error).message} />}
      {forecast.error && <ErrorBox message={(forecast.error as Error).message} />}

      {forecast.data && validation && assessment && (
        <>
          <div className="stale-data-notice">
            <CalendarClock className="h-5 w-5 shrink-0" />
            <div><strong>Historical validation</strong><span> Results are evaluated within the bundled archive ending {forecast.data.as_of_date}; they do not measure post-2021 performance.</span></div>
          </div>
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="metric-tile">
              <span>Direction accuracy</span>
              <strong>{percent(validation.direction_accuracy)}</strong>
            </div>
            <div className="metric-tile">
              <span>Average return error</span>
              <strong>{validation.mae_percent.toFixed(2)}%</strong>
            </div>
            <div className="metric-tile">
              <span>Typical error size</span>
              <strong>{validation.rmse_percent.toFixed(2)}%</strong>
            </div>
            <div className="metric-tile">
              <span>Range coverage</span>
              <strong>{percent(validation.interval_coverage)}</strong>
            </div>
          </section>

          <section
            className={`outlook-panel ${
              assessment.tone === 'up'
                ? 'outlook-up'
                : assessment.tone === 'down'
                  ? 'outlook-down'
                  : ''
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex gap-4">
                <span
                  className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                    assessment.tone === 'up'
                      ? 'bg-[rgba(61,222,168,.12)] text-[var(--color-accent)]'
                      : assessment.tone === 'down'
                        ? 'bg-[rgba(240,113,120,.12)] text-[var(--color-danger)]'
                        : 'bg-white/5 text-[var(--color-muted)]'
                  }`}
                >
                  {assessment.tone === 'up' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : assessment.tone === 'down' ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <ClipboardCheck className="h-5 w-5" />
                  )}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="display text-xl font-semibold">{assessment.title}</h2>
                    <Badge tone={assessment.tone}>
                      {validation.validation_samples} checks
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--color-muted)] mt-2 max-w-3xl leading-relaxed">
                    {assessment.body}
                  </p>
                </div>
              </div>
              <Link
                to={`/app?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`}
                className="rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm whitespace-nowrap hover:bg-white/5 transition"
              >
                View current forecast
              </Link>
            </div>
          </section>

          <Card
            title="Predicted return versus actual return"
            subtitle={`Recent held-out ${horizon}-session observations for ${symbol}`}
            action={
              <Badge>
                {correctRecent}/{validation.recent.length} recent directions correct
              </Badge>
            }
          >
            {validation.recent.length ? (
              <ValidationChart data={validation.recent} />
            ) : (
              <p className="text-sm text-[var(--color-muted)] py-10 text-center">
                No recent validation observations are available.
              </p>
            )}
          </Card>

          <Card
            title="Recent validation observations"
            subtitle="The return forecast made at each historical date and the realised outcome"
            action={<Badge>Data through {forecast.data.as_of_date}</Badge>}
          >
            {recent.length ? (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-line)]">
                      <th className="px-3 py-3 font-medium">Forecast date</th>
                      <th className="px-3 py-3 font-medium text-right">Predicted return</th>
                      <th className="px-3 py-3 font-medium text-right">Actual return</th>
                      <th className="px-3 py-3 font-medium text-right">Difference</th>
                      <th className="px-3 py-3 font-medium text-right">Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.slice(0, 12).map((row) => {
                      const predictedPositive = row.predicted_return >= 0
                      const actualPositive = row.actual_return >= 0
                      return (
                        <tr
                          key={row.date}
                          className="border-b border-[var(--color-line)] last:border-0"
                        >
                          <td className="px-3 py-3 mono">{row.date}</td>
                          <td
                            className={`px-3 py-3 text-right mono ${
                              predictedPositive
                                ? 'text-[var(--color-accent)]'
                                : 'text-[var(--color-danger)]'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {predictedPositive ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                              {percent(row.predicted_return, true)}
                            </span>
                          </td>
                          <td
                            className={`px-3 py-3 text-right mono ${
                              actualPositive
                                ? 'text-[var(--color-accent)]'
                                : 'text-[var(--color-danger)]'
                            }`}
                          >
                            {percent(row.actual_return, true)}
                          </td>
                          <td className="px-3 py-3 text-right mono text-[var(--color-muted)]">
                            {percent(row.predicted_return - row.actual_return, true)}
                          </td>
                          <td className="px-3 py-3 text-right">
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
            ) : (
              <p className="text-sm text-[var(--color-muted)] py-10 text-center">
                No recent observations are available.
              </p>
            )}
          </Card>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--color-muted)]">
            <p>
              Based on {validation.validation_samples.toLocaleString('en-IN')} chronologically
              held-out historical observations.
            </p>
            <p>Past validation does not guarantee future accuracy.</p>
          </div>
        </>
      )}
    </div>
  )
}
