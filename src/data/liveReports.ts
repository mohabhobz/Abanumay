/**
 * كتالوج التقارير — **الـ١٣ شاشة كما هي في النظام العامل، بأعمدتها
 * وفلاترها ورسومها كاملة**.
 *
 * ليه الملف ده موجود؟ الطلب كان صريح: النموذج فرونت إند بيحاكي
 * النظام كله، ومينفعش يكون فيه شاشة الناس بتشتغل عليها وناقصة هنا.
 * قبل كده كان عندنا الـ١٣ **أسماء بس** في جدول تعريفي؛ دلوقتي كل
 * شاشة ليها تعريف كامل: السؤال اللي بتجاوب عليه، أعمدتها بالاسم
 * والنوع، فلاترها بعدد خياراتها الحقيقي، رسومها، مستويات التعمّق
 * لو فيه، وعدد صفوفها في النظام. والصفوف نفسها **دومي** — بتتولّد
 * من نفس المفردات الحقيقية عشان الشكل يبان زي ما هيبقى.
 *
 * المصدر: قراءة مباشرة بحساب `admintm` على `sys.abanumay.sa/control/…`،
 * كل الطلبات `GET` ولم يُرسل أي فورم ولم يُضغط أي زر حفظ أو اعتماد.
 *
 * ⚠️ أي رقم `rowsLive` هنا حقيقي (عدد الصفوف في النظام). أي **قيمة
 * جوّه صف** في النموذج مولَّدة.
 */
import type { IconName } from '@/components/ui'

/** نوع العمود — بيحدّد شكل الخلية والمولِّد */
export type ColKind =
  | 'id' | 'text' | 'long' | 'num' | 'money' | 'pct' | 'date' | 'file' | 'link'

export interface LiveCol {
  key: string
  label: string
  kind: ColKind
  /** عرض العمود في الجدول */
  w?: number
  /** عمود ما فيش زيه في أي شاشة تانية — بيتعلّم في الكتالوج */
  only?: boolean
}

export interface LiveFilterDef {
  label: string
  kind: 'select' | 'date' | 'text'
  /** عدد الخيارات في القائمة المنسدلة في النظام العامل */
  count?: number
}

export interface LiveChartDef {
  title: string
  /** `gauge` شريط نسبة واحد · `bars` أعمدة · `stack` أعمدة مركّبة */
  kind: 'gauge' | 'bars' | 'stack'
  /** السلاسل لو مركّب */
  series?: string[]
}

export interface LiveSpec {
  key: string
  /** مسار الشاشة تحت `sys.abanumay.sa/control/` */
  path: string
  title: string
  icon: IconName
  /** السؤال اللي المستخدم بيفتح الشاشة عشانه */
  question: string
  /** إيه اللي في الشاشة بالظبط — سطر واحد */
  what: string
  /** عدد الصفوف في النظام العامل، أو `null` لو الشاشة فورم بلا نتيجة */
  rowsLive: number | null
  cols: LiveCol[]
  filters: LiveFilterDef[]
  charts: LiveChartDef[]
  /** مستويات التعمّق لو الشاشة شجرة */
  drill?: string[]
  /** ملاحظة الأوديت */
  flaw?: string
  /** اللي لقيناه ومش معروض في النظام */
  finding?: string
  /** الحزمة اللي بتقع فيها عندنا */
  pack: string
}

/* ── أعمدة متكرّرة ── */
const C = {
  proj: { key: 'proj', label: 'المشروع', kind: 'text', w: 240 } as LiveCol,
  projNo: { key: 'projNo', label: 'رقم المشروع', kind: 'id', w: 90 } as LiveCol,
  entity: { key: 'entity', label: 'الجهة', kind: 'text', w: 200 } as LiveCol,
  year: { key: 'year', label: 'السنة', kind: 'text', w: 120 } as LiveCol,
  track: { key: 'track', label: 'المسار', kind: 'text', w: 120 } as LiveCol,
  field: { key: 'field', label: 'المجال', kind: 'text', w: 120 } as LiveCol,
  goal: { key: 'goal', label: 'الهدف', kind: 'text', w: 200 } as LiveCol,
  region: { key: 'region', label: 'المنطقة', kind: 'text', w: 110 } as LiveCol,
  owner: { key: 'owner', label: 'مالك المشروع', kind: 'text', w: 130 } as LiveCol,
  attTitle: { key: 'attTitle', label: 'عنوان المرفق', kind: 'text', w: 150 } as LiveCol,
  attDate: { key: 'attDate', label: 'تاريخ المرفق', kind: 'date', w: 105 } as LiveCol,
  att: { key: 'att', label: 'المرفق', kind: 'file', w: 100 } as LiveCol,
}

