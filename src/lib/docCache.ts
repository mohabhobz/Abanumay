import { useSyncExternalStore } from 'react'
import { pickValues, readText, type Picked } from './docRead'
import { AI_CFG } from './ai/provider'
import { pct } from './format'

/* What the system read INSIDE each uploaded file · 18 Oct · audit 2.6.4 · 9.6.2 · 11.6.1.

   The upload controls only hand the stores a file's NAME, so the readings used to compare names.
   Now every file picked anywhere in the app is read once, in the browser, as it's picked (a capture
   listener on the document · no upload control has to remember it): text, CSV, XLSX and text PDFs
   through `docRead`. A scanned image or an image-only PDF has no text · when an OCR service is set in
   the AI settings, the file is posted to it and its text read the same way; otherwise the reading
   says it waits for that service.

   The result is kept by file name (and by name + size) in memory and in this tab's session, so a
   reload keeps what was read. Nothing leaves the browser except to the OCR endpoint the admin set. */

export interface CachedRead {
  name: string
  size: number
  how: 'text' | 'sheet' | 'pdf' | 'ocr' | 'none'
  note: string
  /** The first part of the text · enough for the findings, small enough for the session */
  text: string
  picked: Picked
  at: string
}

const KEY = 'ab-doc-reads'
const MAX_TEXT = 20_000
const MAX_FILES = 60
const store = new Map<string, CachedRead>()
const subs = new Set<() => void>()
let version = 0

try {
  const saved = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as CachedRead[]
  for (const r of saved) { store.set(r.name, r); store.set(`${r.name}|${r.size}`, r) }
} catch { /* private window · no session */ }

const save = () => {
  try {
    const list = [...new Map([...store.values()].map((r) => [r.name, r])).values()].slice(-MAX_FILES)
    sessionStorage.setItem(KEY, JSON.stringify(list))
  } catch { /* full or blocked · memory still holds it */ }
}
const emit = () => { version++; for (const f of subs) f() }

/** A file's reading, by its name (the stores keep names) · the latest one with that name */
export const cachedRead = (name: string, size?: number): CachedRead | undefined =>
  (size !== undefined ? store.get(`${name}|${size}`) : undefined) ?? store.get(name)

/** The OCR service · `POST {endpoint}` multipart `file` → `{ text }` */
async function ocr(file: File): Promise<string> {
  const ep = (AI_CFG.ocrEndpoint ?? '').trim()
  if (!ep) return ''
  try {
    const body = new FormData()
    body.append('file', file)
    const r = await fetch(ep, { method: 'POST', body })
    if (!r.ok) return ''
    const j = (await r.json()) as { text?: string }
    return j.text ?? ''
  } catch { return '' }
}

/** Read a picked file and keep what it says */
export async function cacheRead(file: File): Promise<CachedRead> {
  const t = await readText(file)
  let text = t.text
  let how: CachedRead['how'] = t.how
  let note = t.note
  if (!text) {
    const o = await ocr(file)
    if (o) { text = o; how = 'ocr'; note = 'قرأت خدمة التعرف الضوئي محتوى الملف' }
    else note = AI_CFG.ocrEndpoint ? 'صورة ممسوحة · لم تُرجع خدمة التعرف الضوئي نصًّا' : 'صورة ممسوحة · تُرسل لخدمة التعرف الضوئي عند ربطها في إعدادات الذكاء الاصطناعي'
  }
  const rec: CachedRead = { name: file.name, size: file.size, how, note, text: text.slice(0, MAX_TEXT), picked: pickValues(text), at: new Date().toISOString() }
  store.set(file.name, rec)
  store.set(`${file.name}|${file.size}`, rec)
  save()
  emit()
  return rec
}

/** Every file input in the app · read as it's picked (capture: before the control clears it) */
export function watchUploads(): void {
  if (typeof document === 'undefined') return
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement | null
    if (!el || el.tagName !== 'INPUT' || el.type !== 'file' || !el.files) return
    for (const f of Array.from(el.files)) void cacheRead(f)
  }, true)
}

/** Re-render when a file has been read */
export function useDocReads(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version, () => version)
}

/* ── Findings in a report's text (9.6.2) · the number written next to each indicator ── */

const IND: { key: string; label: string; re: RegExp }[] = [
  { key: 'beneficiaries', label: 'المستفيدون', re: /(?:عدد\s+)?المستفيد(?:ين|ون)[^\d%]{0,24}([\d٠-٩][\d٠-٩,،]*)/ },
  { key: 'progress', label: 'نسبة الإنجاز', re: /نسبة\s+(?:ال)?إنجاز[^\d%]{0,16}([\d٠-٩]{1,3}(?:[.,][\d٠-٩]+)?)\s*[%\u066A]?/ },
  { key: 'outputs', label: 'المخرجات', re: /المخرجات[^\d%]{0,24}([\d٠-٩][\d٠-٩,،]*)/ },
]
const lat = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,،]/g, '')

export function reportFindings(text: string): { key: string; label: string; value: string }[] {
  const out: { key: string; label: string; value: string }[] = []
  for (const i of IND) {
    const m = text.match(i.re)
    if (m?.[1]) out.push({ key: i.key, label: i.label, value: i.key === 'progress' ? pct(Number(lat(m[1]))) : lat(m[1]) })
  }
  return out
}
