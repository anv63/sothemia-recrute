import { ChevronRight, Database, FileUp, LayoutDashboard, Palette, Search, Settings, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ROLE_LABEL, api, useDb } from '../lib/db'
import { initials } from '../lib/format'
import { navigate, useRoute } from '../lib/router'
import { useQueue } from '../lib/pipeline'
import type { Role } from '../lib/types'
import { cx } from './ui'

const NAV = [
  { to: '/', match: '', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/cvtheque', match: 'cvtheque', label: 'CVthèque', icon: Users, alt: ['candidats'] },
  { to: '/import', match: 'import', label: 'Importer des CV', icon: FileUp },
  { to: '/recherche', match: 'recherche', label: 'Recherche', icon: Search },
  { to: '/criteres', match: 'criteres', label: 'Critères de poste', icon: SlidersHorizontal },
  { to: '/analyses', match: 'analyses', label: 'Analyses IA', icon: Sparkles },
  { to: '/parametres', match: 'parametres', label: 'Paramètres', icon: Settings },
]

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-brand-100 lg:w-[132px] lg:rounded-md">
        <img src="/sothema-logo.png" alt="" className="h-full w-full object-contain p-1 lg:p-1.5" />
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 text-[10px] font-bold text-sothema-red">✦</span>
      </div>
      {!compact && (
        <div className="hidden leading-tight lg:block">
          <p className="text-[14px] font-semibold tracking-tight text-ink">Sothema</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-brand-700">HR Intelligence</p>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { parts } = useRoute()
  const s = useDb()
  const queue = useQueue()
  const active = parts[0] ?? ''
  const processing = s.candidates.filter((c) => ['received', 'extracting', 'analyzing', 'indexed'].includes(c.processing)).length
  const toReview = s.candidates.filter((c) => c.processing === 'ready' && c.review === 'a_examiner').length
  const failing = s.settings.simulateFailures
  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-line bg-white lg:w-60">
      <div className="relative flex h-14 items-center border-b border-line px-4"><Logo /><span className="brand-stripe absolute inset-x-0 bottom-0 h-[2px]" /></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 lg:px-3" aria-label="Navigation principale">
        {NAV.map((n) => {
          const on = active === n.match || (n.alt?.includes(active) ?? false)
          const badge = n.match === 'cvtheque' ? toReview : n.match === 'import' ? queue.filter((q) => !['ready', 'invalid', 'skipped', 'error'].includes(q.stage)).length || undefined : undefined
          return (
            <a
              key={n.to}
              href={`#${n.to}`}
              title={n.label}
              aria-current={on ? 'page' : undefined}
              className={cx(
                'group relative flex h-9 items-center justify-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors lg:justify-start',
                on ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-canvas hover:text-ink',
              )}
            >
              {on && <span className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand-600 lg:-left-3" />}
              <n.icon className={cx('size-[18px] shrink-0', on ? 'text-brand-600' : 'text-ink-3 group-hover:text-ink-2')} />
              <span className="hidden flex-1 truncate lg:inline">{n.label}</span>
              {!!badge && (
                <span className={cx('absolute right-1 top-1 rounded-full px-1.5 text-[10px] font-semibold tabular lg:static lg:text-[11px]', on ? 'bg-brand-600 text-white' : 'bg-canvas text-ink-2 ring-1 ring-line')}>{badge}</span>
              )}
            </a>
          )
        })}
        <div className="my-3 border-t border-line" />
        <a href="#/design" title="Système de design & handoff" aria-current={active === 'design' ? 'page' : undefined} className={cx('flex h-9 items-center justify-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors lg:justify-start', active === 'design' ? 'bg-sea-50 text-sea-700' : 'text-ink-3 hover:bg-canvas hover:text-ink')}>
          <Palette className="size-[18px] shrink-0" />
          <span className="hidden lg:inline">Design & handoff</span>
        </a>
      </nav>
      <a href="#/parametres?tab=local" className="m-2 flex items-center justify-center gap-2.5 rounded-md border border-line bg-subtle p-2.5 text-xs hover:border-line-strong lg:m-3 lg:justify-start" title="État de la base locale">
        <span className="relative flex size-2 shrink-0">
          <span className={cx('absolute inline-flex size-full rounded-full opacity-60', failing ? 'bg-bad-600 animate-ping' : processing ? 'bg-brand-500 animate-ping' : '')} />
          <span className={cx('relative inline-flex size-2 rounded-full', failing ? 'bg-bad-600' : 'bg-ok-600')} />
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="flex items-center gap-1 font-medium text-ink"><Database className="size-3 text-ink-3" /> SQLite local</span>
          <span className="block truncate text-ink-3">{failing ? 'Base verrouillée (diagnostic)' : processing ? `${processing} CV en traitement` : `${s.candidates.length} dossiers · à jour`}</span>
        </span>
      </a>
    </aside>
  )
}

export function TopBar() {
  const s = useDb()
  const [q, setQ] = useState('')
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur md:px-6"><span className="brand-stripe absolute inset-x-0 top-0 h-[2px]" />
      <form
        className="relative max-w-xl flex-1"
        role="search"
        onSubmit={(e) => { e.preventDefault(); if (q.trim()) { navigate(`/recherche?q=${encodeURIComponent(q.trim())}`); setQ('') } }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Décrire un profil recherché… ex. pharmacien BPF 5 ans Casablanca"
          aria-label="Recherche en langage naturel"
          className="h-9 w-full rounded-md border border-line bg-subtle pl-9 pr-16 text-sm text-ink outline-none placeholder:text-ink-4 hover:border-line-strong focus:border-brand-500 focus:bg-white focus:ring-3 focus:ring-brand-100"
        />
        <span className="absolute right-2 top-1/2 hidden -translate-y-1/2 text-[11px] text-ink-4 md:block">Entrée ↵</span>
      </form>
      <div className="ml-auto flex items-center gap-3">
        <label className="hidden items-center gap-2 text-xs text-ink-3 md:flex" title="Rôle de démonstration — en production, le rôle provient de la session authentifiée">
          <span>Rôle</span>
          <select
            value={s.settings.role}
            onChange={(e) => api.setRole(e.target.value as Role)}
            className="h-8 rounded-md border border-line-strong bg-white px-2 text-[13px] font-medium text-ink outline-none hover:border-ink-4 focus:border-brand-500"
          >
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2.5 border-l border-line pl-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-sea-600 text-xs font-semibold text-white">{initials(...(s.settings.userName.split(' ') as [string, string]))}</span>
          <div className="hidden leading-tight xl:block">
            <p className="text-[13px] font-medium text-ink">{s.settings.userName}</p>
            <p className="text-[11px] text-ink-3">{ROLE_LABEL[s.settings.role]}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export function PageHeader({ title, subtitle, crumbs, actions }: { title: ReactNode; subtitle?: ReactNode; crumbs?: { label: string; to?: string }[]; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Fil d'Ariane" className="mb-1.5 flex items-center gap-1 text-[13px] text-ink-3">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5 text-ink-4" />}
                {c.to ? <a href={`#${c.to}`} className="hover:text-brand-700 hover:underline">{c.label}</a> : <span className="text-ink-2">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
