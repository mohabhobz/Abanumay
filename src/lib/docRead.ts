/* Reading a document's content in the browser (10 Oct) · before the document service is connected, the
   prototype reads what it can itself so the comparison with the typed values runs for real:

   · text and CSV files as they are
   · XLSX through `sheetRead` (its cells joined)
   · PDF: the content streams are inflated with `DecompressionStream` and the text drawn by `Tj`/`TJ`
     is gathered. Digits, IBANs and dates are almost always drawn in a standard encoding, so they read
     well · Arabic words drawn through embedded fonts often don't, and the reading says so.

   Then the values a check needs are picked out: amounts, dates, IBANs, long numbers (licence, CR,
   operation). A scanned image has no text · the reading says that too. Nothing leaves the browser. */

import { latinDigits, readTable } from './sheetRead'

export interface LocalText { text: string; how: 'text' | 'sheet' | 'pdf' | 'none'; note: string }

const inflate = async (bytes: Uint8Array): Promise<string> => {
  for (const fmt of ['deflate', 'deflate-raw'] as const) {
    try {
      const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(fmt))
      const buf = await new Response(s).arrayBuffer()
      return latin1(new Uint8Array(buf))
    } catch { /* try the other format */ }
  }
  return ''
}
/** ASCII85 (`/ASCII85Decode`), which some writers put before the Flate filter */
const a85 = (src: string): Uint8Array => {
  const t = src.replace(/\s+/g, '').replace(/^<~/, '').replace(/~>.*$/, '')
  const out: number[] = []
  let grp: number[] = []
  const flush = (n: number) => {
    while (grp.length < 5) grp.push(84)
    let v = 0
    for (const c of grp) v = v * 85 + c
    const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]
    out.push(...b.slice(0, n))
    grp = []
  }
  for (const ch of t) {
    if (ch === 'z' && !grp.length) { out.push(0, 0, 0, 0); continue }
    const c = ch.charCodeAt(0) - 33
    if (c < 0 || c > 84) continue
    grp.push(c)
    if (grp.length === 5) flush(4)
  }
  if (grp.length) flush(grp.length - 1)
  return Uint8Array.from(out)
}
const latin1 = (b: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return s
}

/** The strings a PDF content stream draws · `(..) Tj` and the arrays of `TJ` */
function drawn(content: string): string {
  const out: string[] = []
  const lit = /\((?:\\.|[^\\)])*\)/g
  for (const m of content.matchAll(/\[((?:\((?:\\.|[^\\)])*\)|[^\]])*)\]\s*TJ|(\((?:\\.|[^\\)])*\))\s*(?:Tj|'|")/g)) {
    const part = m[1] ?? m[2] ?? ''
    const strs = [...part.matchAll(lit)].map((x) => x[0].slice(1, -1)
      .replace(/\\([nrtbf()\\])/g, (_, c: string) => ({ n: '\n', r: '', t: ' ', b: '', f: '' } as Record<string, string>)[c] ?? c)
      .replace(/\\(\d{1,3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8))))
    out.push(strs.join(''))
  }
  return out.join(' ')
}

export async function readText(file: File): Promise<LocalText> {
  const name = file.name.toLowerCase()
  try {
    if (/\.(txt|csv|tsv)$/.test(name) || file.type.startsWith('text/')) {
      return { text: await file.text(), how: 'text', note: 'قُرئ نص الملف' }
    }
    if (/\.xlsx?$/.test(name)) {
      const t = await readTable(file)
      return { text: t.map((r) => r.join(' ')).join('\n'), how: 'sheet', note: `قُرئت ${t.length} صفًّا من الجدول` }
    }
    if (/\.pdf$/.test(name) || file.type === 'application/pdf') {
      const raw = latin1(new Uint8Array(await file.arrayBuffer()))
      const parts: string[] = []
      const re = /<<([^]*?)>>\s*stream\r?\n/g
      let m: RegExpExecArray | null
      while ((m = re.exec(raw))) {
        const start = m.index + m[0].length
        const end = raw.indexOf('endstream', start)
        if (end < 0) break
        const body = raw.slice(start, end)
        const dict = m[1]
        if (/\/Subtype\s*\/Image|\/Length1|\/FontFile/.test(dict)) continue
        let bytes = Uint8Array.from(body, (c) => c.charCodeAt(0))
        if (/\/ASCII85Decode|\/A85/.test(dict)) bytes = a85(body)
        const content = /\/FlateDecode|\/Fl\b/.test(dict) ? await inflate(bytes) : latin1(bytes)
        if (/\b(Tj|TJ)\b/.test(content)) parts.push(drawn(content))
        re.lastIndex = end
      }
      const text = parts.join('\n').replace(/[^\S\n]+/g, ' ').trim()
      return text
        ? { text, how: 'pdf', note: 'قُرئ النص المرسوم في الملف · الأرقام والتواريخ تُقرأ، والكلمات العربية بخطوط مضمّنة قد لا تُقرأ' }
        : { text: '', how: 'none', note: 'لا نص في الملف · يبدو صورة ممسوحة · يُقرأ بخدمة قراءة الوثائق' }
    }
    return { text: '', how: 'none', note: 'صورة · يُقرأ محتواها بخدمة قراءة الوثائق' }
  } catch {
    return { text: '', how: 'none', note: 'تعذّرت قراءة الملف' }
  }
}

export interface Picked { amounts: number[]; dates: string[]; ibans: string[]; numbers: string[] }

/** The values a check needs, from a text · digits made Latin first */
export function pickValues(text: string): Picked {
  const all = latinDigits(text)
  /* dates and IBANs are taken first, then cut out so their digits don't read as amounts */
  const t = all.replace(/\b(?:19|20)\d\d[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d\d\b/g, ' ').replace(/SA\d{22}/gi, ' ')
  const amounts = [...t.matchAll(/(?<![\d.])(\d{1,3}(?:,\d{3})+|\d{4,9})(?:\.\d{1,2})?(?![\d])/g)].map((x) => Number(x[1].replace(/,/g, ''))).filter((n) => n >= 100)
  const dates = [
    ...[...all.matchAll(/\b(20\d\d|19\d\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/g)].map((x) => `${x[1]}-${x[2].padStart(2, '0')}-${x[3].padStart(2, '0')}`),
    ...[...all.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d\d|19\d\d)\b/g)].map((x) => `${x[3]}-${x[2].padStart(2, '0')}-${x[1].padStart(2, '0')}`),
  ]
  const ibans = [...all.replace(/\s+/g, '').matchAll(/SA\d{22}/gi)].map((x) => x[0].toUpperCase())
  const numbers = [...t.matchAll(/(?<!\d)\d{7,12}(?!\d)/g)].map((x) => x[0])
  return { amounts: [...new Set(amounts)], dates: [...new Set(dates)], ibans: [...new Set(ibans)], numbers: [...new Set(numbers)] }
}

/** Is the expected value among what was read · and what was read instead */
export function matchOne<T>(read: T[], expected: T | undefined): { ok: boolean; seen: T[] } {
  return { ok: expected !== undefined && read.includes(expected), seen: read.slice(0, 3) }
}
