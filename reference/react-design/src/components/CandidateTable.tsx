import { ArrowDown, ArrowUp, ChevronsUpDown, Eye, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { fullName } from '../lib/db'
import { fmtDate, initials } from '../lib/format'
import type { Candidate } from '../lib/types'
import { ReviewBadge, ScoreBadge, StatusBadge } from './Badges'
import { Checkbox, cx } from './ui'

export type SortKey = 'name' | 'city' | 'role' | 'experience' | 'score' | 'date'
export interface SortState { key: SortKey; dir: 'asc' | 'desc' }

export function Avatar({ c, size = 'sm' }: { c: Pick<Candidate, 'firstName' | 'lastName' | 'id'>; size?: 'sm' | 'lg' }) {
  const hues = ['bg-brand-100 text-brand-800', 'bg-sea-100 text-sea-700', 'bg-violet-50 text-violet-600', 'bg-warn-50 text-warn-700', 'bg-canvas text-ink-2']
  const h = hues[(parseInt(c.id.slice(-2), 10) || 0) % hues.length]
  return <span className={cx('flex shrink-0 items-center justify-center rounded-full font-semibold', h, size === 'lg' ? 'size-12 text-base' : 'size-8 text-xs')} aria-hidden>{initials(c.firstName, c.lastName)}</span>
}

function Th({ children, sortKey, sort, onSort, className }: { children: ReactNode; sortKey?: SortKey; sort?: SortState; onSort?: (k: SortKey) => void; className?: string }) {
  const on = sortKey && sort?.key === sortKey
  return (
    <th scope="col" aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cx('h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3', className)}>
      {sortKey && onSort ? (
        <button onClick={() => onSort(sortKey)} className={cx('-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-line hover:text-ink', on && 'text-ink')}>
          {children}
          {on ? sort!.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
        </button>
      ) : children}
    </th>
  )
}

export default function CandidateTable({ rows, selected, onSelect, sort, onSort, actions, dense }: {
  rows: Candidate[]
  selected?: Set<string>
  onSelect?: (ids: string[], on: boolean) => void
  sort?: SortState
  onSort?: (k: SortKey) => void
  actions?: (c: Candidate) => ReactNode
  dense?: boolean
}) {
  const all = rows.length > 0 && rows.every((r) => selected?.has(r.id))
  const some = rows.some((r) => selected?.has(r.id))
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
        <thead className="bg-subtle">
          <tr className="[&>th]:border-b [&>th]:border-line">
            {onSelect && (
              <th className="sticky left-0 z-10 w-10 bg-subtle pl-4 pr-1">
                <Checkbox label="Tout sélectionner" checked={all} indeterminate={some && !all} onChange={(v) => onSelect(rows.map((r) => r.id), v)} />
              </th>
            )}
            <Th sortKey="name" sort={sort} onSort={onSort} className={cx('sticky z-10 bg-subtle', onSelect ? 'left-10' : 'left-0 pl-4')}>Candidat</Th>
            <Th sortKey="city" sort={sort} onSort={onSort}>Ville</Th>
            <Th sortKey="role" sort={sort} onSort={onSort}>Poste visé</Th>
            <Th sortKey="experience" sort={sort} onSort={onSort} className="text-right">Exp.</Th>
            <Th className="hidden xl:table-cell">Compétences</Th>
            <Th sortKey="score" sort={sort} onSort={onSort}>Score</Th>
            <Th>Traitement</Th>
            <Th className="hidden 2xl:table-cell">Statut RH</Th>
            <Th sortKey="date" sort={sort} onSort={onSort} className="hidden lg:table-cell">Reçu le</Th>
            {actions && <Th className="pr-4 text-right"><span className="sr-only">Actions</span></Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const sel = selected?.has(c.id)
            return (
              <tr key={c.id} className={cx('group [&>td]:border-b [&>td]:border-line', sel ? 'bg-brand-50/60' : 'bg-white hover:bg-subtle')}>
                {onSelect && (
                  <td className={cx('sticky left-0 z-[1] pl-4 pr-1', sel ? 'bg-brand-50' : 'bg-white group-hover:bg-subtle')}>
                    <Checkbox label={`Sélectionner ${fullName(c)}`} checked={!!sel} onChange={(v) => onSelect([c.id], v)} />
                  </td>
                )}
                <td className={cx('sticky z-[1] px-3', dense ? 'py-2' : 'py-2.5', onSelect ? 'left-10' : 'left-0 pl-4', sel ? 'bg-brand-50' : 'bg-white group-hover:bg-subtle')}>
                  <a href={`#/candidats/${c.id}`} className="flex min-w-0 items-center gap-3">
                    <Avatar c={c} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium text-ink group-hover:text-brand-700">
                        <span className="truncate">{fullName(c)}</span>
                        {c.processing !== 'error' && c.confidence < 0.6 && c.processing === 'ready' && <TriangleAlert className="size-3.5 shrink-0 text-bad-600" aria-label="Extraction à faible confiance" />}
                      </span>
                      <span className="block max-w-52 truncate text-xs text-ink-3">{c.email || <em className="not-italic text-ink-4">E-mail non détecté</em>}</span>
                    </span>
                  </a>
                </td>
                <td className="whitespace-nowrap px-3 text-ink-2">{c.city || <span className="text-ink-4">—</span>}</td>
                <td className="max-w-48 px-3"><span className="line-clamp-2 text-ink-2">{c.targetRole || <span className="text-ink-4">Non précisé</span>}</span></td>
                <td className="whitespace-nowrap px-3 text-right text-ink-2 tabular">{c.experienceYears === null ? <span className="text-ink-4">—</span> : `${c.experienceYears} ans`}</td>
                <td className="hidden px-3 xl:table-cell">
                  <div className="flex max-w-64 flex-wrap gap-1">
                    {c.skills.slice(0, 2).map((s) => <span key={s} className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{s}</span>)}
                    {c.skills.length > 2 && <span className="px-1 py-0.5 text-[11px] text-ink-3">+{c.skills.length - 2}</span>}
                  </div>
                </td>
                <td className="px-3"><ScoreBadge score={c.score} /></td>
                <td className="px-3"><span title={c.processingError}><StatusBadge status={c.processing} /></span></td>
                <td className="hidden px-3 2xl:table-cell"><ReviewBadge status={c.review} /></td>
                <td className="hidden whitespace-nowrap px-3 text-ink-3 tabular lg:table-cell">{fmtDate(c.createdAt)}</td>
                {actions && (
                  <td className="whitespace-nowrap pr-3 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <a href={`#/candidats/${c.id}`} title="Voir le profil" aria-label={`Voir le profil de ${fullName(c)}`} className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-canvas hover:text-ink"><Eye className="size-4" /></a>
                      {actions(c)}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
