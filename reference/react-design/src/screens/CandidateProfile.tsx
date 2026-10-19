import { Award, Briefcase, Download, FileText, GraduationCap, History, Languages, Mail, MapPin, Pencil, Phone, Plane, Plus, RefreshCw, Save, Sparkles, StickyNote, Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import AICard from '../components/AICard'
import { ConfidenceBadge, StatusBadge } from '../components/Badges'
import { Avatar } from '../components/CandidateTable'
import CvPreview from '../components/CvPreview'
import { PageHeader } from '../components/Layout'
import Menu from '../components/Menu'
import { useConfirm } from '../components/Modal'
import ProfileSection, { KV } from '../components/ProfileSection'
import { Banner, DetailSkeleton, EmptyState, ErrorState, LowConfidenceBanner } from '../components/States'
import { Button, Card, Chip, Field, IconButton, Input, Select, Tabs, Textarea, cx } from '../components/ui'
import { api, can, fullName, providerName, useDb } from '../lib/db'
import { downloadBlob, files } from '../lib/files'
import { REVIEW_LABEL, fmtDateTime, fmtSize, plural } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import { CITIES, DEPARTMENTS, LANGUAGES, ROLES, SKILLS } from '../lib/lexicon'
import { retryProcessing } from '../lib/pipeline'
import { navigate } from '../lib/router'
import { toast } from '../lib/toast'
import type { Candidate, ReviewStatus } from '../lib/types'

type Draft = Pick<Candidate, 'firstName' | 'lastName' | 'email' | 'phone' | 'city' | 'targetRole' | 'department' | 'experienceYears' | 'mobility' | 'summary' | 'skills' | 'languages' | 'education' | 'experience' | 'certifications'>
const LEVELS = ['Langue maternelle', 'Courant', 'Professionnel', 'Notions', 'Non précisé']

const toDraft = (c: Candidate): Draft => structuredClone({
  firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, city: c.city, targetRole: c.targetRole, department: c.department,
  experienceYears: c.experienceYears, mobility: c.mobility, summary: c.summary, skills: c.skills, languages: c.languages, education: c.education,
  experience: c.experience, certifications: c.certifications,
})

function validate(d: Draft) {
  const e: Partial<Record<keyof Draft, string>> = {}
  if (!d.firstName.trim() && !d.lastName.trim()) e.firstName = 'Nom ou prénom requis'
  if (d.email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(d.email)) e.email = 'Adresse e-mail invalide'
  if (d.phone && !/^\+?[\d\s.-]{8,}$/.test(d.phone)) e.phone = 'Numéro invalide'
  if (d.experienceYears !== null && (d.experienceYears < 0 || d.experienceYears > 50)) e.experienceYears = 'Entre 0 et 50 ans'
  return e
}

function TagEditor({ values, onChange, options, placeholder }: { values: string[]; onChange: (v: string[]) => void; options?: string[]; placeholder: string }) {
  const [v, setV] = useState('')
  const add = () => { const t = v.trim(); if (t && !values.includes(t)) onChange([...values, t]); setV('') }
  const listId = useMemo(() => `dl-${Math.random().toString(36).slice(2, 7)}`, [])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">{values.map((s) => <Chip key={s} tone="brand" onRemove={() => onChange(values.filter((x) => x !== s))}>{s}</Chip>)}</div>
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder={placeholder} list={options ? listId : undefined} className="h-8" />
        {options && <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>}
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={add} disabled={!v.trim()}>Ajouter</Button>
      </div>
    </div>
  )
}

