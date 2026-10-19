import { BadgeCheck, ChevronRight, Sparkles } from 'lucide-react'
import { providerName } from '../lib/db'
import { fmtDateTime } from '../lib/format'
import type { Analysis } from '../lib/types'
import { ConfidenceBadge, ProviderTag, ScoreRing } from './Badges'
import { cx } from './ui'

export default function AICard({ analysis, href, compact, offerTitle }: { analysis: Analysis; href?: string; compact?: boolean; offerTitle?: string }) {
  return (
    <article className="overflow-hidden rounded-lg border border-violet-600/20 bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-violet-600/15 bg-violet-50/70 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600"><Sparkles className="size-3.5" /> Recommandation IA — à valider par RH</span>
        {analysis.reviewedBy ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ok-700"><BadgeCheck className="size-3.5" /> Relue</span>
        ) : (
          <span className="text-xs font-medium text-warn-700">Non relue</span>
        )}
      </div>
      <div className={cx('flex gap-4 p-4', compact && 'items-center')}>
        <ScoreRing score={analysis.score} size={compact ? 64 : 80} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ProviderTag provider={analysis.provider} name={providerName(analysis.provider)} model={analysis.model} />
            <span className="text-xs text-ink-3">{fmtDateTime(analysis.createdAt)}</span>
          </div>
          {!compact && <p className="line-clamp-3 text-sm leading-relaxed text-ink-2">{analysis.summary}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <ConfidenceBadge value={analysis.confidence} />
            {offerTitle && <span className="text-xs text-ink-3">Critères : {offerTitle}</span>}
          </div>
        </div>
        {href && (
          <a href={href} className="self-center rounded-md p-1.5 text-ink-3 hover:bg-canvas hover:text-brand-700" aria-label="Voir l'analyse détaillée"><ChevronRight className="size-5" /></a>
        )}
      </div>
    </article>
  )
}
