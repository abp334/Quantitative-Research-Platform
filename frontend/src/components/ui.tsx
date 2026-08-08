import { useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { HelpCircle } from 'lucide-react'

export function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="card">
      {(title || action) && (
        <div className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  )
}

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        type="button"
        className="text-slate-500 hover:text-blue-400 focus:outline-none"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(!open)}
        aria-label="Information"
      >
        <HelpCircle style={{ width: 13, height: 13 }} />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 text-[11px] font-normal text-slate-200 bg-[#1e2536] border border-[#2a344d] rounded shadow-xl z-50 pointer-events-none font-sans leading-normal">
          {text}
        </span>
      )}
    </span>
  )
}

export function Stat({
  label,
  value,
  hint,
  tooltip,
}: {
  label: string
  value: string | number
  hint?: string
  tooltip?: string
}) {
  return (
    <div className="metric-tile">
      <div className="flex items-center">
        <span className="metric-label">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <span className="metric-value">{value}</span>
      {hint && <span className="metric-hint">{hint}</span>}
    </div>
  )
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  size,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger' | 'success'
  size?: 'sm'
}) {
  const cls =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'success'
      ? 'btn-success'
      : variant === 'danger'
      ? 'btn-danger'
      : 'btn-ghost'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`btn ${cls} ${size === 'sm' ? 'btn-sm' : ''}`}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'up' | 'down' | 'neutral' | 'info'
}) {
  const cls =
    tone === 'up'
      ? 'badge-green'
      : tone === 'down'
      ? 'badge-red'
      : tone === 'info'
      ? 'badge-blue'
      : 'badge-neutral'
  return <span className={`badge ${cls}`}>{children}</span>
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>
}

export function FieldSelect({
  label,
  children,
  ...props
}: {
  label: string
  children: ReactNode
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label>
      <span className="form-label">{label}</span>
      <select className="form-select" {...props}>
        {children}
      </select>
    </label>
  )
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-xs text-slate-400">
      Loading forecast data…
    </div>
  )
}
