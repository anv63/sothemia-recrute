import type { ReactNode } from 'react'
import { Skeleton } from './States'
import { cx } from './ui'

export default function MetricCard({ label, value, hint, icon, tone = 'brand', href, loading }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; tone?: 'brand' | 'sea' | 'warn' | 'violet'; href?: string; loading?: boolean }) {
  const t = { brand: 'bg-brand-50 text-brand-600', sea: 'bg-sea-50 text-sea-600', warn: 'bg-warn-50 text-warn-600', violet: 'bg-violet-50 text-violet-600' }[tone]
  const body = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-ink-3">{label}</p>
        <span className={cx('flex size-8 items-center justify-center rounded-md', t)}>{icon}</span>
      </div>
      {loading ? <Skeleton className="mt-2 h-8 w-20" /> : <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-ink tabular">{value}</p>}
      {hint && <div className="mt-2.5 text-xs text-ink-3">{loading ? <Skeleton className="h-3 w-28" /> : hint}</div>}
    </>
  )
  const cls = 'block rounded-lg border border-line bg-white p-4 shadow-card transition-colors'
  return href ? <a href={href} className={cx(cls, 'hover:border-brand-200 focus-visible:border-brand-500')}>{body}</a> : <div className={cls}>{body}</div>
}
