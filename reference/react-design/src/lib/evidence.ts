import { escapeRe, norm } from './lexicon'

export const LINES_PER_PAGE = 38

export function locate(index: number) {
  return `p. ${Math.floor(index / LINES_PER_PAGE) + 1}, l. ${(index % LINES_PER_PAGE) + 1}`
}

/**
 * Returns the CV line that best supports a claim, with its page/line location.
 * Body lines (after the 3-line identity header) are preferred; `prefer` ranks matching lines first (e.g. dated lines).
 */
export function findEvidence(cvText: string, aliases: string[], opts: { header?: boolean; prefer?: RegExp } = {}): { quote: string; location: string; index: number } | undefined {
  if (!cvText) return undefined
  const lines = cvText.split('\n')
  const order = lines.map((_, i) => i)
  const rankOf = (i: number) => (opts.prefer && opts.prefer.test(lines[i]) ? 0 : 2) + (!opts.header && i < 3 ? 1 : 0)
  order.sort((a, b) => rankOf(a) - rankOf(b) || a - b)
  for (const a of aliases) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(norm(a))}s?([^a-z0-9]|$)`)
    const i = order.find((k) => re.test(norm(lines[k])))
    if (i !== undefined) return { quote: lines[i], location: locate(i), index: i }
  }
  return undefined
}

export const DATED = /(19|20)\d{2}\s*[-–—]/
