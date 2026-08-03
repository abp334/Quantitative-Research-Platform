import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button } from '../components/ui'

export function LandingPage() {
  const stats = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard() as Promise<Record<string, unknown>>,
    retry: false,
  })

  const counters = [
    { label: 'NIFTY Stocks', value: Number(stats.data?.stock_count ?? 50) },
    { label: 'OHLCV Bars', value: Number(stats.data?.bar_count ?? 235000) },
    { label: 'Models', value: Number(stats.data?.model_count ?? 0) },
    { label: 'Predictions', value: Number(stats.data?.prediction_count ?? 0) },
  ]

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden px-6 md:px-12 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto"
        >
          <div className="display text-sm tracking-[0.2em] uppercase text-[var(--color-accent)] mb-4">
            Nexus Quant
          </div>
          <h1 className="display text-4xl md:text-6xl font-extrabold leading-tight max-w-3xl">
            Explainable Quantitative Research Platform
          </h1>
          <p className="mt-5 text-lg text-[var(--color-muted)] max-w-2xl">
            Not a stock tip engine — a classical ML research system for understanding
            NIFTY-50 market behaviour with walk-forward validation and SHAP explanations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app">
              <Button>Launch Platform</Button>
            </Link>
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
              <Button variant="ghost">API Docs</Button>
            </a>
          </div>
        </motion.div>

        <div className="max-w-5xl mx-auto mt-14 grid grid-cols-2 md:grid-cols-4 gap-4">
          {counters.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="glass rounded-2xl p-4"
            >
              <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                {c.label}
              </div>
              <div className="display text-2xl font-bold mono mt-2">
                {c.value.toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 py-16 border-t border-[var(--color-line)]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            {
              t: 'Feature Engineering',
              d: 'SMA, EMA, RSI, MACD, ATR, Bollinger, lags and returns — built manually without TA-Lib.',
            },
            {
              t: 'Walk-Forward ML',
              d: 'Logistic Regression, Random Forest and XGBoost with Optuna — never random time splits.',
            },
            {
              t: 'Explainability',
              d: 'Every prediction ships with SHAP drivers, confidence, and a research narrative.',
            },
          ].map((f) => (
            <div key={f.t} className="glass rounded-2xl p-6">
              <h3 className="display text-lg font-semibold">{f.t}</h3>
              <p className="text-sm text-[var(--color-muted)] mt-2">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 py-16 border-t border-[var(--color-line)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="display text-2xl font-bold mb-4">Technology Stack</h2>
          <p className="text-[var(--color-muted)] text-sm mb-6">
            FastAPI · PostgreSQL · Scikit-Learn · XGBoost · Optuna · SHAP · React · Recharts · Docker
          </p>
          <h2 className="display text-2xl font-bold mb-4">Dataset</h2>
          <p className="text-[var(--color-muted)] text-sm max-w-3xl">
            Rohan Rao NIFTY-50 daily OHLCV (≈2000–2021). Data is preloaded into PostgreSQL —
            researchers never upload CSVs. Focus on stocks, horizons, models and experiments.
          </p>
          <div className="mt-8">
            <Link to="/app">
              <Button>Enter the Research Console</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
