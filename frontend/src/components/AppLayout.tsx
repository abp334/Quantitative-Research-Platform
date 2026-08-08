import { NavLink, Outlet } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Briefcase,
  FlaskConical,
  GitCompareArrows,
  History,
  LayoutDashboard,
  Radar,
  ShieldAlert,
  Star,
  TrendingUp,
} from 'lucide-react'
import { ErrorBoundary } from './ux'
import { useWatchlist } from '../lib/watchlist'

const navSections = [
  {
    label: 'Research',
    items: [
      { to: '/app', label: 'Quant Forecast', icon: LayoutDashboard, end: true },
      { to: '/app/scanner', label: 'Screener', icon: Radar },
      { to: '/app/pulse', label: 'Market Pulse', icon: Activity },
      { to: '/app/market', label: 'Technical Charts', icon: BarChart3 },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { to: '/app/compare', label: 'Compare', icon: GitCompareArrows },
      { to: '/app/lab', label: 'Forecast Lab', icon: FlaskConical },
      { to: '/app/portfolio', label: 'Portfolio Sim', icon: Briefcase },
      { to: '/app/risk-radar', label: 'Risk Radar', icon: ShieldAlert },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/app/watchlist', label: 'Watchlist', icon: Star },
      { to: '/app/track-record', label: 'Track Record', icon: History },
    ],
  },
]

export function AppLayout() {
  const watchlist = useWatchlist()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="sidebar-brand">
          <span className="sidebar-brand-icon">
            <TrendingUp />
          </span>
          <span className="sidebar-brand-text">
            <strong>QuantVista</strong>
            <span>NIFTY Intelligence</span>
          </span>
        </NavLink>

        {navSections.map((section) => (
          <div className="sidebar-section" key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon />
                <span>{label}</span>
                {to === '/app/watchlist' && watchlist.items.length > 0 && (
                  <span className="sidebar-badge">{watchlist.items.length}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      <div className="main-area">
        <div className="main-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
