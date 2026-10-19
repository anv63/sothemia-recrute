// Controlled vocabulary used by local extraction, analysis and natural-language search.
// Production: store in SQLite table `lexicon` so HR can extend it without a code change.

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'")

interface Term {
  name: string
  aliases: string[]
  related?: string[]
}

export const SKILLS: Term[] = [
  { name: 'Assurance qualité', aliases: ['assurance qualite', 'quality assurance', 'assurance-qualite'], related: ['Contrôle qualité', 'Audit qualité', 'ISO 9001', 'CAPA'] },
  { name: 'BPF / GMP', aliases: ['bpf', 'gmp', 'bonnes pratiques de fabrication', 'good manufacturing practice'], related: ['ISO 9001', 'Production pharmaceutique', 'Validation des procédés'] },
  { name: 'Contrôle qualité', aliases: ['controle qualite', 'quality control', 'controle-qualite'], related: ['HPLC', 'Microbiologie', 'Assurance qualité'] },
  { name: 'HPLC', aliases: ['hplc', 'chromatographie'], related: ['Contrôle qualité'] },
  { name: 'Validation des procédés', aliases: ['validation des procedes', 'validation de procedes', 'qualification des equipements', 'process validation'], related: ['BPF / GMP'] },
  { name: 'CAPA', aliases: ['capa', 'actions correctives'], related: ['Gestion des déviations'] },
  { name: 'Gestion des déviations', aliases: ['deviation', 'deviations', 'non-conformite', 'non-conformites'], related: ['CAPA'] },
  { name: 'Audit qualité', aliases: ['audit', 'audits', 'auditeur'], related: ['ISO 9001'] },
  { name: 'ISO 9001', aliases: ['iso 9001'], related: ['Audit qualité'] },
  { name: 'Data integrity', aliases: ['data integrity', 'integrite des donnees', 'alcoa'] },
  { name: 'Pharmacovigilance', aliases: ['pharmacovigilance'], related: ['Affaires réglementaires'] },
  { name: 'Affaires réglementaires', aliases: ['affaires reglementaires', 'regulatory affairs', 'dossier amm', 'dossiers amm', 'ctd'], related: ['Pharmacovigilance'] },
  { name: 'Production pharmaceutique', aliases: ['production pharmaceutique', 'fabrication', 'conditionnement', 'formes seches', 'formes injectables'], related: ['BPF / GMP'] },
  { name: 'Microbiologie', aliases: ['microbiologie', 'microbiology'], related: ['Contrôle qualité'] },
  { name: 'Lean Six Sigma', aliases: ['lean', 'six sigma', 'kaizen'] },
  { name: 'SAP', aliases: ['sap'] },
  { name: 'Excel avancé', aliases: ['excel'] },
  { name: 'Power BI', aliases: ['power bi'] },
  { name: 'Supply chain', aliases: ['supply chain', 'approvisionnement', 'logistique', 'planification'] },
  { name: 'Délégation médicale', aliases: ['delegue medical', 'visite medicale', 'delegation medicale'] },
  { name: 'Marketing pharmaceutique', aliases: ['marketing', 'chef de produit'] },
  { name: 'Gestion de projet', aliases: ['gestion de projet', 'project management', 'pmp'] },
  { name: 'Recrutement', aliases: ['recrutement', 'sourcing', 'talent acquisition'] },
  { name: 'Paie', aliases: ['paie', 'payroll'] },
  { name: 'Contrôle de gestion', aliases: ['controle de gestion', 'reporting financier'] },
  { name: 'Comptabilité', aliases: ['comptabilite', 'accounting'] },
  { name: 'Maintenance industrielle', aliases: ['maintenance'] },
  { name: 'Négociation commerciale', aliases: ['negociation'] },
]

