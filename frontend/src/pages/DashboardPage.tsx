import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Info, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import type { OhlcvBar, Prediction, Stock } from '../types'
import { CandlestickChart, PriceVolumeChart } from '../components/charts'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { PageSkeleton, useToast } from '../components/ux'

const money = (n?: number) => n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

export function DashboardPage() {
  const toast = useToast()
  const [symbol, setSymbol] = useState('RELIANCE')
  const [horizon, setHorizon] = useState(5)

  const stocks = useQuery({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const barsQuery = useQuery({
    queryKey: ['ohlcv', symbol],
    queryFn: () => api.ohlcv(symbol, { limit: 500 }) as Promise<OhlcvBar[]>,
  })
  const prediction = useMutation({
    mutationFn: () => api.predict({ symbol, prediction_horizon: horizon }) as Promise<Prediction>,
    onSuccess: () => toast.push('Outlook is ready'),
    onError: (e: Error) => toast.push(e.message, 'err'),
  })

  const bars = barsQuery.data ?? []
  const chartBars = bars.slice(-180)
  const latest = bars[bars.length - 1]
  const previous = bars[bars.length - 2]
  const change = latest && previous ? latest.close - previous.close : 0
  const changePct = latest && previous ? (change / previous.close) * 100 : 0
  const high52 = bars.length ? Math.max(...bars.slice(-252).map((b) => b.high)) : undefined
  const low52 = bars.length ? Math.min(...bars.slice(-252).map((b) => b.low)) : undefined
  const company = stocks.data?.find((s) => s.symbol === symbol)
  const result = prediction.data
  const bullish = (result?.probability_up ?? 0.5) >= 0.5

  const outlookCopy = useMemo(() => {
    if (!result) return ''
    const strength = result.confidence >= .5 ? 'strong' : result.confidence >= .25 ? 'moderate' : 'cautious'
    return `The ${horizon}-session outlook is ${strength} and ${bullish ? 'constructive' : 'defensive'}, based on the price and volume patterns available through ${result.as_of_date}.`
  }, [result, horizon, bullish])

  return (
    <div className="space-y-6">
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] text-[var(--color-accent)] mb-3">
            <Sparkles className="h-3.5 w-3.5" /> AI-powered outlook
          </div>
          <h1 className="display text-3xl md:text-5xl font-bold tracking-tight">Where could this stock go next?</h1>
          <p className="text-[var(--color-muted)] mt-3 max-w-2xl">
            Choose a NIFTY stock and time horizon. Nexus studies its historical behaviour and returns a clear, instant market outlook.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
          Historical analysis · No trading execution
        </div>
      </section>

      <Card>
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <label className="block">
            <span className="text-xs text-[var(--color-muted)] block mb-2">Search stock</span>
            <span className="relative block">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--color-muted)]" />
              <select className="market-input pl-10 w-full" value={symbol} onChange={(e) => { setSymbol(e.target.value); prediction.reset() }}>
                {(stocks.data ?? []).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}{s.company_name ? ` — ${s.company_name}` : ''}</option>)}
              </select>
            </span>
          </label>
          <label>
            <span className="text-xs text-[var(--color-muted)] block mb-2">Forecast horizon</span>
            <select className="market-input min-w-48" value={horizon} onChange={(e) => { setHorizon(Number(e.target.value)); prediction.reset() }}>
              <option value={1}>Next session</option>
              <option value={3}>Next 3 sessions</option>
              <option value={5}>Next 5 sessions</option>
            </select>
          </label>
          <Button onClick={() => prediction.mutate()} disabled={prediction.isPending}>
            {prediction.isPending ? 'Analyzing market…' : 'Generate outlook'}
          </Button>
        </div>
      </Card>

      {barsQuery.isLoading && <PageSkeleton />}
      {barsQuery.error && <ErrorBox message={(barsQuery.error as Error).message} />}

      {latest && (
        <>
          <section className="grid lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="display text-2xl font-bold">{company?.company_name || symbol}</h2>
                <Badge>{symbol}</Badge>
                {company?.industry && <span className="text-xs text-[var(--color-muted)]">{company.industry}</span>}
              </div>
              <div className="flex items-end gap-3 mt-2">
                <span className="mono text-3xl font-semibold">{money(latest.close)}</span>
                <span className={`flex items-center gap-1 text-sm mb-1 ${change >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'}`}>
                  {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {money(Math.abs(change))} ({pct(changePct)})
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-1">Last historical close · {latest.date}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><span className="text-xs text-[var(--color-muted)] block">52W high</span><span className="mono">{money(high52)}</span></div>
              <div><span className="text-xs text-[var(--color-muted)] block">52W low</span><span className="mono">{money(low52)}</span></div>
              <div><span className="text-xs text-[var(--color-muted)] block">Day high</span><span className="mono">{money(latest.high)}</span></div>
              <div><span className="text-xs text-[var(--color-muted)] block">Volume</span><span className="mono">{latest.volume.toLocaleString('en-IN')}</span></div>
            </div>
          </section>

          <Card title="Price history" subtitle="Last 180 available trading sessions" action={<Badge>Daily</Badge>}>
            <CandlestickChart data={chartBars} />
            <div className="border-t border-[var(--color-line)] pt-4 mt-2"><PriceVolumeChart data={chartBars} /></div>
          </Card>
        </>
      )}

      {prediction.isError && <ErrorBox message={(prediction.error as Error).message} />}
      {result && (
        <section className={`outlook-panel ${bullish ? 'outlook-up' : 'outlook-down'}`}>
          <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-xs uppercase tracking-[.18em] text-[var(--color-muted)]">Nexus outlook</span>
                <Badge tone={bullish ? 'up' : 'down'}>{bullish ? 'Positive bias' : 'Negative bias'}</Badge>
                <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]"><CalendarDays className="h-3.5 w-3.5" /> {horizon} trading {horizon === 1 ? 'session' : 'sessions'}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`h-14 w-14 rounded-2xl flex items-center justify-center ${bullish ? 'bg-[rgba(61,222,168,.12)] text-[var(--color-accent)]' : 'bg-[rgba(240,113,120,.12)] text-[var(--color-danger)]'}`}>
                  {bullish ? <ArrowUpRight className="h-7 w-7" /> : <ArrowDownRight className="h-7 w-7" />}
                </span>
                <div>
                  <h3 className="display text-3xl font-bold">{bullish ? 'Potential upward movement' : 'Potential downward pressure'}</h3>
                  <p className="text-[var(--color-muted)] mt-1">{outlookCopy}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-7">
                <div className="metric-tile"><span>Probability of rise</span><strong>{Math.round(result.probability_up * 100)}%</strong></div>
                <div className="metric-tile"><span>Signal confidence</span><strong>{Math.round(result.confidence * 100)}%</strong></div>
                <div className="metric-tile"><span>Data through</span><strong className="!text-base">{result.as_of_date}</strong></div>
              </div>
            </div>
            <div className="confidence-ring" style={{ '--score': `${result.probability_up * 360}deg` } as React.CSSProperties}>
              <div><strong>{Math.round(result.probability_up * 100)}%</strong><span>upside probability</span></div>
            </div>
          </div>
          <div className="mt-7 pt-5 border-t border-white/10 flex gap-2 text-xs text-[var(--color-muted)]">
            <Info className="h-4 w-4 shrink-0" />
            This is a statistical outlook from historical data, not a guaranteed target or investment recommendation.
          </div>
        </section>
      )}

      {!result && !prediction.isPending && (
        <div className="text-center py-5 text-sm text-[var(--color-muted)]">
          Select a stock and generate an outlook to see its possible direction. <ArrowRight className="inline h-4 w-4" />
        </div>
      )}
    </div>
  )
}
