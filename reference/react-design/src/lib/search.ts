// Natural-language query interpretation and transparent candidate matching.
// Protected attributes (age, gender, nationality, marital status, photo) are detected and ignored — never scored.
import { DATED, findEvidence } from './evidence'
import {
  CITIES, EDUCATION_LEVELS, LANGUAGES, NUMBER_WORDS, PROTECTED_PATTERNS, ROLES, SKILLS,
  aliasesOf, cityInfo, educationRank, escapeRe, norm, relatedSkills, roleInfo,
} from './lexicon'
import type { Candidate, CriterionState, Offer, Weights } from './types'

export const DEFAULT_WEIGHTS: Weights = { skills: 40, experience: 25, education: 15, languages: 10, location: 10 }

export interface ParsedQuery {
  raw: string
  roles: string[]
  skills: string[]
  minYears: number | null
  cities: string[]
  languages: string[]
  education: string | null
  ignored: { term: string; reason: string }[]
  keywords: string[]
}

export type CriterionKind = 'role' | 'skill' | 'experience' | 'education' | 'language' | 'location' | 'keyword'

export interface Criterion {
  id: string
  kind: CriterionKind
  label: string
  value: string | number
  bucket: keyof Weights
  required: boolean
  source: 'query' | 'offer' | 'filter'
}

export interface CriterionResult extends Criterion {
  state: CriterionState
  note: string
  evidence?: { quote: string; location: string }
}

export interface MatchResult {
  candidate: Candidate
  score: number
  results: CriterionResult[]
}

export function parseQuery(raw: string): ParsedQuery {
  let work = ` ${norm(raw)} `
  const ignored: ParsedQuery['ignored'] = []
  for (const p of PROTECTED_PATTERNS) {
    const g = new RegExp(p.re.source, 'g')
    let m: RegExpExecArray | null
    while ((m = g.exec(work))) {
      ignored.push({ term: m[0].trim(), reason: p.reason })
    }
    work = work.replace(g, ' ')
  }

  const roles: string[] = []
  const byLen = ROLES.flatMap((r) => r.aliases.map((a) => ({ r: r.name, a }))).sort((x, y) => y.a.length - x.a.length)
  for (const { r, a } of byLen) {
    const re = new RegExp(`(^|[^a-z])${escapeRe(a)}s?([^a-z]|$)`)
    if (re.test(work)) {
      if (!roles.includes(r)) roles.push(r)
      work = work.replace(re, ' ')
    }
  }

  const skills: string[] = []
  for (const s of SKILLS) {
    for (const a of s.aliases) {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRe(a)}([^a-z0-9]|$)`)
      if (re.test(work)) {
        if (!skills.includes(s.name)) skills.push(s.name)
        work = work.replace(re, ' ')
      }
    }
  }

  let minYears: number | null = null
  const num = Object.keys(NUMBER_WORDS).join('|')
  const ym = work.match(new RegExp(`(\\d{1,2}|${num})\\s*\\+?\\s*(ans|annees|years?)`))
  if (ym) {
    minYears = /\d/.test(ym[1]) ? parseInt(ym[1], 10) : NUMBER_WORDS[ym[1]]
    work = work.replace(ym[0], ' ')
  }

  const cities = CITIES.filter((c) => c.aliases.some((a) => new RegExp(`(^|[^a-z])${escapeRe(a)}([^a-z]|$)`).test(work))).map((c) => c.name)
  const languages = LANGUAGES.filter((l) => l.aliases.some((a) => work.includes(a))).map((l) => l.name)
  const education = EDUCATION_LEVELS.find((e) => e.aliases.some((a) => work.includes(a)))?.label ?? null

  const keywords: string[] = []
  if (!roles.length && !skills.length && minYears === null && !cities.length && !languages.length && !education) {
    const kw = raw.trim()
    if (kw && !ignored.length) keywords.push(kw)
  }
  return { raw, roles, skills, minYears, cities, languages, education, ignored, keywords }
}

export function buildCriteria(q: ParsedQuery | null, offer?: Offer | null): Criterion[] {
  const out: Criterion[] = []
  const add = (c: Omit<Criterion, 'id'>) => {
    if (!out.some((x) => x.kind === c.kind && x.value === c.value)) out.push({ ...c, id: `${c.kind}:${c.value}` })
  }
  if (offer) {
    add({ kind: 'role', label: `Poste : ${offer.title}`, value: offer.title, bucket: 'experience', required: true, source: 'offer' })
    offer.requiredSkills.forEach((s) => add({ kind: 'skill', label: s, value: s, bucket: 'skills', required: true, source: 'offer' }))
    offer.preferredSkills.forEach((s) => add({ kind: 'skill', label: s, value: s, bucket: 'skills', required: false, source: 'offer' }))
    if (offer.minExperience > 0) add({ kind: 'experience', label: `≥ ${offer.minExperience} ans d'expérience`, value: offer.minExperience, bucket: 'experience', required: true, source: 'offer' })
    if (offer.education) add({ kind: 'education', label: offer.education, value: offer.education, bucket: 'education', required: true, source: 'offer' })
    offer.languages.forEach((l) => add({ kind: 'language', label: l, value: l, bucket: 'languages', required: true, source: 'offer' }))
    if (offer.city) add({ kind: 'location', label: offer.mobilityAccepted ? `${offer.city} ou mobilité` : offer.city, value: offer.city, bucket: 'location', required: true, source: 'offer' })
  }
  if (q) {
    q.roles.forEach((r) => add({ kind: 'role', label: `Poste : ${r}`, value: r, bucket: 'experience', required: true, source: 'query' }))
    q.skills.forEach((s) => add({ kind: 'skill', label: s, value: s, bucket: 'skills', required: true, source: 'query' }))
    if (q.minYears !== null) add({ kind: 'experience', label: `≥ ${q.minYears} ans d'expérience`, value: q.minYears, bucket: 'experience', required: true, source: 'query' })
    if (q.education) add({ kind: 'education', label: q.education, value: q.education, bucket: 'education', required: true, source: 'query' })
    q.languages.forEach((l) => add({ kind: 'language', label: l, value: l, bucket: 'languages', required: true, source: 'query' }))
    q.cities.forEach((c) => add({ kind: 'location', label: c, value: c, bucket: 'location', required: true, source: 'query' }))
    q.keywords.forEach((k) => add({ kind: 'keyword', label: `Mot-clé : « ${k} »`, value: k, bucket: 'skills', required: true, source: 'query' }))
  }
  return out
}

