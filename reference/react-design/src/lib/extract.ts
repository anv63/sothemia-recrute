// Structured field extraction from raw CV text (rule-based, local).
import { CITIES, EDUCATION_LEVELS, LANGUAGES, ROLES, SKILLS, findTerms, norm, roleInfo } from './lexicon'
import type { Candidate, Education, Experience, Language } from './types'

const YEAR_RANGE = /((?:19|20)\d{2})\s*[-–—à]+\s*((?:19|20)\d{2}|present|présent|aujourd'hui|actuel|ce jour|now)/i

export function nameFromFilename(filename: string): { firstName: string; lastName: string } {
  const base = filename.replace(/\.(pdf|docx)$/i, '')
  const parts = base
    .split(/[_\-.\s]+/)
    .filter((p) => p && !/^(cv|resume|curriculum|vitae|final|v\d+|\d+|fr|en)$/i.test(p))
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  if (parts.length === 0) return { firstName: '', lastName: '' }
  return { firstName: cap(parts[0]), lastName: parts.slice(1).map((p) => p.toUpperCase()).join(' ') }
}

export type Extracted = Pick<
  Candidate,
  | 'firstName' | 'lastName' | 'email' | 'phone' | 'city' | 'targetRole' | 'department' | 'experienceYears'
  | 'skills' | 'languages' | 'education' | 'experience' | 'certifications' | 'mobility' | 'summary'
  | 'confidence' | 'fieldConfidence'
>

const isDescription = (l?: string) =>
  !!l && l.length > 25 && !YEAR_RANGE.test(l) && l !== l.toUpperCase() && !EDUCATION_LEVELS.some((e) => e.aliases.some((a) => norm(l).includes(a)))

export function extractFields(text: string, filename: string): Extracted {
  const lines = text.split('\n')
  const n = norm(text)
  const fc: Record<string, number> = {}

  // Identity
  let { firstName, lastName } = nameFromFilename(filename)
  fc.name = firstName ? 0.7 : 0
  const first = lines.slice(0, 4).find((l) => /^[A-Za-zÀ-ÿ'\- ]{4,40}$/.test(l) && l.trim().split(' ').length <= 4)
  if (first) {
    const [f, ...rest] = first.trim().split(' ')
    if (rest.length) { firstName = f.charAt(0).toUpperCase() + f.slice(1).toLowerCase(); lastName = rest.join(' ').toUpperCase(); fc.name = 0.92 }
  }

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? ''
  fc.email = email ? 0.98 : 0
  const phone = text.match(/(\+212|0)[\s.-]?[5-7](?:[\s.-]?\d{2}){4}/)?.[0] ?? ''
  fc.phone = phone ? 0.95 : 0

  const city = CITIES.find((c) => c.aliases.some((a) => new RegExp(`\\b${a}\\b`).test(n)))?.name ?? ''
  fc.city = city ? 0.85 : 0

  const roleName = ROLES.find((r) => r.aliases.some((a) => n.includes(a)))?.name ?? ''
  fc.targetRole = roleName ? 0.8 : 0
  const department = roleInfo(roleName)?.department ?? ''

  // Experience
  const experience: Experience[] = []
  lines.forEach((l, i) => {
    const m = l.match(YEAR_RANGE)
    if (!m) return
    const head = l.replace(YEAR_RANGE, '').replace(/[|,·•–—-]+\s*$/, '').trim()
    const [title, company = ''] = head.split(/\s[—–|@-]\s|,\s| chez /i)
    experience.push({ title: title || 'Poste non précisé', company, start: m[1], end: /^\d/.test(m[2]) ? m[2] : 'Présent', description: isDescription(lines[i + 1]) ? lines[i + 1] : '' })
  })
  let experienceYears: number | null = null
  const explicit = n.match(/(\d{1,2})\s*\+?\s*(ans|annees|years)\s+(d'|de |of )?\s*experience/)
  if (explicit) { experienceYears = parseInt(explicit[1], 10); fc.experienceYears = 0.9 }
  else if (experience.length) {
    const now = new Date().getFullYear()
    const starts = experience.map((e) => parseInt(e.start, 10))
    const ends = experience.map((e) => (e.end === 'Présent' ? now : parseInt(e.end, 10)))
    experienceYears = Math.max(0, Math.max(...ends) - Math.min(...starts))
    fc.experienceYears = 0.65
  } else fc.experienceYears = 0

  const skills = findTerms(text, SKILLS)
  fc.skills = skills.length >= 3 ? 0.85 : skills.length ? 0.55 : 0

  const languages: Language[] = findTerms(text, LANGUAGES).map((name) => {
    const line = lines.find((l) => norm(l).includes(norm(name).slice(0, 5))) ?? ''
    const ln = norm(line)
    const level = /natif|maternelle|native/.test(ln) ? 'Langue maternelle' : /bilingue|courant|fluent|c1|c2/.test(ln) ? 'Courant' : /b2|intermediaire|professionnel/.test(ln) ? 'Professionnel' : /notions|a2|b1|basic|scolaire/.test(ln) ? 'Notions' : 'Non précisé'
    return { name, level }
  })
  fc.languages = languages.length ? 0.8 : 0

  const education: Education[] = []
  for (const l of lines) {
    const ln = norm(l)
    const lvl = EDUCATION_LEVELS.find((e) => e.aliases.some((a) => ln.includes(a)))
    if (lvl && education.length < 4) {
      const year = l.match(/(19|20)\d{2}/)?.[0] ?? ''
      const [degree, school = ''] = l.replace(/(19|20)\d{2}/, '').split(/\s[—–|-]\s|,\s/)
      education.push({ degree: degree.trim(), school: school.trim(), year })
    }
  }
  fc.education = education.length ? 0.8 : 0

  const certifications = lines
    .filter((l) => /certifi|lead auditor|green belt|black belt|pmp\b|iso \d+/i.test(l) && !YEAR_RANGE.test(l))
    .map((l) => l.replace(/^(certifications?|certificats?)\s*:?\s*/i, '').trim())
    .filter((l) => l.length > 2)
    .slice(0, 5)
  fc.certifications = certifications.length ? 0.75 : 0

  const mobLine = lines.find((l) => /mobilit/i.test(l))
  const mobility = mobLine ? mobLine.replace(/^mobilit[ée]\s*:?\s*/i, '') : ''
  fc.mobility = mobility ? 0.7 : 0

  const summary = lines.find((l) => l.length > 80 && !YEAR_RANGE.test(l)) ?? ''
  fc.summary = summary ? 0.6 : 0

  const keys = ['name', 'email', 'phone', 'city', 'targetRole', 'experienceYears', 'skills', 'education']
  const confidence = text ? keys.reduce((a, k) => a + (fc[k] ?? 0), 0) / keys.length : 0.08

  return {
    firstName, lastName, email, phone, city, targetRole: roleName, department, experienceYears,
    skills, languages, education, experience, certifications, mobility, summary,
    confidence: Math.round(confidence * 100) / 100, fieldConfidence: fc,
  }
}
