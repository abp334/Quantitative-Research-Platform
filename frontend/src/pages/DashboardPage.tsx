import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Badge, Card, ErrorBox, Stat } from '../components/ui'
import { PageSkeleton } from '../components/ux'

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard() as Promise<any>,
    refetchInterval: 8000,
  })

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorBox message={(error as Error).message} />
  if (!data) return null

  return (
    <div className="space-y-6">
      <Card title="How to arrive at a decision" subtitle="Recommended research path — capital stays your call">
        <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm list-none p-0 m-0">
          {[
            {
              n: '1',
              t: 'Train / pick a model',
              d: 'Training builds classifiers. Models shows which one ranks best on ROC AUC.',
              to: '/app/models',
              link: 'Model quality',
            },
            {
              n: '2',
              t: 'Get a research stance',
              d: 'Decide page → stock + horizon → clear lean (constructive / defensive / no edge) + checklist.',
              to: '/app/predict',
              link: 'Open Decide',
            },
            {
              n: '3',
              t: 'Confirm on the chart',
              d: 'Data Explorer: does price action agree with the lean? Skip if the picture fights the model.',
              to: '/app/data',
              link: 'Data Explorer',
            },
            {
              n: '4',
              t: 'Stress-test, then size',
              d: 'Backtest the idea historically. Only then apply your risk rules — this app never places trades.',
              to: '/app/backtest',
              link: 'Backtesting',
            },
          ].map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-[var(--color-line)] bg-white/[0.02] px-4 py-3"
            >
              <div className="text-xs mono text-[var(--color-accent)] mb-1">Step {s.n}</div>
              <div className="font-medium mb-1">{s.t}</div>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed mb-2">{s.d}</p>
              <Link className="text-xs text-[var(--color-accent-2)] hover:underline" to={s.to}>
                {s.link} →
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Stocks" value={data.stock_count} />
        <Stat label="Historical Records" value={Number(data.bar_count).toLocaleString()} />
        <Stat label="Models Trained" value={data.model_count} />
        <Stat label="Predictions" value={data.prediction_count} />
        <Stat
          label="Avg Accuracy"
          value={data.average_accuracy != null ? data.average_accuracy.toFixed(3) : '—'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Best Model" subtitle="Ranked by ROC AUC then F1">
          {data.best_model ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge tone="up">{data.best_model.algorithm}</Badge>
                <span className="mono text-[var(--color-muted)]">#{data.best_model.id}</span>
              </div>
              <Link className="text-[var(--color-accent)] text-sm" to="/app/models">
                View comparison →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Train models to crown a best performer.
            </p>
          )}
        </Card>

        <Card title="Latest research call">
          {data.latest_prediction ? (
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="mono font-semibold">{data.latest_prediction.symbol}</span>
                <Badge tone={data.latest_prediction.label === 'UP' ? 'up' : 'down'}>
                  {data.latest_prediction.label === 'UP' ? 'Bullish lean' : 'Bearish lean'}
                </Badge>
              </div>
              <p className="text-[var(--color-muted)] text-xs leading-relaxed">
                {data.latest_prediction.summary_text || '—'}
              </p>
              <Link className="text-[var(--color-accent)] text-sm" to="/app/predict">
                Run a new decision brief →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              No calls yet.{' '}
              <Link className="text-[var(--color-accent)]" to="/app/predict">
                Start on Decide
              </Link>
            </p>
          )}
        </Card>

        <Card title="System Status">
          <Badge tone={data.system_status === 'ok' ? 'up' : 'neutral'}>
            {data.system_status}
          </Badge>
          <p className="text-sm text-[var(--color-muted)] mt-3">
            Latest job:{' '}
            {data.latest_training_job
              ? `#${data.latest_training_job.id} ${data.latest_training_job.status}`
              : 'none'}
          </p>
        </Card>
      </div>

      <Card title="Recent Activity">
        <ul className="space-y-2 text-sm">
          {(data.recent_activity || []).map((a: any, i: number) => (
            <li
              key={i}
              className="flex justify-between gap-3 border-b border-[var(--color-line)]/50 py-2"
            >
              <span>{a.message}</span>
              <span className="mono text-xs text-[var(--color-muted)]">{a.kind}</span>
            </li>
          ))}
          {!data.recent_activity?.length && (
            <li className="text-[var(--color-muted)]">Activity will appear as you train and predict.</li>
          )}
        </ul>
      </Card>
    </div>
  )
}
