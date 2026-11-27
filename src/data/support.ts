/* 27 Nov · the support centre (مركز الدعم) · a person reports a fault, asks for a change, or asks a
   question, from any screen, and follows it to its end.

   One store for the three kinds:
   · bug      · خلل أو عطل          · استُلم › قيد الدراسة › قيد الإصلاح › جاهز للتجربة › تم الحل
   · change   · طلب تعديل أو إضافة · استُلم › قيد الدراسة › مقبول › قيد التنفيذ › نُفّذ  (or اعتُذر عنه)
   · question · استفسار             · استُلم › أُجيب
   Apart from the stage, a report can wait on its sender (`waiting` · «بانتظار ردك»), and every reply
   from the support team counts as unread until the report is opened.

   The prototype has no support desk behind it, so the team's first move is simulated: a few seconds
   after a report is sent, it is received and given a priority. Everything else (the sender's
   replies, «تم الحل», «ما زالت المشكلة», reopening) is stored as it happens.

   Kept per signed-in person in localStorage · the list survives a reload. */

import { useSyncExternalStore } from 'react'
import { toast } from './feedback'

export type ReportKind = 'bug' | 'change' | 'question'
export type ReportStage = 'received' | 'review' | 'fixing' | 'test' | 'accepted' | 'building' | 'answered' | 'done' | 'declined'
export type Impact = 'blocked' | 'major' | 'workaround' | 'none'
export type Audience = 'me' | 'team' | 'all'
export type Approval = 'yes' | 'not-yet' | 'me'

export interface ReportMsg { from: 'me' | 'support' | 'system'; text: string; at: string; images?: string[] }
export interface ReportImage { name: string; url: string }
export interface ReportPage { label: string; path: string; trail?: string }

export interface Report {
  id: string
  kind: ReportKind
  title: string
  page?: ReportPage
  /** bug · what happened, what was expected, how much it stops the work */
  what?: string
  expect?: string
  impact?: Impact
  /** change · what to change or add, why it's needed, who gains, who approved it */
  want?: string
  need?: string
  who?: Audience
  approval?: Approval
  approvedBy?: string
  /** question */
  ask?: string
  /** The error the screen showed, when the report started from it */
  code?: string
  images: ReportImage[]
  shot: boolean
  meta: Record<string, string>
  by: string
  at: string
  stage: ReportStage
  /** What the team asked the sender · the report waits on them */
  waiting?: string
  /** What changed, said when it's ready to test */
  fixNote?: string
  fixTo?: string
  priority?: 'عالية' | 'متوسطة' | 'منخفضة'
  unread: number
  msgs: ReportMsg[]
  /** Reopening a solved report stays possible until this day */
  reopenUntil?: string
}

export const KIND_SAY: Record<ReportKind, string> = { bug: 'خلل', change: 'طلب تعديل', question: 'استفسار' }
export const KIND_LONG: Record<ReportKind, string> = { bug: 'خلل أو عطل', change: 'طلب تعديل أو إضافة', question: 'استفسار' }
export const IMPACT_SAY: Record<Impact, string> = {
  blocked: 'لا أستطيع إكمال عملي',
  major: 'تعطّل جزء مهم، ولا بديل له',
  workaround: 'لها حل مؤقت',
  none: 'لا تؤثر على عملي الآن',
}
export const WHO_SAY: Record<Audience, string> = { me: 'أنا', team: 'إدارتي', all: 'كل المستخدمين' }

/** The path a report walks, by its kind · the stage it's on is one of these */
export const PATH: Record<ReportKind, { key: ReportStage; label: string }[]> = {
  bug: [{ key: 'received', label: 'استُلم' }, { key: 'review', label: 'قيد الدراسة' }, { key: 'fixing', label: 'قيد الإصلاح' }, { key: 'test', label: 'جاهز للتجربة' }, { key: 'done', label: 'تم الحل' }],
  change: [{ key: 'received', label: 'استُلم' }, { key: 'review', label: 'قيد الدراسة' }, { key: 'accepted', label: 'مقبول' }, { key: 'building', label: 'قيد التنفيذ' }, { key: 'done', label: 'نُفّذ' }],
  question: [{ key: 'received', label: 'استُلم' }, { key: 'answered', label: 'أُجيب' }],
}

