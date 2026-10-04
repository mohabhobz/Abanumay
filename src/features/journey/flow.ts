/* The happy path · meeting 1 Oct, item A-7.

   One entity, one project, one agreement, one plan, one disbursement and one closing — every step
   approved first time, in order. Built as its own module on purpose: it reads no mock data and
   writes none, so the rest of the prototype is untouched by it (the client asked for it on a
   separate branch, with its state held in the session rather than in the code's data).

   Each step names the seat that acts, the person in it, what they do, what the record gains and
   what that seat may edit at that moment. The screen only walks this list. */

export interface JStep {
  /** The seat · the role that holds the record at this step */
  who: string
  person: string
  /** The button label · imperative */
  act: string
  /** The log line once done · past tense */
  done: string
  /** Fields the record gains at this step */
  sets?: Record<string, string>
  /** What this seat may edit at this step */
  edit: string[]
}

export interface JProc {
  key: string
  label: string
  /** The record's own id, as it would read in the system */
  id: string
  steps: JStep[]
}

const ENTITY = 'سارة القحطاني'
const SUP = 'عمر قاسم'
const MGR = 'عبدالله الدوسري'
const CEO = 'عبدالرحمن الهليّل'

export const J_ENTITY = 'جمعية غراس للتنمية الشبابية'
export const J_PROJECT = 'برنامج غراس لتأهيل الشباب للعمل التطوعي'
export const J_AMOUNT = 220_000

