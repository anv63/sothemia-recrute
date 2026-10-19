import type { ProcessingStatus, ReviewStatus } from './types'

const dtf = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
const dtt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
export const fmtDate = (iso?: string) => (iso ? dtf.format(new Date(iso)) : '—')
export const fmtDateTime = (iso?: string) => (iso ? dtt.format(new Date(iso)) : '—')
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
export function fmtRelative(iso?: string) {
  if (!iso) return '—'
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return "à l'instant"
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return fmtDate(iso)
}
export const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
export const fmtSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} Mo` : `${kb} Ko`)
export const pct = (v: number) => `${Math.round(v * 100)} %`

export const PROCESSING_LABEL: Record<ProcessingStatus, string> = {
  received: 'Reçu', extracting: 'Extraction', analyzing: 'Analyse', indexed: 'Indexé', ready: 'Prêt pour revue', error: 'Erreur',
}
export const PIPELINE: ProcessingStatus[] = ['received', 'extracting', 'analyzing', 'indexed', 'ready']

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  a_examiner: 'À examiner', en_revue: 'En revue', retenu: 'Présélectionné', en_attente: 'En attente', archive: 'Archivé',
}

export const initials = (f: string, l: string) => `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '?'
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`
