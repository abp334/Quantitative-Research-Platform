import { AlertTriangle, BarChart3, LockKeyhole, Sparkles } from 'lucide-react'
import { Card } from '../components/ui'

export function AboutPage() {
  return <div className="max-w-4xl space-y-6">
    <div><p className="eyebrow w-fit">About Nexus</p><h1 className="display text-4xl font-bold mt-4">Stock intelligence without the complexity</h1><p className="text-[var(--color-muted)] mt-3 leading-relaxed">Nexus turns historical NIFTY market data into an accessible short-term directional outlook. You choose the stock and horizon; the analytical system handles the rest.</p></div>
    <div className="grid md:grid-cols-3 gap-4">
      {[[BarChart3,'Market-first','Every visible chart and metric describes the stock—not the machinery behind it.'],[Sparkles,'Simple by design','There are no training controls, algorithms to select, or experiments to manage.'],[LockKeyhole,'Managed analysis','Data preparation and prediction happen privately inside the service.']].map(([I,t,d]) => { const Icon=I as typeof BarChart3; return <Card key={String(t)}><Icon className="h-6 w-6 text-[var(--color-accent)]"/><h2 className="display text-lg font-semibold mt-4">{String(t)}</h2><p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{String(d)}</p></Card>})}
    </div>
    <Card><div className="flex gap-3"><AlertTriangle className="h-5 w-5 text-[var(--color-warning)] shrink-0"/><div><h2 className="font-semibold">Important limitation</h2><p className="text-sm text-[var(--color-muted)] mt-1 leading-relaxed">Predictions are probabilities, not promises. Historical patterns can fail when market conditions change. Nexus does not provide investment advice, price targets, or execute trades.</p></div></div></Card>
  </div>
}
