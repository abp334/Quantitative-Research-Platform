import { useMemo, useState } from 'react'
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
  background: '#121622',
  border: '1px solid #262c40',
  borderRadius: 4,
  color: '#e1e4ea',
  fontSize: 11,
  fontFamily: 'Fira Code, monospace',
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
}

const money = (value: number) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const axisStyle = { fill: '#64748b', fontSize: 10, fontFamily: 'Fira Code, monospace' }

/* ── Technical Indicator Calculations ─────────────────────── */

export function calculateIndicators(bars: OhlcvBar[]) {
  const closes = bars.map((b) => b.close)
  const highs = bars.map((b) => b.high)
  const lows = bars.map((b) => b.low)
  const volumes = bars.map((b) => b.volume)

  // Moving averages
  const sma = (period: number, index: number) => {
    if (index < period - 1) return null
    const slice = closes.slice(index - period + 1, index + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  }

  const ema = (period: number) => {
    const res: Array<number | null> = new Array(bars.length).fill(null)
    const k = 2 / (period + 1)
    let prev: number | null = null
    for (let i = 0; i < bars.length; i++) {
      if (i < period - 1) continue
      if (i === period - 1) {
        const initialSma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
        res[i] = initialSma
        prev = initialSma
      } else if (prev !== null) {
        const val: number = closes[i] * k + (prev as number) * (1 - k)
        res[i] = val
        prev = val
      }
    }
    return res
  }

  const ema9 = ema(9)
  const ema21 = ema(21)

  // Bollinger Bands (20, 2)
  const bb = bars.map((_, i) => {
    const mean = sma(20, i)
    if (mean === null || i < 19) return { bbUpper: null, bbMiddle: null, bbLower: null }
    const slice = closes.slice(i - 19, i + 1)
    const variance = slice.reduce((acc, val) => acc + (val - mean) ** 2, 0) / 20
    const std = Math.sqrt(variance)
    return {
      bbUpper: mean + std * 2,
      bbMiddle: mean,
      bbLower: mean - std * 2,
    }
  })

  // Volume SMA 20
  const volSma20 = bars.map((_, i) => {
    if (i < 19) return null
    return volumes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20
  })

  // RSI 14
  const rsi14 = bars.map((_, i) => {
    if (i < 14) return null
    let gains = 0, losses = 0
    for (let j = i - 13; j <= i; j++) {
      const diff = closes[j] - closes[j - 1]
      if (diff >= 0) gains += diff
      else losses -= diff
    }
    const avgGain = gains / 14
    const avgLoss = losses / 14
    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  })

  // MACD (12, 26, 9)
  const ema12 = ema(12)
  const ema26 = ema(26)
  const macdLine = bars.map((_, i) => (ema12[i] !== null && ema26[i] !== null ? ema12[i]! - ema26[i]! : null))

  // Signal line (9 EMA of MACD)
  const validMacd = macdLine.filter((v): v is number => v !== null)
  const macdSignal: Array<number | null> = new Array(bars.length).fill(null)
  if (validMacd.length >= 9) {
    const k = 2 / (9 + 1)
    let prevSig = validMacd.slice(0, 9).reduce((a, b) => a + b, 0) / 9
    const firstIdx = macdLine.findIndex((v) => v !== null) + 8
    macdSignal[firstIdx] = prevSig
    for (let i = firstIdx + 1; i < bars.length; i++) {
      const currMacd = macdLine[i]
      if (currMacd !== null) {
        prevSig = currMacd * k + prevSig * (1 - k)
        macdSignal[i] = prevSig
      }
    }
  }

  const macdHist = macdLine.map((m, i) => (m !== null && macdSignal[i] !== null ? m - macdSignal[i]! : null))

  return bars.map((b, i) => ({
    ...b,
    date: b.date.slice(0, 10),
    sma20: sma(20, i),
    sma50: sma(50, i),
    ema9: ema9[i],
    ema21: ema21[i],
    bbUpper: bb[i].bbUpper,
    bbMiddle: bb[i].bbMiddle,
    bbLower: bb[i].bbLower,
    volSma20: volSma20[i],
    rsi: rsi14[i],
    macd: macdLine[i],
    macdSignal: macdSignal[i],
    macdHist: macdHist[i],
    rising: b.close >= b.open,
  }))
}

/* ── Custom Candlestick Renderer ─────────────────────────── */

function CandleShape(props: any) {
  const { x, y, width, height, payload } = props
  if (!payload || !Number.isFinite(height)) return null
  const { open, close, high, low } = payload
  const rising = close >= open
  const color = rising ? '#22c55e' : '#ef4444'
  const range = high - low || 1
  const scale = (value: number) => y + ((high - value) / range) * height
  const top = scale(Math.max(open, close))
  const bottom = scale(Math.min(open, close))
  const middle = x + width / 2
  return (
    <g>
      <line x1={middle} x2={middle} y1={scale(high)} y2={scale(low)} stroke={color} strokeWidth={1} />
      <rect
        x={x + width * 0.15}
        y={top}
        width={Math.max(width * 0.7, 2)}
        height={Math.max(bottom - top, 1.5)}
        fill={color}
        stroke={color}
      />
    </g>
  )
}

/* ── Comprehensive Trading Terminal Multi-Pane Chart ─────── */

export function ComprehensiveTechnicalChart({ data }: { data: OhlcvBar[] }) {
  const [activePane, setActivePane] = useState<'main' | 'rsi' | 'macd'>('main')
  const [showBB, setShowBB] = useState(true)
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(true)

  const rows = useMemo(() => calculateIndicators(data), [data])

  return (
    <div className="space-y-2">
      {/* Chart Technical Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-[#121622] border border-[#262c40] text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono text-[11px]">Indicators:</span>
          <button
            type="button"
            className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
              showSMA ? 'bg-[#1e293b] border-blue-500 text-blue-400' : 'bg-transparent border-[#262c40] text-slate-500'
            }`}
            onClick={() => setShowSMA(!showSMA)}
          >
            SMA (20, 50)
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
              showEMA ? 'bg-[#1e293b] border-amber-500 text-amber-400' : 'bg-transparent border-[#262c40] text-slate-500'
            }`}
            onClick={() => setShowEMA(!showEMA)}
          >
            EMA (9, 21)
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
              showBB ? 'bg-[#1e293b] border-purple-500 text-purple-400' : 'bg-transparent border-[#262c40] text-slate-500'
            }`}
            onClick={() => setShowBB(!showBB)}
          >
            Bollinger Bands
          </button>
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px]">
          <span className="text-slate-400">Sub-pane:</span>
          <button
            type="button"
            className={`px-2 py-1 rounded border ${activePane === 'main' ? 'bg-blue-600 border-blue-500 text-white' : 'border-[#262c40] text-slate-400'}`}
            onClick={() => setActivePane('main')}
          >
            Volume
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded border ${activePane === 'rsi' ? 'bg-blue-600 border-blue-500 text-white' : 'border-[#262c40] text-slate-400'}`}
            onClick={() => setActivePane('rsi')}
          >
            RSI (14)
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded border ${activePane === 'macd' ? 'bg-blue-600 border-blue-500 text-white' : 'border-[#262c40] text-slate-400'}`}
            onClick={() => setActivePane('macd')}
          >
            MACD
          </button>
        </div>
      </div>

      {/* Main Price Chart */}
      <div style={{ height: 320 }} className="bg-[#0f121a] border border-[#262c40] rounded p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 10, bottom: 0, left: 5 }}>
            <CartesianGrid stroke="#1e2436" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={axisStyle} minTickGap={45} />
            <YAxis domain={['auto', 'auto']} tick={axisStyle} width={65} tickFormatter={(v) => `₹${Number(v).toFixed(0)}`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name: string) => [money(val), name]} />

            {/* Bollinger Bands Shading */}
            {showBB && (
              <>
                <Line dataKey="bbUpper" stroke="rgba(168,85,247,0.4)" strokeDasharray="3 3" dot={false} strokeWidth={1} name="BB Upper" />
                <Line dataKey="bbLower" stroke="rgba(168,85,247,0.4)" strokeDasharray="3 3" dot={false} strokeWidth={1} name="BB Lower" />
              </>
            )}

            {/* Moving Averages */}
            {showSMA && <Line dataKey="sma20" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="SMA 20" />}
            {showSMA && <Line dataKey="sma50" stroke="#10b981" dot={false} strokeWidth={1.5} name="SMA 50" />}
            {showEMA && <Line dataKey="ema9" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="EMA 9" />}

            {/* Candlesticks */}
            <Bar dataKey="high" shape={<CandleShape />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary Indicator Sub-Pane */}
      <div style={{ height: 130 }} className="bg-[#0f121a] border border-[#262c40] rounded p-2">
        <ResponsiveContainer width="100%" height="100%">
          {activePane === 'main' ? (
            <ComposedChart data={rows}>
              <CartesianGrid stroke="#1e2436" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} minTickGap={45} />
              <YAxis tick={axisStyle} width={55} tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => [Number(val).toLocaleString('en-IN'), 'Volume']} />
              <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                {rows.map((row, index) => (
                  <Cell key={index} fill={row.rising ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'} />
                ))}
              </Bar>
              <Line dataKey="volSma20" stroke="#60a5fa" dot={false} strokeWidth={1.2} name="Vol SMA 20" />
            </ComposedChart>
          ) : activePane === 'rsi' ? (
            <LineChart data={rows}>
              <CartesianGrid stroke="#1e2436" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} minTickGap={45} />
              <YAxis domain={[0, 100]} tick={axisStyle} width={35} ticks={[30, 50, 70]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [Number(v).toFixed(2), 'RSI']} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine y={50} stroke="#475569" strokeDasharray="2 2" />
              <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" />
              <Line dataKey="rsi" stroke="#f59e0b" dot={false} strokeWidth={1.8} name="RSI (14)" connectNulls />
            </LineChart>
          ) : (
            <ComposedChart data={rows}>
              <CartesianGrid stroke="#1e2436" vertical={false} />
              <XAxis dataKey="date" tick={axisStyle} minTickGap={45} />
              <YAxis tick={axisStyle} width={50} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="#475569" />
              <Bar dataKey="macdHist" name="MACD Hist">
                {rows.map((r, i) => (
                  <Cell key={i} fill={(r.macdHist ?? 0) >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)'} />
                ))}
              </Bar>
              <Line dataKey="macd" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="MACD" connectNulls />
              <Line dataKey="macdSignal" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="Signal" connectNulls />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ── Seamless Historical + Forecast Fan Chart ────────────────── */

export function ForecastFanChart({
  data,
  currentPrice,
  asOfDate,
  historicalBars = [],
}: {
  data: ForecastPoint[]
  currentPrice: number
  asOfDate: string
  historicalBars?: OhlcvBar[]
}) {
  // Take last 20 historical sessions to prefix the forecast
  const recentHistory = historicalBars.slice(-20).map((b) => ({
    date: b.date.slice(0, 10),
    actual_close: b.close,
    predicted_price: null,
    lower_price: null,
    upper_price: null,
    band: null,
  }))

  const anchorPoint = {
    date: asOfDate,
    actual_close: currentPrice,
    predicted_price: currentPrice,
    lower_price: currentPrice,
    upper_price: currentPrice,
    band: [currentPrice, currentPrice],
  }

  const forecastPoints = data.map((pt) => ({
    date: pt.date,
    actual_close: null,
    predicted_price: pt.predicted_price,
    lower_price: pt.lower_price,
    upper_price: pt.upper_price,
    band: [pt.lower_price, pt.upper_price],
  }))

  const combined = [...recentHistory, anchorPoint, ...forecastPoints]

  return (
    <div style={{ height: 340 }} className="bg-[#0f121a] border border-[#262c40] rounded p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={combined} margin={{ top: 12, right: 14, bottom: 0, left: 10 }}>
          <defs>
            <linearGradient id="forecastChannel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e2436" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={axisStyle} tickFormatter={(val) => String(val).slice(5)} />
          <YAxis domain={['auto', 'auto']} tick={axisStyle} width={68} tickFormatter={(v) => `₹${Number(v).toFixed(0)}`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name: string) => [money(val), name.replace(/_/g, ' ')]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: 'Fira Code' }} />

          {/* Historical price line leading up to forecast */}
          <Line type="monotone" dataKey="actual_close" name="Historical Close" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls />

          {/* Forecast fan channel */}
          <Area dataKey="band" name="Uncertainty Channel" stroke="none" fill="url(#forecastChannel)" connectNulls />

          {/* Forecast target path */}
          <Line type="monotone" dataKey="predicted_price" name="Model Path (Base)" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3, fill: '#22c55e' }} connectNulls />

          {/* Bear & Bull scenarios */}
          <Line type="monotone" dataKey="lower_price" name="Bear Scenario (Lower)" stroke="#ef4444" strokeOpacity={0.7} strokeDasharray="3 3" dot={false} connectNulls />
          <Line type="monotone" dataKey="upper_price" name="Bull Scenario (Upper)" stroke="#3b82f6" strokeOpacity={0.7} strokeDasharray="3 3" dot={false} connectNulls />
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
    <div style={{ height: 260 }} className="bg-[#0f121a] border border-[#262c40] rounded p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#1e2436" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={axisStyle} minTickGap={42} />
          <YAxis domain={['auto', 'auto']} tick={axisStyle} width={54} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          {lines.map((line) => (
            <Line key={line.key} type="monotone" dataKey={line.key} name={line.name ?? line.key} stroke={line.color} dot={false} strokeWidth={1.8} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RsiChart({ data }: { data: Array<{ date: string; rsi: number | null }> }) {
  return (
    <div style={{ height: 260 }} className="bg-[#0f121a] border border-[#262c40] rounded p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#1e2436" vertical={false} />
          <XAxis dataKey="date" tick={axisStyle} minTickGap={42} />
          <YAxis domain={[0, 100]} tick={axisStyle} width={36} />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
          <ReferenceLine y={50} stroke="#475569" strokeDasharray="2 2" />
          <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="rsi" name="RSI" stroke="#f59e0b" dot={false} strokeWidth={1.8} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ValidationChart({ data }: { data: ValidationPoint[] }) {
  const rows = data.map((point) => ({
    ...point,
    date: point.date.slice(5),
    predicted: point.predicted_return * 100,
    actual: point.actual_return * 100,
  }))
  return (
    <div style={{ height: 280 }} className="bg-[#0f121a] border border-[#262c40] rounded p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="#1e2436" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={axisStyle} minTickGap={35} />
          <YAxis tick={axisStyle} width={48} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${Number(v).toFixed(2)}%`]} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: 'Fira Code' }} />
          <ReferenceLine y={0} stroke="#475569" />
          <Line type="monotone" dataKey="predicted" name="Model Return %" stroke="#3b82f6" dot={false} strokeWidth={1.8} />
          <Line type="monotone" dataKey="actual" name="Realised Return %" stroke="#22c55e" dot={false} strokeWidth={1.8} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ReturnRiskScatter({ data }: { data: Array<{ symbol: string; expected_return: number; volatility: number }> }) {
  const rows = data.map((item) => ({ ...item, expected: item.expected_return * 100, risk: item.volatility * 100 }))
  return (
    <div style={{ height: 280 }} className="bg-[#0f121a] border border-[#262c40] rounded p-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}>
          <CartesianGrid stroke="#1e2436" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="symbol" tick={axisStyle} interval={0} />
          <YAxis tick={axisStyle} width={46} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area dataKey="expected" name="Expected Return %" stroke="#22c55e" fill="rgba(34,197,94,0.15)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
