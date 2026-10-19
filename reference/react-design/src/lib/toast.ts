import { useSyncExternalStore } from 'react'

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'forbidden'
export interface Toast { id: number; kind: ToastKind; title: string; detail?: string }

let toasts: Toast[] = []
let id = 0
const ls = new Set<() => void>()
const emit = () => ls.forEach((l) => l())

export function dismiss(tid: number) {
  toasts = toasts.filter((t) => t.id !== tid)
  emit()
}

function push(kind: ToastKind, title: string, detail?: string) {
  const t = { id: ++id, kind, title, detail }
  toasts = [...toasts.slice(-3), t]
  emit()
  setTimeout(() => dismiss(t.id), kind === 'error' || kind === 'forbidden' ? 7000 : 4200)
}

export const toast = {
  success: (t: string, d?: string) => push('success', t, d),
  error: (t: string, d?: string) => push('error', t, d),
  info: (t: string, d?: string) => push('info', t, d),
  warning: (t: string, d?: string) => push('warning', t, d),
  forbidden: (t: string, d?: string) => push('forbidden', t, d),
}

export const useToasts = () => useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => toasts)