function evaluate(c: Candidate, cr: Criterion, mobilityAccepted: boolean): Omit<CriterionResult, keyof Criterion> {
  switch (cr.kind) {
    case 'role': {
      const v = String(cr.value)
      const ev = findEvidence(c.cvText, [...aliasesOf(v), norm(v)], { header: true })
      const same = norm(c.targetRole).includes(norm(v)) || norm(v).includes(norm(c.targetRole) || '§')
      const pharmaDegree = /pharmac/i.test(v) && c.education.some((e) => /pharmac/i.test(e.degree))
      if (same || pharmaDegree) return { state: 'satisfied', note: same ? `Poste visé : ${c.targetRole}` : 'Diplôme de pharmacien détecté', evidence: ev ?? findEvidence(c.cvText, ['pharmacie']) }
      const fam = roleInfo(v)?.family
      if (fam && roleInfo(c.targetRole)?.family === fam) return { state: 'partial', note: `Poste proche : ${c.targetRole}`, evidence: findEvidence(c.cvText, aliasesOf(c.targetRole), { header: true }) }
      return { state: 'missing', note: c.targetRole ? `Poste visé différent : ${c.targetRole}` : 'Poste visé non détecté' }
    }
    case 'skill': {
      const v = String(cr.value)
      if (c.skills.includes(v)) return { state: 'satisfied', note: 'Compétence détectée dans le CV', evidence: findEvidence(c.cvText, aliasesOf(v)) }
      const rel = relatedSkills(v).find((r) => c.skills.includes(r))
      if (rel) return { state: 'partial', note: `Compétence proche : ${rel}`, evidence: findEvidence(c.cvText, aliasesOf(rel)) }
      return { state: 'missing', note: 'Non mentionnée dans le CV' }
    }
    case 'experience': {
      const min = Number(cr.value)
      const y = c.experienceYears
      const ev = c.experience[0] ? findEvidence(c.cvText, [c.experience[0].title], { prefer: DATED }) : undefined
      if (y === null) return { state: 'missing', note: 'Durée non détectée — à vérifier' }
      if (y >= min) return { state: 'satisfied', note: `${y} ans d'expérience`, evidence: ev }
      if (y >= min - 2 && y > 0) return { state: 'partial', note: `${y} ans (écart de ${min - y} an${min - y > 1 ? 's' : ''})`, evidence: ev }
      return { state: 'missing', note: `${y} an${y > 1 ? 's' : ''} d'expérience` }
    }
    case 'education': {
      const need = educationRank(String(cr.value))
      const best = c.education.reduce((m, e) => Math.max(m, educationRank(e.degree)), 0)
      const top = c.education.find((e) => educationRank(e.degree) === best)
      const ev = top ? findEvidence(c.cvText, [top.degree]) : undefined
      if (best >= need && best > 0) return { state: 'satisfied', note: top?.degree ?? '', evidence: ev }
      if (best === need - 1) return { state: 'partial', note: `Niveau inférieur : ${top?.degree}`, evidence: ev }
      return { state: 'missing', note: best ? `Niveau détecté : ${top?.degree}` : 'Formation non détectée' }
    }
    case 'language': {
      const l = c.languages.find((x) => x.name === cr.value)
      const ev = findEvidence(c.cvText, aliasesOf(String(cr.value)))
      if (!l) return { state: 'missing', note: 'Langue non mentionnée' }
      if (l.level === 'Notions' || l.level === 'Non précisé') return { state: 'partial', note: `Niveau : ${l.level}`, evidence: ev }
      return { state: 'satisfied', note: `Niveau : ${l.level}`, evidence: ev }
    }
    case 'location': {
      const v = String(cr.value)
      const ev = findEvidence(c.cvText, aliasesOf(c.city), { header: true })
      if (c.city === v) return { state: 'satisfied', note: `Basé à ${c.city}`, evidence: ev }
      const mob = /nationale|national|internationale|tout le maroc|toutes villes/i.test(c.mobility)
      if (cityInfo(c.city)?.region && cityInfo(c.city)?.region === cityInfo(v)?.region) return { state: 'partial', note: `Même région : ${c.city}`, evidence: ev }
      if (mob && mobilityAccepted) return { state: 'partial', note: `${c.city || 'Ville inconnue'} — mobilité ${c.mobility.toLowerCase()}`, evidence: findEvidence(c.cvText, ['mobilite']) }
      return { state: 'missing', note: c.city ? `Basé à ${c.city}` : 'Ville non détectée' }
    }
    case 'keyword': {
      const ev = findEvidence(c.cvText, [String(cr.value)])
      const hay = norm(`${c.firstName} ${c.lastName} ${c.email} ${c.targetRole} ${c.skills.join(' ')}`)
      if (ev || hay.includes(norm(String(cr.value)))) return { state: 'satisfied', note: 'Mot-clé trouvé', evidence: ev }
      return { state: 'missing', note: 'Mot-clé absent' }
    }
  }
}

