import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Layers3,
  Radar,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { api } from '../api/client'
import type { ScannerItem } from '../types'
import { Badge, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'

const percent = (value: number, signed = false) =>
  `${signed && value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`

type IndustryPulse = {
  name: string
  count: number
  score: number
  expectedReturn: number
  positiveShare: number
}

export function MarketPulsePage() {
  const [horizon, setHorizon] = useState(5)
  const scanner = useQuery<ScannerItem[]>({
    queryKey: ['market-scanner', horizon],
    queryFn: () => api.scanner(horizon) as Promise<ScannerItem[]>,
    staleTime: 5 * 60_000,
  })

  const pulse = useMemo(() => {
    const rows = scanner.data ?? []
    const positive = rows.filter((item) => item.expected_return >= 0)
    const highConviction = rows.filter(
      (item) => item.probability_up >= 0.62 || item.probability_up <= 0.38,
    )
    const industries = new Map<string, ScannerItem[]>()
    rows.forEach((item) => {
      const key = item.industry || 'Unclassified'
      industries.set(key, [...(industries.get(key) ?? []), item])
    })
    const industryPulse: IndustryPulse[] = [...industries.entries()]
      .map(([name, members]) => ({
        name,
        count: members.length,
        score: members.reduce((sum, item) => sum + item.score, 0) / members.length,
        expectedReturn:
          members.reduce((sum, item) => sum + item.expected_return, 0) / members.length,
        positiveShare:
          members.filter((item) => item.expected_return >= 0).length / members.length,
      }))
      .sort((a, b) => b.score - a.score)

    const sortedReturn = [...rows].sort((a, b) => b.expected_return - a.expected_return)
    return {
      positiveCount: positive.length,
      breadth: rows.length ? positive.length / rows.length : 0,
      averageReturn: rows.length
        ? rows.reduce((sum, item) => sum + item.expected_return, 0) / rows.length
        : 0,
      averageVolatility: rows.length
        ? rows.reduce((sum, item) => sum + item.volatility, 0) / rows.length
        : 0,
      highConviction: highConviction.length,
      industryCount: industryPulse.length,
      leaders: sortedReturn.slice(0, 3),
      laggards: sortedReturn.slice(-3).reverse(),
      industries: industryPulse.slice(0, 8),
    }
  }, [scanner.data])

  return (
    <div className="space-y-6">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="eyebrow">
            <Activity className="h-4 w-4" /> Cross-sectional intelligence
          </div>
          <h1 className="display text-3xl md:text-5xl font-bold tracking-tight mt-5">
            Market pulse
          </h1>
          <p className="text-[var(--color-muted)] mt-3 max-w-2xl leading-relaxed">
            See whether opportunity is broad or concentrated, which industries lead, and where
            forecast conviction is strongest across the entire archive universe.
          </p>
        </div>
        <label>
          <span className="text-xs text-[var(--color-muted)] block mb-2">Pulse horizon</span>
          <select
            className="market-input min-w-48"
            value={horizon}
            onChange={(event) => setHorizon(Number(event.target.value))}
          >
            <option value={5}>5 trading sessions</option>
            <option value={10}>10 trading sessions</option>
            <option value={20}>20 trading sessions</option>
          </select>
        </label>
      </section>

      {scanner.isLoading && <PageSkeleton />}
      {scanner.error && <ErrorBox message={(scanner.error as Error).message} />}

      {scanner.data && (
        <>
          <div className="stale-data-notice">
            <CalendarClock className="h-5 w-5 shrink-0" />
            <div>
              <strong>Historical market snapshot</strong>
              <span>
                {' '}
                Breadth and leadership use forecasts from data through{' '}
                {scanner.data[0]?.as_of_date ?? 'the archive end date'}, not today’s market.
              </span>
            </div>
          </div>

          <section className="pulse-hero">
            <div>
              <span className="pulse-label">Forecast breadth</span>
              <div className="flex flex-wrap items-end gap-3 mt-2">
                <strong className="mono text-4xl md:text-5xl">
                  {percent(pulse.breadth)}
                </strong>
                <Badge tone={pulse.breadth >= 0.6 ? 'up' : pulse.breadth < 0.4 ? 'down' : 'neutral'}>
                  {pulse.breadth >= 0.6
                    ? 'Broadly constructive'
                    : pulse.breadth < 0.4
                      ? 'Broadly defensive'
                      : 'Mixed market'}
                </Badge>
              </div>
              <p className="text-sm text-[var(--color-muted)] mt-3">
                {pulse.positiveCount} of {scanner.data.length} stocks have a positive base
                estimate over the selected horizon.
              </p>
            </div>
            <div className="breadth-track" aria-label={`${percent(pulse.breadth)} positive`}>
              <i style={{ width: `${pulse.breadth * 100}%` }} />
              <span style={{ left: '50%' }} />
            </div>
          </section>

          <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="metric-tile">
              <span>Average expected return</span>
              <strong
                className={
                  pulse.averageReturn >= 0
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-danger)]'
                }
              >
                {percent(pulse.averageReturn, true)}
              </strong>
            </div>
            <div className="metric-tile">
              <span>High-conviction signals</span>
              <strong>{pulse.highConviction}</strong>
            </div>
            <div className="metric-tile">
              <span>Average annual volatility</span>
              <strong>{percent(pulse.averageVolatility)}</strong>
            </div>
            <div className="metric-tile">
              <span>Industries represented</span>
              <strong>{pulse.industryCount}</strong>
            </div>
          </section>

          <section className="grid xl:grid-cols-[1.08fr_.92fr] gap-6">
            <Card
              title="Industry leadership"
              subtitle="Average forecast score and breadth within each group"
              action={<Layers3 className="h-4 w-4 text-[var(--color-accent)]" />}
            >
              <div className="space-y-3">
                {pulse.industries.map((industry) => (
                  <div className="industry-row" key={industry.name}>
                    <div className="min-w-0">
                      <strong>{industry.name}</strong>
                      <span>{industry.count} stocks</span>
                    </div>
                    <div className="industry-bar">
                      <i
                        style={{ width: `${Math.max(4, industry.positiveShare * 100)}%` }}
                        className={industry.expectedReturn >= 0 ? '' : 'industry-bar-down'}
                      />
                    </div>
                    <div className="text-right">
                      <strong
                        className={
                          industry.expectedReturn >= 0
                            ? 'text-[var(--color-accent)]'
                            : 'text-[var(--color-danger)]'
                        }
                      >
                        {percent(industry.expectedReturn, true)}
                      </strong>
                      <span>score {industry.score.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="Leadership board"
              subtitle="Highest and lowest expected movement"
              action={<Radar className="h-4 w-4 text-[var(--color-accent)]" />}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] mb-2">
                    Positive leaders
                  </div>
                  <div className="space-y-2">
                    {pulse.leaders.map((item) => (
                      <PulseStockRow key={item.symbol} item={item} horizon={horizon} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] mb-2">
                    Weakest outlooks
                  </div>
                  <div className="space-y-2">
                    {pulse.laggards.map((item) => (
                      <PulseStockRow key={item.symbol} item={item} horizon={horizon} />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="flex flex-col sm:flex-row gap-4">
            <Link to={`/app/scanner?horizon=${horizon}`} className="workspace-cta">
              <Sparkles className="h-5 w-5" />
              <span>
                <strong>Open the full scanner</strong>
                <small>Filter and rank every stock</small>
              </span>
            </Link>
            <Link to="/app/compare" className="workspace-cta">
              <ShieldAlert className="h-5 w-5" />
              <span>
                <strong>Compare the leaders</strong>
                <small>Check returns, drawdowns and correlation</small>
              </span>
            </Link>
          </section>
        </>
      )}
    </div>
  )
}

function PulseStockRow({ item, horizon }: { item: ScannerItem; horizon: number }) {
  const positive = item.expected_return >= 0
  return (
    <div className="pulse-stock-row">
      <Link
        to={`/app?symbol=${encodeURIComponent(item.symbol)}&horizon=${horizon}`}
        className="min-w-0 flex-1"
      >
        <strong>{item.symbol}</strong>
        <span>{item.company_name || item.industry || 'NIFTY equity'}</span>
      </Link>
      <span
        className={`inline-flex items-center gap-1 mono text-xs ${
          positive ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'
        }`}
      >
        {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        {percent(item.expected_return, true)}
      </span>
      <WatchlistButton stock={item} compact />
    </div>
  )
}
