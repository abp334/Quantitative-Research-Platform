import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ModelArtifact, Stock } from '../types'
import { ForceStyleChart, ImportanceBarChart, WaterfallChart } from '../components/charts'
import { Badge, Button, Callout, Card, ErrorBox, FieldSelect, MetricHint } from '../components/ui'
import { useToast } from '../components/ux'
import {
  FEATURE_GLOSSARY,
  featureCategory,
  featureDefinition,
  featureLabel,
  formatPct,
  formatScore,
  shapDirection,
  withFriendlyFeatureNames,
} from '../lib/financeGlossary'

function modelHorizon(m: ModelArtifact): number {
  return Number(m.prediction_horizon ?? m.meta?.prediction_horizon ?? 1)
}

function modelOptionLabel(m: ModelArtifact) {
  const agg = m.metrics?.find((x) => x.fold === -1)
  const auc = agg?.roc_auc != null ? ` · AUC ${formatScore(agg.roc_auc)}` : ''
  return `#${m.id} ${m.algorithm.replace(/_/g, ' ')} · ${modelHorizon(m)}d${auc}`
}

export function ExplainabilityPage() {
  const toast = useToast()
  const [symbol, setSymbol] = useState('RELIANCE')
  const [horizon, setHorizon] = useState(1)
  const [modelId, setModelId] = useState<number | undefined>()
  const [auto, setAuto] = useState(true)
  const [showGlossary, setShowGlossary] = useState(false)

  const stocks = useQuery({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const models = useQuery({
    queryKey: ['models'],
    queryFn: () => api.models() as Promise<ModelArtifact[]>,
  })

  const filteredModels = useMemo(() => {
    const list = models.data ?? []
    return list.filter((m) => modelHorizon(m) === horizon)
  }, [models.data, horizon])

  const selected = useMemo(() => {
    if (auto) return undefined
    return filteredModels.find((m) => m.id === modelId) ?? filteredModels[0]
  }, [auto, filteredModels, modelId])

  const importanceSource = selected ?? filteredModels[0] ?? models.data?.[0]

  const predictMut = useMutation({
    mutationFn: () =>
      api.predict({
        symbol,
        model_id: auto ? undefined : selected?.id,
        prediction_horizon: horizon,
        auto_select: auto,
      }) as Promise<any>,
    onSuccess: () => toast.push('Local explanation ready'),
    onError: (e: Error) => toast.push(e.message, 'err'),
  })

  const explanation = predictMut.data

  const globalData = useMemo(() => {
    const imp = importanceSource?.global_importance ?? {}
    return Object.entries(imp)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 15)
      .map(([feature, importance]) => ({
        feature: featureLabel(feature),
        featureKey: feature,
        importance: Number(importance),
      }))
  }, [importanceSource])

  const topLocal = useMemo(() => {
    const rows = (explanation?.top_features || explanation?.waterfall || []) as Array<{
      feature: string
      shap: number
      value?: number
    }>
    return [...rows].sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap)).slice(0, 8)
  }, [explanation])

  const company = stocks.data?.find((s) => s.symbol === symbol)

  return (
    <div className="space-y-6">
      <Card
        title="Explainability Lab"
        subtitle="Attribute model decisions to technical factors — global reliance vs this bar’s drivers"
      >
        <Callout tone="info">
          <strong className="text-[var(--color-text)]">Global</strong> importance shows which inputs the
          model leans on across training. <strong className="text-[var(--color-text)]">Local</strong>{' '}
          SHAP explains one as-of date: positive contributions push toward UP; negative toward DOWN.
          Attributions are relative to a background baseline, not standalone trading signals.
        </Callout>

        <div className="mt-4 flex flex-wrap gap-3 items-end">
          <FieldSelect
            label="Stock"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            hint="Universe from imported NIFTY-50 CSVs"
          >
            {(stocks.data ?? []).map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol}
                {s.company_name ? ` — ${s.company_name}` : ''}
              </option>
            ))}
          </FieldSelect>

          <FieldSelect
            label="Horizon"
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            hint="Forward return window the classifier targets"
          >
            {[1, 3, 5].map((h) => (
              <option key={h} value={h}>
                {h} trading day{h > 1 ? 's' : ''}
              </option>
            ))}
          </FieldSelect>

          <label className="text-sm flex items-center gap-2 pb-2.5">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            <span className="text-[var(--color-muted)]">Auto-select best model (ROC AUC)</span>
          </label>

          {!auto && (
            <FieldSelect
              label="Model"
              value={selected?.id ?? ''}
              onChange={(e) => setModelId(Number(e.target.value))}
            >
              {filteredModels.length === 0 && <option value="">No models for this horizon</option>}
              {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {modelOptionLabel(m)}
                </option>
              ))}
            </FieldSelect>
          )}

          <Button onClick={() => predictMut.mutate()} disabled={predictMut.isPending}>
            {predictMut.isPending ? 'Computing SHAP…' : 'Explain prediction'}
          </Button>

          <Button variant="ghost" onClick={() => setShowGlossary((v) => !v)}>
            {showGlossary ? 'Hide' : 'Feature'} glossary
          </Button>
        </div>

        {company?.industry && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            {symbol}
            {company.company_name ? ` · ${company.company_name}` : ''}
            {company.industry ? ` · ${company.industry}` : ''}
          </p>
        )}

        {predictMut.isError && (
          <div className="mt-4">
            <ErrorBox message={(predictMut.error as Error).message} />
          </div>
        )}
      </Card>

      {showGlossary && (
        <Card title="Feature glossary" subtitle="How each input is constructed for the classifier">
          <div className="grid md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {(
              importanceSource?.feature_names?.length
                ? importanceSource.feature_names
                : FEATURE_GLOSSARY.map((f) => f.key)
            ).map((key) => (
              <div
                key={key}
                className="rounded-xl border border-[var(--color-line)] bg-white/[0.02] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="mono text-sm text-[var(--color-text)]">{featureLabel(key)}</span>
                  <Badge tone="neutral">{featureCategory(key)}</Badge>
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
                  {featureDefinition(key)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        title="Global feature importance"
        subtitle={
          importanceSource
            ? `${importanceSource.algorithm.replace(/_/g, ' ')} · mean |SHAP| (training sample)`
            : 'Train a model to view aggregate reliance'
        }
        metricKey="Global importance"
      >
        {globalData.length ? (
          <>
            <ImportanceBarChart data={globalData} />
            <p className="text-xs text-[var(--color-muted)] mt-3">
              Rank reflects how much the model used each factor on average during training — not the
              drivers of the latest prediction below.
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            No importance vector yet. Run training so SHAP (or native) importances are stored on the
            artifact.
          </p>
        )}
      </Card>

      {explanation && (
        <>
          <Card title="Local explanation" metricKey="Local explanation">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge tone={explanation.label === 'UP' ? 'up' : 'down'}>{explanation.label}</Badge>
              <span className="text-sm">
                P(UP) <span className="mono">{formatPct(explanation.probability_up)}</span>
                <MetricHint metricKey="P(UP)" />
              </span>
              <span className="text-sm text-[var(--color-muted)]">
                Conviction <span className="mono text-[var(--color-text)]">{formatPct(explanation.confidence)}</span>
                <MetricHint metricKey="Confidence" />
              </span>
              <span className="text-xs text-[var(--color-muted)] mono">
                {explanation.model_algorithm?.replace(/_/g, ' ')} · h=
                {explanation.prediction_horizon ?? horizon} · as-of {explanation.as_of_date}
              </span>
            </div>
            <Callout tone="accent">
              {explanation.narrative || explanation.summary_text || 'No narrative generated.'}
            </Callout>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-line)]">
                    <th className="py-2 pr-3">Factor</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Value @ as-of</th>
                    <th className="py-2 pr-3">
                      SHAP <MetricHint metricKey="SHAP" />
                    </th>
                    <th className="py-2">Effect on call</th>
                  </tr>
                </thead>
                <tbody>
                  {topLocal.map((row) => {
                    const dir = shapDirection(row.shap)
                    return (
                      <tr key={row.feature} className="border-b border-[var(--color-line)]/40">
                        <td className="py-2.5 pr-3">
                          <div className="mono text-[var(--color-text)]">{featureLabel(row.feature)}</div>
                          <div className="text-[11px] text-[var(--color-muted)] max-w-xs leading-snug">
                            {featureDefinition(row.feature)}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-[var(--color-muted)]">
                          {featureCategory(row.feature)}
                        </td>
                        <td className="py-2.5 pr-3 mono">
                          {row.value != null ? Number(row.value).toPrecision(4) : '—'}
                        </td>
                        <td className="py-2.5 pr-3 mono">
                          {row.shap >= 0 ? '+' : ''}
                          {row.shap.toFixed(4)}
                        </td>
                        <td className="py-2.5">
                          <Badge tone={dir === 'bullish' ? 'up' : 'down'}>
                            {dir === 'bullish' ? 'Supports UP' : 'Supports DOWN'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card
              title="SHAP waterfall"
              subtitle="Cumulative path from baseline toward this prediction"
              metricKey="Waterfall"
            >
              <WaterfallChart
                data={withFriendlyFeatureNames(explanation.waterfall || explanation.top_features || [])}
              />
            </Card>
            <Card
              title="Bullish vs bearish pressure"
              subtitle="Largest positive and negative attributions"
              metricKey="Force plot"
            >
              <ForceStyleChart
                positive={withFriendlyFeatureNames(explanation.positive_contributions || [])}
                negative={withFriendlyFeatureNames(explanation.negative_contributions || [])}
              />
              <p className="text-xs text-[var(--color-muted)] mt-3">
                Green = lifts P(UP); red = lifts P(DOWN). Opposing bars of similar magnitude imply a
                contested setup even if the final label is decisive.
              </p>
            </Card>
          </div>
        </>
      )}

      {!explanation && !predictMut.isPending && (
        <Callout tone="warn">
          Select a stock and horizon, then run <strong className="text-[var(--color-text)]">Explain prediction</strong>{' '}
          to generate a local SHAP breakdown for the latest available feature bar.
        </Callout>
      )}
    </div>
  )
}
