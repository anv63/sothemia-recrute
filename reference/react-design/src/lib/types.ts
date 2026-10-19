// Data model — mirrors the local SQLite ATS schema documented in docs/HANDOFF.md.

export type ProcessingStatus = 'received' | 'extracting' | 'analyzing' | 'indexed' | 'ready' | 'error'
export type ReviewStatus = 'a_examiner' | 'en_revue' | 'retenu' | 'en_attente' | 'archive'
export type ProviderId = 'local' | 'openai' | 'gemini' | 'anthropic'
export type Role = 'recruteur' | 'manager' | 'admin'
export type CriterionState = 'satisfied' | 'partial' | 'missing'

export interface Education {
  degree: string
  school: string
  year: string
}

export interface Experience {
  title: string
  company: string
  start: string
  end: string
  description: string
}

export interface Language {
  name: string
  level: string
}

export interface CvFile {
  name: string
  type: 'pdf' | 'docx'
  sizeKb: number
  hash: string
  pages: number
  /** true when the original binary is stored locally (IndexedDB in the prototype, data/cv_files/ in production). */
  stored: boolean
}

export interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  city: string
  targetRole: string
  department: string
  experienceYears: number | null
  skills: string[]
  languages: Language[]
  education: Education[]
  experience: Experience[]
  certifications: string[]
  mobility: string
  summary: string
  notes: string
  processing: ProcessingStatus
  processingError?: string
  review: ReviewStatus
  score: number | null
  /** Global extraction confidence 0–1. */
  confidence: number
  /** Per-field confidence 0–1, keyed by field name. */
  fieldConfidence: Record<string, number>
  file: CvFile
  cvText: string
  createdAt: string
  updatedAt: string
}

export interface Evidence {
  claim: string
  quote: string
  location: string
}

export interface Analysis {
  id: string
  candidateId: string
  provider: ProviderId
  model: string
  createdAt: string
  score: number
  confidence: number
  summary: string
  strengths: string[]
  attention: string[]
  detectedSkills: { name: string; evidence: string }[]
  missing: string[]
  evidence: Evidence[]
  offerId?: string
  reviewedBy?: string
  reviewedAt?: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  role: Role
  action: string
  entity: 'candidate' | 'analysis' | 'offer' | 'provider' | 'system' | 'search'
  entityId?: string
  details: string
}

export interface Weights {
  skills: number
  experience: number
  education: number
  languages: number
  location: number
}

export interface Offer {
  id: string
  title: string
  department: string
  requiredSkills: string[]
  preferredSkills: string[]
  minExperience: number
  education: string
  languages: string[]
  city: string
  mobilityAccepted: boolean
  weights: Weights
  updatedAt: string
}

export interface ProviderConfig {
  id: Exclude<ProviderId, 'local'>
  name: string
  vendor: string
  models: string[]
  model: string
  enabled: boolean
  keyStatus: 'configured' | 'missing' | 'invalid'
  keyUpdatedAt?: string
  lastTest?: { at: string; ok: boolean; latencyMs: number; message: string }
}

export interface Settings {
  defaultProvider: ProviderId
  retentionMonths: number
  autoAnalyze: boolean
  anonymizeBeforeSending: boolean
  role: Role
  userName: string
  simulateFailures: boolean
  lastBackupAt?: string
  lastExportAt?: string
}

export interface DbState {
  version: number
  candidates: Candidate[]
  analyses: Analysis[]
  audit: AuditEntry[]
  offers: Offer[]
  providers: ProviderConfig[]
  settings: Settings
}
