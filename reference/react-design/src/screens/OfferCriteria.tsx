import { Copy, Info, Plus, RotateCcw, Save, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ScoreBadge } from '../components/Badges'
import { Avatar } from '../components/CandidateTable'
import { PageHeader } from '../components/Layout'
import { useConfirm } from '../components/Modal'
import { Banner, EmptyState, ErrorState, Skeleton } from '../components/States'
import { Button, Card, CardHeader, Chip, Field, Input, Select, Toggle, cx } from '../components/ui'
import { api, can, fullName, useDb } from '../lib/db'
import { fmtRelative } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import { CITIES, DEPARTMENTS, EDUCATION_LEVELS, LANGUAGES, SKILLS } from '../lib/lexicon'
import { navigate, useRoute } from '../lib/router'
import { buildCriteria, rank } from '../lib/search'
import type { Offer, Weights } from '../lib/types'

const W_LABEL: Record<keyof Weights, string> = { skills: 'Compétences', experience: 'Poste & expérience', education: 'Formation', languages: 'Langues', location: 'Localisation' }
const W_COLOR: Record<keyof Weights, string> = { skills: 'bg-brand-600', experience: 'bg-sea-500', education: 'bg-violet-600', languages: 'bg-warn-600', location: 'bg-ink-4' }
const blank = (): Offer => ({ id: `OFR-${Date.now().toString(36).toUpperCase().slice(-5)}`, title: '', department: '', requiredSkills: [], preferredSkills: [], minExperience: 0, education: '', languages: [], city: '', mobilityAccepted: true, weights: { skills: 40, experience: 25, education: 15, languages: 10, location: 10 }, updatedAt: '' })

function SkillPicker({ label, values, onChange, exclude }: { label: string; values: string[]; onChange: (v: string[]) => void; exclude: string[] }) {
  return (
    <Field label={label}>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-white p-1.5">
        {values.map((s) => <Chip key={s} tone="brand" onRemove={() => onChange(values.filter((x) => x !== s))}>{s}</Chip>)}
        <select aria-label={`Ajouter — ${label}`} value="" onChange={(e) => e.target.value && onChange([...values, e.target.value])} className="h-6 min-w-36 flex-1 bg-transparent text-[13px] text-ink-3 outline-none">
          <option value="">+ Ajouter…</option>
          {SKILLS.filter((s) => !values.includes(s.name) && !exclude.includes(s.name)).map((s) => <option key={s.name}>{s.name}</option>)}
        </select>
      </div>
    </Field>
  )
}

