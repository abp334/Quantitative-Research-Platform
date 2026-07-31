import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  GitCompareArrows,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden">
      <nav className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center"><Sparkles className="h-4 w-4 text-[#061018]" /></span>
          <span className="display text-xl font-bold">Nexus</span>
        </div>
        <Link to="/app" className="rounded-xl border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-white/5">Open app</Link>
      </nav>

      <main>
        <section className="relative max-w-7xl mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-28">
          <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-4xl mx-auto text-center">
            <div className="eyebrow"><BrainCircuit className="h-4 w-4" /> Market intelligence, made simple</div>
            <h1 className="display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mt-6">
              See what a stock’s history <span className="text-gradient">suggests comes next.</span>
            </h1>
            <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-3xl mx-auto mt-7 leading-relaxed">
              Explore the market, compare stocks, stress-test multi-horizon forecasts and keep a private research watchlist—all grounded in visible historical evidence.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link to="/app" className="hero-button">Explore stock outlooks <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/app/pulse" className="rounded-xl border border-[var(--color-line)] px-5 py-3 text-sm hover:bg-white/5 transition">Open Market Pulse</Link>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-7 text-xs text-[var(--color-muted)]">
              {['Three-horizon scenario lab', 'Relative-value comparison', 'Persistent research watchlist', 'Visible forecast track record'].map((x) => <span key={x} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />{x}</span>)}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }} className="relative z-10 max-w-4xl mx-auto mt-20 glass rounded-3xl p-4 md:p-6 border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-5 border-b border-[var(--color-line)]">
              <div><span className="text-xs text-[var(--color-muted)]">Inside Nexus</span><h3 className="display text-xl font-bold mt-1">A complete research workspace</h3></div>
              <span className="text-[var(--color-accent)] bg-[rgba(61,222,168,.1)] rounded-lg px-3 py-1.5 text-xs">Interactive, not precomputed</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {[
                [Activity, 'Market Pulse', 'Breadth & leadership'],
                [GitCompareArrows, 'Compare', 'Return, risk & correlation'],
                [FlaskConical, 'Forecast Lab', 'Capital stress testing'],
                [Star, 'Watchlist', 'Notes & thesis levels'],
              ].map(([Icon, title, subtitle]) => {
                const I = Icon as typeof Activity
                return <div className="landing-workspace-card" key={String(title)}><I /><strong>{String(title)}</strong><span>{String(subtitle)}</span></div>
              })}
            </div>
            <div className="landing-workflow mt-5">
              {['Choose real archive data', 'Generate on demand', 'Challenge the range', 'Save your thesis'].map((step, index) => <div key={step}><i>{index + 1}</i><span>{step}</span></div>)}
            </div>
          </motion.div>
        </section>

        <section className="border-t border-[var(--color-line)] bg-black/10">
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[
              [BarChart3, 'Understand the past', 'Interactive price, volume, volatility and momentum charts keep the focus on the stock.'],
              [BrainCircuit, 'Forecast price and risk', 'Get a daily price path, range, bull/base/bear scenarios, market regime and confidence assessment.'],
              [TrendingUp, 'Compare and challenge', 'Contrast return, drawdown and correlation, then stress-test all three forecast horizons.'],
              [Star, 'Build your process', 'Save names, attach thesis levels and notes, then revisit the evidence as one research workspace.'],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof BarChart3
              return <div key={String(title)} className="feature-card"><I className="h-6 w-6 text-[var(--color-accent)]" /><h3 className="display text-xl font-semibold mt-5">{String(title)}</h3><p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{String(body)}</p></div>
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