export const ROLES: (Term & { department: string; family: string })[] = [
  { name: 'Pharmacien assurance qualité', aliases: ['pharmacien assurance qualite', 'pharmacienne assurance qualite', 'qa pharmacist'], department: 'Assurance qualité', family: 'qualite' },
  { name: 'Pharmacien', aliases: ['pharmacien', 'pharmacienne', 'pharmacist', 'pharmacists', 'docteur en pharmacie'], department: 'Assurance qualité', family: 'qualite' },
  { name: 'Responsable assurance qualité', aliases: ['responsable assurance qualite', 'qa manager', 'responsable qualite'], department: 'Assurance qualité', family: 'qualite' },
  { name: 'Ingénieur qualité', aliases: ['ingenieur qualite', 'quality engineer'], department: 'Assurance qualité', family: 'qualite' },
  { name: 'Analyste contrôle qualité', aliases: ['analyste controle qualite', 'analyste cq', 'qc analyst', 'analyste'], department: 'Contrôle qualité', family: 'qualite' },
  { name: 'Technicien de laboratoire', aliases: ['technicien de laboratoire', 'technicienne de laboratoire', 'lab technician', 'technicien'], department: 'Contrôle qualité', family: 'qualite' },
  { name: 'Chargé des affaires réglementaires', aliases: ['charge des affaires reglementaires', 'chargee des affaires reglementaires', 'regulatory affairs officer'], department: 'Affaires réglementaires', family: 'reglementaire' },
  { name: 'Ingénieur production', aliases: ['ingenieur production', 'ingenieur de production', 'production engineer'], department: 'Production', family: 'production' },
  { name: 'Responsable supply chain', aliases: ['responsable supply chain', 'supply chain manager'], department: 'Supply chain', family: 'supply' },
  { name: 'Délégué médical', aliases: ['delegue medical', 'deleguee medicale', 'medical representative', 'medical rep'], department: 'Commercial & Marketing', family: 'commercial' },
  { name: 'Chef de produit marketing', aliases: ['chef de produit', 'product manager'], department: 'Commercial & Marketing', family: 'commercial' },
  { name: 'Chargé RH', aliases: ['charge rh', 'chargee rh', 'charge de recrutement', 'hr officer'], department: 'Ressources humaines', family: 'rh' },
  { name: 'Contrôleur de gestion', aliases: ['controleur de gestion', 'financial controller'], department: 'Finance', family: 'finance' },
]

export const DEPARTMENTS = [
  'Assurance qualité',
  'Contrôle qualité',
  'Production',
  'Affaires réglementaires',
  'Supply chain',
  'Commercial & Marketing',
  'Ressources humaines',
  'Finance',
]

export const CITIES: { name: string; region: string; aliases: string[] }[] = [
  { name: 'Casablanca', region: 'Casablanca-Settat', aliases: ['casablanca', 'casa'] },
  { name: 'Mohammedia', region: 'Casablanca-Settat', aliases: ['mohammedia'] },
  { name: 'El Jadida', region: 'Casablanca-Settat', aliases: ['el jadida'] },
  { name: 'Settat', region: 'Casablanca-Settat', aliases: ['settat'] },
  { name: 'Berrechid', region: 'Casablanca-Settat', aliases: ['berrechid'] },
  { name: 'Rabat', region: 'Rabat-Salé-Kénitra', aliases: ['rabat'] },
  { name: 'Salé', region: 'Rabat-Salé-Kénitra', aliases: ['sale'] },
  { name: 'Kénitra', region: 'Rabat-Salé-Kénitra', aliases: ['kenitra'] },
  { name: 'Tanger', region: 'Tanger-Tétouan', aliases: ['tanger', 'tangier'] },
  { name: 'Tétouan', region: 'Tanger-Tétouan', aliases: ['tetouan'] },
  { name: 'Marrakech', region: 'Marrakech-Safi', aliases: ['marrakech', 'marrakesh'] },
  { name: 'Fès', region: 'Fès-Meknès', aliases: ['fes', 'fez'] },
  { name: 'Meknès', region: 'Fès-Meknès', aliases: ['meknes'] },
  { name: 'Agadir', region: 'Souss-Massa', aliases: ['agadir'] },
  { name: 'Oujda', region: 'Oriental', aliases: ['oujda'] },
]

