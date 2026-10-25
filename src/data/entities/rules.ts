import { CFG, persist, readJson } from '@/lib/config'
import type { RoleKey } from '@/data/roles'

/* Entity registration and update rules (BPD-002) · every number and switch here is a setting, read
   by the forms, the review screens and the password reset alike.

   `blockIncomplete` · the document (2.2.7 · 2.4.5 · 2.4.15 · 2.7.1) forbids sending a registration
   that is missing data or documents or has a format error. The client asked on 30 September to let
   it through; v3 (14 October) still forbids it, so it starts on v3's · the switch stays for the
   client to turn back. */

export interface EntityRules {
  /** 2.2.7 · 2.4.4 · 2.4.13 · refuse to send a registration with gaps */
  blockIncomplete: boolean
  /** One-time codes · validity, wrong tries before the code dies, wait before a new one (2.3.pw-5 · 2.3.pw-13) */
  otpMinutes: number
  otpAttempts: number
  resendSeconds: number
  /** Password policy (2.3.pw-8) */
  passMin: number
  passNeedsDigit: boolean
  passNeedsLetter: boolean
  /** Who decides · registration (2.2.15 · 2.4.16), update requests (2.3.upd-9), suspension (2.4.21) */
  approveBy: RoleKey[]
  returnBy: RoleKey[]
  updateBy: RoleKey[]
  statusBy: RoleKey[]
  /** 14 Oct · «الإجراءات عند التحديد» (LOCTech · 8 Oct) · one setting per action, the document's
      proposal as the default · the permission matrix decides the final names */
  suspendBy: RoleKey[]
  revokeBy: RoleKey[]
  archiveBy: RoleKey[]
  bankBy: RoleKey[]
  askBy: RoleKey[]
  notifyBy: RoleKey[]
  assignBy: RoleKey[]
  /** v3 · 2.4.34 · registers a partner or strategic entity directly, without the portal */
  registerBy: RoleKey[]
  /** v3 · 2.4.10 · changes the entity a running project is tied to */
  relinkEntityBy: RoleKey[]
  /** Client 24 Oct · edits the entity's data from each section's «تعديل» · the admin always may */
  editBy?: RoleKey[]
  /** Use per-supervisor assignment of open requests · off removes «إسناد المراجعة» (open question 9) */
  assignOn: boolean
  /** Ceiling on one batch of notices or data requests */
  bulkMax: number
  /** Fields whose change waits for approval · the rest apply at once (2.3.upd-8 · 2.3.upd-15) */
  approvalFields: string[]
  /** Client 19 Oct · 2.6.7 · the days before a document's expiry when the entity is reminded ·
      each offset once per document */
  expiryOffsets: number[]
  /** The three reminder texts · {المستند} the document · {n} days left · {التاريخ} its expiry date */
  expiryText: string
  expiryUrgentText: string
  expiredText: string
  /** The file's migration version · a one-time move runs once */
  migrated?: number
}

const DEFAULT: EntityRules = {
  blockIncomplete: true,
  otpMinutes: 5,
  otpAttempts: 3,
  resendSeconds: 60,
  passMin: 8,
  passNeedsDigit: true,
  passNeedsLetter: true,
  approveBy: ['grants-manager', 'ceo'],
  returnBy: ['supervisor', 'grants-manager', 'ceo'],
  updateBy: ['grants-manager', 'ceo'],
  statusBy: ['grants-manager', 'ceo'],
  suspendBy: ['grants-manager', 'ceo'],
  revokeBy: ['ceo'],
  archiveBy: ['grants-manager'],
  bankBy: ['supervisor', 'grants-manager'],
  askBy: ['supervisor', 'grants-manager'],
  notifyBy: ['supervisor', 'grants-manager'],
  assignBy: ['grants-manager'],
  registerBy: ['supervisor', 'grants-manager'],
  relinkEntityBy: ['grants-manager'],
  editBy: ['supervisor', 'grants-manager'],
  assignOn: true,
  bulkMax: 200,
  approvalFields: ['name', 'type', 'licensor', 'licenseNo', 'region', 'city', 'licenseEndsAt', 'boardEndsAt'],
  expiryOffsets: [30, 5],
  expiryText: 'باقي على انتهاء {المستند} {n} يومًا · يرجى التجديد أو تحديث البيانات',
  expiryUrgentText: 'تنبيه أخير · باقي على انتهاء {المستند} {n} أيام · يرجى التجديد أو تحديث البيانات قبل تعليق الحساب',
  expiredText: 'انتهى {المستند} · يرجى التحديث · تم تعليق الحساب',
}