export function matchCandidate(c: Candidate, criteria: Criterion[], weights: Weights = DEFAULT_WEIGHTS, mobilityAccepted = true): MatchResult {
  const results = criteria.map((cr) => ({ ...cr, ...evaluate(c, cr, mobilityAccepted) }))
  const perBucket: Record<string, number> = {}
  criteria.forEach((cr) => (perBucket[cr.bucket] = (perBucket[cr.bucket] ?? 0) + (cr.required ? 1 : 0.5)))
  let total = 0
  let got = 0
  for (const r of results) {
    const w = (weights[r.bucket] / perBucket[r.bucket]) * (r.required ? 1 : 0.5)
    total += w
    got += w * (r.state === 'satisfied' ? 1 : r.state === 'partial' ? 0.5 : 0)
  }
  return { candidate: c, score: total ? Math.round((got / total) * 100) : 0, results }
}

export function rank(candidates: Candidate[], criteria: Criterion[], weights?: Weights, mobilityAccepted = true): MatchResult[] {
  return candidates
    .filter((c) => c.processing === 'ready' || c.processing === 'indexed')
    .map((c) => matchCandidate(c, criteria, weights, mobilityAccepted))
    .sort((a, b) => b.score - a.score || (b.candidate.experienceYears ?? 0) - (a.candidate.experienceYears ?? 0))
}
