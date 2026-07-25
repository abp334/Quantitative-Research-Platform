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

export type DashboardStats = {
  stock_count: number
  bar_count: number
  feature_run_count: number
  model_count: number
  prediction_count: number
  latest_feature_run?: FeatureRun | null
  latest_training_job?: TrainingJob | null
}

export type FeatureRun = {
  id: number
  name: string
  status: string
  row_count: number
  symbol_count: number
  created_at: string
  finished_at?: string | null
}

export type TrainingJob = {
  id: number
  status: string
  config: Record<string, unknown>
  progress?: string | null
  error_message?: string | null
  feature_run_id?: number | null
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}

export type ModelMetric = {
  fold: number
  accuracy?: number | null
  precision?: number | null
  recall?: number | null
  f1?: number | null
  roc_auc?: number | null
  confusion_matrix?: number[][] | null
  roc_curve?: { fpr: number[]; tpr: number[]; thresholds: number[] } | null
  learning_curve?: {
    train_sizes: number[]
    train_scores: number[]
    val_scores: number[]
  } | null
}

export type ModelArtifact = {
  id: number
  name: string
  algorithm: string
  best_params?: Record<string, unknown> | null
  feature_names?: string[] | null
  global_importance?: Record<string, number> | null
  feature_run_id?: number | null
  training_job_id?: number | null
  is_active: boolean
  created_at: string
  metrics: ModelMetric[]
  meta?: Record<string, unknown> | null
  prediction_horizon?: number | null
}

export type ShapContribution = {
  feature: string
  value: number
  shap: number
}

export type Prediction = {
  id: number
  model_id: number
  symbol: string
  as_of_date: string
  label: string
  probability_up: number
  confidence: number
  top_features: ShapContribution[]
  positive_contributions: ShapContribution[]
  negative_contributions: ShapContribution[]
}

export type FeatureRow = {
  date: string
  features: Record<string, number>
  target?: number | null
  target_label?: string | null
}
