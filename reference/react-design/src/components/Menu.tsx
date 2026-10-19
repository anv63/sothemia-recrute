import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from './ui'

export interface MenuItem { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; locked?: boolean; disabled?: boolean; divider?: boolean }

export default function Menu({ items, label = 'Plus d\'actions', trigger }: { items: MenuItem[]; label?: string; trigger?: ReactNode }) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const open = !!pos
  const setOpen = (v: boolean | ((x: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(open) : v
    if (!next) return setPos(null)
    const r = btn.current!.getBoundingClientRect()
    const up = r.bottom + 44 * items.length + 16 > window.innerHeight
    setPos({ right: window.innerWidth - r.right, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) })
  }
  const ref = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setPos(null)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null)
    const sc = () => setPos(null)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    window.addEventListener('scroll', sc, true)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); window.removeEventListener('scroll', sc, true) }
  }, [open])
  return (
    <div ref={ref} className="relative inline-block">
      <button ref={btn} aria-label={label} title={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)} className={cx('inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-ink-3 hover:bg-canvas hover:text-ink', open && 'bg-canvas text-ink')}>
        {trigger ?? <MoreHorizontal className="size-4" />}
      </button>
      {open && (
        <div role="menu" style={pos ?? undefined} className="fixed z-50 min-w-52 rounded-lg border border-line bg-white py-1 shadow-pop animate-fade-in">
          {items.map((it, i) => (
            <div key={i}>
              {it.divider && <div className="my-1 border-t border-line" />}
              <button
                role="menuitem"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onSelect() }}
                className={cx('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm disabled:opacity-40', it.danger ? 'text-bad-600 hover:bg-bad-50' : 'text-ink-2 hover:bg-canvas hover:text-ink', it.locked && 'opacity-60')}
              >
                <span className="text-current [&>svg]:size-4">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {it.locked && <span className="text-[11px] text-ink-4">Restreint</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
