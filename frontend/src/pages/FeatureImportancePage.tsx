import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ModelArtifact } from '../types'
import { ImportanceBarChart } from '../components/charts'
import { Card, ErrorBox, Loading } from '../components/ui'

export function FeatureImportancePage() {
  const models = useQuery({
    queryKey: ['models'],
    queryFn: () => api.models() as Promise<ModelArtifact[]>,
  })
  const [modelId, setModelId] = useState<number | undefined>()

  const selected = useMemo(() => {
    const list = models.data ?? []
    return list.find((m) => m.id === modelId) ?? list[0]
  }, [models.data, modelId])

  const chartData = useMemo(() => {
    const imp = selected?.global_importance ?? {}
    return Object.entries(imp)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 20)
      .map(([feature, importance]) => ({ feature, importance: Number(importance) }))
  }, [selected])

  if (models.isLoading) return <Loading />
  if (models.error) return <ErrorBox message={(models.error as Error).message} />

  return (
    <div className="space-y-6">
      <Card title="Global Feature Importance" subtitle="Mean |SHAP| (fallback: native importances)">
        <select
          className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2 text-sm mb-4"
          value={selected?.id ?? ''}
          onChange={(e) => setModelId(Number(e.target.value))}
        >
          {(models.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              #{m.id} {m.algorithm}
            </option>
          ))}
        </select>
        {chartData.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Train a model to view importance.</p>
        ) : (
          <ImportanceBarChart data={chartData} valueLabel="Mean |SHAP|" />
        )}
      </Card>
    </div>
  )
}
