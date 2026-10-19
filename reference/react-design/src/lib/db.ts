// Local data layer. Each `api.*` call maps 1:1 to a repository function of the Streamlit app backed by SQLite
// (see docs/HANDOFF.md § API contract). Latency and failure injection make loading/error states observable.
import { useSyncExternalStore } from 'react'
import { analyzeCandidate } from './analysis'
import { files } from './files'
import { MODEL_OF, buildSeed } from './seed'
import type { Analysis, AuditEntry, Candidate, DbState, Offer, ProviderConfig, ProviderId, ReviewStatus, Role, Settings } from './types'

const KEY = 'sothema-hr-db-v3'
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000/api'

async function backend<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, init)
  if (!response.ok) throw new ApiError('BACKEND', (await response.json().catch(() => ({}))).error ?? ('Backend error (' + response.status + ')'))
  return response.json() as Promise<T>
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as DbState
      if (s.version === 999) return s
    }
  } catch { /* corrupted storage → reseed */ }
  return { ...buildSeed(), candidates: [], analyses: [], audit: [] }
}

let state: DbState = load()
const listeners = new Set<() => void>()

function commit(next: DbState) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota exceeded: keep in memory */ }
  listeners.forEach((l) => l())
}

export const getState = () => state
export const subscribe = (l: () => void) => (listeners.add(l), () => { listeners.delete(l) })
export const useDb = () => useSyncExternalStore(subscribe, getState)

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

export const ROLE_LABEL: Record<Role, string> = { recruteur: 'Recruteur RH', manager: 'Manager recruteur', admin: 'Administrateur RH' }

export type Action = 'upload' | 'edit' | 'review' | 'notes' | 'analyze' | 'validate' | 'delete' | 'export' | 'backup' | 'providers' | 'retention' | 'offers' | 'reset'
export const PERMISSIONS: Record<Action, { label: string; roles: Role[] }> = {
  upload: { label: 'Importer des CV', roles: ['recruteur', 'admin'] },
  edit: { label: 'Modifier les champs extraits', roles: ['recruteur', 'admin'] },
  review: { label: 'Changer le statut RH', roles: ['recruteur', 'admin'] },
  notes: { label: 'Ajouter des notes', roles: ['recruteur', 'manager', 'admin'] },
  analyze: { label: 'Lancer une analyse IA', roles: ['recruteur', 'admin'] },
  validate: { label: 'Valider une analyse', roles: ['recruteur', 'manager', 'admin'] },
  offers: { label: 'Gérer les critères de poste', roles: ['recruteur', 'manager', 'admin'] },
  export: { label: 'Exporter des données', roles: ['recruteur', 'admin'] },
  delete: { label: 'Supprimer des candidats', roles: ['admin'] },
  backup: { label: 'Sauvegarder / restaurer', roles: ['admin'] },
  providers: { label: 'Configurer les fournisseurs IA', roles: ['admin'] },
  retention: { label: 'Politique de conservation', roles: ['admin'] },
  reset: { label: 'Réinitialiser la base', roles: ['admin'] },
}
export const can = (action: Action, role: Role = state.settings.role) => PERMISSIONS[action].roles.includes(role)

