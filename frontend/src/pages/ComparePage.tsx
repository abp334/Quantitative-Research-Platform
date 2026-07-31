import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  ArrowDownRight,
  ArrowUpRight,
  GitCompareArrows,
  Plus,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import type { OhlcvBar, Stock } from '../types'
import { IndicatorLineChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'

const COLORS = ['#3ddea8', '#5b8cff', '#e6b84d', '#f07178']
const DEFAULT_SYMBOLS = ['RELIANCE', 'TCS', 'INFY']

type ComparisonMetric = {
  symbol: string
  startPrice: number
  endPrice: number
  return: number
  volatility: number
  maxDrawdown: number
  bestDay: number
  worstDay: number
  averageVolume: number
}

const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const percent = (value: number, signed = false) =>
  `${signed && value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

export function ComparePage() {
  const [params, setParams] = useSearchParams()
  const initialSymbols = (params.get('symbols')?.split(',') ?? DEFAULT_SYMBOLS)
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 4)
  const initialRange = Number(params.get('range'))
  const [selected, setSelected] = useState<string[]>(
    initialSymbols.length >= 2 ? initialSymbols : DEFAULT_SYMBOLS,
  )
  const [range, setRange] = useState([90, 252, 504, 1000].includes(initialRange) ? initialRange : 252)
  const [candidate, setCandidate] = useState('')

  const stocks = useQuery<Stock[]>({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })
  const priceQueries = useQueries({
    queries: selected.map((symbol) => ({
      queryKey: ['ohlcv', symbol],
      queryFn: () => api.ohlcv(symbol, { limit: 1000 }) as Promise<OhlcvBar[]>,
      staleTime: 5 * 60_000,
    })),
  })

  useEffect(() => {
    setParams(
      { symbols: selected.join(','), range: String(range) },
      { replace: true },
    )
  }, [range, selected, setParams])

  const stockBySymbol = useMemo(
    () => new Map((stocks.data ?? []).map((stock) => [stock.symbol, stock])),
    [stocks.data],
  )
  const available = (stocks.data ?? []).filter((stock) => !selected.includes(stock.symbol))
  const loading = priceQueries.some((query) => query.isLoading)
  const firstError = priceQueries.find((query) => query.error)?.error as Error | undefined

  const analysis = useMemo(() => {
    const datasets = priceQueries.map((query, index) => ({
      symbol: selected[index],
      bars: ((query.data as OhlcvBar[] | undefined) ?? []).slice(-range),
    }))
    const metrics = datasets
      .map(({ symbol, bars }) => calculateMetrics(symbol, bars))
      .filter((metric): metric is ComparisonMetric => metric !== null)

    const dates = [...new Set(datasets.flatMap(({ bars }) => bars.map((bar) => bar.date)))]
      .sort()
    const normalizedRows: Array<Record<string, string | number | null>> = dates.map((date) => ({
      date: date.slice(0, 10),
    }))
    datasets.forEach(({ symbol, bars }) => {
      if (!bars.length) return
      const base = bars[0].close
      const byDate = new Map(bars.map((bar) => [bar.date, bar.close]))
      normalizedRows.forEach((row, index) => {
        const rawDate = dates[index]
        const close = byDate.get(rawDate)
        row[symbol] = close == null ? null : (close / base) * 100
      })
    })

    const returnMaps = new Map<string, Map<string, number>>()
    datasets.forEach(({ symbol, bars }) => {
      const map = new Map<string, number>()
      for (let index = 1; index < bars.length; index += 1) {
        map.set(bars[index].date, bars[index].close / bars[index - 1].close - 1)
      }
      returnMaps.set(symbol, map)
    })
    const correlations = selected.map((left) =>
      selected.map((right) => correlation(returnMaps.get(left), returnMaps.get(right))),
    )
    return { metrics, normalizedRows, correlations }
  }, [priceQueries, range, selected])

  const addSymbol = () => {
    if (!candidate || selected.length >= 4) return
    setSelected((current) => [...current, candidate])
    setCandidate('')
  }

  const removeSymbol = (symbol: string) => {
    if (selected.length <= 2) return
    setSelected((current) => current.filter((item) => item !== symbol))
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="eyebrow">
            <GitCompareArrows className="h-4 w-4" /> Relative-value workspace
          </div>
          <h1 className="display text-3xl md:text-5xl font-bold tracking-tight mt-5">
            Compare stocks side by side
          </h1>
          <p className="text-[var(--color-muted)] mt-3 max-w-2xl">
            Normalize performance, compare realised risk and drawdown, and check whether names
            really diversify each other before opening their forecasts.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setSelected(DEFAULT_SYMBOLS)
            setRange(252)
          }}
        >
          <span className="inline-flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Reset comparison
          </span>
        </Button>
      </section>

      <Card>
        <div className="grid lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">
              Add up to four stocks
            </span>
            <select
              className="market-input w-full"
              value={candidate}
              disabled={selected.length >= 4}
              onChange={(event) => setCandidate(event.target.value)}
            >
              <option value="">
                {selected.length >= 4 ? 'Four-stock limit reached' : 'Choose another stock…'}
              </option>
              {available.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol}
                  {stock.company_name ? ` — ${stock.company_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">History window</span>
            <select
              className="market-input min-w-44"
              value={range}
              onChange={(event) => setRange(Number(event.target.value))}
            >
              <option value={90}>3 months</option>
              <option value={252}>1 year</option>
              <option value={504}>2 years</option>
              <option value={1000}>All available</option>
            </select>
          </label>
          <Button onClick={addSymbol} disabled={!candidate || selected.length >= 4}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add
            </span>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {selected.map((symbol, index) => (
            <span
              className="comparison-chip"
              style={{ '--chip-color': COLORS[index] } as React.CSSProperties}
              key={symbol}
            >
              <i />
              {symbol}
              <button
                type="button"
                disabled={selected.length <= 2}
                onClick={() => removeSymbol(symbol)}
                title={selected.length <= 2 ? 'Keep at least two stocks' : `Remove ${symbol}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      </Card>

      {(stocks.isLoading || loading) && <PageSkeleton />}
      {stocks.error && <ErrorBox message={(stocks.error as Error).message} />}
      {firstError && <ErrorBox message={firstError.message} />}

      {!loading && analysis.metrics.length >= 2 && (
        <>
          <div className="stale-data-notice">
            <CalendarClock className="h-5 w-5 shrink-0" />
            <div>
              <strong>Historical relative performance</strong>
              <span>
                {' '}
                This comparison ends with the bundled archive. Large corporate-action moves may
                remain in unadjusted price histories.
              </span>
            </div>
          </div>
          <Card
            title="Relative performance"
            subtitle="Every stock rebased to 100 at the start of the selected window"
            action={<Badge>Comparable scale</Badge>}
          >
            <IndicatorLineChart
              data={analysis.normalizedRows}
              lines={selected.map((symbol, index) => ({
                key: symbol,
                color: COLORS[index],
                name: symbol,
              }))}
            />
          </Card>

          <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {analysis.metrics.map((metric, index) => {
              const stock = stockBySymbol.get(metric.symbol)
              const positive = metric.return >= 0
              return (
                <article
                  className="comparison-card"
                  style={{ '--chip-color': COLORS[index] } as React.CSSProperties}
                  key={metric.symbol}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="comparison-symbol">
                        <i /> {metric.symbol}
                      </div>
                      <p>{stock?.company_name || stock?.industry || 'NIFTY equity'}</p>
                    </div>
                    <WatchlistButton stock={stock ?? { symbol: metric.symbol }} compact />
                  </div>
                  <div
                    className={`comparison-return ${
                      positive ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'
                    }`}
                  >
                    {positive ? <ArrowUpRight /> : <ArrowDownRight />}
                    {percent(metric.return, true)}
                  </div>
                  <div className="comparison-metrics">
                    <span>
                      <small>Start / end</small>
                      <strong>
                        {money(metric.startPrice)} → {money(metric.endPrice)}
                      </strong>
                    </span>
                    <span>
                      <small>Annual volatility</small>
                      <strong>{percent(metric.volatility)}</strong>
                    </span>
                    <span>
                      <small>Max drawdown</small>
                      <strong className="text-[var(--color-danger)]">
                        {percent(metric.maxDrawdown)}
                      </strong>
                    </span>
                    <span>
                      <small>Best / worst day</small>
                      <strong>
                        {percent(metric.bestDay, true)} / {percent(metric.worstDay, true)}
                      </strong>
                    </span>
                  </div>
                  <Link
                    className="small-action mt-4 w-fit text-[var(--color-accent)]"
                    to={`/app?symbol=${encodeURIComponent(metric.symbol)}&horizon=10`}
                  >
                    Open forecast <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
              )
            })}
          </section>

          <section className="grid xl:grid-cols-[.72fr_1.28fr] gap-6">
            <Card
              title="Return correlation"
              subtitle="Correlation of daily returns over the selected period"
            >
              <div
                className="correlation-grid"
                style={{
                  gridTemplateColumns: `70px repeat(${selected.length}, minmax(50px, 1fr))`,
                }}
              >
                <span />
                {selected.map((symbol) => (
                  <strong key={symbol}>{symbol}</strong>
                ))}
                {selected.flatMap((left, row) => [
                  <strong key={`${left}-label`}>{left}</strong>,
                  ...selected.map((right, column) => {
                    const value = analysis.correlations[row][column]
                    return (
                      <span
                        key={`${left}-${right}`}
                        title={`${left} / ${right}: ${value.toFixed(3)}`}
                        style={{
                          background:
                            value >= 0
                              ? `rgba(61,222,168,${0.06 + Math.abs(value) * 0.34})`
                              : `rgba(240,113,120,${0.06 + Math.abs(value) * 0.34})`,
                        }}
                      >
                        {value.toFixed(2)}
                      </span>
                    )
                  }),
                ])}
              </div>
            </Card>

            <Card title="How to use this comparison" subtitle="A quick research checklist">
              <div className="research-checks">
                <div>
                  <GitCompareArrows />
                  <span>
                    <strong>Return is not enough</strong>
                    <small>Compare the path and drawdown needed to earn it.</small>
                  </span>
                </div>
                <div>
                  <ShieldAlert />
                  <span>
                    <strong>Correlation reveals hidden concentration</strong>
                    <small>Highly correlated names may behave like one position during stress.</small>
                  </span>
                </div>
                <div>
                  <ArrowUpRight />
                  <span>
                    <strong>Then test the forward view</strong>
                    <small>Open Forecast Lab to compare all three supported horizons.</small>
                  </span>
                </div>
              </div>
              <Link to={`/app/lab?symbol=${selected[0]}`} className="hero-button mt-5">
                Analyse {selected[0]} in Forecast Lab <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

function calculateMetrics(symbol: string, bars: OhlcvBar[]): ComparisonMetric | null {
  if (bars.length < 2) return null
  const returns = bars.slice(1).map((bar, index) => bar.close / bars[index].close - 1)
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(returns.length - 1, 1)
  let peak = bars[0].close
  let maxDrawdown = 0
  bars.forEach((bar) => {
    peak = Math.max(peak, bar.close)
    maxDrawdown = Math.min(maxDrawdown, bar.close / peak - 1)
  })
  return {
    symbol,
    startPrice: bars[0].close,
    endPrice: bars[bars.length - 1].close,
    return: bars[bars.length - 1].close / bars[0].close - 1,
    volatility: Math.sqrt(variance) * Math.sqrt(252),
    maxDrawdown,
    bestDay: Math.max(...returns),
    worstDay: Math.min(...returns),
    averageVolume: bars.reduce((sum, bar) => sum + bar.volume, 0) / bars.length,
  }
}

function correlation(
  left: Map<string, number> | undefined,
  right: Map<string, number> | undefined,
) {
  if (!left || !right) return 0
  if (left === right) return 1
  const pairs = [...left.entries()]
    .filter(([date]) => right.has(date))
    .map(([date, value]) => [value, right.get(date)!])
  if (pairs.length < 2) return 0
  const meanLeft = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length
  const meanRight = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length
  let numerator = 0
  let leftVariance = 0
  let rightVariance = 0
  pairs.forEach(([leftValue, rightValue]) => {
    const leftDelta = leftValue - meanLeft
    const rightDelta = rightValue - meanRight
    numerator += leftDelta * rightDelta
    leftVariance += leftDelta ** 2
    rightVariance += rightDelta ** 2
  })
  const denominator = Math.sqrt(leftVariance * rightVariance)
  return denominator ? numerator / denominator : 0
}
