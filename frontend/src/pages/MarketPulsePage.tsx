import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowUpRight, CalendarClock, Radar, ShieldAlert } from 'lucide-react'
import { api } from '../api/client'
import type { ScannerItem } from '../types'
import { Badge, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { WatchlistButton } from '../components/WatchlistButton'

const pct = (v: number, signed = false) => `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

type IndustryPulse = { name: string; count: number; score: number; expectedReturn: number; positiveShare: number }

export function MarketPulsePage() {
  const [horizon, setHorizon] = useState(5)
  const scanner = useQuery<ScannerItem[]>({
    queryKey: ['market-scanner', horizon],
    queryFn: () => api.scanner(horizon) as Promise<ScannerItem[]>,
    staleTime: 5 * 60_000,
  })

  const pulse = useMemo(() => {
    const rows = scanner.data ?? []
    const positive = rows.filter((i) => i.expected_return >= 0)
    const highConviction = rows.filter((i) => i.probability_up >= 0.62 || i.probability_up <= 0.38)
    const industries = new Map<string, ScannerItem[]>()
    rows.forEach((item) => {
      const key = item.industry || 'Unclassified'
      industries.set(key, [...(industries.get(key) ?? []), item])
    })
    const industryPulse: IndustryPulse[] = [...industries.entries()]
      .map(([name, members]) => ({
        name, count: members.length,
        score: members.reduce((s, i) => s + i.score, 0) / members.length,
        expectedReturn: members.reduce((s, i) => s + i.expected_return, 0) / members.length,
        positiveShare: members.filter((i) => i.expected_return >= 0).length / members.length,
      }))
      .sort((a, b) => b.score - a.score)

    const sortedReturn = [...rows].sort((a, b) => b.expected_return - a.expected_return)
    return {
      positiveCount: positive.length,
      breadth: rows.length ? positive.length / rows.length : 0,
      avgReturn: rows.length ? rows.reduce((s, i) => s + i.expected_return, 0) / rows.length : 0,
      avgVolatility: rows.length ? rows.reduce((s, i) => s + i.volatility, 0) / rows.length : 0,
      highConviction: highConviction.length,
      industries: industryPulse.slice(0, 8),
      leaders: sortedReturn.slice(0, 5),
      laggards: sortedReturn.slice(-5).reverse(),
    }
  }, [scanner.data])

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-tag"><Activity style={{ width: 14, height: 14 }} /> Market Pulse</div>
          <h1>Market Breadth & Leadership</h1>
          <p className="page-desc">See whether opportunity is broad or concentrated, which industries lead, and where conviction is strongest.</p>
        </div>
        <label>
          <span className="form-label">Horizon</span>
          <select className="form-select" style={{ minWidth: 180 }} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            <option value={5}>5 sessions</option>
            <option value={10}>10 sessions</option>
            <option value={20}>20 sessions</option>
          </select>
        </label>
      </div>

      {scanner.isLoading && <PageSkeleton />}
      {scanner.error && <ErrorBox message={(scanner.error as Error).message} />}

      {scanner.data && (
        <>
          <div className="data-notice">
            <CalendarClock style={{ width: 18, height: 18 }} />
            <div><strong>Historical snapshot</strong> <span className="data-notice-text">Data through {scanner.data[0]?.as_of_date ?? 'archive date'}.</span></div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Forecast Breadth</div>
                <div className="mono" style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>{pct(pulse.breadth)}</div>
              </div>
              <Badge tone={pulse.breadth >= 0.6 ? 'up' : pulse.breadth < 0.4 ? 'down' : 'neutral'}>
                {pulse.breadth >= 0.6 ? 'Broadly Constructive' : pulse.breadth < 0.4 ? 'Broadly Defensive' : 'Mixed'}
              </Badge>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              {pulse.positiveCount} of {scanner.data.length} stocks have a positive base estimate.
            </p>
            <div className="breadth-bar">
              <div className="breadth-bar-fill" style={{ width: `${pulse.breadth * 100}%` }} />
              <div className="breadth-bar-mid" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="metric-tile">
              <span className="metric-label">Avg Expected Return</span>
              <span className={`metric-value ${pulse.avgReturn >= 0 ? 'text-green' : 'text-red'}`}>{pct(pulse.avgReturn, true)}</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">High-Conviction Signals</span>
              <span className="metric-value">{pulse.highConviction}</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Avg Annual Volatility</span>
              <span className="metric-value">{pct(pulse.avgVolatility)}</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Industries Represented</span>
              <span className="metric-value">{pulse.industries.length}</span>
            </div>
          </div>

          <div className="grid xl:grid-cols-[1.1fr_.9fr] gap-4">
            <Card title="Industry Leadership" subtitle="Average forecast score by sector">
              {pulse.industries.map((ind) => (
                <div className="industry-row" key={ind.name}>
                  <div>
                    <strong>{ind.name}</strong>
                    <div className="industry-count">{ind.count} stocks</div>
                  </div>
                  <div className="industry-bar">
                    <div className={`industry-bar-fill ${ind.expectedReturn < 0 ? 'down' : ''}`} style={{ width: `${Math.max(4, ind.positiveShare * 100)}%` }} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong className={ind.expectedReturn >= 0 ? 'text-green' : 'text-red'}>{pct(ind.expectedReturn, true)}</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Score {ind.score.toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </Card>

            <Card title="Leaders & Laggards" subtitle="Highest and lowest expected returns">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Top performers</div>
                  {pulse.leaders.map((item) => (
                    <PulseStockRow key={item.symbol} item={item} horizon={horizon} />
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Weakest outlooks</div>
                  {pulse.laggards.map((item) => (
                    <PulseStockRow key={item.symbol} item={item} horizon={horizon} />
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link to={`/app/scanner?horizon=${horizon}`} className="btn btn-primary">
              <Radar style={{ width: 16, height: 16 }} /> Open Full Scanner
            </Link>
            <Link to="/app/compare" className="btn btn-ghost">
              <ShieldAlert style={{ width: 16, height: 16 }} /> Compare Leaders
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function PulseStockRow({ item, horizon }: { item: ScannerItem; horizon: number }) {
  const up = item.expected_return >= 0
  return (
    <div className="pulse-stock">
      <Link to={`/app?symbol=${item.symbol}&horizon=${horizon}`} style={{ flex: 1, textDecoration: 'none', color: 'var(--text-primary)' }}>
        <strong>{item.symbol}</strong>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.company_name || item.industry || 'NIFTY'}</span>
      </Link>
      <span className={`mono ${up ? 'text-green' : 'text-red'}`} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
        {up ? <ArrowUpRight style={{ width: 14, height: 14 }} /> : <ArrowDownRight style={{ width: 14, height: 14 }} />}
        {pct(item.expected_return, true)}
      </span>
      <WatchlistButton stock={item} compact />
    </div>
  )
}
