import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, HelpCircle, Plus, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import type { ScannerItem, Stock } from '../types'
import { Badge, Button, Card, ErrorBox, InfoTooltip } from '../components/ui'
import { PageSkeleton } from '../components/ux'

const money = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const pct = (v: number, signed = false) => `${signed && v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

type Alloc = { symbol: string; weight: number }

export function PortfolioSimPage() {
  const [horizon, setHorizon] = useState(10)
  const [totalCapital, setTotalCapital] = useState(1000000)
  const [allocs, setAllocs] = useState<Alloc[]>([
    { symbol: 'RELIANCE', weight: 40 },
    { symbol: 'TCS', weight: 35 },
    { symbol: 'INFY', weight: 25 },
  ])
  const [candidate, setCandidate] = useState('')

  const stocks = useQuery<Stock[]>({
    queryKey: ['stocks'],
    queryFn: () => api.stocks() as Promise<Stock[]>,
  })

  const scanner = useQuery<ScannerItem[]>({
    queryKey: ['market-scanner', horizon],
    queryFn: () => api.scanner(horizon) as Promise<ScannerItem[]>,
    staleTime: 5 * 60_000,
  })

  const stockMap = useMemo(() => new Map((scanner.data ?? []).map((s) => [s.symbol, s])), [scanner.data])
  const available = (stocks.data ?? []).filter((s) => !allocs.some((a) => a.symbol === s.symbol))

  const totalWeight = allocs.reduce((sum, a) => sum + a.weight, 0)

  const analysis = useMemo(() => {
    if (!scanner.data || allocs.length === 0 || totalWeight === 0) return null

    let weightedReturn = 0
    let weightedVol = 0
    let weightedScore = 0
    let weightedProb = 0

    allocs.forEach((a) => {
      const item = stockMap.get(a.symbol)
      const w = a.weight / totalWeight
      if (item) {
        weightedReturn += item.expected_return * w
        weightedVol += item.volatility * w
        weightedScore += item.score * w
        weightedProb += item.probability_up * w
      }
    })

    const annualisedReturn = weightedReturn * (252 / horizon)
    const sharpe = weightedVol > 0 ? (annualisedReturn - 0.065) / weightedVol : 0
    const sortino = weightedVol > 0 ? (annualisedReturn - 0.065) / (weightedVol * 0.7) : 0
    const valueAtRisk95 = totalCapital * (weightedVol / Math.sqrt(252 / horizon)) * 1.645
    const expectedPnl = totalCapital * weightedReturn

    return {
      weightedReturn,
      weightedVol,
      weightedScore,
      weightedProb,
      annualisedReturn,
      sharpe,
      sortino,
      valueAtRisk95,
      expectedPnl,
    }
  }, [allocs, horizon, scanner.data, stockMap, totalCapital, totalWeight])

  const addAlloc = () => {
    if (!candidate) return
    setAllocs((curr) => [...curr, { symbol: candidate, weight: 10 }])
    setCandidate('')
  }

  const updateWeight = (symbol: string, newWeight: number) => {
    setAllocs((curr) => curr.map((a) => (a.symbol === symbol ? { ...a, weight: Math.max(0, newWeight) } : a)))
  }

  const removeAlloc = (symbol: string) => {
    setAllocs((curr) => curr.filter((a) => a.symbol !== symbol))
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="page-tag"><Briefcase style={{ width: 12, height: 12 }} /> Portfolio Simulator</div>
        <h1>Virtual Portfolio &amp; Risk Calculator</h1>
        <p className="page-desc">Build a virtual stock portfolio, allocate capital percentages, and see expected gains alongside risk metrics like Sharpe Ratio and 95% Value at Risk.</p>
      </div>

      {(stocks.isLoading || scanner.isLoading) && <PageSkeleton />}
      {stocks.error && <ErrorBox message={(stocks.error as Error).message} />}
      {scanner.error && <ErrorBox message={(scanner.error as Error).message} />}

      {scanner.data && (
        <>
          <div className="grid lg:grid-cols-[1fr_360px] gap-4">
            <Card title="Portfolio Composition" subtitle="Add equities and adjust capital weights (%)">
              <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end mb-4">
                <label>
                  <span className="form-label">Add Stock</span>
                  <select className="form-select" value={candidate} onChange={(e) => setCandidate(e.target.value)}>
                    <option value="">Select stock from NIFTY list…</option>
                    {available.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol}{s.company_name ? ` — ${s.company_name}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="form-label">Total Investment (₹)</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 150 }}
                    value={totalCapital}
                    onChange={(e) => setTotalCapital(Number(e.target.value))}
                  />
                </label>
                <Button onClick={addAlloc} disabled={!candidate}>
                  <Plus style={{ width: 14, height: 14 }} /> Add
                </Button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>Last Price</th>
                      <th>Expected Return</th>
                      <th>Weight Units</th>
                      <th>Rupee Value</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocs.map((a) => {
                      const item = stockMap.get(a.symbol)
                      const effectivePct = totalWeight > 0 ? (a.weight / totalWeight) * 100 : 0
                      const allocVal = totalWeight > 0 ? (a.weight / totalWeight) * totalCapital : 0
                      const up = (item?.expected_return ?? 0) >= 0

                      return (
                        <tr key={a.symbol}>
                          <td>
                            <strong className="mono">{a.symbol}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item?.company_name || 'NIFTY'}</div>
                          </td>
                          <td className="mono">{item ? money(item.last_price) : '—'}</td>
                          <td className={`mono ${up ? 'text-green' : 'text-red'}`}>
                            {item ? pct(item.expected_return, true) : '—'}
                          </td>
                          <td style={{ width: 130 }}>
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: 75, padding: '4px 8px' }}
                              value={a.weight}
                              onChange={(e) => updateWeight(a.symbol, Number(e.target.value))}
                            />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                              ({effectivePct.toFixed(0)}%)
                            </span>
                          </td>
                          <td className="mono">{money(allocVal)}</td>
                          <td className="text-right">
                            <Button variant="danger" size="sm" onClick={() => removeAlloc(a.symbol)}>
                              <Trash2 style={{ width: 12, height: 12 }} />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Calculated Risk & Return" subtitle="Combined portfolio performance metrics">
              {analysis ? (
                <div className="space-y-4">
                  <div className="metric-tile">
                    <div className="flex items-center justify-between">
                      <span className="metric-label">Weighted Expected Return</span>
                      <InfoTooltip text="The predicted percentage profit or loss for your combined portfolio." />
                    </div>
                    <span className={`metric-value ${analysis.weightedReturn >= 0 ? 'text-green' : 'text-red'}`}>
                      {pct(analysis.weightedReturn, true)}
                    </span>
                    <span className="metric-hint">Expected Rupee Gain: {money(analysis.expectedPnl)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="metric-tile">
                      <div className="flex items-center justify-between">
                        <span className="metric-label">Sharpe Ratio</span>
                        <InfoTooltip text="Measures return per unit of risk. >1.0 is good, >2.0 is excellent." />
                      </div>
                      <span className="metric-value" style={{ fontSize: 18 }}>{analysis.sharpe.toFixed(2)}</span>
                    </div>
                    <div className="metric-tile">
                      <div className="flex items-center justify-between">
                        <span className="metric-label">Sortino Ratio</span>
                        <InfoTooltip text="Like Sharpe, but only penalizes bad downward losses (ignoring good upward price jumps)." />
                      </div>
                      <span className="metric-value" style={{ fontSize: 18 }}>{analysis.sortino.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="metric-tile">
                    <div className="flex items-center justify-between">
                      <span className="metric-label">95% Value at Risk (VaR)</span>
                      <InfoTooltip text="The maximum amount of money you could lose in 95 out of 100 bad market periods." />
                    </div>
                    <span className="metric-value text-red" style={{ fontSize: 18 }}>{money(analysis.valueAtRisk95)}</span>
                    <span className="metric-hint">Max likely 10-day loss limit</span>
                  </div>

                  <div className="context-list">
                    <div className="context-row">
                      <span className="context-label">Portfolio Volatility</span>
                      <span className="context-value">{pct(analysis.weightedVol)}</span>
                    </div>
                    <div className="context-row">
                      <span className="context-label">Average Upside Odds</span>
                      <span className="context-value">{pct(analysis.weightedProb)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  Add stocks above to calculate portfolio metrics.
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
