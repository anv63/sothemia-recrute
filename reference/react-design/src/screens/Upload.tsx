import { Check, CircleAlert, Copy, ExternalLink, FileText, FileWarning, LoaderCircle, Trash2, TriangleAlert } from 'lucide-react'
import { Badge, ProviderTag, StatusBadge } from '../components/Badges'
import { PageHeader } from '../components/Layout'
import { Banner, EmptyState, MissingKeyBanner } from '../components/States'
import UploadDropZone from '../components/UploadDropZone'
import { Button, Card, CardHeader, Progress, Toggle, cx } from '../components/ui'
import { ApiError, api, can, providerName, providerUsable, useDb } from '../lib/db'
import { PIPELINE, PROCESSING_LABEL, fmtRelative, fmtSize, plural } from '../lib/format'
import { useAction } from '../lib/hooks'
import { clearFinished, enqueue, resolveDuplicate, useQueue, type ItemStage, type UploadItem } from '../lib/pipeline'
import { navigate } from '../lib/router'
import { toast } from '../lib/toast'

const STEP_INDEX: Partial<Record<ItemStage, number>> = { queued: -1, hashing: -1, received: 0, extracting: 1, analyzing: 2, indexed: 3, ready: 4 }

function Stepper({ stage }: { stage: ItemStage }) {
  const idx = STEP_INDEX[stage] ?? -1
  const failed = stage === 'error'
  return (
    <ol className="flex items-center gap-1" aria-label="Étapes de traitement">
      {PIPELINE.map((p, i) => {
        const done = i < idx || (i === idx && stage === 'ready')
        const cur = i === idx && stage !== 'ready'
        return (
          <li key={p} className="flex items-center gap-1">
            {i > 0 && <span className={cx('h-px w-3 md:w-5', i <= idx ? 'bg-brand-500' : 'bg-line-strong')} />}
            <span className={cx('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium', done ? 'bg-ok-50 text-ok-700' : cur ? (failed ? 'bg-bad-50 text-bad-700' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200') : 'text-ink-4')}>
              {done ? <Check className="size-3" /> : cur ? <LoaderCircle className="size-3 animate-spin" /> : null}
              <span className={cx(!cur && !done && 'hidden md:inline')}>{PROCESSING_LABEL[p]}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function QueueRow({ it }: { it: UploadItem }) {
  const isDup = it.stage === 'duplicate'
  const tone = it.stage === 'error' || it.stage === 'invalid' ? 'bad' : isDup ? 'warn' : it.stage === 'ready' ? 'ok' : 'brand'
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className={cx('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md', it.file.name.toLowerCase().endsWith('.docx') ? 'bg-brand-50 text-brand-700' : 'bg-bad-50 text-bad-700')}>
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-ink">{it.file.name}</p>
            <span className="text-xs text-ink-3 tabular">{fmtSize(Math.max(1, Math.round(it.file.size / 1024)))}</span>
            {it.stage === 'invalid' && <Badge tone="bad" icon={<CircleAlert className="size-3" />}>Refusé</Badge>}
            {isDup && <Badge tone="warn" icon={<Copy className="size-3" />}>Doublon exact</Badge>}
            {it.stage === 'skipped' && <Badge>Ignoré</Badge>}
            {it.stage === 'error' && <StatusBadge status="error" />}
            {it.stage === 'ready' && <StatusBadge status="ready" />}
            {it.lowConfidence && it.stage !== 'error' && <Badge tone="bad" icon={<FileWarning className="size-3" />}>Faible confiance</Badge>}
            {it.duplicateOf && !isDup && <Badge tone="warn" icon={<TriangleAlert className="size-3" />}>Doublon probable</Badge>}
          </div>
          {!['invalid', 'skipped', 'duplicate'].includes(it.stage) && <div className="mt-2"><Stepper stage={it.stage} /></div>}
          {!['invalid', 'skipped', 'duplicate', 'ready', 'error'].includes(it.stage) && <Progress value={it.progress} className="mt-2.5 max-w-xl" tone={tone === 'bad' ? 'bad' : 'brand'} />}
          {it.message && <p className={cx('mt-1.5 text-[13px]', tone === 'bad' ? 'text-bad-700' : tone === 'warn' ? 'text-warn-700' : 'text-ink-3')}>{it.message}</p>}
          {it.duplicateOf && !isDup && (
            <p className="mt-1 text-[13px] text-warn-700">Même adresse e-mail qu'un dossier existant : <a className="font-medium underline" href={`#/candidats/${it.duplicateOf}`}>{it.duplicateOf}</a>. Vérifiez avant de poursuivre.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDup && (
            <>
              <Button size="sm" onClick={() => it.duplicateOf && navigate(`/candidats/${it.duplicateOf}`)}>Voir l'existant</Button>
              <Button size="sm" variant="ghost" onClick={() => resolveDuplicate(it.key, 'skip')}>Ignorer</Button>
              <Button size="sm" variant="primary" onClick={() => resolveDuplicate(it.key, 'import')}>Importer quand même</Button>
            </>
          )}
          {(it.stage === 'ready' || it.stage === 'error') && it.candidateId && (
            <Button size="sm" icon={<ExternalLink className="size-3.5" />} onClick={() => navigate(`/candidats/${it.candidateId}`)}>{it.stage === 'ready' ? 'Ouvrir pour revue' : 'Voir le dossier'}</Button>
          )}
        </div>
      </div>
    </li>
  )
}

export default function UploadScreen() {
  const s = useDb()
  const queue = useQueue()
  const { pending, run } = useAction()
  const locked = !can('upload', s.settings.role)
  const active = queue.filter((q) => !['ready', 'invalid', 'skipped', 'error', 'duplicate'].includes(q.stage))
  const done = queue.filter((q) => q.stage === 'ready').length
  const issues = queue.filter((q) => ['invalid', 'error', 'duplicate'].includes(q.stage)).length
  const dp = s.settings.defaultProvider
  const usable = providerUsable(dp)
  const dbJobs = s.candidates.filter((c) => ['received', 'extracting', 'analyzing', 'indexed'].includes(c.processing) && !queue.some((q) => q.candidateId === c.id))
  const missingKey = s.providers.find((p) => p.id === dp && p.keyStatus !== 'configured')

  const onFiles = (files: File[]) => {
    try {
      enqueue(files)
    } catch (e) {
      toast.forbidden('Action non autorisée', (e as ApiError).message)
    }
  }

  return (
    <>
      <PageHeader title="Importer des CV" subtitle="Les fichiers sont traités et stockés localement. Aucun envoi externe sans fournisseur IA configuré." crumbs={[{ label: 'CVthèque', to: '/cvtheque' }, { label: 'Import' }]} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="space-y-6">
          <UploadDropZone onFiles={onFiles} locked={locked} />

          <Card>
            <CardHeader
              title="File de traitement"
              subtitle={queue.length ? `${plural(active.length, 'en cours')} · ${plural(done, 'prêt')} · ${plural(issues, 'à traiter', 'à traiter')}` : 'Session courante'}
              actions={queue.length > 0 && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={clearFinished} disabled={queue.length === active.length}>Effacer les terminés</Button>}
            />
            {queue.length === 0 ? (
              <EmptyState compact title="Aucun import en cours" icon={<FileText className="size-5" />}>
                Déposez un ou plusieurs CV ci-dessus. Chaque fichier passe par les étapes Reçu → Extraction → Analyse → Indexé → Prêt pour revue.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">{queue.map((it) => <QueueRow key={it.key} it={it} />)}</ul>
            )}
          </Card>

          {dbJobs.length > 0 && (
            <Card>
              <CardHeader title="Traitements en arrière-plan" subtitle="Repris automatiquement depuis la base locale" />
              <ul className="divide-y divide-line">
                {dbJobs.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <FileText className="size-4 text-ink-3" />
                    <a href={`#/candidats/${c.id}`} className="min-w-0 flex-1 truncate font-medium text-ink hover:text-brand-700">{c.file.name}</a>
                    <StatusBadge status={c.processing} />
                    <span className="text-xs text-ink-3">{fmtRelative(c.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Options de traitement" />
            <div className="space-y-4 p-5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">Analyse automatique</p>
                  <p className="text-[13px] text-ink-3">Génère une recommandation après extraction.</p>
                </div>
                <Toggle label="Analyse automatique" checked={s.settings.autoAnalyze} loading={pending === 'auto'} onChange={(v) => run('auto', () => api.updateSettings({ autoAnalyze: v }, 'upload'), v ? 'Analyse automatique activée' : 'Analyse automatique désactivée')} />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-ink-2">Fournisseur</span>
                <ProviderTag provider={usable.ok ? dp : 'local'} name={providerName(usable.ok ? dp : 'local')} />
              </div>
              {missingKey && <MissingKeyBanner provider={missingKey.name} onConfigure={() => navigate('/parametres?tab=ai')} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Contrôles appliqués" />
            <ul className="space-y-2.5 p-5 text-[13px] text-ink-2">
              {[
                ['Formats', 'PDF et DOCX uniquement'],
                ['Taille', '10 Mo maximum par fichier, fichiers vides refusés'],
                ['Doublon exact', 'Empreinte SHA-256 identique → confirmation requise'],
                ['Doublon probable', 'Même e-mail qu\'un dossier existant → avertissement'],
                ['Faible confiance', 'Moins de 60 % des champs clés lus → vérification RH'],
                ['Données sensibles', 'Âge, genre, nationalité, situation familiale et photo ne sont jamais extraits pour le scoring'],
              ].map(([k, v]) => (
                <li key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2"><span className="font-medium text-ink">{k}</span><span>{v}</span></li>
              ))}
            </ul>
          </Card>
          {locked && <Banner tone="warn" title="Import restreint">Le rôle actuel ne permet pas d'importer des CV. Changez de rôle (démo) ou contactez un administrateur RH.</Banner>}
        </aside>
      </div>
    </>
  )
}
