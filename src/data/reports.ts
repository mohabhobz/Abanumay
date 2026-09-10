/**
 * خريطة موديول التقارير.
 *
 * مصدرها اتنين:
 *
 *  1. الفيججام — قسم «S11 التقارير والمؤشرات» بيحدّد خمس حزم:
 *     مؤشرات الإجراءات (66 مؤشرًا على 11 إجراءً) · تقارير الميزانية
 *     والصرف · تقرير الأثر (مستفيدون · مناطق · مجالات) · تقارير
 *     مجلس الأمناء · منشئ التقارير والتصدير. وبيقول مين يشوفه:
 *     مدير المنح · التنفيذي · اللجنة والمجلس · الإدارة المالية.
 *
 *  2. النظام العامل — 13 شاشة تقرير فعلية، كل واحدة فورم فلترة
 *     منفصل. تلاتة منها فاضية أو فلاتر بلا نتيجة.
 *
 * والجدول اللي تحت بيربط الاتنين: كل تقرير في النظام العامل ليه
 * مكان هنا، عشان لما نعرض على العميل يشوف إن مفيش حاجة اتشالت —
 * اتلمّت. النقد اللي طلع من الأوديت كان: «داتا الأداء موجودة ولا
 * تظهر عند القرار — تقارير منفصلة». الحل مش تقرير رقم 14، الحل إن
 * التقرير يبقى مدخل للصفوف اللي بتتقرّر، فكل رقم هنا بيوصّل لقائمة.
 */
import { ROUTES } from '@/app/routes'
import type { IconName } from '@/components/ui'

/** حالة الحزمة في النموذج */
export type PackState = 'ready' | 'next'

export interface ReportPack {
  key: string
  title: string
  /** السطر اللي بيقول التقرير بيجاوب على إيه */
  answers: string
  icon: IconName
  /** مين بيقراه — من الفيججام */
  readers: string[]
  state: PackState
  /** اللي جوّه الحزمة لمّا تتبني */
  contains: string[]
  to?: string
}

export const PACKS: ReportPack[] = [
  {
    key: 'processes',
    title: 'مؤشرات الإجراءات',
    answers: 'الإجراء ماشي إزاي — مدد كل مستوى، والإعادات، والقرارات ضمن الصلاحية.',
    icon: 'chart',
    readers: ['مدير المنح', 'المدير التنفيذي'],
    state: 'ready',
    contains: ['11 إجراءً', '66 مؤشرًا بصيغتها', 'كل رقم يوصّل لصفوفه'],
    to: ROUTES.reports,
  },
  {
    key: 'money',
    title: 'الميزانية والصرف',
    answers: 'الفلوس راحت فين — مخصص ومحجوز وملتزم به ومصروف ومتبقٍ، لكل بند ومصدر.',
    icon: 'budget',
    readers: ['الإدارة المالية', 'المدير التنفيذي'],
    state: 'next',
    contains: ['البنود الخمس القيم', 'مصادر التمويل', 'جدول الدفعات والالتزام به'],
  },
  {
    key: 'impact',
    title: 'الأثر',
    answers: 'المنح وصلت لمين وفين — مستفيدون ومناطق ومجالات، وتكلفة المستفيد.',
    icon: 'pinMap',
    readers: ['المدير التنفيذي', 'اللجنة والمجلس'],
    state: 'next',
    contains: ['المستفيدون: تقدير الجهة مقابل المُتحقّق', 'الخريطة بالمناطق', 'المسار والمجال والهدف'],
  },
  {
    key: 'partners',
    title: 'الشركاء',
    answers: 'سجل كل جهة: كم أُعتمد لها، وكم وصل، وكم تعثّر، وحالة ملفها.',
    icon: 'entity',
    readers: ['مدير المنح', 'مشرف المنح'],
    state: 'next',
    contains: ['16 عمودًا كما في النظام العامل', 'الحوكمة واكتمال الملف', 'المشاريع المتعثّرة لكل جهة'],
  },
  {
    key: 'board',
    title: 'حزمة مجلس الأمناء',
    answers: 'ملف اجتماع واحد جاهز: ما اعتُمد، وما ينتظر المجلس، والأثر بالأرقام.',
    icon: 'doc',
    readers: ['اللجنة التنفيذية', 'مجلس الأمناء'],
    state: 'next',
    contains: ['ما يقع فوق سقف التنفيذي', 'ملخص المحفظة والأثر', 'تصدير جاهز للعرض'],
  },
  {
    key: 'builder',
    title: 'منشئ التقارير',
    answers: 'تقرير بسؤال لا بجدول: اختر السؤال والفترة، والأعمدة تتحدّد لوحدها.',
    icon: 'filter',
    readers: ['كل الأدوار'],
    state: 'next',
    contains: ['بناء بالسؤال', 'حفظ التقرير ومشاركته', 'تصدير Excel وPDF'],
  },
]

/** تقرير في النظام العامل، ومكانه هنا */
export interface LiveReport {
  /**
   * مسار الشاشة في النظام العامل — بلا بادئة `/control`.
   * المسار الكامل `sys.abanumay.sa/control/<path>`؛ الجزء ده مشترك
   * في الـ13 كلهم فمكتوب مرة واحدة في `LIVE_BASE` تحت.
   */
  path: string
  title: string
  /** ملاحظة الأوديت — فاضي أو فلاتر بلا نتيجة */
  flaw?: string
  /** الحزمة اللي بيقع فيها هنا */
  pack: string
}

/**
 * الـ13 تقريرًا كما هي في `sys.abanumay.sa`.
 * الملاحظات دي من الأوديت، مش تقدير: التلاتة المعلّمة اتفتحت وطلعت
 * فاضية أو فورم فلترة من غير نتيجة.
 */
export const LIVE_REPORTS: LiveReport[] = [
  { path: 'reports1_1', title: 'تقارير الميزانية', pack: 'money' },
  { path: 'reports1_2', title: 'تقارير الشركاء', pack: 'partners' },
  { path: 'reports1_3', title: 'تقارير المشاريع', pack: 'impact' },
  { path: 'reports1_5', title: 'مخصص الصرف', pack: 'money' },
  { path: 'reports1_6', title: 'تقرير الدفعات', pack: 'money' },
  { path: 'reports1_7', title: 'تقرير المجلات', flaw: 'فلاتر بلا نتيجة', pack: 'impact' },
  { path: 'reports1_8', title: 'تقرير العمليات', flaw: 'الشاشة فاضية', pack: 'processes' },
  { path: 'reports1_9', title: 'تقرير الموظفين', flaw: 'الشاشة فاضية', pack: 'processes' },
  { path: 'reports1_11', title: 'التقرير المرحلي', pack: 'partners' },
  { path: 'reports1_12', title: 'التقارير الختامية', pack: 'impact' },
  { path: 'reports1_13', title: 'تقرير المعرفة', pack: 'impact' },
  { path: 'reports1_14', title: 'أداء الموظفين', pack: 'processes' },
  { path: 'reports1_15', title: 'أداء الأقسام', pack: 'processes' },
]

/** البادئة المشتركة لكل مسارات النظام العامل */
export const LIVE_BASE = '/control/'

export const packByKey = (key: string): ReportPack | undefined => PACKS.find((p) => p.key === key)

export const liveIn = (pack: string): LiveReport[] => LIVE_REPORTS.filter((r) => r.pack === pack)
