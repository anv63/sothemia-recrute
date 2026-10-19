import { useSyncExternalStore } from 'react'

const sub = (l: () => void) => {
  window.addEventListener('hashchange', l)
  return () => window.removeEventListener('hashchange', l)
}
const snap = () => window.location.hash || '#/'

export function useRoute() {
  const hash = useSyncExternalStore(sub, snap)
  const [path, qs = ''] = hash.slice(1).split('?')
  const parts = path.split('/').filter(Boolean)
  return { path, parts, query: new URLSearchParams(qs) }
}

export function navigate(to: string) {
  window.location.hash = to.startsWith('#') ? to : `#${to}`
  window.scrollTo({ top: 0 })
}
