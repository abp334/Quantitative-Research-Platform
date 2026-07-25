import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Badge, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'

export function ExperimentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['experiments'],
    queryFn: () => api.experiments() as Promise<any[]>,
  })
  const [a, setA] = useState<number | undefined>()
  const [b, setB] = useState<number | undefined>()

  const expA = data?.find((e) => e.id === a)
  const expB = data?.find((e) => e.id === b)

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorBox message={(error as Error).message} />

  return (
    <div className="space-y-6">
      <Card title="Experiment Tracker" subtitle="Every training run is stored for comparison">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-line)]">
                <th className="py-2">ID</th>
                <th className="py-2">Status</th>
                <th className="py-2">Horizon</th>
                <th className="py-2">Symbols</th>
                <th className="py-2">Duration</th>
                <th className="py-2">Models</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((e) => (
                <tr key={e.id} className="border-b border-[var(--color-line)]/50">
                  <td className="py-3 mono">#{e.id}</td>
                  <td className="py-3">
                    <Badge tone={e.status === 'completed' ? 'up' : e.status === 'failed' ? 'down' : 'neutral'}>
                      {e.status}
                    </Badge>
                  </td>
                  <td className="py-3 mono">{e.config?.prediction_horizon ?? 1}</td>
                  <td className="py-3 text-xs">{(e.config?.symbols || []).join(', ')}</td>
                  <td className="py-3 mono">
                    {e.duration_seconds != null ? `${e.duration_seconds.toFixed(0)}s` : '—'}
                  </td>
                  <td className="py-3 mono">{e.models?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Compare Experiments">
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2 text-sm"
            value={a ?? ''}
            onChange={(e) => setA(Number(e.target.value))}
          >
            <option value="">Experiment A</option>
            {(data ?? []).map((e) => (
              <option key={e.id} value={e.id}>#{e.id}</option>
            ))}
          </select>
          <select
            className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2 text-sm"
            value={b ?? ''}
            onChange={(e) => setB(Number(e.target.value))}
          >
            <option value="">Experiment B</option>
            {(data ?? []).map((e) => (
              <option key={e.id} value={e.id}>#{e.id}</option>
            ))}
          </select>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          {[expA, expB].map((exp, idx) => (
            <div key={idx} className="glass rounded-xl p-4">
              {exp ? (
                <>
                  <div className="mono mb-2">#{exp.id} · {exp.status}</div>
                  <pre className="text-xs overflow-x-auto text-[var(--color-muted)]">
                    {JSON.stringify(
                      {
                        config: exp.config,
                        duration_seconds: exp.duration_seconds,
                        models: (exp.models || []).map((m: any) => ({
                          algorithm: m.algorithm,
                          roc_auc: m.metrics?.find((x: any) => x.fold === -1)?.roc_auc,
                        })),
                      },
                      null,
                      2,
                    )}
                  </pre>
                </>
              ) : (
                <p className="text-[var(--color-muted)]">Select an experiment</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
