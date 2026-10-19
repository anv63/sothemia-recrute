import { CloudUpload, Lock } from 'lucide-react'
import { useRef, useState } from 'react'
import { MAX_SIZE_MB } from '../lib/pipeline'
import { Button, cx } from './ui'

export default function UploadDropZone({ onFiles, locked, compact }: { onFiles: (f: File[]) => void; locked?: boolean; compact?: boolean }) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]) }}
      className={cx(
        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors',
        compact ? 'px-6 py-8' : 'px-6 py-14',
        over ? 'border-brand-500 bg-brand-50' : locked ? 'border-line-strong bg-subtle' : 'border-line-strong bg-white hover:border-brand-200 hover:bg-brand-50/40',
      )}
    >
      <span className={cx('mb-4 flex size-12 items-center justify-center rounded-full', over ? 'bg-brand-600 text-white' : locked ? 'bg-warn-50 text-warn-600' : 'bg-brand-50 text-brand-600')}>
        {locked ? <Lock className="size-5" /> : <CloudUpload className="size-6" />}
      </span>
      <p className="text-[15px] font-semibold text-ink">{over ? 'Déposez les fichiers pour lancer le traitement' : 'Glissez-déposez des CV ici'}</p>
      <p className="mt-1 text-sm text-ink-3">PDF ou DOCX · plusieurs fichiers · {MAX_SIZE_MB} Mo maximum par fichier</p>
      <Button variant="primary" className="mt-5" locked={locked} onClick={() => input.current?.click()}>Parcourir les fichiers</Button>
      {locked && <p className="mt-3 text-xs text-warn-700">Votre rôle ne permet pas d'importer des CV.</p>}
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) onFiles([...e.target.files]); e.target.value = '' }}
      />
    </div>
  )
}
