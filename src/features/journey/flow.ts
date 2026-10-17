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

/* 17 Oct · rewritten on the v3 procedures, in the order the system now runs them: registration
   (BPD-002) · study and approval (BPD-003/004 · «معتمد» at the decision, no confirmation seat) · the
   plan before the agreement (BPD-012 · the agreement's payments read its activities) · the agreement
   (BPD-008 · signed with a code) · the payment (BPD-009 · a first payment with no condition is eligible
   from activation, the supervisor creates the permit, finance orders then transfers with its proof) ·
   the closing (BPD-010 · the executive financial report, not invoices · the matrix's last approver ·
   evaluation out of 100 · the unspent grant released, «مغلق بوفر»). */
export const FLOW: JProc[] = [
  {
    key: 'entity', label: 'تسجيل الجهة', id: 'REQ-2026-950001',
    steps: [
      {
        /* doc 2.2.7 · the request can't be sent before its data and documents are complete */
        who: 'الجهة', person: ENTITY, act: 'أرسل طلب التسجيل', done: 'أرسلت الجهة طلب التسجيل بعد اكتمال بياناته ومرفقاته',
        sets: { 'اسم الجهة': J_ENTITY, 'التصنيف': 'جمعية أهلية', 'المنطقة': 'الرياض · الرياض', 'المستندات': '7 من 7 · سارية', 'الحساب البنكي': 'آيبان متحقَّق منه' },
        edit: ['التعريف والترخيص', 'التواريخ', 'الاتصال والأشخاص', 'الحسابات البنكية', 'المستندات'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'راجع الطلب وأحِله', done: 'راجع مشرف المنح البيانات والمستندات وأحال الطلب للاعتماد',
        sets: { 'الحالة': 'تحت المراجعة' },
        edit: ['ملاحظات على كل حقل', 'قرار الإحالة أو الإعادة للاستكمال'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد التسجيل', done: 'اعتمد مدير المنح التسجيل وفُعّل حساب الجهة في البوابة',
        sets: { 'الحالة': 'جهة نشطة', 'الحساب': 'مفعّل · أُرسلت بيانات الدخول', 'نوع الشراكة': 'شريك مستفيد' },
        edit: ['قرار الاعتماد أو الإعادة أو الرفض'],
      },
    ],
  },
  {
    key: 'project', label: 'الدراسة والاعتماد', id: 'PRJ-2026-21900',
    steps: [
      {
        who: 'الجهة', person: ENTITY, act: 'قدّم المشروع', done: 'قدّمت الجهة المشروع في فترة التقديم المفتوحة',
        sets: { 'المشروع': J_PROJECT, 'المبلغ المطلوب': '220,000 ريال', 'المدة': '120 يوم عمل', 'المستفيدون': '120 شابًا', 'مخرجات الجهة': '3 مخرجات بمؤشراتها', 'الحالة': 'قيد الدراسة' },
        edit: ['بيانات المشروع', 'الأهداف والمخرجات', 'الميزانية التفصيلية', 'المرفقات'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'ادرس وأوصِ بالموافقة', done: 'درس مشرف المنح المشروع وأوصى بالموافقة',
        sets: { 'الدراسة': '84 من 100', 'التصنيف': 'مشروع عادي', 'مخرجات المؤسسة': 'نسخة معتمدة من مخرجات الجهة', 'التوصية': 'موافقة بكامل المبلغ' },
        edit: ['معايير الدراسة', 'مخرجات المؤسسة', 'المبلغ الموصى به', 'التوصية ومبرراتها'],
      },
      {
        /* doc 0.status.3 · «معتمد» at the decision · the hold becomes a commitment · the plan decision */
        who: 'مدير المنح', person: MGR, act: 'اعتمد المشروع', done: 'اعتمد مدير المنح المشروع ضمن حدّه المالي',
        sets: { 'المبلغ المعتمد': '220,000 ريال', 'صاحب القرار': 'مدير المنح · ضمن حدّه', 'الحجز': 'تحوّل إلى التزام نهائي', 'بند الميزانية': 'منح التمكين · الشباب', 'قرار الخطة': 'يتطلب خطة', 'الحالة': 'معتمد · استكمال متطلبات ما قبل التنفيذ' },
        edit: ['المبلغ المعتمد بمبرر', 'ربط بند الميزانية', 'قرار الخطة', 'شروط الاعتماد'],
      },
    ],
  },
  {
    key: 'plan', label: 'الخطة', id: 'PL-2026-9001',
    steps: [
      {
        who: 'الجهة', person: ENTITY, act: 'أرسل الخطة', done: 'أرسلت الجهة خطة المشروع',
        sets: { 'الهيكل': '3 مراحل · 6 أنشطة', 'التكلفة': '220,000 ريال · تساوي المنحة', 'المخرجات': 'لكل نشاط مخرجه وشاهده' },
        edit: ['المراحل وتواريخها', 'الأنشطة وأوزانها', 'تكلفة كل مرحلة', 'الشواهد المطلوبة'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'راجع وأحِل', done: 'راجع مشرف المنح الخطة وأحالها',
        edit: ['ملاحظات على كل نشاط', 'قرار الرفع أو الإعادة'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد الخطة', done: 'اعتمد مدير المنح الخطة',
        sets: { 'النسخة المرجعية': 'V1 · مثبّتة', 'الحالة': 'قيد التنفيذ' },
        edit: ['قرار الاعتماد أو الإعادة'],
      },
    ],
  },
  {
    key: 'agreement', label: 'الاتفاقية', id: 'AG-2026-9001',
    steps: [
      {
        who: 'مشرف المنح', person: SUP, act: 'أعدّ الاتفاقية وأرسلها', done: 'أعدّ مشرف المنح الاتفاقية من النموذج وأرسلها للاعتماد',
        sets: { 'النوع': 'إلكترونية', 'جدول الدفعات': 'دفعة واحدة · 220,000 ريال · بلا شرط', 'متطلبات الدفعة': 'خطاب الطلب', 'المفوّض بالتوقيع': 'رئيس مجلس الجهة', 'شروط الاعتماد': 'مدرجة في البنود' },
        edit: ['النموذج والبنود', 'جدول الدفعات ومتطلباتها', 'المفوّض بالتوقيع'],
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
        who: 'الجهة', person: ENTITY, act: 'وقّع الاتفاقية', done: 'وقّعت الجهة الاتفاقية إلكترونيًا برمز التحقق',
        sets: { 'الحالة': 'سارية', 'المشروع': 'تحت التنفيذ', 'الدفعة الأولى': 'مؤهلة للصرف من التفعيل' },
        edit: ['التوقيع برمز التحقق'],
      },
    ],
  },
  {
    key: 'payment', label: 'الصرف', id: 'SR-2026-19001',
    steps: [
      {
        /* doc 9.2.2 · 9.2.10 · a first or only payment with no condition · the supervisor creates the permit */
        who: 'مشرف المنح', person: SUP, act: 'أنشئ إذن الصرف', done: 'أنشأ مشرف المنح إذن صرف الدفعة الأولى والوحيدة',
        sets: { 'الدفعة': '1 من 1 · 220,000 ريال', 'الحالة': 'إذن صرف عند مدير المنح' },
        edit: ['مبلغ الإذن (حتى قيمة الدفعة)', 'التحقق من الحساب البنكي المعتمد'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد إذن الصرف', done: 'اعتمد مدير المنح إذن الصرف ضمن حدّه وأحاله للمالية',
        sets: { 'مصدر التمويل': 'ميزانية المنح 2026' },
        edit: ['قرار الاعتماد أو الإعادة'],
      },
      {
        who: 'الإدارة المالية', person: 'محمد المطيري', act: 'اعتمد أمر الصرف', done: 'اعتمدت الإدارة المالية أمر الصرف',
        edit: ['أمر الصرف', 'قرار الاعتماد أو الإعادة'],
      },
      {
        who: 'الإدارة المالية', person: 'محمد المطيري', act: 'نفّذ التحويل', done: 'نفّذت الإدارة المالية التحويل وأرفقت إثباته',
        sets: { 'الحالة': 'تم الصرف', 'إثبات التحويل': 'إشعار التحويل البنكي.pdf', 'المصروف': '220,000 ريال' },
        edit: ['إثبات التحويل', 'تاريخ التحويل'],
      },
    ],
  },
  {
    key: 'closing', label: 'الإغلاق', id: 'CL-2026-9001',
    steps: [
      {
        who: 'مشرف المنح', person: SUP, act: 'افتح متطلبات الإغلاق', done: 'اكتملت الأنشطة ففتح مشرف المنح متطلبات الإغلاق وأُبلغت الجهة',
        sets: { 'المشروع': 'قيد الإغلاق', 'النشر الإعلامي': 'مطلوب في الاتفاقية' },
        edit: ['فتح الطلب'],
      },
      {
        who: 'الجهة', person: ENTITY, act: 'أرسل التقرير الختامي', done: 'أرسلت الجهة التقرير الختامي والتقرير المالي التنفيذي',
        sets: { 'المستفيدون الفعليون': '128 · +7% عن المعتمد', 'المخرجات': '3 من 3 تحقق منها', 'المصروف الفعلي': '218,400 ريال', 'المرفقات': 'التقرير المالي التنفيذي · صور التنفيذ · أدلة المخرجات' },
        edit: ['المستفيدون والمخرجات المتحقق منها', 'المصروف والمدة', 'النتائج والتحديات', 'المستندات'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'اعتمد المصروف وأحِل', done: 'اعتمد مشرف المنح المصروف الفعلي من التقرير المالي التنفيذي وأحال التقرير',
        sets: { 'المصروف المعتمد': '218,400 ريال', 'الوفر': '1,600 ريال' },
        edit: ['ملاحظات المراجعة', 'المصروف المعتمد', 'طلب الفواتير عند الحاجة', 'قرار الإحالة أو الإعادة'],
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
        who: 'المدير التنفيذي', person: CEO, act: 'اعتمد التقرير الختامي', done: 'اعتمد المدير التنفيذي التقرير الختامي (المعتمد النهائي في مصفوفة الإغلاق)',
        sets: { 'التقرير': 'معتمد ومقفل' },
        edit: ['قرار الاعتماد أو الإعادة'],
      },
      {
        who: 'مشرف المنح', person: SUP, act: 'أرسل التقييم', done: 'أعدّ مشرف المنح التقييم وأرسله',
        sets: { 'التقييم': '86 من 100 · بأسئلة التقييم المعتمدة', 'الدروس المستفادة': 'مسجّلة في ملف الجهة' },
        edit: ['أسئلة التقييم ودرجاتها', 'الأثر والدروس المستفادة'],
      },
      {
        who: 'مدير المنح', person: MGR, act: 'اعتمد التقييم', done: 'اعتمد مدير المنح التقييم',
        edit: ['قرار اعتماد التقييم أو إعادته'],
      },
      {
        who: 'المدير التنفيذي', person: CEO, act: 'اعتمد وأغلق المشروع', done: 'اعتمد المدير التنفيذي التقييم وأُغلق المشروع وحُرّر الوفر إلى البند',
        sets: { 'الحالة': 'مغلق بوفر', 'الوفر المحرَّر': '1,600 ريال إلى بند الميزانية' },
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
