import { CircleAlert, FileWarning, Inbox, KeyRound, Lock, RefreshCw, SearchX, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, cx } from './ui'

function Shell({ icon, title, children, actions, tone = 'neutral', compact }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode; tone?: 'neutral' | 'bad' | 'warn' | 'brand'; compact?: boolean }) {
  const ring = { neutral: 'bg-canvas text-ink-3', bad: 'bg-bad-50 text-bad-600', warn: 'bg-warn-50 text-warn-600', brand: 'bg-brand-50 text-brand-600' }[tone]
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-6 py-8' : 'px-6 py-16')}>
      <div className={cx('mb-3 flex size-11 items-center justify-center rounded-full', ring)}>{icon}</div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm leading-relaxed text-ink-3">{children}</div>}
      {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, children, actions, icon, compact }: { title: string; children?: ReactNode; actions?: ReactNode; icon?: ReactNode; compact?: boolean }) {
  return <Shell icon={icon ?? <Inbox className="size-5" />} title={title} actions={actions} compact={compact}>{children}</Shell>
}

export function NoResults({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return <Shell icon={<SearchX className="size-5" />} title="Aucun résultat" actions={actions}>{children ?? 'Aucun candidat ne correspond aux critères. Élargissez la recherche ou retirez des filtres.'}</Shell>
}

export function ErrorState({ message, onRetry, compact }: { message?: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <Shell icon={<CircleAlert className="size-5" />} tone="bad" title="Impossible de charger les données" compact={compact} actions={onRetry && <Button icon={<RefreshCw className="size-4" />} onClick={onRetry}>Réessayer</Button>}>
      {message ?? 'La base locale ne répond pas.'} <span className="block text-xs text-ink-4">Si l'erreur persiste, vérifiez Paramètres › Données locales.</span>
    </Shell>
  )
}

export function Forbidden({ action, compact }: { action: string; compact?: boolean }) {
  return (
    <Shell icon={<Lock className="size-5" />} tone="warn" title="Action non autorisée" compact={compact}>
      Votre rôle ne permet pas de « {action} ». Contactez un administrateur RH si vous pensez que c'est une erreur.
    </Shell>
  )
}

export function Banner({ tone, title, children, actions, icon }: { tone: 'warn' | 'bad' | 'brand' | 'violet' | 'ok'; title: ReactNode; children?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  const t = {
    warn: 'border-warn-200 bg-warn-50 text-warn-700',
    bad: 'border-bad-200 bg-bad-50 text-bad-700',
    brand: 'border-brand-100 bg-brand-50 text-brand-800',
    violet: 'border-violet-600/20 bg-violet-50 text-violet-600',
    ok: 'border-ok-600/20 bg-ok-50 text-ok-700',
  }[tone]
  const i = icon ?? (tone === 'bad' ? <CircleAlert className="size-4" /> : <TriangleAlert className="size-4" />)
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cx('flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3', t)}>
      <span className="mt-0.5 shrink-0">{i}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 leading-relaxed opacity-90">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function MissingKeyBanner({ provider, onConfigure }: { provider: string; onConfigure: () => void }) {
  return (
    <Banner tone="warn" icon={<KeyRound className="size-4" />} title={`Clé API ${provider} manquante`} actions={<Button size="sm" onClick={onConfigure}>Configurer</Button>}>
      Les analyses utiliseront le moteur local tant qu'aucune clé valide n'est enregistrée.
    </Banner>
  )
}

export function LowConfidenceBanner({ value, onEdit }: { value: number; onEdit?: () => void }) {
  return (
    <Banner tone="bad" icon={<FileWarning className="size-4" />} title={`Extraction à faible confiance (${Math.round(value * 100)} %)`} actions={onEdit && <Button size="sm" onClick={onEdit}>Vérifier les champs</Button>}>
      Plusieurs champs n'ont pas pu être lus de façon fiable (PDF scanné, mise en page complexe ou police encodée). Vérifiez et corrigez avant d'utiliser ce profil dans une recherche.
    </Banner>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />
}

export function TableSkeleton({ rows = 8, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-4" />
          <div className="flex w-56 items-center gap-3"><Skeleton className="size-8 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2.5 w-40" /></div></div>
          {Array.from({ length: cols - 2 }).map((_, c) => <Skeleton key={c} className={cx('h-3 flex-1', c % 2 ? 'max-w-20' : 'max-w-32')} />)}
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cx('grid gap-4', className)} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-line bg-white p-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-16" /><Skeleton className="h-2.5 w-32" /></div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-busy="true">
      <Skeleton className="h-[640px] rounded-lg" />
      <div className="space-y-4">
        {[160, 120, 220, 140].map((h, i) => <div key={i} className="skeleton rounded-lg" style={{ height: h }} />)}
      </div>
    </div>
  )
}
