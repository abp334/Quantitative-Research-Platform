import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ModelArtifact, Stock } from '../types'
import { ForceStyleChart, ImportanceBarChart, ProbabilityGauge, WaterfallChart } from '../components/charts'
import { Badge, Button, Callout, Card, ErrorBox } from '../components/ui'
import { useToast } from '../components/ux'
import {
  buildDecisionBrief,
  HOW_TO_DECIDE_STEPS,
  stanceTone,
} from '../lib/decisionBrief'
import {
  featureCategory,
  featureDefinition,
  featureLabel,
  formatPct,
  shapDirection,
} from '../lib/financeGlossary'

export function PredictionPage() {
  const toast = useToast()
  const [symbol, setSymbol] = useState('RELIANCE')
  const [horizon, setHorizon] = useState(1)
  const [modelId, setModelId] = useState<number | undefined>()
  const [auto, setAuto] = useState(true)
  const [showTech, setShowTech] = useState(false)

  const stocks = useQuery({ queryKey: ['stocks'], queryFn: () => api.stocks() as Promise<Stock[]> })
  const models = useQuery({ queryKey: ['models'], queryFn: () => api.models() as Promise<ModelArtifact[]> })

  const predictMut = useMutation({
    mutationFn: () =>
      api.predict({
        symbol,
        model_id: auto ? undefined : modelId,
        prediction_horizon: horizon,
        auto_select: auto,
      }) as Promise<any>,
    onSuccess: () => toast.push('Research brief ready'),
    onError: (e: Error) => toast.push(e.message, 'err'),
  })

  const p = predictMut.data
  const company = stocks.data?.find((s) => s.symbol === symbol)

  const topDrivers = useMemo(() => {
    const rows = (p?.top_features || []) as Array<{ feature: string; shap: number; value?: number }>
    return [...rows].sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap)).slice(0, 8)
  }, [p])

  const brief = useMemo(() => {
    if (!p) return null
    return buildDecisionBrief({
      symbol: p.symbol || symbol,
      label: p.label,
      probabilityUp: p.probability_up,
      confidence: p.confidence,
      horizon: p.prediction_horizon ?? horizon,
      asOfDate: p.as_of_date,
      topFeatures: p.top_features || [],
    })
  }, [p, symbol, horizon])

  const passed = brief?.checklist.filter((c) => c.ok).length ?? 0

  return (
    <div className="space-y-6">
      <Card
        title="Should I lean long or stay out?"
        subtitle="This page turns the model into a short-horizon research stance — not a brokerage order"
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {HOW_TO_DECIDE_STEPS.map((s) => (
            <div
              key={s.step}
              className="rounded-xl border border-[var(--color-line)] bg-white/[0.02] px-3 py-3"
            >
              <div className="text-xs text-[var(--color-accent)] mono mb-1">Step {s.step}</div>
              <div className="text-sm font-medium text-[var(--color-text)]">{s.title}</div>
              <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm min-w-[12rem]">
            <span className="text-[var(--color-muted)] block mb-1">Which stock?</span>
            <select
              className="w-full rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {(stocks.data ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}
                  {s.company_name ? ` — ${s.company_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[var(--color-muted)] block mb-1">Look-ahead</span>
            <select
              className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            >
              <option value={1}>1 session (tactical)</option>
              <option value={3}>3 sessions</option>
              <option value={5}>5 sessions (~1 week)</option>
            </select>
          </label>
          <label className="text-sm flex items-center gap-2 mb-2">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Use best model automatically
          </label>
          {!auto && (
            <label className="text-sm">
              <span className="text-[var(--color-muted)] block mb-1">Model</span>
              <select
                className="rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2"
                value={modelId ?? ''}
                onChange={(e) => setModelId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Select…</option>
                {(models.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} {m.algorithm.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button onClick={() => predictMut.mutate()} disabled={predictMut.isPending}>
            {predictMut.isPending ? 'Scoring…' : 'Get research stance'}
          </Button>
        </div>

        {company?.industry && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            {symbol}
            {company.company_name ? ` · ${company.company_name}` : ''} · {company.industry}
          </p>
        )}

        {predictMut.isError && (
          <div className="mt-4">
            <ErrorBox message={(predictMut.error as Error).message} />
          </div>
        )}
      </Card>

      {!p && !predictMut.isPending && (
        <Callout>
          Select a stock, choose how far ahead you care about, then click{' '}
          <strong className="text-[var(--color-text)]">Get research stance</strong>. You will get a clear
          lean (constructive / defensive / no edge), a go/no-go checklist, and plain-language reasons —
          technical charts stay optional below.
        </Callout>
      )}

      {brief && p && (
        <>
          <Card title="Research verdict">
            <div
              className={`rounded-2xl border px-5 py-5 mb-4 ${
                stanceTone(brief.stance) === 'up'
                  ? 'border-[rgba(61,222,168,0.35)] bg-[rgba(61,222,168,0.07)]'
                  : stanceTone(brief.stance) === 'down'
                    ? 'border-[rgba(240,113,120,0.35)] bg-[rgba(240,113,120,0.07)]'
                    : 'border-[var(--color-line)] bg-white/[0.03]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Badge tone={stanceTone(brief.stance)}>{brief.headline}</Badge>
                <Badge tone={p.label === 'UP' ? 'up' : 'down'}>Model: {p.label}</Badge>
                <span className="text-xs text-[var(--color-muted)] mono">
                  as-of {p.as_of_date} · {p.prediction_horizon ?? horizon}d horizon
                </span>
              </div>
              <p className="text-base text-[var(--color-text)] leading-relaxed">{brief.plainEnglish}</p>
              <p className="text-sm text-[var(--color-muted)] mt-3 leading-relaxed">{brief.actionHint}</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-[var(--color-line)] p-4 text-center">
                <div className="text-xs text-[var(--color-muted)] mb-1">Chance price rises</div>
                <div className="display text-3xl mono text-[var(--color-accent)]">
                  {formatPct(p.probability_up)}
                </div>
                <p className="text-[11px] text-[var(--color-muted)] mt-2">
                  Model’s estimated odds of an up move over the horizon
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-line)] p-4 text-center">
                <div className="text-xs text-[var(--color-muted)] mb-1">How sure is the model?</div>
                <div className="display text-3xl mono">{formatPct(p.confidence)}</div>
                <p className="text-[11px] text-[var(--color-muted)] mt-2">
                  Distance from a 50/50 call — higher = more decisive, not more “correct”
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-line)] p-4 text-center">
                <div className="text-xs text-[var(--color-muted)] mb-1">Checklist score</div>
                <div className="display text-3xl mono">
                  {passed}
                  <span className="text-lg text-[var(--color-muted)]">/4</span>
                </div>
                <p className="text-[11px] text-[var(--color-muted)] mt-2">
                  {passed >= 3
                    ? 'Strong enough to continue research'
                    : passed >= 2
                      ? 'Mixed — dig deeper before acting'
                      : 'Weak — prefer skip or wait'}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Go / no-go checklist" subtitle="Use this before you think about capital">
              <ul className="space-y-3">
                {brief.checklist.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm items-start">
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs border ${
                        item.ok
                          ? 'border-[rgba(61,222,168,0.4)] bg-[rgba(61,222,168,0.12)] text-[var(--color-accent)]'
                          : 'border-[rgba(240,113,120,0.35)] bg-[rgba(240,113,120,0.08)] text-[var(--color-danger)]'
                      }`}
                    >
                      {item.ok ? '✓' : '✗'}
                    </span>
                    <span className={item.ok ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link
                  to="/app/data"
                  className="rounded-xl border border-[var(--color-line)] px-3 py-2 hover:border-[var(--color-accent)]"
                >
                  Open chart in Data Explorer →
                </Link>
                <Link
                  to="/app/models"
                  className="rounded-xl border border-[var(--color-line)] px-3 py-2 hover:border-[var(--color-accent)]"
                >
                  Check model quality →
                </Link>
                <Link
                  to="/app/backtest"
                  className="rounded-xl border border-[var(--color-line)] px-3 py-2 hover:border-[var(--color-accent)]"
                >
                  Stress-test with backtest →
                </Link>
              </div>
            </Card>

            <Card title="Why the model thinks this" subtitle="Plain language — no formula names required">
              <ul className="space-y-2.5 text-sm text-[var(--color-muted)]">
                {brief.whyInPlainWords.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--color-accent)] shrink-0">▸</span>
                    <span className="text-[var(--color-text)]">{line}</span>
                  </li>
                ))}
              </ul>
              <Callout tone="warn">
                <ul className="space-y-1.5">
                  {brief.riskNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </Callout>
            </Card>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-muted)]">
              Need the quant detail (SHAP charts, factor table)?
            </p>
            <Button variant="ghost" onClick={() => setShowTech((v) => !v)}>
              {showTech ? 'Hide technical detail' : 'Show technical detail'}
            </Button>
          </div>

          {showTech && (
            <>
              <div className="grid lg:grid-cols-3 gap-6">
                <Card title="Probability gauge">
                  <ProbabilityGauge probability={p.probability_up} />
                </Card>
                <Card title="Model note">
                  <p className="text-sm leading-relaxed text-[var(--color-muted)]">
                    {p.summary_text || p.narrative}
                  </p>
                </Card>
                <Card title="Largest factor contributions">
                  <ImportanceBarChart
                    valueLabel="Contribution size"
                    data={topDrivers.map((f) => ({
                      feature: f.feature,
                      importance: Math.abs(f.shap),
                    }))}
                  />
                </Card>
              </div>

              <Card title="Factor table">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-line)]">
                        <th className="py-2 pr-3">Factor</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Value</th>
                        <th className="py-2">Effect on call</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topDrivers.map((row) => {
                        const dir = shapDirection(row.shap)
                        return (
                          <tr key={row.feature} className="border-b border-[var(--color-line)]/40 align-top">
                            <td className="py-2.5 pr-3">
                              <div>{featureLabel(row.feature)}</div>
                              <div className="text-[11px] text-[var(--color-muted)] max-w-sm">
                                {featureDefinition(row.feature)}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3 text-[var(--color-muted)]">
                              {featureCategory(row.feature)}
                            </td>
                            <td className="py-2.5 pr-3 mono">
                              {row.value != null ? Number(row.value).toPrecision(4) : '—'}
                            </td>
                            <td className="py-2.5">
                              <Badge tone={dir === 'bullish' ? 'up' : 'down'}>
                                {dir === 'bullish' ? 'Supports rise' : 'Supports fall'}
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
                <Card title="Contribution path">
                  <WaterfallChart data={p.waterfall || p.top_features || []} />
                </Card>
                <Card title="Rise vs fall pressure">
                  <ForceStyleChart
                    positive={p.positive_contributions || []}
                    negative={p.negative_contributions || []}
                  />
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
