import { BadgeCheck, KeyRound, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, ConfidenceBadge, ProviderTag, ScoreBadge } from '../components/Badges'
import { Avatar } from '../components/CandidateTable'
import { PageHeader } from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { Banner, EmptyState, ErrorState, NoResults, TableSkeleton } from '../components/States'
import { Button, Card, Select } from '../components/ui'
import { PROVIDER_NAMES, fullName, providerName, useDb } from '../lib/db'
import { fmtDateTime } from '../lib/format'
import { useResource } from '../lib/hooks'
import { norm } from '../lib/lexicon'
import { navigate } from '../lib/router'
import type { ProviderId } from '../lib/types'

export default function AnalysisList() {
  const s = useDb()
  const res = useResource('analyses')
  const [q, setQ] = useState('')
  const [provider, setProvider] = useState<'' | ProviderId>('')
  const [review, setReview] = useState<'' | 'todo' | 'done'>('')
  const [latestOnly, setLatestOnly] = useState(true)

  const rows = useMemo(() => {
    let list = [...s.analyses].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (latestOnly) { const seen = new Set<string>(); list = list.filter((a) => (seen.has(a.candidateId) ? false : (seen.add(a.candidateId), true))) }
    return list
      .map((a) => ({ a, c: s.candidates.find((c) => c.id === a.candidateId) }))
      .filter(({ a, c }) => c && (!provider || a.provider === provider) && (!review || (review === 'done' ? !!a.reviewedBy : !a.reviewedBy)) && (!q || norm(`${fullName(c)} ${c.targetRole}`).includes(norm(q))))
  }, [s.analyses, s.candidates, provider, review, q, latestOnly])

  const unreviewed = s.analyses.filter((a) => !a.reviewedBy).length
  const lowConf = s.analyses.filter((a) => a.confidence < 0.6).length
  const missing = s.providers.filter((p) => p.keyStatus !== 'configured')

  return (
    <>
      <PageHeader title="Analyses IA" subtitle="Recommandations générées à partir des CV. Chaque résultat doit être relu par un membre de l'équipe RH." />
      <div className="space-y-6">
        <Banner tone="violet" icon={<Sparkles className="size-4" />} title="Les analyses sont des aides à la décision, pas des décisions">
          Aucun rejet ni aucune invitation n'est déclenché automatiquement. Les scores ne tiennent jamais compte de l'âge, du genre, de la nationalité, de la situation familiale ou de la photo.
        </Banner>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard label="Analyses enregistrées" value={s.analyses.length} icon={<Sparkles className="size-4" />} tone="violet" />
          <MetricCard label="À relire" value={unreviewed} icon={<BadgeCheck className="size-4" />} tone="warn" hint="Non validées par RH" />
          <MetricCard label="Confiance faible" value={lowConf} icon={<Search className="size-4" />} tone="brand" hint="Extraction < 60 %" />
          <MetricCard label="Fournisseurs actifs" value={`${s.providers.filter((p) => p.enabled && p.keyStatus === 'configured').length}/3`} icon={<KeyRound className="size-4" />} tone="sea" href="#/parametres?tab=ai" hint={missing.length ? <span className="text-warn-700">{missing.map((m) => m.name).join(', ')} : clé manquante</span> : 'Tous configurés'} />
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="relative min-w-56 flex-1 md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Candidat ou poste…" aria-label="Filtrer les analyses" className="h-9 w-full rounded-md border border-line-strong pl-9 pr-3 text-sm outline-none hover:border-ink-4 focus:border-brand-500 focus:ring-3 focus:ring-brand-100" />
            </div>
            <Select aria-label="Fournisseur" value={provider} onChange={(e) => setProvider(e.target.value as ProviderId | '')} className="w-44"><option value="">Tous fournisseurs</option>{(Object.keys(PROVIDER_NAMES) as ProviderId[]).map((p) => <option key={p} value={p}>{PROVIDER_NAMES[p]}</option>)}</Select>
            <Select aria-label="Relecture" value={review} onChange={(e) => setReview(e.target.value as '' | 'todo' | 'done')} className="w-40"><option value="">Toutes</option><option value="todo">À relire</option><option value="done">Relues</option></Select>
            <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={latestOnly} onChange={(e) => setLatestOnly(e.target.checked)} className="accent-brand-600" /> Dernière analyse par candidat</label>
          </div>
          {res.status === 'loading' ? <TableSkeleton rows={6} /> : res.status === 'error' ? <ErrorState message={res.error} onRetry={res.retry} /> : s.analyses.length === 0 ? (
            <EmptyState title="Aucune analyse" icon={<Sparkles className="size-5" />} actions={<Button onClick={() => navigate('/cvtheque')}>Ouvrir la CVthèque</Button>}>Les analyses apparaissent après le traitement des CV ou sur demande depuis un profil.</EmptyState>
          ) : rows.length === 0 ? <NoResults /> : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-subtle text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  <tr className="[&>th]:h-10 [&>th]:border-b [&>th]:border-line [&>th]:px-3"><th className="pl-4">Candidat</th><th>Score</th><th>Confiance</th><th>Fournisseur</th><th className="hidden lg:table-cell">Critères</th><th>Date</th><th>Relecture RH</th></tr>
                </thead>
                <tbody>
                  {rows.map(({ a, c }) => (
                    <tr key={a.id} onClick={() => navigate(`/analyses/${c!.id}?a=${a.id}`)} className="cursor-pointer border-b border-line hover:bg-subtle [&>td]:px-3 [&>td]:py-2.5">
                      <td className="pl-4"><a href={`#/analyses/${c!.id}?a=${a.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-3"><Avatar c={c!} /><span><span className="block font-medium text-ink hover:text-brand-700">{fullName(c!)}</span><span className="text-xs text-ink-3">{c!.targetRole || '—'}</span></span></a></td>
                      <td><ScoreBadge score={a.score} /></td>
                      <td><ConfidenceBadge value={a.confidence} compact /></td>
                      <td><ProviderTag provider={a.provider} name={providerName(a.provider)} model={a.model} /></td>
                      <td className="hidden text-ink-2 lg:table-cell">{s.offers.find((o) => o.id === a.offerId)?.title ?? <span className="text-ink-4">Profil général</span>}</td>
                      <td className="whitespace-nowrap text-ink-3 tabular">{fmtDateTime(a.createdAt)}</td>
                      <td>{a.reviewedBy ? <Badge tone="ok" icon={<BadgeCheck className="size-3" />}>Relue · {a.reviewedBy.split(' ')[0]}</Badge> : <Badge tone="warn">À relire</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
