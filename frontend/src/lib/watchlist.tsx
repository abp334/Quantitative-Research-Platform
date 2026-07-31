import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'nexus.watchlist.v1'

export type WatchlistItem = {
  symbol: string
  companyName?: string | null
  industry?: string | null
  addedAt: string
  note: string
  thesisPrice?: number | null
}

type WatchlistStock = {
  symbol: string
  company_name?: string | null
  industry?: string | null
}

type WatchlistContextValue = {
  items: WatchlistItem[]
  has: (symbol: string) => boolean
  add: (stock: WatchlistStock) => void
  remove: (symbol: string) => void
  toggle: (stock: WatchlistStock) => boolean
  update: (symbol: string, patch: Partial<Pick<WatchlistItem, 'note' | 'thesisPrice'>>) => void
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null)

function readStoredWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is WatchlistItem => Boolean(item && typeof item.symbol === 'string'))
      .map((item) => ({
        symbol: item.symbol.toUpperCase(),
        companyName: item.companyName ?? null,
        industry: item.industry ?? null,
        addedAt: item.addedAt || new Date().toISOString(),
        note: item.note || '',
        thesisPrice: Number.isFinite(item.thesisPrice) ? Number(item.thesisPrice) : null,
      }))
  } catch {
    return []
  }
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(readStoredWatchlist)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setItems(readStoredWatchlist())
    }
    window.addEventListener('storage', syncAcrossTabs)
    return () => window.removeEventListener('storage', syncAcrossTabs)
  }, [])

  const has = useCallback(
    (symbol: string) => items.some((item) => item.symbol === symbol.toUpperCase()),
    [items],
  )

  const add = useCallback((stock: WatchlistStock) => {
    const symbol = stock.symbol.toUpperCase()
    setItems((current) => {
      if (current.some((item) => item.symbol === symbol)) return current
      return [
        ...current,
        {
          symbol,
          companyName: stock.company_name ?? null,
          industry: stock.industry ?? null,
          addedAt: new Date().toISOString(),
          note: '',
          thesisPrice: null,
        },
      ]
    })
  }, [])

  const remove = useCallback((symbol: string) => {
    setItems((current) => current.filter((item) => item.symbol !== symbol.toUpperCase()))
  }, [])

  const toggle = useCallback(
    (stock: WatchlistStock) => {
      const exists = has(stock.symbol)
      if (exists) remove(stock.symbol)
      else add(stock)
      return !exists
    },
    [add, has, remove],
  )

  const update = useCallback(
    (symbol: string, patch: Partial<Pick<WatchlistItem, 'note' | 'thesisPrice'>>) => {
      setItems((current) =>
        current.map((item) =>
          item.symbol === symbol.toUpperCase() ? { ...item, ...patch } : item,
        ),
      )
    },
    [],
  )

  const value = useMemo(
    () => ({ items, has, add, remove, toggle, update }),
    [add, has, items, remove, toggle, update],
  )

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
}

export function useWatchlist() {
  const context = useContext(WatchlistContext)
  if (!context) throw new Error('useWatchlist requires WatchlistProvider')
  return context
}
