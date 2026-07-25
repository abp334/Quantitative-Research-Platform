/** Labels and definitions pitched at quants / equity analysts — not retail dumbing-down. */

export type GlossaryEntry = { label: string; definition: string; category: string }

const FEATURE_DEFS: Record<string, GlossaryEntry> = {
  sma_5: {
    label: 'SMA(5)',
    category: 'Trend',
    definition: '5-session simple moving average of close. Short-horizon trend anchor.',
  },
  sma_10: {
    label: 'SMA(10)',
    category: 'Trend',
    definition: '10-session SMA. Intermediate short-term trend level.',
  },
  sma_20: {
    label: 'SMA(20)',
    category: 'Trend',
    definition: '20-session SMA ≈ one trading month. Common mean-reversion / trend filter.',
  },
  sma_50: {
    label: 'SMA(50)',
    category: 'Trend',
    definition: '50-session SMA. Medium-term trend; crosses with price often used as regime cues.',
  },
  ema_12: {
    label: 'EMA(12)',
    category: 'Trend',
    definition: '12-session exponential MA. Faster response than SMA; MACD fast leg.',
  },
  ema_26: {
    label: 'EMA(26)',
    category: 'Trend',
    definition: '26-session EMA. MACD slow leg; smoother trend estimate.',
  },
  rsi_14: {
    label: 'RSI(14)',
    category: 'Momentum',
    definition:
      '14-session Relative Strength Index (0–100). >70 often overbought, <30 oversold; here used as a continuous feature, not a hard rule.',
  },
  macd: {
    label: 'MACD line',
    category: 'Momentum',
    definition: 'EMA(12) − EMA(26). Positive = shorter trend above longer; measures momentum divergence.',
  },
  macd_signal: {
    label: 'MACD signal',
    category: 'Momentum',
    definition: 'EMA of the MACD line. Crossovers with MACD are classic timing signals.',
  },
  macd_hist: {
    label: 'MACD histogram',
    category: 'Momentum',
    definition: 'MACD − signal. Expanding histogram = accelerating momentum in that direction.',
  },
  atr_14: {
    label: 'ATR(14)',
    category: 'Volatility',
    definition: '14-session Average True Range. Absolute volatility / gap risk in price units.',
  },
  bb_upper: {
    label: 'Bollinger upper',
    category: 'Volatility',
    definition: 'Upper Bollinger band (typically mid + 2σ). Stretch above often flags rich valuation vs recent vol.',
  },
  bb_mid: {
    label: 'Bollinger mid',
    category: 'Volatility',
    definition: 'Bollinger midline (usually SMA of close). Local mean for %B and width.',
  },
  bb_lower: {
    label: 'Bollinger lower',
    category: 'Volatility',
    definition: 'Lower Bollinger band (mid − 2σ). Stretch below often flags cheap vs recent vol.',
  },
  bb_width: {
    label: 'Bollinger width',
    category: 'Volatility',
    definition: '(Upper − lower) / mid. Compression (squeeze) vs expansion regimes.',
  },
  bb_pct: {
    label: 'Bollinger %B',
    category: 'Volatility',
    definition: 'Close position within the bands (0 = lower, 1 = upper). Relative richness vs local vol envelope.',
  },
  momentum_10: {
    label: 'Momentum(10)',
    category: 'Momentum',
    definition: 'Close − close₁₀. Absolute 10-session price change.',
  },
  roc_10: {
    label: 'ROC(10)',
    category: 'Momentum',
    definition: '10-session rate of change (%). Scale-free momentum.',
  },
  rolling_mean_10: {
    label: 'Roll mean(10)',
    category: 'Returns',
    definition: '10-session rolling mean of returns. Short-horizon drift.',
  },
  rolling_std_10: {
    label: 'Roll std(10)',
    category: 'Volatility',
    definition: '10-session rolling std of returns. Near-term realized vol.',
  },
  daily_return: {
    label: 'Daily return',
    category: 'Returns',
    definition: 'Close-to-close simple return for the session.',
  },
  log_return: {
    label: 'Log return',
    category: 'Returns',
    definition: 'ln(closeₜ / closeₜ₋₁). Additive over time; preferred for vol maths.',
  },
  rolling_volatility_20: {
    label: 'Vol(20)',
    category: 'Volatility',
    definition: '20-session rolling return volatility. Realized risk regime.',
  },
  close_lag_1: {
    label: 'Close t−1',
    category: 'Lags',
    definition: 'Prior session close. Autoregressive price level context.',
  },
  close_lag_2: {
    label: 'Close t−2',
    category: 'Lags',
    definition: 'Close two sessions ago.',
  },
  close_lag_3: {
    label: 'Close t−3',
    category: 'Lags',
    definition: 'Close three sessions ago.',
  },
  close_lag_5: {
    label: 'Close t−5',
    category: 'Lags',
    definition: 'Close one trading week ago (approx).',
  },
  close_lag_10: {
    label: 'Close t−10',
    category: 'Lags',
    definition: 'Close two trading weeks ago (approx).',
  },
  return_lag_1: {
    label: 'Return t−1',
    category: 'Lags',
    definition: 'Prior session return. Short-horizon autocorrelation / reversal cue.',
  },
  return_lag_2: {
    label: 'Return t−2',
    category: 'Lags',
    definition: 'Return two sessions ago.',
  },
  return_lag_3: {
    label: 'Return t−3',
    category: 'Lags',
    definition: 'Return three sessions ago.',
  },
  return_lag_5: {
    label: 'Return t−5',
    category: 'Lags',
    definition: 'Return five sessions ago.',
  },
  return_lag_10: {
    label: 'Return t−10',
    category: 'Lags',
    definition: 'Return ten sessions ago.',
  },
  volume_change: {
    label: 'Volume Δ',
    category: 'Flow',
    definition: 'Session-over-session volume change. Participation / liquidity shock proxy.',
  },
  price_change: {
    label: 'Price Δ',
    category: 'Returns',
    definition: 'Absolute close change vs prior session.',
  },
  high_low_range: {
    label: 'H–L range',
    category: 'Volatility',
    definition: 'Intraday high−low. Session range / intraday risk.',
  },
  close_open_return: {
    label: 'Close/Open',
    category: 'Returns',
    definition: 'Close relative to open (session body return). Direction of the day’s auction.',
  },
}