function guard(action: Action) {
  if (!can(action)) throw new ApiError('FORBIDDEN', `« ${PERMISSIONS[action].label} » n'est pas autorisé pour le rôle ${ROLE_LABEL[state.settings.role]}.`)
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function io(ms = 320) {
  await wait(ms + Math.random() * 180)
  if (state.settings.simulateFailures) throw new ApiError('SQLITE_BUSY', 'Base de données verrouillée (SQLITE_BUSY). Réessayez dans quelques secondes.')
}

function mutate(fn: (d: DbState) => void) {
  const d = structuredClone(state)
  fn(d)
  commit(d)
}

function auditEntry(d: DbState, action: string, entity: AuditEntry['entity'], entityId: string | undefined, details: string, actor?: string) {
  d.audit.unshift({ id: `AUD-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString(), actor: actor ?? d.settings.userName, role: d.settings.role, action, entity, entityId, details })
  if (d.audit.length > 2000) d.audit.length = 2000
}

const recomputeConfidence = (c: Candidate) => {
  const keys = ['name', 'email', 'phone', 'city', 'targetRole', 'experienceYears', 'skills', 'education']
  c.confidence = Math.round((keys.reduce((a, k) => a + (c.fieldConfidence[k] ?? 0), 0) / keys.length) * 100) / 100
}

export const fullName = (c: Pick<Candidate, 'firstName' | 'lastName'>) => `${c.firstName} ${c.lastName}`.trim() || 'Nom non détecté'
export const latestAnalysis = (s: DbState, id: string): Analysis | undefined =>
  s.analyses.filter((a) => a.candidateId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

export function providerUsable(p: ProviderId): { ok: boolean; reason?: string } {
  if (p === 'local') return { ok: true }
  const cfg = state.providers.find((x) => x.id === p)
  if (!cfg) return { ok: false, reason: 'Fournisseur inconnu' }
  if (cfg.keyStatus !== 'configured') return { ok: false, reason: `Clé API ${cfg.name} ${cfg.keyStatus === 'invalid' ? 'invalide' : 'manquante'}` }
  if (!cfg.enabled) return { ok: false, reason: `${cfg.name} est désactivé` }
  return { ok: true }
}
export const modelOf = (p: ProviderId) => (p === 'local' ? MODEL_OF.local : state.providers.find((x) => x.id === p)?.model ?? MODEL_OF[p])

const KEY_FORMAT: Record<ProviderConfig['id'], RegExp> = { openai: /^sk-[\w-]{20,}$/, anthropic: /^sk-ant-[\w-]{20,}$/, gemini: /^AIza[\w-]{30,}$/ }

/** Internal (non-guarded) writes used by the processing pipeline. */
export const internal = {
  mutate,
  auditEntry,
  recomputeConfidence,
}

export const api = {
  /** Read query for list/detail screens (SELECT … FROM candidates). */
  async query(ms = 420) {
    await io(ms)
    try {
      const remote = await backend<{ candidates: Candidate[] }>('/candidates')
      mutate((d) => { d.candidates = remote.candidates })
    } catch { /* local-first fallback while the Python service is stopped */ }
  },

  async ingestFile(file: File) {
    const form = new FormData()
    form.append('file', file)
    return backend<Candidate>('/candidates/upload', { method: 'POST', body: form })
  },

  async updateCandidate(id: string, patch: Partial<Candidate>) {
    guard('edit'); await io()
    mutate((d) => {
      const c = d.candidates.find((x) => x.id === id)
      if (!c) throw new ApiError('NOT_FOUND', 'Candidat introuvable')
      const changed = Object.keys(patch).filter((k) => JSON.stringify((c as never)[k]) !== JSON.stringify((patch as never)[k]))
      Object.assign(c, patch, { updatedAt: new Date().toISOString() })
      const fcKey: Record<string, string> = { firstName: 'name', lastName: 'name' }
      changed.forEach((k) => (c.fieldConfidence[fcKey[k] ?? k] = 1))
      recomputeConfidence(c)
      auditEntry(d, 'Champs extraits modifiés', 'candidate', id, changed.length ? `Champs : ${changed.join(', ')} (validés manuellement)` : 'Aucune modification')
    })
  },

  async setReview(ids: string[], review: ReviewStatus, label: string) {
    guard('review'); await io()
    mutate((d) => {
      d.candidates.filter((c) => ids.includes(c.id)).forEach((c) => { c.review = review; c.updatedAt = new Date().toISOString() })
      ids.forEach((id) => auditEntry(d, 'Statut RH modifié', 'candidate', id, `Nouveau statut : ${label}`))
    })
  },

  async saveNotes(id: string, notes: string) {
    guard('notes'); await io()
    mutate((d) => {
      const c = d.candidates.find((x) => x.id === id)!
      c.notes = notes; c.updatedAt = new Date().toISOString()
      auditEntry(d, 'Note RH enregistrée', 'candidate', id, `${notes.length} caractères`)
    })
  },

  async deleteCandidates(ids: string[]) {
    guard('delete'); await io(500)
    await Promise.all(ids.map((id) => files.remove(id)))
    mutate((d) => {
      d.candidates = d.candidates.filter((c) => !ids.includes(c.id))
      d.analyses = d.analyses.filter((a) => !ids.includes(a.candidateId))
      auditEntry(d, 'Candidats supprimés', 'candidate', ids.join(', '), `${ids.length} dossier(s) et fichiers originaux supprimés`)
    })
  },

  async runAnalysis(id: string, provider: ProviderId, offerId?: string) {
    guard('analyze')
    const usable = providerUsable(provider)
    if (!usable.ok) throw new ApiError('PROVIDER_KEY_MISSING', `${usable.reason}. Configurez le fournisseur dans Paramètres › Fournisseurs IA ou utilisez l'analyse locale.`)
    await io(provider === 'local' ? 700 : 1600)
    const c = state.candidates.find((x) => x.id === id)
    if (!c) throw new ApiError('NOT_FOUND', 'Candidat introuvable')
    if (!c.cvText) throw new ApiError('NO_TEXT', "Aucun texte exploitable : corrigez l'extraction avant d'analyser.")
    const offer = offerId ? state.offers.find((o) => o.id === offerId) : null
    const a = analyzeCandidate(c, provider, modelOf(provider), offer)
    mutate((d) => {
      d.analyses.push(a)
      const dc = d.candidates.find((x) => x.id === id)!
      dc.score = a.score
      auditEntry(d, 'Analyse générée', 'analysis', id, `${providerName(provider)} · ${a.model}${offer ? ` · critères « ${offer.title} »` : ''}`)
    })
    return a
  },

  async validateAnalysis(analysisId: string) {
    guard('validate'); await io()
    mutate((d) => {
      const a = d.analyses.find((x) => x.id === analysisId)!
      a.reviewedBy = d.settings.userName; a.reviewedAt = new Date().toISOString()
      auditEntry(d, 'Analyse relue et validée par RH', 'analysis', a.candidateId, `${a.id} · score ${a.score}`)
    })
  },

  async saveOffer(o: Offer) {
    guard('offers'); await io()
    if (!o.title.trim()) throw new ApiError('VALIDATION', 'Le titre du poste est obligatoire.')
    mutate((d) => {
      const i = d.offers.findIndex((x) => x.id === o.id)
      const next = { ...o, updatedAt: new Date().toISOString() }
      if (i >= 0) d.offers[i] = next; else d.offers.unshift(next)
      auditEntry(d, i >= 0 ? 'Critères de poste modifiés' : 'Critères de poste créés', 'offer', o.id, o.title)
    })
  },

  async deleteOffer(id: string) {
    guard('offers'); await io()
    mutate((d) => {
      const o = d.offers.find((x) => x.id === id)
      d.offers = d.offers.filter((x) => x.id !== id)
      auditEntry(d, 'Critères de poste supprimés', 'offer', id, o?.title ?? '')
    })
  },

  /** The key is validated then handed to the OS keyring / .env by the backend — it is never persisted in this store. */
  async setProviderKey(id: ProviderConfig['id'], key: string) {
    guard('providers'); await io(500)
    const ok = KEY_FORMAT[id].test(key.trim())
    mutate((d) => {
      const p = d.providers.find((x) => x.id === id)!
      p.keyStatus = ok ? 'configured' : 'invalid'
      p.keyUpdatedAt = new Date().toISOString()
      p.lastTest = undefined
      auditEntry(d, ok ? 'Clé API enregistrée' : 'Clé API refusée (format invalide)', 'provider', id, 'Valeur non journalisée')
    })
    if (!ok) throw new ApiError('INVALID_KEY_FORMAT', 'Format de clé non reconnu pour ce fournisseur. La clé n\'a pas été enregistrée.')
  },

  async removeProviderKey(id: ProviderConfig['id']) {
    guard('providers'); await io()
    mutate((d) => {
      const p = d.providers.find((x) => x.id === id)!
      p.keyStatus = 'missing'; p.enabled = false; p.lastTest = undefined
      if (d.settings.defaultProvider === id) d.settings.defaultProvider = 'local'
      auditEntry(d, 'Clé API révoquée', 'provider', id, 'Fournisseur désactivé')
    })
  },

  async updateProvider(id: ProviderConfig['id'], patch: Partial<Pick<ProviderConfig, 'model' | 'enabled'>>) {
    guard('providers')
    if (patch.enabled && state.providers.find((p) => p.id === id)?.keyStatus !== 'configured') throw new ApiError('PROVIDER_KEY_MISSING', 'Ajoutez une clé API valide avant d\'activer ce fournisseur.')
    await io()
    mutate((d) => {
      Object.assign(d.providers.find((x) => x.id === id)!, patch)
      auditEntry(d, 'Fournisseur IA modifié', 'provider', id, Object.entries(patch).map(([k, v]) => `${k} = ${v}`).join(', '))
    })
  },

  async testProvider(id: ProviderConfig['id']) {
    const p = state.providers.find((x) => x.id === id)!
    if (p.keyStatus !== 'configured') throw new ApiError('PROVIDER_KEY_MISSING', `Aucune clé valide pour ${p.name}.`)
    const t0 = performance.now()
    try {
      await io(700)
    } catch (e) {
      mutate((d) => { d.providers.find((x) => x.id === id)!.lastTest = { at: new Date().toISOString(), ok: false, latencyMs: 0, message: 'Délai dépassé' } })
      throw new ApiError('PROVIDER_TIMEOUT', `${p.name} : délai de connexion dépassé (${(e as Error).message})`)
    }
    const latencyMs = Math.round(performance.now() - t0)
    mutate((d) => {
      d.providers.find((x) => x.id === id)!.lastTest = { at: new Date().toISOString(), ok: true, latencyMs, message: `Connexion établie · ${p.model}` }
      auditEntry(d, 'Test de connexion', 'provider', id, `OK · ${latencyMs} ms`)
    })
    return latencyMs
  },

  async updateSettings(patch: Partial<Settings>, action: Action) {
    guard(action); await io(250)
    if (patch.defaultProvider && !providerUsable(patch.defaultProvider).ok) throw new ApiError('PROVIDER_KEY_MISSING', `${providerUsable(patch.defaultProvider).reason} : impossible de le définir par défaut.`)
    mutate((d) => {
      Object.assign(d.settings, patch)
      auditEntry(d, 'Paramètres modifiés', 'system', undefined, Object.keys(patch).join(', '))
    })
  },

  /** Demo-only role switch (production: role comes from the authenticated session). */
  setRole(role: Role) {
    mutate((d) => { d.settings.role = role; auditEntry(d, 'Changement de rôle (démo)', 'system', undefined, ROLE_LABEL[role]) })
  },
  setSimulateFailures(on: boolean) {
    mutate((d) => { d.settings.simulateFailures = on; auditEntry(d, on ? 'Mode diagnostic activé' : 'Mode diagnostic désactivé', 'system', undefined, 'Injection d\'erreurs SQLite') })
  },

  async exportCandidates(format: 'csv' | 'json', ids?: string[]) {
    guard('export'); await io(600)
    const rows = state.candidates.filter((c) => !ids || ids.includes(c.id))
    let blob: Blob
    if (format === 'json') {
      blob = new Blob([JSON.stringify(rows.map(({ cvText: _t, ...r }) => r), null, 2)], { type: 'application/json' })
    } else {
      const cols = ['id', 'firstName', 'lastName', 'email', 'phone', 'city', 'targetRole', 'department', 'experienceYears', 'skills', 'score', 'processing', 'review', 'createdAt'] as const
      const esc = (v: unknown) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`
      blob = new Blob(['\ufeff' + [cols.join(';'), ...rows.map((r) => cols.map((k) => esc(r[k])).join(';'))].join('\n')], { type: 'text/csv;charset=utf-8' })
    }
    mutate((d) => { d.settings.lastExportAt = new Date().toISOString(); auditEntry(d, 'Export de données', 'system', undefined, `${rows.length} candidat(s) · ${format.toUpperCase()}`) })
    return { blob, count: rows.length, filename: `sothema-cvtheque-${new Date().toISOString().slice(0, 10)}.${format}` }
  },

  async backup() {
    guard('backup'); await io(900)
    mutate((d) => { d.settings.lastBackupAt = new Date().toISOString(); auditEntry(d, 'Sauvegarde créée', 'system', undefined, `${d.candidates.length} candidats, ${d.analyses.length} analyses`) })
    return { blob: new Blob([JSON.stringify(state)], { type: 'application/json' }), filename: `ats-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json` }
  },

  async restore(file: File) {
    guard('backup'); await io(700)
    let s: DbState
    try { s = JSON.parse(await file.text()) } catch { throw new ApiError('INVALID_BACKUP', 'Fichier de sauvegarde illisible.') }
    if (s.version !== 1 || !Array.isArray(s.candidates)) throw new ApiError('INVALID_BACKUP', 'Format de sauvegarde incompatible (version attendue : 1).')
    s.settings = { ...s.settings, role: state.settings.role, simulateFailures: false }
    commit(s)
    mutate((d) => auditEntry(d, 'Sauvegarde restaurée', 'system', undefined, `${s.candidates.length} candidats`))
  },

  retentionCandidates(months = state.settings.retentionMonths) {
    const limit = Date.now() - months * 30.44 * 86400000
    return state.candidates.filter((c) => new Date(c.updatedAt).getTime() < limit)
  },

  async applyRetention() {
    guard('retention'); await io(600)
    const ids = api.retentionCandidates().map((c) => c.id)
    await Promise.all(ids.map((id) => files.remove(id)))
    mutate((d) => {
      d.candidates = d.candidates.filter((c) => !ids.includes(c.id))
      d.analyses = d.analyses.filter((a) => !ids.includes(a.candidateId))
      auditEntry(d, 'Purge de conservation', 'system', undefined, `${ids.length} dossier(s) au-delà de ${d.settings.retentionMonths} mois supprimé(s)`)
    })
    return ids.length
  },

  async reset(empty: boolean) {
    guard('reset'); await io(600)
    await files.clear()
    const s = buildSeed(empty)
    s.settings.role = state.settings.role
    commit(s)
    mutate((d) => auditEntry(d, empty ? 'Base vidée' : 'Base réinitialisée (jeu de démonstration)', 'system', undefined, `${d.candidates.length} candidats`))
  },
}

export const PROVIDER_NAMES: Record<ProviderId, string> = { local: 'Analyse locale', openai: 'OpenAI', gemini: 'Google Gemini', anthropic: 'Anthropic Claude' }
export const providerName = (p: ProviderId) => PROVIDER_NAMES[p]