export default function OfferCriteria() {
  const s = useDb()
  const { query } = useRoute()
  const res = useResource('offers')
  const { pending, run } = useAction()
  const { confirm, modal } = useConfirm()
  const [selId, setSelId] = useState<string>(query.get('id') ?? s.offers[0]?.id ?? '')
  const saved = s.offers.find((o) => o.id === selId)
  const [draft, setDraft] = useState<Offer | null>(saved ? structuredClone(saved) : null)
  const [tried, setTried] = useState(false)
  useEffect(() => { const o = s.offers.find((x) => x.id === selId); if (o) setDraft(structuredClone(o)); setTried(false) }, [selId]) // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => (draft ? rank(s.candidates, buildCriteria(null, draft), draft.weights, draft.mobilityAccepted).slice(0, 5) : []), [draft, s.candidates])
  const locked = !can('offers', s.settings.role)

  if (res.status === 'loading') return <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]"><Skeleton className="h-96 rounded-lg" /><Skeleton className="h-[640px] rounded-lg" /></div>
  if (res.status === 'error') return <Card><ErrorState message={res.error} onRetry={res.retry} /></Card>

  const isNew = !!draft && !s.offers.some((o) => o.id === draft.id)
  const dirty = !!draft && (isNew || JSON.stringify({ ...draft, updatedAt: '' }) !== JSON.stringify({ ...saved, updatedAt: '' }))
  const total = draft ? Object.values(draft.weights).reduce((a, b) => a + b, 0) : 0
  const set = <K extends keyof Offer>(k: K, v: Offer[K]) => draft && setDraft({ ...draft, [k]: v })
  const titleErr = tried && draft && !draft.title.trim() ? 'Le titre du poste est obligatoire' : undefined

  const save = async () => {
    if (!draft) return
    setTried(true)
    if (!draft.title.trim() || total === 0) return
    const ok = await run('save', () => api.saveOffer(draft).then(() => true), 'Critères enregistrés')
    if (ok) setSelId(draft.id)
  }
  const create = (from?: Offer) => {
    const o = from ? { ...structuredClone(from), id: blank().id, title: `${from.title} (copie)` } : blank()
    setDraft(o); setSelId(o.id); setTried(false)
  }

  return (
    <>
      <PageHeader
        title="Critères de poste"
        subtitle="Définissez les exigences d'un poste pour classer les CV de la CVthèque. Aucune candidature n'est créée."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} locked={locked} onClick={() => create()}>Nouveaux critères</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="self-start overflow-hidden">
          <CardHeader title="Profils de poste" subtitle={`${s.offers.length} enregistrés`} />
          {s.offers.length === 0 && !isNew ? (
            <EmptyState compact title="Aucun critère" icon={<SlidersHorizontal className="size-5" />}>Créez un premier profil de poste.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {isNew && draft && <li className="border-l-[3px] border-brand-600 bg-brand-50 px-4 py-3 text-sm"><p className="font-medium text-brand-800">{draft.title || 'Nouveaux critères'}</p><p className="text-xs text-brand-700">Non enregistré</p></li>}
              {s.offers.map((o) => (
                <li key={o.id}>
                  <button onClick={() => setSelId(o.id)} className={cx('w-full border-l-[3px] px-4 py-3 text-left text-sm hover:bg-subtle', selId === o.id ? 'border-brand-600 bg-brand-50/60' : 'border-transparent')}>
                    <p className="font-medium text-ink">{o.title}</p>
                    <p className="text-xs text-ink-3">{o.department || '—'} · {o.city || 'Toutes villes'} · modifié {fmtRelative(o.updatedAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {!draft ? (
          <Card><EmptyState title="Sélectionnez ou créez des critères" icon={<SlidersHorizontal className="size-5" />} actions={<Button variant="primary" onClick={() => create()}>Nouveaux critères</Button>} /></Card>
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHeader
                title={draft.title || 'Nouveaux critères'}
                subtitle={isNew ? 'Brouillon non enregistré' : dirty ? 'Modifications non enregistrées' : `Enregistré · ${fmtRelative(draft.updatedAt)}`}
                actions={
                  <>
                    {!isNew && <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} locked={locked} onClick={() => create(draft)}>Dupliquer</Button>}
                    {!isNew && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} locked={locked} className="text-bad-600 hover:bg-bad-50" onClick={() => confirm({ title: 'Supprimer ces critères ?', tone: 'danger', confirmLabel: 'Supprimer', body: <>Les critères « {draft.title} » seront supprimés. Les analyses existantes qui y font référence sont conservées.</>, onConfirm: () => run('del', async () => { await api.deleteOffer(draft.id); const next = s.offers.find((o) => o.id !== draft.id); setSelId(next?.id ?? ''); setDraft(next ? structuredClone(next) : null) }, 'Critères supprimés') })}>Supprimer</Button>}
                  </>
                }
              />
              <div className="space-y-6 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Intitulé du poste *" error={titleErr} htmlFor="o-title"><Input id="o-title" value={draft.title} invalid={!!titleErr} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Pharmacien assurance qualité" /></Field>
                  <Field label="Département" htmlFor="o-dep"><Select id="o-dep" value={draft.department} onChange={(e) => set('department', e.target.value)}><option value="">—</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <SkillPicker label="Compétences requises" values={draft.requiredSkills} onChange={(v) => set('requiredSkills', v)} exclude={draft.preferredSkills} />
                  <SkillPicker label="Compétences souhaitées (poids ×0,5)" values={draft.preferredSkills} onChange={(v) => set('preferredSkills', v)} exclude={draft.requiredSkills} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Expérience minimale (années)" htmlFor="o-exp"><Input id="o-exp" type="number" min={0} max={30} value={draft.minExperience} onChange={(e) => set('minExperience', Math.max(0, Math.min(30, +e.target.value)))} /></Field>
                  <Field label="Formation minimale" htmlFor="o-edu"><Select id="o-edu" value={draft.education} onChange={(e) => set('education', e.target.value)}><option value="">Non exigée</option>{EDUCATION_LEVELS.map((e) => <option key={e.label}>{e.label}</option>)}</Select></Field>
                  <Field label="Ville du poste" htmlFor="o-city"><Select id="o-city" value={draft.city} onChange={(e) => set('city', e.target.value)}><option value="">Indifférente</option>{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</Select></Field>
                </div>
                <div className="flex flex-wrap items-start gap-8">
                  <Field label="Langues requises">
                    <div className="flex flex-wrap gap-1.5">
                      {LANGUAGES.map((l) => {
                        const on = draft.languages.includes(l.name)
                        return <button key={l.name} type="button" aria-pressed={on} onClick={() => set('languages', on ? draft.languages.filter((x) => x !== l.name) : [...draft.languages, l.name])} className={cx('h-8 rounded-md border px-2.5 text-[13px] font-medium', on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line-strong text-ink-2 hover:bg-subtle')}>{l.name}</button>
                      })}
                    </div>
                  </Field>
                  <div className="flex items-center gap-3 pt-6">
                    <Toggle label="Mobilité acceptée" checked={draft.mobilityAccepted} onChange={(v) => set('mobilityAccepted', v)} />
                    <span className="text-sm text-ink-2">Accepter les profils mobiles hors ville (crédit partiel)</span>
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-subtle p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">Pondération du score de correspondance</p>
                    <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => set('weights', blank().weights)}>Valeurs par défaut</Button>
                  </div>
                  <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-line">
                    {(Object.keys(draft.weights) as (keyof Weights)[]).map((k) => <span key={k} className={W_COLOR[k]} style={{ width: `${total ? (draft.weights[k] / total) * 100 : 0}%` }} />)}
                  </div>
                  <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                    {(Object.keys(draft.weights) as (keyof Weights)[]).map((k) => (
                      <label key={k} className="grid grid-cols-[140px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
                        <span className="flex items-center gap-2 text-ink-2"><span className={cx('size-2 rounded-full', W_COLOR[k])} />{W_LABEL[k]}</span>
                        <input type="range" min={0} max={60} step={5} value={draft.weights[k]} onChange={(e) => set('weights', { ...draft.weights, [k]: +e.target.value })} className="accent-brand-600" aria-label={`Poids ${W_LABEL[k]}`} />
                        <span className="text-right font-semibold tabular text-ink">{total ? Math.round((draft.weights[k] / total) * 100) : 0} %</span>
                      </label>
                    ))}
                  </div>
                  {total === 0 && <p className="mt-2 text-xs text-bad-600">Au moins un poids doit être supérieur à zéro.</p>}
                  <p className="mt-3 text-xs text-ink-3">Les poids sont normalisés à 100 %. Critère satisfait = 1, partiel = 0,5, manquant = 0.</p>
                </div>

                <Banner tone="brand" icon={<Info className="size-4" />} title="Usage des critères">
                  Ils servent uniquement à classer et expliquer la correspondance des CV. Ils ne créent aucune candidature, ne déclenchent aucun rejet ni aucune invitation, et n'utilisent aucune donnée protégée.
                </Banner>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-subtle px-5 py-3">
                {dirty && !isNew && <Button variant="ghost" onClick={() => saved && setDraft(structuredClone(saved))}>Annuler les modifications</Button>}
                <Button icon={<Search className="size-4" />} disabled={isNew} onClick={() => navigate(`/recherche?offer=${draft.id}`)}>Rechercher des profils</Button>
                <Button variant="primary" icon={<Save className="size-4" />} loading={pending === 'save'} locked={locked} disabled={!dirty || total === 0} onClick={save}>Enregistrer</Button>
              </div>
            </Card>

            <Card className="self-start 2xl:sticky 2xl:top-20">
              <CardHeader title="Aperçu du classement" subtitle="Mis à jour en direct avec le brouillon" />
              {preview.length === 0 || preview.every((p) => p.score === 0) ? (
                <p className="px-5 py-6 text-sm text-ink-3">Ajoutez des critères pour voir les profils correspondants.</p>
              ) : (
                <ol className="divide-y divide-line">
                  {preview.map((p, i) => (
                    <li key={p.candidate.id}>
                      <a href={`#/candidats/${p.candidate.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-subtle">
                        <span className="w-4 text-xs text-ink-4 tabular">{i + 1}</span>
                        <Avatar c={p.candidate} />
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium text-ink">{fullName(p.candidate)}</span><span className="block truncate text-xs text-ink-3">{p.candidate.targetRole} · {p.candidate.city}</span></span>
                        <ScoreBadge score={p.score} />
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        )}
      </div>
      {modal}
    </>
  )
}
