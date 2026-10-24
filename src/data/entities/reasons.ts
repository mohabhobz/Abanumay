import { CFG, persist, readJson } from '@/lib/config'
import { logSettings } from '@/data/shared/settingsLog'
import { ROUTES } from '@/app/routes'
import { BANK_REJECT_REASONS } from '@/data/mock/taxonomy'

/* Client meeting 23 Oct · the entity module's reason lists.

   Every decision that turns a request or an account down — rejecting or returning a registration or
   an update request, disabling or deleting a bank account — picks its reason from a list the
   authority holders edit in the entity settings, or «أخرى» with a written reason. One list per
   decision, one dialog for all of them (`ReasonDialog`), and the reason lands in the record's log
   with who and when. */

export const OTHER = 'أخرى'

export type ReasonKind = 'regReject' | 'regReturn' | 'updReject' | 'updReturn' | 'bankDisable' | 'bankDelete'

export const REASON_KINDS: { kind: ReasonKind; label: string; hint: string }[] = [
  { kind: 'regReject', label: 'رفض طلب التسجيل', hint: 'يختارها صاحب الصلاحية عند رفض طلب تسجيل جهة' },
  { kind: 'regReturn', label: 'إعادة طلب التسجيل للاستكمال', hint: 'تظهر للجهة مع الطلب المعاد' },
  { kind: 'updReject', label: 'رفض طلب التحديث', hint: 'عند رفض طلب تحديث بيانات جهة' },
  { kind: 'updReturn', label: 'إعادة طلب التحديث للاستكمال', hint: 'تظهر للجهة مع الطلب المعاد' },
  { kind: 'bankDisable', label: 'تعطيل حساب بنكي', hint: 'عند تعطيل حساب بنكي لجهة' },
  { kind: 'bankDelete', label: 'حذف حساب بنكي', hint: 'عند حذف حساب بنكي لم يُصرف عليه' },
]

const DEFAULTS: Record<ReasonKind, string[]> = {
  regReject: ['عدم صحة البيانات أو الوثائق', 'عدم استيفاء ضوابط القبول', 'جهة مسجّلة سابقًا', 'الترخيص منتهٍ أو غير صالح'],
  regReturn: ['بيانات ناقصة', 'مستند ناقص أو غير واضح', 'بيانات الحساب البنكي غير مطابقة', 'بيانات المفوّض غير مكتملة'],
  updReject: ['التعديل غير مدعوم بمستند', 'البيانات المعدّلة غير صحيحة', 'التعديل يخالف ضوابط القبول'],
  updReturn: ['مستند داعم ناقص', 'بيانات غير مكتملة', 'المرفق غير واضح'],
  bankDisable: [...BANK_REJECT_REASONS],
  bankDelete: ['أُضيف الحساب بالخطأ', 'إلغاء الحساب بناءً على طلب الجمعية', 'الحساب مكرر'],
}

const saved = readJson<Partial<Record<ReasonKind, string[]>>>(CFG.entityReasons, {})

/** The live lists · the settings page edits them in place */
export const ENTITY_REASONS: Record<ReasonKind, string[]> = Object.fromEntries(
  REASON_KINDS.map(({ kind }) => [kind, Array.isArray(saved[kind]) && saved[kind]!.length ? [...saved[kind]!] : [...DEFAULTS[kind]]]),
) as Record<ReasonKind, string[]>

export const reasonsOf = (kind: ReasonKind): string[] => ENTITY_REASONS[kind]

export function saveReasons(kind: ReasonKind, list: string[], by: string): string[] {
  const clean = [...new Set(list.map((x) => x.trim()).filter(Boolean))].filter((x) => x !== OTHER)
  if (!clean.length) return ['سبب واحد على الأقل']
  const before = [...ENTITY_REASONS[kind]]
  ENTITY_REASONS[kind].splice(0, ENTITY_REASONS[kind].length, ...clean)
  persist(CFG.entityReasons, ENTITY_REASONS)
  const label = REASON_KINDS.find((k) => k.kind === kind)?.label ?? kind
  logSettings(`أسباب ${label}`, `${ROUTES.entitySettings}?tab=reasons`, by, [{ k: 'القائمة', from: before.join('، '), to: clean.join('، ') }])
  return []
}

/** A picked reason as the dialog returns it */
export interface PickedReason {
  reason: string
  /** The written text when the reason is «أخرى», or a note added to a listed reason */
  text: string
}

/** The reason as the log reads it */
export const pickedSay = (p: PickedReason): string =>
  p.reason === OTHER ? `${OTHER}: ${p.text.trim()}` : p.text.trim() ? `${p.reason} · ${p.text.trim()}` : p.reason
