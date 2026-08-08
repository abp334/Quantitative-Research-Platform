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
      added ? `${stock.symbol} added to watchlist` : `${stock.symbol} removed`,
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={active ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-pressed={active}
      className={`btn btn-icon ${active ? 'btn-ghost' : 'btn-ghost'}`}
      style={active ? { color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.3)' } : undefined}
    >
      <Star style={{ width: 16, height: 16, fill: active ? 'currentColor' : 'none' }} />
      {!compact && <span style={{ fontSize: 13 }}>{active ? 'Watching' : 'Watch'}</span>}
    </button>
  )
}
