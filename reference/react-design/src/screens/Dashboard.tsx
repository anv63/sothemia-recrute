import { Activity, ArrowRight, CircleAlert, Clock, FileUp, Gauge, Search, Sparkles, TriangleAlert, Users } from 'lucide-react'
import { useState } from 'react'
import { ProviderTag, StatusBadge } from '../components/Badges'
import CandidateTable from '../components/CandidateTable'
import { PageHeader } from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from '../components/States'
import UploadDropZone from '../components/UploadDropZone'
import { Button, Card, CardHeader, cx } from '../components/ui'
import { ApiError, can, providerName, useDb } from '../lib/db'
import { PIPELINE, PROCESSING_LABEL, fmtRelative, isToday, plural } from '../lib/format'
import { useResource } from '../lib/hooks'
import { DEPARTMENTS } from '../lib/lexicon'
import { enqueue } from '../lib/pipeline'
import { navigate } from '../lib/router'
import { toast } from '../lib/toast'

const EXAMPLES = [
  'Pharmaciens avec au moins 5 ans en assurance qualité, BPF, basés à Casablanca',
  'Analyste contrôle qualité HPLC anglais courant',
  'Affaires réglementaires Rabat 4 ans',
]

export function startUpload(files: File[]) {
  try {
    enqueue(files)
    toast.info(`${plural(files.length, 'fichier')} ajouté(s) à la file`, 'Suivez la progression dans Importer des CV.')
    navigate('/import')
  } catch (e) {
    toast.forbidden('Action non autorisée', (e as ApiError).message)
  }
}

