import { Archive, Check, CircleAlert, Database, Download, FileJson, FileSpreadsheet, HardDrive, History, KeyRound, Lock, PlugZap, RefreshCw, Server, ShieldCheck, Sparkles, Upload, Users, X } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Badge, ProviderTag } from '../components/Badges'
import { PageHeader } from '../components/Layout'
import { Modal, useConfirm } from '../components/Modal'
import { Banner, ErrorState, Skeleton } from '../components/States'
import { Button, Card, CardHeader, Field, Input, Select, Tabs, Toggle, cx } from '../components/ui'
import { PERMISSIONS, PROVIDER_NAMES, ROLE_LABEL, api, can, providerUsable, useDb, type Action } from '../lib/db'
import { downloadBlob } from '../lib/files'
import { fmtDateTime, fmtRelative, fmtSize, plural } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import { navigate, useRoute } from '../lib/router'
import { toast } from '../lib/toast'
import type { ProviderConfig, ProviderId, Role } from '../lib/types'

type Tab = 'ai' | 'local' | 'audit' | 'roles'

function KeyModal({ p, onClose }: { p: ProviderConfig | null; onClose: () => void }) {
  const [key, setKey] = useState('')
  const [err, setErr] = useState<string>()
  const { pending, run } = useAction()
  if (!p) return null
  const hint = { openai: 'sk-…', anthropic: 'sk-ant-…', gemini: 'AIza…' }[p.id]
  return (
    <Modal
      open
      onClose={() => { setKey(''); onClose() }}
      title={`Clé API — ${p.name}`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button variant="primary" disabled={!key.trim()} loading={pending === 'key'} onClick={async () => {
          setErr(undefined)
          try { await api.setProviderKey(p.id, key); toast.success('Clé enregistrée', `${p.name} : clé stockée dans le trousseau système.`); setKey(''); onClose() }
          catch (e) { const m = (e as Error).message; setErr(m); if ((e as { code?: string }).code === 'FORBIDDEN') run('key', () => Promise.reject(e)) }
        }}>Enregistrer la clé</Button>
      </>}
    >
      <div className="space-y-3">
        <Field label="Nouvelle clé API" htmlFor="api-key" error={err} hint={`Format attendu : ${hint}`}>
          <Input id="api-key" type="password" autoComplete="off" spellCheck={false} value={key} invalid={!!err} onChange={(e) => setKey(e.target.value)} placeholder="Coller la clé ici" className="font-mono" />
        </Field>
        <p className="flex gap-2 rounded-md bg-subtle p-3 text-xs leading-relaxed text-ink-3"><Lock className="mt-0.5 size-3.5 shrink-0" />La clé est transmise au service local qui la chiffre dans le trousseau du système d'exploitation. Elle n'est jamais réaffichée, journalisée ni exportée.</p>
      </div>
    </Modal>
  )
}

