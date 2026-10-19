import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from './db'
import { toast } from './toast'

/** Simulated read query: drives loading / error / retry states on list and detail screens. */
export function useResource(key: string, ms?: number) {
  const [n, setN] = useState(0)
  const [st, setSt] = useState<{ status: 'loading' | 'ready' | 'error'; error?: string }>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setSt({ status: 'loading' })
    api.query(ms).then(
      () => alive && setSt({ status: 'ready' }),
      (e: Error) => alive && setSt({ status: 'error', error: e.message }),
    )
    return () => { alive = false }
  }, [key, n, ms])
  return { ...st, retry: useCallback(() => setN((x) => x + 1), []) }
}

/** Wraps a mutation with pending state and success / error / forbidden toasts. */
export function useAction() {
  const [pending, setPending] = useState<string | null>(null)
  const run = useCallback(async <T,>(id: string, fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
    setPending(id)
    try {
      const r = await fn()
      if (success) toast.success(typeof success === 'function' ? success(r) : success)
      return r
    } catch (e) {
      const err = e as ApiError
      if (err.code === 'FORBIDDEN') toast.forbidden('Action non autorisée', err.message)
      else if (err.code === 'PROVIDER_KEY_MISSING') toast.warning('Fournisseur IA non configuré', err.message)
      else toast.error('Échec de l\'opération', err.message)
      return undefined
    } finally {
      setPending(null)
    }
  }, [])
  return { pending, run }
}
