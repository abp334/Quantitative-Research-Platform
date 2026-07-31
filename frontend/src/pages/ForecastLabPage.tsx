import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Download,
  FlaskConical,
  Gauge,
  ShieldAlert,
  Sparkles,
  Target,
  WalletCards,
} from 'lucide-react'
import { api } from '../api/client'
import type { Forecast, Stock } from '../types'
import { IndicatorLineChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton, useToast } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'

const HORIZONS = [5, 10, 20] as const
const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const percent = (value: number, signed = false) =>
  `${signed && value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

export function ForecastLabPage() {
  const [params, setParams] = useSearchParams()
  const initialSymbol = params.get('symbol') || 'RELIANCE'
  const [symbol, setSymbol] = useState(initialSymbol)
  const [request, setRequest] = useState<string | null>(params.has('symbol') ? initialSymbol : null)
  const [selectedHorizon, setSelectedHorizon] = useState<number>(10)
  const [capital, setCapital] = useState(100_000)
  const [requiredReturn, setRequiredReturn] = useState(0.03)
  const [maxLoss, setMaxLoss] = useState(0.06)
  const toast = useToast()

  const stocks = useQuery<Stock[]>({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })
  const lab = useQuery<Forecast[]>({
    queryKey: ['forecast-lab', request],
    queryFn: async () => {
      const results: Forecast[] = []
      // Keep CPU-heavy model fits sequential to avoid oversubscribing the API host.
      for (const horizon of HORIZONS) {
        results.push(
          (await api.forecast({
            symbol: request!,
            horizon_days: horizon,
          })) as Forecast,
        )
      }
      return results
    },
    enabled: Boolean(request),
    staleTime: 5 * 60_000,
  })

  const forecasts = lab.data ?? []
  const selected =
    forecasts.find((forecast) => forecast.horizon_days === selectedHorizon) ?? forecasts[0]
  const loading = lab.isFetching
  const selectedStock = (stocks.data ?? []).find((stock) => stock.symbol === (request || symbol))

  const analysis = useMemo(() => {
    if (!selected) return null
    const bearReturn = selected.scenarios.bear.return
    const bullReturn = selected.scenarios.bull.return
    const intervalSigma = Math.abs(bullReturn - bearReturn) / (2 * 1.2816)
    const validationSigma = selected.validation.rmse_percent / 100
    const sigma = Math.max(intervalSigma, validationSigma, 0.002)
    const chanceOfGoal = 1 - normalCdf((requiredReturn - selected.expected_return) / sigma)
    const chanceOfLossBreach = normalCdf((-maxLoss - selected.expected_return) / sigma)
    const reward = Math.max(bullReturn, 0)
    const risk = Math.max(Math.abs(Math.min(bearReturn, 0)), 0.0001)
    const riskReward = reward / risk
    const expectedPnl = capital * selected.expected_return
    const bearPnl = capital * bearReturn
    const bullPnl = capital * bullReturn
    const positionAtRisk = capital * risk
    const signalQuality =
      selected.validation.direction_accuracy * 0.45 +
      selected.validation.interval_coverage * 0.25 +
      selected.confidence * 0.3
    return {
      bearReturn,
      bullReturn,
      sigma,
      chanceOfGoal,
      chanceOfLossBreach,
      riskReward,
      expectedPnl,
      bearPnl,
      bullPnl,
      positionAtRisk,
      signalQuality,
    }
  }, [capital, maxLoss, requiredReturn, selected])

  const runLab = () => {
    setRequest(symbol)
    setParams({ symbol }, { replace: true })
  }

  const exportBrief = () => {
    if (!selected || !analysis) return
    const brief = {
      generated_at: new Date().toISOString(),
      data_through: selected.as_of_date,
      symbol: selected.symbol,
      capital_assumption: capital,
      required_return: requiredReturn,
      maximum_loss_threshold: maxLoss,
      selected_horizon: selected.horizon_days,
      forecast: selected,
      scenario_analysis: analysis,
      disclaimer: 'Historical research output. Not investment advice or a live-market forecast.',
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${selected.symbol.toLowerCase()}-forecast-brief.json`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.push('Research brief exported')
  }

  const horizonRows = forecasts.map((forecast) => ({
    date: `${forecast.horizon_days} sessions`,
    expected: forecast.expected_return * 100,
    lower: forecast.scenarios.bear.return * 100,
    upper: forecast.scenarios.bull.return * 100,
  }))

  return (
    <div className="space-y-6">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="eyebrow">
            <FlaskConical className="h-4 w-4" /> Interactive scenario engine
          </div>
          <h1 className="display text-3xl md:text-5xl font-bold tracking-tight mt-5">
            Forecast Lab
          </h1>
          <p className="text-[var(--color-muted)] mt-3 max-w-2xl leading-relaxed">
            Compare all supported horizons at once, translate forecast ranges into capital
            outcomes, and stress-test your own return and loss thresholds.
          </p>
        </div>
        {selectedStock && <WatchlistButton stock={selectedStock} />}
      </section>

      <Card>
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">Stock to analyse</span>
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
          <Button onClick={runLab} disabled={loading}>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {loading ? 'Running three horizons…' : 'Run full horizon analysis'}
            </span>
          </Button>
        </div>
      </Card>

      {!request && (
        <section className="forecast-empty">
          <FlaskConical className="h-8 w-8 text-[var(--color-accent)] mx-auto" />
          <h2 className="display text-2xl font-semibold mt-4">One stock, three time horizons</h2>
          <p className="text-sm text-[var(--color-muted)] max-w-xl mx-auto mt-2">
            The lab builds independent 5, 10 and 20-session estimates so you can see whether the
            signal strengthens, fades or reverses through time.
          </p>
        </section>
      )}

      {loading && forecasts.length === 0 && <PageSkeleton />}
      {stocks.error && <ErrorBox message={(stocks.error as Error).message} />}
      {lab.error && <ErrorBox message={(lab.error as Error).message} />}

      {forecasts.length > 0 && selected && analysis && (
        <>
          <div className="stale-data-notice">
            <CalendarClock className="h-5 w-5 shrink-0" />
            <div>
              <strong>Historical scenario lab</strong>
              <span>
                {' '}
                Outcomes begin after {selected.as_of_date}. Capital figures are illustrations
                applied to archived-model ranges, not executable trade estimates.
              </span>
            </div>
          </div>

          <section className="horizon-grid">
            {forecasts.map((forecast) => {
              const active = forecast.horizon_days === selected.horizon_days
              const positive = forecast.expected_return >= 0
              return (
                <button
                  type="button"
                  className={`horizon-card ${active ? 'horizon-card-active' : ''}`}
                  onClick={() => setSelectedHorizon(forecast.horizon_days)}
                  key={forecast.horizon_days}
                >
                  <span>{forecast.horizon_days} sessions</span>
                  <strong
                    className={
                      positive ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'
                    }
                  >
                    {positive ? <ArrowUpRight /> : <ArrowDownRight />}
                    {percent(forecast.expected_return, true)}
                  </strong>
                  <small>
                    P(up) {percent(forecast.probability_up)} · accuracy{' '}
                    {percent(forecast.validation.direction_accuracy)}
                  </small>
                  <i>
                    <em style={{ width: `${forecast.probability_up * 100}%` }} />
                  </i>
                </button>
              )
            })}
          </section>

          <section className="grid xl:grid-cols-[.82fr_1.18fr] gap-6">
            <Card
              title="Your capital assumptions"
              subtitle="Change these values—the scenario analysis updates instantly"
              action={<WalletCards className="h-4 w-4 text-[var(--color-accent)]" />}
            >
              <div className="lab-controls">
                <label>
                  <span>
                    Capital modelled <strong>{money(capital)}</strong>
                  </span>
                  <input
                    type="range"
                    min={10_000}
                    max={2_000_000}
                    step={10_000}
                    value={capital}
                    onChange={(event) => setCapital(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>
                    Required return <strong>{percent(requiredReturn)}</strong>
                  </span>
                  <input
                    type="range"
                    min={-0.05}
                    max={0.15}
                    step={0.005}
                    value={requiredReturn}
                    onChange={(event) => setRequiredReturn(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>
                    Loss threshold <strong>{percent(maxLoss)}</strong>
                  </span>
                  <input
                    type="range"
                    min={0.01}
                    max={0.2}
                    step={0.005}
                    value={maxLoss}
                    onChange={(event) => setMaxLoss(Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="lab-probability">
                  <span>Chance of clearing your return</span>
                  <strong>{percent(analysis.chanceOfGoal)}</strong>
                  <i>
                    <em style={{ width: `${analysis.chanceOfGoal * 100}%` }} />
                  </i>
                </div>
                <div className="lab-probability lab-probability-risk">
                  <span>Chance of breaching loss limit</span>
                  <strong>{percent(analysis.chanceOfLossBreach)}</strong>
                  <i>
                    <em style={{ width: `${analysis.chanceOfLossBreach * 100}%` }} />
                  </i>
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-muted)] mt-3 leading-relaxed">
                Probabilities are a normal-distribution approximation using the wider of the
                forecast interval and held-out RMSE. They are a sensitivity tool, not an order
                sizing recommendation.
              </p>
            </Card>

            <Card
              title={`${selected.horizon_days}-session capital map`}
              subtitle={`Applied to ${money(capital)} at the archive close of ${money(selected.current_price)}`}
              action={<Badge tone={selected.expected_return >= 0 ? 'up' : 'down'}>{selected.bias}</Badge>}
            >
              <div className="capital-map">
                <div className="capital-outcome capital-bear">
                  <span>Bear boundary</span>
                  <strong>{money(capital + analysis.bearPnl)}</strong>
                  <em>{money(analysis.bearPnl)}</em>
                </div>
                <div className="capital-outcome capital-base">
                  <span>Base estimate</span>
                  <strong>{money(capital + analysis.expectedPnl)}</strong>
                  <em>{money(analysis.expectedPnl)}</em>
                </div>
                <div className="capital-outcome capital-bull">
                  <span>Bull boundary</span>
                  <strong>{money(capital + analysis.bullPnl)}</strong>
                  <em>{money(analysis.bullPnl)}</em>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <div className="watch-metric">
                  <span>Range risk</span>
                  <strong>{money(analysis.positionAtRisk)}</strong>
                </div>
                <div className="watch-metric">
                  <span>Reward / risk</span>
                  <strong>{analysis.riskReward.toFixed(2)}×</strong>
                </div>
                <div className="watch-metric">
                  <span>Signal quality</span>
                  <strong>{percent(analysis.signalQuality)}</strong>
                </div>
              </div>
              <div className="lab-assessment mt-4">
                <Gauge className="h-5 w-5" />
                <p>
                  {analysis.chanceOfGoal >= 0.6 && analysis.chanceOfLossBreach <= 0.25
                    ? 'The selected assumptions fit comfortably inside this historical forecast distribution.'
                    : analysis.chanceOfLossBreach > 0.4
                      ? 'Your loss threshold is frequently breached by this approximate distribution. The setup is fragile under your assumptions.'
                      : 'The setup is balanced but does not show a decisive margin over your required return.'}
                </p>
              </div>
            </Card>
          </section>

          <Card
            title="Forecast term structure"
            subtitle="Expected, lower and upper return estimates as the horizon extends"
            action={<Target className="h-4 w-4 text-[var(--color-accent)]" />}
          >
            <IndicatorLineChart
              data={horizonRows}
              lines={[
                { key: 'expected', color: '#3ddea8', name: 'Expected return %' },
                { key: 'lower', color: '#f07178', name: 'Lower boundary %' },
                { key: 'upper', color: '#5b8cff', name: 'Upper boundary %' },
              ]}
            />
          </Card>

          <section className="grid md:grid-cols-[1fr_auto] gap-4 items-center outlook-panel">
            <div className="flex gap-3">
              <ShieldAlert className="h-5 w-5 text-[var(--color-warning)] shrink-0 mt-0.5" />
              <div>
                <h2 className="display text-lg font-semibold">Keep the model accountable</h2>
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  Compare this horizon’s assumptions against its complete held-out track record,
                  then save the machine-readable brief for your research notes.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={exportBrief}>
                <span className="inline-flex items-center gap-2">
                  <Download className="h-4 w-4" /> Export brief
                </span>
              </Button>
              <Link
                to={`/app/track-record?symbol=${selected.symbol}&horizon=${selected.horizon_days}`}
                className="hero-button"
              >
                Open track record <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value) / Math.sqrt(2)
  const t = 1 / (1 + 0.3275911 * x)
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x))
  return 0.5 * (1 + sign * erf)
}
