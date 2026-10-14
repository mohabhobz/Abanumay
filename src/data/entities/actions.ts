import type { EntityRow, ProjectRow } from '@/types/domain'
import type { RoleKey } from '@/data/roles'
import { roleByKey } from '@/data/roles'
import { projectRows } from '@/data/mock/projects'
import { payRequests } from '@/data/mock/disbursements'
import { STAGES } from '@/data/mock/taxonomy'
import { ROUTES } from '@/app/routes'
import { ENTITY_RULES } from './rules'
import { ASSIGNED, openUpdateOf, overlayOf, requestsOfEntity } from './store'

/* What can be done to an entity once it's selected · LOCTech «قائمة الجهات المستفيدة — نموذج
   الإجراءات عند التحديد» (8 Oct, a proposal for discussion).

   One table decides every button: who may do it (●), who only sees it (○), when it's on, when it's
   greyed with the reason, when it isn't there at all. The list's selection bar, its «more» menu,
   the entity file's sensitive section and a batch's exclusions all read the same rows, so a rule
   changes in one place. The doers come from settings (`ENTITY_RULES`), with the document's
   proposal as the default; the final names are the permission matrix's call (open question 1).

   The stored statuses stay the live system's seven (`EntityActivation`). The document speaks of
   four account states; `accountOf` reads one from the other, so the rules below are written in the
   document's words without migrating a single record while questions 2 and 5 are open. */

/* ── Seats · ش م ر ن ── */

export type Seat = 'sup' | 'mgr' | 'ceo' | 'adm'
const SEAT_OF: Partial<Record<RoleKey, Seat>> = { supervisor: 'sup', 'grants-manager': 'mgr', ceo: 'ceo', admin: 'adm' }
export const seatOf = (r: RoleKey): Seat | null => SEAT_OF[r] ?? null

export type ActKey =
  | 'view' | 'review' | 'ask' | 'notify' | 'suspend' | 'lift' | 'revoke' | 'archive' | 'banks' | 'log' | 'export' | 'assign'

export const ACT_SAY: Record<ActKey, string> = {
  view: 'عرض ملف الجهة', review: 'مراجعة الطلب', ask: 'طلب تحديث البيانات', notify: 'إرسال إشعار',
  suspend: 'تعليق الأهلية', lift: 'رفع تعليق الأهلية', revoke: 'إلغاء اعتماد الجهة', archive: 'أرشفة الجهة',
  banks: 'إدارة الحسابات البنكية', log: 'سجل الإجراءات', export: 'تصدير', assign: 'إسناد المراجعة',
}

/** ● from settings · ○ fixed by the document · anything else is hidden */
const doers = (a: ActKey): RoleKey[] => {
  const r = ENTITY_RULES
  switch (a) {
    case 'view': case 'log': case 'export': return ['supervisor', 'grants-manager', 'ceo', 'admin']
    case 'review': return [...new Set([...r.returnBy, ...r.approveBy, ...r.updateBy])].filter((k) => k === 'supervisor' || k === 'grants-manager')
    case 'ask': return r.askBy
    case 'notify': return r.notifyBy
    case 'suspend': case 'lift': return r.suspendBy
    case 'revoke': return r.revokeBy
    case 'archive': return r.archiveBy
    case 'banks': return r.bankBy
    case 'assign': return r.assignBy
  }
}
const SEES: Record<ActKey, Seat[]> = {
  view: [], log: [], export: [],
  review: ['ceo'], ask: [], notify: ['ceo'], suspend: ['sup'], lift: ['sup'], revoke: ['sup', 'mgr'],
  archive: ['sup', 'ceo', 'adm'], banks: ['ceo'], assign: ['sup'],
}

export type Grant = 'do' | 'see' | 'none'
export function grantOf(a: ActKey, role: RoleKey): Grant {
  if (a === 'assign' && !ENTITY_RULES.assignOn) return 'none'
  if (doers(a).includes(role)) return 'do'
  const s = seatOf(role)
  if (s && SEES[a].includes(s)) return 'see'
  /* Staff outside the four seats (finance · comms · committee) read the file, its log, and export */
  return a === 'view' || a === 'log' || a === 'export' ? 'see' : 'none'
}