export type ReportTone = 'warn' | 'teal' | 'ok' | 'mute' | 'no' | 'brand'
/** The report's tag · what it waits on first, then its stage */
export function stateOf(r: Report): { label: string; tone: ReportTone } {
  if (r.waiting && !closed(r)) return { label: 'بانتظار ردك', tone: 'warn' }
  if (r.stage === 'declined') return { label: 'اعتُذر عنه', tone: 'no' }
  if (r.stage === 'done') return { label: r.kind === 'change' ? 'نُفّذ' : 'تم الحل', tone: 'ok' }
  if (r.stage === 'answered') return { label: 'أُجيب', tone: 'ok' }
  if (r.stage === 'test') return { label: 'جاهز للتجربة', tone: 'teal' }
  if (r.stage === 'review') return { label: r.kind === 'change' ? 'قيد الدراسة' : 'قيد الدراسة', tone: 'brand' }
  if (r.stage === 'received') return { label: 'استُلم', tone: 'mute' }
  const step = PATH[r.kind].find((s) => s.key === r.stage)
  return { label: step?.label ?? 'مفتوح', tone: 'brand' }
}
export const closed = (r: Report) => r.stage === 'done' || r.stage === 'declined' || r.stage === 'answered'

/* ---------- storage ---------- */

const KEY = 'ab-support-v1'
let who = ''
let list: Report[] = []
const subs = new Set<() => void>()
let version = 0

const nowIso = () => new Date().toISOString()
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

function seed(name: string): Report[] {
  const first = name.split(' ')[0] || name
  const base = { images: [], shot: true, meta: {}, by: name }
  return [
    {
      ...base, id: 'BL-0012', kind: 'bug', title: 'تعذّر حفظ التقييم في تبويب الدراسة', code: 'E-4F21',
      page: { label: 'ملف المشروع › تبويب الدراسة', path: '/projects/21046/study', trail: 'PRJ-2026-21046' },
      what: 'ضغطت «حفظ التقييم» في تبويب الدراسة فظهرت رسالة «تعذّر الحفظ»، ولم تُحفظ الدرجات.', expect: 'أن تُحفظ الدرجات وأنتقل إلى التوصية.',
      impact: 'major', at: minsAgo(55), stage: 'review', priority: 'عالية',
      waiting: 'هل يظهر الخطأ نفسه مع مشروع آخر؟', unread: 1,
      msgs: [
        { from: 'me', text: 'ضغطت «حفظ التقييم» في تبويب الدراسة فظهرت رسالة «تعذّر الحفظ»، ولم تُحفظ الدرجات.', at: minsAgo(55), images: ['صورة الشاشة'] },
        { from: 'system', text: 'استلمنا البلاغ وحددنا أولويته: عالية', at: minsAgo(50) },
        { from: 'support', text: `شكرًا يا ${first}. وجدنا أن الحفظ يتعطل حين تكون درجة «خبرة الجهة» فارغة. هل يظهر الخطأ نفسه مع مشروع آخر؟ وهل كانت كل الدرجات معبّأة؟`, at: minsAgo(10) },
      ],
    },
    {
      ...base, id: 'BL-0011', kind: 'change', title: 'إضافة عمود «المدينة» في قائمة الجهات',
      page: { label: 'الجهات', path: '/entities' },
      want: 'قائمة الجهات تعرض اسم الجهة ومنطقتها فقط. أحتاج فيها عمودًا للمدينة، مع الفرز والتصفية به.',
      need: 'أوزّع زيارات المشرفين بحسب المدينة كل أسبوع، وأفتح الآن ملف كل جهة لأعرف مدينتها.',
      who: 'team', approval: 'yes', approvedBy: 'عبدالله، مدير المنح',
      at: minsAgo(60 * 26), stage: 'review', unread: 0,
      msgs: [
        { from: 'me', text: 'قائمة الجهات تعرض اسم الجهة ومنطقتها فقط. أحتاج فيها عمودًا للمدينة، مع الفرز والتصفية به.', at: minsAgo(60 * 26) },
        { from: 'system', text: 'استلمنا الطلب · يُدرس قبل تنفيذه', at: minsAgo(60 * 25) },
      ],
    },
    {
      ...base, id: 'BL-0009', kind: 'bug', title: 'لا يظهر زر الاعتماد لمدير المنح',
      page: { label: 'ملف المشروع › ملف الاعتماد', path: '/projects/21042/approval', trail: 'PRJ-2026-21042' },
      what: 'رفعتُ المشروع لمدير المنح ومبلغه 200,000، ولم يظهر له زر الاعتماد مع أن حدّه 250,000.',
      impact: 'blocked', at: minsAgo(60 * 50), stage: 'test', priority: 'عالية',
      fixNote: 'يظهر زر «اعتماد» لمدير المنح حين يكون المبلغ ضمن حدّ اعتماده.', fixTo: '/projects/21042/approval', unread: 1,
      msgs: [
        { from: 'me', text: 'رفعتُ المشروع لمدير المنح ومبلغه 200,000، ولم يظهر له زر الاعتماد مع أن حدّه 250,000.', at: minsAgo(60 * 50) },
        { from: 'support', text: 'تأكدنا من المشكلة، ونعمل على إصلاحها اليوم.', at: minsAgo(60 * 46) },
        { from: 'system', text: 'أُصلح · جاهز للتجربة', at: minsAgo(120) },
      ],
    },
    {
      ...base, id: 'BL-0007', kind: 'question', title: 'كيف أعيد مشروعًا إلى المشرف؟',
      page: { label: 'المشاريع', path: '/projects' },
      ask: 'كيف أعيد مشروعًا إلى المشرف ليستكمل الدراسة؟', at: minsAgo(60 * 24 * 6), stage: 'answered', unread: 0,
      msgs: [
        { from: 'me', text: 'كيف أعيد مشروعًا إلى المشرف ليستكمل الدراسة؟', at: minsAgo(60 * 24 * 6) },
        { from: 'support', text: 'من شريط القرار أسفل ملف المشروع اختر «إعادة للمشرف» واكتب ما المطلوب، فيصله المشروع مع ملاحظتك.', at: minsAgo(60 * 24 * 5) },
      ],
    },
  ]
}

