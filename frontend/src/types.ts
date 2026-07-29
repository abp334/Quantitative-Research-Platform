export type Stock = {
  id: number
  symbol: string
  company_name?: string | null
  industry?: string | null
  series?: string | null
  isin?: string | null
}

export type OhlcvBar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwap?: number | null
}

export type ForecastPoint = {
  day: number
  date: string
  predicted_price: number
  lower_price: number
  upper_price: number
  predicted_return: number
}

export type ForecastFactor = {
  name: string
  state: 'positive' | 'negative' | 'neutral'
  score: number
  description: string
}

export type ValidationPoint = {
  date: string
  predicted_return: number
  actual_return: number
  direction_correct: boolean
}

export type Forecast = {
  symbol: string
  company_name?: string | null
  industry?: string | null
  as_of_date: string
  current_price: number
  horizon_days: number
  bias: 'Bullish' | 'Bearish' | 'Neutral'
  probability_up: number
  confidence: number
  expected_return: number
  target_price: number
  expected_low: number
  expected_high: number
  forecast_points: ForecastPoint[]
  scenarios: Record<'bear' | 'base' | 'bull', {
    label: string
    price: number
    return: number
  }>
  market_context: {
    regime: string
    risk_level: string
    annualized_volatility: number
    support: number
    resistance: number
    rsi: number
    volume_ratio: number
  }
  factors: ForecastFactor[]
  narrative: string
  validation: {
    direction_accuracy: number
    mae_percent: number
    rmse_percent: number
    interval_coverage: number
    validation_samples: number
    recent: ValidationPoint[]
  }
}

export type ScannerItem = {
  symbol: string
  company_name?: string | null
  industry?: string | null
  as_of_date: string
  last_price: number
  expected_return: number
  probability_up: number
  validation_accuracy: number
  volatility: number
  score: number
}