export const whoDoes = (a: ActKey): string => doers(a).map((k) => roleByKey(k).title).join(' أو ') || 'لا أحد بعد'
/** «لـ» before the deciders · «ال» folds into «لل» */
export const forWho = (a: ActKey): string => { const w = whoDoes(a); return w.startsWith('ال') ? `ل${w.slice(1)}` : `ل${w}` }

/* ── The document's words, read from the stored record ── */

export type Account = 'active' | 'pending' | 'inactive' | 'archived' | 'never'
export const ACCOUNT_SAY: Record<Account, string> = {
  active: 'نشط', pending: 'معلق', inactive: 'غير نشط', archived: 'مؤرشف', never: 'لم يُعتمد بعد',
}
export type Block = 'suspension' | 'revoked' | 'expired' | null

export function accountOf(e: EntityRow): { state: Account; block: Block } {
  if (e.archived) return { state: 'archived', block: null }
  switch (e.activation) {
    case 'نشط': return { state: 'active', block: null }
    case 'محدث': return { state: 'pending', block: null }
    case 'غير نشط': return { state: 'inactive', block: 'expired' }
    case 'معلق (موقوف)': return { state: 'inactive', block: 'suspension' }
    case 'ملغى الاعتماد': return { state: 'inactive', block: 'revoked' }
    default: return { state: 'never', block: null }
  }
}

export type ReqState = 'draft' | 'review' | 'completion' | 'approved' | 'rejected'
export const REQ_SAY: Record<ReqState, string> = {
  draft: 'مسودة', review: 'تحت المراجعة', completion: 'بانتظار الاستكمال', approved: 'معتمد', rejected: 'مرفوض',
}
export interface LastReq { kind: 'reg' | 'upd'; id: string; state: ReqState; href: string; assignee?: string }

/** The entity's latest registration or update request */
export function lastRequestOf(e: EntityRow): LastReq | null {
  const r = requestsOfEntity(e.id).sort((a, b) => b.at.localeCompare(a.at))[0]
  if (!r) return null
  return {
    kind: r.kind, id: r.id, state: r.state as ReqState,
    href: r.kind === 'reg' ? ROUTES.entityRequest(r.id) : ROUTES.entityUpdateReview(r.id),
    assignee: ASSIGNED[r.id],
  }
}

/* ── The impact panel · what a suspension or revocation stops ── */

const STAGE_GROUP = new Map(STAGES.map((s) => [s.stage, s.group]))
const PRE = ['اعتماد الإتفاقية', 'الإتفاقيات الورقية', 'اعتماد الإتفاقية الكترونيًا']
const CLOSING = ['طلب التقرير الختامي', 'رفع التقرير الختامي', 'اعتماد التقرير الختامي', 'تقييم المشروع']

export interface Impact {
  study: ProjectRow[]
  pre: ProjectRow[]
  running: ProjectRow[]
  closing: ProjectRow[]
  payments: { id: string; project: string; projectId: string }[]
  /** Projects whose payments stop · pre-execution, running and closing */
  stopped: ProjectRow[]
  /** The supervisors told of it */
  owners: string[]
}

export function impactOf(e: EntityRow): Impact {
  const ps = projectRows.filter((p) => p.entityId === e.id && !p.archived)
  const g = (p: ProjectRow) => STAGE_GROUP.get(p.stage) ?? p.statusGroup
  const study = ps.filter((p) => g(p) === 'في الدراسة')
  const pre = ps.filter((p) => PRE.includes(p.stage))
  const closing = ps.filter((p) => CLOSING.includes(p.stage))
  const running = ps.filter((p) => g(p) === 'في التشغيل' && !PRE.includes(p.stage) && !CLOSING.includes(p.stage))
  const payments = payRequests
    .filter((r) => r.entityId === e.id && r.state !== 'paid' && r.state !== 'closed')
    .map((r) => ({ id: r.id, project: r.projectName, projectId: r.projectId }))
  const stopped = [...pre, ...running, ...closing]
  const owners = [...new Set([...stopped, ...study].map((p) => p.owner).filter((x): x is string => Boolean(x)))]
  return { study, pre, running, closing, payments, stopped, owners }
}

