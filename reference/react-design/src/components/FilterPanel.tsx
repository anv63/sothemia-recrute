import { RotateCcw } from 'lucide-react'
import { DEPARTMENTS, SKILLS } from '../lib/lexicon'
import { PROCESSING_LABEL, REVIEW_LABEL } from '../lib/format'
import type { ProcessingStatus, ReviewStatus } from '../lib/types'
import { Button, Field, Select, cx } from './ui'

export interface CandidateFilters {
  city: string
  department: string
  processing: '' | ProcessingStatus
  review: '' | ReviewStatus
  skill: string
  minScore: number
  minExp: number
}
export const EMPTY_FILTERS: CandidateFilters = { city: '', department: '', processing: '', review: '', skill: '', minScore: 0, minExp: 0 }

export const activeFilterCount = (f: CandidateFilters) =>
  (Object.keys(f) as (keyof CandidateFilters)[]).filter((k) => f[k] !== EMPTY_FILTERS[k]).length

export default function FilterPanel({ value, onChange, cities, layout = 'grid', hide = [] }: { value: CandidateFilters; onChange: (f: CandidateFilters) => void; cities: string[]; layout?: 'grid' | 'stack'; hide?: (keyof CandidateFilters)[] }) {
  const set = <K extends keyof CandidateFilters>(k: K, v: CandidateFilters[K]) => onChange({ ...value, [k]: v })
  const show = (k: keyof CandidateFilters) => !hide.includes(k)
  return (
    <div className={cx(layout === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7' : 'flex flex-col gap-4')}>
      {show('city') && (
        <Field label="Ville" htmlFor="f-city">
          <Select id="f-city" value={value.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">Toutes</option>
            {cities.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
      )}
      {show('department') && (
        <Field label="Département" htmlFor="f-dep">
          <Select id="f-dep" value={value.department} onChange={(e) => set('department', e.target.value)}>
            <option value="">Tous</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>
      )}
      {show('skill') && (
        <Field label="Compétence" htmlFor="f-skill">
          <Select id="f-skill" value={value.skill} onChange={(e) => set('skill', e.target.value)}>
            <option value="">Toutes</option>
            {SKILLS.map((s) => <option key={s.name}>{s.name}</option>)}
          </Select>
        </Field>
      )}
      {show('processing') && (
        <Field label="Traitement" htmlFor="f-proc">
          <Select id="f-proc" value={value.processing} onChange={(e) => set('processing', e.target.value as CandidateFilters['processing'])}>
            <option value="">Tous</option>
            {(Object.keys(PROCESSING_LABEL) as ProcessingStatus[]).map((p) => <option key={p} value={p}>{PROCESSING_LABEL[p]}</option>)}
          </Select>
        </Field>
      )}
      {show('review') && (
        <Field label="Statut RH" htmlFor="f-rev">
          <Select id="f-rev" value={value.review} onChange={(e) => set('review', e.target.value as CandidateFilters['review'])}>
            <option value="">Tous</option>
            {(Object.keys(REVIEW_LABEL) as ReviewStatus[]).map((p) => <option key={p} value={p}>{REVIEW_LABEL[p]}</option>)}
          </Select>
        </Field>
      )}
      {show('minExp') && (
        <Field label={`Expérience min. · ${value.minExp} an${value.minExp > 1 ? 's' : ''}`} htmlFor="f-exp">
          <input id="f-exp" type="range" min={0} max={15} value={value.minExp} onChange={(e) => set('minExp', +e.target.value)} className="h-9 w-full accent-brand-600" />
        </Field>
      )}
      {show('minScore') && (
        <Field label={`Score min. · ${value.minScore}`} htmlFor="f-score">
          <input id="f-score" type="range" min={0} max={100} step={5} value={value.minScore} onChange={(e) => set('minScore', +e.target.value)} className="h-9 w-full accent-brand-600" />
        </Field>
      )}
      {layout === 'stack' && activeFilterCount(value) > 0 && (
        <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => onChange(EMPTY_FILTERS)} className="self-start">Réinitialiser les filtres</Button>
      )}
    </div>
  )
}

export function applyFilters<T extends { city: string; department: string; processing: ProcessingStatus; review: ReviewStatus; skills: string[]; score: number | null; experienceYears: number | null }>(rows: T[], f: CandidateFilters) {
  return rows.filter((c) =>
    (!f.city || c.city === f.city) &&
    (!f.department || c.department === f.department) &&
    (!f.processing || c.processing === f.processing) &&
    (!f.review || c.review === f.review) &&
    (!f.skill || c.skills.includes(f.skill)) &&
    (!f.minScore || (c.score ?? 0) >= f.minScore) &&
    (!f.minExp || (c.experienceYears ?? 0) >= f.minExp),
  )
}
