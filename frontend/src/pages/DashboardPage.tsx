import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Gauge,
  Layers3,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react'
import { api } from '../api/client'
import type { Forecast, Stock } from '../types'
import { ForecastFanChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const percent = (n: number, signed = false) => `${signed && n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const initialSymbol = params.get('symbol') || 'RELIANCE'
  const initialHorizon = [5, 10, 20].includes(Number(params.get('horizon'))) ? Number(params.get('horizon')) : 10
  const [symbol, setSymbol] = useState(initialSymbol)
  const [horizon, setHorizon] = useState(initialHorizon)
  const [request, setRequest] = useState<{ symbol: string; horizon: number } | null>(
    params.has('symbol') ? { symbol: initialSymbol, horizon: initialHorizon } : null,
  )

  const stocks = useQuery({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const forecast = useQuery({
    queryKey: ['forecast', request?.symbol, request?.horizon],
    queryFn: () => api.forecast({ symbol: request!.symbol, horizon_days: request!.horizon }) as Promise<Forecast>,
    enabled: !!request,
    staleTime: 5 * 60_000,
  })

  const runForecast = () => {
    setRequest({ symbol, horizon })
    setParams({ symbol, horizon: String(horizon) })
  }
  const result = forecast.data
  const positive = (result?.expected_return ?? 0) > 0

  return <div className="space-y-6">
    <section className="grid lg:grid-cols-[1fr_auto] items-end gap-5">
      <div>
        <div className="eyebrow"><BrainCircuit className="h-4 w-4" /> Multi-horizon intelligence</div>
        <h1 className="display text-3xl md:text-5xl font-bold tracking-tight mt-5">AI price forecast</h1>
        <p className="text-[var(--color-muted)] mt-3 max-w-2xl leading-relaxed">
          Estimate a future price path, probable range, return and risk—not only whether the next candle may be green or red.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]"><Layers3 className="h-4 w-4 text-[var(--color-accent)]" /> Price · range · probability · risk</div>
    </section>

    <Card>
      <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <label>
          <span className="text-xs text-[var(--color-muted)] block mb-2">Stock</span>
          <span className="relative block">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--color-muted)]" />
            <select className="market-input pl-10 w-full" value={symbol} onChange={(event) => setSymbol(event.target.value)}>
              {(stocks.data ?? []).map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.symbol}{stock.company_name ? ` — ${stock.company_name}` : ''}</option>)}
            </select>
          </span>
        </label>
        <label>
          <span className="text-xs text-[var(--color-muted)] block mb-2">Forecast window</span>
          <select className="market-input min-w-48" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
            <option value={5}>5 trading sessions</option>
            <option value={10}>10 trading sessions</option>
            <option value={20}>20 trading sessions</option>
          </select>
        </label>
        <Button onClick={runForecast} disabled={forecast.isFetching}>{forecast.isFetching ? 'Building forecast…' : 'Run AI forecast'}</Button>
      </div>
    </Card>

    {!request && <section className="forecast-empty">
      <div className="forecast-empty-icon"><Sparkles className="h-7 w-7" /></div>
      <h2 className="display text-2xl font-semibold mt-5">A complete forecast, in one request</h2>
      <p className="text-sm text-[var(--color-muted)] max-w-xl mx-auto mt-2">Nexus will privately study the stock’s historical returns, trend, momentum, volume and volatility, then test its estimates on unseen history before showing you the result.</p>
      <div className="grid sm:grid-cols-4 gap-3 max-w-3xl mx-auto mt-7">
        {[[Target,'Target price'],[Activity,'Forecast path'],[ShieldAlert,'Risk range'],[CheckCircle2,'Track record']].map(([Icon,label]) => { const I=Icon as typeof Target; return <div key={String(label)} className="mini-capability"><I className="h-4 w-4"/>{String(label)}</div> })}
      </div>
    </section>}

    {forecast.isFetching && <PageSkeleton />}
    {forecast.error && <ErrorBox message={(forecast.error as Error).message} />}

    {result && !forecast.isFetching && <>
      <div className="stale-data-notice">
        <CalendarClock className="h-5 w-5 shrink-0" />
        <div><strong>Historical-data forecast</strong><span> This dataset is available through {result.as_of_date}. The projected dates continue from that point and are not a live {new Date().getFullYear()} market forecast.</span></div>
      </div>

      <section className={`forecast-hero ${positive ? 'forecast-positive' : 'forecast-negative'}`}>
        <div className="grid lg:grid-cols-[1fr_270px] gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{result.symbol}</Badge>
              <span className="text-sm text-[var(--color-muted)]">{result.company_name}</span>
              <Badge tone={result.bias === 'Bullish' ? 'up' : result.bias === 'Bearish' ? 'down' : 'neutral'}>{result.bias} forecast</Badge>
              <WatchlistButton stock={result} compact />
            </div>
            <p className="text-xs uppercase tracking-[.16em] text-[var(--color-muted)] mt-7">AI base estimate after {result.horizon_days} sessions</p>
            <div className="flex flex-wrap items-end gap-4 mt-2">
              <span className="mono text-4xl md:text-5xl font-semibold">{money(result.target_price)}</span>
              <span className={`flex items-center gap-1 pb-1 font-medium ${positive ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'}`}>
                {positive ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}{percent(result.expected_return, true)}
              </span>
            </div>
            <p className="text-sm text-[var(--color-muted)] mt-3 max-w-2xl leading-relaxed">{result.narrative}</p>
          </div>
          <div className="forecast-probability">
            <Gauge className="h-5 w-5 text-[var(--color-accent)]" />
            <strong>{Math.round(result.probability_up * 100)}%</strong>
            <span>probability of finishing above {money(result.current_price)}</span>
            <div><i style={{ width: `${result.probability_up * 100}%` }} /></div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          <div className="metric-tile"><span>Current price</span><strong>{money(result.current_price)}</strong></div>
          <div className="metric-tile"><span>Expected range</span><strong className="!text-base">{money(result.expected_low)} – {money(result.expected_high)}</strong></div>
          <div className="metric-tile"><span>Signal confidence</span><strong>{Math.round(result.confidence * 100)}%</strong></div>
          <div className="metric-tile"><span>Market regime</span><strong className="!text-base">{result.market_context.regime}</strong></div>
        </div>
      </section>

      <Card title="Projected price path" subtitle={`Base estimate and expected range for the next ${result.horizon_days} trading sessions`} action={<Badge>Range is probabilistic</Badge>}>
        <ForecastFanChart data={result.forecast_points} currentPrice={result.current_price} asOfDate={result.as_of_date} />
      </Card>

      <section className="grid md:grid-cols-3 gap-4">
        {(['bear','base','bull'] as const).map((key) => {
          const scenario = result.scenarios[key]
          return <div className={`scenario-card scenario-${key}`} key={key}>
            <span>{scenario.label}</span>
            <strong>{money(scenario.price)}</strong>
            <em>{percent(scenario.return, true)}</em>
            <small>{key === 'bear' ? 'Lower expected boundary' : key === 'bull' ? 'Upper expected boundary' : 'Most likely estimate'}</small>
          </div>
        })}
      </section>

      <section className="grid lg:grid-cols-[1.3fr_.7fr] gap-6">
        <Card title="What is shaping the forecast" subtitle="Market-language signals calculated from the stock’s own history">
          <div className="space-y-3">
            {result.factors.map((factor) => <div key={factor.name} className="factor-row">
              <span className={`factor-dot factor-${factor.state}`} />
              <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><strong>{factor.name}</strong><span className={`text-xs factor-text-${factor.state}`}>{factor.state}</span></div><p>{factor.description}</p></div>
              <div className="factor-meter"><i style={{ width: `${Math.abs(factor.score) * 100}%` }} className={factor.score >= 0 ? 'factor-meter-up' : 'factor-meter-down'} /></div>
            </div>)}
          </div>
        </Card>
        <Card title="Risk & market levels">
          <div className="space-y-4">
            <div className="context-row"><span>Risk level</span><Badge tone={result.market_context.risk_level === 'High' ? 'down' : result.market_context.risk_level === 'Low' ? 'up' : 'neutral'}>{result.market_context.risk_level}</Badge></div>
            <div className="context-row"><span>Annualised volatility</span><strong>{percent(result.market_context.annualized_volatility)}</strong></div>
            <div className="context-row"><span>Nearby support</span><strong>{money(result.market_context.support)}</strong></div>
            <div className="context-row"><span>Nearby resistance</span><strong>{money(result.market_context.resistance)}</strong></div>
            <div className="context-row"><span>RSI momentum</span><strong>{result.market_context.rsi.toFixed(1)}</strong></div>
            <div className="context-row"><span>Relative volume</span><strong>{result.market_context.volume_ratio.toFixed(2)}×</strong></div>
          </div>
        </Card>
      </section>

      <section className="validation-preview">
        <div className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-[var(--color-accent)] shrink-0 mt-1" /><div><h2 className="display text-xl font-semibold">Validated against unseen history</h2><p className="text-sm text-[var(--color-muted)] mt-1">Direction was correct in {(result.validation.direction_accuracy * 100).toFixed(1)}% of {result.validation.validation_samples} recent test cases, with average return error of {result.validation.mae_percent.toFixed(2)}%.</p></div></div>
        <Link to={`/app/track-record?symbol=${result.symbol}&horizon=${result.horizon_days}`} className="text-sm text-[var(--color-accent)] whitespace-nowrap">Open full track record →</Link>
      </section>

      <div className="flex gap-2 text-xs text-[var(--color-muted)] px-1"><AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-warning)]" /> Forecast ranges are estimates derived from historical behaviour. They are not guaranteed price targets or investment advice.</div>
    </>}
  </div>
}
