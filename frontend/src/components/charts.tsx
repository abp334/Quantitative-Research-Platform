import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { OhlcvBar } from '../types'
import { featureDefinition, featureLabel } from '../lib/financeGlossary'

const tooltipStyle = {
  background: '#121c2e',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 12,
  color: '#e8eef8',
}

function formatAxisNumber(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return v.toFixed(1)
  if (a >= 1) return v.toFixed(2)
  return v.toFixed(3)
}

/** Map raw feature keys → desk-friendly labels for chart axes/tooltips. */
function labelFeatureRows<T extends { feature: string }>(rows: T[]): T[] {
  return rows.map((r) => ({
    ...r,
    feature: featureLabel(r.feature),
    featureKey: (r as T & { featureKey?: string }).featureKey ?? r.feature,
  }))
}

function FeatureTooltip({
  active,
  payload,
  valueKey,
  valueLabel,
}: {
  active?: boolean
  payload?: Array<{ payload: Record<string, unknown>; value?: number }>
  valueKey: string
  valueLabel: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const key = String(row.featureKey ?? row.feature ?? '')
  const label = String(row.feature ?? featureLabel(key))
  const raw = Number(row[valueKey] ?? payload[0].value ?? 0)
  return (
    <div style={{ ...tooltipStyle, padding: '10px 12px', maxWidth: 280, fontSize: 12 }}>
      <div style={{ color: '#e8eef8', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#94a3b8', marginBottom: 6, lineHeight: 1.4 }}>
        {featureDefinition(key)}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {valueLabel}: {formatAxisNumber(raw)}
      </div>
    </div>
  )
}


/** Custom candle rendering via SVG shapes layered on a ComposedChart */
function CandleShape(props: any) {
  const { x, y, width, height, payload } = props
  if (!payload) return null
  const { open, close, high, low } = payload
  const bullish = close >= open
  const color = bullish ? '#3ddea8' : '#f07178'
  const yScale = props.yAxis?.scale
  // Fallback using relative positions from recharts bar props is unreliable;
  // use payload ratio via high-low mapped by parent.
  const bodyTop = Math.min(open, close)
  const bodyBot = Math.max(open, close)
  const range = high - low || 1
  const pxHigh = y
  const pxLow = y + height
  const scale = (v: number) => pxHigh + ((high - v) / range) * (pxLow - pxHigh)
  const top = scale(bodyBot)
  const bot = scale(bodyTop)
  const midX = x + width / 2
  return (
    <g>
      <line x1={midX} x2={midX} y1={scale(high)} y2={scale(low)} stroke={color} strokeWidth={1} />
      <rect
        x={x + width * 0.25}
        y={Math.min(top, bot)}
        width={Math.max(width * 0.5, 2)}
        height={Math.max(Math.abs(bot - top), 1)}
        fill={color}
      />
    </g>
  )
}

export function CandlestickChart({ data }: { data: OhlcvBar[] }) {
  const chartData = data.map((d) => ({
    ...d,
    date: d.date.slice(0, 10),
    wick: d.high - d.low,
  }))
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={40} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} width={60} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="high" shape={<CandleShape />} isAnimationActive={false} />
          <Line type="monotone" dataKey="close" stroke="#5b8cff" dot={false} strokeWidth={1} strokeOpacity={0.35} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PriceVolumeChart({ data }: { data: OhlcvBar[] }) {
  const chartData = data.map((d) => ({ ...d, date: d.date.slice(0, 10) }))
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={40} />
          <YAxis yAxisId="vol" tick={{ fill: '#94a3b8', fontSize: 11 }} width={50} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar yAxisId="vol" dataKey="volume" fill="rgba(91,140,255,0.3)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function IndicatorLineChart({
  data,
  lines,
}: {
  data: Array<Record<string, string | number | null>>
  lines: Array<{ key: string; color: string; name?: string }>
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={40} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={50} domain={['auto', 'auto']} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name ?? l.key}
              stroke={l.color}
              dot={false}
              strokeWidth={1.8}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RsiChart({ data }: { data: Array<{ date: string; rsi: number | null }> }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={40} />
          <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} width={40} />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={70} stroke="#f07178" strokeDasharray="4 4" />
          <ReferenceLine y={30} stroke="#3ddea8" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="rsi" stroke="#e6b84d" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ImportanceBarChart({
  data,
  valueLabel = 'Importance',
}: {
  data: Array<{ feature: string; importance: number; featureKey?: string }>
  valueLabel?: string
}) {
  const rows = labelFeatureRows(data)
  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={formatAxisNumber}
            label={{
              value: valueLabel,
              position: 'insideBottom',
              offset: -2,
              fill: '#64748b',
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="feature"
            width={148}
            tick={{ fill: '#c5d0e0', fontSize: 11 }}
            interval={0}
          />
          <Tooltip
            content={<FeatureTooltip valueKey="importance" valueLabel={valueLabel} />}
          />
          <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill={i % 2 === 0 ? '#3ddea8' : '#5b8cff'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WaterfallChart({
  data,
}: {
  data: Array<{ feature: string; shap: number; featureKey?: string }>
}) {
  const labeled = labelFeatureRows(data)
  let running = 0
  const rows = labeled.map((d) => {
    const start = running
    running += d.shap
    return {
      feature: d.feature,
      featureKey: (d as { featureKey?: string }).featureKey,
      shap: d.shap,
      base: Math.min(start, start + d.shap),
      rise: Math.abs(d.shap),
      positive: d.shap >= 0,
    }
  })
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={formatAxisNumber}
            label={{
              value: 'SHAP contribution',
              position: 'insideBottom',
              offset: -2,
              fill: '#64748b',
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="feature"
            width={148}
            tick={{ fill: '#c5d0e0', fontSize: 11 }}
            interval={0}
          />
          <Tooltip content={<FeatureTooltip valueKey="shap" valueLabel="SHAP" />} />
          <Bar dataKey="base" stackId="a" fill="transparent" />
          <Bar dataKey="rise" stackId="a" radius={[0, 4, 4, 0]}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.positive ? '#3ddea8' : '#f07178'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ForceStyleChart({
  positive,
  negative,
}: {
  positive: Array<{ feature: string; shap: number; featureKey?: string }>
  negative: Array<{ feature: string; shap: number; featureKey?: string }>
}) {
  const rows = labelFeatureRows([
    ...positive.slice(0, 8).map((p) => ({ feature: p.feature, shap: p.shap, featureKey: p.featureKey })),
    ...negative.slice(0, 8).map((n) => ({ feature: n.feature, shap: n.shap, featureKey: n.featureKey })),
  ])
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={formatAxisNumber}
            label={{
              value: 'SHAP (→ UP / ← DOWN)',
              position: 'insideBottom',
              offset: -2,
              fill: '#64748b',
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="feature"
            width={148}
            tick={{ fill: '#c5d0e0', fontSize: 11 }}
            interval={0}
          />
          <Tooltip content={<FeatureTooltip valueKey="shap" valueLabel="SHAP" />} />
          <ReferenceLine x={0} stroke="#64748b" />
          <Bar dataKey="shap" radius={[0, 4, 4, 0]}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.shap >= 0 ? '#3ddea8' : '#f07178'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RocChart({
  curves,
}: {
  curves: Array<{ name: string; fpr: number[]; tpr: number[]; color: string }>
}) {
  const length = Math.max(...curves.map((c) => c.fpr.length), 2)
  const data = Array.from({ length }, (_, i) => {
    const fpr = curves[0]?.fpr[i] ?? i / Math.max(length - 1, 1)
    const row: Record<string, number> = { fpr, diag: fpr }
    curves.forEach((c) => {
      row[c.name] = c.tpr[Math.min(i, c.tpr.length - 1)] ?? 0
    })
    return row
  })
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" />
          <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="diag" stroke="#64748b" strokeDasharray="4 4" dot={false} legendType="none" />
          {curves.map((c) => (
            <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LearningCurveChart({
  data,
}: {
  data: { train_sizes: number[]; train_scores: number[]; val_scores: number[] }
}) {
  const rows = data.train_sizes.map((size, i) => ({
    size,
    train: data.train_scores[i],
    val: data.val_scores[i],
  }))
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis dataKey="size" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="train" stroke="#5b8cff" strokeWidth={2} />
          <Line type="monotone" dataKey="val" stroke="#3ddea8" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ConfusionMatrixView({ matrix }: { matrix: number[][] }) {
  const flat = matrix.flat()
  const max = Math.max(...flat, 1)
  const labels = ['DOWN', 'UP']
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] gap-2 max-w-md">
      <div />
      <div className="text-center text-xs text-[var(--color-muted)]">Pred DOWN</div>
      <div className="text-center text-xs text-[var(--color-muted)]">Pred UP</div>
      {matrix.map((row, i) => (
        <div key={`row-${i}`} className="contents">
          <div className="text-xs text-[var(--color-muted)] flex items-center">True {labels[i]}</div>
          {row.map((v, j) => (
            <div
              key={`${i}-${j}`}
              className="rounded-xl h-20 flex items-center justify-center mono font-semibold"
              style={{
                background: `rgba(61,222,168,${0.12 + (v / max) * 0.55})`,
                border: '1px solid rgba(148,163,184,0.15)',
              }}
            >
              {v}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ProbabilityGauge({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100)
  return (
    <div className="relative h-40 flex flex-col items-center justify-center">
      <div className="text-xs text-[var(--color-muted)] mb-2">P(UP)</div>
      <div className="display text-5xl font-bold mono text-[var(--color-accent)]">{pct}%</div>
      <div className="w-full max-w-xs mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-danger)] via-[var(--color-warning)] to-[var(--color-accent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function EquityCurveChart({ data }: { data: Array<{ date: string; equity: number }> }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={40} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="equity" stroke="#3ddea8" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
