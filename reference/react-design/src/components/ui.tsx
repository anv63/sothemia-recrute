import { LoaderCircle, Lock, X } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'teal'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200 shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]',
  secondary: 'bg-white text-ink border border-line-strong hover:bg-subtle hover:border-ink-4 active:bg-canvas disabled:text-ink-4 disabled:border-line',
  ghost: 'text-ink-2 hover:bg-canvas hover:text-ink active:bg-line disabled:text-ink-4',
  danger: 'bg-bad-600 text-white hover:bg-bad-700 disabled:bg-bad-200',
  teal: 'bg-sea-600 text-white hover:bg-sea-700 disabled:bg-sea-100',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  /** Renders a lock and keeps the button clickable so the « unauthorized » feedback can be surfaced. */
  locked?: boolean
}

export function Button({ variant = 'secondary', size = 'md', loading, icon, locked, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-disabled={locked || undefined}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-100 select-none disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : size === 'lg' ? 'h-11 px-5 text-[15px]' : 'h-9 px-3.5 text-sm',
        VARIANT[variant],
        locked && 'opacity-60',
        className,
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : locked ? <Lock className="size-3.5" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx('inline-flex size-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-canvas hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent', className)}
    >
      {children}
    </button>
  )
}

const control =
  'w-full rounded-md border bg-white px-3 text-sm text-ink placeholder:text-ink-4 transition-colors outline-none hover:border-ink-4 focus:border-brand-500 focus:ring-3 focus:ring-brand-100 disabled:bg-subtle disabled:text-ink-4 disabled:hover:border-line'

export function Input({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} aria-invalid={invalid || undefined} className={cx(control, 'h-9', invalid ? 'border-bad-600 focus:border-bad-600 focus:ring-bad-50' : 'border-line-strong', className)} />
}

export function Textarea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...rest} aria-invalid={invalid || undefined} className={cx(control, 'py-2 leading-relaxed', invalid ? 'border-bad-600' : 'border-line-strong', className)} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(control, 'h-9 appearance-none border-line-strong bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%235b6b82%27 stroke-width=%271.6%27%3E%3Cpath d=%27M3 4.5l3 3 3-3%27/%3E%3C/svg%3E")] bg-[position:right_10px_center] bg-no-repeat pr-8', className)}
    >
      {children}
    </select>
  )
}

export function Field({ label, hint, error, children, htmlFor, aside }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">{label}</label>
        {aside}
      </div>
      {children}
      {error ? <p className="text-xs text-bad-600">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  )
}

export function Checkbox({ checked, indeterminate, onChange, label, disabled }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate }}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 cursor-pointer rounded-sm border-line-strong accent-brand-600 disabled:cursor-not-allowed"
    />
  )
}

export function Toggle({ checked, onChange, label, disabled, loading }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand-600' : 'bg-line-strong')}
    >
      <span className={cx('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      {loading && <LoaderCircle className="absolute -right-6 size-4 animate-spin text-ink-3" />}
    </button>
  )
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('rounded-lg border border-line bg-surface shadow-card', className)}>{children}</As>
}

export function CardHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-ink-3">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-6 text-ink">{title}</h2>
          {subtitle && <p className="text-[13px] text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number; icon?: ReactNode }[] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line scrollbar-thin">
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-3 hover:text-ink',
          )}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-[11px] tabular', value === t.id ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-3')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Chip({ children, onRemove, tone = 'neutral' }: { children: ReactNode; onRemove?: () => void; tone?: 'neutral' | 'brand' | 'sea' | 'warn' }) {
  const t = { neutral: 'bg-canvas text-ink-2 border-line', brand: 'bg-brand-50 text-brand-800 border-brand-100', sea: 'bg-sea-50 text-sea-700 border-sea-100', warn: 'bg-warn-50 text-warn-700 border-warn-200' }[tone]
  return (
    <span className={cx('inline-flex h-6 items-center gap-1 rounded-md border pl-2 text-xs font-medium', onRemove ? 'pr-0.5' : 'pr-2', t)}>
      {children}
      {onRemove && (
        <button onClick={onRemove} aria-label="Retirer" className="inline-flex size-5 items-center justify-center rounded hover:bg-black/5">
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

export function Progress({ value, tone = 'brand', className }: { value: number; tone?: 'brand' | 'ok' | 'bad' | 'warn' | 'sea'; className?: string }) {
  const c = { brand: 'bg-brand-600', ok: 'bg-ok-600', bad: 'bg-bad-600', warn: 'bg-warn-600', sea: 'bg-sea-500' }[tone]
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-line', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-subtle px-1.5 font-mono text-[11px] text-ink-3">{children}</kbd>
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono text-[12px] text-ink-3', className)}>{children}</span>
}
