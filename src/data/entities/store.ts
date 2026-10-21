import { done } from '@/data/feedback'
import { useSyncExternalStore } from 'react'
import type { EntityRow, EntityActivation, EntityDecision } from '@/types/domain'
import type { BankAccount, EntityDoc, EntityEvent } from '@/data/mock/entityDetail'
import { entityRows } from '@/data/mock/entities'
import { projectRows } from '@/data/mock/projects'
import { agreements } from '@/data/mock/agreements'
import { payRequests } from '@/data/mock/disbursements'
import { banksOf } from '@/data/mock/payEntity'
import { closeRows } from '@/data/mock/closing'
import { planRows } from '@/data/mock/plans'
import {
  BANK_DOC_LABEL, REG_DOCS, REG_REJECT_REASONS, licenseClash, regRows, type RegBank, type RegEvent, type RegRejectReason, type RegRequest, type RegState,
} from '@/data/mock/registration'
import { ENTITY_DOCS } from '@/data/mock/taxonomy'
import type { RoleKey } from '@/data/roles'
import { ENTITY_RULES, fileField, needsApproval } from './rules'
import { licenseDup, setEntityIbans, todayIso } from './validate'
import { ROUTES } from '@/app/routes'

/* Beneficiary entities and their registration (BPD-002) · the actions.

   Registration requests, the entities they create, their status, bank accounts and the requests
   that update them all go through here, so each action has the effect the document gives it: the
   request moves, the entity changes, and the step is written to the request's own history and the
   entity's log with the value before and after.

   Same model as the intake module: an ordered list of operations kept in the browser and replayed
   at load (with the time each one happened), so a reload or a second tab lands on the same state;
   in production each operation is a POST. Settings has a reset for the demo. */

/* ── Overlay on the generated entity file ── */

export interface EntityOverlay {
  /** Detail fields the generator would otherwise invent · set from a request or an approved update */
  fields: Record<string, string>
  /** A whole bank list · for an entity created here, whose accounts come from its request */
  banks?: BankAccount[]
  addedBanks: BankAccount[]
  bankStatus: Record<string, { status: BankAccount['status']; reason?: string }>
  /** A whole document list · for an entity created here */
  docs?: EntityDoc[]
  /** Renewed copies, by document name */
  renewed: Record<string, { at: string; expires?: string; file: string }>
  events: EntityEvent[]
  /** The reason given with the last status decision */
  statusReason?: string
  /** v3 · 2.4.2 · the update request under review that holds the account «معلق» */
  pending?: string
  /** The account went «غير نشط» for an expired document · its return reads as a re-activation */
  lapsedOut?: boolean
  /** 14 Oct · accounts removed for good · only one with no financial history (rule 28) */
  deletedBanks?: string[]
}

const OVERLAY = new Map<string, EntityOverlay>()

export const overlayOf = (id: string): EntityOverlay => {
  let o = OVERLAY.get(id)
  if (!o) {
    o = { fields: {}, addedBanks: [], bankStatus: {}, renewed: {}, events: [] }
    OVERLAY.set(id, o)
  }
  return o
}

/* The duplicate-IBAN check reads the accounts on each entity's own file (2.4.10) */
setEntityIbans((id) => {
  const o = OVERLAY.get(id)
  return o ? [...(o.banks ?? []), ...o.addedBanks].map((b) => b.iban) : []
})

/* ── Update requests (2.3.upd) ── */

export type UpdState = 'draft' | 'review' | 'completion' | 'approved' | 'rejected'

export const UPD_STATE_SAY: Record<UpdState, string> = {
  draft: 'مسودة',
  review: 'تحت المراجعة',
  completion: 'بانتظار الاستكمال',
  approved: 'معتمد',
  rejected: 'مرفوض',
}

export interface Change { key: string; label: string; from: string; to: string; direct: boolean }
export interface UpdDoc { key: string; label: string; file: string; expires?: string }

export interface UpdateRequest {
  id: string
  entityId: string
  entityName: string
  state: UpdState
  /** Re-audit 7 Oct · each new account's decision · empty = accepted, else the reason */
  bankDecisions?: Record<string, string>
  changes: Change[]
  banks: RegBank[]
  docs: UpdDoc[]
  by: string
  createdAt: string
  submittedAt?: string
  decidedAt?: string
  note?: string
  events: RegEvent[]
}

export const UPD_ROWS: UpdateRequest[] = []

/* Cross · notifications · what the entity is told at each step of its registration and update
   requests (2.2.11 · 2.2.16 · 2.3.upd-20). Read by the notification hub, which sends each one on the
   channels the settings give the entity (in-app on the portal, email, SMS). */
export interface EntityNote { id: string; to: string; title: string; context: string; at: string; href: string; topic: 'registration' | 'update' | 'status' }
export const ENTITY_NOTES: EntityNote[] = []
const enote = (to: string, topic: EntityNote['topic'], title: string, context: string, at: string, href: string, id?: string) => {
  if (id && ENTITY_NOTES.some((n) => n.id === id)) return
  ENTITY_NOTES.unshift({ id: id ?? `en-${ENTITY_NOTES.length + 1}`, to, topic, title, context, at: at.slice(0, 10), href })
}

/* ── 14 Oct · actions on a selection (LOCTech «الإجراءات عند التحديد») ──

   What staff ask of an entity from the list: to update its data, a message, a request handed to a
   supervisor. None changes a status. Each one done on more than one entity is a batch: one master
   record (who, when, how many, what was left out and why) and one line on each entity's log that
   names the batch, so the audit log reads both ways. */

export interface DataAsk { id: string; entityId: string; items: string[]; due: string; reason: string; note?: string; batch?: string; at: string; by: string }
export const DATA_ASKS: DataAsk[] = []

export type BatchAct = 'ask' | 'notify' | 'assign' | 'export'
export const BATCH_SAY: Record<BatchAct, string> = { ask: 'طلب تحديث البيانات', notify: 'إرسال إشعار', assign: 'إسناد المراجعة', export: 'تصدير المحدد' }
export interface BatchSkip { reason: string; ids: string[] }
export interface Batch { id: string; act: BatchAct; at: string; by: string; ok: string[]; skipped: BatchSkip[]; failed: string[]; note?: string }
export const BATCHES: Batch[] = []

/** Open requests handed to a supervisor · request id → name */
export const ASSIGNED: Record<string, string> = {}

/** v3 · 2.4.10 · 2.4.11 · a running project moved to another entity · kept for good with both ends */
export interface Relink {
  id: string; projectId: string; projectName: string
  from: { id: string; name: string }; to: { id: string; name: string }
  reason: string; file?: string; by: string; at: string
  /** The records the move carried · agreements, payment requests, plans, closings */
  touched: { agreements: number; payments: number; plans: number; closings: number }
}
export const RELINKS: Relink[] = []
export const relinksOf = (projectId: string): Relink[] => RELINKS.filter((r) => r.projectId === projectId)
const LATE: Op[] = []
/* The agreements store renames the party in an agreement's clauses · handed in at its load */
let partyRename: (agreementId: string, from: string, to: string) => void = () => {}
export const setPartyRename = (f: typeof partyRename): void => { partyRename = f }
const renameParty = (agreementId: string, from: string, to: string) => partyRename(agreementId, from, to)
let bankSource: (entityId: string) => { name: string; active: boolean } | undefined = () => undefined
const COUNTER: Partial<Record<string, 'projectsRunning' | 'projectsStalled' | 'projectsCompleted' | 'projectsDeclined'>> = {
  'معتمد': 'projectsRunning', 'استكمال متطلبات ما قبل التنفيذ': 'projectsRunning', 'تحت التنفيذ': 'projectsRunning', 'قيد الإغلاق': 'projectsRunning',
  'متعثر': 'projectsStalled', 'مكتمل': 'projectsCompleted', 'مغلق بوفر': 'projectsCompleted', 'أعيد توجيه الدعم': 'projectsCompleted',
  'مرفوض': 'projectsDeclined', 'ملغى': 'projectsDeclined',
}

