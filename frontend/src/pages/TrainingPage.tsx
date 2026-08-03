import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Stock, TrainingJob } from '../types'
import { Badge, Button, Card, ErrorBox } from '../components/ui'
import { useToast } from '../components/ux'

const ALGOS = ['logistic_regression', 'random_forest', 'xgboost']
const DEFAULT_SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'SBIN']

export function TrainingPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS)
  const [algorithms, setAlgorithms] = useState<string[]>(ALGOS)
  const [horizon, setHorizon] = useState(1)
  const [trials, setTrials] = useState(15)
  const [jobId, setJobId] = useState<number | null>(null)

  const stocks = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })

  const jobs = useQuery({
    queryKey: ['training-jobs'],
    queryFn: () => api.trainingJobs() as Promise<TrainingJob[]>,
  })

  const job = useQuery({
    queryKey: ['training-job', jobId],
    queryFn: () => api.trainingJob(jobId!) as Promise<TrainingJob & { progress_detail?: any }>,
    enabled: jobId != null,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'running' || s === 'pending' ? 2000 : false
    },
  })

  useEffect(() => {
    if (job.data?.status === 'completed') {
      toast.push('Training completed')
      qc.invalidateQueries({ queryKey: ['models'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['training-jobs'] })
      qc.invalidateQueries({ queryKey: ['experiments'] })
    }
    if (job.data?.status === 'failed') {
      toast.push(job.data.error_message || 'Training failed', 'err')
    }
  }, [job.data?.status])

  const trainMut = useMutation({
    mutationFn: () =>
      api.train({
        symbols,
        algorithms,
        optuna_trials: trials,
        prediction_horizon: horizon,
      }) as Promise<TrainingJob>,
    onSuccess: (data) => {
      setJobId(data.id)
      toast.push(`Training job #${data.id} started`)
    },
    onError: (e: Error) => toast.push(e.message, 'err'),
  })

  const detail = (job.data as any)?.progress_detail

  return (
    <div className="space-y-6">
      <Card title="Model Training" subtitle="Configure horizon, symbols, algorithms and Optuna trials">
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-[var(--color-muted)]">Stocks ({symbols.length} selected)</div>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-[var(--color-accent-2)] hover:underline"
                  onClick={() => setSymbols((stocks.data ?? []).map((s) => s.symbol))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-[var(--color-muted)] hover:underline"
                  onClick={() => setSymbols([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-muted)] mb-2 leading-relaxed">
              Universe = archive CSV filenames only. First full-universe train may take several minutes
              while features generate.
            </p>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {(stocks.data ?? []).map((s) => {
                const on = symbols.includes(s.symbol)
                return (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() =>
                      setSymbols((prev) =>
                        on ? prev.filter((x) => x !== s.symbol) : [...prev, s.symbol],
                      )
                    }
                    className={`rounded-lg px-2 py-1 border text-xs mono ${
                      on
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                        : 'border-[var(--color-line)] text-[var(--color-muted)]'
                    }`}
                    title={s.company_name || s.symbol}
                  >
                    {s.symbol}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[var(--color-muted)] mb-2">Models</div>
              <div className="flex flex-wrap gap-2">
                {ALGOS.map((a) => {
                  const on = algorithms.includes(a)
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() =>
                        setAlgorithms((prev) =>
                          on ? prev.filter((x) => x !== a) : [...prev, a],
                        )
                      }
                      className={`rounded-lg px-2 py-1 border text-xs ${
                        on
                          ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                          : 'border-[var(--color-line)] text-[var(--color-muted)]'
                      }`}
                    >
                      {a}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="block">
              <span className="text-[var(--color-muted)]">Prediction horizon (days)</span>
              <select
                className="mt-1 w-full rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                {[1, 3, 5].map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[var(--color-muted)]">Optuna trials</span>
              <input
                type="number"
                min={3}
                max={100}
                className="mt-1 w-full rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
                value={trials}
                onChange={(e) => setTrials(Number(e.target.value))}
              />
            </label>
            <Button
              onClick={() => trainMut.mutate()}
              disabled={trainMut.isPending || symbols.length === 0 || algorithms.length === 0}
            >
              {trainMut.isPending ? 'Starting…' : 'Train'}
            </Button>
            {trainMut.isError && <ErrorBox message={(trainMut.error as Error).message} />}
          </div>
        </div>
      </Card>

      {(job.data || trainMut.data) && (
        <Card title="Training Progress">
          <div className="flex items-center gap-2 mb-3">
            <Badge
              tone={
                job.data?.status === 'completed'
                  ? 'up'
                  : job.data?.status === 'failed'
                    ? 'down'
                    : 'neutral'
              }
            >
              {job.data?.status ?? 'pending'}
            </Badge>
            <span className="mono text-sm text-[var(--color-muted)]">
              job #{job.data?.id ?? trainMut.data?.id}
            </span>
          </div>
          <p className="text-sm text-[var(--color-muted)] mb-3">
            {job.data?.progress ?? 'Queued'}
          </p>
          {detail && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="glass rounded-xl p-3">
                <div className="text-xs text-[var(--color-muted)]">Progress</div>
                <div className="mono">{detail.pct ?? 0}%</div>
              </div>
              <div className="glass rounded-xl p-3">
                <div className="text-xs text-[var(--color-muted)]">Fold</div>
                <div className="mono">
                  {detail.fold ?? '—'} / {detail.n_folds ?? '—'}
                </div>
              </div>
              <div className="glass rounded-xl p-3">
                <div className="text-xs text-[var(--color-muted)]">Trial</div>
                <div className="mono">
                  {detail.trial ?? '—'} / {detail.n_trials ?? '—'}
                </div>
              </div>
              <div className="glass rounded-xl p-3">
                <div className="text-xs text-[var(--color-muted)]">ETA (s)</div>
                <div className="mono">{detail.eta_seconds ?? '—'}</div>
              </div>
            </div>
          )}
          {detail?.pct != null && (
            <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)]"
                style={{ width: `${detail.pct}%` }}
              />
            </div>
          )}
          {job.data?.error_message && <div className="mt-3"><ErrorBox message={job.data.error_message} /></div>}
        </Card>
      )}

      <Card title="Training History">
        <div className="space-y-2 text-sm">
          {(jobs.data ?? []).slice(0, 8).map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between rounded-xl border border-[var(--color-line)] px-3 py-2"
            >
              <span className="mono">#{j.id}</span>
              <Badge tone={j.status === 'completed' ? 'up' : j.status === 'failed' ? 'down' : 'neutral'}>
                {j.status}
              </Badge>
              <span className="text-[var(--color-muted)] text-xs truncate max-w-[40%]">
                {(j.config as any)?.prediction_horizon
                  ? `h=${(j.config as any).prediction_horizon}`
                  : ''}{' '}
                {j.progress}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
