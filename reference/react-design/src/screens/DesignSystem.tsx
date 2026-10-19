import { Download, FileUp, Search, Sparkles, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AIBadge, Badge, ConfidenceBadge, CriterionBadge, ProviderTag, ReviewBadge, ScoreBadge, ScoreRing, StatusBadge } from '../components/Badges'
import { PageHeader } from '../components/Layout'
import MetricCard from '../components/MetricCard'
import { useConfirm } from '../components/Modal'
import { Banner, EmptyState, ErrorState, Forbidden, LowConfidenceBanner, MissingKeyBanner, NoResults, TableSkeleton } from '../components/States'
import UploadDropZone from '../components/UploadDropZone'
import { Button, Card, CardHeader, Checkbox, Chip, Field, Input, Progress, Select, Tabs, Toggle, cx } from '../components/ui'
import { COLORS, CONTROL_STATES, INTERACTIONS, LAYOUT, PRINCIPLES, PROMPT_CONTRACT, RADII_SHADOWS, SCHEMA, SPACING, STATES, STREAMLIT, TYPE_SCALE } from '../lib/handoff'
import { PIPELINE } from '../lib/format'
import { toast } from '../lib/toast'
import type { ReviewStatus } from '../lib/types'

type Section = 'fondations' | 'composants' | 'etats' | 'interactions' | 'donnees'

