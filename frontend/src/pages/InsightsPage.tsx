import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { ImportanceBarChart } from '../components/charts'
import { Badge, Callout, Card, ErrorBox, MetricHint, Stat } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import {
  featureDefinition,
  featureLabel,
  formatPct,
  formatScore,
} from '../lib/financeGlossary'

const tooltipStyle = {
  background: '#121c2e',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 12,
  color: '#e8eef8',
}

export function InsightsPage() {
  const [showCorrHelp, setShowCorrHelp] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['insights'],
    queryFn: () => api.insights() as Promise<any>,
  })

  const upCount = data?.label_distribution?.UP ?? 0
  const downCount = data?.label_distribution?.DOWN ?? 0
  const totalPreds = upCount + downCount
  const upShare = totalPreds ? upCount / totalPreds : null

  const best = data?.best_model
  const topFeatures = useMemo(() => {
    const rows = (data?.top_features || []) as Array<{ feature: string; importance: number }>
    return rows.map((f) => ({
      feature: featureLabel(f.feature),
      featureKey: f.feature,
      importance: Number(f.importance),
    }))
  }, [data?.top_features])


  const corrRows = useMemo(() => {
    const rows = (data?.feature_correlation || []) as Array<{
      feature_a: string
      feature_b: string
      correlation: number
    }>
    return rows.slice(0, 12)
  }, [data?.feature_correlation])

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorBox message={(error as Error).message} />
  if (!data) return null

  return (
    <div className="space-y-6">
      <Card
        title="Research Insights"
        subtitle="Cross-model and prediction-archive diagnostics for the research desk"
      >
        <Callout>
          These panels summarize stored experiments and prediction history — not live market commentary.
          Use them to spot model bias, conviction clustering, and which technical factors dominate the
          fitted classifiers.
        </Callout>
        <ul className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
          {(data.narrative || []).map((n: string, i: number) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--color-accent)] shrink-0">▸</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Lead model"
          value={best ? best.algorithm.replace(/_/g, ' ') : '—'}
          hint={best ? `ROC AUC ${formatScore(best.roc_auc)} · F1 ${formatScore(best.f1)}` : 'Train models first'}
        />
        <Stat
          label="Mean conviction"
          value={formatPct(data.average_confidence)}
          hint="Avg |P(UP)−0.5|×2 across recent predictions"
        />
        <Stat
          label="UP share of calls"
          value={formatPct(upShare)}
          hint={`${upCount} UP / ${downCount} DOWN in archive`}
        />
        <Stat
          label="Predictions scored"
          value={totalPreds || '—'}
          hint="From latest insight window (up to 500)"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          title="Highest model conviction"
          subtitle="Symbols where P(UP) is usually farthest from 0.5"
          metricKey="Model conviction"
        >
          {(data.easiest_stocks || []).length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No prediction archive yet. Run a few predictions to populate this ranking.
            </p>
          ) : (
            <>
              <ul className="text-sm space-y-2.5">
                {(data.easiest_stocks || []).map((s: any) => (
                  <li
                    key={s.symbol}
                    className="flex items-center justify-between gap-3 border-b border-[var(--color-line)]/40 pb-2"
                  >
                    <div>
                      <span className="mono font-medium">{s.symbol}</span>
                      <span className="text-xs text-[var(--color-muted)] ml-2">n={s.n}</span>
                    </div>
                    <div className="text-right">
                      <div className="mono">{formatPct(s.avg_confidence)}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">avg conviction</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[var(--color-muted)] mt-3">
                High conviction ≠ high hit-rate. It means the classifier rarely hedges near 50/50 on
                these names in your stored runs.
              </p>
            </>
          )}
        </Card>

        <Card
          title="Lowest model conviction"
          subtitle="Near-coin-flip scores — contested or noisy setups"
          metricKey="Model conviction"
        >
          {(data.hardest_stocks || []).length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No prediction archive yet.</p>
          ) : (
            <>
              <ul className="text-sm space-y-2.5">
                {(data.hardest_stocks || []).map((s: any) => (
                  <li
                    key={s.symbol}
                    className="flex items-center justify-between gap-3 border-b border-[var(--color-line)]/40 pb-2"
                  >
                    <div>
                      <span className="mono font-medium">{s.symbol}</span>
                      <span className="text-xs text-[var(--color-muted)] ml-2">n={s.n}</span>
                    </div>
                    <div className="text-right">
                      <div className="mono">{formatPct(s.avg_confidence)}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">avg conviction</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[var(--color-muted)] mt-3">
                Treat low-conviction names as research candidates for feature gaps, regime shifts, or
                insufficient history — not as automatic shorts.
              </p>
            </>
          )}
        </Card>
      </div>

      <Card
        title="Dominant factors across models"
        subtitle="Aggregated mean |SHAP| / importance — what the desk’s classifiers rely on"
        metricKey="Global importance"
      >
        {topFeatures.length ? (
          <>
            <ImportanceBarChart data={topFeatures} />
            <div className="mt-4 grid md:grid-cols-2 gap-2">
              {topFeatures.slice(0, 6).map((f: any) => (
                <div
                  key={f.featureKey}
                  className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs text-[var(--color-muted)]"
                >
                  <span className="text-[var(--color-text)] mono">{f.feature}</span>
                  {' — '}
                  {featureDefinition(f.featureKey)}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">Train models to surface factor rankings.</p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card
          title="Conviction distribution"
          subtitle="Histogram of prediction confidence in the archive"
          metricKey="Confidence"
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.confidence_histogram || []}>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                <XAxis
                  dataKey="bin"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  label={{
                    value: 'Conviction bin',
                    position: 'insideBottom',
                    offset: -2,
                    fill: '#64748b',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  label={{
                    value: 'Count',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#64748b',
                    fontSize: 11,
                  }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Predictions" fill="#5b8cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-2">
            Mass near 0.0–0.2 ⇒ frequent hedges. Mass near 0.8–1.0 ⇒ decisive calls (check calibration
            on the Models page before sizing).
          </p>
        </Card>

        <Card title="Directional call mix" subtitle="UP vs DOWN labels in recent predictions" metricKey="Label mix">
          <div className="space-y-4">
            <div className="flex h-3 rounded-full overflow-hidden bg-white/10">
              <div
                className="bg-[var(--color-accent)]"
                style={{ width: `${(upShare ?? 0) * 100}%` }}
                title="UP"
              />
              <div
                className="bg-[var(--color-danger)]"
                style={{ width: `${(1 - (upShare ?? 0)) * 100}%` }}
                title="DOWN"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[rgba(61,222,168,0.25)] bg-[rgba(61,222,168,0.06)] p-3">
                <div className="text-xs text-[var(--color-muted)]">UP calls</div>
                <div className="display text-2xl mono mt-1">{upCount}</div>
                <div className="text-xs text-[var(--color-muted)]">{formatPct(upShare)} of archive</div>
              </div>
              <div className="rounded-xl border border-[rgba(240,113,120,0.25)] bg-[rgba(240,113,120,0.06)] p-3">
                <div className="text-xs text-[var(--color-muted)]">DOWN calls</div>
                <div className="display text-2xl mono mt-1">{downCount}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {formatPct(totalPreds ? downCount / totalPreds : null)} of archive
                </div>
              </div>
            </div>
            <Callout tone="warn">
              Persistent UP skew can mirror a bullish sample period or a model bias — compare against
              walk-forward metrics on the Models page before treating the mix as alpha.
            </Callout>
          </div>
        </Card>
      </div>

      <Card
        title="Walk-forward performance timeline"
        subtitle="ROC AUC and accuracy for each stored model artifact over time"
      >
        {(data.performance_over_time || []).length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No model metrics yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-xs text-[var(--color-muted)] mb-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                ROC AUC <MetricHint metricKey="ROC AUC" />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--color-accent-2)]" />
                Accuracy <MetricHint metricKey="Accuracy" />
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.performance_over_time || []}>
                  <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={40} />
                  <YAxis domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => [formatScore(v), name]}
                    labelFormatter={(l) => String(l).slice(0, 19)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="roc_auc"
                    name="ROC AUC"
                    stroke="#3ddea8"
                    dot={{ r: 3 }}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    name="Accuracy"
                    stroke="#5b8cff"
                    dot={{ r: 3 }}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Each point is a finished training artifact. Flat or rising AUC across jobs is healthier
              than one-off spikes from tiny symbol sets.
            </p>
          </>
        )}
      </Card>

      <Card
        title="Feature collinearity sample"
        subtitle="Largest |Pearson ρ| pairs from a recent feature-run window"
        metricKey="Correlation"
        action={
          <button
            type="button"
            className="text-xs text-[var(--color-accent-2)] hover:underline"
            onClick={() => setShowCorrHelp((v) => !v)}
          >
            {showCorrHelp ? 'Hide note' : 'Why this matters'}
          </button>
        }
      >
        {showCorrHelp && (
          <div className="mb-4">
            <Callout>
              Highly correlated pairs (e.g. SMA windows, MACD family) share information. Large
              importance on one leg of a pair does not imply independent alpha — interpret jointly
              when designing the next feature set.
            </Callout>
          </div>
        )}
        {corrRows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Generate features and ensure a run has enough history for a correlation sample.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-line)]">
                  <th className="py-2">Feature A</th>
                  <th className="py-2">Feature B</th>
                  <th className="py-2">ρ</th>
                  <th className="py-2">Read</th>
                </tr>
              </thead>
              <tbody>
                {corrRows.map((r) => {
                  const abs = Math.abs(r.correlation)
                  const read =
                    abs >= 0.85 ? 'Near-redundant' : abs >= 0.6 ? 'Strong link' : 'Moderate'
                  return (
                    <tr
                      key={`${r.feature_a}-${r.feature_b}`}
                      className="border-b border-[var(--color-line)]/40"
                    >
                      <td className="py-2.5 mono">{featureLabel(r.feature_a)}</td>
                      <td className="py-2.5 mono">{featureLabel(r.feature_b)}</td>
                      <td className="py-2.5 mono">{r.correlation.toFixed(3)}</td>
                      <td className="py-2.5">
                        <Badge tone={abs >= 0.85 ? 'down' : abs >= 0.6 ? 'neutral' : 'up'}>
                          {read}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {best && (
        <Card title="Lead model scorecard" subtitle="Primary walk-forward aggregates for ranking">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
            {(
              [
                ['ROC AUC', best.roc_auc, 'ROC AUC'],
                ['Accuracy', best.accuracy, 'Accuracy'],
                ['Precision', best.precision, 'Precision'],
                ['Recall', best.recall, 'Recall'],
                ['F1', best.f1, 'F1'],
              ] as const
            ).map(([label, value, key]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--color-line)] bg-white/[0.02] p-3"
              >
                <div className="text-xs text-[var(--color-muted)] inline-flex items-center gap-1">
                  {label} <MetricHint metricKey={key} />
                </div>
                <div className="display text-xl mono mt-1">{formatScore(value)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
