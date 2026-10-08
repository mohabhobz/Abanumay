import { useSyncExternalStore } from 'react'
import type { EntityRow, EntityActivation } from '@/types/domain'
import type { BankAccount, EntityDoc, EntityEvent } from '@/data/mock/entityDetail'
import { entityRows } from '@/data/mock/entities'
import {
  BANK_DOC_LABEL, REG_DOCS, regRows, type RegBank, type RegEvent, type RegRequest, type RegState,
} from '@/data/mock/registration'
import { ENTITY_DOCS } from '@/data/mock/taxonomy'
import type { RoleKey } from '@/data/roles'
import { ENTITY_RULES, fileField, needsApproval } from './rules'
import { todayIso } from './validate'
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
  /** Status before an update request suspended it · restored when the request is decided */
  beforeUpdate?: EntityActivation
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

/* ── Update requests (2.3.upd) ── */

export type UpdState = 'draft' | 'review' | 'completion' | 'approved' | 'rejected'

export const UPD_STATE_SAY: Record<UpdState, string> = {
  draft: 'مسودة',
  review: 'قيد المراجعة',
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
const enote = (to: string, topic: EntityNote['topic'], title: string, context: string, at: string, href: string) =>
  ENTITY_NOTES.unshift({ id: `en-${ENTITY_NOTES.length + 1}`, to, topic, title, context, at: at.slice(0, 10), href })

/* ── Operations ── */

type Op = { at: string } & (
  | { op: 'regDraft'; id: string; email: string; values: Record<string, string>; banks: RegBank[]; docs: string[]; files: RegRequest['files'] }
  | { op: 'regSubmit'; id: string; email: string; values: Record<string, string>; banks: RegBank[]; docs: string[]; files: RegRequest['files'] }
  | { op: 'regReturn'; id: string; note: string; fields: string[]; by: string }
  | { op: 'regResubmit'; id: string; values: Record<string, string>; docs: string[]; by: string }
  | { op: 'regDecide'; id: string; outcome: 'approve' | 'reject'; note: string; banks: Record<string, string>; by: string }
  | { op: 'internal'; values: Record<string, string>; docs: string[]; partner: string; by: string; banks?: RegBank[] }
  | { op: 'status'; entityId: string; to: EntityActivation; reason: string; by: string }
  | { op: 'archive'; entityId: string; on: boolean; reason: string; by: string }
  | { op: 'bankStatus'; entityId: string; bankId: string; status: BankAccount['status']; reason?: string; by: string }
  | { op: 'updSave'; req: Omit<UpdateRequest, 'events' | 'state' | 'createdAt' | 'submittedAt'>; send: boolean }
  | { op: 'updDecide'; id: string; outcome: 'approve' | 'reject' | 'return'; note: string; by: string; bankNo?: Record<string, string> }
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
    fields: [{ k: 'حالة التفعيل', v: 'نشط' }, { k: 'صلاحية التقديم', v: 'مُنحت' }, { k: 'اسم المستخدم', v: r.acctEmail }] })
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
const syncActivation = (e: EntityRow, at: string) => {
  if (e.archived) return
  const lapsed = mandatoryExpired(e)
  if (e.activation === 'نشط' && lapsed.length) {
    e.activation = 'غير نشط'
    entityEvent(e.id, { kind: 'stop', action: 'تحويل آلي إلى «غير نشطة»', by: 'النظام', at,
      note: `انتهت صلاحية ${lapsed.join(' و')} · يلزم تقديم طلب تحديث بالنسخة السارية قبل أي تقديم جديد.`,
      fields: [{ k: 'حالة التفعيل', v: 'نشط ← غير نشط' }] })
    /* Re-audit 7 Oct · 2.3.upd-19 · the entity is told which documents to update */
    enote(e.name, 'status', 'تحوّلت جهتك إلى «غير نشطة»', `انتهت صلاحية ${lapsed.join(' و')} · قدّم طلب تحديث بالنسخة السارية`, at, `${ROUTES.entityUpdate}?entity=${e.id}`)
  } else if (e.activation === 'غير نشط' && !lapsed.length) {
    e.activation = 'نشط'
    entityEvent(e.id, { kind: 'accept', action: 'إعادة التفعيل بعد تحديث الوثائق', by: 'النظام', at,
      fields: [{ k: 'حالة التفعيل', v: 'غير نشط ← نشط' }] })
  }
  e.canApply = e.activation === 'نشط'
}