function ProviderCard({ p, isDefault }: { p: ProviderConfig; isDefault: boolean }) {
  const s = useDb()
  const { pending, run } = useAction()
  const { confirm, modal } = useConfirm()
  const [keyOpen, setKeyOpen] = useState(false)
  const locked = !can('providers', s.settings.role)
  const status = p.keyStatus === 'missing' ? <Badge tone="warn" icon={<KeyRound className="size-3" />}>Clé manquante</Badge> : p.keyStatus === 'invalid' ? <Badge tone="bad" icon={<CircleAlert className="size-3" />}>Clé invalide</Badge> : p.enabled ? <Badge tone="ok" icon={<Check className="size-3" />}>Actif</Badge> : <Badge>Désactivé</Badge>
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <ProviderTag provider={p.id} name={p.name} />
        {status}
        {isDefault && <Badge tone="brand">Par défaut</Badge>}
        <div className="ml-auto flex items-center gap-2 text-[13px] text-ink-2">
          Activé
          <Toggle label={`Activer ${p.name}`} checked={p.enabled} loading={pending === 'enable'} onChange={(v) => run('enable', () => api.updateProvider(p.id, { enabled: v }), `${p.name} ${v ? 'activé' : 'désactivé'}`)} />
        </div>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <Field label="Modèle" htmlFor={`m-${p.id}`}>
          <Select id={`m-${p.id}`} value={p.model} disabled={pending === 'model'} onChange={(e) => run('model', () => api.updateProvider(p.id, { model: e.target.value }), `Modèle ${e.target.value} sélectionné`)}>
            {p.models.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Clé API">
          <div className="flex h-9 items-center gap-2 rounded-md border border-line bg-subtle px-3 text-sm">
            {p.keyStatus === 'configured' ? <><ShieldCheck className="size-4 text-ok-600" /><span className="text-ink">Configurée</span><span className="font-mono text-ink-4" aria-hidden>••••••••••••</span></> : p.keyStatus === 'invalid' ? <><CircleAlert className="size-4 text-bad-600" /><span className="text-bad-700">Refusée — format invalide</span></> : <><KeyRound className="size-4 text-warn-600" /><span className="text-warn-700">Aucune clé</span></>}
            <span className="ml-auto text-xs text-ink-4">{p.keyUpdatedAt ? `maj ${fmtRelative(p.keyUpdatedAt)}` : ''}</span>
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-subtle px-5 py-3">
        <div className="mr-auto min-w-0 text-[13px]">
          {pending === 'test' ? <span className="text-ink-3">Test en cours…</span> : p.lastTest ? (
            <span className={p.lastTest.ok ? 'text-ok-700' : 'text-bad-700'}>{p.lastTest.ok ? `Connexion OK · ${p.lastTest.latencyMs} ms` : `Échec : ${p.lastTest.message}`} <span className="text-ink-4">· {fmtRelative(p.lastTest.at)}</span></span>
          ) : <span className="text-ink-4">Jamais testé</span>}
        </div>
        <Button size="sm" icon={<PlugZap className="size-3.5" />} loading={pending === 'test'} disabled={p.keyStatus !== 'configured'} onClick={() => run('test', () => api.testProvider(p.id), (ms) => `${p.name} répond en ${ms} ms`)}>Tester la connexion</Button>
        <Button size="sm" icon={<KeyRound className="size-3.5" />} locked={locked} onClick={() => (locked ? run('k', () => api.setProviderKey(p.id, '')) : setKeyOpen(true))}>{p.keyStatus === 'configured' ? 'Remplacer la clé' : 'Ajouter une clé'}</Button>
        {p.keyStatus !== 'missing' && <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} locked={locked} className="text-bad-600 hover:bg-bad-50" onClick={() => confirm({ title: `Révoquer la clé ${p.name} ?`, tone: 'danger', confirmLabel: 'Révoquer', body: 'La clé sera supprimée du trousseau et le fournisseur désactivé. Les analyses existantes sont conservées.', onConfirm: () => run('rm', () => api.removeProviderKey(p.id), 'Clé révoquée') })}>Révoquer</Button>}
      </div>
      {keyOpen && <KeyModal p={p} onClose={() => setKeyOpen(false)} />}
      {modal}
    </Card>
  )
}

