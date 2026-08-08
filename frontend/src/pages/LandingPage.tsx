import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  FlaskConical,
  GitCompareArrows,
  Radar,
  ShieldAlert,
  Star,
  TrendingUp,
} from 'lucide-react'

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <nav className="landing-nav">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text-primary)' }}>
          <span className="sidebar-brand-icon"><TrendingUp /></span>
          <strong style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18 }}>QuantVista</strong>
        </Link>
        <Link to="/app" className="btn btn-ghost">Open Platform</Link>
      </nav>

      <section className="landing-hero">
        <h1>
          NIFTY stock intelligence,{' '}
          <span className="hero-accent">powered by AI.</span>
        </h1>
        <p className="hero-subtitle">
          Explore multi-horizon price forecasts, compare stocks, stress-test scenarios, and build research portfolios — all grounded in historical evidence.
        </p>
        <Link to="/app" className="landing-cta">
          Start Exploring <ArrowRight style={{ width: 16, height: 16 }} />
        </Link>
      </section>

      <section className="landing-features">
        {[
          [BarChart3, 'Price Forecasting', 'Get 5, 10, and 20-session price path predictions with uncertainty bands, scenarios, and confidence scores.'],
          [Radar, 'AI Scanner', 'Rank the entire NIFTY universe by forecast strength, expected return, and risk. Find opportunities faster.'],
          [Activity, 'Market Pulse', 'Understand whether the market is broadly constructive or defensive with sector breadth and leadership analysis.'],
          [GitCompareArrows, 'Stock Comparison', 'Compare up to 4 stocks with normalized charts, risk metrics, drawdown analysis, and return correlation.'],
          [FlaskConical, 'Forecast Lab', 'Run all three horizons at once, translate ranges into capital outcomes, and stress-test your own thresholds.'],
          [Briefcase, 'Portfolio Simulator', 'Build virtual portfolios, allocate weights, and see combined risk metrics like Sharpe ratio and max drawdown.'],
          [ShieldAlert, 'Risk Radar', 'Birds-eye risk view with volatility heatmap, sector risk breakdown, and correlation analysis.'],
          [Star, 'Research Watchlist', 'Save stocks with thesis prices and notes. Track forecast signals for your names in one place.'],
        ].map(([Icon, title, desc]) => {
          const I = Icon as typeof BarChart3
          return (
            <div className="landing-feature-card" key={String(title)}>
              <I style={{ width: 24, height: 24 }} />
              <h3>{String(title)}</h3>
              <p>{String(desc)}</p>
            </div>
          )
        })}
      </section>

      <section className="landing-stats">
        <div className="landing-stat">
          <div className="stat-value">50+</div>
          <div className="stat-label">NIFTY stocks tracked</div>
        </div>
        <div className="landing-stat">
          <div className="stat-value">3</div>
          <div className="stat-label">Forecast horizons</div>
        </div>
        <div className="landing-stat">
          <div className="stat-value">30+</div>
          <div className="stat-label">Technical features</div>
        </div>
        <div className="landing-stat">
          <div className="stat-value">3</div>
          <div className="stat-label">ML models in ensemble</div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 32px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        Research software only. Forecast ranges are probabilistic and are not investment advice. Data through April 2021.
      </footer>
    </div>
  )
}
