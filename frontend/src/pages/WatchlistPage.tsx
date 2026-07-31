import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BookOpen, Plus, Star, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import type { ScannerItem, Stock } from '../types'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { useWatchlist } from '../lib/watchlist'

const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const percent = (value: number, signed = false) =>
  `${signed && value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

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
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="eyebrow">
            <Star className="h-4 w-4" /> Persistent research workspace
          </div>
          <h1 className="display text-3xl md:text-5xl font-bold tracking-tight mt-5">
            Your watchlist
          </h1>
          <p className="text-[var(--color-muted)] mt-3 max-w-2xl">
            Save names you care about, attach a thesis and price level, and monitor their
            forecast signals together. Everything is stored privately in this browser.
          </p>
        </div>
        <label>
          <span className="text-xs text-[var(--color-muted)] block mb-2">Signal horizon</span>
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
      </section>

      <Card>
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">
              Add a stock
            </span>
            <select
              className="market-input w-full"
              value={candidate}
              onChange={(event) => setCandidate(event.target.value)}
            >
              <option value="">Choose from the available universe…</option>
              {available.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol}
                  {stock.company_name ? ` — ${stock.company_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={addCandidate} disabled={!candidate}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add to watchlist
            </span>
          </Button>
        </div>
      </Card>

      {(stocks.isLoading || scanner.isLoading) && <PageSkeleton />}
      {stocks.error && <ErrorBox message={(stocks.error as Error).message} />}
      {scanner.error && <ErrorBox message={(scanner.error as Error).message} />}

      {!stocks.isLoading && watchlist.items.length === 0 && (
        <section className="forecast-empty">
          <Star className="h-8 w-8 text-[var(--color-warning)] mx-auto" />
          <h2 className="display text-2xl font-semibold mt-4">Start a living research list</h2>
          <p className="text-sm text-[var(--color-muted)] max-w-xl mx-auto mt-2">
            Add a stock above or use the star button anywhere in Market Pulse, Scanner, or a
            forecast.
          </p>
        </section>
      )}

      {watchlist.items.length > 0 && (
        <section className="grid xl:grid-cols-2 gap-5">
          {watchlist.items.map((saved) => {
            const signal = scannerBySymbol.get(saved.symbol)
            const thesisDistance =
              signal && saved.thesisPrice
                ? saved.thesisPrice / signal.last_price - 1
                : null
            return (
              <article className="watchlist-card" key={saved.symbol}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={(signal?.expected_return ?? 0) >= 0 ? 'up' : 'down'}>
                        {saved.symbol}
                      </Badge>
                      {saved.industry && (
                        <span className="text-xs text-[var(--color-muted)]">{saved.industry}</span>
                      )}
                    </div>
                    <h2 className="display text-xl font-semibold mt-3">
                      {saved.companyName || saved.symbol}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="icon-button-danger"
                    onClick={() => watchlist.remove(saved.symbol)}
                    title="Remove from watchlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                  <div className="watch-metric">
                    <span>Last price</span>
                    <strong>{signal ? money(signal.last_price) : '—'}</strong>
                  </div>
                  <div className="watch-metric">
                    <span>Expected</span>
                    <strong
                      className={
                        (signal?.expected_return ?? 0) >= 0
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-danger)]'
                      }
                    >
                      {signal ? percent(signal.expected_return, true) : '—'}
                    </strong>
                  </div>
                  <div className="watch-metric">
                    <span>P(up)</span>
                    <strong>{signal ? percent(signal.probability_up) : '—'}</strong>
                  </div>
                  <div className="watch-metric">
                    <span>Score</span>
                    <strong>{signal ? signal.score.toFixed(1) : '—'}</strong>
                  </div>
                </div>

                <div className="grid md:grid-cols-[160px_1fr] gap-3 mt-4">
                  <label>
                    <span className="text-xs text-[var(--color-muted)] block mb-1.5">
                      Your thesis price
                    </span>
                    <input
                      className="market-input w-full !pr-3"
                      type="number"
                      min="0"
                      step="0.05"
                      value={saved.thesisPrice ?? ''}
                      placeholder="Optional"
                      onChange={(event) =>
                        watchlist.update(saved.symbol, {
                          thesisPrice: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span className="text-xs text-[var(--color-muted)] block mb-1.5">
                      Research note
                    </span>
                    <input
                      className="market-input w-full !pr-3"
                      value={saved.note}
                      placeholder="What would confirm or break your thesis?"
                      onChange={(event) =>
                        watchlist.update(saved.symbol, { note: event.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[var(--color-line)]">
                  <span className="text-xs text-[var(--color-muted)]">
                    {thesisDistance == null
                      ? 'Add a thesis price to track distance from the archive close.'
                      : `${percent(thesisDistance, true)} from the archive close`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/app/market?symbol=${encodeURIComponent(saved.symbol)}`}
                      className="small-action"
                    >
                      <BookOpen className="h-3.5 w-3.5" /> Chart
                    </Link>
                    <Link
                      to={`/app?symbol=${encodeURIComponent(saved.symbol)}&horizon=${horizon}`}
                      className="small-action text-[var(--color-accent)]"
                    >
                      Forecast <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
