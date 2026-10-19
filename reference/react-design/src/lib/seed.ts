// Safe reference defaults. Candidate records are never seeded or fabricated.
// The production Streamlit application and SQLite store are the source of truth.
import type { DbState, Offer, ProviderConfig, ProviderId } from './types'

export const nextCandidateId = (n: number) => `CAND-${String(n).padStart(4, '0')}`

export const DEFAULT_OFFERS: Offer[] = [
  {
    id: 'OFR-001', title: 'Pharmacien assurance qualité', department: 'Assurance qualité',
    requiredSkills: ['Assurance qualité', 'BPF / GMP'], preferredSkills: ['CAPA', 'Validation des procédés', 'Data integrity'],
    minExperience: 5, education: 'Doctorat en pharmacie', languages: ['Français', 'Anglais'], city: 'Casablanca',
    mobilityAccepted: true, weights: { skills: 40, experience: 25, education: 15, languages: 10, location: 10 }, updatedAt: '',
  },
  {
    id: 'OFR-002', title: 'Analyste contrôle qualité', department: 'Contrôle qualité',
    requiredSkills: ['Contrôle qualité', 'HPLC'], preferredSkills: ['Data integrity', 'Microbiologie'],
    minExperience: 3, education: 'Master / Ingénieur', languages: ['Français'], city: 'Casablanca',
    mobilityAccepted: true, weights: { skills: 45, experience: 25, education: 10, languages: 5, location: 15 }, updatedAt: '',
  },
  {
    id: 'OFR-003', title: 'Chargé des affaires réglementaires', department: 'Affaires réglementaires',
    requiredSkills: ['Affaires réglementaires'], preferredSkills: ['Pharmacovigilance', 'Gestion de projet'],
    minExperience: 4, education: 'Doctorat en pharmacie', languages: ['Français', 'Anglais'], city: 'Rabat',
    mobilityAccepted: false, weights: { skills: 40, experience: 20, education: 20, languages: 10, location: 10 }, updatedAt: '',
  },
]

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: 'openai', name: 'OpenAI', vendor: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4.1'], model: 'gpt-4o-mini', enabled: false, keyStatus: 'missing' },
  { id: 'gemini', name: 'Google Gemini', vendor: 'Google', models: ['gemini-1.5-flash', 'gemini-2.0-flash'], model: 'gemini-1.5-flash', enabled: false, keyStatus: 'missing' },
  { id: 'anthropic', name: 'Anthropic Claude', vendor: 'Anthropic', models: ['claude-3-5-haiku', 'claude-sonnet-4'], model: 'claude-3-5-haiku', enabled: false, keyStatus: 'missing' },
]

export const MODEL_OF: Record<ProviderId, string> = {
  local: 'ResumeAnalyzer local', openai: 'gpt-4o-mini', gemini: 'gemini-1.5-flash', anthropic: 'claude-3-5-haiku',
}

/** Always return an empty candidate collection; real CVs must come from the backend. */
export function buildSeed(_empty = false): DbState {
  return {
    version: 999,
    candidates: [],
    analyses: [],
    audit: [],
    offers: DEFAULT_OFFERS,
    providers: DEFAULT_PROVIDERS,
    settings: {
      defaultProvider: 'local',
      retentionMonths: 24,
      autoAnalyze: true,
      anonymizeBeforeSending: true,
      role: 'recruteur',
      userName: 'Utilisateur RH',
      simulateFailures: false,
    },
  }
}
