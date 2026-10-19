import { ChevronDown, ExternalLink, MapPin, Quote, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { fullName } from '../lib/db'
import type { MatchResult } from '../lib/search'
import { CriterionBadge, ScoreRing } from './Badges'
import { Avatar } from './CandidateTable'
import { cx } from './ui'

export default function MatchingCard({ result, rank }: { result: MatchResult; rank: number }) {
  const [open, setOpen] = useState(rank <= 1)
  const { candidate: c, score, results } = result
  const count = (s: string) => results.filter((r) => r.state === s).length
  return (
    <article className="rounded-lg border border-line bg-white shadow-card transition-colors hover:border-line-strong">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <span className="w-6 text-center text-sm font-semibold text-ink-4 tabular">#{rank}</span>
        <Avatar c={c} />
        <div className="min-w-0 flex-1">
          <a href={`#/candidats/${c.id}`} className="font-semibold text-ink hover:text-brand-700 hover:underline">{fullName(c)}</a>
          <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-ink-3">
            <span>{c.targetRole || 'Poste non précisé'}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{c.city || '—'}</span>
            <span className="tabular">{c.experienceYears ?? '—'} ans</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs tabular">
          <span className="text-ok-700"><b className="font-semibold">{count('satisfied')}</b> satisfaits</span>
          <span className="text-warn-700"><b className="font-semibold">{count('partial')}</b> partiels</span>
          <span className="text-ink-3"><b className="font-semibold">{count('missing')}</b> manquants</span>
        </div>
        <ScoreRing score={score} size={58} label="" />
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-ink-2 hover:bg-canvas">
          Détail <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <div className="border-t border-line">
          <ul className="divide-y divide-line">
            {results.map((r) => (
              <li key={r.id} className="grid gap-2 px-4 py-2.5 md:grid-cols-[200px_110px_minmax(0,1fr)] md:items-start">
                <span className="text-sm font-medium text-ink">
                  {r.label}
                  {!r.required && <span className="ml-1.5 text-[11px] font-normal text-ink-3">(souhaité)</span>}
                </span>
                <span><CriterionBadge state={r.state} /></span>
                <div className="min-w-0 text-[13px]">
                  <p className="text-ink-2">{r.note}</p>
                  {r.evidence && (
                    <p className="mt-1 flex gap-1.5 rounded bg-subtle px-2 py-1.5 text-ink-2">
                      <Quote className="mt-0.5 size-3 shrink-0 text-ink-4" />
                      <span className="min-w-0"><span className="italic">« {r.evidence.quote} »</span> <span className="whitespace-nowrap font-mono text-[11px] text-ink-4">{r.evidence.location}</span></span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-subtle px-4 py-2.5">
            <a href={`#/analyses/${c.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-violet-600 hover:bg-violet-50"><Sparkles className="size-3.5" /> Analyse IA</a>
            <a href={`#/candidats/${c.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-white px-2.5 text-[13px] font-medium text-ink hover:bg-subtle"><ExternalLink className="size-3.5" /> Ouvrir le profil</a>
          </div>
        </div>
      )}
    </article>
  )
}
