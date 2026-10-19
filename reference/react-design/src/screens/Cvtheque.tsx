import { Archive, BadgeCheck, ChevronLeft, ChevronRight, Clock, Download, Eye, FileUp, Filter, RefreshCw, Search, Sparkles, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CandidateTable, { type SortKey, type SortState } from '../components/CandidateTable'
import FilterPanel, { EMPTY_FILTERS, activeFilterCount, applyFilters, type CandidateFilters } from '../components/FilterPanel'
import { PageHeader } from '../components/Layout'
import Menu from '../components/Menu'
import { useConfirm } from '../components/Modal'
import { EmptyState, ErrorState, NoResults, TableSkeleton } from '../components/States'
import { Button, Card, Chip, Select, cx } from '../components/ui'
import { api, can, fullName, useDb } from '../lib/db'
import { downloadBlob } from '../lib/files'
import { PROCESSING_LABEL, REVIEW_LABEL, plural } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import { norm } from '../lib/lexicon'
import { retryProcessing } from '../lib/pipeline'
import { navigate, useRoute } from '../lib/router'
import type { Candidate, ReviewStatus } from '../lib/types'

const SORTERS: Record<SortKey, (a: Candidate, b: Candidate) => number> = {
  name: (a, b) => fullName(a).localeCompare(fullName(b), 'fr'),
  city: (a, b) => a.city.localeCompare(b.city, 'fr'),
  role: (a, b) => a.targetRole.localeCompare(b.targetRole, 'fr'),
  experience: (a, b) => (a.experienceYears ?? -1) - (b.experienceYears ?? -1),
  score: (a, b) => (a.score ?? -1) - (b.score ?? -1),
  date: (a, b) => a.createdAt.localeCompare(b.createdAt),
}

export default function Cvtheque() {
  const s = useDb()
  const { query } = useRoute()
  const res = useResource('cvtheque')
  const { pending, run } = useAction()
  const { confirm, modal } = useConfirm()
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<CandidateFilters>(() => ({
    ...EMPTY_FILTERS,
    review: (query.get('review') as ReviewStatus) ?? '',
    processing: (query.get('processing') as CandidateFilters['processing']) ?? '',
    department: query.get('department') ?? '',
  }))
  const [showFilters, setShowFilters] = useState(activeFilterCount(filters) > 0)
  const [sort, setSort] = useState<SortState>({ key: query.get('sort') === 'date' ? 'date' : 'date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const role = s.settings.role

  const cities = useMemo(() => [...new Set(s.candidates.map((c) => c.city).filter(Boolean))].sort(), [s.candidates])
  const rows = useMemo(() => {
    const nq = norm(q.trim())
    let r = applyFilters(s.candidates, filters)
    if (nq) r = r.filter((c) => norm(`${fullName(c)} ${c.email} ${c.city} ${c.targetRole} ${c.skills.join(' ')} ${c.id}`).includes(nq))
    const f = SORTERS[sort.key]
    return [...r].sort((a, b) => (sort.dir === 'asc' ? f(a, b) : f(b, a)))
  }, [s.candidates, filters, q, sort])

  useEffect(() => setPage(1), [q, filters, size])
  useEffect(() => {
    setSelected((sel) => new Set([...sel].filter((id) => s.candidates.some((c) => c.id === id))))
  }, [s.candidates])

  const pages = Math.max(1, Math.ceil(rows.length / size))
  const pageRows = rows.slice((page - 1) * size, page * size)
  const onSort = (key: SortKey) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'city' || key === 'role' ? 'asc' : 'desc' }))
  const onSelect = (ids: string[], on: boolean) => setSelected((p) => { const n = new Set(p); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n })
  const sel = [...selected]
  const nActive = activeFilterCount(filters)

  const setReview = (ids: string[], r: ReviewStatus) => run('review', () => api.setReview(ids, r, REVIEW_LABEL[r]), `${plural(ids.length, 'dossier')} → « ${REVIEW_LABEL[r]} »`)
  const exportRows = (ids?: string[]) =>
    run('export', async () => { const e = await api.exportCandidates('csv', ids); downloadBlob(e.blob, e.filename); return e }, (e) => `${plural(e.count, 'candidat')} exporté(s) en CSV`)
  const remove = (ids: string[]) =>
    confirm({
      title: `Supprimer ${plural(ids.length, 'dossier')} ?`,
      tone: 'danger',
      confirmLabel: 'Supprimer définitivement',
      requireText: ids.length > 1 ? 'SUPPRIMER' : undefined,
      body: <>Les fiches, fichiers originaux et analyses associées seront supprimés de la base locale. L'opération est tracée dans le journal d'audit et ne peut pas être annulée.</>,
      onConfirm: () => run('delete', async () => { await api.deleteCandidates(ids); setSelected(new Set()) }, `${plural(ids.length, 'dossier')} supprimé(s)`),
    })

  return (
    <>
      <PageHeader
        title="CVthèque"
        subtitle={`${plural(s.candidates.length, 'dossier')} · base locale SQLite`}
        actions={
          <>
            <Button icon={<Download className="size-4" />} locked={!can('export', role)} loading={pending === 'export' && !sel.length} onClick={() => exportRows()}>Exporter CSV</Button>
            <Button variant="primary" icon={<FileUp className="size-4" />} locked={!can('upload', role)} onClick={() => navigate('/import')}>Importer des CV</Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative min-w-60 flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, ville, poste, compétence…" aria-label="Filtrer la CVthèque" className="h-9 w-full rounded-md border border-line-strong pl-9 pr-8 text-sm outline-none hover:border-ink-4 focus:border-brand-500 focus:ring-3 focus:ring-brand-100" />
            {q && <button onClick={() => setQ('')} aria-label="Effacer" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-4 hover:text-ink"><X className="size-3.5" /></button>}
          </div>
          <Button icon={<Filter className="size-4" />} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className={cx(showFilters && 'border-brand-500 bg-brand-50 text-brand-700')}>
            Filtres{nActive > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] text-white tabular">{nActive}</span>}
          </Button>
          {nActive > 0 && <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>Réinitialiser</Button>}
          <span className="ml-auto text-[13px] text-ink-3 tabular">{plural(rows.length, 'résultat')}</span>
        </div>
        {showFilters && <div className="border-b border-line bg-subtle px-4 py-4"><FilterPanel value={filters} onChange={setFilters} cities={cities} /></div>}

        {sel.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2" role="region" aria-label="Actions groupées">
            <span className="text-sm font-semibold text-brand-800 tabular">{plural(sel.length, 'sélectionné')}</span>
            <span className="mx-1 h-5 w-px bg-brand-200" />
            <Select aria-label="Changer le statut RH" value="" className="h-8 w-auto bg-white text-[13px]" disabled={pending === 'review'} onChange={(e) => e.target.value && setReview(sel, e.target.value as ReviewStatus)}>
              <option value="">{pending === 'review' ? 'Mise à jour…' : 'Changer le statut RH…'}</option>
              {(Object.keys(REVIEW_LABEL) as ReviewStatus[]).map((r) => <option key={r} value={r}>{REVIEW_LABEL[r]}</option>)}
            </Select>
            <Button size="sm" icon={<Download className="size-3.5" />} locked={!can('export', role)} loading={pending === 'export'} onClick={() => exportRows(sel)}>Exporter</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} locked={!can('delete', role)} className="text-bad-600 hover:bg-bad-50 hover:text-bad-700" onClick={() => remove(sel)}>Supprimer</Button>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Effacer la sélection</Button>
          </div>
        )}

        {res.status === 'loading' ? (
          <TableSkeleton />
        ) : res.status === 'error' ? (
          <ErrorState message={res.error} onRetry={res.retry} />
        ) : s.candidates.length === 0 ? (
          <EmptyState title="Aucun CV dans la CVthèque" icon={<Users className="size-5" />} actions={<Button variant="primary" icon={<FileUp className="size-4" />} onClick={() => navigate('/import')}>Importer des CV</Button>}>
            Les CV importés apparaîtront ici après extraction et indexation.
          </EmptyState>
        ) : rows.length === 0 ? (
          <NoResults actions={<Button onClick={() => { setFilters(EMPTY_FILTERS); setQ('') }}>Effacer la recherche et les filtres</Button>}>
            Aucun dossier ne correspond{q ? <> à « {q} »</> : null}{nActive ? ` avec ${plural(nActive, 'filtre actif', 'filtres actifs')}` : ''}.
          </NoResults>
        ) : (
          <>
            <CandidateTable
              rows={pageRows}
              selected={selected}
              onSelect={onSelect}
              sort={sort}
              onSort={onSort}
              actions={(c) => (
                <Menu
                  items={[
                    { label: 'Ouvrir le profil', icon: <Eye />, onSelect: () => navigate(`/candidats/${c.id}`) },
                    { label: "Voir l'analyse IA", icon: <Sparkles />, onSelect: () => navigate(`/analyses/${c.id}`), disabled: c.processing !== 'ready' },
                    { label: 'Marquer « En revue »', icon: <Clock />, divider: true, locked: !can('review', role), onSelect: () => setReview([c.id], 'en_revue') },
                    { label: 'Présélectionner', icon: <BadgeCheck />, locked: !can('review', role), onSelect: () => setReview([c.id], 'retenu') },
                    { label: 'Archiver', icon: <Archive />, locked: !can('review', role), onSelect: () => setReview([c.id], 'archive') },
                    ...(c.processing === 'error' ? [{ label: 'Relancer le traitement', icon: <RefreshCw />, divider: true, locked: !can('upload', role), onSelect: () => run('retry', () => retryProcessing(c.id), 'Traitement relancé') }] : []),
                    { label: 'Supprimer', icon: <Trash2 />, danger: true, divider: c.processing !== 'error', locked: !can('delete', role), onSelect: () => remove([c.id]) },
                  ]}
                />
              )}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] text-ink-3">
              <div className="flex items-center gap-2">
                <span>Lignes par page</span>
                <Select aria-label="Lignes par page" value={size} onChange={(e) => setSize(+e.target.value)} className="h-8 w-20 text-[13px]">
                  {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </div>
              <span className="tabular">{(page - 1) * size + 1}–{Math.min(page * size, rows.length)} sur {rows.length}</span>
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <Button size="sm" variant="ghost" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></Button>
                {Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1).map((p, i, arr) => (
                  <span key={p} className="flex items-center">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1">…</span>}
                    <button onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined} className={cx('h-8 min-w-8 rounded-md px-2 font-medium tabular', p === page ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-canvas')}>{p}</button>
                  </span>
                ))}
                <Button size="sm" variant="ghost" aria-label="Page suivante" disabled={page === pages} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></Button>
              </nav>
            </div>
          </>
        )}
      </Card>
      {nActive > 0 && res.status === 'ready' && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
          Filtres actifs :
          {filters.city && <Chip onRemove={() => setFilters({ ...filters, city: '' })}>Ville : {filters.city}</Chip>}
          {filters.department && <Chip onRemove={() => setFilters({ ...filters, department: '' })}>{filters.department}</Chip>}
          {filters.skill && <Chip onRemove={() => setFilters({ ...filters, skill: '' })}>{filters.skill}</Chip>}
          {filters.processing && <Chip onRemove={() => setFilters({ ...filters, processing: '' })}>Traitement : {PROCESSING_LABEL[filters.processing]}</Chip>}
          {filters.review && <Chip onRemove={() => setFilters({ ...filters, review: '' })}>{REVIEW_LABEL[filters.review]}</Chip>}
          {filters.minExp > 0 && <Chip onRemove={() => setFilters({ ...filters, minExp: 0 })}>≥ {filters.minExp} ans</Chip>}
          {filters.minScore > 0 && <Chip onRemove={() => setFilters({ ...filters, minScore: 0 })}>Score ≥ {filters.minScore}</Chip>}
        </div>
      )}
      {modal}
    </>
  )
}
