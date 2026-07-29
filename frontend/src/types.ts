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

export type Prediction = {
  id: number
  symbol: string
  as_of_date: string
  label: 'UP' | 'DOWN'
  probability_up: number
  confidence: number
  prediction_horizon: number
  summary_text?: string | null
}