const applyChange = (e: EntityRow, c: Change) => {
  const o = overlayOf(e.id)
  const rowKeys: (keyof EntityRow)[] = ['name', 'type', 'licensor', 'licenseNo', 'region', 'city', 'licenseEndsAt', 'mobile', 'email']
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
      enote(r.name, 'registration', 'استلمنا طلب تسجيلك', `الطلب ${r.id} قيد المراجعة · نبلغك بالنتيجة`, at, ROUTES.entityPortal)
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
        r.events = [...(r.events ?? []), { kind: 'reject', action: 'رفض وإيقاف · أُرشف الطلب', by: x.by, at, note: x.note, fields: bankFields }]
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
      o.events[0] = { ...o.events[0], action: 'تسجيل داخلي · الجهة نشطة فور الحفظ', fields: [{ k: 'نوع الشراكة', v: x.partner }, { k: 'حالة التفعيل', v: 'نشط' }] }
      lastInternal = id
      break
    }
    case 'status': {
      const e = entityRows.find((y) => y.id === x.entityId)
      if (!e) break
      const from = e.activation
      e.activation = x.to; e.canApply = x.to === 'نشط'
      overlayOf(e.id).statusReason = x.reason
      overlayOf(e.id).fields.adminNote = x.reason
      entityEvent(e.id, {
        kind: x.to === 'نشط' ? 'accept' : x.to === 'ملغى الاعتماد' ? 'reject' : 'stop',
        action: x.to === 'نشط' ? 'إعادة تفعيل الجهة' : x.to === 'ملغى الاعتماد' ? 'إلغاء اعتماد الجهة' : 'تعليق اعتماد الجهة',
        by: x.by, at, note: x.reason, fields: [{ k: 'حالة التفعيل', v: `${from} ← ${x.to}` }],
      })
      enote(e.name, 'status', x.to === 'نشط' ? 'أُعيد تفعيل جهتك' : x.to === 'ملغى الاعتماد' ? 'أُلغي اعتماد جهتك' : 'عُلّق اعتماد جهتك', x.reason, at, ROUTES.entityPortal)
      break
    }
    case 'archive': {
      const e = entityRows.find((y) => y.id === x.entityId)
      if (!e) break
      e.archived = x.on
      if (x.on) e.canApply = false
      else e.canApply = e.activation === 'نشط'
      entityEvent(e.id, { kind: x.on ? 'stop' : 'accept', action: x.on ? 'أرشفة الجهة' : 'استعادة الجهة من الأرشيف', by: x.by, at, note: x.reason })
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
        /* 2.3.upd-16 · the entity's activity pauses while a change that needs approval is open */
        if (e.activation !== 'محدث') {
          overlayOf(e.id).beforeUpdate = e.activation
          entityEvent(e.id, { kind: 'edit', action: 'طلب تحديث بانتظار الاعتماد', by: x.req.by, at,
            note: 'يُعلَّق نشاط الجهة حتى يُبتّ في الطلب.', fields: [{ k: 'حالة التفعيل', v: `${e.activation} ← محدث` }, { k: 'الطلب', v: u.id }] })
          e.activation = 'محدث'; e.canApply = false
        }
      } else {
        u.state = 'approved'; u.decidedAt = at
        u.events.push({ kind: 'approve', action: 'طُبّق مباشرة · لا يتطلب اعتمادًا', by: 'النظام', at })
      }
      enote(e.name, 'update', waits ? 'استلمنا طلب تحديث بياناتك' : 'حُدّثت بيانات جهتك', waits ? `الطلب ${u.id} بانتظار الاعتماد · يُعلَّق النشاط حتى البتّ` : 'طُبّقت بيانات الاتصال مباشرة', at, ROUTES.entityPortal)
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
        const pending = u.changes.filter((c) => !c.direct)
        for (const c of pending) applyChange(e, c)
        u.bankDecisions = Object.fromEntries(u.banks.map((b) => [b.id, x.bankNo?.[b.id] ?? '']))
        for (const b of u.banks) {
          if (x.bankNo?.[b.id]) continue
          o.addedBanks.push({ id: `${e.id}-n${o.addedBanks.length + 1}`, bank: b.bankName, shortName: b.shortName, accountName: b.bankHolder,
            iban: b.iban, status: 'مفعل', certificate: b.doc || `${BANK_DOC_LABEL}.pdf` })
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
      /* The pause ends with the decision · back to the status before it, then the expiry rule */
      if (e.activation === 'محدث') {
        e.activation = o.beforeUpdate ?? 'نشط'
        o.beforeUpdate = undefined
        entityEvent(e.id, { kind: 'accept', action: 'انتهاء تعليق التحديث', by: 'النظام', at, fields: [{ k: 'حالة التفعيل', v: `محدث ← ${e.activation}` }] })
      }
      syncActivation(e, at)
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
}

/* ── Seed · one open update request, so the review screen has something real to open ── */

const seedUpdate = () => {
  const e = entityRows.find((y) => y.id === '803')
  if (!e || UPD_ROWS.some((u) => u.id === 'UPD-2026-000101')) return
  overlayOf('803').beforeUpdate = 'نشط'
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
  for (const e of entityRows) e.canApply = e.activation === 'نشط'
  seedUpdate()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  for (const o of ops) apply(o)
  /* The expiry rule runs at load, so an entity whose license lapsed overnight reads inactive */
  const at = now()
  for (const e of entityRows) syncActivation(e, at)
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

export const decideRegistration = (id: string, outcome: 'approve' | 'reject', note: string, banks: Record<string, string>, by: string): string | undefined => {
  run({ op: 'regDecide', id, outcome, note, banks, by, at: now() })
  return regRows.find((r) => r.id === id)?.entityId
}

/** Register an entity from inside the system · returns its new id (2.4.32) */
export const registerInternal = (values: Record<string, string>, docs: string[], partner: string, by: string, banks: RegBank[] = []): string => {
  run({ op: 'internal', values, docs, partner, by, banks, at: now() })
  return lastInternal
}

export const setEntityStatus = (entityId: string, to: EntityActivation, reason: string, by: string) =>
  run({ op: 'status', entityId, to, reason, by, at: now() })

export const archiveEntity = (entityId: string, on: boolean, reason: string, by: string) =>
  run({ op: 'archive', entityId, on, reason, by, at: now() })

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
