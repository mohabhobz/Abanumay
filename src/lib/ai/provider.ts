import { useEffect, useState } from 'react'
import { pickValues, readText } from '@/lib/docRead'
import { persist, readJson } from '@/lib/config'
import { logSettings } from '@/data/shared/settingsLog'

/* The AI service · batch 8 (the integration point).

   Every reading the system calls «ذكاء اصطناعي» runs today on rules in the browser: summaries from
   the study and the decisions, the expected impact from closed projects, the clause review, the
   spelling check, the report against the plan. They stay. What's added is the one door a model
   comes in through: a setting that points each task at the server's AI endpoint. With the endpoint
   set and the task on, the screen asks the model and shows its answer marked «من النموذج»; when the
   service doesn't answer, it falls back to the rules and says so. Nothing depends on the model to
   work, and nothing claims to be a model when it isn't.

   The server's contract: `POST {endpoint}/{task}` with the JSON payload, answering
   `{ text: string, items?: string[] }`. */

export type AiTask = 'summary' | 'report' | 'spell' | 'document' | 'clauses' | 'impact'
export const AI_TASK_SAY: Record<AiTask, { title: string; where: string; local: string }> = {
  summary: { title: 'الملخص التنفيذي', where: 'جلسات اللجنة والمجلس · اللوحة التنفيذية', local: 'يُبنى من الدراسة والتوصيات والمخاطر' },
  report: { title: 'تحليل تقارير الإنجاز', where: 'طلبات الصرف · التقرير الختامي', local: 'يقارن الأرقام المُدخلة بالخطة والجدول' },
  spell: { title: 'التدقيق الإملائي', where: 'تسجيل الجهة · مراجعة التسجيل', local: 'قواعد الأخطاء الشائعة والتنسيق' },
  document: { title: 'قراءة الوثائق', where: 'مرفقات التسجيل والصرف والإغلاق', local: 'يفحص النوع والحجم والوضوح · لا يقرأ المحتوى' },
  clauses: { title: 'مراجعة بنود الاتفاقية', where: 'إعداد الاتفاقية ومراجعتها', local: 'يفحص البنود الناقصة والأرقام والتواريخ والصياغة' },
  impact: { title: 'الأثر المتوقع', where: 'تبويب الاعتماد · الجلسات', local: 'من نسب تحقّق المشاريع المشابهة المغلقة' },
}

export interface AiCfg { mode: 'rules' | 'api'; endpoint: string; tasks: Record<AiTask, boolean>; savedBy?: string; savedAt?: string }
const DEFAULT: AiCfg = { mode: 'rules', endpoint: '', tasks: { summary: true, report: true, spell: true, document: true, clauses: true, impact: true } }
const KEY = 'ab-cfg-ai'
export const AI_CFG: AiCfg = readJson(KEY, DEFAULT)
AI_CFG.tasks = { ...DEFAULT.tasks, ...AI_CFG.tasks }

export const aiLive = (task: AiTask): boolean => AI_CFG.mode === 'api' && Boolean(AI_CFG.endpoint) && AI_CFG.tasks[task]

/** The source line a reading carries · what it was made by */
export const aiSourceSay = (task?: AiTask): string => (task && aiLive(task) ? 'من النموذج' : 'قواعد محلية')

export function saveAiCfg(next: AiCfg, by: string): void {
  const changes = [
    ...(AI_CFG.mode !== next.mode ? [{ k: 'وضع الخدمة', from: AI_CFG.mode === 'api' ? 'خدمة الخادم' : 'قواعد محلية', to: next.mode === 'api' ? 'خدمة الخادم' : 'قواعد محلية' }] : []),
    ...(AI_CFG.endpoint !== next.endpoint ? [{ k: 'عنوان الخدمة', from: AI_CFG.endpoint || '—', to: next.endpoint || '—' }] : []),
    ...(Object.keys(next.tasks) as AiTask[]).filter((t) => AI_CFG.tasks[t] !== next.tasks[t]).map((t) => ({ k: AI_TASK_SAY[t].title, from: AI_CFG.tasks[t] ? 'مفعّلة' : 'موقوفة', to: next.tasks[t] ? 'مفعّلة' : 'موقوفة' })),
  ]
  logSettings('الذكاء الاصطناعي', '/settings/ai', by, changes)
  Object.assign(AI_CFG, structuredClone(next), { savedBy: by, savedAt: new Date().toISOString().slice(0, 10) })
  persist(KEY, AI_CFG)
}

export interface AiAnswer { text: string; items?: string[]; source: 'model' | 'rules'; note?: string }

