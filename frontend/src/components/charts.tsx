import {
  Area,
  AreaChart,
  Bar,
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
import type { ForecastPoint, OhlcvBar, ValidationPoint } from '../types'

const tooltipStyle = {
  background: '#101a2b',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 12,
  color: '#e8eef8',
  boxShadow: '0 16px 40px rgba(0,0,0,.35)',
}
const money = (value: number) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function CandleShape(props: any) {
  const { x, y, width, height, payload } = props
  if (!payload || !Number.isFinite(height)) return null
  const { open, close, high, low } = payload
  const rising = close >= open
  const color = rising ? '#3ddea8' : '#f07178'
  const range = high - low || 1
  const scale = (value: number) => y + ((high - value) / range) * height
  const top = scale(Math.max(open, close))
  const bottom = scale(Math.min(open, close))
  const middle = x + width / 2
  return <g>
    <line x1={middle} x2={middle} y1={scale(high)} y2={scale(low)} stroke={color} strokeWidth={1} />
    <rect x={x + width * .22} y={top} width={Math.max(width * .56, 2)} height={Math.max(bottom - top, 1.5)} fill={color} rx={1} />
  </g>
}

export function CandlestickChart({ data }: { data: OhlcvBar[] }) {
  const rows = data.map((item) => ({ ...item, date: item.date.slice(0, 10) }))
  return <div className="h-80">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 6 }}>
        <CartesianGrid stroke="rgba(148,163,184,.09)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 10 }} minTickGap={44} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#7f8da3', fontSize: 10 }} width={66} tickFormatter={(v) => `₹${Number(v).toFixed(0)}`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name === 'volume' ? Number(value).toLocaleString('en-IN') : money(value), name]} />
        <Bar dataKey="high" shape={<CandleShape />} isAnimationActive={false} />
        <Line dataKey="close" stroke="#7298ff" strokeWidth={1.25} strokeOpacity={.45} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
}

export function PriceVolumeChart({ data }: { data: OhlcvBar[] }) {
  const rows = data.map((item) => ({ ...item, date: item.date.slice(0, 10), rising: item.close >= item.open }))
  return <div className="h-44">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows}>
        <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 10 }} minTickGap={44} />
        <YAxis tick={{ fill: '#7f8da3', fontSize: 10 }} width={55} tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}m`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [Number(value).toLocaleString('en-IN'), 'Volume']} />
        <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
          {rows.map((row, index) => <Cell key={index} fill={row.rising ? 'rgba(61,222,168,.42)' : 'rgba(240,113,120,.4)'} />)}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  </div>
}

export function IndicatorLineChart({
  data,
  lines,
}: {
  data: Array<Record<string, string | number | null>>
  lines: Array<{ key: string; color: string; name?: string }>
}) {
  return <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 10 }} minTickGap={42} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#7f8da3', fontSize: 10 }} width={54} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        {lines.map((line) => <Line key={line.key} type="monotone" dataKey={line.key} name={line.name ?? line.key} stroke={line.color} dot={false} strokeWidth={1.8} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  </div>
}

export function RsiChart({ data }: { data: Array<{ date: string; rsi: number | null }> }) {
  return <div className="h-64">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 10 }} minTickGap={42} />
        <YAxis domain={[0, 100]} tick={{ fill: '#7f8da3', fontSize: 10 }} width={36} />
        <Tooltip contentStyle={tooltipStyle} />
        <ReferenceLine y={70} stroke="#f07178" strokeDasharray="4 4" />
        <ReferenceLine y={50} stroke="rgba(148,163,184,.3)" />
        <ReferenceLine y={30} stroke="#3ddea8" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="rsi" name="RSI" stroke="#e6b84d" dot={false} strokeWidth={2} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  </div>
}

export function ForecastFanChart({
  data,
  currentPrice,
  asOfDate,
}: {
  data: ForecastPoint[]
  currentPrice: number
  asOfDate: string
}) {
  const rows = [
    { date: asOfDate, predicted_price: currentPrice, lower_price: currentPrice, upper_price: currentPrice, band: [currentPrice, currentPrice] },
    ...data.map((point) => ({ ...point, band: [point.lower_price, point.upper_price] })),
  ]
  return <div className="h-80">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 12, right: 14, bottom: 0, left: 10 }}>
        <defs>
          <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b8cff" stopOpacity={.32} />
            <stop offset="100%" stopColor="#5b8cff" stopOpacity={.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 10 }} tickFormatter={(value) => String(value).slice(5)} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#7f8da3', fontSize: 10 }} width={68} tickFormatter={(v) => `₹${Number(v).toFixed(0)}`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [money(value), name.replace(/_/g, ' ')]} />
        <Area dataKey="band" name="Expected range" stroke="none" fill="url(#forecastBand)" />
        <Line type="monotone" dataKey="predicted_price" name="AI estimate" stroke="#3ddea8" strokeWidth={2.6} dot={{ r: 2, fill: '#3ddea8' }} />
        <Line type="monotone" dataKey="lower_price" name="Lower range" stroke="#5b8cff" strokeOpacity={.35} strokeDasharray="3 3" dot={false} />
        <Line type="monotone" dataKey="upper_price" name="Upper range" stroke="#5b8cff" strokeOpacity={.35} strokeDasharray="3 3" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
}

export function ValidationChart({ data }: { data: ValidationPoint[] }) {
  const rows = data.map((point) => ({
    ...point,
    date: point.date.slice(5),
    predicted: point.predicted_return * 100,
    actual: point.actual_return * 100,
  }))
  return <div className="h-72">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows}>
        <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#7f8da3', fontSize: 10 }} minTickGap={35} />
        <YAxis tick={{ fill: '#7f8da3', fontSize: 10 }} width={48} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${Number(v).toFixed(2)}%`]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke="rgba(148,163,184,.4)" />
        <Line type="monotone" dataKey="predicted" name="Predicted return" stroke="#5b8cff" dot={false} strokeWidth={1.8} />
        <Line type="monotone" dataKey="actual" name="Actual return" stroke="#3ddea8" dot={false} strokeWidth={1.8} />
      </LineChart>
    </ResponsiveContainer>
  </div>
}

export function ReturnRiskScatter({ data }: { data: Array<{ symbol: string; expected_return: number; volatility: number }> }) {
  const rows = data.map((item) => ({ ...item, expected: item.expected_return * 100, risk: item.volatility * 100 }))
  return <div className="h-72">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows}>
        <CartesianGrid stroke="rgba(148,163,184,.08)" vertical={false} />
        <XAxis dataKey="symbol" tick={{ fill: '#7f8da3', fontSize: 9 }} interval={0} />
        <YAxis tick={{ fill: '#7f8da3', fontSize: 10 }} width={46} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area dataKey="expected" name="Expected return %" stroke="#3ddea8" fill="rgba(61,222,168,.12)" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
}
