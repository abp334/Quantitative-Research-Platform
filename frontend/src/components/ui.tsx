import type { ReactNode, SelectHTMLAttributes } from 'react'
import { METRIC_DEFS } from '../lib/financeGlossary'

export function Card({
  title,
  subtitle,
  children,
  action,
  metricKey,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  /** Optional glossary key shown as a hover hint next to the title */
  metricKey?: string
}) {
  return (
    <section className="glass rounded-2xl p-5 md:p-6">
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="display text-lg font-semibold inline-flex items-center gap-2">
                {title}
                {metricKey && <MetricHint metricKey={metricKey} />}
              </h2>
            )}
            {subtitle && <p className="text-sm text-[var(--color-muted)] mt-1">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function MetricHint({ metricKey, label }: { metricKey: string; label?: string }) {
  const text = METRIC_DEFS[metricKey] ?? label
  if (!text) return null
  return (
    <span className="relative group inline-flex align-middle">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--color-line)] text-[10px] text-[var(--color-muted)] cursor-help hover:text-[var(--color-text)] hover:border-[var(--color-accent)]"
        aria-label={`About ${metricKey}`}
      >
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-72 -translate-x-1/2 rounded-xl border border-[var(--color-line)] bg-[#0d1524] px-3 py-2 text-xs font-normal leading-relaxed text-[var(--color-muted)] opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-within:opacity-100">
        <span className="block text-[var(--color-text)] font-medium mb-1">{metricKey}</span>
        {text}
      </span>
    </span>
  )
}

export function Callout({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'accent' | 'warn'
}) {
  const border =
    tone === 'accent'
      ? 'border-[rgba(61,222,168,0.28)] bg-[rgba(61,222,168,0.06)]'
      : tone === 'warn'
        ? 'border-[rgba(230,184,77,0.35)] bg-[rgba(230,184,77,0.06)]'
        : 'border-[var(--color-line)] bg-white/[0.03]'
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed text-[var(--color-muted)] ${border}`}>
      {children}
    </div>
  )
}

export function FieldSelect({
  label,
  hint,
  children,
  ...props
}: {
  label: string
  hint?: string
  children: ReactNode
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="text-sm block min-w-[9rem]">
      <span className="flex items-center gap-1.5 text-[var(--color-muted)] mb-1">
        {label}
        {hint && (
          <span className="text-[10px] opacity-70" title={hint}>
            ⓘ
          </span>
        )}
      </span>
      <select
        className="w-full rounded-xl bg-[#0d1524] border border-[var(--color-line)] px-3 py-2 text-[var(--color-text)]"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div className="display text-2xl font-bold mt-2 mono">{value}</div>
      {hint && <div className="text-xs text-[var(--color-muted)] mt-1">{hint}</div>}
    </div>
  )
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] text-[#061018] font-semibold'
      : variant === 'danger'
        ? 'bg-[rgba(240,113,120,0.15)] text-[var(--color-danger)] border border-[rgba(240,113,120,0.35)]'
        : 'bg-white/5 text-[var(--color-text)] border border-[var(--color-line)]'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 ${styles}`}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'up' | 'down' | 'neutral' }) {
  const cls =
    tone === 'up'
      ? 'text-[var(--color-accent)] bg-[rgba(61,222,168,0.12)] border-[rgba(61,222,168,0.3)]'
      : tone === 'down'
        ? 'text-[var(--color-danger)] bg-[rgba(240,113,120,0.12)] border-[rgba(240,113,120,0.3)]'
        : 'text-[var(--color-muted)] bg-white/5 border-[var(--color-line)]'
  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  )
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-[var(--color-muted)] text-sm">
      Loading…
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[rgba(240,113,120,0.35)] bg-[rgba(240,113,120,0.08)] p-4 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  )
}