/** The impact a suspension or revocation carried · kept with the decision */
export interface StatusMeta { code: string; decision?: string; proof?: string; projects?: string[]; payments?: string[] }

/* ── Operations ── */

type Op = { at: string } & (
  | { op: 'regDraft'; id: string; email: string; values: Record<string, string>; banks: RegBank[]; docs: string[]; files: RegRequest['files'] }
  | { op: 'regSubmit'; id: string; email: string; values: Record<string, string>; banks: RegBank[]; docs: string[]; files: RegRequest['files'] }
  | { op: 'regReturn'; id: string; note: string; fields: string[]; by: string }
  | { op: 'regResubmit'; id: string; values: Record<string, string>; docs: string[]; by: string }
  | { op: 'regDecide'; id: string; outcome: 'approve' | 'reject'; note: string; banks: Record<string, string>; reason?: RegRejectReason; by: string }
  | { op: 'internal'; values: Record<string, string>; docs: string[]; partner: string; by: string; banks?: RegBank[] }
  /* `to` · 'suspension' | 'revoked' | 'lift' · a file saved before 15 Oct carries the old account
     names («معلق (موقوف)» · «ملغى الاعتماد» · «نشط») and replays as the same decision */
  | { op: 'status'; entityId: string; to: string; reason: string; by: string; meta?: StatusMeta }
  | { op: 'archive'; entityId: string; on: boolean; reason: string; by: string; code?: string }
  | { op: 'ask'; ids: string[]; items: string[]; due: string; reason: string; note?: string; by: string; batch?: Omit<Batch, 'at' | 'by' | 'act' | 'ok'> }
  | { op: 'notify'; ids: string[]; title: string; text: string; channel: string; template: string; by: string; batch?: Omit<Batch, 'at' | 'by' | 'act' | 'ok'> }
  | { op: 'assign'; reqs: { reqId: string; entityId: string }[]; to: string; by: string; batch?: Omit<Batch, 'at' | 'by' | 'act' | 'ok'> }
  | { op: 'export'; ids: string[]; cols: number; scope: string; by: string; batch?: Omit<Batch, 'at' | 'by' | 'act' | 'ok'> }
  | { op: 'bankDelete'; entityId: string; bankId: string; reason: string; by: string }
  | { op: 'reviewStart'; reqId: string; by: string }
  | { op: 'viewArchived'; entityId: string; by: string }
  | { op: 'relink'; projectId: string; to: string; reason: string; file?: string; by: string; bank?: { name: string; active: boolean } }
  | { op: 'bankStatus'; entityId: string; bankId: string; status: BankAccount['status']; reason?: string; by: string }
  | { op: 'updSave'; req: Omit<UpdateRequest, 'events' | 'state' | 'createdAt' | 'submittedAt'>; send: boolean }
  | { op: 'updDecide'; id: string; outcome: 'approve' | 'reject' | 'return'; note: string; by: string; bankNo?: Record<string, string> }
  | { op: 'adminEdit'; entityId: string; changes: Change[]; reason: string; by: string }
)

const KEY = 'ab-entity-ops'
let lastInternal = ''
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }

export function useEntityFlow(): number {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f) } },
    () => version,
  )
}

const now = () => new Date().toISOString()
const day = (at: string) => at.slice(0, 10)
const time = (at: string) => at.slice(11, 16) || '09:00'

const entityEvent = (id: string, ev: Omit<EntityEvent, 'id' | 'at' | 'time'> & { at: string }) => {
  const o = overlayOf(id)
  o.events.unshift({ ...ev, id: `x${o.events.length + 1}-${ev.at}`, at: day(ev.at), time: time(ev.at) })
}

const nextReqId = () => {
  const n = Math.max(...regRows.map((r) => Number(r.id.slice(-6)) || 0)) + 1
  return `REQ-2026-${String(n).padStart(6, '0')}`
}
export const nextRegId = nextReqId

const nextEntityId = () => String(Math.max(...entityRows.map((e) => Number(e.id) || 0)) + 1)

/** Registration documents → the entity file's eight (the closest one; the rest start empty) */
const DOC_MAP: Record<string, number> = { license: 0, activity: 1, zakat: 2, board: 5, auditor: 6 }

const requestFromValues = (id: string, email: string, v: Record<string, string>, banks: RegBank[], docs: string[], files: RegRequest['files'], state: RegState, at: string): RegRequest => ({
  id,
  name: v.name ?? '',
  type: v.type ?? '',
  licensor: v.licensor ?? '',
  region: v.region ?? '',
  city: v.city ?? '',
  licenseNo: v.licenseNo ?? '',
  foundedAt: v.foundedAt ?? '',
  licenseEndsAt: v.licenseEndsAt ?? '',
  boardEndsAt: v.boardEndsAt ?? '',
  mobile: v.mobile ?? '',
  email: v.email ?? '',
  directorName: v.directorName ?? '',
  clerkName: v.clerkName ?? '',
  clerkMobile: v.clerkMobile ?? '',
  clerkEmail: v.clerkEmail ?? '',
  phone: v.phone,
  website: v.website,
  directorMobile: v.directorMobile,
  governanceClaim: Number(v.governanceClaim) || 0,
  partner: 'beneficiary',
  banks: structuredClone(banks),
  acctEmail: email,
  docs: [...docs],
  files: files ? structuredClone(files) : undefined,
  state,
  submittedAt: day(at),
  events: [],
  version: 1,
})

/** The request's values as a flat record · what the form edits on a return */
export const valuesOf = (r: RegRequest): Record<string, string> => ({
  name: r.name, type: r.type, licensor: r.licensor, region: r.region, city: r.city, licenseNo: r.licenseNo,
  foundedAt: r.foundedAt, licenseEndsAt: r.licenseEndsAt, boardEndsAt: r.boardEndsAt,
  phone: r.phone ?? '', mobile: r.mobile, email: r.email, website: r.website ?? '',
  directorName: r.directorName, directorMobile: r.directorMobile ?? '', clerkName: r.clerkName,
  clerkMobile: r.clerkMobile, clerkEmail: r.clerkEmail,
})

const writeValues = (r: RegRequest, v: Record<string, string>) => {
  const keys = Object.keys(valuesOf(r)) as (keyof RegRequest)[]
  for (const k of keys) if (k in v) (r as unknown as Record<string, unknown>)[k] = v[k as string]
}

const LABEL: Record<string, string> = {
  name: 'اسم الجهة', type: 'تصنيف الجهة', licensor: 'جهة الإشراف الفني', region: 'المنطقة', city: 'المحافظة / المدينة',
  licenseNo: 'رقم الترخيص', foundedAt: 'تاريخ التأسيس', licenseEndsAt: 'تاريخ نهاية الترخيص', boardEndsAt: 'تاريخ انتهاء تكليف المجلس',
  phone: 'الهاتف', mobile: 'جوال الجهة', email: 'البريد الإلكتروني للجهة', website: 'الموقع الإلكتروني',
  directorName: 'اسم المدير التنفيذي', directorMobile: 'جوال المدير التنفيذي', clerkName: 'اسم مدخل البيانات',
  clerkMobile: 'جوال مدخل البيانات', clerkEmail: 'بريد مدخل البيانات',
}
export const fieldLabel = (k: string): string => LABEL[k] ?? fileField(k)?.label ?? k