export const FLOW: JProc[] = [
  {
    key: 'entity', label: 'تسجيل الجهة', id: 'REQ-2026-950001',
    steps: [
      {
        who: 'الجهة', person: ENTITY, act: 'أرسل طلب التسجيل', done: 'أرسلت الجهة طلب التسجيل',
        sets: { 'اسم الجهة': J_ENTITY, 'التصنيف': 'جمعية أهلية', 'المنطقة': 'الرياض · الرياض', 'المستندات': '7 من 7' },
        edit: ['التعريف والترخيص', 'التواريخ', 'الاتصال والأشخاص', 'الحسابات البنكية', 'المستندات'],
      },
      {
        who: 'مسؤول النظام', person: 'نورة القحطاني', act: 'اعتمد التسجيل', done: 'اعتُمد التسجيل وأُنشئت الجهة',
        sets: { 'الحالة': 'جهة نشطة', 'نوع الشراكة': 'شريك مستفيد' },
        edit: ['قرار القبول أو الإعادة أو الرفض'],
      },
    ],
  },
  {
    key: 'project', label: 'المشروع', id: 'PRJ-2026-21900',
    steps: [
      {
        who: 'الجهة', person: ENTITY, act: 'قدّم المشروع', done: 'قدّمت الجهة المشروع',
        sets: { 'المشروع': J_PROJECT, 'المبلغ المطلوب': '220,000 ريال', 'المدة': '180 يومًا', 'المستفيدون': '120 شابًا' },
        edit: ['بيانات المشروع', 'الميزانية التفصيلية', 'المرفقات'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'أوصِ بالموافقة', done: 'أوصى مشرف المنح بالموافقة',
        sets: { 'التوصية': 'موافقة بكامل المبلغ' },
        edit: ['التقييم والتوصية', 'المبلغ الموصى به', 'بنود الميزانية'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد المشروع', done: 'اعتمد مدير المنح المشروع ضمن حدّه المالي',
        sets: { 'المبلغ المعتمد': '220,000 ريال', 'صاحب القرار': 'مدير المنح · حدّه 250,000' },
        edit: ['المبلغ المعتمد', 'بنود الميزانية', 'إضافة خطة', 'ربط بند الميزانية'],
      },
    ],
  },
  {
    key: 'agreement', label: 'الاتفاقية', id: 'AG-2026-9001',
    steps: [
      {
        who: 'مشرف المنح', person: SUP, act: 'أعدّ الاتفاقية وأرسلها', done: 'أعدّ مشرف المنح الاتفاقية',
        sets: { 'النوع': 'إلكترونية', 'جدول الدفعات': 'دفعة واحدة · 220,000 ريال', 'المفوّض بالتوقيع': 'رئيس مجلس الجهة' },
        edit: ['النموذج والنوع', 'جدول الدفعات وشروطها', 'المفوّض بالتوقيع'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد الاتفاقية', done: 'اعتمد مدير المنح الاتفاقية',
        edit: ['قرار الاعتماد أو الإعادة'],
      },
      {
        who: 'المدير التنفيذي', person: CEO, act: 'اعتمد الاتفاقية', done: 'اعتمد المدير التنفيذي الاتفاقية',
        edit: ['قرار الاعتماد أو الإعادة'],
      },
      {
        who: 'الجهة', person: ENTITY, act: 'وقّع الاتفاقية', done: 'وقّعت الجهة الاتفاقية',
        sets: { 'الحالة': 'سارية' },
        edit: ['التوقيع'],
      },
    ],
  },
  {
    key: 'plan', label: 'الخطة', id: 'PL-2026-9001',
    steps: [
      {
        who: 'الجهة', person: ENTITY, act: 'أرسل الخطة', done: 'أرسلت الجهة خطة المشروع',
        sets: { 'الهيكل': '3 مراحل · 6 أنشطة', 'التكلفة': '220,000 ريال · تساوي المنحة' },
        edit: ['المراحل وتواريخها', 'الأنشطة وأوزانها', 'تكلفة كل مرحلة', 'الشواهد المطلوبة'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'راجع وأحِل', done: 'راجع مشرف المنح الخطة وأحالها',
        edit: ['ملاحظات على كل نشاط', 'قرار الرفع أو الإعادة'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد الخطة', done: 'اعتمد مدير المنح الخطة',
        sets: { 'النسخة المرجعية': 'V1 · مثبّتة' },
        edit: ['قرار الاعتماد أو الإعادة'],
      },
    ],
  },
  {
    key: 'payment', label: 'الصرف', id: 'SR-2026-19001',
    steps: [
      {
        who: 'الجهة', person: ENTITY, act: 'اطلب الدفعة', done: 'طلبت الجهة الدفعة الأولى والوحيدة',
        sets: { 'الدفعة': '1 من 1 · 220,000 ريال', 'المسوّغات': 'خطاب الطلب · تقرير الإنجاز' },
        edit: ['المبلغ المطلوب', 'المسوّغات'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'تحقّق وارفع', done: 'تحقّق مشرف المنح من الشروط ورفع الطلب',
        edit: ['التحقّق من الشروط والمسوّغات', 'قرار الرفع أو الإعادة'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد الصرف', done: 'اعتمد مدير المنح الصرف',
        sets: { 'مصدر التمويل': 'ميزانية المنح 2026' },
        edit: ['قرار الاعتماد أو الإعادة', 'مصدر التمويل'],
      },
      {
        who: 'الإدارة المالية', person: 'محمد المطيري', act: 'أصدر السند وحوّل', done: 'أصدرت الإدارة المالية سند الصرف وحوّلت المبلغ',
        sets: { 'الحالة': 'تم الصرف' },
        edit: ['سند الصرف', 'تاريخ التحويل'],
      },
    ],
  },
  {
    key: 'closing', label: 'الإغلاق', id: 'CL-2026-9001',
    steps: [
      {
        who: 'مشرف المنح', person: SUP, act: 'افتح طلب التقرير الختامي', done: 'فتح مشرف المنح طلب التقرير الختامي',
        edit: ['فتح الطلب'],
      },
      {
        who: 'الجهة', person: ENTITY, act: 'أرسل التقرير الختامي', done: 'أرسلت الجهة التقرير الختامي',
        sets: { 'المستفيدون الفعليون': '128 · +7% عن المعتمد', 'الميزانية الفعلية': '218,400 ريال' },
        edit: ['المستفيدون الفعليون', 'الميزانية الفعلية والمدة', 'النتائج والمخاطر', 'المستندات'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'اعتمد وأحِل', done: 'اعتمد مشرف المنح التقرير وأحاله',
        edit: ['ملاحظات المراجعة', 'قرار الإحالة أو الإعادة'],
      },
      {
        who: 'الاتصال المؤسسي', person: 'خالد السبيعي', act: 'اعتمد النشر الإعلامي', done: 'اعتمد الاتصال المؤسسي النشر الإعلامي',
        edit: ['التحقّق من النشر الإعلامي'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد التقرير', done: 'اعتمد مدير المنح التقرير',
        edit: ['قرار الاعتماد أو الإعادة'],
      },
      {
        who: 'المدير التنفيذي', person: CEO, act: 'اعتمد التقرير الختامي', done: 'اعتمد المدير التنفيذي التقرير الختامي',
        sets: { 'التقرير': 'معتمد ومقفل' },
        edit: ['قرار الاعتماد أو الإعادة'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'أرسل التقييم', done: 'أعدّ مشرف المنح التقييم وأرسله',
        sets: { 'التقييم': '4 من 5 · المؤشرات الثلاثة محقّقة' },
        edit: ['المؤشرات المحقّقة', 'الأثر والدروس المستفادة', 'الدرجة'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد التقييم', done: 'اعتمد مدير المنح التقييم',
        edit: ['قرار اعتماد التقييم أو إعادته'],
      },
      {
        who: 'المدير التنفيذي', person: CEO, act: 'اعتمد وأغلق المشروع', done: 'اعتمد المدير التنفيذي التقييم وأُغلق المشروع',
        sets: { 'الحالة': 'مغلق · مكتمل' },
        edit: ['قرار اعتماد التقييم أو إعادته'],
      },
    ],
  },
]

export const TOTAL_STEPS = FLOW.reduce((n, p) => n + p.steps.length, 0)

/* Session state · the whole journey is one counter: how many steps are done. Everything else
   (which procedure, which step, the log, each record's fields) is derived from it. Kept in
   sessionStorage so a refresh keeps the place and a new tab starts clean, as asked. */

const KEY = 'ab-journey'

export const readDone = (): number => {
  try {
    const n = Number(sessionStorage.getItem(KEY))
    return Number.isFinite(n) && n >= 0 && n <= TOTAL_STEPS ? n : 0
  } catch {
    return 0
  }
}

export const writeDone = (n: number): void => {
  try {
    sessionStorage.setItem(KEY, String(n))
  } catch {
    /* Storage may be blocked · the journey still runs for this page */
  }
}

/** Where step number `n` (0-based, counted across the whole flow) falls */
export const locate = (n: number): { proc: number; step: number } => {
  let left = n
  for (let p = 0; p < FLOW.length; p++) {
    const len = FLOW[p]!.steps.length
    if (left < len) return { proc: p, step: left }
    left -= len
  }
  return { proc: FLOW.length, step: 0 }
}

/** Simulated date of step `n` · two days apart, from the day the journey starts */
export const dayOf = (n: number): string => {
  const t = new Date('2026-10-04T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n * 2)
  return t.toISOString().slice(0, 10)
}