function load(name: string) {
  if (who === name) return
  who = name
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Report[]>
    list = all[name] ?? seed(name)
  } catch { list = seed(name) }
}
function save() {
  version++
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Report[]>
    /* pictures stay in this session's memory only · a picture's data would fill the storage */
    all[who] = list.map((r) => ({ ...r, images: r.images.filter((i) => !i.url.startsWith('blob:')) }))
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch { /* storage blocked · the list lives for this session */ }
  subs.forEach((f) => f())
}

export function useReports(name: string): Report[] {
  load(name)
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version, () => version)
  load(name)
  return list
}
export const reportsOf = (name: string): Report[] => { load(name); return list }
export const unreadOf = (name: string): number => reportsOf(name).reduce((n, r) => n + (r.unread ? 1 : 0), 0)

const patch = (id: string, f: (r: Report) => Report) => { list = list.map((r) => (r.id === id ? f(r) : r)); save() }

/* ---------- actions ---------- */

export function nextId(): string {
  const n = Math.max(0, ...list.map((r) => Number(r.id.replace(/\D/g, '')) || 0)) + 1
  return `BL-${String(n).padStart(4, '0')}`
}

export function submitReport(r: Omit<Report, 'id' | 'at' | 'stage' | 'unread' | 'msgs'>): Report {
  const at = nowIso()
  const first = r.kind === 'bug' ? r.what : r.kind === 'change' ? r.want : r.ask
  const out: Report = { ...r, id: nextId(), at, stage: 'received', unread: 0, msgs: [{ from: 'me', text: first ?? '', at, images: [...(r.shot ? ['صورة الشاشة'] : []), ...r.images.map((i) => i.name)] }] }
  list = [out, ...list]
  save()
  /* The support team's first move · simulated (no desk behind the prototype) */
  window.setTimeout(() => {
    const pr = r.kind === 'bug' ? (r.impact === 'blocked' ? 'عالية' : r.impact === 'major' ? 'عالية' : r.impact === 'workaround' ? 'متوسطة' : 'منخفضة') : 'متوسطة'
    patch(out.id, (x) => x.stage !== 'received' ? x : ({
      ...x, stage: 'review', priority: pr, unread: x.unread + 1,
      msgs: [...x.msgs, { from: 'system', text: r.kind === 'question' ? 'استلمنا سؤالك · نرد عليك هنا' : `استلمنا البلاغ وحددنا أولويته: ${pr}`, at: nowIso() }],
    }))
    toast(`وصل ردّ على بلاغك ${out.id}`, 'info', { key: `sup-${out.id}`, action: { label: 'افتحه', run: () => openSupport({ report: out.id }) } })
  }, 6000)
  return out
}

