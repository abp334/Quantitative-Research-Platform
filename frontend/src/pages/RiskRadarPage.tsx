import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Activity, AlertTriangle, TrendingDown } from 'lucide-react'
import { api } from '../api/client'
import type { ScannerItem } from '../types'
import { Badge, Card, ErrorBox } from '../components/ui'
import { PageSkeleton } from '../components/ux'
import { ReturnRiskScatter } from '../components/charts'

const pct = (v: number, signed = false) => `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

export function RiskRadarPage() {
  const [horizon, setHorizon] = useState(10)

  const scanner = useQuery<ScannerItem[]>({
    queryKey: ['market-scanner', horizon],
    queryFn: () => api.scanner(horizon) as Promise<ScannerItem[]>,
    staleTime: 5 * 60_000,
  })

  const riskAnalysis = useMemo(() => {
    const data = scanner.data ?? []
    if (!data.length) return null

    const sortedByVol = [...data].sort((a, b) => b.volatility - a.volatility)
    const sortedByDrawdownRisk = [...data].sort((a, b) => a.expected_return - b.expected_return)

    const highRiskCount = data.filter((i) => i.volatility >= 0.35).length
    const moderateRiskCount = data.filter((i) => i.volatility >= 0.2 && i.volatility < 0.35).length
    const lowRiskCount = data.filter((i) => i.volatility < 0.2).length

    const sectorRisk = new Map<string, { totalVol: number; count: number; negReturnCount: number }>()
    data.forEach((item) => {
      const sec = item.industry || 'Unclassified'
      const curr = sectorRisk.get(sec) || { totalVol: 0, count: 0, negReturnCount: 0 }
      curr.totalVol += item.volatility
      curr.count += 1
      if (item.expected_return < 0) curr.negReturnCount += 1
      sectorRisk.set(sec, curr)
    })

    const sectorList = [...sectorRisk.entries()]
      .map(([name, stats]) => ({
        name,
        avgVol: stats.totalVol / stats.count,
        count: stats.count,
        downsideRatio: stats.negReturnCount / stats.count,
      }))
      .sort((a, b) => b.avgVol - a.avgVol)

    return {
      sortedByVol,
      sortedByDrawdownRisk,
      highRiskCount,
      moderateRiskCount,
      lowRiskCount,
      sectorList,
      totalCount: data.length,
    }
  }, [scanner.data])

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-tag"><ShieldAlert style={{ width: 14, height: 14 }} /> Risk Radar</div>
          <h1>Systemic Risk & Volatility Radar</h1>
          <p className="page-desc">Comprehensive volatility heatmap, tail-risk metrics, and sector risk distribution across NIFTY equities.</p>
        </div>
        <label>
          <span className="form-label">Analysis Horizon</span>
          <select className="form-select" style={{ minWidth: 160 }} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            <option value={5}>5 sessions</option>
            <option value={10}>10 sessions</option>
            <option value={20}>20 sessions</option>
          </select>
        </label>
      </div>

      {scanner.isLoading && <PageSkeleton />}
      {scanner.error && <ErrorBox message={(scanner.error as Error).message} />}

      {scanner.data && riskAnalysis && (
        <>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="metric-tile">
              <span className="metric-label">High Volatility (&gt;35%)</span>
              <span className="metric-value text-red">{riskAnalysis.highRiskCount}</span>
              <span className="metric-hint">Stocks requiring tight risk limits</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Moderate Risk (20-35%)</span>
              <span className="metric-value text-amber">{riskAnalysis.moderateRiskCount}</span>
              <span className="metric-hint">Standard equity volatility tier</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Low Risk (&lt;20%)</span>
              <span className="metric-value text-green">{riskAnalysis.lowRiskCount}</span>
              <span className="metric-hint">Defensive volatility tier</span>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Universe Total</span>
              <span className="metric-value">{riskAnalysis.totalCount}</span>
              <span className="metric-hint">Active NIFTY equities</span>
            </div>
          </div>

          <Card title="Expected Return Profile" subtitle="Cross-sectional distribution of forecast returns">
            <ReturnRiskScatter data={scanner.data} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Highest Volatility Equities" subtitle="Annualised price variance based on historical daily moves">
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>Sector</th>
                      <th className="text-right">Volatility</th>
                      <th className="text-right">Exp. Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskAnalysis.sortedByVol.slice(0, 7).map((item) => (
                      <tr key={item.symbol}>
                        <td>
                          <strong className="mono">{item.symbol}</strong>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.industry || 'NIFTY'}</td>
                        <td className="text-right mono text-red" style={{ fontWeight: 600 }}>{pct(item.volatility)}</td>
                        <td className={`text-right mono ${item.expected_return >= 0 ? 'text-green' : 'text-red'}`}>
                          {pct(item.expected_return, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Sector Volatility Heatmap" subtitle="Average annualised volatility by sector group">
              <div className="space-y-3">
                {riskAnalysis.sectorList.map((sec) => (
                  <div key={sec.name} className="flex items-center justify-between gap-4 p-2 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{sec.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sec.count} equities · {(sec.downsideRatio * 100).toFixed(0)}% downside bias</div>
                    </div>
                    <div className="text-right">
                      <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: sec.avgVol > 0.3 ? 'var(--red)' : sec.avgVol > 0.2 ? 'var(--amber)' : 'var(--green)' }}>
                        {pct(sec.avgVol)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
