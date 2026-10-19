import { TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, IconButton, Input } from './ui'

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} rounded-xl bg-white shadow-modal`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <IconButton label="Fermer" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
        <div className="px-5 py-4 text-sm text-ink-2">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-xl border-t border-line bg-subtle px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export interface ConfirmOptions {
  title: string
  body: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary'
  /** Typed confirmation for irreversible actions (e.g. « SUPPRIMER »). */
  requireText?: string
  onConfirm: () => Promise<unknown> | void
}

export function ConfirmModal({ options, onClose }: { options: ConfirmOptions | null; onClose: () => void }) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  useEffect(() => { setText(''); setPending(false) }, [options])
  if (!options) return null
  const blocked = !!options.requireText && text.trim() !== options.requireText
  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title={options.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button
            data-autofocus
            variant={options.tone === 'danger' ? 'danger' : 'primary'}
            loading={pending}
            disabled={blocked}
            onClick={async () => {
              setPending(true)
              try { await options.onConfirm() } finally { setPending(false); onClose() }
            }}
          >
            {options.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {options.tone === 'danger' && <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-bad-50 text-bad-600"><TriangleAlert className="size-4" /></span>}
        <div className="space-y-3 leading-relaxed">
          <div>{options.body}</div>
          {options.requireText && (
            <label className="block space-y-1.5">
              <span className="text-[13px]">Saisissez <strong className="font-mono">{options.requireText}</strong> pour confirmer</span>
              <Input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
            </label>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Small hook so screens can open a confirmation with one call. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  return { confirm: setOptions, modal: <ConfirmModal options={options} onClose={() => setOptions(null)} /> }
}
