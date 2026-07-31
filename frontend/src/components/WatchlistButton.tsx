import { Star } from 'lucide-react'
import { useWatchlist } from '../lib/watchlist'
import { useToast } from './ux'

export function WatchlistButton({
  stock,
  compact = false,
}: {
  stock: {
    symbol: string
    company_name?: string | null
    industry?: string | null
  }
  compact?: boolean
}) {
  const watchlist = useWatchlist()
  const toast = useToast()
  const active = watchlist.has(stock.symbol)

  const toggle = () => {
    const added = watchlist.toggle(stock)
    toast.push(
      added ? `${stock.symbol} added to your watchlist` : `${stock.symbol} removed from watchlist`,
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={active ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border transition ${
        active
          ? 'border-[rgba(230,184,77,.4)] bg-[rgba(230,184,77,.1)] text-[var(--color-warning)]'
          : 'border-[var(--color-line)] bg-white/[.035] text-[var(--color-muted)] hover:text-white hover:bg-white/[.06]'
      } ${compact ? 'h-9 w-9' : 'px-3.5 py-2.5 text-sm'}`}
    >
      <Star className={`h-4 w-4 ${active ? 'fill-current' : ''}`} />
      {!compact && (active ? 'Watching' : 'Watch')}
    </button>
  )
}