export const METRIC_DEFS: Record<string, string> = {
  'ROC AUC':
    'Area under the ROC curve. Probability that a random UP day ranks above a random DOWN day. 0.50 = coin flip; higher is better discrimination.',
  Accuracy:
    'Share of correct UP/DOWN calls on the evaluation folds. Sensitive to class imbalance — pair with precision/recall.',
  Precision:
    'Of all UP predictions, the fraction that were actually UP. High precision → fewer false bullish calls.',
  Recall:
    'Of all actual UP days, the fraction the model caught. High recall → fewer missed rallies.',
  F1: 'Harmonic mean of precision and recall. Balances false bullish vs missed UP days.',
  Confidence:
    'Distance of P(UP) from 0.5, scaled to [0,1]. High confidence = model is decisive, not necessarily correct. Not a calibrated hit-rate.',
  'P(UP)':
    'Model-estimated probability that the forward return over the prediction horizon is positive.',
  SHAP:
    'Shapley attribution: each feature’s contribution to moving the log-odds / probability from the background baseline toward this prediction. Positive SHAP pushes toward UP; negative toward DOWN.',
  'Global importance':
    'Mean absolute SHAP (or native impurity importance) across the training sample. Which inputs the model relies on in aggregate — not which ones drove today’s call.',
  'Local explanation':
    'Feature attributions for one as-of date. Answers: given this bar’s indicators, why did the model lean UP or DOWN?',
  Waterfall:
    'Cumulative SHAP path from baseline toward the final score. Bars show how each feature adds or subtracts probability mass.',
  'Force plot':
    'Same SHAP values, split into bullish (positive) vs bearish (negative) contributors. Useful for opposing pressures.',
  'Model conviction':
    'Average prediction confidence by symbol in the stored prediction archive. High = model usually posts decisive P(UP); low = frequent near-coin-flip scores. Not out-of-sample accuracy.',
  'Label mix':
    'Count of UP vs DOWN labels in recent predictions. Persistent skew may reflect regime or model bias — check against actual market drift.',
  Correlation:
    'Pearson correlation between feature series in a sample window. High |ρ| → redundant inputs; interpret importance jointly.',
}

export function featureLabel(key: string): string {
  if (!key) return '—'
  if (FEATURE_DEFS[key]) return FEATURE_DEFS[key].label
  // Already humanized (e.g. from a prior pass)
  if (key.includes('(') || key.includes('−') || key.includes(' ')) return key
  if (key.startsWith('sma_')) return `SMA(${key.slice(4)})`
  if (key.startsWith('ema_')) return `EMA(${key.slice(4)})`
  if (key.startsWith('close_lag_')) return `Close t−${key.slice('close_lag_'.length)}`
  if (key.startsWith('return_lag_')) return `Return t−${key.slice('return_lag_'.length)}`
  if (key.startsWith('rsi_')) return `RSI(${key.slice(4)})`
  if (key.startsWith('atr_')) return `ATR(${key.slice(4)})`
  return key
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function featureDefinition(key: string): string {
  if (FEATURE_DEFS[key]) return FEATURE_DEFS[key].definition
  return `Engineered input \`${key}\` used by the classifier.`
}

export function featureCategory(key: string): string {
  return FEATURE_DEFS[key]?.category ?? 'Feature'
}

export function formatPct(x: number | null | undefined, digits = 1): string {
  if (x == null || Number.isNaN(x)) return '—'
  return `${(x * 100).toFixed(digits)}%`
}

export function formatScore(x: number | null | undefined, digits = 3): string {
  if (x == null || Number.isNaN(x)) return '—'
  return x.toFixed(digits)
}

export function shapDirection(shap: number): 'bullish' | 'bearish' {
  return shap >= 0 ? 'bullish' : 'bearish'
}

export function withFriendlyFeatureNames<T extends { feature: string }>(
  rows: T[],
): Array<T & { featureKey: string; feature: string }> {
  return rows.map((r) => ({
    ...r,
    featureKey: r.feature,
    feature: featureLabel(r.feature),
  }))
}

export const FEATURE_GLOSSARY = Object.entries(FEATURE_DEFS).map(([key, v]) => ({
  key,
  ...v,
}))
