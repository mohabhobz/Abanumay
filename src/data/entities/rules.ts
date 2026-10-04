import { CFG, persist, readJson } from '@/lib/config'
import type { RoleKey } from '@/data/roles'

/* Entity registration and update rules (BPD-002) · every number and switch here is a setting, read
   by the forms, the review screens and the password reset alike.

   `blockIncomplete` carries a decision, not a default: the document (2.2.7 · 2.4.4) forbids sending
   a registration that is missing data or documents, and the client asked on 30 September that the
   entity may send anyway and the reviewer handles the gaps. Both readings are built; the switch
   decides which one runs, and it starts on the client's. */

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
  /** Fields whose change waits for approval · the rest apply at once (2.3.upd-8 · 2.3.upd-15) */
  approvalFields: string[]
}

const DEFAULT: EntityRules = {
  blockIncomplete: false,
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
  approvalFields: ['name', 'type', 'licensor', 'licenseNo', 'region', 'city', 'licenseEndsAt', 'boardEndsAt'],
}

export const ENTITY_RULES: EntityRules = readJson(CFG.entityRules, DEFAULT)

export const saveEntityRules = (next: EntityRules): void => {
  Object.assign(ENTITY_RULES, structuredClone(next))
  persist(CFG.entityRules, ENTITY_RULES)
}

export const ENTITY_RULES_DEFAULT = DEFAULT

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