/** Archiving is refused while any of these exist (rules 29–30) */
export function archiveBlocks(e: EntityRow): { label: string; href: string }[] {
  const i = impactOf(e)
  const open = lastRequestOf(e)
  return [
    ...[...i.running, ...i.closing, ...i.pre].map((p) => ({ label: `مشروع «${p.name}» · ${p.stage}`, href: ROUTES.project(p.id) })),
    ...i.payments.map((x) => ({ label: `دفعة معلّقة ${x.id} · ${x.project}`, href: ROUTES.payment(x.id) })),
    ...(open && ['draft', 'review', 'completion'].includes(open.state) ? [{ label: `طلب مفتوح ${open.id} · ${REQ_SAY[open.state]}`, href: open.href }] : []),
  ]
}

/* ── Bank accounts · deletion only without a financial history (rule 28) ── */

export const bankLinked = (e: EntityRow, bankId: string): boolean =>
  !overlayOf(e.id).addedBanks.some((b) => b.id === bankId) && (e.grantedTotal > 0 || e.inDisbursement > 0)

/* ── One entity · on, greyed with its reason, or not there ── */

export interface ActState { show: boolean; on: boolean; why?: string; grant: Grant }


export function actState(a: ActKey, e: EntityRow, role: RoleKey): ActState {
  const grant = grantOf(a, role)
  const { state, block } = accountOf(e)
  const req = lastRequestOf(e)
  const hide = (): ActState => ({ show: false, on: false, grant })
  const off = (why: string): ActState => ({ show: true, on: false, why, grant })
  const yes = (): ActState => (grant === 'do' ? { show: true, on: true, grant } : { show: true, on: false, grant, why: `للاطلاع · القرار ${forWho(a)}` })
  if (grant === 'none') return hide()
  const archivedHidden = state === 'archived' && role !== 'admin'
  switch (a) {
    case 'view': case 'log': case 'export':
      return archivedHidden ? hide() : { show: true, on: true, grant }
    case 'review':
      if (state === 'archived' || !req) return hide()
      if (req.state === 'review') return yes()
      if (req.state === 'completion') return off('بانتظار الجهة · أُعيد الطلب للاستكمال')
      return hide()
    case 'ask':
      if (state === 'archived' || state === 'never') return hide()
      if (openUpdateOf(e.id)) return off('يوجد طلب تحديث مفتوح لهذه الجهة')
      return yes()
    case 'notify':
      return state === 'archived' ? hide() : yes()
    case 'suspend':
      if (state === 'archived' || state === 'never') return hide()
      if (block === 'suspension') return off('الجهة معلّقة الأهلية بقرار قائم')
      if (block === 'revoked') return off('الجهة ملغاة الاعتماد')
      if (state === 'inactive') return off('الجهة غير نشطة لمستند منتهٍ · التعليق يسري على النشطة أو المعلقة')
      return yes()
    case 'lift':
      return block === 'suspension' ? yes() : hide()
    case 'revoke':
      if (state === 'archived' || state === 'never' || block === 'revoked') return hide()
      return yes()
    case 'archive': {
      if (state === 'archived') return hide()
      const b = archiveBlocks(e)
      if (b.length) return off(`لا تُؤرشف قبل إنهاء ${b.length} ${b.length === 1 ? 'ارتباط' : 'ارتباطات'} قائمة`)
      return yes()
    }
    case 'banks':
      return state === 'archived' ? { show: true, on: false, grant, why: 'الجهة مؤرشفة · اطلاع فقط' } : yes()
    case 'assign':
      if (state === 'archived' || !req || !(req.state === 'review' || req.state === 'completion')) return hide()
      return yes()
  }
}

/* ── A selection · who it runs on, who's left out and why ── */

export interface Split { ok: EntityRow[]; skipped: { reason: string; rows: EntityRow[] }[] }

export function splitFor(a: 'ask' | 'notify' | 'assign' | 'export', rows: EntityRow[]): Split {
  const ok: EntityRow[] = []
  const skip = new Map<string, EntityRow[]>()
  const out = (why: string, e: EntityRow) => skip.set(why, [...(skip.get(why) ?? []), e])
  for (const e of rows) {
    const { state } = accountOf(e)
    if (a === 'export') { ok.push(e); continue }
    if (state === 'archived') { out('مؤرشفة', e); continue }
    if (a === 'notify') {
      if (!e.email && !e.mobile) { out('لا توجد قناة تواصل متحقق منها', e); continue }
      ok.push(e); continue
    }
    if (a === 'ask') {
      if (state === 'never') { out('لم تُعتمد قط', e); continue }
      if (openUpdateOf(e.id)) { out('يوجد تحديث مفتوح', e); continue }
      ok.push(e); continue
    }
    const r = lastRequestOf(e)
    if (!r || !(r.state === 'review' || r.state === 'completion')) { out('لا يوجد طلب تحت المراجعة أو بانتظار الاستكمال', e); continue }
    ok.push(e)
  }
  return { ok, skipped: [...skip].map(([reason, rs]) => ({ reason, rows: rs })) }
}

