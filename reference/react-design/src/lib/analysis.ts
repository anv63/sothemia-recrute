// Local, rule-based CV analysis. When an external provider is selected, the same output contract is requested from
// the LLM (see docs/HANDOFF.md § Prompt contract); the prototype runs this engine for every provider and labels the
// result with the selected provider/model. Output is a recommendation — never an automated decision.
import { DATED, findEvidence } from './evidence'
import { aliasesOf, educationRank } from './lexicon'
import { buildCriteria, matchCandidate } from './search'
import type { Analysis, Candidate, Evidence, Offer, ProviderId } from './types'

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom complet', email: 'Adresse e-mail', phone: 'Téléphone', city: 'Ville', targetRole: 'Poste visé',
  experienceYears: "Durée d'expérience", skills: 'Compétences', education: 'Formation', languages: 'Langues',
  certifications: 'Certifications', mobility: 'Mobilité', summary: 'Résumé de profil',
}
export const fieldLabel = (k: string) => FIELD_LABELS[k] ?? k

const CORE = ['BPF / GMP', 'Assurance qualité', 'Validation des procédés', 'CAPA', 'Data integrity', 'Contrôle qualité', 'HPLC', 'Affaires réglementaires']

export function analyzeCandidate(c: Candidate, provider: ProviderId, model: string, offer?: Offer | null, at = new Date()): Analysis {
  const strengths: string[] = []
  const attention: string[] = []
  const evidence: Evidence[] = []
  const pushEv = (claim: string, aliases: string[], prefer?: RegExp) => {
    const e = findEvidence(c.cvText, aliases, { prefer })
    if (e) evidence.push({ claim, quote: e.quote, location: e.location })
  }

  const y = c.experienceYears
  if (y !== null && y >= 5) {
    strengths.push(`${y} ans d'expérience professionnelle cumulée`)
    if (c.experience[0]) pushEv(`${y} ans d'expérience`, [c.experience[0].title], DATED)
  }
  const core = c.skills.filter((s) => CORE.includes(s))
  if (core.length >= 2) {
    strengths.push(`Compétences métier clés : ${core.slice(0, 3).join(', ')}`)
    core.slice(0, 2).forEach((s) => pushEv(s, aliasesOf(s)))
  }
  const best = c.education.reduce((m, e) => (educationRank(e.degree) > educationRank(m?.degree ?? '') ? e : m), c.education[0])
  if (best && educationRank(best.degree) >= 4) {
    strengths.push(`Formation : ${best.degree}${best.school ? ` (${best.school})` : ''}`)
    pushEv(best.degree, [best.degree])
  }
  const fluent = c.languages.filter((l) => l.level !== 'Notions')
  if (fluent.length >= 3) {
    strengths.push(`Maîtrise de ${fluent.length} langues : ${fluent.map((l) => l.name).join(', ')}`)
    pushEv('Langues', aliasesOf(fluent[1]?.name ?? fluent[0].name))
  }
  if (c.certifications.length) {
    strengths.push(`Certification${c.certifications.length > 1 ? 's' : ''} : ${c.certifications.join(', ')}`)
    pushEv('Certification', [c.certifications[0]])
  }

  if (c.confidence < 0.7) attention.push(`Confiance d'extraction faible (${Math.round(c.confidence * 100)} %) — vérifier les champs extraits avant toute utilisation.`)
  if (!c.email || !c.phone) attention.push('Coordonnées incomplètes dans le CV.')
  const sorted = [...c.experience].sort((a, b) => parseInt(a.start) - parseInt(b.start))
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].end === 'Présent' ? at.getFullYear() : parseInt(sorted[i - 1].end)
    const start = parseInt(sorted[i].start)
    if (start - prevEnd >= 2) attention.push(`Période sans activité mentionnée entre ${prevEnd} et ${start} — à clarifier en entretien si pertinent.`)
  }
  if (!c.certifications.length) attention.push('Aucune certification mentionnée.')
  if (!c.languages.some((l) => l.name === 'Anglais')) attention.push("Niveau d'anglais non précisé.")
  const thin = c.experience.filter((e) => !e.description)
  if (thin.length) attention.push(`Missions peu détaillées : ${thin.map((e) => e.title).slice(0, 2).join(', ')}.`)

  const missing = Object.entries(c.fieldConfidence)
    .filter(([, v]) => v === 0)
    .map(([k]) => fieldLabel(k))
  const uncertain = Object.entries(c.fieldConfidence)
    .filter(([, v]) => v > 0 && v < 0.7)
    .map(([k]) => `${fieldLabel(k)} (incertain)`)

  let score: number
  if (offer) {
    score = matchCandidate(c, buildCriteria(null, offer), offer.weights, offer.mobilityAccepted).score
  } else {
    const exp = Math.min((y ?? 0) / 10, 1) * 30
    const sk = Math.min(c.skills.length / 8, 1) * 30
    const ed = (educationRank(best?.degree ?? '') / 5) * 20
    const la = Math.min(fluent.length / 3, 1) * 10
    score = Math.round(exp + sk + ed + la + c.confidence * 10)
  }

  const summary = [
    `${c.targetRole || 'Profil'}${y !== null ? ` avec ${y} an${y > 1 ? 's' : ''} d'expérience` : ''}${c.city ? `, localisation : ${c.city}` : ''}.`,
    c.skills.length ? `Compétences principales : ${c.skills.slice(0, 4).join(', ')}.` : 'Aucune compétence identifiée automatiquement.',
    c.experience[0] ? `Poste le plus récent : ${c.experience[0].title}${c.experience[0].company ? ` chez ${c.experience[0].company}` : ''}.` : '',
  ].filter(Boolean).join(' ')

  return {
    id: `AN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    candidateId: c.id,
    provider,
    model,
    createdAt: at.toISOString(),
    score: Math.max(0, Math.min(100, score)),
    confidence: c.confidence,
    summary,
    strengths,
    attention,
    detectedSkills: c.skills.map((s) => ({ name: s, evidence: findEvidence(c.cvText, aliasesOf(s))?.location ?? '—' })),
    missing: [...missing, ...uncertain],
    evidence,
    offerId: offer?.id,
  }
}
