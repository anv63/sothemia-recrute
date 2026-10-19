import { BadgeCheck, Check, CircleHelp, ExternalLink, Quote, Sparkles, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { AIBadge, ConfidenceBadge, ProviderTag, ScoreRing } from '../components/Badges'
import CvPreview from '../components/CvPreview'
import { PageHeader } from '../components/Layout'
import { Banner, DetailSkeleton, EmptyState, ErrorState, LowConfidenceBanner, MissingKeyBanner } from '../components/States'
import { Button, Card, CardHeader, Field, Select, cx } from '../components/ui'
import { PROVIDER_NAMES, api, can, fullName, providerName, providerUsable, useDb } from '../lib/db'
import { fmtDateTime } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import { navigate, useRoute } from '../lib/router'
import type { ProviderId } from '../lib/types'

export default function AnalysisDetail({ id }: { id: string }) {
  const s = useDb()
  const { query } = useRoute()
  const res = useResource(`an-${id}`)
  const { pending, run } = useAction()
  const [provider, setProvider] = useState<ProviderId>(s.settings.defaultProvider)
  const [offerId, setOfferId] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const c = s.candidates.find((x) => x.id === id)
  const history = s.analyses.filter((a) => a.candidateId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const a = history.find((x) => x.id === query.get('a')) ?? history[0]

  if (res.status === 'loading') return <DetailSkeleton />
  if (res.status === 'error') return <Card><ErrorState message={res.error} onRetry={res.retry} /></Card>
  if (!c) return <Card><EmptyState title="Dossier introuvable" actions={<Button onClick={() => navigate('/analyses')}>Retour aux analyses</Button>}>Le candidat {id} n'existe pas.</EmptyState></Card>

  const usable = providerUsable(provider)
  const role = s.settings.role
  const launch = async () => {
    const r = await run('analyze', () => api.runAnalysis(id, provider, offerId || undefined), (x) => `Analyse générée · score ${x.score}/100 — à relire`)
    if (r) navigate(`/analyses/${id}?a=${r.id}`)
  }
  const missingCfg = provider !== 'local' ? s.providers.find((p) => p.id === provider && p.keyStatus !== 'configured') : undefined

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Analyses IA', to: '/analyses' }, { label: fullName(c) }]}
        title={`Analyse — ${fullName(c)}`}
        subtitle={`${c.targetRole || 'Poste non précisé'} · ${c.city || 'Ville non détectée'}`}
        actions={<Button icon={<ExternalLink className="size-4" />} onClick={() => navigate(`/candidats/${id}`)}>Profil complet</Button>}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4 p-4">
          <Field label="Fournisseur" htmlFor="an-p">
            <Select id="an-p" value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)} className="w-60">
              {(Object.keys(PROVIDER_NAMES) as ProviderId[]).map((p) => {
                const u = providerUsable(p)
                return <option key={p} value={p}>{PROVIDER_NAMES[p]}{u.ok ? '' : ` — ${u.reason?.toLowerCase().includes('désactivé') ? 'désactivé' : 'clé manquante'}`}</option>
              })}
            </Select>
          </Field>
          <Field label="Comparer aux critères (optionnel)" htmlFor="an-o">
            <Select id="an-o" value={offerId} onChange={(e) => setOfferId(e.target.value)} className="w-72">
              <option value="">Profil général (sans critères)</option>
              {s.offers.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </Select>
          </Field>
          <Button variant="primary" icon={<Sparkles className="size-4" />} loading={pending === 'analyze'} locked={!can('analyze', role)} disabled={c.processing !== 'ready' && c.processing !== 'indexed'} onClick={launch}>
            {pending === 'analyze' ? `Analyse en cours (${providerName(provider)})…` : history.length ? 'Relancer une analyse' : "Lancer l'analyse"}
          </Button>
          <p className="basis-full text-xs text-ink-3 xl:ml-auto xl:basis-auto">Les données envoyées à un fournisseur externe sont {s.settings.anonymizeBeforeSending ? 'pseudonymisées (nom, e-mail, téléphone retirés)' : 'transmises sans pseudonymisation'}.</p>
        </div>
        {(missingCfg || !usable.ok) && <div className="border-t border-line p-4">{missingCfg ? <MissingKeyBanner provider={missingCfg.name} onConfigure={() => navigate('/parametres?tab=ai')} /> : <Banner tone="warn" title={usable.reason ?? 'Fournisseur indisponible'}>Activez-le dans Paramètres › Fournisseurs IA ou choisissez l'analyse locale.</Banner>}</div>}
      </Card>

      {!a ? (
        <Card><EmptyState title="Aucune analyse pour ce dossier" icon={<Sparkles className="size-5" />}>{c.processing === 'ready' ? 'Choisissez un fournisseur puis lancez l\'analyse.' : 'Le dossier doit être « Prêt pour revue » avant de pouvoir être analysé.'}</EmptyState></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="space-y-6">
            {a.confidence < 0.6 && <LowConfidenceBanner value={a.confidence} onEdit={() => navigate(`/candidats/${id}`)} />}
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-600/15 bg-violet-50/60 px-5 py-3">
                <AIBadge />
                {a.reviewedBy ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok-700"><BadgeCheck className="size-4" /> Relue par {a.reviewedBy} · {fmtDateTime(a.reviewedAt)}</span>
                ) : (
                  <Button size="sm" variant="teal" icon={<BadgeCheck className="size-3.5" />} loading={pending === 'validate'} locked={!can('validate', role)} onClick={() => run('validate', () => api.validateAnalysis(a.id), 'Analyse marquée comme relue')}>Marquer comme relue</Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-6 p-5">
                <ScoreRing score={a.score} size={104} />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[13px] font-medium uppercase tracking-[0.05em] text-ink-3">{a.offerId ? `Adéquation aux critères « ${s.offers.find((o) => o.id === a.offerId)?.title ?? 'supprimés'} »` : 'Score de profil général'}</p>
                  <div className="flex flex-wrap items-center gap-3"><ConfidenceBadge value={a.confidence} /><ProviderTag provider={a.provider} name={providerName(a.provider)} model={a.model} /></div>
                  <p className="text-xs text-ink-3">Générée le {fmtDateTime(a.createdAt)} · <span className="font-mono">{a.id}</span></p>
                </div>
              </div>
              <div className="border-t border-line px-5 py-4">
                <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-2">Synthèse</h3>
                <p className="leading-relaxed text-ink-2">{a.summary}</p>
              </div>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Points forts" icon={<Check className="size-4 text-ok-600" />} />
                <ul className="space-y-2.5 p-5 text-sm">
                  {a.strengths.length ? a.strengths.map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-ok-600" /><span className="text-ink-2">{x}</span></li>) : <li className="text-ink-4">Aucun point fort identifié automatiquement.</li>}
                </ul>
              </Card>
              <Card>
                <CardHeader title="Points d'attention" subtitle="À vérifier — non éliminatoires" icon={<TriangleAlert className="size-4 text-warn-600" />} />
                <ul className="space-y-2.5 p-5 text-sm">
                  {a.attention.length ? a.attention.map((x) => <li key={x} className="flex gap-2.5"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn-600" /><span className="text-ink-2">{x}</span></li>) : <li className="text-ink-4">Rien à signaler.</li>}
                </ul>
              </Card>
            </div>

            <Card>
              <CardHeader title="Compétences détectées" subtitle="Avec localisation dans le CV original" />
              <div className="flex flex-wrap gap-2 p-5">
                {a.detectedSkills.length ? a.detectedSkills.map((k) => (
                  <span key={k.name} className="inline-flex items-center gap-2 rounded-md border border-brand-100 bg-brand-50 py-1 pl-2 pr-1.5 text-xs font-medium text-brand-800">{k.name}<span className="rounded bg-white px-1 font-mono text-[10px] text-ink-3">{k.evidence}</span></span>
                )) : <span className="text-sm text-ink-4">Aucune compétence détectée.</span>}
              </div>
            </Card>

            <Card>
              <CardHeader title="Informations manquantes ou incertaines" icon={<CircleHelp className="size-4" />} />
              <div className="p-5">
                {a.missing.length ? <div className="flex flex-wrap gap-1.5">{a.missing.map((m) => <span key={m} className={cx('rounded-md px-2 py-1 text-xs font-medium', m.includes('incertain') ? 'bg-warn-50 text-warn-700' : 'bg-canvas text-ink-2')}>{m}</span>)}</div> : <p className="text-sm text-ink-3">Toutes les informations clés ont été trouvées.</p>}
              </div>
            </Card>

            <Card>
              <CardHeader title="Éléments probants du CV" subtitle="Citations exactes — cliquez pour les situer dans l'aperçu" icon={<Quote className="size-4" />} />
              <ul className="divide-y divide-line">
                {a.evidence.length ? a.evidence.map((e, i) => (
                  <li key={i}>
                    <button onClick={() => setFocus(focus === e.quote ? null : e.quote)} className={cx('grid w-full gap-1 px-5 py-3 text-left text-sm hover:bg-subtle md:grid-cols-[180px_minmax(0,1fr)_80px]', focus === e.quote && 'bg-warn-50/60')}>
                      <span className="font-medium text-ink">{e.claim}</span>
                      <span className="italic text-ink-2">« {e.quote} »</span>
                      <span className="font-mono text-[11px] text-ink-3 md:text-right">{e.location}</span>
                    </button>
                  </li>
                )) : <li className="px-5 py-4 text-sm text-ink-4">Aucune citation disponible.</li>}
              </ul>
            </Card>

            {history.length > 1 && (
              <Card>
                <CardHeader title="Historique des analyses" subtitle={`${history.length} versions`} />
                <ul className="divide-y divide-line">
                  {history.map((h) => (
                    <li key={h.id}>
                      <a href={`#/analyses/${id}?a=${h.id}`} className={cx('flex flex-wrap items-center gap-4 px-5 py-2.5 text-sm hover:bg-subtle', h.id === a.id && 'bg-brand-50/60')}>
                        <span className="w-10 font-semibold tabular text-ink">{h.score}</span>
                        <ProviderTag provider={h.provider} name={providerName(h.provider)} model={h.model} />
                        <span className="text-ink-3">{s.offers.find((o) => o.id === h.offerId)?.title ?? 'Profil général'}</span>
                        <span className="ml-auto text-xs text-ink-3 tabular">{fmtDateTime(h.createdAt)}</span>
                        {h.id === a.id && <span className="text-xs font-medium text-brand-700">Affichée</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <Card className="overflow-hidden xl:sticky xl:top-20 xl:self-start">
            <CardHeader title="CV original" subtitle={c.file.name} actions={focus && <Button size="sm" variant="ghost" onClick={() => setFocus(null)}>Effacer le surlignage</Button>} />
            <div className="max-h-[calc(100vh-180px)] overflow-y-auto scrollbar-thin"><CvPreview c={c} mode="text" highlight={focus ? [focus] : a.evidence.map((e) => e.quote)} /></div>
          </Card>
        </div>
      )}
    </>
  )
}
