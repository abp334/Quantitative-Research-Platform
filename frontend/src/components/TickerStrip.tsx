import type { ScannerItem } from '../types'

export function TickerStrip({ items }: { items: ScannerItem[] }) {
  if (!items.length) return null
  const doubled = [...items, ...items]
  return (
    <div className="ticker-strip">
      <div className="ticker-strip-inner">
        {doubled.map((item, i) => {
          const up = item.expected_return >= 0
          return (
            <span className="ticker-item" key={`${item.symbol}-${i}`}>
              <span className="ticker-symbol">{item.symbol}</span>
              <span className="ticker-return" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                {up ? '▲' : '▼'} {(item.expected_return * 100).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