export default function CandidateProfile({ id }: { id: string }) {
  const s = useDb()
  const res = useResource(`cand-${id}`)
  const { pending, run } = useAction()
  const { confirm, modal } = useConfirm()
  const c = s.candidates.find((x) => x.id === id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [tried, setTried] = useState(false)
  const [notes, setNotes] = useState(c?.notes ?? '')
  const [tab, setTab] = useState<'analyses' | 'audit'>('analyses')
  const [preview, setPreview] = useState<'auto' | 'text'>('auto')
  useEffect(() => { if (c && !editing) setNotes(c.notes) }, [c?.notes]) // eslint-disable-line react-hooks/exhaustive-deps

  if (res.status === 'loading') return <DetailSkeleton />
  if (res.status === 'error') return <Card><ErrorState message={res.error} onRetry={res.retry} /></Card>
  if (!c) return <Card><EmptyState title="Dossier introuvable" actions={<Button onClick={() => navigate('/cvtheque')}>Retour à la CVthèque</Button>}>Le candidat {id} n'existe pas ou a été supprimé.</EmptyState></Card>

  const role = s.settings.role
  const analyses = s.analyses.filter((a) => a.candidateId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const audit = s.audit.filter((a) => a.entityId?.split(', ').includes(id))
  const fc = c.fieldConfidence
  const d = draft ?? toDraft(c)
  const errors = tried ? validate(d) : {}
  const dirty = editing && JSON.stringify(d) !== JSON.stringify(toDraft(c))
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...d, [k]: v })
  const processing = ['received', 'extracting', 'analyzing', 'indexed'].includes(c.processing)

  const startEdit = () => {
    if (!can('edit', role)) return toast.forbidden('Action non autorisée', `La modification des champs extraits est réservée aux recruteurs et administrateurs.`)
    setDraft(toDraft(c)); setEditing(true); setTried(false)
  }
  const cancel = () => { setEditing(false); setDraft(null); setTried(false) }
  const save = async () => {
    setTried(true)
    if (Object.keys(validate(d)).length) return toast.error('Formulaire incomplet', 'Corrigez les champs signalés avant d\'enregistrer.')
    const ok = await run('save', () => api.updateCandidate(id, d).then(() => true), 'Modifications enregistrées et tracées dans l\'audit')
    if (ok) cancel()
  }
  const download = async () => {
    const blob = c.file.stored ? await files.get(id) : undefined
    if (blob) { downloadBlob(blob, c.file.name); return toast.success('Téléchargement lancé', c.file.name) }
    if (!c.cvText) return toast.error('Fichier introuvable', 'Ni l\'original ni un texte extrait ne sont disponibles localement.')
    downloadBlob(new Blob([c.cvText], { type: 'text/plain;charset=utf-8' }), c.file.name.replace(/\.\w+$/, '_texte-extrait.txt'))
    toast.info('Original non présent dans ce poste', 'Le texte extrait a été téléchargé à la place.')
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'CVthèque', to: '/cvtheque' }, { label: fullName(c) }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar c={c} size="lg" />
            <span>{fullName(c)}</span>
            <span className="flex flex-wrap gap-1.5 text-sm font-normal"><StatusBadge status={c.processing} />{c.processing === 'ready' && <ConfidenceBadge value={c.confidence} />}</span>
          </span>
        }
        subtitle={<span className="ml-[60px] block">{c.targetRole || 'Poste non précisé'} · <span className="font-mono text-xs">{c.id}</span></span>}
        actions={
          editing ? (
            <>
              {dirty && <span className="text-[13px] font-medium text-warn-700">Modifications non enregistrées</span>}
              <Button variant="ghost" onClick={cancel} disabled={pending === 'save'}>Annuler</Button>
              <Button variant="primary" icon={<Save className="size-4" />} loading={pending === 'save'} onClick={save}>Enregistrer</Button>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-[13px] text-ink-3">
                Statut RH
                <Select aria-label="Statut RH" value={c.review} disabled={pending === 'review'} onChange={(e) => run('review', () => api.setReview([id], e.target.value as ReviewStatus, REVIEW_LABEL[e.target.value as ReviewStatus]), 'Statut RH mis à jour')} className="h-9 w-44 font-medium">
                  {(Object.keys(REVIEW_LABEL) as ReviewStatus[]).map((r) => <option key={r} value={r}>{REVIEW_LABEL[r]}</option>)}
                </Select>
              </label>
              <Button icon={<Sparkles className="size-4 text-violet-600" />} onClick={() => navigate(`/analyses/${id}`)}>Analyse IA</Button>
              <Button variant="primary" icon={<Pencil className="size-4" />} locked={!can('edit', role)} onClick={startEdit} disabled={processing}>Modifier les champs</Button>
              <Menu items={[
                { label: "Télécharger l'original", icon: <Download />, onSelect: download },
                { label: 'Relancer le traitement', icon: <RefreshCw />, locked: !can('upload', role), onSelect: () => run('retry', () => retryProcessing(id), 'Traitement relancé') },
                { label: 'Supprimer le dossier', icon: <Trash2 />, danger: true, divider: true, locked: !can('delete', role), onSelect: () => confirm({ title: 'Supprimer ce dossier ?', tone: 'danger', confirmLabel: 'Supprimer', body: <>Le dossier de <b>{fullName(c)}</b>, son fichier original et ses {plural(analyses.length, 'analyse')} seront supprimés. Action tracée et irréversible.</>, onConfirm: async () => { const ok = await run('del', () => api.deleteCandidates([id]).then(() => true), 'Dossier supprimé'); if (ok) navigate('/cvtheque') } }) },
              ]} />
            </>
          )
        }
      />

      <div className="mb-6 space-y-3">
        {c.processing === 'error' && (
          <Banner tone="bad" title="Échec du traitement" actions={<Button size="sm" icon={<RefreshCw className="size-3.5" />} loading={pending === 'retry'} locked={!can('upload', role)} onClick={() => run('retry', () => retryProcessing(id), 'Traitement relancé')}>Relancer</Button>}>
            {c.processingError} Vous pouvez relancer le traitement ou saisir les informations manuellement.
          </Banner>
        )}
        {processing && <Banner tone="brand" title="Traitement en cours">Les champs sont en cours d'extraction et d'analyse. La page se met à jour automatiquement.</Banner>}
        {c.processing === 'ready' && c.confidence < 0.6 && !editing && <LowConfidenceBanner value={c.confidence} onEdit={startEdit} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left: original CV + metadata */}
        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              <FileText className="size-4 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={c.file.name}>{c.file.name}</span>
              {c.file.stored && c.file.type === 'pdf' && (
                <div className="flex rounded-md border border-line p-0.5 text-xs">
                  {(['auto', 'text'] as const).map((m) => <button key={m} onClick={() => setPreview(m)} className={cx('rounded px-2 py-1 font-medium', preview === m ? 'bg-canvas text-ink' : 'text-ink-3 hover:text-ink')}>{m === 'auto' ? 'Original' : 'Texte extrait'}</button>)}
                </div>
              )}
              <Button size="sm" icon={<Download className="size-3.5" />} onClick={download}>Télécharger</Button>
            </div>
            <div className="max-h-[780px] overflow-y-auto scrollbar-thin"><CvPreview c={c} mode={preview} /></div>
          </Card>
          <Card>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
              <KV label="Identifiant"><span className="font-mono text-xs">{c.id}</span></KV>
              <KV label="Format">{c.file.type.toUpperCase()} · {plural(c.file.pages, 'page')}</KV>
              <KV label="Taille">{fmtSize(c.file.sizeKb)}</KV>
              <KV label="Stockage">{c.file.stored ? 'Original local' : 'Texte extrait uniquement'}</KV>
              <KV label="Reçu le">{fmtDateTime(c.createdAt)}</KV>
              <KV label="Modifié le">{fmtDateTime(c.updatedAt)}</KV>
              <div className="col-span-2"><KV label="Empreinte SHA-256"><span className="font-mono text-[11px] text-ink-3" title={c.file.hash}>{c.file.hash.slice(0, 32)}{c.file.hash.length > 32 ? '…' : ''}</span></KV></div>
            </dl>
          </Card>
        </div>

        {/* Right: extracted profile */}
        <div className="space-y-6">
          <Card className={cx(editing && 'ring-2 ring-brand-200')}>
            {editing && <div className="rounded-t-lg border-b border-brand-100 bg-brand-50 px-5 py-2 text-[13px] font-medium text-brand-800">Mode édition — les champs corrigés seront marqués « validés manuellement ».</div>}
            <ProfileSection title="Identité & contact" icon={<UserRound />} confidence={fc.name} onEdit={!editing ? startEdit : undefined} editLocked={!can('edit', role)}>
              {editing ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Prénom" error={errors.firstName}><Input value={d.firstName} onChange={(e) => set('firstName', e.target.value)} invalid={!!errors.firstName} /></Field>
                  <Field label="Nom"><Input value={d.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
                  <Field label="E-mail" error={errors.email}><Input type="email" value={d.email} onChange={(e) => set('email', e.target.value)} invalid={!!errors.email} /></Field>
                  <Field label="Téléphone" error={errors.phone}><Input value={d.phone} onChange={(e) => set('phone', e.target.value)} invalid={!!errors.phone} placeholder="+212 6 …" /></Field>
                  <Field label="Ville">
                    <Input value={d.city} onChange={(e) => set('city', e.target.value)} list="dl-cities" />
                    <datalist id="dl-cities">{CITIES.map((x) => <option key={x.name} value={x.name} />)}</datalist>
                  </Field>
                </div>
              ) : (
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <KV label="Nom complet" confidence={fc.name}>{fullName(c)}</KV>
                  <KV label="Ville" confidence={fc.city}>{c.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-ink-3" />{c.city}</span>}</KV>
                  <KV label="E-mail" confidence={fc.email}>{c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Mail className="size-3.5" />{c.email}</a>}</KV>
                  <KV label="Téléphone" confidence={fc.phone}>{c.phone && <span className="inline-flex items-center gap-1 tabular"><Phone className="size-3.5 text-ink-3" />{c.phone}</span>}</KV>
                </dl>
              )}
            </ProfileSection>

            <ProfileSection title="Poste & mobilité" icon={<Plane />} confidence={fc.targetRole}>
              {editing ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Poste visé">
                    <Input value={d.targetRole} onChange={(e) => { const r = ROLES.find((x) => x.name === e.target.value); setDraft({ ...d, targetRole: e.target.value, department: r?.department ?? d.department }) }} list="dl-roles" />
                    <datalist id="dl-roles">{ROLES.map((x) => <option key={x.name} value={x.name} />)}</datalist>
                  </Field>
                  <Field label="Département">
                    <Select value={d.department} onChange={(e) => set('department', e.target.value)}><option value="">Non déterminé</option>{DEPARTMENTS.map((x) => <option key={x}>{x}</option>)}</Select>
                  </Field>
                  <Field label="Années d'expérience" error={errors.experienceYears}><Input type="number" min={0} max={50} value={d.experienceYears ?? ''} onChange={(e) => set('experienceYears', e.target.value === '' ? null : +e.target.value)} invalid={!!errors.experienceYears} /></Field>
                  <Field label="Mobilité"><Input value={d.mobility} onChange={(e) => set('mobility', e.target.value)} placeholder="Nationale, régionale, ville…" /></Field>
                </div>
              ) : (
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KV label="Poste visé" confidence={fc.targetRole}>{c.targetRole}</KV>
                  <KV label="Département">{c.department}</KV>
                  <KV label="Expérience" confidence={fc.experienceYears}>{c.experienceYears !== null && `${c.experienceYears} ans`}</KV>
                  <KV label="Mobilité" confidence={fc.mobility}>{c.mobility}</KV>
                </dl>
              )}
            </ProfileSection>

            <ProfileSection title="Résumé" icon={<FileText />} confidence={fc.summary}>
              {editing ? <Textarea rows={3} value={d.summary} onChange={(e) => set('summary', e.target.value)} /> : c.summary ? <p className="leading-relaxed">{c.summary}</p> : <p className="text-ink-4">Aucun résumé détecté.</p>}
            </ProfileSection>

            <ProfileSection title="Expérience professionnelle" icon={<Briefcase />} confidence={fc.experienceYears}>
              {editing ? (
                <div className="space-y-3">
                  {d.experience.map((x, i) => (
                    <div key={i} className="grid gap-2 rounded-md border border-line bg-subtle p-3 md:grid-cols-[1fr_1fr_90px_90px_32px]">
                      <Input aria-label="Intitulé" placeholder="Intitulé" value={x.title} onChange={(e) => set('experience', d.experience.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} className="h-8" />
                      <Input aria-label="Entreprise" placeholder="Entreprise" value={x.company} onChange={(e) => set('experience', d.experience.map((y, j) => (j === i ? { ...y, company: e.target.value } : y)))} className="h-8" />
                      <Input aria-label="Début" placeholder="Début" value={x.start} onChange={(e) => set('experience', d.experience.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)))} className="h-8" />
                      <Input aria-label="Fin" placeholder="Fin" value={x.end} onChange={(e) => set('experience', d.experience.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)))} className="h-8" />
                      <IconButton label="Retirer" onClick={() => set('experience', d.experience.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
                      <Textarea aria-label="Description" rows={2} placeholder="Missions" value={x.description} onChange={(e) => set('experience', d.experience.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} className="md:col-span-4" />
                    </div>
                  ))}
                  <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set('experience', [{ title: '', company: '', start: '', end: 'Présent', description: '' }, ...d.experience])}>Ajouter une expérience</Button>
                </div>
              ) : c.experience.length ? (
                <ol className="relative space-y-4 border-l border-line pl-5">
                  {c.experience.map((x, i) => (
                    <li key={i} className="relative">
                      <span className={cx('absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-white', i === 0 ? 'bg-brand-600' : 'bg-line-strong')} />
                      <p className="font-medium text-ink">{x.title}</p>
                      <p className="text-[13px] text-ink-3">{x.company}{x.company && ' · '}<span className="tabular">{x.start} – {x.end}</span></p>
                      {x.description ? <p className="mt-1 leading-relaxed">{x.description}</p> : <p className="mt-1 text-[13px] text-ink-4">Missions non détaillées</p>}
                    </li>
                  ))}
                </ol>
              ) : <p className="text-ink-4">Aucune expérience détectée.</p>}
            </ProfileSection>

            <ProfileSection title="Formation" icon={<GraduationCap />} confidence={fc.education}>
              {editing ? (
                <div className="space-y-2">
                  {d.education.map((x, i) => (
                    <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_80px_32px]">
                      <Input aria-label="Diplôme" placeholder="Diplôme" value={x.degree} onChange={(e) => set('education', d.education.map((y, j) => (j === i ? { ...y, degree: e.target.value } : y)))} className="h-8" />
                      <Input aria-label="Établissement" placeholder="Établissement" value={x.school} onChange={(e) => set('education', d.education.map((y, j) => (j === i ? { ...y, school: e.target.value } : y)))} className="h-8" />
                      <Input aria-label="Année" placeholder="Année" value={x.year} onChange={(e) => set('education', d.education.map((y, j) => (j === i ? { ...y, year: e.target.value } : y)))} className="h-8" />
                      <IconButton label="Retirer" onClick={() => set('education', d.education.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
                    </div>
                  ))}
                  <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set('education', [...d.education, { degree: '', school: '', year: '' }])}>Ajouter une formation</Button>
                </div>
              ) : c.education.length ? (
                <ul className="space-y-2">{c.education.map((x, i) => <li key={i}><p className="font-medium text-ink">{x.degree}</p><p className="text-[13px] text-ink-3">{x.school}{x.year && ` · ${x.year}`}</p></li>)}</ul>
              ) : <p className="text-ink-4">Aucune formation détectée.</p>}
            </ProfileSection>

            <div className="grid md:grid-cols-2">
              <ProfileSection title="Compétences" icon={<Award />} confidence={fc.skills} className="md:border-r">
                {editing ? <TagEditor values={d.skills} onChange={(v) => set('skills', v)} options={SKILLS.map((x) => x.name)} placeholder="Ajouter une compétence" /> : c.skills.length ? (
                  <div className="flex flex-wrap gap-1.5">{c.skills.map((x) => <span key={x} className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800">{x}</span>)}</div>
                ) : <p className="text-ink-4">Aucune compétence détectée.</p>}
              </ProfileSection>
              <ProfileSection title="Langues" icon={<Languages />} confidence={fc.languages}>
                {editing ? (
                  <div className="space-y-2">
                    {d.languages.map((x, i) => (
                      <div key={i} className="flex gap-2">
                        <Select aria-label="Langue" value={x.name} onChange={(e) => set('languages', d.languages.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} className="h-8">{LANGUAGES.map((l) => <option key={l.name}>{l.name}</option>)}</Select>
                        <Select aria-label="Niveau" value={x.level} onChange={(e) => set('languages', d.languages.map((y, j) => (j === i ? { ...y, level: e.target.value } : y)))} className="h-8">{LEVELS.map((l) => <option key={l}>{l}</option>)}</Select>
                        <IconButton label="Retirer" onClick={() => set('languages', d.languages.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
                      </div>
                    ))}
                    <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set('languages', [...d.languages, { name: 'Anglais', level: 'Professionnel' }])}>Ajouter</Button>
                  </div>
                ) : c.languages.length ? (
                  <ul className="space-y-1">{c.languages.map((l) => <li key={l.name} className="flex justify-between gap-2"><span className="text-ink">{l.name}</span><span className="text-ink-3">{l.level}</span></li>)}</ul>
                ) : <p className="text-ink-4">Non détectées.</p>}
              </ProfileSection>
            </div>

            <ProfileSection title="Certifications" icon={<Award />} confidence={fc.certifications}>
              {editing ? <TagEditor values={d.certifications} onChange={(v) => set('certifications', v)} placeholder="Ajouter une certification" /> : c.certifications.length ? (
                <div className="flex flex-wrap gap-1.5">{c.certifications.map((x) => <span key={x} className="rounded-md border border-sea-100 bg-sea-50 px-2 py-1 text-xs font-medium text-sea-700">{x}</span>)}</div>
              ) : <p className="text-ink-4">Aucune certification mentionnée.</p>}
            </ProfileSection>
          </Card>

          <Card>
            <ProfileSection title="Notes RH" icon={<StickyNote />} aside={<span className="text-xs text-ink-4">Internes · non partagées avec le candidat</span>}>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations factuelles, éléments à vérifier en entretien…" maxLength={4000} />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-ink-4 tabular">{notes.length}/4000</span>
                <div className="flex gap-2">
                  {notes !== c.notes && <Button size="sm" variant="ghost" onClick={() => setNotes(c.notes)}>Annuler</Button>}
                  <Button size="sm" variant="primary" icon={<Save className="size-3.5" />} disabled={notes === c.notes} loading={pending === 'notes'} locked={!can('notes', role)} onClick={() => run('notes', () => api.saveNotes(id, notes), 'Note enregistrée')}>Enregistrer la note</Button>
                </div>
              </div>
            </ProfileSection>
          </Card>

          <Card>
            <div className="px-5 pt-2"><Tabs value={tab} onChange={setTab} items={[{ id: 'analyses', label: 'Historique des analyses IA', count: analyses.length, icon: <Sparkles className="size-4" /> }, { id: 'audit', label: "Journal d'audit", count: audit.length, icon: <History className="size-4" /> }]} /></div>
            <div className="p-5">
              {tab === 'analyses' ? (
                analyses.length ? (
                  <div className="space-y-3">{analyses.map((a) => <AICard key={a.id} analysis={a} compact href={`#/analyses/${id}?a=${a.id}`} offerTitle={s.offers.find((o) => o.id === a.offerId)?.title} />)}</div>
                ) : (
                  <EmptyState compact title="Aucune analyse" icon={<Sparkles className="size-5" />} actions={<Button onClick={() => navigate(`/analyses/${id}`)}>Lancer une analyse</Button>}>Ce dossier n'a pas encore été analysé.</EmptyState>
                )
              ) : audit.length ? (
                <ol className="space-y-3">
                  {audit.map((a) => (
                    <li key={a.id} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-sm">
                      <span className="text-xs text-ink-3 tabular">{fmtDateTime(a.at)}</span>
                      <div><p className="font-medium text-ink">{a.action}</p><p className="text-[13px] text-ink-3">{a.actor} · {a.details}</p></div>
                    </li>
                  ))}
                </ol>
              ) : <p className="py-6 text-center text-sm text-ink-3">Aucune entrée d'audit pour ce dossier.</p>}
            </div>
          </Card>
          <p className="text-xs text-ink-4">Dernière analyse : {analyses[0] ? `${providerName(analyses[0].provider)} · ${fmtDateTime(analyses[0].createdAt)}` : '—'}</p>
        </div>
      </div>
      {modal}
    </>
  )
}