/* ── Reason templates · managed by the system admin, owned by the grants sector ── */

export interface ReasonTpl { code: string; label: string; shown: boolean; attach: boolean }
const OTHER: ReasonTpl = { code: 'OTH', label: 'أخرى (نص حر)', shown: true, attach: false }

export const REASONS: Record<'suspend' | 'lift' | 'revoke' | 'archive' | 'ask' | 'bank', ReasonTpl[]> = {
  suspend: [
    { code: 'SUS-01', label: 'ثبوت عدم صحة البيانات', shown: true, attach: true },
    { code: 'SUS-02', label: 'مخالفة السياسات', shown: true, attach: true },
    { code: 'SUS-03', label: 'عدم تجديد مستند إلزامي منتهٍ', shown: true, attach: false },
    OTHER,
  ],
  lift: [
    { code: 'LFT-01', label: 'معالجة سبب التعليق', shown: true, attach: false },
    { code: 'LFT-02', label: 'قرار مراجعة لصالح الجهة', shown: true, attach: false },
    OTHER,
  ],
  revoke: [
    { code: 'REV-01', label: 'ثبوت مخالفة جسيمة', shown: true, attach: true },
    { code: 'REV-02', label: 'تكرار المخالفة بعد التعليق', shown: true, attach: true },
    OTHER,
  ],
  archive: [
    { code: 'ARC-01', label: 'توقّف نشاط الجهة', shown: false, attach: false },
    { code: 'ARC-02', label: 'سجل مكرر', shown: false, attach: false },
    OTHER,
  ],
  ask: [
    { code: 'ASK-01', label: 'مستند إلزامي قارب على الانتهاء أو انتهى', shown: true, attach: false },
    { code: 'ASK-02', label: 'بيانات اتصال غير محدّثة', shown: true, attach: false },
    { code: 'ASK-03', label: 'تحديث دوري للملف', shown: true, attach: false },
    OTHER,
  ],
  bank: [
    { code: 'BNK-01', label: 'حساب أُضيف بالخطأ', shown: false, attach: false },
    { code: 'BNK-02', label: 'حساب مكرر', shown: false, attach: false },
    OTHER,
  ],
}

export const reasonText = (kind: keyof typeof REASONS, code: string, text: string): string =>
  code === 'OTH' ? text.trim() : REASONS[kind].find((r) => r.code === code)?.label ?? ''

export const reasonOf = (kind: keyof typeof REASONS, code: string): ReasonTpl | undefined => REASONS[kind].find((r) => r.code === code)

/** What an entity can be asked to update */
export const ASK_ITEMS = [
  'الترخيص ساري المفعول', 'قرار تكليف مجلس الإدارة', 'شهادة الزكاة', 'الشهادة البنكية',
  'بيانات الاتصال', 'بيانات المدير التنفيذي', 'القوائم المالية المدققة',
]

export interface NoticeTpl { key: string; label: string; title: string; text: string }
export const NOTICE_TPLS: NoticeTpl[] = [
  { key: 'docs', label: 'تذكير بمستندات تنتهي قريبًا', title: 'مستندات جهتك تنتهي قريبًا', text: 'نذكّركم بتجديد المستندات الإلزامية قبل انتهائها حتى لا يتوقف نشاط الجهة.' },
  { key: 'cycle', label: 'إعلان فتح دورة تقديم', title: 'فُتحت دورة تقديم جديدة', text: 'نُعلن فتح دورة التقديم على المنح · يمكنكم تقديم طلباتكم من بوابة الجهة.' },
  { key: 'report', label: 'تذكير بتقرير متأخر', title: 'تقرير بانتظار الرفع', text: 'لديكم تقرير مستحق على أحد المشاريع · نرجو رفعه في أقرب وقت.' },
  { key: 'free', label: 'نص حر', title: '', text: '' },
]
export const CHANNELS = ['داخل البوابة', 'البريد الإلكتروني', 'رسالة نصية', 'كل القنوات']
