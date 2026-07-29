import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react'

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
            <p className="text-lg md:text-xl text-[var(--color-muted)] max-w-2xl mx-auto mt-7 leading-relaxed">
              Explore NIFTY stocks and generate a complete AI price path, expected range, return estimate and historical reliability check.
            </p>
            <div className="mt-9 flex justify-center">
              <Link to="/app" className="hero-button">Explore stock outlooks <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-7 text-xs text-[var(--color-muted)]">
              {['Multi-session price paths', 'AI market scanner', 'Visible forecast track record'].map((x) => <span key={x} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />{x}</span>)}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }} className="relative z-10 max-w-4xl mx-auto mt-20 glass rounded-3xl p-4 md:p-6 border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-5 border-b border-[var(--color-line)]">
              <div><span className="text-xs text-[var(--color-muted)]">Sample outlook</span><h3 className="display text-xl font-bold mt-1">RELIANCE</h3></div>
              <span className="text-[var(--color-accent)] bg-[rgba(61,222,168,.1)] rounded-lg px-3 py-1.5 text-xs">Positive bias</span>
            </div>
            <div className="grid md:grid-cols-3 gap-4 mt-5">
              <div className="landing-metric"><span>Base estimate</span><strong>₹2,084</strong></div>
              <div className="landing-metric"><span>Expected range</span><strong className="!text-lg">₹1,970–₹2,170</strong></div>
              <div className="landing-metric"><span>Market regime</span><strong className="text-[var(--color-accent)] !text-lg">Bullish trend</strong></div>
            </div>
            <div className="h-28 mt-5 flex items-end gap-1.5 px-2">
              {[26,34,29,42,38,50,47,56,52,65,59,70,66,78,74,88].map((h,i) => <span key={i} className="flex-1 rounded-t bg-gradient-to-t from-[rgba(61,222,168,.15)] to-[rgba(61,222,168,.7)]" style={{height:`${h}%`}} />)}
            </div>
          </motion.div>
        </section>

        <section className="border-t border-[var(--color-line)] bg-black/10">
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 grid md:grid-cols-3 gap-6">
            {[
              [BarChart3, 'Understand the past', 'Interactive price, volume, volatility and momentum charts keep the focus on the stock.'],
              [BrainCircuit, 'Forecast price and risk', 'Get a daily price path, range, bull/base/bear scenarios, market regime and confidence assessment.'],
              [TrendingUp, 'Scan and verify', 'Rank the stock universe, then inspect held-out historical results before trusting any forecast.'],
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