/** Create the entity from an approved request (2.1.output-1 · 2.2.16 · 2.4.17) */
const createEntity = (r: RegRequest, bankDecisions: Record<string, string>, by: string, at: string): string => {
  const id = nextEntityId()
  const row: EntityRow = {
    id, name: r.name, licenseNo: r.licenseNo, type: r.type, licensor: r.licensor, region: r.region, city: r.city,
    registeredAt: day(at), licenseEndsAt: r.licenseEndsAt || day(at), activation: 'نشط', governance: 'لم تُقيَّم',
    docsUploaded: 0, projectsApproved: 0, projectsRunning: 0, projectsDeclined: 0, projectsStalled: 0, projectsCompleted: 0,
    grantedThisYear: 0, grantedTotal: 0, inDisbursement: 0, mobile: r.mobile, email: r.email, canApply: true,
  }
  entityRows.push(row)
  const o = overlayOf(id)
  o.fields = {
    foundedAt: r.foundedAt, boardMandateEndsAt: r.boardEndsAt, phone: r.phone ?? '', website: r.website ?? '',
    directorName: r.directorName, directorMobile: r.directorMobile ?? r.mobile, clerkName: r.clerkName,
    clerkMobile: r.clerkMobile, clerkEmail: r.clerkEmail, username: r.acctEmail, userNo: `U-${id}`,
    accountType: 'جهة مستفيدة', adminNote: '', updatedAt: day(at),
  }
  o.banks = r.banks.map((b, i) => ({
    id: `${id}-b${i + 1}`, bank: b.bankName, shortName: b.shortName, accountName: b.bankHolder, iban: b.iban,
    status: bankDecisions[b.id] ? 'غير مفعل' : 'مفعل', reason: bankDecisions[b.id] || undefined,
    certificate: b.doc || `${BANK_DOC_LABEL}.pdf`,
  }))
  o.docs = ENTITY_DOCS.map((name, i) => {
    const regKey = Object.entries(DOC_MAP).find(([, at2]) => at2 === i)?.[0]
    const has = regKey ? r.docs.includes(regKey) : i === 7 && r.banks.some((b) => b.doc)
    if (!has) return { name, uploaded: false }
    const expires = regKey === 'license' ? r.licenseEndsAt : regKey === 'board' ? r.boardEndsAt : undefined
    return { name, uploaded: true, at: day(at), expires, expired: Boolean(expires && expires < todayIso()) }
  })
  row.docsUploaded = o.docs.filter((d) => d.uploaded).length
  r.entityId = id
  entityEvent(id, { kind: 'reg', action: 'تسجيل جهة جديدة من البوابة', by: r.clerkName || r.name, at: r.submittedAt + 'T09:00',
    fields: [{ k: 'طلب التسجيل', v: r.id }, { k: 'التصنيف', v: r.type }, { k: 'رقم الترخيص', v: r.licenseNo }] })
  entityEvent(id, { kind: 'accept', action: 'اعتماد وتفعيل · إنشاء الملف الموحد', by, at,
    fields: [{ k: 'حالة الحساب', v: 'نشط' }, { k: 'صلاحية التقديم', v: 'مُنحت' }, { k: 'اسم المستخدم', v: r.acctEmail }] })
  return id
}

/** Mandatory documents out of date · the license on the row, or the board mandate on the file */
const mandatoryExpired = (e: EntityRow): string[] => {
  const today = todayIso()
  const o = OVERLAY.get(e.id)
  const out: string[] = []
  if (e.licenseEndsAt && e.licenseEndsAt < today) out.push('الترخيص')
  const board = o?.fields.boardMandateEndsAt
  if (board && board < today) out.push('قرار تكليف المجلس')
  return out
}
export const expiredMandatory = mandatoryExpired

/**
 * 2.4.20 · an active entity whose mandatory document lapses becomes inactive on its own, and comes
 * back when the renewed copy is approved · the only status the system changes without a person
 */
