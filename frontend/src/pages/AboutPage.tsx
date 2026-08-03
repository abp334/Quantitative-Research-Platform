import { Card } from '../components/ui'

export function AboutPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Card title="Nexus Quant" subtitle="AI-Powered Quantitative Stock Research Platform">
        <div className="space-y-4 text-sm leading-relaxed text-[var(--color-muted)]">
          <p>
            Nexus Quant is an explainable machine learning platform for next-day directional
            prediction on the NIFTY-50 universe (Rohan Rao Kaggle dataset, 2000–2021 daily OHLCV).
          </p>
          <p>
            The stack emphasizes feature engineering, walk-forward validation, Optuna
            hyperparameter search, model comparison, and SHAP-based explainability — not LSTM
            black boxes.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Backend: FastAPI · SQLAlchemy · Alembic · PostgreSQL</li>
            <li>ML: Scikit-Learn · XGBoost · Optuna · SHAP</li>
            <li>Frontend: React · TypeScript · Tailwind · Recharts · TanStack Query</li>
            <li>Infra: Docker Compose</li>
          </ul>
          <p className="text-xs">
            Research tool only. Not investment advice. Past patterns do not guarantee future results.
          </p>
        </div>
      </Card>
    </div>
  )
}
