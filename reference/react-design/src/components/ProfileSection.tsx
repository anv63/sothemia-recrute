import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { FieldConfidenceDot } from './Badges'
import { cx } from './ui'

export default function ProfileSection({ title, icon, children, confidence, onEdit, editLocked, aside, className }: { title: string; icon: ReactNode; children: ReactNode; confidence?: number; onEdit?: () => void; editLocked?: boolean; aside?: ReactNode; className?: string }) {
  return (
    <section className={cx('border-b border-line px-5 py-4 last:border-b-0', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-2">
          <span className="text-ink-3 [&>svg]:size-4">{icon}</span>
          {title}
          <FieldConfidenceDot value={confidence} />
        </h3>
        <div className="flex items-center gap-1">
          {aside}
          {onEdit && (
            <button onClick={onEdit} className={cx('inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-ink-3 hover:bg-canvas hover:text-brand-700', editLocked && 'opacity-60')}>
              <Pencil className="size-3" /> Modifier
            </button>
          )}
        </div>
      </div>
      <div className="text-sm text-ink-2">{children}</div>
    </section>
  )
}

export function KV({ label, children, confidence }: { label: string; children: ReactNode; confidence?: number }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs text-ink-3">{label}<FieldConfidenceDot value={confidence} /></dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children || <span className="text-ink-4">Non détecté</span>}</dd>
    </div>
  )
}
