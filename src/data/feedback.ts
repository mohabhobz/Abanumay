/* 17 Oct · on the client's comment · «every action in the system answers».

   A press that changes nothing visible reads as broken, even when the record changed. Every store's
   live action now says so in one line (a toast), and a screen can say its own sentence. Replay never
   speaks · only an action taken now. */

export type ToastTone = 'ok' | 'warn' | 'bad' | 'info'
export interface ToastMsg { id: number; text: string; tone: ToastTone }

const EVENT = 'ab:toast'
let seq = 0
let last = { text: '', at: 0 }

/** Say something now · the same line twice within a moment is said once */
let pending: number | undefined
export function toast(text: string, tone: ToastTone = 'ok'): void {
  if (typeof window === 'undefined' || !text) return
  /* a screen's own sentence replaces the store's generic line said in the same moment */
  if (pending !== undefined) { window.clearTimeout(pending); pending = undefined }
  const now = Date.now()
  if (last.text === text && now - last.at < 800) return
  last = { text, at: now }
  window.dispatchEvent(new CustomEvent<ToastMsg>(EVENT, { detail: { id: ++seq, text, tone } }))
}
export const onToast = (fn: (m: ToastMsg) => void) => {
  const h = (e: Event) => fn((e as CustomEvent<ToastMsg>).detail)
  window.addEventListener(EVENT, h)
  return () => window.removeEventListener(EVENT, h)
}

/* What an operation did, in the past tense · a store passes its op's name; a screen that already
   says a more precise sentence calls `toast` itself and the store's line is folded into it (800ms) */
const SAY: Record<string, string> = {
  save: 'حُفظت التغييرات', submit: 'أُرسل للمراجعة', send: 'أُرسل', act: 'سُجّل الإجراء', decide: 'سُجّل القرار',
  create: 'أُنشئ السجل', doc: 'رُفع المرفق', study: 'حُفظت الدراسة', ask: 'أُرسل الطلب إلى الجهة', notify: 'أُرسل الإشعار',
  assign: 'أُسند', export: 'صُدّر الملف', status: 'تغيّرت الحالة', archive: 'حُدّثت الأرشفة', relink: 'نُقل المشروع',
  regDraft: 'حُفظت المسودة', regSubmit: 'أُرسل طلب التسجيل', regReturn: 'أُعيد الطلب للاستكمال', regDecide: 'سُجّل القرار',
  updSave: 'حُفظ طلب التحديث', updDecide: 'سُجّل القرار على التحديث', permitNew: 'أُنشئ إذن الصرف', pay: 'سُجّلت الدفعة',
  payee: 'سُجّل المستفيد', open: 'فُتح الإغلاق', report: 'حُفظ التقرير', evalSave: 'حُفظ التقييم', evalReview: 'حُفظ تقييمك', newVersion: 'أُنشئ إصدار جديد',
  route: 'سُجّل التوجيه', subAdd: 'أُضيف المشروع الفرعي', pfReq: 'رُفعت متطلبات الدفعة', pfReqAct: 'سُجّل الإجراء على الدفعة',
  link: 'رُبط المشروع بالبند', unlink: 'فُكّ الربط', transfer: 'سُجّل التحويل', move: 'سُجّلت المناقلة',
}
export function done(op: string, module?: string): void {
  if (typeof window === 'undefined') return
  const text = SAY[op] ?? (module ? `سُجّل الإجراء · ${module}` : 'سُجّل الإجراء')
  if (pending !== undefined) window.clearTimeout(pending)
  pending = window.setTimeout(() => { pending = undefined; toast(text) }, 0)
}