/** The day after a mandatory document lapsed · the transition's own date */
const lapseDay = (e: EntityRow): string | undefined => {
  const today = todayIso()
  const ends = [e.licenseEndsAt, OVERLAY.get(e.id)?.fields.boardMandateEndsAt].filter((d): d is string => Boolean(d) && d! < today).sort()
  if (!ends[0]) return undefined
  const d = new Date(`${ends[0].slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return `${d.toISOString().slice(0, 10)}T00:00`
}

/** v3's account from what holds it (0.ent.6–9 · 2.4.2) · a decision or an expired mandatory document
    makes it «غير نشط», an update under review «معلق», nothing «نشط» · archiving sits on top */
const accountFrom = (e: EntityRow): EntityActivation =>
  e.decision || mandatoryExpired(e).length ? 'غير نشط' : OVERLAY.get(e.id)?.pending ? 'معلق' : 'نشط'

/** Bring the stored account in line with what holds it · the one place the account changes */
const settle = (e: EntityRow, now: string) => {
  const to = accountFrom(e)
  const from = e.activation
  const lapsed = mandatoryExpired(e)
  /* Batch 3 · 8 Oct · the rule runs on every load (the rows are rebuilt from the seed), and it was
     stamped with the load's time · so each reload wrote the transition again, dated today, with a
     fresh notice to the entity. It now carries the day the document lapsed, and the notice its own
     id, so every load rebuilds the same one event and the same one notice. */
  if (!e.archived && to !== from && to === 'غير نشط' && lapsed.length && !e.decision) {
    const at = lapseDay(e) ?? now
    entityEvent(e.id, { kind: 'stop', action: 'تحويل آلي إلى «غير نشط»', by: 'النظام', at,
      note: `انتهت صلاحية ${lapsed.join(' و')} · لا تقديم ولا صرف حتى تُحدَّث بالنسخة السارية.`,
      fields: [{ k: 'حالة الحساب', v: `${from} ← غير نشط` }] })
    /* Re-audit 7 Oct · 2.3.upd-19 · the entity is told which documents to update */
    enote(e.name, 'status', 'تحوّل حساب جهتك إلى «غير نشط»', `انتهت صلاحية ${lapsed.join(' و')} · قدّم طلب تحديث بالنسخة السارية`, at, `${ROUTES.entityUpdate}?entity=${e.id}`, `en-auto-${e.id}-${at.slice(0, 10)}`)
  } else if (!e.archived && from === 'غير نشط' && to !== 'غير نشط' && !lapsed.length && !e.decision && OVERLAY.get(e.id)?.lapsedOut) {
    entityEvent(e.id, { kind: 'accept', action: 'إعادة التفعيل بعد تحديث الوثائق', by: 'النظام', at: now,
      fields: [{ k: 'حالة الحساب', v: `غير نشط ← ${to}` }] })
  }
  if (lapsed.length && !e.decision) overlayOf(e.id).lapsedOut = true
  else if (OVERLAY.get(e.id)) OVERLAY.get(e.id)!.lapsedOut = false
  e.activation = to
  /* 2.4.22 · new requests only on an active account that isn't archived */
  e.canApply = to === 'نشط' && !e.archived
}

/** v3 · 0.ent.8 · 2.4.22 · may this entity be paid now · the answer and why not */
export const payBlock = (e: EntityRow | undefined): string => {
  if (!e) return ''
  if (e.archived) return 'الجهة مؤرشفة · لا صرف لجهة مؤرشفة'
  if (e.activation !== 'غير نشط') return ''
  if (e.decision === 'revoked') return 'اعتماد الجهة ملغى · لا صرف حتى يُبتّ في وضعها'
  if (e.decision === 'suspension') return 'أهلية الجهة معلّقة بقرار · لا صرف حتى رفع التعليق'
  const lapsed = mandatoryExpired(e)
  return `حساب الجهة غير نشط · انتهت صلاحية ${lapsed.join(' و') || 'مستند إلزامي'} · لا صرف حتى تحديثه`
}

const applyChange = (e: EntityRow, c: Change) => {
  const o = overlayOf(e.id)
  const rowKeys: (keyof EntityRow)[] = ['name', 'type', 'licensor', 'licenseNo', 'region', 'city', 'licenseEndsAt', 'mobile', 'email', 'governance']
  if ((rowKeys as string[]).includes(c.key)) (e as unknown as Record<string, unknown>)[c.key] = c.to
  else o.fields[c.key === 'boardEndsAt' ? 'boardMandateEndsAt' : c.key] = c.to
  o.fields.updatedAt = todayIso()
}

const apply = (x: Op) => {
  const at = x.at
  switch (x.op) {
    case 'regDraft': {
      let r = regRows.find((y) => y.id === x.id)
      if (!r) { r = requestFromValues(x.id, x.email, x.values, x.banks, x.docs, x.files, 'draft', at); regRows.unshift(r) }
      else { writeValues(r, x.values); r.banks = structuredClone(x.banks); r.docs = [...x.docs]; r.files = x.files }
      r.events = [...(r.events ?? []), { kind: 'draft', action: 'حفظ مسودة', by: x.values.clerkName || x.email, at }]
      break
    }
    case 'regSubmit': {
      let r = regRows.find((y) => y.id === x.id)
      if (!r) { r = requestFromValues(x.id, x.email, x.values, x.banks, x.docs, x.files, 'review', at); regRows.unshift(r) }
      else { writeValues(r, x.values); r.banks = structuredClone(x.banks); r.docs = [...x.docs]; r.files = x.files; r.state = 'review'; r.submittedAt = day(at) }
      r.events = [...(r.events ?? []),
        { kind: 'otp', action: 'تأكيد الإرسال برمز التحقق', by: x.values.clerkName || x.email, at, note: `جوال ${x.values.clerkMobile || ''}` },
        { kind: 'submit', action: 'إرسال الطلب للمراجعة', by: x.values.clerkName || x.email, at }]
      enote(r.name, 'registration', 'استلمنا طلب تسجيلك', `الطلب ${r.id} تحت المراجعة · نبلغك بالنتيجة`, at, ROUTES.entityPortal)
      break
    }
    case 'regReturn': {
      const r = regRows.find((y) => y.id === x.id)
      if (!r) break
      r.state = 'completion'; r.note = x.note; r.returnFields = x.fields
      r.events = [...(r.events ?? []), { kind: 'return', action: 'إعادة للاستكمال', by: x.by, at, note: x.note,
        fields: x.fields.length ? [{ k: 'الحقول المطلوب تعديلها', v: x.fields.map(fieldLabel).join('، ') }] : undefined }]
      enote(r.name, 'registration', 'أُعيد طلب تسجيلك للاستكمال', x.note, at, ROUTES.entityPortal)
      break
    }
    case 'regResubmit': {
      const r = regRows.find((y) => y.id === x.id)
      if (!r) break
      const before = valuesOf(r)
      writeValues(r, x.values)
      r.docs = [...new Set([...r.docs, ...x.docs])]
      r.state = 'review'; r.version = (r.version ?? 1) + 1; r.returnFields = []
      const changed = Object.keys(x.values).filter((k) => before[k] !== x.values[k])
      r.events = [...(r.events ?? []), { kind: 'resubmit', action: `إعادة الإرسال · الإصدار ${r.version}`, by: x.by, at,
        fields: [
          ...changed.map((k) => ({ k: fieldLabel(k), v: `${before[k] || '—'} ← ${x.values[k] || '—'}` })),
          ...(x.docs.length ? [{ k: 'مستندات أُضيفت', v: x.docs.map((d) => REG_DOCS.find((y) => y.key === d)?.label ?? d).join('، ') }] : []),
        ] }]
      break
    }
    case 'regDecide': {
      const r = regRows.find((y) => y.id === x.id)
      if (!r || r.state !== 'review') break
      r.bankDecisions = x.banks; r.decidedAt = day(at); r.decidedBy = x.by; r.note = x.note || r.note
      const bankFields = r.banks.map((b) => ({ k: `${b.bankName} · ${b.shortName || b.iban}`, v: x.banks[b.id] ? `مرفوض · ${x.banks[b.id]}` : 'مقبول' }))
      if (x.outcome === 'approve') {
        r.state = 'approved'
        const id = createEntity(r, x.banks, x.by, at)
        r.events = [...(r.events ?? []), { kind: 'approve', action: 'اعتماد وتفعيل', by: x.by, at, note: x.note || undefined,
          fields: [{ k: 'الجهة', v: id }, ...bankFields] }]
        enote(r.name, 'registration', 'اعتُمد تسجيل جهتك', `أصبح حسابك نشطًا · رقم الجهة ${id}${x.note ? ` · ${x.note}` : ''}`, at, ROUTES.entityPortal)
      } else {
        r.state = 'rejected'
        r.rejectReason = x.reason ?? 'other'
        const why = REG_REJECT_REASONS.find((y) => y.key === r.rejectReason)?.label ?? ''
        r.events = [...(r.events ?? []), { kind: 'reject', action: 'رفض وإيقاف · أُرشف الطلب', by: x.by, at, note: x.note, fields: [{ k: 'سبب الرفض', v: why }, ...bankFields] }]
        enote(r.name, 'registration', 'قرار طلب التسجيل · مرفوض', x.note, at, ROUTES.entityPortal)
      }
      break
    }
    case 'internal': {
      /* 2.4.32 · registered from inside by an authorized user · active on save, no request to review */
      /* Re-audit 7 Oct · the internal form carries the bank accounts too · it created entities with none */
      const r = requestFromValues('—', x.values.email ?? '', x.values, x.banks ?? [], x.docs, undefined, 'approved', at)
      const id = createEntity(r, {}, x.by, at)
      const o = overlayOf(id)
      o.fields.accountType = x.partner
      o.events = o.events.filter((ev) => ev.kind !== 'reg')
      o.events[0] = { ...o.events[0], action: 'تسجيل داخلي · الجهة نشطة فور الحفظ', fields: [{ k: 'نوع الشراكة', v: x.partner }, { k: 'حالة الحساب', v: 'نشط' }] }
      /* Client 20 Oct (#41) · an external party is a reference record · the external-project form lists it */
      if (x.partner === 'جهة خارجية') {
        const er = entityRows.find((y) => y.id === id)
        const b = (x.banks ?? [])[0]
        if (er) er.external = { transfer: b ? `${b.bankName} · ${b.bankHolder} · ${b.iban}` : undefined, by: x.by, at }
      }
      lastInternal = id
      break
    }
    case 'status': {
      const e = entityRows.find((y) => y.id === x.entityId)
      if (!e) break
      const from = e.activation
      const kind: EntityDecision | null = x.to === 'revoked' || x.to === 'ملغى الاعتماد' ? 'revoked'
        : x.to === 'suspension' || x.to === 'معلق (موقوف)' ? 'suspension' : null
      e.decision = kind ?? undefined
      e.activation = accountFrom(e)
      e.canApply = e.activation === 'نشط' && !e.archived
      overlayOf(e.id).statusReason = x.reason
      overlayOf(e.id).fields.adminNote = x.reason
      entityEvent(e.id, {
        kind: !kind ? 'accept' : kind === 'revoked' ? 'reject' : 'stop',
        action: !kind ? 'رفع تعليق الأهلية' : kind === 'revoked' ? 'إلغاء اعتماد الجهة' : 'تعليق الأهلية',
        by: x.by, at, note: x.reason, fields: [{ k: 'حالة الحساب', v: `${from} ← ${e.activation}` }],
      })
      if (x.meta) {
        const ev = overlayOf(e.id).events[0]
        ev.fields = [...(ev.fields ?? []),
          { k: 'رمز السبب', v: x.meta.code },
          ...(x.meta.decision ? [{ k: 'رقم القرار', v: x.meta.decision }] : []),
          ...(x.meta.proof ? [{ k: 'الإثبات', v: x.meta.proof }] : []),
          ...(x.meta.projects ? [{ k: 'المشاريع المتأثرة', v: x.meta.projects.length ? `${x.meta.projects.length} · ${x.meta.projects.join('، ')}` : '0' }] : []),
          ...(x.meta.payments ? [{ k: 'الدفعات الموقوفة', v: x.meta.payments.length ? `${x.meta.payments.length} · ${x.meta.payments.join('، ')}` : '0' }] : []),
        ]
      }
      enote(e.name, 'status', !kind ? 'رُفع تعليق أهلية جهتك' : kind === 'revoked' ? 'أُلغي اعتماد جهتك' : 'عُلّقت أهلية جهتك', x.reason, at, ROUTES.entityPortal)
      /* Lifting a suspension doesn't clear another block · an expired document keeps it inactive */
      settle(e, at)
      break
    }
    case 'archive': {
      const e = entityRows.find((y) => y.id === x.entityId)
      if (!e) break
      e.archived = x.on
      settle(e, at)
      entityEvent(e.id, { kind: x.on ? 'stop' : 'accept', action: x.on ? 'أرشفة الجهة' : 'استعادة الجهة من الأرشيف', by: x.by, at, note: x.reason,
        fields: x.on ? [...(x.code ? [{ k: 'رمز السبب', v: x.code }] : []), { k: 'الفحص المسبق', v: 'مشاريع قائمة 0 · دفعات معلّقة 0 · طلبات مفتوحة 0' }] : undefined })
      break
    }
    case 'ask': {
      const bid = x.batch?.id
      for (const id of x.ids) {
        const e = entityRows.find((y) => y.id === id)
        if (!e) continue
        DATA_ASKS.unshift({ id: `ASK-${DATA_ASKS.length + 1}`, entityId: id, items: x.items, due: x.due, reason: x.reason, note: x.note, batch: bid, at, by: x.by })
        entityEvent(id, { kind: 'edit', action: 'طلب تحديث البيانات من الجهة', by: x.by, at, note: x.reason,
          fields: [{ k: 'البنود المطلوبة', v: x.items.join('، ') }, { k: 'تاريخ الاستحقاق', v: x.due }, ...(bid ? [{ k: 'الدفعة', v: bid }] : []), { k: 'الإشعار', v: `en-ask-${id}-${at}` }] })
        enote(e.name, 'update', 'مطلوب تحديث بيانات جهتك', `${x.items.join('، ')} · قبل ${x.due} · ${x.reason}`, at, `${ROUTES.entityUpdate}?entity=${id}`, `en-ask-${id}-${at}`)
      }
      if (x.batch) BATCHES.unshift({ ...x.batch, act: 'ask', at, by: x.by, ok: x.ids })
      break
    }
    case 'notify': {
      const bid = x.batch?.id
      for (const id of x.ids) {
        const e = entityRows.find((y) => y.id === id)
        if (!e) continue
        entityEvent(id, { kind: 'edit', action: 'إرسال إشعار للجهة', by: x.by, at, note: x.text,
          fields: [{ k: 'القالب', v: x.template }, { k: 'القناة', v: x.channel }, { k: 'حالة التسليم', v: 'أُرسل' }, ...(bid ? [{ k: 'الدفعة', v: bid }] : [])] })
        enote(e.name, 'status', x.title, x.text, at, ROUTES.entityPortal, `en-msg-${id}-${at}`)
      }
      if (x.batch) BATCHES.unshift({ ...x.batch, act: 'notify', at, by: x.by, ok: x.ids })
      break
    }
    case 'assign': {
      const bid = x.batch?.id
      for (const r of x.reqs) {
        const prev = ASSIGNED[r.reqId] ?? 'غير مُسنَد'
        ASSIGNED[r.reqId] = x.to
        entityEvent(r.entityId, { kind: 'edit', action: 'إسناد المراجعة', by: x.by, at,
          fields: [{ k: 'الطلب', v: r.reqId }, { k: 'المُسند إليه', v: `${prev} ← ${x.to}` }, ...(bid ? [{ k: 'الدفعة', v: bid }] : [])] })
      }
      if (x.batch) BATCHES.unshift({ ...x.batch, act: 'assign', at, by: x.by, ok: x.reqs.map((r) => r.entityId) })
      break
    }
    case 'export': {
      if (x.batch) { BATCHES.unshift({ ...x.batch, act: 'export', at, by: x.by, ok: x.ids, note: `${x.scope} · ${x.cols} عمودًا` }); break }
      for (const id of x.ids) entityEvent(id, { kind: 'edit', action: 'تصدير ملف الجهة', by: x.by, at, fields: [{ k: 'الأعمدة', v: String(x.cols) }, { k: 'عدد السجلات', v: '1' }] })
      break
    }
    case 'bankDelete': {
      const o = overlayOf(x.entityId)
      o.deletedBanks = [...(o.deletedBanks ?? []), x.bankId]
      o.addedBanks = o.addedBanks.filter((b) => b.id !== x.bankId)
      entityEvent(x.entityId, { kind: 'bank', action: 'حذف حساب بنكي', by: x.by, at, note: x.reason,
        fields: [{ k: 'الحساب', v: x.bankId }, { k: 'الارتباط المالي', v: 'لا يوجد' }] })
      break
    }
    case 'reviewStart': {
      const r = regRows.find((y) => y.id === x.reqId)
      const u = UPD_ROWS.find((y) => y.id === x.reqId)
      const ev = { kind: 'draft' as const, action: 'بدء المراجعة', by: x.by, at }
      if (r) { r.events = [...(r.events ?? []), ev] } else if (u) u.events.push(ev)
      break
    }
    case 'relink': {
      /* v3 · 2.4.10 · the project's entity changes everywhere the project is carried · 2.4.11 · the
         move is kept with the entity before and after, the time and who did it */
      const p = projectRows.find((y) => y.id === x.projectId)
      const toE = entityRows.find((y) => y.id === x.to)
      /* a project the intake store adds on its own replay isn't here yet · the move waits for it */
      if (!p) { if (!LATE.includes(x)) LATE.push(x); break }
      if (!toE || p.entityId === toE.id) break
      const fromE = entityRows.find((y) => y.id === p.entityId)
      const from = { id: p.entityId, name: p.entityName }
      const move = <T extends { projectId: string; entityId: string; entityName: string }>(rows: T[]) => {
        let n = 0
        for (const r of rows) if (r.projectId === p.id) { r.entityId = toE.id; r.entityName = toE.name; n++ }
        return n
      }
      /* the open requests go to the new entity's own active account · read when the move was made
         and kept on the op, so a replay pays where the move said */
      const fb = banksOf(toE.id)[0]
      const bank = x.bank ?? (fb ? { name: fb.bank, active: fb.active } : undefined)
      for (const r of payRequests) if (r.projectId === p.id && r.state !== 'paid' && r.state !== 'closed' && bank) r.bank = { name: bank.name, active: bank.active }
      /* Re-audit 17 Oct · a paid request stays with the entity it was paid to · moving it rewrote the old
         entity's bank history (bankHistory reads r.entityId), so money sent to its account read as the new one's */
      const unpaid = payRequests.filter((r) => r.state !== 'paid' && r.state !== 'closed')
      const touched = { agreements: move(agreements), payments: move(unpaid), plans: move(planRows), closings: move(closeRows) }
      /* the agreement text names its party · a clause that carries the old name takes the new one */
      for (const a of agreements) if (a.projectId === p.id) renameParty(a.id, from.name, toE.name)
      /* the entities' own counters follow the project */
      const counter = COUNTER[p.statusGroup]
      const shift = (e: EntityRow | undefined, d: 1 | -1) => {
        if (!e) return
        if (counter) e[counter] = Math.max(0, e[counter] + d)
        if (p.amountGranted > 0) { e.projectsApproved = Math.max(0, e.projectsApproved + d); e.grantedTotal = Math.max(0, e.grantedTotal + d * p.amountGranted) }
      }
      shift(fromE, -1); shift(toE, 1)
      p.entityId = toE.id; p.entityName = toE.name
      RELINKS.unshift({ id: `RL-${RELINKS.length + 1}`, projectId: p.id, projectName: p.name, from, to: { id: toE.id, name: toE.name }, reason: x.reason, file: x.file, by: x.by, at, touched })
      const fields = [
        { k: 'المشروع', v: `${p.id} · ${p.name}` }, { k: 'الجهة السابقة', v: from.name }, { k: 'الجهة الجديدة', v: toE.name },
        { k: 'السجلات المحدَّثة', v: `اتفاقيات ${touched.agreements} · طلبات صرف ${touched.payments} · خطط ${touched.plans} · إغلاق ${touched.closings}` },
        ...(x.file ? [{ k: 'المستند', v: x.file }] : []),
      ]
      entityEvent(from.id, { kind: 'edit', action: 'نقل مشروع إلى جهة أخرى', by: x.by, at, note: x.reason, fields })
      entityEvent(toE.id, { kind: 'edit', action: 'ربط مشروع منقول من جهة أخرى', by: x.by, at, note: x.reason, fields })
      enote(from.name, 'update', `نُقل المشروع ${p.name} إلى جهة أخرى`, x.reason, at, ROUTES.entityPortal)
      enote(toE.name, 'update', `رُبط بجهتك المشروع ${p.name}`, x.reason, at, ROUTES.entityPortal)
      break
    }
    case 'viewArchived': {
      entityEvent(x.entityId, { kind: 'edit', action: 'الاطلاع على ملف جهة مؤرشفة', by: x.by, at })
      break
    }
    case 'bankStatus': {
      const o = overlayOf(x.entityId)
      o.bankStatus[x.bankId] = { status: x.status, reason: x.reason }
      const added = o.addedBanks.find((b) => b.id === x.bankId) ?? o.banks?.find((b) => b.id === x.bankId)
      if (added) { added.status = x.status; added.reason = x.reason }
      entityEvent(x.entityId, { kind: 'bank', action: x.status === 'مفعل' ? 'تفعيل حساب بنكي' : 'تعطيل حساب بنكي', by: x.by, at,
        note: x.reason, fields: [{ k: 'الحساب', v: x.bankId }, { k: 'الحالة', v: x.status }] })
      break
    }
    case 'updSave': {
      let u = UPD_ROWS.find((y) => y.id === x.req.id)
      if (!u) { u = { ...structuredClone(x.req), state: 'draft', createdAt: at, events: [] }; UPD_ROWS.unshift(u) }
      else Object.assign(u, structuredClone(x.req))
      if (!x.send) {
        u.events.push({ kind: 'draft', action: 'حفظ مسودة طلب التحديث', by: x.req.by, at })
        break
      }
      const e = entityRows.find((y) => y.id === u!.entityId)
      if (!e) break
      /* The direct changes apply now; the rest wait (2.3.upd-8 · 2.3.upd-15) */
      const direct = u.changes.filter((c) => c.direct)
      for (const c of direct) applyChange(e, c)
      if (direct.length) {
        entityEvent(e.id, { kind: 'edit', action: 'تحديث مباشر لبيانات الاتصال', by: x.req.by, at,
          fields: direct.map((c) => ({ k: c.label, v: `${c.from || '—'} ← ${c.to || '—'}` })) })
      }
      const waits = u.changes.some((c) => !c.direct) || u.banks.length > 0 || u.docs.length > 0
      u.submittedAt = at
      u.events.push({ kind: u.state === 'completion' ? 'resubmit' : 'submit', action: u.state === 'completion' ? 'إعادة إرسال طلب التحديث' : 'إرسال طلب التحديث', by: x.req.by, at,
        fields: u.changes.map((c) => ({ k: `${c.label}${c.direct ? ' · مباشر' : ''}`, v: `${c.from || '—'} ← ${c.to || '—'}` })) })
      if (waits) {
        u.state = 'review'
        /* v3 · 2.4.2 · 0.ent.7 · a substantive update under review holds the account «معلق» ·
           running projects carry on, no new requests until it's decided (an account already
           «غير نشط» for a real block stays so · the block wins) */
        if (!overlayOf(e.id).pending) {
          overlayOf(e.id).pending = u.id
          const from = e.activation
          settle(e, at)
          entityEvent(e.id, { kind: 'edit', action: 'طلب تحديث تحت المراجعة', by: x.req.by, at,
            note: e.activation === 'معلق' ? 'الحساب «معلق» حتى يُبتّ في الطلب · المشاريع القائمة كما هي ولا تقديم جديد.' : undefined,
            fields: [{ k: 'حالة الحساب', v: `${from} ← ${e.activation}` }, { k: 'الطلب', v: u.id }] })
        }
      } else {
        u.state = 'approved'; u.decidedAt = at
        u.events.push({ kind: 'approve', action: 'طُبّق مباشرة · لا يتطلب اعتمادًا', by: 'النظام', at })
      }
      enote(e.name, 'update', waits ? 'استلمنا طلب تحديث بياناتك' : 'حُدّثت بيانات جهتك', waits ? `الطلب ${u.id} تحت المراجعة · حساب جهتك «معلق» حتى البتّ فيه` : 'طُبّقت بيانات الاتصال مباشرة', at, ROUTES.entityPortal)
      break
    }
    case 'adminEdit': {
      /* Client 19 Oct · the system admin corrects the file directly · no request back to the entity,
         no «معلق» · logged on the file and in the audit log · a renewed date lifts a lapse at once */
      const e = entityRows.find((y) => y.id === x.entityId)
      if (!e || !x.changes.length) break
      const from = e.activation
      for (const c of x.changes) applyChange(e, c)
      entityEvent(e.id, { kind: 'edit', action: 'تعديل مباشر من مدير النظام', by: x.by, at, note: x.reason || undefined,
        fields: x.changes.map((c) => ({ k: c.label, v: `${c.from || '—'} ← ${c.to || '—'}` })) })
      settle(e, at)
      if (from !== e.activation) entityEvent(e.id, { kind: 'accept', action: 'تغيّر حالة الحساب بعد التعديل', by: 'النظام', at, fields: [{ k: 'حالة الحساب', v: `${from} ← ${e.activation}` }] })
      enote(e.name, 'update', 'عدّلت المؤسسة بيانات جهتك', x.changes.map((c) => c.label).join('، '), at, ROUTES.entityPortal)
      break
    }
    case 'updDecide': {
      const u = UPD_ROWS.find((y) => y.id === x.id)
      const e = u && entityRows.find((y) => y.id === u.entityId)
      if (!u || !e || u.state !== 'review') break
      u.note = x.note
      if (x.outcome === 'return') {
        u.state = 'completion'
        u.events.push({ kind: 'return', action: 'إعادة طلب التحديث للاستكمال', by: x.by, at, note: x.note })
        enote(e.name, 'update', 'أُعيد طلب تحديث بياناتك للاستكمال', x.note, at, ROUTES.entityPortal)
        break
      }
      const o = overlayOf(e.id)
      if (x.outcome === 'approve') {
        /* v3 · 2.4.9 · never approve a license and classification another entity already holds */
        const ask = Object.fromEntries(u.changes.map((c) => [c.key, c.to]))
        if (licenseDup(e.id, { licenseNo: ask.licenseNo, type: ask.type })) break
        const pending = u.changes.filter((c) => !c.direct)
        for (const c of pending) applyChange(e, c)
        u.bankDecisions = Object.fromEntries(u.banks.map((b) => [b.id, x.bankNo?.[b.id] ?? '']))
        for (const b of u.banks) {
          if (x.bankNo?.[b.id]) continue
          const nid = `${e.id}-n${o.addedBanks.length + 1}`
          o.addedBanks.push({ id: nid, bank: b.bankName, shortName: b.shortName, accountName: b.bankHolder,
            iban: b.iban, status: 'مفعل', certificate: b.doc || `${BANK_DOC_LABEL}.pdf` })
          /* Batch 3 · an edit of an account on file · the old one is deactivated, never overwritten */
          if (b.replaces) {
            const reason = `استُبدل بتعديل معتمد · الطلب ${u.id}`
            o.bankStatus[b.replaces] = { status: 'غير مفعل', reason }
            const own = o.addedBanks.find((y) => y.id === b.replaces) ?? o.banks?.find((y) => y.id === b.replaces)
            if (own) { own.status = 'غير مفعل'; own.reason = reason }
            entityEvent(e.id, { kind: 'bank', action: 'تعديل حساب بنكي قائم', by: x.by, at, note: reason,
              fields: [{ k: 'الحساب السابق', v: b.replaces }, { k: 'الحساب الجديد', v: `${b.bankName} · ${b.iban}` }] })
          }
        }
        for (const d of u.docs) o.renewed[d.label] = { at: day(at), expires: d.expires, file: d.file }
        const lic = u.docs.find((d) => d.key === 'license' && d.expires)
        if (lic && !pending.some((c) => c.key === 'licenseEndsAt')) e.licenseEndsAt = lic.expires!
        const brd = u.docs.find((d) => d.key === 'board' && d.expires)
        if (brd) o.fields.boardMandateEndsAt = brd.expires!
        u.state = 'approved'; u.decidedAt = at
        u.events.push({ kind: 'approve', action: 'اعتماد طلب التحديث وتطبيقه', by: x.by, at, note: x.note || undefined })
        enote(e.name, 'update', 'اعتُمد طلب تحديث بياناتك', x.note || 'طُبّقت البيانات وعاد نشاط الجهة', at, ROUTES.entityPortal)
        entityEvent(e.id, { kind: 'edit', action: 'اعتماد تحديث بيانات الجهة', by: x.by, at, note: x.note || undefined,
          fields: [
            ...pending.map((c) => ({ k: c.label, v: `${c.from || '—'} ← ${c.to || '—'}` })),
            ...u.banks.map((b) => ({ k: x.bankNo?.[b.id] ? 'حساب بنكي مرفوض' : 'حساب بنكي جديد', v: `${b.bankName} · ${b.iban}${x.bankNo?.[b.id] ? ` · ${x.bankNo[b.id]}` : ''}` })),
            ...u.docs.map((d) => ({ k: 'وثيقة مجدَّدة', v: `${d.label}${d.expires ? ` · حتى ${d.expires}` : ''}` })),
          ] })
      } else {
        u.state = 'rejected'; u.decidedAt = at
        u.events.push({ kind: 'reject', action: 'رفض طلب التحديث', by: x.by, at, note: x.note })
        entityEvent(e.id, { kind: 'reject', action: 'رفض طلب تحديث البيانات', by: x.by, at, note: x.note, fields: [{ k: 'الطلب', v: u.id }] })
        enote(e.name, 'update', 'رُفض طلب تحديث بياناتك', x.note, at, ROUTES.entityPortal)
      }
      /* The «معلق» ends with the decision (approve or reject) · the account reads again from what
         still holds it · a return keeps it under review */
      if (o.pending === u.id) {
        const from = e.activation
        o.pending = undefined
        settle(e, at)
        if (from !== e.activation) entityEvent(e.id, { kind: 'accept', action: 'انتهاء مراجعة التحديث', by: 'النظام', at, fields: [{ k: 'حالة الحساب', v: `${from} ← ${e.activation}` }] })
      } else settle(e, at)
      break
    }
  }
}

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ }
}

const run = (o: Op) => {
  ops.push(o)
  apply(o)
  save()
  emit()
  done(o.op, 'الجهات')
}

/* ── Seed · one open update request, so the review screen has something real to open ── */

const seedUpdate = () => {
  const e = entityRows.find((y) => y.id === '803')
  if (!e || UPD_ROWS.some((u) => u.id === 'UPD-2026-000101')) return
  overlayOf('803').pending = 'UPD-2026-000101'
  overlayOf('803').fields.directorName = 'ناصر الشمري'
  UPD_ROWS.push({
    id: 'UPD-2026-000101', entityId: '803', entityName: e.name, state: 'review', by: 'مدخل بيانات الجهة',
    createdAt: '2026-09-27T10:12', submittedAt: '2026-09-27T10:20',
    changes: [
      { key: 'directorName', label: 'اسم المدير التنفيذي', from: 'خالد العتيبي', to: 'ناصر الشمري', direct: true },
      { key: 'licenseEndsAt', label: 'تاريخ نهاية الترخيص', from: e.licenseEndsAt, to: '2031-05-13', direct: false },
    ],
    banks: [], docs: [{ key: 'license', label: 'الترخيص ساري المفعول', file: 'ترخيص-مجدد-803.pdf', expires: '2031-05-13' }],
    events: [{ kind: 'submit', action: 'إرسال طلب التحديث', by: 'مدخل بيانات الجهة', at: '2026-09-27T10:20' }],
  })
}

const hydrate = () => {
  seedUpdate()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  for (const o of ops) apply(o)
  /* The expiry rule runs at load, so an entity whose license lapsed overnight reads inactive */
  const at = now()
  for (const e of entityRows) settle(e, at)
}
hydrate()

/* ── Reads ── */

/** The request's history · the fixture's own dates first, then everything recorded since */
export const regHistory = (r: RegRequest): RegEvent[] => {
  const base: RegEvent[] = []
  if (r.state !== 'draft' || r.events?.length) {
    base.push({ kind: 'submit', action: 'إرسال الطلب للمراجعة', by: r.clerkName || r.name, at: `${r.submittedAt}T09:00` })
  }
  if (!r.events?.length && r.state === 'completion' && r.note) {
    base.push({ kind: 'return', action: 'إعادة للاستكمال', by: 'مسؤول النظام', at: `${r.submittedAt}T13:00`, note: r.note })
  }
  if (!r.events?.length && (r.state === 'approved' || r.state === 'rejected') && r.decidedAt) {
    base.push({ kind: r.state === 'approved' ? 'approve' : 'reject', action: r.state === 'approved' ? 'اعتماد وتفعيل' : 'رفض وإيقاف', by: 'مسؤول النظام', at: `${r.decidedAt}T11:00`, note: r.note })
  }
  const own = r.events ?? []
  /* A fixture whose submission was recorded by an action already carries it */
  return own.some((e) => e.kind === 'submit') ? own : [...base, ...own]
}

/** Everything an entity has asked for · its registration and its update requests (2.4.1) */
export const requestsOfEntity = (entityId: string): { kind: 'reg' | 'upd'; id: string; state: string; at: string; title: string }[] => [
  ...regRows.filter((r) => r.entityId === entityId).map((r) => ({ kind: 'reg' as const, id: r.id, state: r.state, at: r.submittedAt, title: 'طلب تسجيل الجهة' })),
  ...UPD_ROWS.filter((u) => u.entityId === entityId).map((u) => ({ kind: 'upd' as const, id: u.id, state: u.state, at: day(u.submittedAt ?? u.createdAt), title: 'طلب تحديث بيانات' })),
]


/** Client 19 Oct · the fields the system admin may correct directly on the file */
export const ADMIN_EDIT_FIELDS: { key: string; label: string; kind: 'text' | 'date' | 'digits' | 'select' | 'tel' | 'email' | 'url' }[] = [
  ...['name', 'type', 'licensor', 'licenseNo', 'region', 'city', 'licenseEndsAt', 'boardEndsAt'].map((k) => ({ key: k, label: fileField(k)?.label ?? k, kind: fileField(k)?.kind ?? 'text' })),
  { key: 'governance', label: 'درجة تقييم الحوكمة', kind: 'text' },
  ...['phone', 'mobile', 'email', 'website', 'directorName', 'directorMobile', 'clerkName', 'clerkMobile', 'clerkEmail'].map((k) => ({ key: k, label: fileField(k)?.label ?? k, kind: fileField(k)?.kind ?? 'text' })),
]
/** Who edits the file directly · the system admin (super admin) */
export const canAdminEdit = (role: RoleKey | string): boolean => role === 'admin'
/** The direct edit · refused only for a licence another entity holds · never for a document close to
    its expiry (that guard is the entity's own update request's) */
export function adminEditEntity(entityId: string, changes: { key: string; from: string; to: string }[], reason: string, by: string, role: RoleKey | string): string[] {
  if (!canAdminEdit(role)) return ['التعديل المباشر لمدير النظام']
  const e = entityRows.find((y) => y.id === entityId)
  if (!e) return ['الجهة غير موجودة']
  const list = changes.filter((c) => c.to !== c.from)
  if (!list.length) return ['لم يتغيّر شيء']
  const ask = Object.fromEntries(list.map((c) => [c.key, c.to]))
  const dup = licenseDup(e.id, { licenseNo: ask.licenseNo ?? e.licenseNo, type: ask.type ?? e.type })
  if (dup && (ask.licenseNo || ask.type)) return [`رقم الترخيص والتصنيف مسجَّلان لـ«${dup.who}»`]
  run({ op: 'adminEdit', entityId, reason: reason.trim(), by, at: now(),
    changes: list.map((c) => ({ ...c, label: ADMIN_EDIT_FIELDS.find((f) => f.key === c.key)?.label ?? c.key, direct: true })) })
  return []
}

export const updById = (id: string): UpdateRequest | undefined => UPD_ROWS.find((u) => u.id === id)

export const openUpdateOf = (entityId: string): UpdateRequest | undefined =>
  UPD_ROWS.find((u) => u.entityId === entityId && (u.state === 'review' || u.state === 'completion' || u.state === 'draft'))

export const draftOf = (email: string): RegRequest | undefined =>
  regRows.find((r) => r.acctEmail === email && (r.state === 'draft' || r.state === 'completion'))

/** Who may take a decision · from settings (2.1.desc-2 · 2.2.15 · 2.4.16) */
export const canDecide = (kind: 'approve' | 'return' | 'update' | 'status', role: RoleKey): boolean =>
  (kind === 'approve' ? ENTITY_RULES.approveBy : kind === 'return' ? ENTITY_RULES.returnBy : kind === 'update' ? ENTITY_RULES.updateBy : ENTITY_RULES.statusBy).includes(role)

export const nextUpdId = (): string =>
  `UPD-2026-${String(101 + UPD_ROWS.length).padStart(6, '0')}`

/* ── Actions ── */

export const saveRegDraft = (id: string, email: string, values: Record<string, string>, banks: RegBank[], docs: string[], files: RegRequest['files']) =>
  run({ op: 'regDraft', id, email, values, banks, docs, files, at: now() })

export const submitRegistration = (id: string, email: string, values: Record<string, string>, banks: RegBank[], docs: string[], files: RegRequest['files']) =>
  run({ op: 'regSubmit', id, email, values, banks, docs, files, at: now() })

export const returnRegistration = (id: string, note: string, fields: string[], by: string) =>
  run({ op: 'regReturn', id, note, fields, by, at: now() })

export const resubmitRegistration = (id: string, values: Record<string, string>, docs: string[], by: string) =>
  run({ op: 'regResubmit', id, values, docs, by, at: now() })

export const decideRegistration = (id: string, outcome: 'approve' | 'reject', note: string, banks: Record<string, string>, by: string, reason?: RegRejectReason): string | undefined => {
  /* v3 · 2.4.9 · the store checks the license pair too · an entity registered since the screen
     opened can't be duplicated by the approval */
  const r = regRows.find((y) => y.id === id)
  if (outcome === 'approve' && r && licenseClash(r.licenseNo, r.type, entityRows)) return undefined
  run({ op: 'regDecide', id, outcome, note, banks, reason, by, at: now() })
  return regRows.find((r) => r.id === id)?.entityId
}

/** Register an entity from inside the system · returns its new id (2.4.32) */
export const registerInternal = (values: Record<string, string>, docs: string[], partner: string, by: string, banks: RegBank[] = []): string => {
  /* v3 · 2.4.9 · 2.4.34 · the same license and classification never register twice */
  if (values.licenseNo && values.type && licenseClash(values.licenseNo, values.type, entityRows)) return ''
  run({ op: 'internal', values, docs, partner, by, banks, at: now() })
  return lastInternal
}

/** A decision on the account · 'suspension' · 'revoked' · or 'lift' to remove the one in force */
export const setEntityStatus = (entityId: string, to: 'suspension' | 'revoked' | 'lift', reason: string, by: string, meta?: StatusMeta) =>
  run({ op: 'status', entityId, to, reason, by, meta, at: now() })

export const archiveEntity = (entityId: string, on: boolean, reason: string, by: string, code?: string) =>
  run({ op: 'archive', entityId, on, reason, by, code, at: now() })

export const askData = (ids: string[], items: string[], due: string, reason: string, by: string, note?: string, batch?: Omit<Batch, 'at' | 'by' | 'act' | 'ok'>) =>
  run({ op: 'ask', ids, items, due, reason, note, by, batch, at: now() })

export const notifyEntities = (ids: string[], title: string, text: string, channel: string, template: string, by: string, batch?: Omit<Batch, 'at' | 'by' | 'act' | 'ok'>) =>
  run({ op: 'notify', ids, title, text, channel, template, by, batch, at: now() })

export const assignReview = (reqs: { reqId: string; entityId: string }[], to: string, by: string, batch?: Omit<Batch, 'at' | 'by' | 'act' | 'ok'>) =>
  run({ op: 'assign', reqs, to, by, batch, at: now() })

export const logExport = (ids: string[], cols: number, scope: string, by: string, batch?: Omit<Batch, 'at' | 'by' | 'act' | 'ok'>) =>
  run({ op: 'export', ids, cols, scope, by, batch, at: now() })

export const deleteBank = (entityId: string, bankId: string, reason: string, by: string) =>
  run({ op: 'bankDelete', entityId, bankId, reason, by, at: now() })

export const startReview = (reqId: string, by: string) => run({ op: 'reviewStart', reqId, by, at: now() })

/** v3 · 2.4.10 · move a project to another entity · its records follow */
export const relinkEntity = (projectId: string, to: string, reason: string, by: string, file?: string) =>
  run({ op: 'relink', projectId, to, reason, file, by, at: now(), bank: bankSource(to) })

/** The intake store calls this when its replay adds a project it creates · a move recorded on that
    project runs then */
export const replayLateRelinks = (projectId: string): void => {
  const waiting = LATE.filter((o) => o.op === 'relink' && o.projectId === projectId)
  if (!waiting.length) return
  for (const o of waiting) { LATE.splice(LATE.indexOf(o), 1); apply(o) }
  emit()
}

/** Payments names the account a payment goes to · it hands its reader in at load, so the entity
    store doesn't import it back */
export const setBankSource = (f: (entityId: string) => { name: string; active: boolean } | undefined): void => { bankSource = f }

export const viewArchived = (entityId: string, by: string) => run({ op: 'viewArchived', entityId, by, at: now() })

export const nextBatchId = (): string => `BAT-2026-${String(BATCHES.length + 1).padStart(6, '0')}`

export const setBankStatus = (entityId: string, bankId: string, status: BankAccount['status'], by: string, reason?: string) =>
  run({ op: 'bankStatus', entityId, bankId, status, reason, by, at: now() })

/** Save or send an update request · the split into direct and waiting changes follows settings */
export const saveUpdate = (req: Omit<UpdateRequest, 'events' | 'state' | 'createdAt' | 'submittedAt'>, send: boolean) =>
  run({ op: 'updSave', req: { ...req, changes: req.changes.map((c) => ({ ...c, direct: !needsApproval(c.key) })) }, send, at: now() })

export const decideUpdate = (id: string, outcome: 'approve' | 'reject' | 'return', note: string, by: string, bankNo?: Record<string, string>) =>
  run({ op: 'updDecide', id, outcome, note, by, bankNo, at: now() })

export const resetEntities = () => {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  location.reload()
}

export const isRegState = (s: string): s is RegState => ['draft', 'review', 'completion', 'approved', 'rejected'].includes(s)
