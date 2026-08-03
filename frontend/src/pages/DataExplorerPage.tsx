import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { FeatureRow, OhlcvBar, Stock } from '../types'
import {
  CandlestickChart,
  IndicatorLineChart,
  PriceVolumeChart,
  RsiChart,
} from '../components/charts'
import { Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'

export function DataExplorerPage() {
  const [symbol, setSymbol] = useState('RELIANCE')
  const [start, setStart] = useState('2018-01-01')
  const [end, setEnd] = useState('2021-04-30')

  const stocks = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })

  const ohlcv = useQuery({
    queryKey: ['ohlcv', symbol, start, end],
    queryFn: () =>
      api.ohlcv(symbol, { start, end, limit: 2000 }) as Promise<OhlcvBar[]>,
    enabled: !!symbol,
  })

  const stats = useQuery({
    queryKey: ['stats', symbol, start, end],
    queryFn: () => api.stockStats(symbol, { start, end }) as Promise<any>,
    enabled: !!symbol,
  })

  const features = useQuery({
    queryKey: ['features', symbol],
    queryFn: () => api.symbolFeatures(symbol, 500) as Promise<FeatureRow[]>,
    enabled: !!symbol,
    retry: false,
  })

  const bars = useMemo(() => ohlcv.data?.slice(-250) ?? [], [ohlcv.data])
  const indicatorData = useMemo(() => {
    return (features.data ?? [])
      .filter((r) => r.date >= start && r.date <= end)
      .slice(-250)
      .map((r) => ({
        date: r.date.slice(0, 10),
        bb_upper: r.features.bb_upper,
        bb_mid: r.features.bb_mid,
        bb_lower: r.features.bb_lower,
        macd: r.features.macd,
        macd_signal: r.features.macd_signal,
        atr: r.features.atr_14,
        sma_20: r.features.sma_20,
        daily_return: r.features.daily_return,
        rolling_volatility_20: r.features.rolling_volatility_20,
        rsi: r.features.rsi_14,
      }))
  }, [features.data, start, end])

  return (
    <div className="space-y-6">
      <Card title="Data Explorer" subtitle="Historical OHLCV, indicators and dataset diagnostics">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="block text-[var(--color-muted)] mb-1">Stock</span>
            <select
              className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {(stocks.data ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-[var(--color-muted)] mb-1">Start</span>
            <input
              type="date"
              className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block text-[var(--color-muted)] mb-1">End</span>
            <input
              type="date"
              className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
      </Card>

      {(ohlcv.isLoading || stats.isLoading) && <PageSkeleton />}
      {ohlcv.error && <ErrorBox message={(ohlcv.error as Error).message} />}

      {stats.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            ['Rows', stats.data.row_count],
            ['Outliers (|z|>3)', stats.data.outlier_count],
            ['Mean Close', stats.data.mean_close?.toFixed?.(2)],
            ['Ann. Vol', stats.data.volatility_ann?.toFixed?.(3)],
          ].map(([k, v]) => (
            <div key={String(k)} className="glass rounded-xl p-3">
              <div className="text-xs text-[var(--color-muted)]">{k}</div>
              <div className="mono mt-1">{String(v ?? '—')}</div>
            </div>
          ))}
        </div>
      )}

      <Card title={`${symbol} Candlestick`} subtitle="OHLC with close overlay">
        {bars.length > 0 && <CandlestickChart data={bars} />}
      </Card>
      <Card title="Volume">
        {bars.length > 0 && <PriceVolumeChart data={bars} />}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Bollinger Bands">
          {indicatorData.length > 0 ? (
            <IndicatorLineChart
              data={indicatorData}
              lines={[
                { key: 'bb_upper', color: '#5b8cff', name: 'Upper' },
                { key: 'bb_mid', color: '#94a3b8', name: 'Mid' },
                { key: 'bb_lower', color: '#3ddea8', name: 'Lower' },
              ]}
            />
          ) : (
            <p className="text-sm text-[var(--color-muted)]">Generate features to unlock indicators.</p>
          )}
        </Card>
        <Card title="MACD / ATR">
          {indicatorData.length > 0 && (
            <IndicatorLineChart
              data={indicatorData}
              lines={[
                { key: 'macd', color: '#3ddea8', name: 'MACD' },
                { key: 'macd_signal', color: '#e6b84d', name: 'Signal' },
                { key: 'atr', color: '#5b8cff', name: 'ATR' },
              ]}
            />
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="RSI (14)">
          {indicatorData.length > 0 && (
            <RsiChart data={indicatorData.map((d) => ({ date: String(d.date), rsi: d.rsi as number }))} />
          )}
        </Card>
        <Card title="Returns & Volatility">
          {indicatorData.length > 0 && (
            <IndicatorLineChart
              data={indicatorData}
              lines={[
                { key: 'daily_return', color: '#3ddea8', name: 'Daily return' },
                { key: 'rolling_volatility_20', color: '#e6b84d', name: 'Vol 20' },
                { key: 'sma_20', color: '#5b8cff', name: 'SMA 20' },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