export const LANGUAGES: Term[] = [
  { name: 'Français', aliases: ['francais', 'french'] },
  { name: 'Anglais', aliases: ['anglais', 'english'] },
  { name: 'Arabe', aliases: ['arabe', 'arabic'] },
  { name: 'Espagnol', aliases: ['espagnol', 'spanish'] },
  { name: 'Allemand', aliases: ['allemand', 'german'] },
  { name: 'Amazighe', aliases: ['amazighe', 'tamazight'] },
]

export const EDUCATION_LEVELS: { label: string; rank: number; aliases: string[] }[] = [
  { label: 'Doctorat en pharmacie', rank: 5, aliases: ['doctorat en pharmacie', 'docteur en pharmacie', 'pharmd', 'doctorat'] },
  { label: 'Master / Ingénieur', rank: 4, aliases: ['master', 'ingenieur', 'diplome d\'ingenieur', 'mba', 'msc'] },
  { label: 'Licence', rank: 3, aliases: ['licence', 'bachelor'] },
  { label: 'Bac+2 (DUT / BTS)', rank: 2, aliases: ['dut', 'bts', 'deug', 'technicien specialise'] },
  { label: 'Baccalauréat', rank: 1, aliases: ['baccalaureat'] },
]

export const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, one: 1, deux: 2, two: 2, trois: 3, three: 3, quatre: 4, four: 4,
  cinq: 5, five: 5, six: 6, sept: 7, seven: 7, huit: 8, eight: 8, neuf: 9, nine: 9, dix: 10, ten: 10,
}

/** Protected attributes — never used for search, scoring or ranking. */
export const PROTECTED_PATTERNS: { reason: string; re: RegExp }[] = [
  { reason: 'âge', re: /\b(age|agee?s?|aged|jeunes?|young|older|senior citizen|ne en|nee en|annee de naissance|born)\b/ },
  { reason: 'âge', re: /\b(moins de|under|less than|younger than|plus jeune que)\s+\d{2}\s*(ans|years)(?!\s*(d'|de |of )?\s*(experience|exp))/ },
  { reason: 'genre', re: /\b(homme|hommes|femme|femmes|male|female|man|woman|women|men|gender|genre|sexe|masculin|feminin)\b/ },
  { reason: 'nationalité', re: /\b(nationalite|nationality|marocaine?s?|moroccan|etrangers?|etrangeres?|foreigners?|citizenship)\b/ },
  { reason: 'situation familiale', re: /\b(marie|mariee|celibataire|married|single|divorce|divorcee|marital|situation familiale|enfants|children)\b/ },
  { reason: 'photo', re: /\b(photo|photos|picture|portrait|apparence|appearance)\b/ },
]

export function findTerms(text: string, terms: Term[]): string[] {
  const t = ` ${norm(text)} `
  const found: string[] = []
  for (const term of terms) {
    if (term.aliases.some((a) => new RegExp(`[^a-z0-9]${escapeRe(a)}[^a-z0-9]`).test(t))) found.push(term.name)
  }
  return found
}

export function aliasesOf(name: string): string[] {
  const all = [...SKILLS, ...ROLES, ...LANGUAGES]
  const t = all.find((x) => x.name === name)
  const city = CITIES.find((c) => c.name === name)
  return t ? t.aliases : city ? city.aliases : [norm(name)]
}

export const relatedSkills = (name: string) => SKILLS.find((s) => s.name === name)?.related ?? []
export const roleInfo = (name: string) => ROLES.find((r) => r.name === name)
export const cityInfo = (name: string) => CITIES.find((c) => c.name === name)
export const educationRank = (label: string) => {
  const n = norm(label)
  return EDUCATION_LEVELS.find((e) => e.label === label || e.aliases.some((a) => n.includes(a)))?.rank ?? 0
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
