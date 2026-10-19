// CV ingestion pipeline: Received → Extracting → Analyzing → Indexed → Ready for review.
// Production: a background worker (threading/queue in Streamlit) updating `candidates.processing` in SQLite.
import { useSyncExternalStore } from 'react'
import { analyzeCandidate } from './analysis'
import { ApiError, PERMISSIONS, ROLE_LABEL, api, can, getState, internal, modelOf, providerUsable } from './db'
import { extractFields } from './extract'
import { extractFileText, sha256 } from './fileText'
import { files } from './files'
import { nextCandidateId } from './seed'
import type { Candidate, ProcessingStatus } from './types'

export const MAX_SIZE_MB = 10
export const ACCEPTED = ['pdf', 'docx']

export type ItemStage = 'queued' | 'hashing' | ProcessingStatus | 'duplicate' | 'invalid' | 'skipped'
export interface UploadItem {
  key: string
  file: File
  stage: ItemStage
  progress: number
  message?: string
  candidateId?: string
  duplicateOf?: string
  lowConfidence?: boolean
}

let queue: UploadItem[] = []
const ls = new Set<() => void>()
const emit = () => ls.forEach((l) => l())
const set = (key: string, patch: Partial<UploadItem>) => {
  queue = queue.map((q) => (q.key === key ? { ...q, ...patch } : q))
  emit()
}
export const useQueue = () => useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => queue)
export const clearFinished = () => {
  queue = queue.filter((q) => !['ready', 'invalid', 'skipped', 'error'].includes(q.stage))
  emit()
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function validateFile(f: File): string | null {
  const ext = f.name.toLowerCase().split('.').pop() ?? ''
  if (!ACCEPTED.includes(ext)) return `Format .${ext} non pris en charge — PDF ou DOCX uniquement.`
  if (f.size === 0) return 'Fichier vide.'
  if (f.size > MAX_SIZE_MB * 1024 * 1024) return `Fichier trop volumineux (${(f.size / 1048576).toFixed(1)} Mo > ${MAX_SIZE_MB} Mo).`
  return null
}

export function enqueue(list: FileList | File[]) {
  if (!can('upload')) {
    throw new ApiError('FORBIDDEN', `« ${PERMISSIONS.upload.label} » n'est pas autorisé pour le rôle ${ROLE_LABEL[getState().settings.role]}.`)
  }
  const items: UploadItem[] = [...list].map((file) => {
    const err = validateFile(file)
    return { key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, stage: err ? 'invalid' : 'queued', progress: 0, message: err ?? undefined }
  })
  queue = [...items, ...queue]
  emit()
  items.filter((i) => i.stage === 'queued').reduce((p, i) => p.then(() => precheck(i.key)), Promise.resolve())
}

async function precheck(key: string) {
  const item = queue.find((q) => q.key === key)
  if (!item) return
  set(key, { stage: 'hashing', progress: 5, message: 'Calcul de l\'empreinte SHA-256…' })
  const hash = await sha256(item.file)
  const s = getState()
  const dupDb = s.candidates.find((c) => c.file.hash === hash)
  const dupBatch = queue.find((q) => q.key !== key && q.candidateId && s.candidates.find((c) => c.id === q.candidateId)?.file.hash === hash)
  if (dupDb || dupBatch) {
    const of = dupDb?.id ?? dupBatch?.candidateId
    set(key, { stage: 'duplicate', progress: 5, duplicateOf: of, message: `Fichier identique déjà présent (${of}).` })
    return
  }
  await ingest(key, hash)
}

export function resolveDuplicate(key: string, action: 'skip' | 'import') {
  const item = queue.find((q) => q.key === key)
  if (!item) return
  if (action === 'skip') set(key, { stage: 'skipped', message: 'Ignoré — doublon exact.' })
  else sha256(item.file).then((h) => ingest(key, `${h}-v${Date.now().toString(36)}`))
}

async function ingest(key: string, hash: string) {
  const item = queue.find((q) => q.key === key)!
  const s = getState()
  const n = s.candidates.reduce((m, c) => Math.max(m, parseInt(c.id.slice(5), 10) || 0), 0) + 1
  const id = nextCandidateId(n)
  const ext = item.file.name.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf'
  const now = new Date().toISOString()
  const base: Candidate = {
    id, firstName: '', lastName: '', email: '', phone: '', city: '', targetRole: '', department: '', experienceYears: null,
    skills: [], languages: [], education: [], experience: [], certifications: [], mobility: '', summary: '', notes: '',
    processing: 'received', review: 'a_examiner', score: null, confidence: 0, fieldConfidence: {},
    file: { name: item.file.name, type: ext, sizeKb: Math.max(1, Math.round(item.file.size / 1024)), hash, pages: 1, stored: true },
    cvText: '', createdAt: now, updatedAt: now,
  }
  await files.put(id, item.file).catch(() => { base.file.stored = false })
  api.ingestFile(item.file).catch(() => undefined)
  internal.mutate((d) => { d.candidates.unshift(base); internal.auditEntry(d, 'CV importé', 'candidate', id, item.file.name) })
  set(key, { stage: 'received', progress: 15, candidateId: id, message: 'Fichier enregistré localement.' })
  await run(id, item.file, key)
}

async function run(id: string, file: File | null, key?: string) {
  const upd = (p: Partial<Candidate>) => internal.mutate((d) => { const c = d.candidates.find((x) => x.id === id); if (c) Object.assign(c, p, { updatedAt: new Date().toISOString() }) })
  const step = (stage: ProcessingStatus, progress: number, message: string) => { upd({ processing: stage }); if (key) set(key, { stage, progress, message }) }
  try {
    await wait(350)
    step('extracting', 30, 'Extraction du texte et des champs…')
    const c0 = getState().candidates.find((c) => c.id === id)
    if (!c0) return
    if (file) {
      const raw = await extractFileText(file)
      await wait(700)
      if (raw.warning && /invalide|introuvable/i.test(raw.warning)) throw new ApiError('EXTRACTION_FAILED', `Fichier illisible : ${raw.warning}.`)
      const fields = extractFields(raw.text, file.name)
      upd({ ...fields, cvText: raw.text, file: { ...c0.file, pages: raw.pages } })
      const dupEmail = fields.email && getState().candidates.find((c) => c.id !== id && c.email && c.email.toLowerCase() === fields.email.toLowerCase())
      if (key) set(key, { lowConfidence: fields.confidence < 0.6, duplicateOf: dupEmail ? dupEmail.id : undefined, message: raw.warning ?? undefined })
    } else {
      await wait(900)
    }
    if (key) set(key, { progress: 55 })

    step('analyzing', 65, 'Analyse du profil…')
    await wait(900)
    const s = getState()
    const c1 = s.candidates.find((c) => c.id === id)!
    if (s.settings.autoAnalyze && c1.cvText) {
      const p = providerUsable(s.settings.defaultProvider).ok ? s.settings.defaultProvider : 'local'
      const a = analyzeCandidate(c1, p, modelOf(p))
      internal.mutate((d) => {
        d.analyses.push(a)
        d.candidates.find((x) => x.id === id)!.score = a.score
        internal.auditEntry(d, 'Analyse générée', 'analysis', id, `${p === s.settings.defaultProvider ? '' : 'Repli local (fournisseur indisponible) · '}${a.model}`, 'Système')
      })
    }
    step('indexed', 88, 'Indexation pour la recherche…')
    await wait(450)
    step('ready', 100, getState().candidates.find((c) => c.id === id)!.confidence < 0.6 ? 'Prêt — extraction à faible confiance, vérification requise.' : 'Prêt pour revue RH.')
    internal.mutate((d) => internal.auditEntry(d, 'Traitement terminé', 'candidate', id, 'Prêt pour revue', 'Système'))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    upd({ processing: 'error', processingError: msg })
    internal.mutate((d) => internal.auditEntry(d, 'Échec du traitement', 'candidate', id, msg, 'Système'))
    if (key) set(key, { stage: 'error', message: msg })
  }
}

export async function retryProcessing(id: string) {
  if (!can('upload')) throw new ApiError('FORBIDDEN', `Relancer un traitement n'est pas autorisé pour le rôle ${ROLE_LABEL[getState().settings.role]}.`)
  const c = getState().candidates.find((x) => x.id === id)
  if (!c) throw new ApiError('NOT_FOUND', 'Candidat introuvable')
  const blob = c.file.stored ? await files.get(id) : undefined
  if (!blob && !c.cvText) {
    throw new ApiError('FILE_NOT_FOUND', c.processingError ?? 'Fichier original introuvable dans le stockage local. Réimportez le CV.')
  }
  internal.mutate((d) => { const x = d.candidates.find((y) => y.id === id)!; x.processing = 'received'; x.processingError = undefined; internal.auditEntry(d, 'Traitement relancé', 'candidate', id, '') })
  await run(id, blob ? new File([blob], c.file.name) : null)
}

/** Resume jobs interrupted by a reload (status persisted mid-pipeline). */
let resumed = false
export function resumePending() {
  if (resumed) return
  resumed = true
  getState().candidates
    .filter((c) => ['received', 'extracting', 'analyzing', 'indexed'].includes(c.processing))
    .forEach((c, i) => setTimeout(async () => {
      const blob = c.file.stored ? await files.get(c.id) : undefined
      run(c.id, blob && !c.cvText ? new File([blob], c.file.name) : null)
    }, 2500 + i * 2200))
}