function AiTab() {
  const s = useDb()
  const { pending, run } = useAction()
  const locked = !can('providers', s.settings.role)
  return (
    <div className="space-y-6">
      <Banner tone="brand" icon={<ShieldCheck className="size-4" />} title="Confidentialité des données candidats">
        Par défaut, l'analyse s'exécute localement. Lorsqu'un fournisseur externe est utilisé, seul le texte du CV est envoyé{s.settings.anonymizeBeforeSending ? ', après retrait du nom, de l\'e-mail et du téléphone' : ''}, sans fichier original ni photo. Les clés API ne sont jamais affichées. Vérifiez la conformité avec la loi 09-08 (CNDP) avant activation.
      </Banner>
      {locked && <Banner tone="warn" icon={<Lock className="size-4" />} title="Lecture seule">Seul un administrateur RH peut modifier les fournisseurs IA. Vous pouvez tester les connexions existantes.</Banner>}
      <Card>
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="Fournisseur par défaut" hint="Utilisé pour l'analyse automatique à l'import" htmlFor="def-p">
            <Select id="def-p" value={s.settings.defaultProvider} disabled={pending === 'def'} onChange={(e) => run('def', () => api.updateSettings({ defaultProvider: e.target.value as ProviderId }, 'providers'), 'Fournisseur par défaut mis à jour')}>
              {(Object.keys(PROVIDER_NAMES) as ProviderId[]).map((p) => <option key={p} value={p}>{PROVIDER_NAMES[p]}{providerUsable(p).ok ? '' : ' (indisponible)'}</option>)}
            </Select>
          </Field>
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[13px] font-medium text-ink-2">Pseudonymiser avant envoi</p><p className="text-xs text-ink-3">Retire nom, e-mail et téléphone du texte transmis.</p></div>
            <Toggle label="Pseudonymiser" checked={s.settings.anonymizeBeforeSending} loading={pending === 'anon'} onChange={(v) => run('anon', () => api.updateSettings({ anonymizeBeforeSending: v }, 'providers'), v ? 'Pseudonymisation activée' : 'Pseudonymisation désactivée')} />
          </div>
        </div>
      </Card>
      <div className="grid gap-6 2xl:grid-cols-3">{s.providers.map((p) => <ProviderCard key={p.id} p={p} isDefault={s.settings.defaultProvider === p.id} />)}</div>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return <div className="rounded-md border border-line bg-subtle p-3"><p className="flex items-center gap-1.5 text-xs text-ink-3">{icon}{label}</p><p className="mt-1 text-lg font-semibold text-ink tabular">{value}</p></div>
}

