import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Search,
  Sparkles,
  Target,
} from 'lucide-react'
import { api } from '../api/client'
import type { ScannerItem } from '../types'
import { Badge, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'

type DirectionFilter = 'all' | 'bullish' | 'bearish'
type SortKey = 'score' | 'return' | 'probability' | 'risk'

const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const percent = (value: number, signed = false) =>
  `${signed && value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

export function ScannerPage() {
  const [horizon, setHorizon] = useState(5)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<DirectionFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('score')

  const scanner = useQuery<ScannerItem[]>({
    queryKey: ['market-scanner', horizon],
    queryFn: () => api.scanner(horizon) as Promise<ScannerItem[]>,
  })

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = (scanner.data ?? []).filter((item) => {
      const matchesSearch =
        !term ||
        item.symbol.toLowerCase().includes(term) ||
        (item.company_name ?? '').toLowerCase().includes(term) ||
        (item.industry ?? '').toLowerCase().includes(term)
      const matchesDirection =
        direction === 'all' ||
        (direction === 'bullish' && item.expected_return >= 0) ||
        (direction === 'bearish' && item.expected_return < 0)
      return matchesSearch && matchesDirection
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'return') return b.expected_return - a.expected_return
      if (sortBy === 'probability') return b.probability_up - a.probability_up
      if (sortBy === 'risk') return a.volatility - b.volatility
      return b.score - a.score
    })
  }, [direction, scanner.data, search, sortBy])

  const summary = useMemo(() => {
    const source = scanner.data ?? []
    const bullish = source.filter((item) => item.expected_return >= 0).length
    const averageProbability = source.length
      ? source.reduce((total, item) => total + item.probability_up, 0) / source.length
      : 0
    return {
      bullish,
      averageProbability,
      leader: source.reduce<ScannerItem | null>(
        (best, item) => (!best || item.score > best.score ? item : best),
        null,
      ),
    }
  }, [scanner.data])

  return (
    <div className="space-y-6">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] text-[var(--color-accent)] mb-3">
            <Sparkles className="h-3.5 w-3.5" /> AI opportunity scanner
          </div>
          <h1 className="display text-3xl md:text-5xl font-bold tracking-tight">
            Find stocks worth a closer look
          </h1>
          <p className="text-[var(--color-muted)] mt-3 max-w-2xl">
            Rank the available market by forecast strength, expected movement and risk.
            Open any result to inspect its complete price outlook.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <Target className="h-4 w-4 text-[var(--color-accent)]" />
          Forecasts refresh when the horizon changes
        </div>
      </section>

      <Card>
        <div className="grid lg:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <label className="block">
            <span className="text-xs text-[var(--color-muted)] block mb-2">
              Search symbol, company or industry
            </span>
            <span className="relative block">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--color-muted)]" />
              <input
                className="market-input pl-10 w-full"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search the scanner"
              />
            </span>
          </label>
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">Forecast horizon</span>
            <select
              className="market-input min-w-40"
              value={horizon}
              onChange={(event) => setHorizon(Number(event.target.value))}
            >
              <option value={5}>5 sessions</option>
              <option value={10}>10 sessions</option>
              <option value={20}>20 sessions</option>
            </select>
          </label>
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">Direction</span>
            <select
              className="market-input min-w-36"
              value={direction}
              onChange={(event) => setDirection(event.target.value as DirectionFilter)}
            >
              <option value="all">All outlooks</option>
              <option value="bullish">Positive return</option>
              <option value="bearish">Negative return</option>
            </select>
          </label>
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">Rank by</span>
            <select
              className="market-input min-w-40"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
            >
              <option value="score">Overall score</option>
              <option value="return">Expected return</option>
              <option value="probability">Upside probability</option>
              <option value="risk">Lowest volatility</option>
            </select>
          </label>
        </div>
      </Card>

      {scanner.isLoading && <PageSkeleton />}
      {scanner.error && <ErrorBox message={(scanner.error as Error).message} />}

      {scanner.data && (
        <>
          <div className="stale-data-notice">
            <CalendarClock className="h-5 w-5 shrink-0" />
            <div><strong>Historical-data ranking</strong><span> Scanner inputs are available through {scanner.data[0]?.as_of_date ?? 'the bundled archive date'}; this is not a live-market leaderboard.</span></div>
          </div>
          <section className="grid sm:grid-cols-3 gap-4">
            <div className="metric-tile">
              <span>Positive forecasts</span>
              <strong>
                {summary.bullish}
                <small className="text-xs font-normal text-[var(--color-muted)]">
                  {' '}
                  of {scanner.data.length}
                </small>
              </strong>
            </div>
            <div className="metric-tile">
              <span>Average upside probability</span>
              <strong>{percent(summary.averageProbability)}</strong>
            </div>
            <div className="metric-tile">
              <span>Highest overall score</span>
              <strong className="!text-lg">
                {summary.leader ? `${summary.leader.symbol} · ${summary.leader.score.toFixed(1)}` : '—'}
              </strong>
            </div>
          </section>

          <Card
            title="Ranked opportunities"
            subtitle={`${rows.length} matching stocks · ${horizon}-session forecast`}
            action={<Badge>{scanner.isFetching ? 'Refreshing…' : 'AI ranking'}</Badge>}
          >
            {rows.length ? (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-muted)] border-b border-[var(--color-line)]">
                      <th className="px-3 py-3 font-medium">Rank</th>
                      <th className="px-3 py-3 font-medium">Stock</th>
                      <th className="px-3 py-3 font-medium text-right">Last price</th>
                      <th className="px-3 py-3 font-medium text-right">Expected return</th>
                      <th className="px-3 py-3 font-medium text-right">P(up)</th>
                      <th className="px-3 py-3 font-medium text-right">Past direction hit</th>
                      <th className="px-3 py-3 font-medium text-right">Annual volatility</th>
                      <th className="px-3 py-3 font-medium text-right">Score</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item, index) => {
                      const positive = item.expected_return >= 0
                      const forecastLink = `/app?symbol=${encodeURIComponent(item.symbol)}&horizon=${horizon}`
                      return (
                        <tr
                          key={item.symbol}
                          className="border-b border-[var(--color-line)] last:border-0 hover:bg-white/[.025] transition-colors"
                        >
                          <td className="px-3 py-4 mono text-[var(--color-muted)]">
                            {String(index + 1).padStart(2, '0')}
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2">
                              <Badge tone={positive ? 'up' : 'down'}>{item.symbol}</Badge>
                              <div>
                                <div className="font-medium">
                                  {item.company_name || item.symbol}
                                </div>
                                {item.industry && (
                                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                                    {item.industry}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-right mono">{money(item.last_price)}</td>
                          <td
                            className={`px-3 py-4 text-right mono font-semibold ${
                              positive
                                ? 'text-[var(--color-accent)]'
                                : 'text-[var(--color-danger)]'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {positive ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                              {percent(item.expected_return, true)}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-right mono">
                            {percent(item.probability_up)}
                          </td>
                          <td className="px-3 py-4 text-right mono">
                            {percent(item.validation_accuracy)}
                          </td>
                          <td className="px-3 py-4 text-right mono">
                            {percent(item.volatility)}
                          </td>
                          <td className="px-3 py-4 text-right">
                            <span className="inline-flex rounded-lg bg-white/5 border border-[var(--color-line)] px-2.5 py-1 mono font-semibold">
                              {item.score.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-right">
                            <Link
                              to={forecastLink}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-[var(--color-accent)] hover:bg-[rgba(61,222,168,.08)] transition"
                            >
                              Full forecast <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-14">
                <ArrowUpDown className="h-7 w-7 text-[var(--color-muted)] mx-auto" />
                <p className="mt-3 text-sm font-medium">No stocks match these filters</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Try a broader search or include both forecast directions.
                </p>
              </div>
            )}
          </Card>

          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Scanner scores combine forecast direction, historical validation and recent
            volatility. They are relative research signals, not recommendations or guaranteed
            returns.
          </p>
        </>
      )}
    </div>
  )
}