export function replyTo(id: string, text: string, images: string[] = []) {
  patch(id, (r) => ({ ...r, waiting: undefined, stage: r.stage === 'answered' ? 'received' : r.stage, msgs: [...r.msgs, { from: 'me', text, at: nowIso(), images }] }))
}
export function markRead(id: string) {
  const r = list.find((x) => x.id === id)
  if (r?.unread) patch(id, (x) => ({ ...x, unread: 0 }))
}
export function confirmFixed(id: string) {
  const until = new Date(Date.now() + 5 * 864e5).toISOString()
  patch(id, (r) => ({ ...r, stage: 'done', waiting: undefined, reopenUntil: until, msgs: [...r.msgs, { from: 'system', text: 'أكّدتَ أن المشكلة حُلّت · أُغلق البلاغ', at: nowIso() }] }))
}
export function notFixed(id: string, note: string) {
  patch(id, (r) => ({ ...r, stage: 'fixing', msgs: [...r.msgs, { from: 'me', text: note, at: nowIso() }, { from: 'system', text: 'ما زالت المشكلة · أُعيد البلاغ للإصلاح', at: nowIso() }] }))
}
export function reopen(id: string, note: string) {
  patch(id, (r) => ({ ...r, stage: 'review', reopenUntil: undefined, msgs: [...r.msgs, { from: 'me', text: note, at: nowIso() }, { from: 'system', text: 'أُعيد فتح البلاغ', at: nowIso() }] }))
}
export const canReopen = (r: Report) => r.stage === 'done' && Boolean(r.reopenUntil && r.reopenUntil > nowIso())

/* ---------- opening the centre from anywhere ---------- */

export interface SupportOpen {
  /** Open on one report */
  report?: string
  /** Open «بلاغاتي» */
  mine?: boolean
  /** Start a fault report from an error the screen showed */
  error?: { text: string; code: string }
}
const OPEN = 'ab:support'
export function openSupport(o: SupportOpen = {}) {
  window.dispatchEvent(new CustomEvent<SupportOpen>(OPEN, { detail: o }))
}
export const onSupport = (fn: (o: SupportOpen) => void) => {
  const h = (e: Event) => fn((e as CustomEvent<SupportOpen>).detail)
  window.addEventListener(OPEN, h)
  return () => window.removeEventListener(OPEN, h)
}

/** A stable short code for an error message · the same message reads the same code */
export function errorCode(text: string): string {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `E-${(h & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`
}

/* ---------- the pages the person was on ---------- */

const TRAIL = 'ab-support-trail'
export interface PageVisit { label: string; path: string; trail?: string; at: string }
/** What this screen is called, read from the page itself · its path, or its title */
export function pageHere(): ReportPage {
  const crumbs = [...document.querySelectorAll('.crumbs a, .crumbs span[aria-current], .crumbs b')].map((x) => x.textContent?.trim()).filter(Boolean) as string[]
  const title = document.querySelector('.ptitle')?.textContent?.trim()
  const tab = document.querySelector('.tabs [aria-selected="true"], .tab.on')?.textContent?.replace(/\d+/g, '').trim()
  const parts = crumbs.length ? crumbs : title ? [title] : [document.title]
  if (tab && !parts.includes(tab)) parts.push(`تبويب ${tab}`)
  const code = location.pathname.split('/').find((s) => /\d/.test(s))
  return { label: parts.join(' › '), path: location.pathname + location.search, trail: code }
}
export function notePage() {
  try {
    const here = pageHere()
    const all = (JSON.parse(sessionStorage.getItem(TRAIL) ?? '[]') as PageVisit[]).filter((p) => p.path !== here.path)
    sessionStorage.setItem(TRAIL, JSON.stringify([{ ...here, at: nowIso() }, ...all].slice(0, 8)))
  } catch { /* storage blocked */ }
}
/** The pages opened before this one, newest first */
export function recentPages(): PageVisit[] {
  try {
    const here = location.pathname + location.search
    return (JSON.parse(sessionStorage.getItem(TRAIL) ?? '[]') as PageVisit[]).filter((p) => p.path !== here).slice(0, 5)
  } catch { return [] }
}
