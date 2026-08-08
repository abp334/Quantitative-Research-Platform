import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Info,
  Layers,
  Play,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { api } from '../api/client'
import type { Forecast, OhlcvBar, Stock } from '../types'
import { ComprehensiveTechnicalChart, ForecastFanChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox, InfoTooltip } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const pct = (n: number, signed = false) => `${signed && n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const initialSymbol = params.get('symbol') || 'RELIANCE'
  const initialHorizon = [5, 10, 20].includes(Number(params.get('horizon'))) ? Number(params.get('horizon')) : 10

  const [symbol, setSymbol] = useState(initialSymbol)
  const [horizon, setHorizon] = useState(initialHorizon)
  const [request, setRequest] = useState<{ symbol: string; horizon: number } | null>({
    symbol: initialSymbol,
    horizon: initialHorizon,
  })
  const [activeChartTab, setActiveChartTab] = useState<'forecast' | 'technical'>('forecast')

  const stocks = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })

  const forecast = useQuery({
    queryKey: ['forecast', request?.symbol, request?.horizon],
    queryFn: () => api.forecast({ symbol: request!.symbol, horizon_days: request!.horizon }) as Promise<Forecast>,
    enabled: !!request,
    staleTime: 5 * 60_000,
  })

  const ohlcv = useQuery({
    queryKey: ['ohlcv', request?.symbol],
    queryFn: () => api.ohlcv(request!.symbol, { limit: 120 }) as Promise<OhlcvBar[]>,
    enabled: !!request,
    staleTime: 5 * 60_000,
  })

  const runModel = () => {
    setRequest({ symbol, horizon })
    setParams({ symbol, horizon: String(horizon) })
  }

  const result = forecast.data
  const positive = (result?.expected_return ?? 0) >= 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-tag">
          <TrendingUp style={{ width: 12, height: 12 }} /> Price & Risk Model
        </div>
        <h1>Stock Price Forecast & Analysis</h1>
        <p className="page-desc">
          Select any NIFTY stock to see expected price predictions, target dates, best/worst case scenarios, and plain-English factor explanations.
        </p>
      </div>

      {/* Selector Control Bar */}
      <div className="p-3 rounded bg-[#111520] border border-[#1e2536]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label>
              <span className="form-label">
                Select Stock <InfoTooltip text="Choose any of the 50 Indian NIFTY equities to analyse." />
              </span>
              <select
                className="form-select"
                style={{ width: 240 }}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {(stocks.data ?? []).map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} {s.company_name ? ` — ${s.company_name}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="form-label">
                Forecast Horizon <InfoTooltip text="How many trading days into the future to forecast (5, 10, or 20 sessions)." />
              </span>
              <div className="inline-flex rounded border border-[#1e2536] bg-[#0d101a] p-0.5 text-xs font-mono">
                {[5, 10, 20].map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`px-3 py-1 rounded transition ${horizon === h ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                    onClick={() => setHorizon(h)}
                  >
                    {h} Trading Days
                  </button>
                ))}
              </div>
            </label>

            <Button variant="primary" onClick={runModel} disabled={forecast.isFetching}>
              <Play style={{ width: 12, height: 12, fill: 'currentColor' }} />
              {forecast.isFetching ? 'Calculating...' : 'Run Forecast'}
            </Button>
          </div>

          {result && (
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span>Historical As-Of: <strong className="text-slate-200">{result.as_of_date}</strong></span>
              <span>Today's Price: <strong className="text-slate-200">{money(result.current_price)}</strong></span>
              {stocks.data && <WatchlistButton stock={(stocks.data ?? []).find((s) => s.symbol === symbol) ?? { symbol }} compact />}
            </div>
          )}
        </div>
      </div>

      {forecast.isFetching && <PageSkeleton />}
      {forecast.error && <ErrorBox message={(forecast.error as Error).message} />}

      {result && !forecast.isFetching && (
        <>
          <div className="data-notice">
            <CalendarClock style={{ width: 15, height: 15 }} />
            <div>
              <strong>Archive Data Notice:</strong>{' '}
              <span className="data-notice-text">
                Evaluated on historical NIFTY dataset through {result.as_of_date}. Predictions forecast forward from that date.
              </span>
            </div>
          </div>

          {/* STEP 1: THE FORECAST OUTCOME */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase font-bold text-blue-400 tracking-wider">
                Step 1: The Model Prediction ({result.symbol} — {result.horizon_days} Trading Days)
              </h2>
            </div>

            {/* Verdict Summary Banner */}
            <div
              className={`p-4 rounded border flex flex-wrap items-center justify-between gap-4 ${
                positive
                  ? 'bg-green-950/20 border-green-800/40 text-green-300'
                  : 'bg-red-950/20 border-red-800/40 text-red-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {positive ? (
                  <TrendingUp style={{ width: 28, height: 28, flexShrink: 0 }} />
                ) : (
                  <TrendingDown style={{ width: 28, height: 28, flexShrink: 0 }} />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {result.bias} Outlook — Expected Return of {pct(result.expected_return, true)}
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Model predicts {result.symbol} will move from {money(result.current_price)} to approximately{' '}
                    <strong>{money(result.target_price)}</strong> over the next {result.horizon_days} trading days.
                  </div>
                </div>
              </div>
              <Badge tone={positive ? 'up' : 'down'}>
                {Math.round(result.probability_up * 100)}% Upside Odds
              </Badge>
            </div>

            {/* 4 Key Stat Metric Tiles with Subtitles */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="metric-tile">
                <div className="flex items-center justify-between">
                  <span className="metric-label">Predicted Target Price</span>
                  <InfoTooltip text="The expected rupee price of this stock at the end of the forecast period." />
                </div>
                <span className="metric-value text-blue-400">{money(result.target_price)}</span>
                <span className="metric-hint">Current: {money(result.current_price)}</span>
              </div>

              <div className="metric-tile">
                <div className="flex items-center justify-between">
                  <span className="metric-label">Expected Return</span>
                  <InfoTooltip text="Predicted percentage change from current price over N trading days." />
                </div>
                <span className={`metric-value ${positive ? 'text-green' : 'text-red'}`}>
                  {pct(result.expected_return, true)}
                </span>
                <span className="metric-hint">Over {result.horizon_days} sessions</span>
              </div>

              <div className="metric-tile">
                <div className="flex items-center justify-between">
                  <span className="metric-label">Odds of Price Increase</span>
                  <InfoTooltip text="Probability (0% to 100%) that the stock price finishes higher than today's price." />
                </div>
                <span className="metric-value">{Math.round(result.probability_up * 100)}%</span>
                <span className="metric-hint">
                  {result.probability_up >= 0.55 ? 'Favors Upward Move' : result.probability_up <= 0.45 ? 'Favors Downward Move' : 'Neutral Coin-Flip'}
                </span>
              </div>

              <div className="metric-tile">
                <div className="flex items-center justify-between">
                  <span className="metric-label">AI Consensus Score</span>
                  <InfoTooltip text="Measures how strongly the 3 underlying ML algorithms agree with each other." />
                </div>
                <span className="metric-value">{Math.round(result.confidence * 100)}%</span>
                <span className="metric-hint">Model Agreement Level</span>
              </div>
            </div>

            {/* Interactive Chart with Tabs */}
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-mono font-semibold rounded border transition ${
                      activeChartTab === 'forecast' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-[#2a344d] text-slate-400'
                    }`}
                    onClick={() => setActiveChartTab('forecast')}
                  >
                    1. Forecast Path &amp; Range
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-mono font-semibold rounded border transition ${
                      activeChartTab === 'technical' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-[#2a344d] text-slate-400'
                    }`}
                    onClick={() => setActiveChartTab('technical')}
                  >
                    2. Full Technical Chart (SMA, RSI, MACD)
                  </button>
                </div>
                <Badge tone="info">Visual Explanation</Badge>
              </div>

              <div className="p-3">
                {activeChartTab === 'forecast' ? (
                  <ForecastFanChart
                    data={result.forecast_points}
                    currentPrice={result.current_price}
                    asOfDate={result.as_of_date}
                    historicalBars={ohlcv.data ?? []}
                  />
                ) : (
                  <ComprehensiveTechnicalChart data={ohlcv.data ?? []} />
                )}
              </div>
            </div>

            {/* Best Case vs Worst Case Scenario Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded bg-[#111520] border border-red-950/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-red-400 uppercase">Worst-Case Drop (Bear)</span>
                  <InfoTooltip text="If market conditions turn negative, the price is estimated to floor around this level." />
                </div>
                <div className="mono text-base font-bold text-red-400 mt-1">{money(result.scenarios.bear.price)}</div>
                <div className="mono text-xs text-red-400">{pct(result.scenarios.bear.return, true)} (Stop-Loss Level)</div>
              </div>

              <div className="p-3 rounded bg-[#111520] border border-blue-950/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-blue-400 uppercase">Expected Base Path</span>
                  <InfoTooltip text="The most likely target price predicted by the ensemble model." />
                </div>
                <div className="mono text-base font-bold text-blue-400 mt-1">{money(result.scenarios.base.price)}</div>
                <div className="mono text-xs text-blue-400">{pct(result.scenarios.base.return, true)} (Main Target)</div>
              </div>

              <div className="p-3 rounded bg-[#111520] border border-green-950/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-green-400 uppercase">Best-Case Jump (Bull)</span>
                  <InfoTooltip text="If market conditions turn very positive, the price could reach up to this ceiling." />
                </div>
                <div className="mono text-base font-bold text-green-400 mt-1">{money(result.scenarios.bull.price)}</div>
                <div className="mono text-xs text-green-400">{pct(result.scenarios.bull.return, true)} (Profit Target)</div>
              </div>
            </div>
          </div>

          {/* STEP 2: WHY DOES THE MODEL PREDICT THIS */}
          <div className="space-y-3 pt-2">
            <h2 className="font-mono text-xs uppercase font-bold text-blue-400 tracking-wider">
              Step 2: Why Does the Model Expect This? (Key Factor Drivers)
            </h2>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* SHAP Factor Explanations */}
              <Card title="Top Technical Factors" subtitle="What signals pushed the prediction UP or DOWN?">
                <div className="factor-list">
                  {result.factors.map((f) => (
                    <div className="factor-item" key={f.name}>
                      <span className={`factor-dot ${f.state}`} />
                      <div className="factor-info">
                        <div className="flex justify-between gap-2">
                          <strong>{f.name}</strong>
                          <span className={`factor-state ${f.state}`}>
                            {f.state === 'positive' ? '▲ Pushing Up' : f.state === 'negative' ? '▼ Pushing Down' : '● Neutral'}
                          </span>
                        </div>
                        <p>{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Technical Indicators Summary */}
              <Card title="Stock Health Metrics" subtitle="Price levels, volatility, and trading volume">
                <div className="context-list">
                  <div className="context-row">
                    <span className="context-label">Risk Category</span>
                    <Badge tone={result.market_context.risk_level === 'High' ? 'down' : result.market_context.risk_level === 'Low' ? 'up' : 'neutral'}>
                      {result.market_context.risk_level} Volatility
                    </Badge>
                  </div>
                  <div className="context-row">
                    <span className="context-label">
                      Annualized Volatility <InfoTooltip text="Measures how wildly this stock price swings up and down over a year." />
                    </span>
                    <span className="context-value">{pct(result.market_context.annualized_volatility)}</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">Key Support (Price Floor)</span>
                    <span className="context-value">{money(result.market_context.support)}</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">Key Resistance (Price Ceiling)</span>
                    <span className="context-value">{money(result.market_context.resistance)}</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">
                      RSI Index (14 Days) <InfoTooltip text=">70 means stock might be overbought; <30 means oversold." />
                    </span>
                    <span className="context-value">{result.market_context.rsi.toFixed(1)}</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">Volume Relative Ratio</span>
                    <span className="context-value">{result.market_context.volume_ratio.toFixed(2)}× Average Volume</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* STEP 3: HOW RELIABLE IS THIS MODEL */}
          <div className="space-y-3 pt-2">
            <h2 className="font-mono text-xs uppercase font-bold text-blue-400 tracking-wider">
              Step 3: How Reliable Was This Model in Past Tests? (Backtesting)
            </h2>

            <div className="p-4 rounded bg-[#111520] border border-[#1e2536] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex items-center gap-3">
                <CheckCircle2 style={{ width: 22, height: 22, color: 'var(--green)', flexShrink: 0 }} />
                <div>
                  <div className="text-slate-200 font-bold">
                    Past Accuracy (Hit-Rate): {(result.validation.direction_accuracy * 100).toFixed(1)}% Correct Direction
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Tested on {result.validation.validation_samples} historical periods the model had never seen before. Average error margin: {result.validation.mae_percent.toFixed(2)}%.
                  </div>
                </div>
              </div>

              <Link to={`/app/track-record?symbol=${result.symbol}&horizon=${result.horizon_days}`} className="btn btn-ghost btn-sm">
                View Full Accuracy Table →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
