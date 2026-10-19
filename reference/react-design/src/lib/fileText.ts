// Best-effort, dependency-free text extraction for the browser prototype.
// Production (Streamlit): pdfplumber / pypdf for PDF, python-docx for DOCX, Tesseract OCR fallback for scans.

export interface RawExtraction {
  text: string
  pages: number
  warning?: string
}

async function inflate(data: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream indisponible')
  const ds = new DecompressionStream(format)
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const latin1 = (b: Uint8Array) => {
  let s = ''
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192))
  return s
}

// ---------- DOCX ----------
async function docxText(buf: ArrayBuffer): Promise<RawExtraction> {
  const u8 = new Uint8Array(buf)
  const dv = new DataView(buf)
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Archive DOCX invalide')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true)
    const csize = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen))
    if (name === 'word/document.xml') {
      const lNameLen = dv.getUint16(local + 26, true)
      const lExtra = dv.getUint16(local + 28, true)
      const start = local + 30 + lNameLen + lExtra
      const raw = u8.subarray(start, start + csize)
      const xmlBytes = method === 8 ? await inflate(raw, 'deflate-raw') : raw
      const xml = dec.decode(xmlBytes)
      const text = xml
        .replace(/<w:tab\/>/g, ' ')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      const pages = Math.max(1, Math.ceil(text.length / 3200))
      return { text: tidy(text), pages }
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error('word/document.xml introuvable')
}

// ---------- PDF ----------
function pdfStrings(content: string): string {
  const out: string[] = []
  const re = /\[((?:\\.|[^\]])*)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")|(-?[\d.]+)\s+(-?[\d.]+)\s+T[dD]|T\*|ET/g
  let line = ''
  let m: RegExpExecArray | null
  const unesc = (s: string) =>
    s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c: string) =>
      /[0-7]/.test(c[0]) ? String.fromCharCode(parseInt(c, 8)) : ({ n: '\n', r: '', t: ' ', b: '', f: '', '(': '(', ')': ')', '\\': '\\' } as Record<string, string>)[c] ?? c,
    )
  while ((m = re.exec(content))) {
    if (m[1] !== undefined) {
      const parts = m[1].match(/\((?:\\.|[^\\)])*\)|-?\d+(\.\d+)?/g) ?? []
      for (const part of parts) {
        if (part.startsWith('(')) line += unesc(part.slice(1, -1))
        else if (parseFloat(part) < -200) line += ' '
      }
    } else if (m[2] !== undefined) {
      line += unesc(m[2])
    } else if (m[3] !== undefined) {
      if (Math.abs(parseFloat(m[4])) > 0.1) { out.push(line); line = '' } else line += ' '
    } else {
      out.push(line); line = ''
    }
  }
  out.push(line)
  return out.join('\n')
}

async function pdfText(buf: ArrayBuffer): Promise<RawExtraction> {
  const u8 = new Uint8Array(buf)
  const s = latin1(u8)
  if (!s.startsWith('%PDF')) throw new Error('En-tête PDF invalide')
  const pages = Math.max(1, (s.match(/\/Type\s*\/Page(?!s)/g) ?? []).length)
  const chunks: string[] = []
  const re = /stream\r?\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const dictStart = s.lastIndexOf('<<', m.index)
    const dict = s.slice(dictStart, m.index)
    const start = m.index + m[0].length
    const end = s.indexOf('endstream', start)
    if (end < 0) break
    re.lastIndex = end
    if (/\/Subtype\s*\/Image|\/XObject|\/FontFile/.test(dict)) continue
    // Respect a direct /Length when present; otherwise drop the EOL that precedes `endstream`.
    const len = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)
    let stop = len && start + parseInt(len[1], 10) <= end ? start + parseInt(len[1], 10) : end
    while (stop > start && (u8[stop - 1] === 0x0a || u8[stop - 1] === 0x0d)) stop--
    let body: Uint8Array = u8.subarray(start, stop)
    try {
      if (/\/FlateDecode/.test(dict)) body = await inflate(body, 'deflate')
      else if (/\/Filter/.test(dict)) continue
    } catch { continue }
    const str = latin1(body)
    if (/\bBT\b/.test(str)) chunks.push(pdfStrings(str))
  }
  const text = tidy(chunks.join('\n'))
  const letters = (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length
  if (text.length < 40 || letters / Math.max(1, text.length) < 0.55) {
    return { text: '', pages, warning: 'Texte non exploitable (PDF scanné ou police encodée). OCR requis.' }
  }
  return { text, pages }
}

const tidy = (t: string) =>
  t
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

export async function extractFileText(file: File): Promise<RawExtraction> {
  const buf = await file.arrayBuffer()
  const ext = file.name.toLowerCase().split('.').pop()
  try {
    return ext === 'docx' ? await docxText(buf) : await pdfText(buf)
  } catch (e) {
    return { text: '', pages: 1, warning: e instanceof Error ? e.message : 'Extraction impossible' }
  }
}

export async function sha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