function Spec({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="bg-subtle text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3"><tr className="[&>th]:h-9 [&>th]:border-b [&>th]:border-line [&>th]:px-4">{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line align-top [&>td]:px-4 [&>td]:py-2.5">{r.map((c, j) => <td key={j} className={cx(j === 0 ? 'font-medium text-ink' : 'text-ink-2')}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function Demo({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={note} />
      <div className="p-5">{children}</div>
    </Card>
  )
}

export default function DesignSystem() {
  const [sec, setSec] = useState<Section>('fondations')
  const [tog, setTog] = useState(true)
  const [chk, setChk] = useState(true)
  const [tab, setTab] = useState('a')
  const { confirm, modal } = useConfirm()

  return (
    <>
      <PageHeader
        title="Design & handoff"
        subtitle="Tokens, composants, états et spécification de chaque interaction pour l'implémentation Streamlit + SQLite."
      />
      <div className="mb-6"><Tabs value={sec} onChange={setSec} items={[
        { id: 'fondations', label: 'Fondations' }, { id: 'composants', label: 'Composants' }, { id: 'etats', label: 'États' },
        { id: 'interactions', label: 'Interactions', count: INTERACTIONS.length }, { id: 'donnees', label: 'Données & Streamlit' },
      ]} /></div>

      {sec === 'fondations' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PRINCIPLES.map(([t, d]) => <Card key={t} className="p-5"><p className="text-[15px] font-semibold text-ink">{t}</p><p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{d}</p></Card>)}
          </div>
          <Card>
            <CardHeader title="Couleurs" subtitle="Contraste mesuré sur fond blanc (WCAG 2.1 AA ≥ 4.5:1 pour le texte)" />
            <div className="space-y-6 p-5">
              {COLORS.map((g) => (
                <div key={g.group}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{g.group}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                    {g.tokens.map((t) => (
                      <div key={t.name} className="overflow-hidden rounded-lg border border-line">
                        <div className="h-14 border-b border-line" style={{ background: t.hex }} />
                        <div className="p-2.5">
                          <p className="font-mono text-xs font-medium text-ink">{t.name}</p>
                          <p className="font-mono text-[11px] text-ink-3">{t.hex}{t.contrast && ` · ${t.contrast}`}</p>
                          <p className="mt-1 text-[11px] leading-snug text-ink-3">{t.use}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Typographie" subtitle="Inter · IBM Plex Mono" />
              <ul className="divide-y divide-line">
                {TYPE_SCALE.map((t) => <li key={t.name} className="grid grid-cols-[140px_minmax(0,1fr)] items-baseline gap-4 px-5 py-3"><span><span className="block text-[13px] font-medium text-ink">{t.name}</span><span className="font-mono text-[11px] text-ink-3">{t.spec}</span></span><span className={cx('truncate text-ink', t.cls)}>{t.sample}</span></li>)}
              </ul>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Espacements" subtitle="Base 4 px (échelle Tailwind)" />
                <ul className="space-y-2 p-5">{SPACING.map(([k, v, u]) => <li key={k} className="grid grid-cols-[40px_60px_minmax(0,1fr)_minmax(0,2fr)] items-center gap-3 text-[13px]"><span className="font-mono text-ink-3">{k}</span><span className="tabular text-ink">{v}</span><span className="h-3 rounded-sm bg-brand-200" style={{ width: parseInt(v) * 3 }} /><span className="text-ink-3">{u}</span></li>)}</ul>
              </Card>
              <Card>
                <CardHeader title="Rayons & ombres" />
                <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
                  {RADII_SHADOWS.map(([k, v, u]) => (
                    <div key={k} className="text-center">
                      <div className="mx-auto mb-2 size-14 border border-line bg-white" style={{ borderRadius: k.startsWith('radius') ? parseInt(v) : 10, boxShadow: k.startsWith('shadow') ? `var(--${k})` : undefined }} />
                      <p className="font-mono text-[11px] text-ink">{k}</p><p className="text-[11px] text-ink-3">{u}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
          <Card><CardHeader title="Mise en page responsive" /><Spec head={['Contexte', 'Règle']} rows={LAYOUT} /></Card>
        </div>
      )}

      {sec === 'composants' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Demo title="Boutons" note="Primaire, secondaire, fantôme, danger, teal · tailles sm / md / lg">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" icon={<FileUp className="size-4" />}>Importer des CV</Button>
                <Button icon={<Search className="size-4" />}>Rechercher</Button>
                <Button variant="ghost">Annuler</Button>
                <Button variant="danger" icon={<Trash2 className="size-4" />}>Supprimer</Button>
                <Button variant="teal">Marquer comme relue</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" loading>Enregistrement</Button>
                <Button variant="primary" disabled>Désactivé</Button>
                <Button locked onClick={() => toast.forbidden('Action non autorisée', '« Supprimer des candidats » est réservé au rôle Administrateur RH.')}>Verrouillé (cliquez)</Button>
                <Button size="sm">Petit</Button>
                <Button size="lg" variant="primary">Grand</Button>
              </div>
            </div>
          </Demo>
          <Demo title="Champs & contrôles" note="Défaut · invalide · désactivé · sélection · interrupteur · case">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Poste visé" hint="Saisie libre ou suggestion"><Input placeholder="Pharmacien assurance qualité" /></Field>
              <Field label="E-mail" error="Adresse e-mail invalide"><Input defaultValue="amina.benali@" invalid /></Field>
              <Field label="Identifiant"><Input defaultValue="CAND-0001" disabled /></Field>
              <Field label="Ville"><Select defaultValue="Casablanca"><option>Casablanca</option><option>Rabat</option></Select></Field>
              <div className="flex items-center gap-3"><Toggle label="Démo" checked={tog} onChange={setTog} /><span className="text-sm text-ink-2">Interrupteur</span><Toggle label="Désactivé" checked={false} onChange={() => undefined} disabled /></div>
              <div className="flex items-center gap-3"><Checkbox label="Démo" checked={chk} onChange={setChk} /><span className="text-sm text-ink-2">Case à cocher</span><Checkbox label="Partielle" checked={false} indeterminate onChange={() => undefined} /></div>
            </div>
          </Demo>
          <Demo title="Badges de statut" note="Traitement · statut RH · confiance · critère · IA">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">{[...PIPELINE, 'error' as const].map((p) => <StatusBadge key={p} status={p} />)}</div>
              <div className="flex flex-wrap gap-2">{(['a_examiner', 'en_revue', 'retenu', 'en_attente', 'archive'] as ReviewStatus[]).map((r) => <ReviewBadge key={r} status={r} />)}</div>
              <div className="flex flex-wrap gap-2"><ConfidenceBadge value={0.92} /><ConfidenceBadge value={0.68} /><ConfidenceBadge value={0.41} /></div>
              <div className="flex flex-wrap gap-2"><CriterionBadge state="satisfied" /><CriterionBadge state="partial" /><CriterionBadge state="missing" /><AIBadge /></div>
              <div className="flex flex-wrap gap-4"><ProviderTag provider="local" name="Analyse locale" /><ProviderTag provider="openai" name="OpenAI" model="gpt-4o-mini" /><ProviderTag provider="gemini" name="Google Gemini" /><ProviderTag provider="anthropic" name="Anthropic Claude" model="claude-3-5-sonnet" /></div>
            </div>
          </Demo>
          <Demo title="Scores" note="≥ 75 vert · 50–74 bleu · < 50 orange (jamais rouge : un score faible n'est pas un rejet)">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreBadge score={86} /><ScoreBadge score={62} /><ScoreBadge score={38} /><ScoreBadge score={null} /><ScoreBadge score={74} size="md" />
              <ScoreRing score={86} size={72} /><ScoreRing score={58} size={72} /><ScoreRing score={31} size={72} />
            </div>
          </Demo>
          <Demo title="Carte métrique & progression">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard label="En attente de revue" value={14} tone="warn" icon={<Sparkles className="size-4" />} hint="Statut « À examiner »" />
              <MetricCard label="Chargement" value={0} icon={<Sparkles className="size-4" />} loading hint="…" />
              <div className="space-y-3 md:col-span-2"><Progress value={35} /><Progress value={70} tone="sea" /><Progress value={100} tone="ok" /><Progress value={55} tone="bad" /></div>
            </div>
          </Demo>
          <Demo title="Onglets, puces, modale & toasts">
            <div className="space-y-4">
              <Tabs value={tab} onChange={setTab} items={[{ id: 'a', label: 'Historique IA', count: 3 }, { id: 'b', label: "Journal d'audit", count: 12 }]} />
              <div className="flex flex-wrap gap-1.5"><Chip tone="brand" onRemove={() => undefined}>BPF / GMP</Chip><Chip tone="sea">Critère du poste</Chip><Chip tone="warn">Doublon</Chip><Chip>Casablanca</Chip></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => confirm({ title: 'Supprimer 3 dossiers ?', tone: 'danger', confirmLabel: 'Supprimer', requireText: 'SUPPRIMER', body: 'Démonstration de la modale de confirmation (aucune donnée modifiée).', onConfirm: () => new Promise((r) => setTimeout(r, 700)).then(() => toast.success('Démonstration terminée')) })}>Ouvrir la modale</Button>
                <Button size="sm" onClick={() => toast.success('Modifications enregistrées', 'Tracées dans le journal d\'audit')}>Toast succès</Button>
                <Button size="sm" onClick={() => toast.error("Échec de l'opération", 'Base de données verrouillée (SQLITE_BUSY).')}>Toast erreur</Button>
                <Button size="sm" onClick={() => toast.warning('Fournisseur IA non configuré', 'Clé API Google Gemini manquante.')}>Toast avertissement</Button>
                <Button size="sm" onClick={() => toast.info('2 fichiers ajoutés à la file')}>Toast info</Button>
              </div>
            </div>
          </Demo>
          <div className="xl:col-span-2"><Demo title="Zone de dépôt" note="Normal · survol de glisser (bordure brand-500, fond brand-50) · verrouillé"><div className="grid gap-4 md:grid-cols-2"><UploadDropZone compact onFiles={() => toast.info('Démonstration — utilisez l\'écran Importer des CV')} /><UploadDropZone compact locked onFiles={() => toast.forbidden('Action non autorisée')} /></div></Demo></div>
          <Card className="xl:col-span-2"><CardHeader title="États des contrôles" /><Spec head={['État', 'Traitement visuel']} rows={CONTROL_STATES} /></Card>
        </div>
      )}

      {sec === 'etats' && (
        <div className="space-y-6">
          <Card><CardHeader title="Catalogue des états" subtitle="Chaque état est reproductible dans le prototype" /><Spec head={['État', 'Écrans', 'Déclencheur', 'Interface']} rows={STATES.map((s) => [s.state, s.where, s.trigger, s.ui])} /></Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card><EmptyState compact title="La CVthèque est vide" actions={<Button variant="primary" size="sm">Importer des CV</Button>}>Importez des CV PDF ou DOCX pour commencer.</EmptyState></Card>
            <Card><NoResults actions={<Button size="sm">Retirer les filtres</Button>} /></Card>
            <Card><ErrorState compact message="Base de données verrouillée (SQLITE_BUSY)." onRetry={() => toast.info('Nouvelle tentative…')} /></Card>
            <Card><Forbidden compact action="supprimer des candidats" /></Card>
            <Card className="overflow-hidden"><TableSkeleton rows={4} cols={6} /></Card>
            <div className="space-y-3">
              <LowConfidenceBanner value={0.41} onEdit={() => undefined} />
              <MissingKeyBanner provider="Google Gemini" onConfigure={() => undefined} />
              <Banner tone="warn" title="Critères non conformes ignorés">« femme » — genre · « moins de 30 ans » — âge</Banner>
              <Banner tone="violet" icon={<Sparkles className="size-4" />} title="Recommandation IA — nécessite une revue RH">Aucun rejet ni aucune invitation automatique.</Banner>
              <div className="flex flex-wrap gap-2"><Badge tone="warn">Doublon exact</Badge><Badge tone="warn">Doublon probable</Badge><StatusBadge status="extracting" /><StatusBadge status="error" /></div>
            </div>
          </div>
        </div>
      )}

      {sec === 'interactions' && (
        <Card>
          <CardHeader title="Spécification des interactions" subtitle="Données, chargement, succès et erreur pour chaque élément interactif" actions={<Button size="sm" icon={<Download className="size-3.5" />} onClick={() => { const rows = [['Écran', 'Élément', 'Données', 'Chargement', 'Succès', 'Erreur'], ...INTERACTIONS.map((i) => [i.screen, i.element, i.data, i.loading, i.success, i.error])]; const b = new Blob(['\ufeff' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'interactions.csv'; a.click(); toast.success('Spécification exportée', 'interactions.csv') }}>CSV</Button>} />
          <Spec head={['Écran', 'Élément', 'Données', 'Chargement', 'Succès', 'Erreur']} rows={INTERACTIONS.map((i) => [i.screen, i.element, <span className="font-mono text-[12px]">{i.data}</span>, i.loading, i.success, i.error])} />
        </Card>
      )}

      {sec === 'donnees' && (
        <div className="space-y-6">
          <Card><CardHeader title="Schéma SQLite" subtitle="data/ats.sqlite" /><Spec head={['Table', 'Colonnes', 'Notes']} rows={SCHEMA.map((s) => [<span className="font-mono">{s.table}</span>, <span className="font-mono text-[12px]">{s.columns}</span>, s.notes])} /></Card>
          <Card><CardHeader title="Correspondance Streamlit" /><Spec head={['Composant', 'Implémentation']} rows={STREAMLIT} /></Card>
          <Card><CardHeader title="Contrat de prompt pour les fournisseurs IA" subtitle="Appliqué côté serveur — même structure que le moteur local" /><pre className="overflow-x-auto whitespace-pre-wrap p-5 font-mono text-[12px] leading-relaxed text-ink-2">{PROMPT_CONTRACT}</pre></Card>
          <p className="text-xs text-ink-3">Version Markdown : <span className="font-mono">docs/HANDOFF.md</span> (générée depuis <span className="font-mono">src/lib/handoff.ts</span>).</p>
        </div>
      )}
      {modal}
    </>
  )
}
