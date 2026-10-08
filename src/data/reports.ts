/**
 * Map of the reports module.
 *
 * Two sources:
 *
 * 1. The planning document defines five bundles: procedure indicators (66 indicators across 11
 * procedures), budget and disbursement reports, impact report (beneficiaries, regions, areas),
 * board reports, and a report builder/export. It also states who views each: grants manager,
 * executive, committee/board, finance.
 *
 * 2. The live system: 13 actual report screens, each a separate filter form. Three of them come up
 * empty or return filters with no result.
 *
 * The table below links the two: every live-system report has a place here, so when this is shown
 * to the client they see nothing was dropped, only consolidated. The critique that came out of the
 * review was: performance data exists but doesn't surface at decision time, scattered across
 * separate reports. The fix isn't a fourteenth report — it's making the report an entry point to
 * the underlying rows being decided on, so every number here links to a list.
 */
import { ROUTES } from '@/app/routes'
import type { IconName } from '@/components/ui'

/** Bundle status in the mock */
export type PackState = 'ready' | 'next'

export interface ReportPack {
  key: string
  title: string
  /** The line stating what the report answers */
  answers: string
  icon: IconName
  /** Who reads it · from the planning document */
  readers: string[]
  state: PackState
  /** What's inside the bundle once built */
  contains: string[]
  to?: string
}

export const PACKS: ReportPack[] = [
  {
    key: 'processes',
    title: 'مؤشرات الإجراءات',
    answers: 'كيف يسير الإجراء: مدة كل مستوى، والإعادات، والقرارات ضمن الصلاحية.',
    icon: 'chart',
    readers: ['مدير المنح', 'المدير التنفيذي'],
    state: 'ready',
    contains: ['11 إجراءً', '66 مؤشرًا بصيغتها', 'كل رقم يقود إلى صفوفه'],
    to: ROUTES.reports,
  },
  {
    key: 'money',
    title: 'الميزانية والصرف',
    answers: 'أين ذهب المال: المخصص والمحجوز والملتزم به والمصروف والمتبقي، لكل بند ومصدر.',
    icon: 'budget',
    readers: ['الإدارة المالية', 'المدير التنفيذي'],
    state: 'next',
    contains: ['البنود الخمس القيم', 'مصادر التمويل', 'جدول الدفعات والالتزام به'],
  },
  {
    key: 'impact',
    title: 'الأثر',
    answers: 'لمن وصلت المنح وأين: المستفيدون والمناطق والمجالات، وتكلفة المستفيد.',
    icon: 'pinMap',
    readers: ['المدير التنفيذي', 'اللجنة والمجلس'],
    state: 'ready',
    contains: ['المستفيدون: تقدير الجهة مقابل المُتحقّق', 'الخريطة بالمناطق', 'المسار والمجال والهدف'],
    to: ROUTES.reportTab('impact'),
  },
  {
    key: 'partners',
    title: 'الشركاء',
    answers: 'سجل كل جهة: كم اعتُمد لها، وكم وصل، وكم تعثّر، وحالة ملفها.',
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
    contains: ['ما يتجاوز حد صلاحية المدير التنفيذي', 'ملخص المحفظة والأثر', 'تصدير جاهز للعرض'],
  },
  {
    key: 'builder',
    title: 'منشئ التقارير',
    answers: 'تقرير يبدأ بسؤال لا بجدول: اختر السؤال والفترة، وتُحدَّد الأعمدة تلقائيًا.',
    icon: 'filter',
    readers: ['كل الأدوار'],
    state: 'next',
    contains: ['بناء بالسؤال', 'حفظ التقرير ومشاركته', 'تصدير Excel وPDF'],
  },
]

/** A live-system report, and where it fits here */
export interface LiveReport {
  /**
   * Screen path in the live system · without the `/control` prefix.
   * The full path is `sys.abanumay.sa/control/<path>`; that shared portion is common to all 13, so
   * it's written once in `LIVE_BASE` below.
   */
  path: string
  title: string
  /** Audit note · empty, or filters with no result */
  flaw?: string
  /** Which bundle this falls under */
  pack: string
}

/**
 * The 13 reports as they exist in the live system.
 * These notes come from the review, not estimation: the three flagged ones were opened and came up
 * empty or as a filter form with no result.
 */
export const LIVE_REPORTS: LiveReport[] = [
  { path: 'reports1_1', title: 'تقارير الميزانية', pack: 'money' },
  { path: 'reports1_2', title: 'تقارير الشركاء', pack: 'partners' },
  { path: 'reports1_3', title: 'تقارير المشاريع', pack: 'impact' },
  { path: 'reports1_5', title: 'مخصص الصرف', pack: 'money' },
  { path: 'reports1_6', title: 'تقرير الدفعات', pack: 'money' },
  { path: 'reports1_7', title: 'تقرير المجلات', flaw: 'فلاتر بلا نتيجة', pack: 'impact' },
  { path: 'reports1_8', title: 'تقرير العمليات', flaw: 'الشاشة فارغة', pack: 'processes' },
  { path: 'reports1_9', title: 'تقرير الموظفين', flaw: 'الشاشة فارغة', pack: 'processes' },
  { path: 'reports1_11', title: 'التقرير المرحلي', pack: 'partners' },
  { path: 'reports1_12', title: 'التقارير الختامية', pack: 'impact' },
  { path: 'reports1_13', title: 'تقرير المعرفة', pack: 'impact' },
  { path: 'reports1_14', title: 'أداء الموظفين', pack: 'processes' },
  { path: 'reports1_15', title: 'أداء الأقسام', pack: 'processes' },
]

/** The shared prefix for all live-system paths */
export const LIVE_BASE = '/control/'

export const packByKey = (key: string): ReportPack | undefined => PACKS.find((p) => p.key === key)

export const liveIn = (pack: string): LiveReport[] => LIVE_REPORTS.filter((r) => r.pack === pack)
