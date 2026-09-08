/** تنسيقات الأرقام والتواريخ — مكان واحد عشان كل الشاشات تعرض بنفس الشكل */

/**
 * كل الأرقام في السيستم بالخانات اللاتينية (0–9)، حتى داخل النص
 * العربي. السبب مش ذوق: المستخدم بينسخ الأرقام دي في إيميلات
 * وجداول ومراسلات، والأرقام الهندية بتتكسر في النقل وبتصعّب
 * المقارنة البصرية بين صفّين. القرار موحّد فمفيش استثناء.
 */
export const nf = new Intl.NumberFormat('en-US')

/** التاريخ بالعربي، بخانات لاتينية */
export const df = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

export const money = (n: number): string => nf.format(n)

export const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100)

/**
 * نسبة جاهزة للكتابة جوّه جملة عربية.
 *
 * الرقم لاتيني، بس ده مش كفاية: خوارزمية الاتجاه بتحطّ علامة `%`
 * حسب اتجاه الجملة اللي حواليها، فـ«94%» جوّه نص عربي بتترسم
 * «%94». المحارف دي (LRI … PDI) بتقفل الرقم وعلامته في جزيرة
 * اتجاهها ثابت. في الـJSX العزل بيتعمل بـ`.num` في الـCSS؛ الدالة
 * دي للنصوص اللي بتتبني كسلسلة قبل ما توصل للـDOM.
 */
export const pct = (n: number): string => `\u2066${n}%\u2069`

/**
 * \u064a\u0639\u0632\u0644 \u0643\u0644 \u0631\u0642\u0645 \u062f\u0627\u062e\u0644 \u0646\u0635 \u0639\u0631\u0628\u064a \u062c\u0627\u0647\u0632.
 *
 * `pct` \u0628\u062a\u0634\u062a\u063a\u0644 \u0644\u0645\u0627 \u0625\u062d\u0646\u0627 \u0627\u0644\u0644\u064a \u0628\u0646\u0631\u0643\u0651\u0628 \u0627\u0644\u062c\u0645\u0644\u0629. \u0644\u0643\u0646 \u0641\u064a\u0647 \u0646\u0635\u0648\u0635 \u062c\u0627\u064a\u0629 \u0632\u064a \u0645\u0627
 * \u0647\u064a \u0645\u0646 \u0648\u062b\u064a\u0642\u0629 \u0627\u0644\u0639\u0645\u064a\u0644 \u2014 \u0635\u064a\u063a \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062a \u0645\u062b\u0644\u064b\u0627: \u00ab\u2026 \u00f7 \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639 \u00d7
 * 100%.\u00bb \u2014 \u0648\u0645\u0627 \u064a\u0646\u0641\u0639\u0634 \u0646\u0639\u064a\u062f \u0643\u062a\u0627\u0628\u062a\u0647\u0627. \u0627\u0644\u062f\u0627\u0644\u0629 \u062f\u064a \u0628\u062a\u0644\u0641\u0651 \u0643\u0644 \u062a\u0633\u0644\u0633\u0644 \u0631\u0642\u0645\u064a
 * (\u0648\u0645\u0639\u0627\u0647 \u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0646\u0633\u0628\u0629 \u0644\u0648 \u0645\u0644\u0627\u0635\u0642\u0629) \u0641\u064a \u062c\u0632\u064a\u0631\u0629 \u0627\u062a\u062c\u0627\u0647\u0647\u0627 \u062b\u0627\u0628\u062a\u060c \u0641\u0627\u0644\u0646\u0635
 * \u0628\u064a\u0641\u0636\u0644 \u062d\u0631\u0641\u064a\u064b\u0651\u0627 \u0632\u064a \u0627\u0644\u0648\u062b\u064a\u0642\u0629 \u0648\u0627\u0644\u0631\u0642\u0645 \u0628\u064a\u062a\u0631\u0633\u0645 \u0635\u062d.
 */
export const isolate = (text: string): string =>
  text.replace(/\d[\d,.]*(?:\s?%)?/g, (m) => `\u2066${m}\u2069`)

/**
 * كود المشروع المعروض: `prj-2026-00013`.
 *
 * النظام العامل بيعرض رقمًا متسلسلًا عاريًا (`20940`) ما بيقولش سنة
 * ولا نوع، ولمّا يتنسخ في إيميل بيبقى رقمًا بلا هوية. الكود ده بيحمل
 * النوع والسنة والتسلسل، وبيتسطر بنفس العرض دايمًا فالعين بتقارن
 * صفّين فوق بعض.
 *
 * **المعرّف في الـURL وفي الـAPI بيفضل الرقم الخام.** الكود عرض لا
 * مفتاح: تغييره بيكسر كل رابط محفوظ، وبيخلي الربط بالباك اند يحتاج
 * ترجمة في الاتجاهين بلا فايدة.
 */
export const projectCode = (id: string, year?: string): string =>
  `prj-${(year ?? '').slice(0, 4) || '____'}-${id.padStart(5, '0')}`

/** يقبل الكود كامل أو أي جزء منه في البحث */
export const matchesCode = (needle: string, id: string, year?: string): boolean =>
  projectCode(id, year).includes(needle.trim().toLowerCase())

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
 * العربية فيها خمس صيغ، والواجهة اللي بتقول «1 مشاريع» بتبان مترجمة
 * آليًا. الدالة دي بتاخد الصيغ وترجّع الصح، ومعاها النص المبرَز
 * عشان التمييز يطابق النص حرفيًا.
 */
export interface PluralForms {
  /** واحد */
  one: string
  /** اثنان */
  two: string
  /** 3–10 */
  few: (n: number) => string
  /** 11 فأكثر */
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
 * بتغيّر المثنى حسب موقعه، والجملة اللي بتقول «من 2 يوم» أو
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
  line: (n: number, gen = false) => plural(n, {
    one: 'بند واحد', two: two('بندان', 'بندين', gen),
    few: (x) => `${x} بنود`, many: (x) => `${x} بندًا`,
  }),
  source: (n: number, gen = false) => plural(n, {
    one: 'مصدر واحد', two: two('مصدران', 'مصدرين', gen),
    few: (x) => `${x} مصادر`, many: (x) => `${x} مصدرًا`,
  }),
  riyal: (n: number) => `${nf.format(n)} ريال`,
}
