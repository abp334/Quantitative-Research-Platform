const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch {
      // Keep the HTTP status text when the response is not JSON.
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string; database: string }>('/health'),
  stocks: () => request('/data/stocks'),
  stock: (symbol: string) => request(`/data/stocks/${symbol}`),
  ohlcv: (symbol: string, params?: { limit?: number; start?: string; end?: string }) => {
    const q = new URLSearchParams()
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.start) q.set('start', params.start)
    if (params?.end) q.set('end', params.end)
    return request(`/data/stocks/${symbol}/ohlcv${q.size ? `?${q}` : ''}`)
  },
  stockStats: (symbol: string, params?: { start?: string; end?: string }) => {
    const q = new URLSearchParams()
    if (params?.start) q.set('start', params.start)
    if (params?.end) q.set('end', params.end)
    return request(`/data/stocks/${symbol}/stats${q.size ? `?${q}` : ''}`)
  },
  forecast: (body: { symbol: string; horizon_days: number }) =>
    request('/forecast', { method: 'POST', body: JSON.stringify(body) }),
  scanner: (horizon = 5, limit = 50) =>
    request(`/market/scanner?horizon=${horizon}&limit=${limit}`),
}
