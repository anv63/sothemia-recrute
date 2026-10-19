import { FileText, FileWarning } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LINES_PER_PAGE } from '../lib/evidence'
import { files } from '../lib/files'
import { norm } from '../lib/lexicon'
import type { Candidate } from '../lib/types'
import { Skeleton } from './States'
import { cx } from './ui'

const HEADINGS = /^(PROFIL|EXPÉRIENCE|EXPERIENCE|FORMATION|COMPÉTENCES|COMPETENCES|LANGUES|CERTIFICATIONS|CENTRES)/

/** Original CV preview. Stored PDFs render natively; otherwise the extracted text is shown page by page. */
export default function CvPreview({ c, highlight = [], mode = 'auto' }: { c: Candidate; highlight?: string[]; mode?: 'auto' | 'text' }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(c.file.stored && c.file.type === 'pdf' && mode === 'auto')
  useEffect(() => {
    let u: string | null = null
    if (c.file.stored && c.file.type === 'pdf' && mode === 'auto') {
      setLoading(true)
      files.get(c.id).then((b) => {
        if (b) { u = URL.createObjectURL(new Blob([b], { type: 'application/pdf' })); setUrl(u) }
        setLoading(false)
      })
    } else setUrl(null)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [c.id, c.file.stored, c.file.type, mode])

  if (loading) return <Skeleton className="h-[720px] w-full rounded-md" />
  if (url) return <iframe title={`CV original — ${c.file.name}`} src={url} className="h-[760px] w-full rounded-md border border-line bg-white" />

  if (!c.cvText) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center rounded-md border border-dashed border-line-strong bg-subtle p-6 text-center">
        <FileWarning className="mb-3 size-8 text-bad-600" />
        <p className="font-semibold text-ink">Aucun texte exploitable</p>
        <p className="mt-1 max-w-xs text-sm text-ink-3">{c.processingError ?? "Le document n'a pas pu être lu (PDF scanné ou protégé). Saisissez les informations manuellement ou réimportez le fichier."}</p>
      </div>
    )
  }

  const hl = highlight.map(norm)
  const lines = c.cvText.split('\n')
  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE))
  return (
    <div className="space-y-4 rounded-md bg-canvas p-4 md:p-6">
      {pages.map((p, pi) => (
        <div key={pi} className="relative mx-auto aspect-[1/1.414] max-w-[560px] overflow-hidden bg-white px-[8%] py-[7%] shadow-pop">
          <span className="absolute right-3 top-2 font-mono text-[10px] text-ink-4">p. {pi + 1}/{pages.length}</span>
          {p.map((l, li) => {
            const idx = pi * LINES_PER_PAGE + li
            const isH = HEADINGS.test(l)
            const mark = hl.some((h) => h && norm(l) === h)
            return (
              <p
                key={li}
                data-line={idx}
                className={cx(
                  'text-[11px] leading-[1.55] text-ink-2',
                  idx === 0 && 'mb-0.5 text-[17px] font-semibold tracking-tight text-ink',
                  idx === 1 && 'text-[12px] font-medium text-brand-700',
                  isH && 'mb-1 mt-3 border-b border-line pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink',
                  mark && 'rounded-sm bg-warn-50 ring-2 ring-warn-200',
                )}
              >
                {l}
              </p>
            )
          })}
        </div>
      ))}
      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-3"><FileText className="size-3.5" /> Rendu du texte extrait — l'original reste la référence.</p>
    </div>
  )
}