export const ENTITY_RULES: EntityRules = readJson(CFG.entityRules, structuredClone(DEFAULT))
/* v3 · 15 Oct · once · the send gate was off by default before v3 (2.2.7 · 2.7.1) · a file saved on
   the old default moves to the v3 one · a choice the admin makes after this stands */
if ((ENTITY_RULES.migrated ?? 0) < 1) {
  const moved = ENTITY_RULES.blockIncomplete === false
  if (moved) ENTITY_RULES.blockIncomplete = true
  ENTITY_RULES.migrated = 1
  if (moved) persist(CFG.entityRules, ENTITY_RULES)
}

export const saveEntityRules = (next: EntityRules): void => {
  Object.assign(ENTITY_RULES, structuredClone(next))
  persist(CFG.entityRules, ENTITY_RULES)
}

export const ENTITY_RULES_DEFAULT = DEFAULT

/** The reminder offsets, largest first, positive and distinct */
export const expiryOffsets = (): number[] => [...new Set((ENTITY_RULES.expiryOffsets ?? DEFAULT.expiryOffsets).filter((n) => n > 0))].sort((a, b) => b - a)
/** A reminder text with its placeholders filled */
export const expiryLine = (tpl: string, doc: string, n: number, at: string): string =>
  tpl.replaceAll('{المستند}', doc).replaceAll('{n}', String(n)).replaceAll('{التاريخ}', at)

/* ── The fields of an entity file · what an update request may change ── */

export interface FileField {
  key: string
  label: string
  group: 'id' | 'dates' | 'contact' | 'people'
  kind: 'text' | 'tel' | 'email' | 'url' | 'date' | 'select' | 'digits'
  /** A change here proves identity by a code sent to the new value (2.3.upd-17 · 2.4.19) */
  otp?: boolean
}

export const FILE_FIELDS: FileField[] = [
  { key: 'name', label: 'اسم الجهة', group: 'id', kind: 'text' },
  { key: 'type', label: 'تصنيف الجهة', group: 'id', kind: 'select' },
  { key: 'licensor', label: 'جهة الإشراف الفني', group: 'id', kind: 'select' },
  { key: 'licenseNo', label: 'رقم الترخيص', group: 'id', kind: 'digits' },
  { key: 'region', label: 'المنطقة', group: 'id', kind: 'select' },
  { key: 'city', label: 'المحافظة / المدينة', group: 'id', kind: 'select' },
  { key: 'licenseEndsAt', label: 'تاريخ نهاية الترخيص', group: 'dates', kind: 'date' },
  { key: 'boardEndsAt', label: 'تاريخ انتهاء تكليف المجلس', group: 'dates', kind: 'date' },
  { key: 'phone', label: 'الهاتف', group: 'contact', kind: 'tel' },
  { key: 'mobile', label: 'جوال الجهة', group: 'contact', kind: 'tel', otp: true },
  { key: 'email', label: 'البريد الإلكتروني للجهة', group: 'contact', kind: 'email', otp: true },
  { key: 'website', label: 'الموقع الإلكتروني', group: 'contact', kind: 'url' },
  { key: 'directorName', label: 'اسم المدير التنفيذي', group: 'people', kind: 'text' },
  { key: 'directorMobile', label: 'جوال المدير التنفيذي', group: 'people', kind: 'tel' },
  { key: 'clerkName', label: 'اسم مدخل البيانات', group: 'people', kind: 'text' },
  { key: 'clerkMobile', label: 'جوال مدخل البيانات', group: 'people', kind: 'tel', otp: true },
  { key: 'clerkEmail', label: 'بريد مدخل البيانات', group: 'people', kind: 'email', otp: true },
]

export const fileField = (key: string): FileField | undefined => FILE_FIELDS.find((f) => f.key === key)

export const needsApproval = (key: string): boolean => ENTITY_RULES.approvalFields.includes(key)
