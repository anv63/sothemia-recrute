import { Check, CircleAlert, CircleDashed, LoaderCircle, Minus, Sparkles, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { PROCESSING_LABEL, REVIEW_LABEL } from '../lib/format'
import type { CriterionState, ProcessingStatus, ProviderId, ReviewStatus } from '../lib/types'
import { cx } from './ui'

type Tone = 'neutral' | 'brand' | 'sea' | 'ok' | 'warn' | 'bad' | 'violet'
const TONE: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-2 ring-line-strong',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  sea: 'bg-sea-50 text-sea-700 ring-sea-100',
  ok: 'bg-ok-50 text-ok-700 ring-ok-600/20',
  warn: 'bg-warn-50 text-warn-700 ring-warn-200',
  bad: 'bg-bad-50 text-bad-700 ring-bad-200',
  violet: 'bg-violet-50 text-violet-600 ring-violet-600/20',
}

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 text-xs font-medium ring-1 ring-inset', TONE[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

const PROC: Record<ProcessingStatus, { tone: Tone; icon: ReactNode }> = {
  received: { tone: 'neutral', icon: <CircleDashed className="size-3" /> },
  extracting: { tone: 'brand', icon: <LoaderCircle className="size-3 animate-spin" /> },
  analyzing: { tone: 'violet', icon: <LoaderCircle className="size-3 animate-spin" /> },
  indexed: { tone: 'sea', icon: <Check className="size-3" /> },
  ready: { tone: 'ok', icon: <Check className="size-3" /> },
  error: { tone: 'bad', icon: <CircleAlert className="size-3" /> },
}

export function StatusBadge({ status }: { status: ProcessingStatus }) {
  return <Badge tone={PROC[status].tone} icon={PROC[status].icon}>{PROCESSING_LABEL[status]}</Badge>
}

const REV: Record<ReviewStatus, Tone> = { a_examiner: 'brand', en_revue: 'violet', retenu: 'ok', en_attente: 'warn', archive: 'neutral' }
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <Badge tone={REV[status]}>{REVIEW_LABEL[status]}</Badge>
}

export const scoreTone = (s: number): Tone => (s >= 75 ? 'ok' : s >= 50 ? 'brand' : 'warn')

export function ScoreBadge({ score, size = 'sm' }: { score: number | null; size?: 'sm' | 'md' }) {
  if (score === null) return <span className="inline-flex h-[22px] items-center px-1 text-xs text-ink-4" title="Pas encore analysé">—</span>
  const tone = scoreTone(score)
  const bar = { ok: 'bg-ok-600', brand: 'bg-brand-600', warn: 'bg-warn-600' }[tone as 'ok' | 'brand' | 'warn']
  return (
    <span className={cx('inline-flex items-center gap-2', size === 'md' && 'gap-2.5')} title={`Score ${score}/100 — recommandation, à valider par RH`}>
      <span className={cx('inline-flex items-center justify-center rounded-[5px] font-semibold tabular ring-1 ring-inset', TONE[tone], size === 'md' ? 'h-7 min-w-10 px-2 text-sm' : 'h-[22px] min-w-8 px-1.5 text-xs')}>{score}</span>
      <span className={cx('hidden h-1 overflow-hidden rounded-full bg-line sm:block', size === 'md' ? 'w-16' : 'w-10')}>
        <span className={cx('block h-full rounded-full', bar)} style={{ width: `${score}%` }} />
      </span>
    </span>
  )
}

export function ScoreRing({ score, size = 88, label = '/100' }: { score: number; size?: number; label?: string }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const color = { ok: 'var(--color-ok-600)', brand: 'var(--color-brand-600)', warn: 'var(--color-warn-600)' }[scoreTone(score) as 'ok' | 'brand' | 'warn']
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular leading-none text-ink">{score}</span>
        <span className="mt-0.5 text-[11px] text-ink-3">{label}</span>
      </div>
    </div>
  )
}

export function ConfidenceBadge({ value, compact }: { value: number; compact?: boolean }) {
  const tone: Tone = value >= 0.8 ? 'ok' : value >= 0.6 ? 'warn' : 'bad'
  const label = value >= 0.8 ? 'Élevée' : value >= 0.6 ? 'Moyenne' : 'Faible'
  return (
    <Badge tone={tone} icon={tone === 'bad' ? <TriangleAlert className="size-3" /> : undefined}>
      {compact ? `${Math.round(value * 100)} %` : `Confiance ${label.toLowerCase()} · ${Math.round(value * 100)} %`}
    </Badge>
  )
}

export function FieldConfidenceDot({ value }: { value: number | undefined }) {
  if (value === undefined) return null
  const c = value >= 1 ? 'bg-brand-600' : value >= 0.8 ? 'bg-ok-600' : value >= 0.6 ? 'bg-warn-600' : value > 0 ? 'bg-bad-600' : 'bg-line-strong'
  const t = value >= 1 ? 'Validé manuellement' : value === 0 ? 'Non détecté' : `Confiance d'extraction ${Math.round(value * 100)} %`
  return <span title={t} aria-label={t} className={cx('inline-block size-1.5 shrink-0 rounded-full', c)} />
}

export function CriterionBadge({ state }: { state: CriterionState }) {
  if (state === 'satisfied') return <Badge tone="ok" icon={<Check className="size-3" />}>Satisfait</Badge>
  if (state === 'partial') return <Badge tone="warn" icon={<Minus className="size-3" />}>Partiel</Badge>
  return <Badge tone="neutral" icon={<X className="size-3" />}>Manquant</Badge>
}

export function AIBadge() {
  return <Badge tone="violet" icon={<Sparkles className="size-3" />}>Recommandation IA · à valider par RH</Badge>
}

const PROVIDER_DOT: Record<ProviderId, string> = { local: 'bg-ink-3', openai: 'bg-[#10a37f]', gemini: 'bg-[#4285f4]', anthropic: 'bg-[#c96442]' }
export function ProviderTag({ provider, name, model }: { provider: ProviderId; name: string; model?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span className={cx('size-2 rounded-full', PROVIDER_DOT[provider])} />
      <span className="font-medium">{name}</span>
      {model && <span className="font-mono text-[11px] text-ink-3">{model}</span>}
    </span>
  )
}
