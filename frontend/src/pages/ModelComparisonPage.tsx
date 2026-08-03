import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ModelArtifact } from '../types'
import { ConfusionMatrixView, LearningCurveChart, RocChart } from '../components/charts'
import { Badge, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'

const COLORS = ['#3ddea8', '#5b8cff', '#e6b84d']

export function ModelComparisonPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['models-compare'],
    queryFn: async () =>
      (await api.compareModels()) as {
        models: ModelArtifact[]
        best_model_id?: number
        explanation?: string
      },
  })

  const models = data?.models ?? []
  const rocCurves = useMemo(
    () =>
      models
        .map((m, i) => {
          const agg = m.metrics.find((x) => x.fold === -1)
          if (!agg?.roc_curve) return null
          return {
            name: m.algorithm,
            fpr: agg.roc_curve.fpr,
            tpr: agg.roc_curve.tpr,
            color: COLORS[i % COLORS.length],
          }
        })
        .filter(Boolean) as any[],
    [models],
  )

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorBox message={(error as Error).message} />

  return (
    <div className="space-y-6">
      <Card title="Model Comparison" subtitle="Automatically ranked by ROC AUC, then F1">
        {data?.explanation && (
          <p className="text-sm text-[var(--color-accent)] mb-4">{data.explanation}</p>
        )}
        {models.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Train models to compare performance.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-line)]">
                  <th className="py-2">Rank</th>
                  <th className="py-2">Algorithm</th>
                  <th className="py-2">Horizon</th>
                  <th className="py-2">Accuracy</th>
                  <th className="py-2">Precision</th>
                  <th className="py-2">Recall</th>
                  <th className="py-2">F1</th>
                  <th className="py-2">ROC AUC</th>
                  <th className="py-2">Train (s)</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model: any) => {
                  const agg = model.metrics.find((x: any) => x.fold === -1)
                  const isBest = model.id === data?.best_model_id
                  return (
                    <tr
                      key={model.id}
                      className={`border-b border-[var(--color-line)]/50 ${isBest ? 'bg-[rgba(61,222,168,0.06)]' : ''}`}
                    >
                      <td className="py-3 mono">{model.rank ?? '—'}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="mono">{model.algorithm}</span>
                          {isBest && <Badge tone="up">best</Badge>}
                        </div>
                      </td>
                      <td className="py-3 mono">{model.prediction_horizon ?? 1}</td>
                      <td className="py-3 mono">{fmt(agg?.accuracy)}</td>
                      <td className="py-3 mono">{fmt(agg?.precision)}</td>
                      <td className="py-3 mono">{fmt(agg?.recall)}</td>
                      <td className="py-3 mono">{fmt(agg?.f1)}</td>
                      <td className="py-3 mono">{fmt(agg?.roc_auc)}</td>
                      <td className="py-3 mono">
                        {model.train_duration_seconds?.toFixed?.(1) ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {rocCurves.length > 0 && (
        <Card title="ROC Curves">
          <RocChart curves={rocCurves} />
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {models.map((model: any) => {
          const agg = model.metrics.find((x: any) => x.fold === -1)
          return (
            <Card key={model.id} title={`${model.algorithm} details`}>
              {agg?.confusion_matrix && (
                <div className="mb-6">
                  <div className="text-xs text-[var(--color-muted)] mb-3">Confusion Matrix</div>
                  <ConfusionMatrixView matrix={agg.confusion_matrix} />
                </div>
              )}
              {agg?.learning_curve && (
                <div>
                  <div className="text-xs text-[var(--color-muted)] mb-3">Learning Curve</div>
                  <LearningCurveChart data={agg.learning_curve} />
                </div>
              )}
              {model.best_params && (
                <pre className="mt-4 text-xs mono bg-black/20 rounded-xl p-3 overflow-x-auto">
                  {JSON.stringify(model.best_params, null, 2)}
                </pre>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function fmt(v?: number | null) {
  return v == null ? '—' : v.toFixed(3)
}