function LocalTab() {
  const s = useDb()
  const res = useResource('local')
  const { pending, run } = useAction()
  const { confirm, modal } = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const role = s.settings.role
  const dbSize = useMemo(() => new Blob([JSON.stringify(s)]).size / 1024, [s])
  const filesKb = s.candidates.reduce((a, c) => a + c.file.sizeKb, 0)
  const stored = s.candidates.filter((c) => c.file.stored).length
  const retentionHits = api.retentionCandidates().length
  const failing = s.settings.simulateFailures
  const services: [string, boolean, string][] = [
    ['Base SQLite (data/ats.sqlite)', !failing, failing ? 'Verrouillée — SQLITE_BUSY' : 'Lecture / écriture OK · WAL activé'],
    ['Stockage des fichiers (data/cv_files/)', true, `${stored} originaux · ${fmtSize(filesKb)}`],
    ['Extraction PDF / DOCX', true, 'pdfplumber · python-docx · OCR Tesseract (repli)'],
    ["Moteur d'analyse locale", true, 'règles-locales v1.2'],
    ['Index de recherche (FTS5)', !failing, `${s.candidates.filter((c) => c.processing === 'ready' || c.processing === 'indexed').length} dossiers indexés`],
    ['Fournisseurs IA externes', s.providers.some((p) => p.keyStatus === 'configured'), `${s.providers.filter((p) => p.enabled && p.keyStatus === 'configured').length} actif(s) sur 3`],
  ]
  const exp = (f: 'csv' | 'json') => run(`exp-${f}`, async () => { const e = await api.exportCandidates(f); downloadBlob(e.blob, e.filename); return e }, (e) => `${plural(e.count, 'dossier')} exporté(s) (${f.toUpperCase()})`)

  if (res.status === 'loading') return <div className="grid gap-6 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-lg" />)}</div>
  if (res.status === 'error') return <Card><ErrorState message={res.error} onRetry={res.retry} /></Card>

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Base de données" icon={<Database className="size-4" />} actions={failing ? <Badge tone="bad" icon={<CircleAlert className="size-3" />}>Verrouillée</Badge> : <Badge tone="ok" icon={<Check className="size-3" />}>Opérationnelle</Badge>} />
          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3">
            <Stat label="Candidats" value={s.candidates.length} icon={<Users className="size-3.5" />} />
            <Stat label="Analyses" value={s.analyses.length} icon={<Sparkles className="size-3.5" />} />
            <Stat label="Entrées d'audit" value={s.audit.length} icon={<History className="size-3.5" />} />
            <Stat label="Taille base" value={fmtSize(Math.round(dbSize))} icon={<Database className="size-3.5" />} />
            <Stat label="Fichiers CV" value={fmtSize(filesKb)} icon={<HardDrive className="size-3.5" />} />
            <Stat label="Critères" value={s.offers.length} icon={<Server className="size-3.5" />} />
          </div>
          <p className="border-t border-line px-5 py-3 font-mono text-xs text-ink-3">sqlite:///data/ats.sqlite · schéma v1</p>
        </Card>

        <Card>
          <CardHeader title="État du système" icon={<Server className="size-4" />} />
          <ul className="divide-y divide-line">
            {services.map(([n, ok, d]) => (
              <li key={n} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={cx('size-2 shrink-0 rounded-full', ok ? 'bg-ok-600' : 'bg-bad-600')} />
                <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{n}</span><span className="block truncate text-xs text-ink-3">{d}</span></span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Export & sauvegarde" icon={<Download className="size-4" />} />
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <Button icon={<FileSpreadsheet className="size-4" />} loading={pending === 'exp-csv'} locked={!can('export', role)} onClick={() => exp('csv')}>Exporter CSV</Button>
              <Button icon={<FileJson className="size-4" />} loading={pending === 'exp-json'} locked={!can('export', role)} onClick={() => exp('json')}>Exporter JSON</Button>
            </div>
            <p className="text-xs text-ink-3">Dernier export : {fmtDateTime(s.settings.lastExportAt)}. Les exports contiennent des données personnelles : stockez-les sur un emplacement sécurisé.</p>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="primary" icon={<Archive className="size-4" />} loading={pending === 'backup'} locked={!can('backup', role)} onClick={() => run('backup', async () => { const b = await api.backup(); downloadBlob(b.blob, b.filename) }, 'Sauvegarde créée et téléchargée')}>Créer une sauvegarde</Button>
              <Button icon={<Upload className="size-4" />} loading={pending === 'restore'} locked={!can('backup', role)} onClick={() => (can('backup', role) ? fileRef.current?.click() : run('restore', () => api.restore(new File([], 'x'))))}>Restaurer…</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) confirm({ title: 'Restaurer cette sauvegarde ?', tone: 'danger', confirmLabel: 'Restaurer', requireText: 'RESTAURER', body: <>La base actuelle sera remplacée par <b>{f.name}</b>. Créez d'abord une sauvegarde si nécessaire.</>, onConfirm: () => run('restore', () => api.restore(f), 'Sauvegarde restaurée') }) }} />
            </div>
            <p className="text-xs text-ink-3">Dernière sauvegarde : {s.settings.lastBackupAt ? `${fmtDateTime(s.settings.lastBackupAt)} (${fmtRelative(s.settings.lastBackupAt)})` : 'jamais'}.</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Conservation des données" icon={<History className="size-4" />} />
          <div className="space-y-4 p-5">
            <Field label="Durée de conservation des dossiers inactifs" htmlFor="ret" hint="Calculée depuis la dernière modification du dossier">
              <Select id="ret" value={s.settings.retentionMonths} disabled={pending === 'ret'} onChange={(e) => run('ret', () => api.updateSettings({ retentionMonths: +e.target.value }, 'retention'), 'Durée de conservation mise à jour')}>
                {[1, 6, 12, 24, 36].map((m) => <option key={m} value={m}>{m} mois</option>)}
              </Select>
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-subtle p-3 text-sm">
              <span className="text-ink-2"><b className="font-semibold tabular text-ink">{retentionHits}</b> dossier(s) au-delà de la durée</span>
              <Button size="sm" variant="danger" locked={!can('retention', role)} disabled={retentionHits === 0} loading={pending === 'purge'} onClick={() => can('retention', role) ? confirm({ title: `Purger ${plural(retentionHits, 'dossier')} ?`, tone: 'danger', confirmLabel: 'Purger', requireText: 'PURGER', body: 'Les dossiers, fichiers originaux et analyses concernés seront définitivement supprimés. L\'opération est tracée.', onConfirm: () => run('purge', () => api.applyRetention(), (n) => `${plural(n, 'dossier')} purgé(s)`) }) : run('purge', () => api.applyRetention())}>Appliquer la purge</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Diagnostic & maintenance" subtitle="Outils de recette — réservés aux administrateurs en production" />
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm font-medium text-ink">Simuler une indisponibilité de la base</p><p className="text-[13px] text-ink-3">Toutes les lectures et écritures renvoient SQLITE_BUSY afin de vérifier les états d'erreur.</p></div>
            <Toggle label="Simuler des erreurs" checked={failing} onChange={(v) => { api.setSimulateFailures(v); toast[v ? 'warning' : 'success'](v ? 'Mode diagnostic activé' : 'Mode diagnostic désactivé', v ? 'Les écrans afficheront leurs états d\'erreur.' : undefined) }} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button icon={<RefreshCw className="size-4" />} locked={!can('reset', role)} loading={pending === 'reset'} onClick={() => can('reset', role) ? confirm({ title: 'Réinitialiser le jeu de démonstration ?', tone: 'danger', confirmLabel: 'Réinitialiser', body: 'La base sera remplacée par les données de démonstration initiales.', onConfirm: () => run('reset', () => api.reset(false), 'Base réinitialisée') }) : run('reset', () => api.reset(false))}>Réinitialiser la démo</Button>
            <Button variant="ghost" className="text-bad-600 hover:bg-bad-50" locked={!can('reset', role)} onClick={() => can('reset', role) ? confirm({ title: 'Vider entièrement la base ?', tone: 'danger', confirmLabel: 'Vider la base', requireText: 'VIDER', body: 'Tous les candidats, fichiers, analyses et critères seront supprimés (état vide).', onConfirm: () => run('reset', () => api.reset(true), 'Base vidée') }) : run('reset', () => api.reset(true))}>Vider la base</Button>
          </div>
        </div>
      </Card>
      {modal}
    </div>
  )
}

function AuditTab() {
  const s = useDb()
  const res = useResource('audit')
  const { pending, run } = useAction()
  const [entity, setEntity] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const rows = s.audit.filter((a) => (!entity || a.entity === entity) && (!q || `${a.action} ${a.actor} ${a.details} ${a.entityId ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const size = 20
  const pages = Math.max(1, Math.ceil(rows.length / size))
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Action, utilisateur, identifiant…" aria-label="Filtrer le journal" className="max-w-xs" />
        <Select aria-label="Type" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} className="w-44">
          <option value="">Tous les types</option>
          {[['candidate', 'Candidats'], ['analysis', 'Analyses'], ['offer', 'Critères'], ['provider', 'Fournisseurs IA'], ['search', 'Recherches'], ['system', 'Système']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <span className="ml-auto text-[13px] text-ink-3 tabular">{plural(rows.length, 'entrée')}</span>
        <Button size="sm" icon={<Download className="size-3.5" />} loading={pending === 'ex'} locked={!can('export', s.settings.role)} onClick={() => run('ex', async () => { if (!can('export', s.settings.role)) await api.exportCandidates('csv', []); downloadBlob(new Blob(['\ufeffdate;utilisateur;rôle;action;type;id;détails\n' + rows.map((a) => [a.at, a.actor, a.role, a.action, a.entity, a.entityId ?? '', a.details].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' }), 'audit.csv') }, 'Journal exporté')}>Exporter</Button>
      </div>
      {res.status === 'loading' ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : res.status === 'error' ? <ErrorState message={res.error} onRetry={res.retry} /> : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-subtle text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3"><tr className="[&>th]:h-10 [&>th]:border-b [&>th]:border-line [&>th]:px-3"><th className="pl-4">Date</th><th>Utilisateur</th><th>Action</th><th>Objet</th><th>Détails</th></tr></thead>
            <tbody>
              {rows.slice((page - 1) * size, page * size).map((a) => (
                <tr key={a.id} className="border-b border-line [&>td]:px-3 [&>td]:py-2">
                  <td className="whitespace-nowrap pl-4 text-ink-3 tabular">{fmtDateTime(a.at)}</td>
                  <td className="whitespace-nowrap"><span className="text-ink">{a.actor}</span><span className="block text-[11px] text-ink-3">{ROLE_LABEL[a.role]}</span></td>
                  <td className="font-medium text-ink">{a.action}</td>
                  <td className="font-mono text-xs text-ink-3">{a.entityId && (a.entity === 'candidate' || a.entity === 'analysis') && !a.entityId.includes(',') ? <a href={`#/candidats/${a.entityId}`} className="text-brand-700 hover:underline">{a.entityId}</a> : a.entityId ?? a.entity}</td>
                  <td className="max-w-md truncate text-ink-2" title={a.details}>{a.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-3">Aucune entrée ne correspond.</p>}
          <div className="flex items-center justify-end gap-2 px-4 py-3 text-[13px] text-ink-3">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Précédent</Button>
            <span className="tabular">Page {page} / {pages}</span>
            <Button size="sm" variant="ghost" disabled={page === pages} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function RolesTab() {
  const s = useDb()
  const roles = Object.keys(ROLE_LABEL) as Role[]
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Matrice des autorisations" subtitle="Le rôle de démonstration se change en haut à droite. En production, il provient de la session authentifiée." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-subtle text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3"><tr className="[&>th]:h-10 [&>th]:border-b [&>th]:border-line [&>th]:px-4"><th>Action</th>{roles.map((r) => <th key={r} className={cx('text-center', s.settings.role === r && 'text-brand-700')}>{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>
            {(Object.keys(PERMISSIONS) as Action[]).map((a) => (
              <tr key={a} className="border-b border-line [&>td]:px-4 [&>td]:py-2.5">
                <td className="text-ink">{PERMISSIONS[a].label}</td>
                {roles.map((r) => <td key={r} className={cx('text-center', s.settings.role === r && 'bg-brand-50/50')}>{PERMISSIONS[a].roles.includes(r) ? <Check className="mx-auto size-4 text-ok-600" aria-label="Autorisé" /> : <Lock className="mx-auto size-3.5 text-ink-4" aria-label="Non autorisé" />}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function Settings() {
  const { query } = useRoute()
  const tab = (query.get('tab') as Tab) || 'ai'
  const s = useDb()
  return (
    <>
      <PageHeader title="Paramètres" subtitle="Fournisseurs IA, données locales, journal d'audit et autorisations." />
      <div className="mb-6"><Tabs value={tab} onChange={(t) => navigate(`/parametres?tab=${t}`)} items={[
        { id: 'ai', label: 'Fournisseurs IA', icon: <Sparkles className="size-4" />, count: s.providers.filter((p) => p.keyStatus !== 'configured').length || undefined },
        { id: 'local', label: 'Données locales & système', icon: <Database className="size-4" /> },
        { id: 'audit', label: "Journal d'audit", icon: <History className="size-4" />, count: s.audit.length },
        { id: 'roles', label: 'Rôles & accès', icon: <ShieldCheck className="size-4" /> },
      ]} /></div>
      {tab === 'ai' ? <AiTab /> : tab === 'local' ? <LocalTab /> : tab === 'audit' ? <AuditTab /> : <RolesTab />}
    </>
  )
}