/** الفلاتر المشتركة في شاشات المشاريع — نفس السبعة بالحرف */
const PROJECT_FILTERS: LiveFilterDef[] = [
  { label: 'السنة', kind: 'select', count: 5 },
  { label: 'المسار', kind: 'select', count: 15 },
  { label: 'المجال', kind: 'select', count: 54 },
  { label: 'الهدف', kind: 'select', count: 97 },
  { label: 'المنطقة', kind: 'select', count: 14 },
  { label: 'المدينة', kind: 'select', count: 153 },
]

export const LIVE_SPECS: LiveSpec[] = [
  {
    key: 'budget',
    path: 'reports1_1',
    title: 'تقارير الميزانية',
    icon: 'budget',
    question: 'الميزانية واقفة فين، ولكل بند كام باقي؟',
    what: 'شجرة أربع مستويات: السنة ومصدر التمويل ← المسار ← المجال ← الهدف، بستّ قيم مالية لكل صف.',
    rowsLive: 5,
    drill: ['السنة × مصدر التمويل', 'المسار', 'المجال', 'الهدف'],
    cols: [
      { key: 'level', label: 'البند', kind: 'text', w: 220 },
      { key: 'budget', label: 'الميزانية', kind: 'money', w: 130 },
      { key: 'approved', label: 'المعتمد', kind: 'money', w: 130 },
      { key: 'reserved', label: 'المبلغ المحجوز', kind: 'money', w: 130 },
      { key: 'spent', label: 'المبلغ المنصرف', kind: 'money', w: 130 },
      { key: 'left', label: 'المتبقي', kind: 'money', w: 130 },
      { key: 'leftPct', label: 'نسبة المتبقي', kind: 'pct', w: 100, only: true },
    ],
    filters: [],
    charts: [
      { title: 'نسبة المصروف من الميزانية السنوية', kind: 'gauge' },
      { title: 'المصاريف السنوية حسب المجال', kind: 'stack', series: ['المدفوع', 'غير المدفوع', 'المخصص'] },
      { title: 'المصاريف السنوية', kind: 'bars' },
    ],
    finding:
      'المتبقي طلع بالسالب في سنتين: 2024 بمقدار 275,359 ريالًا، و2025 بمقدار 2,839,800 ريالًا. يعني اعتماد فوق الميزانية، معروض كخلية جدول عادية بلا أي تنبيه.',
    pack: 'money',
  },
  {
    key: 'partners',
    path: 'reports1_2',
    title: 'تقارير الشركاء',
    icon: 'entity',
    question: 'كل جهة: كم أُعتمد لها، وكم وصل، وكم تعثّر؟',
    what: 'سجل الشركاء كاملًا — ستّة عدّادات حالة فوق، وجدول بـ16 عمودًا تحت، وتعمّق لكل جهة.',
    rowsLive: 3278,
    cols: [
      { key: 'no', label: '#', kind: 'id', w: 70 },
      C.entity,
      { key: 'licensor', label: 'الجهة المشرفة', kind: 'text', w: 200 },
      { key: 'type', label: 'التصنيف', kind: 'text', w: 110 },
      C.region,
      { key: 'city', label: 'المدينة', kind: 'text', w: 100 },
      { key: 'regAt', label: 'تاريخ التسجيل', kind: 'date', w: 105 },
      { key: 'paid', label: 'عدد المشاريع المدفوعة', kind: 'num', w: 105 },
      { key: 'approved', label: 'عدد المشاريع المعتمدة', kind: 'num', w: 105 },
      { key: 'approvedY', label: 'المعتمدة للسنة الحالية', kind: 'num', w: 105 },
      { key: 'running', label: 'في التشغيل للجهة', kind: 'num', w: 100 },
      { key: 'declined', label: 'المعتذر عنها', kind: 'num', w: 95 },
      { key: 'stalled', label: 'المتعثرة', kind: 'num', w: 90 },
      { key: 'grantedY', label: 'الممنوحة خلال العام', kind: 'money', w: 130 },
      { key: 'grantedAll', label: 'كامل المبالغ الممنوحة', kind: 'money', w: 135 },
      { key: 'inPay', label: 'المبالغ في الصرف', kind: 'money', w: 125 },
    ],
    filters: [{ label: 'اسم الجهة', kind: 'text' }],
    charts: [],
    finding:
      'العدّادات الست فوق الجدول: 3,278 جهة إجمالًا · 1,751 مفعلة · 911 معلقة · 318 مرفوضة. يعني 28% من السجل معلّق.',
    pack: 'partners',
  },
  {
    key: 'projects',
    path: 'reports1_3',
    title: 'تقارير المشاريع',
    icon: 'grid',
    question: 'أعرض المشاريع اللي تنطبق عليها الشروط دي.',
    what: 'أوسع فورم فلترة في النظام — 14 فلترًا، والجدول بيطلع بـ62 عمودًا بعد الإرسال.',
    rowsLive: 4929,
    cols: [
      C.projNo, C.proj, C.entity, C.year, C.track, C.field, C.goal, C.region,
      { key: 'city', label: 'المدينة', kind: 'text', w: 100 },
      { key: 'stage', label: 'القسم الإجرائي', kind: 'text', w: 160 },
      { key: 'status', label: 'حالة المشروع', kind: 'text', w: 110 },
      { key: 'requested', label: 'المبلغ المطلوب', kind: 'money', w: 130 },
      { key: 'granted', label: 'المعتمد', kind: 'money', w: 130 },
      { key: 'spent', label: 'المصروف', kind: 'money', w: 130 },
      { key: 'method', label: 'أسلوب المنح', kind: 'text', w: 120 },
      { key: 'tag', label: 'الوسم', kind: 'text', w: 140 },
      { key: 'share', label: 'منح تشاركي', kind: 'text', w: 95 },
      { key: 'ads', label: 'يحتاج تغطية إعلامية', kind: 'text', w: 110 },
      { key: 'impact', label: 'مشروع تعظيم الأثر', kind: 'text', w: 110 },
      C.owner,
    ],
    filters: [
      ...PROJECT_FILTERS,
      { label: 'الوسم', kind: 'select', count: 19 },
      { label: 'منح تشاركي', kind: 'select', count: 2 },
      { label: 'حالة الدعم', kind: 'select', count: 2 },
      { label: 'يحتاج تشين إعلامي', kind: 'select', count: 2 },
      { label: 'يحتاج تغطية إعلامية', kind: 'select', count: 2 },
      { label: 'حالة المشاريع', kind: 'select', count: 5 },
      { label: 'أسلوب المنح', kind: 'select', count: 2 },
      { label: 'مشروع تعظيم الأثر', kind: 'select', count: 2 },
      { label: 'من تاريخ', kind: 'date' },
      { label: 'إلى تاريخ', kind: 'date' },
      { label: 'رقم المشروع', kind: 'text' },
      { label: 'اسم المشروع', kind: 'text' },
      { label: 'اسم الجهة', kind: 'text' },
    ],
    charts: [],
    finding:
      '14 فلترًا لازم تملاها قبل ما تشوف صفًّا واحدًا، والنتيجة 62 عمودًا في جدول واحد. ده أصل ملاحظة الأوديت: «الداتا موجودة ولا تظهر عند القرار».',
    pack: 'impact',
  },
  {
    key: 'spend',
    path: 'reports1_5',
    title: 'مخصص الصرف',
    icon: 'chart',
    question: 'المال رايح فين، وإنجاز الخطة وصل لكام؟',
    what: 'الشاشة الوحيدة اللي بتعرض رسومًا لا جدولًا — أربعة رسوم على 39 هدفًا.',
    rowsLive: null,
    cols: [
      C.goal,
      { key: 'paid', label: 'المدفوع', kind: 'money', w: 130 },
      { key: 'unpaid', label: 'الغير مدفوع', kind: 'money', w: 130 },
      { key: 'alloc', label: 'المخصص', kind: 'money', w: 130 },
      { key: 'done', label: 'نسبة الإنجاز', kind: 'pct', w: 100 },
    ],
    filters: PROJECT_FILTERS,
    charts: [
      { title: 'نسبة المصروف من الميزانية السنوية', kind: 'gauge' },
      { title: 'المصاريف السنوية حسب المجال', kind: 'stack', series: ['المدفوع', 'الغير مدفوع', 'المخصص'] },
      { title: 'نسبة الإنجاز من الخطة الإستراتيجية', kind: 'gauge' },
      { title: 'نسبة الإنجاز حسب المجال', kind: 'bars' },
    ],
    finding:
      'الرسم الثاني بيحطّ 39 هدفًا على محور واحد، فالأسماء بتطلع رأسية متداخلة وما تتقريش. الرقم موجود والعرض بيمنعه.',
    pack: 'money',
  },
  {
    key: 'payments',
    path: 'reports1_6',
    title: 'تقرير الدفعات',
    icon: 'budget',
    question: 'أي دفعة اتصرفت وأي واحدة لأ؟',
    what: 'جدول الدفعات بحالة السداد — سبعة فلاتر، وبلا نتيجة قبل الإرسال.',
    rowsLive: null,
    cols: [
      C.projNo, C.proj, C.entity,
      { key: 'no', label: 'رقم الدفعة', kind: 'id', w: 90 },
      { key: 'due', label: 'تاريخ الاستحقاق', kind: 'date', w: 110 },
      { key: 'amount', label: 'المبلغ', kind: 'money', w: 130 },
      { key: 'state', label: 'حالة السداد', kind: 'text', w: 100 },
      { key: 'paidAt', label: 'تاريخ الصرف', kind: 'date', w: 105 },
      { key: 'voucher', label: 'سند الصرف', kind: 'file', w: 100 },
    ],
    filters: [...PROJECT_FILTERS, { label: 'حالة السداد', kind: 'select', count: 2 }],
    charts: [],
    finding:
      'سبعة فلاتر قبل أول صف، وحالة السداد قيمتان بس: مدفوع أو غير مدفوع. مفيش «متأخر عن الاستحقاق» — والتأخير هو السؤال.',
    pack: 'money',
  },
  {
    key: 'plan',
    path: 'reports1_7',
    title: 'تقرير المجلات',
    icon: 'chart',
    question: 'إنجاز الخطة الإستراتيجية وصل لكام؟',
    what: 'رسمان بس: نسبة الإنجاز من الخطة، والإنجاز حسب المجال. وفلتر السنة وحده.',
    rowsLive: null,
    cols: [
      C.field,
      { key: 'target', label: 'المستهدف', kind: 'num', w: 100 },
      { key: 'done', label: 'المُنجَز', kind: 'num', w: 100 },
      { key: 'pct', label: 'نسبة الإنجاز', kind: 'pct', w: 100 },
    ],
    filters: [{ label: 'السنة', kind: 'select', count: 5 }],
    charts: [
      { title: 'نسبة الإنجاز من الخطة الإستراتيجية', kind: 'gauge' },
      { title: 'نسبة الإنجاز حسب المجال', kind: 'bars' },
    ],
    flaw: 'فلاتر بلا نتيجة',
    finding: 'الاسم في القائمة «تقرير المجلات» — غالبًا خطأ إملائي عن «المجالات»، ومكتوب كده في النظام.',
    pack: 'impact',
  },
  {
    key: 'ops',
    path: 'reports1_8',
    title: 'تقرير العمليات',
    icon: 'rows',
    question: '—',
    what: 'الشاشة فاضية في النظام: بلا جدول وبلا فلاتر وبلا رسوم.',
    rowsLive: null,
    cols: [],
    filters: [],
    charts: [],
    flaw: 'الشاشة فاضية',
    finding: 'اتفتحت النهارده وطلعت فاضية تمامًا — لا `thead` ولا `select` في الصفحة أصلًا. اسمها موجود في القائمة وبس.',
    pack: 'processes',
  },
  {
    key: 'staff',
    path: 'reports1_9',
    title: 'تقرير الموظفين',
    icon: 'user',
    question: '—',
    what: 'الشاشة فاضية في النظام: بلا جدول وبلا فلاتر وبلا رسوم.',
    rowsLive: null,
    cols: [],
    filters: [],
    charts: [],
    flaw: 'الشاشة فاضية',
    finding: 'زي «تقرير العمليات» بالظبط — صفحة بعنوان بلا محتوى.',
    pack: 'processes',
  },
  {
    key: 'interim',
    path: 'reports1_11',
    title: 'التقرير المرحلي',
    icon: 'doc',
    question: 'المشاريع اللي رفعت تقريرًا مرحليًّا.',
    what: 'أربعة أعمدة وبس — قايمة مرفقات، مش تقرير. مفيش فيها ولا رقم عن حالة التنفيذ.',
    rowsLive: 252,
    cols: [C.proj, C.attTitle, C.attDate, C.att],
    filters: [],
    charts: [],
    finding:
      '252 صفًّا كلهم «رفع التقرير المرحلي» + ملف. مفيش عمود بيقول التقرير قال إيه، فالمتابعة بتتعمل بفتح المرفقات واحدًا واحدًا.',
    pack: 'partners',
  },
  {
    key: 'closing',
    path: 'reports1_12',
    title: 'التقارير الختامية',
    icon: 'doc',
    question: 'الوعد اتنفّذ ولا لأ؟',
    what: '18 عمودًا، أربعة منهم مش موجودين في أي شاشة تانية: المدة الفعلية والمستفيدون الفعليون والموازنة الفعلية والمخرجات.',
    rowsLive: 976,
    cols: [
      { key: 'no', label: '#', kind: 'id', w: 80 },
      C.proj, C.year, C.track, C.field, C.goal,
      { key: 'total', label: 'المبلغ الإجمالي', kind: 'money', w: 130 },
      C.attTitle, C.attDate, C.att,
      { key: 'actualDays', label: 'مدة التنفيذ الفعلية بالأيام', kind: 'num', w: 120, only: true },
      { key: 'actualBenef', label: 'عدد المستفيدين الفعلي', kind: 'num', w: 115, only: true },
      { key: 'actualBudget', label: 'موازنة المشروع الفعلية', kind: 'money', w: 130, only: true },
      { key: 'outputs', label: 'مخرجات المشروع الفعلية', kind: 'long', w: 260, only: true },
      { key: 'notes', label: 'ملاحظات إضافية', kind: 'long', w: 180 },
      { key: 'media', label: 'رابط لصور أو فيديو', kind: 'link', w: 140 },
      { key: 'file', label: 'ملف التقرير الختامي', kind: 'file', w: 120 },
      { key: 'extra', label: 'معلومات الإضافي', kind: 'text', w: 110 },
    ],
    filters: [],
    charts: [],
    finding:
      'المؤسسة **عندها** الفرق بين المخطط والفعلي على 976 مشروعًا، وما فيش شاشة بتحسبه. التقرير معروض كقايمة مرفقات لا كمقارنة.',
    pack: 'impact',
  },
  {
    key: 'knowledge',
    path: 'reports1_13',
    title: 'تقرير المعرفة',
    icon: 'insight',
    question: 'بنتعلّم من اللي عملناه؟',
    what: '15 عمودًا آخرهم «نص المعرفة» — درس مستفاد أو سبب رفض، مكتوب بإيد مالك المشروع.',
    rowsLive: 946,
    cols: [
      C.projNo, C.proj, C.entity, C.region, C.track, C.field, C.goal,
      { key: 'date', label: 'التاريخ', kind: 'date', w: 105 },
      { key: 'requested', label: 'المبلغ المطلوب', kind: 'money', w: 125 },
      { key: 'granted', label: 'المعتمد', kind: 'money', w: 125 },
      { key: 'spent', label: 'المصروف', kind: 'money', w: 125 },
      { key: 'left', label: 'المتبقي', kind: 'money', w: 125 },
      C.owner,
      { key: 'kind', label: 'نوع', kind: 'text', w: 110 },
      { key: 'text', label: 'نص المعرفة', kind: 'long', w: 300, only: true },
    ],
    filters: [],
    charts: [],
    finding:
      'قِسنا الـ946 صفًّا: 440 نصّهم ثلاثة أحرف أو أقل (أغلبه نقطة واحدة)، و318 أقل من أربعين حرفًا، و188 فيهم درس مكتوب فعلًا. يعني 80% بيتملّى عشان يعدّي حقلًا إلزاميًّا.',
    pack: 'impact',
  },
  {
    key: 'perfUser',
    path: 'reports1_14',
    title: 'تقارير أداء الموظفين',
    icon: 'user',
    question: 'الموظف ده خلّص كام وفي كام يوم؟',
    what: 'فورم: موظف واحد × قسم × فترة. 24 موظفًا و51 قسمًا في القوائم.',
    rowsLive: null,
    cols: [
      { key: 'dept', label: 'القسم', kind: 'text', w: 220 },
      { key: 'inbox', label: 'وارد', kind: 'num', w: 90 },
      { key: 'done', label: 'مُنجَز', kind: 'num', w: 90 },
      { key: 'open', label: 'قائم', kind: 'num', w: 90 },
      { key: 'avgDays', label: 'متوسط المدة بالأيام', kind: 'num', w: 120 },
      { key: 'maxDays', label: 'أطول مدة', kind: 'num', w: 100 },
      { key: 'back', label: 'مرات الإرجاع', kind: 'num', w: 100 },
    ],
    filters: [
      { label: 'الموظف', kind: 'select', count: 23 },
      { label: 'القسم', kind: 'select', count: 51 },
      { label: 'من تاريخ', kind: 'date' },
      { label: 'إلى تاريخ', kind: 'date' },
    ],
    charts: [],
    finding: 'موظف واحد في المرة — مفيش مقارنة بين الـ23، والمقارنة هي السؤال.',
    pack: 'processes',
  },
  {
    key: 'perfDept',
    path: 'reports1_15',
    title: 'تقارير أداء الأقسام',
    icon: 'sort',
    question: 'الطلب بيقف فين وبيستنى قد إيه؟',
    what: 'فورم: قسم واحد × فترة، من 51 قسمًا إجرائيًّا.',
    rowsLive: null,
    cols: [
      { key: 'dept', label: 'القسم', kind: 'text', w: 220 },
      { key: 'inbox', label: 'وارد', kind: 'num', w: 90 },
      { key: 'done', label: 'مُنجَز', kind: 'num', w: 90 },
      { key: 'open', label: 'قائم', kind: 'num', w: 90 },
      { key: 'avgDays', label: 'متوسط المكوث بالأيام', kind: 'num', w: 125 },
      { key: 'maxDays', label: 'أطول مكوث', kind: 'num', w: 105 },
      { key: 'back', label: 'مرات الإرجاع', kind: 'num', w: 100 },
    ],
    filters: [
      { label: 'القسم', kind: 'select', count: 51 },
      { label: 'من تاريخ', kind: 'date' },
      { label: 'إلى تاريخ', kind: 'date' },
    ],
    charts: [],
    finding:
      'الـ51 قسمًا فيهم «ارجاع لقسم سابق» كأنه قسم — فمرات الإرجاع مخبّاية جوّه عدّاد قسم، ومحدش يقدر يقيسها لكل خطوة.',
    pack: 'processes',
  },
]

export const specByKey = (key: string): LiveSpec | undefined =>
  LIVE_SPECS.find((s) => s.key === key)

export const specByPath = (path: string): LiveSpec | undefined =>
  LIVE_SPECS.find((s) => s.path === path)

/** إجماليات الكتالوج — بتتحسب لا تتكتب */
export const catalogTotals = {
  screens: LIVE_SPECS.length,
  cols: LIVE_SPECS.reduce((n, s) => n + s.cols.length, 0),
  filters: LIVE_SPECS.reduce((n, s) => n + s.filters.length, 0),
  charts: LIVE_SPECS.reduce((n, s) => n + s.charts.length, 0),
  rows: LIVE_SPECS.reduce((n, s) => n + (s.rowsLive ?? 0), 0),
  broken: LIVE_SPECS.filter((s) => s.flaw).length,
  formOnly: LIVE_SPECS.filter((s) => s.rowsLive === null && !s.flaw).length,
}
