import { NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Database,
  FlaskConical,
  GitCompare,
  LayoutDashboard,
  LineChart,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react'
import { ErrorBoundary } from './ux'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/data', label: 'Data Explorer', icon: Database },
  { to: '/app/training', label: 'Training', icon: Wand2 },
  { to: '/app/models', label: 'Model Comparison', icon: GitCompare },
  { to: '/app/predict', label: 'Decide', icon: Target },
  { to: '/app/explain', label: 'Explainability', icon: Brain },
  { to: '/app/insights', label: 'Research Insights', icon: LineChart },
  { to: '/app/experiments', label: 'Experiments', icon: FlaskConical },
  { to: '/app/backtest', label: 'Backtesting', icon: BarChart3 },
  { to: '/app/report', label: 'Report', icon: BookOpen },
]

export function AppLayout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-[var(--color-line)] glass-strong hidden md:flex flex-col">
        <div className="px-5 py-6 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-ink" />
            </div>
            <div>
              <div className="display text-lg font-bold tracking-tight">Nexus Quant</div>
              <div className="text-xs text-[var(--color-muted)]">Explainable Research</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-[rgba(61,222,168,0.12)] text-[var(--color-accent)] border border-[rgba(61,222,168,0.25)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-[var(--color-line)] text-xs text-[var(--color-muted)] flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          Walk-forward · SHAP · Optuna
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 border-b border-[var(--color-line)] glass px-4 md:px-8 py-4">
          <h1 className="display text-xl md:text-2xl font-bold">Quantitative Research Platform</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Understand market behaviour through explainable machine learning
          </p>
        </header>
        <motion.div
          className="p-4 md:p-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </motion.div>
      </main>
    </div>
  )
}
