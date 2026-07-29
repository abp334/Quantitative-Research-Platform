import { NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, History, LayoutDashboard, Radar, Sparkles } from 'lucide-react'
import { ErrorBoundary } from './ux'

const nav = [
  { to: '/app', label: 'AI forecast', icon: LayoutDashboard, end: true },
  { to: '/app/scanner', label: 'AI scanner', icon: Radar },
  { to: '/app/market', label: 'Market charts', icon: BarChart3 },
  { to: '/app/track-record', label: 'Track record', icon: History },
]

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)] glass-strong">
        <div className="max-w-7xl mx-auto h-16 px-4 md:px-8 flex items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-[#061018]" />
            </span>
            <span>
              <span className="display block text-lg font-bold leading-none">Nexus</span>
              <span className="text-[10px] text-[var(--color-muted)] tracking-[.16em] uppercase">Market intelligence</span>
            </span>
          </NavLink>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    isActive ? 'bg-white/10 text-white' : 'text-[var(--color-muted)] hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <motion.main
        className="max-w-7xl mx-auto px-4 md:px-8 py-7 md:py-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ErrorBoundary><Outlet /></ErrorBoundary>
      </motion.main>
    </div>
  )
}
