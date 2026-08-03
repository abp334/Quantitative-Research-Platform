import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ModelArtifact, Stock } from '../types'
import { EquityCurveChart } from '../components/charts'
import { Button, Callout, Card, ErrorBox } from '../components/ui'
import { useToast } from '../components/ux'
import { formatScore } from '../lib/financeGlossary'

export function BacktestPage() {
  const toast = useToast()
  const [symbol, setSymbol] = useState('RELIANCE')
  const [modelId, setModelId] = useState<number | undefined>()
  const [threshold, setThreshold] = useState(0.15)

  const stocks = useQuery({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const models = useQuery({ queryKey: ['models'], queryFn: () => api.models() as Promise<ModelArtifact[]> })

  const ranked = useMemo(() => {
    const list = [...(models.data ?? [])]
    list.sort((a, b) => {
      const aucA = a.metrics?.find((m) => m.fold === -1)?.roc_auc ?? -1
      const aucB = b.metrics?.find((m) => m.fold === -1)?.roc_auc ?? -1
      return Number(aucB) - Number(aucA)
    })
    return list
  }, [models.data])

  const selectedId = modelId ?? ranked[0]?.id
  const selected = ranked.find((m) => m.id === selectedId)

  const mut = useMutation({
    mutationFn: () =>
      api.backtest({
        symbol,
        model_id: selectedId,
        confidence_threshold: threshold,
      }) as Promise<any>,
    onSuccess: () => toast.push('Backtest complete'),
    onError: (e: Error) => toast.push(e.message, 'err'),
  })

  const result = mut.data

  return (
    <div className="space-y-6">
      <Card
        title="Historical Strategy Evaluation"
        subtitle="Only trade days where model conviction clears your bar — illustrative, not advice"
      >
        <Callout>
          <strong className="text-[var(--color-text)]">Conviction</strong> = how far P(UP) is from 50/50
          (0 = coin flip, 1 = certain). Short-horizon models usually live in the 0.1–0.4 band, so a
          threshold of 0.55 often produces <em>zero</em> signals. Start around <strong className="text-[var(--color-text)]">0.20–0.30</strong>,
          then raise it once you see how many trades fire.
        </Callout>

        <div className="mt-4 flex flex-wrap gap-3 items-end">
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
          <label className="text-sm min-w-[14rem]">
            <span className="block text-[var(--color-muted)] mb-1">Model</span>
            <select
              className="w-full rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
              value={selectedId ?? ''}
              onChange={(e) => setModelId(Number(e.target.value))}
            >
              {ranked.map((m) => {
                const agg = m.metrics?.find((x) => x.fold === -1)
                const h = Number(m.prediction_horizon ?? m.meta?.prediction_horizon ?? 1)
                return (
                  <option key={m.id} value={m.id}>
                    #{m.id} {m.algorithm.replace(/_/g, ' ')} · {h}d · AUC{' '}
                    {formatScore(agg?.roc_auc)}
                  </option>
                )
              })}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-[var(--color-muted)] mb-1">
              Min conviction ({threshold.toFixed(2)})
            </span>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              className="w-40 accent-[var(--color-accent)]"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <div className="flex gap-2 mt-1 text-[11px] text-[var(--color-muted)]">
              {[0.05, 0.15, 0.25, 0.35].map((v) => (
                <button
                  key={v}
                  type="button"
                  className="hover:text-[var(--color-accent)]"
                  onClick={() => setThreshold(v)}
                >
                  {v.toFixed(2)}
                </button>
              ))}
            </div>
          </label>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !selectedId}>
            {mut.isPending ? 'Running…' : 'Run Backtest'}
          </Button>
        </div>

        {selected && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Using {selected.algorithm.replace(/_/g, ' ')} · horizon{' '}
            {Number(selected.prediction_horizon ?? selected.meta?.prediction_horizon ?? 1)}d. Higher
            conviction → fewer trades, hopefully cleaner hit-rate.
          </p>
        )}

        {mut.isError && (
          <div className="mt-4">
            <ErrorBox message={(mut.error as Error).message} />
          </div>
        )}
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {[
              ['Accuracy on signals', result.metrics.prediction_accuracy?.toFixed?.(3)],
              ['Win rate', result.metrics.win_rate?.toFixed?.(3)],
              ['Signals', result.metrics.n_signals],
              ['Max drawdown', result.metrics.max_drawdown?.toFixed?.(3)],
              ['Cum. return', result.metrics.cumulative_return?.toFixed?.(3)],
            ].map(([k, v]) => (
              <div key={String(k)} className="glass rounded-xl p-3">
                <div className="text-xs text-[var(--color-muted)]">{k}</div>
                <div className="mono mt-1">{String(v)}</div>
              </div>
            ))}
          </div>
          <Card
            title="Equity curve"
            subtitle={`Threshold ${result.confidence_threshold} · avg conviction on signals ${result.metrics.avg_confidence?.toFixed?.(2) ?? '—'}`}
          >
            <EquityCurveChart data={result.equity_curve || []} />
          </Card>
        </>
      )}
    </div>
  )
}
