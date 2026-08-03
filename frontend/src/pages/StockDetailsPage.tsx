import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { FeatureRow, OhlcvBar, Stock } from '../types'
import {
  IndicatorLineChart,
  PriceVolumeChart,
  RsiChart,
} from '../components/charts'
import { Card, ErrorBox, Loading } from '../components/ui'

export function StockDetailsPage() {
  const { symbol: routeSymbol } = useParams()
  const navigate = useNavigate()
  const [symbol, setSymbol] = useState(routeSymbol ?? 'RELIANCE')

  const stocks = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })

  const ohlcv = useQuery({
    queryKey: ['ohlcv', symbol],
    queryFn: () => api.ohlcv(symbol, { limit: 400 }) as Promise<OhlcvBar[]>,
    enabled: !!symbol,
  })

  const features = useQuery({
    queryKey: ['features', symbol],
    queryFn: () => api.symbolFeatures(symbol, 400) as Promise<FeatureRow[]>,
    enabled: !!symbol,
    retry: false,
  })

  const chartBars = useMemo(() => ohlcv.data?.slice(-180) ?? [], [ohlcv.data])

  const indicatorData = useMemo(() => {
    const rows = features.data?.slice(-180) ?? []
    return rows.map((r) => ({
      date: r.date.slice(0, 10),
      close: r.features.close_lag_1,
      bb_upper: r.features.bb_upper,
      bb_mid: r.features.bb_mid,
      bb_lower: r.features.bb_lower,
      macd: r.features.macd,
      macd_signal: r.features.macd_signal,
      macd_hist: r.features.macd_hist,
      rsi: r.features.rsi_14,
    }))
  }, [features.data])

  return (
    <div className="space-y-6">
      <Card title="Stock Details" subtitle="Price action and engineered indicators">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2 text-sm"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value)
              navigate(`/stocks/${e.target.value}`)
            }}
          >
            {(stocks.data ?? [{ symbol }]).map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol}
              </option>
            ))}
          </select>
          {stocks.data?.find((s) => s.symbol === symbol)?.company_name && (
            <span className="text-sm text-[var(--color-muted)]">
              {stocks.data.find((s) => s.symbol === symbol)?.company_name}
            </span>
          )}
        </div>
      </Card>

      <Card title={`${symbol} Price & Volume`} subtitle="Close overlay with volume">
        {ohlcv.isLoading && <Loading />}
        {ohlcv.error && <ErrorBox message={(ohlcv.error as Error).message} />}
        {chartBars.length > 0 && <PriceVolumeChart data={chartBars} />}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Bollinger Bands" subtitle="20-period, 2σ">
          {features.error && (
            <p className="text-sm text-[var(--color-muted)]">
              Generate features to unlock indicator charts.
            </p>
          )}
          {indicatorData.length > 0 && (
            <IndicatorLineChart
              data={indicatorData}
              lines={[
                { key: 'bb_upper', color: '#5b8cff', name: 'Upper' },
                { key: 'bb_mid', color: '#94a3b8', name: 'Mid' },
                { key: 'bb_lower', color: '#3ddea8', name: 'Lower' },
              ]}
            />
          )}
        </Card>
        <Card title="MACD" subtitle="12/26/9">
          {indicatorData.length > 0 && (
            <IndicatorLineChart
              data={indicatorData}
              lines={[
                { key: 'macd', color: '#3ddea8', name: 'MACD' },
                { key: 'macd_signal', color: '#e6b84d', name: 'Signal' },
                { key: 'macd_hist', color: '#5b8cff', name: 'Hist' },
              ]}
            />
          )}
        </Card>
      </div>

      <Card title="RSI (14)" subtitle="Overbought 70 / Oversold 30">
        {indicatorData.length > 0 && (
          <RsiChart data={indicatorData.map((d) => ({ date: String(d.date), rsi: d.rsi as number }))} />
        )}
      </Card>
    </div>
  )
}
