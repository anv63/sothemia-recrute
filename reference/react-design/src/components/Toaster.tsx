import { CircleAlert, CircleCheck, Info, Lock, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { dismiss, useToasts, type ToastKind } from '../lib/toast'
import { cx } from './ui'

const STYLE: Record<ToastKind, { icon: ReactNode; bar: string }> = {
  success: { icon: <CircleCheck className="size-4 text-ok-600" />, bar: 'bg-ok-600' },
  error: { icon: <CircleAlert className="size-4 text-bad-600" />, bar: 'bg-bad-600' },
  warning: { icon: <TriangleAlert className="size-4 text-warn-600" />, bar: 'bg-warn-600' },
  info: { icon: <Info className="size-4 text-brand-600" />, bar: 'bg-brand-600' },
  forbidden: { icon: <Lock className="size-4 text-warn-700" />, bar: 'bg-warn-600' },
}

export default function Toaster() {
  const toasts = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto relative flex gap-3 overflow-hidden rounded-lg border border-line bg-white py-3 pl-4 pr-10 shadow-pop animate-toast-in">
          <span className={cx('absolute inset-y-0 left-0 w-1', STYLE[t.kind].bar)} />
          <span className="mt-0.5">{STYLE[t.kind].icon}</span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-ink">{t.title}</p>
            {t.detail && <p className="mt-0.5 leading-snug text-ink-3">{t.detail}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} aria-label="Fermer la notification" className="absolute right-2 top-2 rounded p-1 text-ink-4 hover:bg-canvas hover:text-ink"><X className="size-3.5" /></button>
        </div>
      ))}
    </div>
  )
}