export default function Dashboard() {
  const s = useDb()
  const res = useResource('dashboard')
  const [q, setQ] = useState('')
  const cs = s.candidates
  const today = cs.filter((c) => isToday(c.createdAt)).length
  const week = cs.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 7 * 86400000).length
  const awaiting = cs.filter((c) => c.processing === 'ready' && c.review === 'a_examiner')
  const scored = cs.filter((c) => c.score !== null)
  const avg = scored.length ? Math.round(scored.reduce((a, c) => a + (c.score ?? 0), 0) / scored.length) : null
  const byDep = DEPARTMENTS.map((d) => ({ d, n: cs.filter((c) => c.department === d).length })).filter((x) => x.n).sort((a, b) => b.n - a.n)
  const unassigned = cs.filter((c) => !c.department).length
  const maxDep = Math.max(1, ...byDep.map((x) => x.n), unassigned)
  const stages = PIPELINE.map((p) => ({ p, n: cs.filter((c) => c.processing === p).length }))
  const errors = cs.filter((c) => c.processing === 'error')
  const lowConf = cs.filter((c) => c.processing === 'ready' && c.confidence < 0.6)
  const inFlight = cs.filter((c) => ['received', 'extracting', 'analyzing', 'indexed'].includes(c.processing))
  const recent = [...cs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const hour = new Date().getHours()
  const uploadLocked = !can('upload', s.settings.role)

  return (
    <>
      <PageHeader
        title={`${hour < 18 ? 'Bonjour' : 'Bonsoir'}, ${s.settings.userName.split(' ')[0]}`}
        subtitle={new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()) + ' · Vue d\'ensemble de la CVthèque'}
        actions={
          <>
            <Button icon={<Search className="size-4" />} onClick={() => navigate('/recherche')}>Rechercher un profil</Button>
            <Button variant="primary" icon={<FileUp className="size-4" />} locked={uploadLocked} onClick={() => uploadLocked ? toast.forbidden('Action non autorisée', "Votre rôle ne permet pas d'importer des CV.") : navigate('/import')}>Importer des CV</Button>
          </>
        }
      />

      {res.status === 'error' ? (
        <Card><ErrorState message={res.error} onRetry={res.retry} /></Card>
      ) : res.status === 'ready' && cs.length === 0 ? (
        <Card>
          <EmptyState
            title="La CVthèque est vide"
            icon={<Users className="size-5" />}
            actions={<Button variant="primary" icon={<FileUp className="size-4" />} onClick={() => navigate('/import')}>Importer les premiers CV</Button>}
          >
            Importez des CV au format PDF ou DOCX : ils seront extraits, analysés et indexés localement, puis prêts pour votre revue.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          {res.status === 'loading' ? <CardsSkeleton className="grid-cols-2 xl:grid-cols-4" /> : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <MetricCard label="CV dans la CVthèque" value={cs.length} icon={<Users className="size-4" />} href="#/cvtheque" hint={<><b className="font-semibold text-ink-2">+{week}</b> sur 7 jours</>} />
              <MetricCard label="Ajoutés aujourd'hui" value={today} tone="sea" icon={<FileUp className="size-4" />} href="#/cvtheque?sort=date" hint={inFlight.length ? <span className="text-brand-700">{plural(inFlight.length, 'CV')} en cours de traitement</span> : 'Aucun traitement en cours'} />
              <MetricCard label="En attente de revue" value={awaiting.length} tone="warn" icon={<Clock className="size-4" />} href="#/cvtheque?review=a_examiner&processing=ready" hint={lowConf.length ? <span className="text-bad-600">{lowConf.length} à vérifier (faible confiance)</span> : 'Statut « À examiner »'} />
              <MetricCard label="Score moyen d'analyse" value={avg ?? '—'} tone="violet" icon={<Gauge className="size-4" />} href="#/analyses" hint={<>Sur {plural(scored.length, 'profil analysé', 'profils analysés')} · indicatif</>} />
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Card>
              <CardHeader title="CV par département" subtitle="Rattachement déduit du poste visé" actions={<a href="#/cvtheque" className="text-[13px] font-medium text-brand-700 hover:underline">Ouvrir la CVthèque</a>} />
              <div className="space-y-2.5 px-5 py-4">
                {res.status === 'loading' ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-6" />) : (
                  <>
                    {byDep.map(({ d, n }) => (
                      <a key={d} href={`#/cvtheque?department=${encodeURIComponent(d)}`} className="group grid grid-cols-[170px_minmax(0,1fr)_36px] items-center gap-3 rounded text-sm">
                        <span className="truncate text-ink-2 group-hover:text-brand-700">{d}</span>
                        <span className="h-6 overflow-hidden rounded bg-canvas">
                          <span className="block h-full rounded bg-brand-600 transition-colors group-hover:bg-brand-700" style={{ width: `${(n / maxDep) * 100}%` }} />
                        </span>
                        <span className="text-right font-semibold text-ink tabular">{n}</span>
                      </a>
                    ))}
                    {unassigned > 0 && (
                      <div className="grid grid-cols-[170px_minmax(0,1fr)_36px] items-center gap-3 text-sm">
                        <span className="text-ink-3">Non déterminé</span>
                        <span className="h-6 overflow-hidden rounded bg-canvas"><span className="block h-full rounded bg-line-strong" style={{ width: `${(unassigned / maxDep) * 100}%` }} /></span>
                        <span className="text-right font-semibold text-ink-3 tabular">{unassigned}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="État du traitement" subtitle="Reçu → Extraction → Analyse → Indexé → Prêt" icon={<Activity className="size-4" />} />
              <div className="px-5 py-4">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-canvas">
                  {stages.map(({ p, n }) => n > 0 && <span key={p} title={`${PROCESSING_LABEL[p]} : ${n}`} className={cx('h-full', { received: 'bg-line-strong', extracting: 'bg-brand-500', analyzing: 'bg-violet-600', indexed: 'bg-sea-500', ready: 'bg-ok-600' }[p as 'ready'])} style={{ width: `${(n / Math.max(1, cs.length)) * 100}%` }} />)}
                  {errors.length > 0 && <span className="h-full bg-bad-600" style={{ width: `${(errors.length / cs.length) * 100}%` }} />}
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                  {stages.map(({ p, n }) => (
                    <li key={p}><a href={`#/cvtheque?processing=${p}`} className="flex items-center justify-between rounded px-1 py-0.5 hover:bg-subtle"><StatusBadge status={p} /><span className="font-semibold tabular">{n}</span></a></li>
                  ))}
                  <li><a href="#/cvtheque?processing=error" className="flex items-center justify-between rounded px-1 py-0.5 hover:bg-subtle"><StatusBadge status="error" /><span className="font-semibold tabular text-bad-600">{errors.length}</span></a></li>
                </ul>
                {(errors.length > 0 || lowConf.length > 0) && (
                  <div className="mt-4 space-y-2 border-t border-line pt-3 text-[13px]">
                    {errors.slice(0, 2).map((c) => (
                      <a key={c.id} href={`#/candidats/${c.id}`} className="flex items-start gap-2 text-bad-700 hover:underline"><CircleAlert className="mt-0.5 size-3.5 shrink-0" /><span><b className="font-medium">{c.file.name}</b> — {c.processingError}</span></a>
                    ))}
                    {lowConf.slice(0, 2).map((c) => (
                      <a key={c.id} href={`#/candidats/${c.id}`} className="flex items-start gap-2 text-warn-700 hover:underline"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /><span><b className="font-medium">{c.file.name}</b> — extraction à faible confiance ({Math.round(c.confidence * 100)} %)</span></a>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Card className="overflow-hidden">
              <CardHeader title="Derniers CV reçus" actions={<a href="#/cvtheque?sort=date" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">Tout voir <ArrowRight className="size-3.5" /></a>} />
              {res.status === 'loading' ? <TableSkeleton rows={5} /> : <CandidateTable rows={recent} dense />}
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Actions rapides" />
                <div className="space-y-4 p-5">
                  <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/recherche?q=${encodeURIComponent(q.trim())}`) }} className="space-y-2">
                    <label htmlFor="quick-q" className="text-[13px] font-medium text-ink-2">Recherche en langage naturel</label>
                    <div className="flex gap-2">
                      <input id="quick-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Décrivez le profil recherché…" className="h-9 min-w-0 flex-1 rounded-md border border-line-strong px-3 text-sm outline-none hover:border-ink-4 focus:border-brand-500 focus:ring-3 focus:ring-brand-100" />
                      <Button variant="primary" type="submit" disabled={!q.trim()} icon={<Search className="size-4" />}>Chercher</Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLES.map((e) => <button type="button" key={e} onClick={() => navigate(`/recherche?q=${encodeURIComponent(e)}`)} className="rounded-md border border-line bg-subtle px-2 py-1 text-left text-xs text-ink-2 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">{e}</button>)}
                    </div>
                  </form>
                  <UploadDropZone compact locked={uploadLocked} onFiles={startUpload} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Activité récente" actions={<a href="#/parametres?tab=audit" className="text-[13px] font-medium text-brand-700 hover:underline">Journal d'audit</a>} />
                <ul className="divide-y divide-line">
                  {s.audit.slice(0, 7).map((a) => {
                    const c = a.entity === 'candidate' || a.entity === 'analysis' ? s.candidates.find((x) => x.id === a.entityId) : undefined
                    return (
                      <li key={a.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                        <span className={cx('mt-1.5 size-1.5 shrink-0 rounded-full', a.entity === 'analysis' ? 'bg-violet-600' : a.entity === 'system' || a.entity === 'provider' ? 'bg-ink-4' : 'bg-brand-600')} />
                        <div className="min-w-0 flex-1">
                          <p className="text-ink">
                            <span className="font-medium">{a.action}</span>
                            {c && <> · <a href={`#/candidats/${c.id}`} className="text-brand-700 hover:underline">{c.firstName} {c.lastName}</a></>}
                          </p>
                          <p className="truncate text-xs text-ink-3">{a.actor} · {fmtRelative(a.at)}{a.details ? ` · ${a.details}` : ''}</p>
                        </div>
                      </li>
                    )
                  })}
                  {s.audit.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-3">Aucune activité enregistrée.</li>}
                </ul>
              </Card>

              <Card>
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <span className="flex items-center gap-2 text-ink-2"><Sparkles className="size-4 text-violet-600" /> Fournisseur par défaut</span>
                  <ProviderTag provider={s.settings.defaultProvider} name={providerName(s.settings.defaultProvider)} />
                  <a href="#/parametres?tab=ai" className="text-[13px] font-medium text-brand-700 hover:underline">Gérer</a>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
