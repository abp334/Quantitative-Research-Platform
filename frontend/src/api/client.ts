const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string; database: string }>('/health'),
  dashboard: () => request('/dashboard/stats'),
  stocks: () => request('/data/stocks'),
  stock: (symbol: string) => request(`/data/stocks/${symbol}`),
  ohlcv: (symbol: string, params?: { limit?: number; start?: string; end?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.start) q.set('start', params.start)
    if (params?.end) q.set('end', params.end)
    const qs = q.toString()
    return request(`/data/stocks/${symbol}/ohlcv${qs ? `?${qs}` : ''}`)
  },
  stockStats: (symbol: string, params?: { start?: string; end?: string }) => {
    const q = new URLSearchParams()
    if (params?.start) q.set('start', params.start)
    if (params?.end) q.set('end', params.end)
    const qs = q.toString()
    return request(`/data/stocks/${symbol}/stats${qs ? `?${qs}` : ''}`)
  },
  importData: (force = false) =>
    request('/data/import', { method: 'POST', body: JSON.stringify({ force }) }),
  generateFeatures: (body?: {
    symbols?: string[]
    name?: string
    prediction_horizon?: number
  }) =>
    request('/features/generate', {
      method: 'POST',
      body: JSON.stringify(body ?? { name: 'default', prediction_horizon: 1 }),
    }),
  featureRuns: () => request('/features/runs'),
  symbolFeatures: (symbol: string, limit = 400) =>
    request(`/features/${symbol}?limit=${limit}`),
  train: (body?: Record<string, unknown>) =>
    request('/train', {
      method: 'POST',
      body: JSON.stringify(
        body ?? {
          symbols: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'SBIN'],
          algorithms: ['logistic_regression', 'random_forest', 'xgboost'],
          optuna_trials: 15,
          prediction_horizon: 1,
        },
      ),
    }),
  trainingJobs: () => request('/train/jobs'),
  trainingJob: (id: number) => request(`/train/jobs/${id}`),
  experiments: () => request('/experiments'),
  experiment: (id: number) => request(`/experiments/${id}`),
  models: () => request('/models'),
  compareModels: () => request('/models/compare'),
  modelImportance: (id: number) => request(`/models/${id}/importance`),
  predict: (body: {
    symbol: string
    model_id?: number
    prediction_horizon?: number
    auto_select?: boolean
  }) => request('/predict', { method: 'POST', body: JSON.stringify(body) }),
  explain: (id: number) => request(`/explain/${id}`),
  insights: () => request('/insights'),
  backtest: (body: Record<string, unknown>) =>
    request('/backtest', { method: 'POST', body: JSON.stringify(body) }),
  reportUrl: () => `${API_BASE}/reports/research.pdf`,
}
