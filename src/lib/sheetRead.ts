/* Reading a table the user uploads · batch 8 (9 Oct).

   The reconciliation with Ehsan and the old system's payments both start from a file someone exports
   from another system: a CSV, or an Excel workbook. Both are read here, in the browser, with no
   library: a CSV is split by hand (quotes, commas, a byte-order mark), and an .xlsx is a zip whose
   first sheet and shared strings are inflated with the browser's own `DecompressionStream` and read
   as XML. Only the first sheet is read, and every cell comes back as text.

   Arabic-Indic digits are turned into Latin ones so an amount typed in Arabic still adds up. */

export type Table = string[][]

const AR = '٠١٢٣٤٥٦٧٨٩'
export const latinDigits = (s: string): string => s.replace(/[٠-٩]/g, (d) => String(AR.indexOf(d))).replace(/٫/g, '.').replace(/٬/g, ',')

export function parseCsv(text: string): Table {
  const src = text.replace(/^\uFEFF/, '')
  /* A semicolon-separated export (Excel in some locales) is read the same way */
  const first = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: Table = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.map((r) => r.map((x) => latinDigits(x.trim()))).filter((r) => r.some(Boolean))
}

/* ── .xlsx ── */

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const out = new Blob([data]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** The zip's files by name · stored and deflated entries */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const v = new DataView(buf)
  const u8 = new Uint8Array(buf)
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('الملف ليس مصنّف Excel صالحًا')
  const count = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const files = new Map<string, Uint8Array>()
  const dec = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break
    const method = v.getUint16(p + 10, true)
    const size = v.getUint32(p + 20, true)
    const nameLen = v.getUint16(p + 28, true)
    const extraLen = v.getUint16(p + 30, true)
    const commentLen = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen))
    const lNameLen = v.getUint16(local + 26, true)
    const lExtraLen = v.getUint16(local + 28, true)
    const start = local + 30 + lNameLen + lExtraLen
    const raw = u8.subarray(start, start + size)
    if (/^xl\/(sharedStrings|worksheets\/sheet1|workbook)\.xml$/.test(name)) files.set(name, method === 0 ? raw : await inflate(raw))
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const colIndex = (ref: string): number => {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export async function parseXlsx(buf: ArrayBuffer): Promise<Table> {
  const files = await unzip(buf)
  const dec = new TextDecoder()
  const xml = (name: string) => { const f = files.get(name); return f ? new DOMParser().parseFromString(dec.decode(f), 'application/xml') : null }
  const shared = [...(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? [])].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''))
  const sheet = xml('xl/worksheets/sheet1.xml')
  if (!sheet) throw new Error('لا ورقة في المصنّف')
  const rows: Table = []
  for (const r of [...sheet.getElementsByTagName('row')]) {
    const out: string[] = []
    for (const c of [...r.getElementsByTagName('c')]) {
      const i = colIndex(c.getAttribute('r') ?? 'A1')
      const t = c.getAttribute('t')
      const val = t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent ?? '').join('')
        : c.getElementsByTagName('v')[0]?.textContent ?? ''
      out[i] = latinDigits((t === 's' ? shared[Number(val)] ?? '' : val).trim())
    }
    rows.push(Array.from(out, (x) => x ?? ''))
  }
  return rows.filter((r) => r.some(Boolean))
}

/** A CSV or an .xlsx file as rows of text · throws a message in Arabic on a file it can't read */
export async function readTable(f: File): Promise<Table> {
  if (/\.xlsx$/i.test(f.name)) return parseXlsx(await f.arrayBuffer())
  if (/\.(csv|txt)$/i.test(f.name)) return parseCsv(await f.text())
  throw new Error('الصيغ المقبولة: CSV أو Excel (xlsx)')
}

/** Find a column by any of its expected names · header cells are compared without spaces or case */
export function colOf(header: string[], names: string[]): number {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const want = names.map(norm)
  return header.findIndex((h) => want.includes(norm(h)))
}

/** An amount cell · thousands separators and a currency word are ignored */
export const amountOf = (s: string): number => Number(latinDigits(s).replace(/[^\d.-]/g, '')) || 0

/** A date cell · ISO, d/m/yyyy, or an Excel serial number · '' when unreadable */
export function dateOf(s: string): string {
  const x = latinDigits(s).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(x)) return x.slice(0, 10)
  const m = x.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
  if (/^\d{5}(\.\d+)?$/.test(x)) return new Date(Date.UTC(1899, 11, 30) + Number(x) * 86_400_000).toISOString().slice(0, 10)
  return ''
}

/** A CSV the user downloads · with a BOM so Excel opens Arabic correctly */
export function downloadCsv(name: string, rows: Table): void {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
