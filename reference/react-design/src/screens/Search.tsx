import { Ban, Briefcase, GraduationCap, Languages, MapPin, Search, SlidersHorizontal, Sparkles, Target, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import FilterPanel, { EMPTY_FILTERS, applyFilters, type CandidateFilters } from '../components/FilterPanel'
import { PageHeader } from '../components/Layout'
import MatchingCard from '../components/MatchingCard'
import { Banner, CardsSkeleton, EmptyState, ErrorState, NoResults } from '../components/States'
import { Button, Card, CardHeader, Chip, Select, cx } from '../components/ui'
import { api, internal, useDb } from '../lib/db'
import { plural } from '../lib/format'
import { navigate, useRoute } from '../lib/router'
import { DEFAULT_WEIGHTS, buildCriteria, parseQuery, rank, type Criterion, type CriterionKind, type ParsedQuery } from '../lib/search'

export const SEARCH_EXAMPLES = [
  'Find pharmacists with at least five years of quality assurance experience, GMP knowledge and based in Casablanca',
  'Analyste contrôle qualité HPLC, data integrity, anglais courant',
  'Chargé des affaires réglementaires à Rabat avec 4 ans d\'expérience',
  'Femme de moins de 30 ans, ingénieur qualité ISO 9001',
]

const KIND: Record<CriterionKind, { label: string; icon: ReactNode }> = {
  role: { label: 'Poste', icon: <Briefcase className="size-3.5" /> },
  skill: { label: 'Compétences', icon: <Target className="size-3.5" /> },
  experience: { label: 'Expérience', icon: <Briefcase className="size-3.5" /> },
  education: { label: 'Formation', icon: <GraduationCap className="size-3.5" /> },
  language: { label: 'Langues', icon: <Languages className="size-3.5" /> },
  location: { label: 'Localisation', icon: <MapPin className="size-3.5" /> },
  keyword: { label: 'Mot-clé', icon: <Search className="size-3.5" /> },
}

export default function SearchScreen() {
  const s = useDb()
  const { query } = useRoute()
  const urlQ = query.get('q') ?? ''
  const urlOffer = query.get('offer') ?? ''
  const [text, setText] = useState(urlQ)
  const [parsed, setParsed] = useState<ParsedQuery | null>(urlQ ? parseQuery(urlQ) : null)
  const [offerId, setOfferId] = useState(urlOffer)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(urlQ || urlOffer ? 'loading' : 'idle')
  const [error, setError] = useState<string>()
  const [limit, setLimit] = useState(10)
  const [nonce, setNonce] = useState(0)

  const offer = s.offers.find((o) => o.id === offerId) ?? null
  const criteria: Criterion[] = useMemo(() => buildCriteria(parsed, offer).filter((c) => !removed.has(c.id)), [parsed, offer, removed])
  const weights = offer?.weights ?? DEFAULT_WEIGHTS

  useEffect(() => {
    setText(urlQ)
    setParsed((p) => ((p?.raw ?? '') === urlQ ? p : urlQ ? parseQuery(urlQ) : null))
    if (urlOffer) setOfferId(urlOffer)
  }, [urlQ, urlOffer])

  useEffect(() => {
    if (!parsed && !offer) { setStatus('idle'); return }
    let alive = true
    setStatus('loading'); setLimit(10)
    api.query(650).then(() => {
      if (!alive) return
      setStatus('ready')
      internal.mutate((d) => internal.auditEntry(d, 'Recherche effectuée', 'search', undefined, `${parsed?.raw ? `« ${parsed.raw.slice(0, 80)} »` : ''}${offer ? ` · critères ${offer.title}` : ''}${parsed?.ignored.length ? ` · ${parsed.ignored.length} critère(s) protégé(s) ignoré(s)` : ''}`))
    }, (e: Error) => { if (alive) { setStatus('error'); setError(e.message) } })
    return () => { alive = false }
  }, [parsed, offer?.id, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    if (status !== 'ready' || !criteria.length) return []
    const pool = applyFilters(s.candidates, filters)
    return rank(pool, criteria, weights, offer?.mobilityAccepted ?? true)
  }, [status, criteria, s.candidates, filters, weights, offer])
  const shown = results.filter((r) => r.score > 0)
  const hidden = results.length - shown.length
  const cities = useMemo(() => [...new Set(s.candidates.map((c) => c.city).filter(Boolean))].sort(), [s.candidates])

  const submit = (q: string) => {
    setRemoved(new Set())
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    if (offerId) p.set('offer', offerId)
    const next = `/recherche?${p.toString()}`
    if (window.location.hash === `#${next}`) setNonce((n) => n + 1)
    else navigate(next)
    if (!q.trim()) setParsed(null)
  }

  const grouped = (Object.keys(KIND) as CriterionKind[]).map((k) => ({ k, items: criteria.filter((c) => c.kind === k) })).filter((g) => g.items.length)

  return (
    <>
      <PageHeader title="Recherche & correspondance" subtitle="Décrivez le profil en langage naturel. Les résultats sont classés de façon transparente, critère par critère, avec les preuves issues du CV." />

      <Card className="mb-6">
        <form className="p-4 md:p-5" onSubmit={(e) => { e.preventDefault(); submit(text) }}>
          <label htmlFor="nlq" className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink-2"><Wand2 className="size-4 text-brand-600" /> Recherche en langage naturel</label>
          <div className="flex flex-col gap-3 lg:flex-row">
            <textarea
              id="nlq"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(text) } }}
              placeholder="Ex. Pharmaciens avec au moins 5 ans d'expérience en assurance qualité, connaissance BPF, basés à Casablanca"
              className="min-h-[60px] flex-1 resize-none rounded-md border border-line-strong px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-4 hover:border-ink-4 focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
            />
            <div className="flex gap-2 lg:flex-col">
              <Select aria-label="Critères de poste" value={offerId} onChange={(e) => { setOfferId(e.target.value); setRemoved(new Set()) }} className="lg:w-64">
                <option value="">Sans critères de poste</option>
                {s.offers.map((o) => <option key={o.id} value={o.id}>Critères : {o.title}</option>)}
              </Select>
              <Button type="submit" variant="primary" size="lg" icon={<Search className="size-4" />} loading={status === 'loading'} disabled={!text.trim() && !offerId} className="lg:w-64">Rechercher</Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="py-1 text-xs text-ink-3">Exemples :</span>
            {SEARCH_EXAMPLES.map((e) => <button type="button" key={e} onClick={() => { setText(e); submit(e) }} className="max-w-full truncate rounded-md border border-line bg-subtle px-2 py-1 text-xs text-ink-2 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">{e}</button>)}
          </div>
        </form>
      </Card>

      {status === 'idle' ? (
        <Card>
          <EmptyState title="Lancez une recherche" icon={<Sparkles className="size-5" />}>
            Décrivez le poste, les compétences, l'expérience minimale, la formation, les langues et la ville. Vous pouvez aussi appliquer des critères de poste enregistrés.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card>
              <CardHeader title="Recherche interprétée" subtitle={offer ? `Avec les critères « ${offer.title} »` : 'Critères extraits de votre requête'} />
              <div className="space-y-4 p-4">
                {grouped.length === 0 && <p className="text-sm text-ink-3">Aucun critère exploitable n'a été reconnu. Reformulez avec un poste, une compétence, une ville ou une durée.</p>}
                {grouped.map((g) => (
                  <div key={g.k}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{KIND[g.k].icon}{KIND[g.k].label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((c) => <Chip key={c.id} tone={c.source === 'offer' ? 'sea' : 'brand'} onRemove={() => setRemoved(new Set([...removed, c.id]))}>{c.kind === 'role' ? String(c.value) : c.label}{!c.required && ' (souhaité)'}</Chip>)}
                    </div>
                  </div>
                ))}
                {removed.size > 0 && <Button size="sm" variant="ghost" onClick={() => setRemoved(new Set())}>Rétablir {plural(removed.size, 'critère retiré', 'critères retirés')}</Button>}
                <div className="border-t border-line pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Pondération</p>
                  <div className="flex h-2 overflow-hidden rounded-full">
                    {(Object.keys(weights) as (keyof typeof weights)[]).map((k, i) => <span key={k} title={`${k} ${weights[k]}`} className={['bg-brand-600', 'bg-sea-500', 'bg-violet-600', 'bg-warn-600', 'bg-ink-4'][i]} style={{ width: `${weights[k]}%` }} />)}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-3">Compétences {weights.skills} · Exp. {weights.experience} · Formation {weights.education} · Langues {weights.languages} · Lieu {weights.location}</p>
                  {offer ? <a href={`#/criteres?id=${offer.id}`} className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">Ajuster dans Critères de poste</a> : <p className="mt-1 text-xs text-ink-4">Pondération par défaut.</p>}
                </div>
              </div>
            </Card>
            {parsed && parsed.ignored.length > 0 && (
              <Banner tone="warn" icon={<Ban className="size-4" />} title="Critères non conformes ignorés">
                <ul className="mt-1 space-y-0.5">{parsed.ignored.map((i, k) => <li key={k}>« {i.term} » — {i.reason}</li>)}</ul>
                <p className="mt-1.5">L'âge, le genre, la nationalité, la situation familiale et la photo ne sont jamais utilisés.</p>
              </Banner>
            )}
            <Card>
              <CardHeader title="Filtres" icon={<SlidersHorizontal className="size-4" />} />
              <div className="p-4"><FilterPanel layout="stack" value={filters} onChange={setFilters} cities={cities} hide={['processing', 'minScore']} /></div>
            </Card>
          </aside>

          <section aria-live="polite" aria-busy={status === 'loading'}>
            {status === 'loading' ? <CardsSkeleton count={4} /> : status === 'error' ? (
              <Card><ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} /></Card>
            ) : criteria.length === 0 ? (
              <Card><NoResults>Tous les critères ont été retirés ou ignorés. Ajoutez au moins un critère valide.</NoResults></Card>
            ) : shown.length === 0 ? (
              <Card><NoResults actions={<Button onClick={() => setFilters(EMPTY_FILTERS)}>Retirer les filtres</Button>}>Aucun dossier indexé ne satisfait, même partiellement, ces critères.</NoResults></Card>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-ink-2"><b className="font-semibold text-ink tabular">{shown.length}</b> profils classés par score de correspondance (0–100){hidden > 0 && <span className="text-ink-3"> · {hidden} sans correspondance masqués</span>}</p>
                  <p className="text-xs text-ink-3">Classement indicatif — la décision reste humaine.</p>
                </div>
                <div className="space-y-3">{shown.slice(0, limit).map((r, i) => <MatchingCard key={r.candidate.id} result={r} rank={i + 1} />)}</div>
                {shown.length > limit && <div className="mt-4 text-center"><Button onClick={() => setLimit(limit + 10)}>Afficher {Math.min(10, shown.length - limit)} profils de plus</Button></div>}
              </>
            )}
          </section>
        </div>
      )}
      <p className={cx('mt-6 text-xs text-ink-4', status === 'idle' && 'hidden')}>Seuls les dossiers au statut « Indexé » ou « Prêt pour revue » sont interrogés. Chaque recherche est tracée dans le journal d'audit.</p>
    </>
  )
}