/** Ask the model for a task · the local answer when the task isn't on or the service fails */
export async function askAi(task: AiTask, payload: unknown, local: () => Omit<AiAnswer, 'source'>): Promise<AiAnswer> {
  if (!aiLive(task)) return { ...local(), source: 'rules' }
  try {
    const r = await fetch(`${AI_CFG.endpoint.replace(/\/$/, '')}/${task}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!r.ok) throw new Error(String(r.status))
    const j = (await r.json()) as { text?: string; items?: string[] }
    if (!j.text) throw new Error('empty')
    return { text: j.text, items: j.items, source: 'model' }
  } catch {
    return { ...local(), source: 'rules', note: 'لم تستجب خدمة الذكاء الاصطناعي · عُرضت قراءة القواعد المحلية' }
  }
}

/** The same in a component · starts with the local answer, replaced by the model's when it comes */
export function useAi(task: AiTask, payload: unknown, local: () => Omit<AiAnswer, 'source'>): AiAnswer & { loading: boolean } {
  const key = JSON.stringify(payload)
  const [a, setA] = useState<AiAnswer & { loading: boolean }>(() => ({ ...local(), source: 'rules', loading: aiLive(task) }))
  useEffect(() => {
    let on = true
    if (!aiLive(task)) { setA({ ...local(), source: 'rules', loading: false }); return }
    setA((x) => ({ ...x, loading: true }))
    void askAi(task, JSON.parse(key), local).then((r) => { if (on) setA({ ...r, loading: false }) })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, key])
  return a
}

/* ── Reading a document's content ──
   The file goes to the server as it is (`POST {endpoint}/document`, multipart: `file` and `kind`),
   which answers the fields it read: `{ fields: [{ key, label, value }] }`. The screen then compares
   them with what was typed. With no service connected nothing is sent and the screen says the
   content wasn't read · the type, size and legibility checks run either way. */

export interface ReadField { key: string; label: string; value: string }
export interface DocRead { fields: ReadField[]; source: 'model' | 'local' | 'none'; note: string }

/* 10 Oct · what each kind of document is checked for when read locally · the typed value it should
   carry, by the field's key. A kind not listed is read for its amounts and dates only. */
const DOC_KEYS: Record<string, { key: string; label: string; pick: 'number' | 'date' | 'iban' | 'amount' }[]> = {
  license: [{ key: 'licenseNo', label: 'رقم الترخيص', pick: 'number' }, { key: 'licenseEndsAt', label: 'تاريخ نهاية الترخيص', pick: 'date' }],
  board: [{ key: 'boardEndsAt', label: 'تاريخ انتهاء تكليف المجلس', pick: 'date' }],
  bank: [{ key: 'iban', label: 'الآيبان', pick: 'iban' }],
  invoice: [{ key: 'amount', label: 'المبلغ', pick: 'amount' }],
  report: [{ key: 'amount', label: 'المبلغ', pick: 'amount' }],
  transfer: [{ key: 'amount', label: 'المبلغ', pick: 'amount' }, { key: 'ref', label: 'رقم العملية', pick: 'number' }],
}

/** Read the file in the browser · each expected value is looked for among what was read; a field is
    returned only when the document carries values of that type, so a silent document raises nothing */
async function readHere(file: File, kind: string, typed: Record<string, string>): Promise<DocRead> {
  const t = await readText(file)
  if (!t.text) return { fields: [], source: 'none', note: t.note }
  const v = pickValues(t.text)
  const fields: ReadField[] = []
  for (const k of DOC_KEYS[kind] ?? []) {
    const want = (typed[k.key] ?? '').trim()
    const pool = k.pick === 'date' ? v.dates : k.pick === 'iban' ? v.ibans : k.pick === 'number' ? v.numbers : v.amounts.map(String)
    if (!pool.length) continue
    const norm = k.pick === 'iban' ? want.replace(/\s+/g, '').toUpperCase() : k.pick === 'amount' ? String(Number(want.replace(/[^\d.]/g, '')) || '') : want
    fields.push({ key: k.key, label: k.label, value: norm && pool.includes(norm) ? want : pool[0] })
  }
  const seen = [v.amounts.length && `${v.amounts.length} مبلغ`, v.dates.length && `${v.dates.length} تاريخ`, v.ibans.length && `${v.ibans.length} آيبان`].filter(Boolean).join(' · ')
  return { fields, source: 'local', note: `قراءة محلية · ${t.note}${seen ? ` · وُجد ${seen}` : ''}` }
}

export async function readDocument(file: File, kind: string, typed: Record<string, string> = {}): Promise<DocRead> {
  if (!aiLive('document')) return readHere(file, kind, typed)
  try {
    const body = new FormData()
    body.append('file', file)
    body.append('kind', kind)
    const r = await fetch(`${AI_CFG.endpoint.replace(/\/$/, '')}/document`, { method: 'POST', body })
    if (!r.ok) throw new Error(String(r.status))
    const j = (await r.json()) as { fields?: ReadField[] }
    return { fields: j.fields ?? [], source: 'model', note: j.fields?.length ? `قُرئ ${j.fields.length} حقل من الوثيقة` : 'لم يُعثر على حقول في الوثيقة' }
  } catch {
    const here = await readHere(file, kind, typed)
    return { ...here, note: `تعذّر الوصول إلى خدمة قراءة الوثائق · ${here.note}` }
  }
}

/** The fields read that differ from what was typed · compared without spaces and with Latin digits */
export function readMismatches(fields: ReadField[], typed: Record<string, string>): ReadField[] {
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  return fields.filter((f) => typed[f.key] !== undefined && typed[f.key] !== '' && norm(typed[f.key]!) !== norm(f.value))
}
