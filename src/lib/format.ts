/** تنسيقات الأرقام والتواريخ — مكان واحد عشان كل الشاشات تعرض بنفس الشكل */

export const nf = new Intl.NumberFormat('en-US')

/** أرقام هندية للنصوص العربية */
export const nfAr = new Intl.NumberFormat('ar-EG')

export const money = (n: number): string => nf.format(n)

export const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100)

/** تكلفة المستفيد — مقياس المقارنة بين المشاريع */
export const costPerBeneficiary = (amount: number, beneficiaries: number): number =>
  beneficiaries === 0 ? 0 : Math.round(amount / beneficiaries)

/** قصّ نص طويل مع الحفاظ على الكلمة الأخيرة كاملة */
export const trim = (text: string, max = 90): string =>
  text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max))}…`

/**
 * الحرف الأول لشعار الجهة النصي.
 * بيشيل الكلمة العامة («جمعية/مؤسسة/مركز») و«ال» التعريف، وإلا كل
 * الجهات هتاخد نفس الحرف وتبقى الشعارات بلا فايدة.
 */
export const initial = (name: string): string =>
  name
    .replace(/^(جمعية|مؤسسة|مركز|هيئة|لجنة|وقف)\s+/, '')
    .replace(/^ال/, '')
    .charAt(0)

/**
 * صيغة الجمع العربية.
 * العربية فيها خمس صيغ، والواجهة اللي بتقول «١ مشاريع» بتبان مترجمة
 * آليًا. الدالة دي بتاخد الصيغ وترجّع الصح، ومعاها النص المبرَز
 * عشان التمييز يطابق النص حرفيًا.
 */
export interface PluralForms {
  /** واحد */
  one: string
  /** اثنان */
  two: string
  /** ٣–١٠ */
  few: (n: number) => string
  /** ١١ فأكثر */
  many: (n: number) => string
}

export const plural = (n: number, f: PluralForms): string => {
  if (n === 1) return f.one
  if (n === 2) return f.two
  const mod = n % 100
  return mod >= 3 && mod <= 10 ? f.few(n) : f.many(n)
}

/**
 * الوحدات المتكرّرة في القراءات.
 *
 * `gen` = الصيغة بعد حرف جر («من يومين» مش «من يومان»). العربية
 * بتغيّر المثنى حسب موقعه، والجملة اللي بتقول «من ٢ يوم» أو
 * «فيه مشروعان» بتفضح إن النص متولّد آليًا.
 */
const two = (nom: string, gen: string, isGen: boolean) => (isGen ? gen : nom)

export const units = {
  project: (n: number, gen = false) => plural(n, {
    one: 'مشروع واحد', two: two('مشروعان', 'مشروعين', gen),
    few: (x) => `${x} مشاريع`, many: (x) => `${x} مشروعًا`,
  }),
  entity: (n: number, gen = false) => plural(n, {
    one: 'جهة واحدة', two: two('جهتان', 'جهتين', gen),
    few: (x) => `${x} جهات`, many: (x) => `${x} جهة`,
  }),
  day: (n: number, gen = false) => plural(n, {
    one: 'يوم واحد', two: two('يومان', 'يومين', gen),
    few: (x) => `${x} أيام`, many: (x) => `${x} يومًا`,
  }),
  doc: (n: number, gen = false) => plural(n, {
    one: 'مستند واحد', two: two('مستندان', 'مستندين', gen),
    few: (x) => `${x} مستندات`, many: (x) => `${x} مستندًا`,
  }),
  case: (n: number, gen = false) => plural(n, {
    one: 'حالة واحدة', two: two('حالتان', 'حالتين', gen),
    few: (x) => `${x} حالات`, many: (x) => `${x} حالة`,
  }),
}
