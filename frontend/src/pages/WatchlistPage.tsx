import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BarChart3, Plus, Star, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import type { ScannerItem, Stock } from '../types'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { useWatchlist } from '../lib/watchlist'

const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const pct = (v: number, signed = false) => `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

export function WatchlistPage() {
  const watchlist = useWatchlist()
  const [candidate, setCandidate] = useState('')
  const [horizon, setHorizon] = useState(5)

  const stocks = useQuery<Stock[]>({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })
  const scanner = useQuery<ScannerItem[]>({
    queryKey: ['market-scanner', horizon],
    queryFn: () => api.scanner(horizon) as Promise<ScannerItem[]>,
    staleTime: 5 * 60_000,
  })

  const scannerBySymbol = useMemo(
    () => new Map((scanner.data ?? []).map((item) => [item.symbol, item])),
    [scanner.data],
  )
  const available = useMemo(
    () => (stocks.data ?? []).filter((stock) => !watchlist.has(stock.symbol)),
    [stocks.data, watchlist],
  )

  const addCandidate = () => {
    const stock = (stocks.data ?? []).find((item) => item.symbol === candidate)
    if (!stock) return
    watchlist.add(stock)
    setCandidate('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-tag"><Star style={{ width: 14, height: 14 }} /> Watchlist</div>
          <h1>Research Watchlist</h1>
          <p className="page-desc">Save stocks, set price targets and thesis notes, and monitor AI forecast signals.</p>
        </div>
        <label>
          <span className="form-label">Signal Horizon</span>
          <select className="form-select" style={{ minWidth: 160 }} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            <option value={5}>5 sessions</option>
            <option value={10}>10 sessions</option>
            <option value={20}>20 sessions</option>
          </select>
        </label>
      </div>

      <Card>
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <label>
            <span className="form-label">Add Stock</span>
            <select className="form-select" value={candidate} onChange={(e) => setCandidate(e.target.value)}>
              <option value="">Choose from available NIFTY universe…</option>
              {available.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}{s.company_name ? ` — ${s.company_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={addCandidate} disabled={!candidate}>
            <Plus style={{ width: 14, height: 14 }} /> Add Stock
          </Button>
        </div>
      </Card>

      {(stocks.isLoading || scanner.isLoading) && <PageSkeleton />}
      {stocks.error && <ErrorBox message={(stocks.error as Error).message} />}
      {scanner.error && <ErrorBox message={(scanner.error as Error).message} />}

      {!stocks.isLoading && watchlist.items.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Star style={{ width: 24, height: 24 }} /></div>
          <h2>Your watchlist is empty</h2>
          <p>Add stocks above or click the Watch button on any stock forecast card.</p>
        </div>
      )}

      {watchlist.items.length > 0 && (
        <div className="grid xl:grid-cols-2 gap-4">
          {watchlist.items.map((saved) => {
            const signal = scannerBySymbol.get(saved.symbol)
            const dist = signal && saved.thesisPrice ? saved.thesisPrice / signal.last_price - 1 : null
            return (
              <div className="watchlist-card" key={saved.symbol}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={(signal?.expected_return ?? 0) >= 0 ? 'up' : 'down'}>{saved.symbol}</Badge>
                      {saved.industry && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{saved.industry}</span>}
                    </div>
                    <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, marginTop: 8 }}>
                      {saved.companyName || saved.symbol}
                    </h3>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => watchlist.remove(saved.symbol)}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2" style={{ marginTop: 16 }}>
                  <div className="watch-metric">
                    <span>Last Price</span>
                    <strong>{signal ? money(signal.last_price) : '—'}</strong>
                  </div>
                  <div className="watch-metric">
                    <span>Expected</span>
                    <strong className={(signal?.expected_return ?? 0) >= 0 ? 'text-green' : 'text-red'}>
                      {signal ? pct(signal.expected_return, true) : '—'}
                    </strong>
                  </div>
                  <div className="watch-metric">
                    <span>P(Up)</span>
                    <strong>{signal ? pct(signal.probability_up) : '—'}</strong>
                  </div>
                  <div className="watch-metric">
                    <span>Score</span>
                    <strong>{signal ? signal.score.toFixed(1) : '—'}</strong>
                  </div>
                </div>

                <div className="grid md:grid-cols-[150px_1fr] gap-3" style={{ marginTop: 14 }}>
                  <label>
                    <span className="form-label">Target Price</span>
                    <input
                      className="form-input"
                      type="number"
                      step="0.05"
                      value={saved.thesisPrice ?? ''}
                      placeholder="Optional"
                      onChange={(e) => watchlist.update(saved.symbol, { thesisPrice: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                  <label>
                    <span className="form-label">Thesis Note</span>
                    <input
                      className="form-input"
                      value={saved.note}
                      placeholder="What is your thesis or risk trigger?"
                      onChange={(e) => watchlist.update(saved.symbol, { note: e.target.value })}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {dist == null ? 'Set a target price to measure distance.' : `${pct(dist, true)} from archive price`}
                  </span>
                  <div className="flex gap-2">
                    <Link to={`/app/market?symbol=${saved.symbol}`} className="btn btn-ghost btn-sm">
                      <BarChart3 style={{ width: 12, height: 12 }} /> Chart
                    </Link>
                    <Link to={`/app?symbol=${saved.symbol}&horizon=${horizon}`} className="btn btn-primary btn-sm">
                      Forecast <ArrowUpRight style={{ width: 12, height: 12 }} />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
