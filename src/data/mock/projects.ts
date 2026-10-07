/**
 * Sample projects · 30 rows shaped like the projects table in the system.
 *
 * Names are fictional, but the distribution is real: most projects are excused, a very small number
 * are actually in review, roughly a quarter have no owner, and time spent in a department varies
 * enough that some rows are far past the threshold — this is what the audit found across thousands
 * of projects, and it needs to be visible in the UI.
 */
import type { ProjectRow, ProjectType } from '@/types/domain'
import { stageMeta } from './taxonomy'
import { entityById } from './entities'
import { implementerName, portfolios } from './implementer'

type Seed = Pick<
  ProjectRow,
  'id' | 'name' | 'entityId' | 'track' | 'field' | 'goal' | 'region' | 'city' | 'stage'
> &
  Partial<ProjectRow>

const mk = (s: Seed): ProjectRow => {
  const meta = stageMeta(s.stage)
  const entity = entityById(s.entityId)
  const requested = s.amountRequested ?? 0
  return {
    entityName: entity?.name ?? 'غير محددة',
    statusGroup: meta?.group ?? 'في الدراسة',
    stageLimit: meta?.limit ?? 0,
    hoursInStage: 0,
    amountRequested: requested,
    amountGranted: 0,
    amountSpent: 0,
    weight: 50,
    score: 0,
    owner: null,
    year: '2026-f',
    funding: 'foundation',
    tags: [],
    grantMethod: 'بحث واستجابة',
    shared: false,
    impact: false,
    supportStatus: null,
    submittedAt: '2026-01-01',
    durationDays: 90,
    beneficiaries: 0,
    hasInterimReport: false,
    hasFinalReport: false,
    hasKnowledgeProduct: false,
    fieldVisit: false,
    type: 'مشروع عادي',
    ...s,
  }
}

export const projectRows: ProjectRow[] = [
  // In review: the real count is very small, which is exactly why this screen can work as cards
  // instead of a table
  mk({
    id: '20940',
    name: 'برنامج البناء العلمي للطلاب الموهوبين',
    entityId: '694',
    track: 'المنح النوعي',
    field: 'التعليم',
    goal: 'المحفظة التعليمية المتنوعة',
    region: 'الرياض',
    city: 'الرياض',
    stage: 'دراسة المشروع',
    hoursInStage: 2_088,
    amountRequested: 485_000,
    weight: 72,
    score: 68,
    owner: 'عمر قاسم',
    tags: ['تعليم نخب القطاع', 'القيم في التعليم'],
    submittedAt: '2026-06-12',
    durationDays: 180,
    beneficiaries: 320,
  }),
  mk({
    id: '20968',
    holder: 'manager',
    name: 'تأهيل 40 معلمًا لحلقات التحفيظ',
    entityId: '733',
    track: 'المنح النوعي',
    field: 'القرآن',
    goal: 'تطوير معلمي القرآن الكريم',
    region: 'المدينة المنورة',
    city: 'المدينة المنورة',
    stage: 'دراسة المشروع',
    hoursInStage: 612,
    amountRequested: 260_000,
    weight: 64,
    score: 71,
    owner: 'سعود البريكان',
    tags: [],
    submittedAt: '2026-07-28',
    durationDays: 120,
    beneficiaries: 40,
  }),
  mk({
    id: '20971',
    holder: 'exec',
    name: 'الأندية الصيفية القيمية، النسخة الرابعة',
    entityId: '781',
    track: 'المنح النوعي',
    field: 'القيم',
    goal: 'الأندية الصيفية القيمية',
    region: 'الرياض',
    city: 'الرياض',
    stage: 'دراسة المشروع',
    hoursInStage: 344,
    amountRequested: 720_000,
    weight: 81,
    score: 77,
    owner: 'عمر قاسم',
    grantMethod: 'ابتكار وإنضاج',
    impact: true,
    tags: ['القيم في التعليم'],
    submittedAt: '2026-08-14',
    durationDays: 90,
    beneficiaries: 1_200,
  }),
  mk({
    id: '20974',
    holder: 'committee',
    name: 'تجهيز مركز صحي للكشف المبكر ببيشة',
    entityId: '769',
    track: 'مسار تعميق الأثر',
    field: 'مجال الصحة',
    goal: 'تأسيس المراكز الصحية',
    region: 'عسير',
    city: 'بيشة',
    stage: 'دراسة المشروع',
    hoursInStage: 1_248,
    amountRequested: 1_350_000,
    weight: 58,
    score: 52,
    owner: null,
    submittedAt: '2026-06-30',
    durationDays: 240,
    beneficiaries: 5_400,
  }),
  mk({
    id: '20979',
    name: 'الدعم التشغيلي لجمعية البر بالأحساء',
    entityId: '755',
    track: 'المنح النوعي',
    field: 'التطوير',
    goal: 'الدعم التشغيلي للجمعيات المتميزة',
    region: 'المنطقة الشرقية',
    city: 'الأحساء',
    stage: 'استكمال بيانات المشروع',
    hoursInStage: 504,
    amountRequested: 900_000,
    weight: 69,
    score: 0,
    owner: 'عزام الخريف',
    submittedAt: '2026-07-05',
    durationDays: 365,
    beneficiaries: 0,
  }),
  mk({
    id: '20982',
    type: 'مشروع خارجي',
    name: 'كسوة الشتاء لأسر الأيتام بحائل',
    entityId: '803',
    track: 'المنح الانتشاري',
    field: 'الإغاثة',
    goal: 'كفالة الأيتام والأرامل',
    region: 'حائل',
    city: 'حائل',
    stage: 'دراسة المشروع',
    hoursInStage: 96,
    amountRequested: 180_000,
    weight: 45,
    score: 0,
    owner: null,
    tags: ['كفالات الأيتام والأرامل', 'رعاية الأيتام'],
    submittedAt: '2026-08-27',
    durationDays: 60,
    beneficiaries: 450,
  }),

  // In execution: approved projects moving through the agreement and disbursement stages
  mk({
    id: '20802',
    name: 'المنح الدراسية الجامعية، الدفعة الخامسة',
    entityId: '712',
    track: 'المنح النوعي',
    field: 'التعليم',
    goal: 'المنح الدراسية الجامعية',
    region: 'القصيم',
    city: 'بريدة',
    stage: 'اعتماد الإتفاقية',
    hoursInStage: 312,
    amountRequested: 1_600_000,
    amountGranted: 1_450_000,
    weight: 88,
    score: 84,
    owner: 'عمر قاسم',
    supportStatus: 'معتمد',
    impact: true,
    tags: ['طلاب المنح'],
    submittedAt: '2026-02-18',
    decidedAt: '2026-04-02',
    durationDays: 365,
    beneficiaries: 145,
  }),
  mk({
    id: '20817',
    name: 'عمارة وترميم ثمانية مساجد بعنيزة',
    entityId: '815',
    track: 'المنح الانتشاري',
    field: 'المساجد',
    goal: 'عمارة المساجد',
    region: 'القصيم',
    city: 'عنيزة',
    stage: 'المشرف إذن الصرف',
    hoursInStage: 336,
    amountRequested: 640_000,
    amountGranted: 520_000,
    weight: 62,
    score: 66,
    owner: 'حصة النملة',
    supportStatus: 'معتمد',
    funding: 'waqf',
    year: '2023-w',
    submittedAt: '2026-01-22',
    decidedAt: '2026-03-11',
    durationDays: 210,
    beneficiaries: 3_000,
  }),
  mk({
    id: '20824',
    name: 'روضات التبيان، التوسعة الثانية',
    entityId: '712',
    track: 'المنح النوعي',
    field: 'التعليم',
    goal: 'روضات التبيان',
    region: 'القصيم',
    city: 'الرس',
    stage: 'اصدار سند الصرف',
    hoursInStage: 168,
    amountRequested: 800_000,
    amountGranted: 750_000,
    amountSpent: 375_000,
    weight: 79,
    score: 80,
    owner: 'سعود البريكان',
    supportStatus: 'معتمد',
    tags: ['الطفولة المبكرة'],
    submittedAt: '2025-11-09',
    decidedAt: '2026-01-14',
    durationDays: 300,
    beneficiaries: 260,
  }),
  mk({
    id: '20831',
    type: 'مشروع خارجي',
    name: 'قرة الأعين، تجهيز مصليات النساء بجدة',
    entityId: '748',
    track: 'المنح الانتشاري',
    field: 'المساجد',
    goal: 'قرة الأعين',
    region: 'مكة المكرمة',
    city: 'جدة',
    stage: 'رفع سند القبض والقيد',
    hoursInStage: 240,
    amountRequested: 700_000,
    amountGranted: 640_000,
    amountSpent: 640_000,
    weight: 55,
    score: 61,
    owner: null,
    supportStatus: 'معتمد',
    funding: 'waqf',
    submittedAt: '2025-12-03',
    decidedAt: '2026-02-05',
    durationDays: 180,
    beneficiaries: 1_800,
  }),
  mk({
    id: '20838',
    name: 'البرامج الثقافية لضيوف الرحمن',
    entityId: '798',
    track: 'المنح الانتشاري',
    field: 'الدعوة',
    goal: 'البرامج الثقافية لضيوف المملكة',
    region: 'تبوك',
    city: 'تبوك',
    stage: 'رفع تقرير مرحلي',
    hoursInStage: 1_968,
    amountRequested: 300_000,
    amountGranted: 260_000,
    amountSpent: 130_000,
    weight: 48,
    score: 57,
    owner: 'عزام الخريف',
    supportStatus: 'معتمد',
    hasInterimReport: false,
    tags: ['الدعوة العامة'],
    submittedAt: '2025-09-17',
    decidedAt: '2025-11-20',
    durationDays: 270,
    beneficiaries: 2_100,
  }),
  mk({
    id: '20845',
    name: 'الاستدامة المالية لخمس جمعيات ناشئة',
    entityId: '781',
    track: 'المنح النوعي',
    field: 'التطوير',
    goal: 'الاستدامة المالية للجمعيات الأهلية',
    region: 'الرياض',
    city: 'الرياض',
    stage: 'طلب التقرير الختامي',
    hoursInStage: 600,
    amountRequested: 1_900_000,
    amountGranted: 1_800_000,
    amountSpent: 1_800_000,
    weight: 91,
    score: 86,
    owner: 'عمر قاسم',
    supportStatus: 'معتمد',
    grantMethod: 'ابتكار وإنضاج',
    impact: true,
    shared: true,
    hasInterimReport: true,
    fieldVisit: true,
    tags: ['تعليم نخب القطاع'],
    submittedAt: '2025-05-11',
    decidedAt: '2025-07-08',
    durationDays: 365,
    beneficiaries: 5,
  }),
  mk({
    id: '20852',
    name: 'علاج 60 من مرضى الكلى بالأحساء',
    entityId: '755',
    track: 'مسار تعميق الأثر',
    field: 'مجال الصحة',
    goal: 'علاج مرضى الكلى',
    region: 'المنطقة الشرقية',
    city: 'الأحساء',
    stage: 'رفع التقرير الختامي',
    hoursInStage: 2_640,
    amountRequested: 2_200_000,
    amountGranted: 2_050_000,
    amountSpent: 2_050_000,
    weight: 84,
    score: 79,
    owner: 'حصة النملة',
    supportStatus: 'معتمد',
    hasInterimReport: true,
    fieldVisit: true,
    submittedAt: '2025-03-02',
    decidedAt: '2025-04-27',
    durationDays: 365,
    beneficiaries: 60,
  }),
  mk({
    id: '20859',
    name: 'السلال الغذائية لأسر الباحة',
    entityId: '846',
    track: 'المنح الانتشاري',
    field: 'الإغاثة',
    goal: 'السلال الغذائية',
    region: 'الباحة',
    city: 'الباحة',
    stage: 'اعتماد التقرير الختامي',
    hoursInStage: 216,
    amountRequested: 420_000,
    amountGranted: 390_000,
    amountSpent: 390_000,
    weight: 41,
    score: 63,
    owner: 'سعود البريكان',
    supportStatus: 'معتمد',
    hasFinalReport: true,
    tags: ['السلال الغذائية'],
    submittedAt: '2025-08-19',
    decidedAt: '2025-10-01',
    durationDays: 120,
    beneficiaries: 900,
  }),
  mk({
    id: '20866',
    name: 'الدورات القرآنية الموسمية برمضان',
    entityId: '733',
    track: 'المنح النوعي',
    field: 'القرآن',
    goal: 'الدورات القرآنية الموسمية',
    region: 'المدينة المنورة',
    city: 'ينبع',
    stage: 'تقييم المشروع',
    hoursInStage: 408,
    amountRequested: 340_000,
    amountGranted: 300_000,
    amountSpent: 300_000,
    weight: 53,
    score: 74,
    owner: null,
    supportStatus: 'معتمد',
    hasFinalReport: true,
    hasKnowledgeProduct: true,
    tags: ['مبادرة الحج'],
    submittedAt: '2025-10-14',
    decidedAt: '2025-12-02',
    durationDays: 60,
    beneficiaries: 780,
  }),

  // Completed
  mk({
    id: '20611',
    name: 'تأسيس جمعية أهلية بالخرج',
    entityId: '781',
    track: 'المنح النوعي',
    field: 'التطوير',
    goal: 'تأسيس الجمعيات الأهلية',
    region: 'الرياض',
    city: 'الخرج',
    stage: 'مشروع مكتمل',
    amountRequested: 400_000,
    amountGranted: 400_000,
    amountSpent: 400_000,
    weight: 66,
    score: 88,
    owner: 'عمر قاسم',
    supportStatus: 'معتمد',
    year: '2025-f',
    hasFinalReport: true,
    hasKnowledgeProduct: true,
    fieldVisit: true,
    submittedAt: '2024-11-06',
    decidedAt: '2025-01-20',
    durationDays: 365,
    beneficiaries: 1,
  }),
  mk({
    id: '20624',
    name: 'المحفظة الشرعية المتنوعة، بريدة',
    entityId: '712',
    track: 'المنح النوعي',
    field: 'العلم الشرعي',
    goal: 'المحفظة الشرعية المتنوعة',
    region: 'القصيم',
    city: 'بريدة',
    stage: 'مشروع مكتمل',
    amountRequested: 520_000,
    amountGranted: 480_000,
    amountSpent: 468_000,
    weight: 59,
    score: 81,
    owner: 'عزام الخريف',
    supportStatus: 'معتمد',
    year: '2025-f',
    hasFinalReport: true,
    submittedAt: '2024-09-12',
    decidedAt: '2024-11-30',
    durationDays: 300,
    beneficiaries: 640,
  }),
  mk({
    id: '20637',
    type: 'مشروع خارجي',
    name: 'تهيئة سكن لعشر أسر متعففة بأبها',
    entityId: '769',
    track: 'المنح الانتشاري',
    field: 'الإغاثة',
    goal: 'تهيئة السكن للمحتاجين',
    region: 'عسير',
    city: 'أبها',
    stage: 'مشروع مكتمل',
    amountRequested: 460_000,
    amountGranted: 420_000,
    amountSpent: 420_000,
    weight: 47,
    score: 69,
    owner: null,
    supportStatus: 'معتمد',
    year: '2025-f',
    hasFinalReport: true,
    tags: ['بناء وترميم منازل'],
    submittedAt: '2024-12-01',
    decidedAt: '2025-02-16',
    durationDays: 240,
    beneficiaries: 52,
  }),
  mk({
    id: '20648',
    name: 'الدعوة الإلكترونية للجاليات',
    entityId: '798',
    track: 'المنح الانتشاري',
    field: 'الدعوة',
    goal: 'الدعوة الإلكترونية',
    region: 'عموم المملكة',
    city: 'عموم المملكة',
    stage: 'مشروع مكتمل',
    amountRequested: 700_000,
    amountGranted: 660_000,
    amountSpent: 651_000,
    weight: 71,
    score: 76,
    owner: 'حصة النملة',
    supportStatus: 'معتمد',
    year: '2025-f',
    shared: true,
    hasFinalReport: true,
    hasKnowledgeProduct: true,
    tags: ['الدعوة الإلكترونية', 'تعليم الجاليات'],
    submittedAt: '2024-10-22',
    decidedAt: '2024-12-19',
    durationDays: 365,
    beneficiaries: 24_000,
  }),

  // Stalled: few in number, high impact — must be visible immediately
  mk({
    id: '20705',
    name: 'مشروع الأسر المنتجة بصبيا',
    entityId: '774',
    track: 'المنح النوعي',
    field: 'التطوير',
    goal: 'احتضان الجمعيات',
    region: 'جيزان',
    city: 'صبيا',
    stage: 'مشروع متعثر',
    amountRequested: 300_000,
    amountGranted: 240_000,
    amountSpent: 240_000,
    weight: 38,
    score: 22,
    owner: 'عزام الخريف',
    supportStatus: 'معتمد',
    year: '2025-f',
    submittedAt: '2024-08-04',
    decidedAt: '2024-10-10',
    durationDays: 365,
    beneficiaries: 120,
  }),
  mk({
    id: '20719',
    name: 'كفالة أيتام بحائل، الدفعة الثانية',
    entityId: '803',
    track: 'المنح الانتشاري',
    field: 'الإغاثة',
    goal: 'كفالة الأيتام والأرامل',
    region: 'حائل',
    city: 'بقعاء',
    stage: 'مشروع متعثر',
    amountRequested: 350_000,
    amountGranted: 310_000,
    amountSpent: 88_000,
    weight: 44,
    score: 31,
    owner: null,
    supportStatus: 'معتمد',
    year: '2025-f',
    tags: ['كفالات الأيتام والأرامل'],
    submittedAt: '2024-07-15',
    decidedAt: '2024-09-25',
    durationDays: 365,
    beneficiaries: 210,
  }),

  // Excused: 75% of the system. What matters most here is the excusal **reason**
  mk({
    id: '20512',
    name: 'مشروع تعليمي متكرر لنفس الجهة',
    entityId: '694',
    track: 'المنح النوعي',
    field: 'التعليم',
    goal: 'دروس التقوية الإلكترونية',
    region: 'الرياض',
    city: 'الرياض',
    stage: 'مشروع معتذر عنه',
    amountRequested: 260_000,
    weight: 29,
    supportStatus: 'مرفوض',
    declineReason: 'مشروع مكرر لنفس الجهة',
    year: '2025-f',
    owner: 'عمر قاسم',
    submittedAt: '2025-04-08',
    decidedAt: '2025-05-19',
    durationDays: 120,
    beneficiaries: 180,
  }),
  mk({
    id: '20524',
    name: 'دورات حاسب للفتيات بنجران',
    entityId: '827',
    track: 'المنح النوعي',
    field: 'التعليم',
    goal: 'المحفظة التعليمية المتنوعة',
    region: 'نجران',
    city: 'نجران',
    stage: 'مشروع معتذر عنه',
    amountRequested: 190_000,
    weight: 21,
    supportStatus: 'مرفوض',
    declineReason: 'ضعف دراسة المشروع',
    year: '2025-f',
    owner: null,
    submittedAt: '2025-05-30',
    decidedAt: '2025-06-22',
    durationDays: 90,
    beneficiaries: 60,
  }),
  mk({
    id: '20533',
    name: 'مركز دراسات اجتماعية، دعم تشغيلي',
    entityId: '834',
    track: 'المنح النوعي',
    field: 'التطوير',
    goal: 'الدعم التشغيلي للجمعيات المتميزة',
    region: 'الرياض',
    city: 'الرياض',
    stage: 'مشروع معتذر عنه',
    amountRequested: 1_100_000,
    weight: 18,
    supportStatus: 'مرفوض',
    declineReason: 'مشروع ليس ضمن تخصص الجهة',
    year: '2025-f',
    owner: null,
    submittedAt: '2025-03-14',
    decidedAt: '2025-04-01',
    durationDays: 365,
    beneficiaries: 0,
  }),
  mk({
    id: '20541',
    type: 'مشروع خارجي',
    name: 'سلال غذائية إضافية بجازان',
    entityId: '774',
    track: 'المنح الانتشاري',
    field: 'الإغاثة',
    goal: 'السلال الغذائية',
    region: 'جيزان',
    city: 'أبو عريش',
    stage: 'مشروع معتذر عنه',
    amountRequested: 240_000,
    weight: 33,
    supportStatus: 'مرفوض',
    declineReason: 'الاكتفاء بالمشاريع المدعومة في المنطقة',
    year: '2025-f',
    owner: 'سعود البريكان',
    tags: ['السلال الغذائية'],
    submittedAt: '2025-06-11',
    decidedAt: '2025-07-03',
    durationDays: 60,
    beneficiaries: 400,
  }),
  mk({
    id: '20556',
    name: 'ترميم مسجد بالطائف',
    entityId: '748',
    track: 'المنح الانتشاري',
    field: 'المساجد',
    goal: 'عمارة المساجد',
    region: 'مكة المكرمة',
    city: 'الطائف',
    stage: 'مشروع معتذر عنه',
    amountRequested: 380_000,
    weight: 36,
    supportStatus: 'مرفوض',
    declineReason: 'نفاذ البند المخصص',
    year: '2025-f',
    owner: null,
    funding: 'waqf',
    submittedAt: '2025-09-02',
    decidedAt: '2025-10-14',
    durationDays: 150,
    beneficiaries: 700,
  }),
  mk({
    id: '20567',
    name: 'محو أمية لكبار السن بأحد رفيدة',
    entityId: '769',
    track: 'المنح النوعي',
    field: 'التعليم',
    goal: 'المحفظة التعليمية المتنوعة',
    region: 'عسير',
    city: 'أحد رفيدة',
    stage: 'مشروع معتذر عنه',
    amountRequested: 150_000,
    weight: 27,
    supportStatus: 'مرفوض',
    declineReason: 'الاكتفاء بدعم المشاريع الأخرى لنفس الجهة',
    year: '2025-f',
    owner: 'عزام الخريف',
    tags: ['محو الأمية'],
    submittedAt: '2025-02-19',
    decidedAt: '2025-03-27',
    durationDays: 180,
    beneficiaries: 90,
  }),
  mk({
    id: '20578',
    name: 'أجهزة كهربائية لأسر الأحساء',
    entityId: '755',
    track: 'المنح الانتشاري',
    field: 'الإغاثة',
    goal: 'الأجهزة الكهربائية',
    region: 'المنطقة الشرقية',
    city: 'الجبيل',
    stage: 'مشروع معتذر عنه',
    amountRequested: 420_000,
    weight: 40,
    supportStatus: 'مرفوض',
    declineReason: 'الاكتفاء بالمشاريع المدعومة في الهدف',
    year: '2025-f',
    owner: 'حصة النملة',
    tags: ['الأجهزة الكهربائية'],
    submittedAt: '2025-01-27',
    decidedAt: '2025-03-05',
    durationDays: 90,
    beneficiaries: 220,
  }),
  mk({
    id: '20589',
    name: 'رحلة تطويرية لجمعية شبابية',
    entityId: '803',
    track: 'المنح النوعي',
    field: 'القيم',
    goal: 'الرحلات التطويرية للجمعيات الشبابية',
    region: 'حائل',
    city: 'حائل',
    stage: 'مشروع ملغي',
    amountRequested: 120_000,
    weight: 24,
    supportStatus: 'مرفوض',
    declineReason: 'خطأ في تعبئة البيانات',
    year: '2025-f',
    owner: null,
    submittedAt: '2025-07-21',
    decidedAt: '2025-08-02',
    durationDays: 30,
    beneficiaries: 45,
  }),
  mk({
    id: '20595',
    name: 'محفظة صحية متنوعة، الدرب',
    entityId: '774',
    track: 'مسار تعميق الأثر',
    field: 'مجال الصحة',
    goal: 'المحفظة الصحية المتنوعة',
    region: 'جيزان',
    city: 'الدرب',
    stage: 'مشروع معتذر عنه',
    amountRequested: 660_000,
    weight: 19,
    supportStatus: 'مرفوض',
    declineReason: 'ضعف دراسة المشروع',
    year: '2024-f',
    owner: null,
    submittedAt: '2024-05-16',
    decidedAt: '2024-06-30',
    durationDays: 210,
    beneficiaries: 1_100,
  }),
]

/* ═══ Scenario projects (meeting 1 Oct, item A-6) ═══

   The sample above was written to show distributions; it left most procedure states with one
   record or none, so a workshop couldn't open "an agreement waiting for the executive director" or
   "an evaluation with the grants manager". These projects exist so every state of every procedure
   has about three records. Each one is a normal project; which procedure record hangs on it is
   decided in that procedure's own file (`SCENARIO` below says which ids each one draws from). */

type ScenarioSeed = [
  id: string, name: string, entityId: string, track: string, field: string, goal: string,
  stage: ProjectRow['stage'], amount: number, beneficiaries: number, owner: string,
]

const ENTITY_PLACE: Record<string, [string, string]> = {
  '694': ['الرياض', 'الرياض'], '712': ['القصيم', 'بريدة'], '733': ['المدينة المنورة', 'المدينة المنورة'],
  '748': ['مكة المكرمة', 'جدة'], '755': ['المنطقة الشرقية', 'الأحساء'], '769': ['عسير', 'أبها'],
  '781': ['الرياض', 'الرياض'], '798': ['تبوك', 'تبوك'], '803': ['حائل', 'حائل'],
  '815': ['القصيم', 'عنيزة'], '846': ['الباحة', 'الباحة'],
}

const SCENARIO_SEEDS: ScenarioSeed[] = [
  /* Agreements · waiting on an agreement step */
  ['21001', 'حلقات التحفيظ المسائية بعنيزة', '815', 'المنح النوعي', 'القرآن', 'تطوير معلمي القرآن الكريم', 'اعتماد الإتفاقية', 320_000, 240, 'عزام الخريف'],
  ['21002', 'تجهيز مختبرات العلوم لمدارس بريدة', '712', 'المنح النوعي', 'التعليم', 'المحفظة التعليمية المتنوعة', 'اعتماد الإتفاقية', 540_000, 900, 'عمر قاسم'],
  ['21003', 'كفالة 120 يتيمًا بأبها', '769', 'المنح الانتشاري', 'الإغاثة', 'كفالة الأيتام والأرامل', 'اعتماد الإتفاقية', 430_000, 120, 'سعود البريكان'],
  ['21004', 'ترميم جامع الحي الشرقي بجدة', '748', 'المنح النوعي', 'المساجد', 'عمارة المساجد', 'اعتماد الإتفاقية الكترونيًا', 780_000, 1_500, 'حصة النملة'],
  ['21005', 'برنامج القيم لطلاب المرحلة المتوسطة', '694', 'المنح النوعي', 'التعليم', 'القيم', 'اعتماد الإتفاقية الكترونيًا', 260_000, 600, 'عمر قاسم'],
  ['21006', 'السلال الرمضانية لأسر حائل', '803', 'المنح الانتشاري', 'الإغاثة', 'السلال الغذائية', 'الإتفاقيات الورقية', 190_000, 450, 'أحمد العبداللطيف'],
  ['21007', 'دورات الدعاة الجدد بتبوك', '798', 'المنح النوعي', 'الدعوة', 'الدعوة', 'اعتماد الإتفاقية', 210_000, 80, 'عزام الخريف'],
  ['21008', 'تشغيل عيادة الأسنان المتنقلة بالأحساء', '755', 'مسار تعميق الأثر', 'مجال الصحة', 'تأسيس المراكز الصحية', 'اعتماد الإتفاقية', 1_150_000, 2_000, 'حصة النملة'],
  ['21009', 'حوكمة خمس جمعيات ناشئة', '781', 'المنح النوعي', 'التطوير', 'الدعم التشغيلي للجمعيات المتميزة', 'الإتفاقيات الورقية', 380_000, 5, 'سعود البريكان'],

  /* Closing · report cycle */
  ['21010', 'برنامج الحفاظ للأطفال بالمدينة', '733', 'المنح النوعي', 'القرآن', 'روضات التبيان', 'طلب التقرير الختامي', 240_000, 300, 'عزام الخريف'],
  ['21011', 'إفطار صائم في قرى الباحة', '846', 'المنح الانتشاري', 'الإغاثة', 'السلال الغذائية', 'طلب التقرير الختامي', 160_000, 3_000, 'أحمد العبداللطيف'],
  ['21012', 'دروس التقوية في الرياضيات بالرياض', '694', 'المنح النوعي', 'التعليم', 'دروس التقوية الإلكترونية', 'رفع التقرير الختامي', 300_000, 700, 'عمر قاسم'],
  ['21013', 'صيانة مساجد الطرق بالقصيم', '815', 'المنح النوعي', 'المساجد', 'عمارة المساجد', 'رفع التقرير الختامي', 410_000, 2_200, 'حصة النملة'],
  ['21014', 'تأهيل 30 أسرة منتجة بالأحساء', '755', 'مسار تعميق الأثر', 'التطوير', 'تهيئة السكن للمحتاجين', 'رفع التقرير الختامي', 520_000, 30, 'حصة النملة'],
  ['21015', 'مسابقة حفظ القرآن الإقليمية', '733', 'المنح النوعي', 'القرآن', 'تطوير معلمي القرآن الكريم', 'اعتماد التقرير الختامي', 180_000, 500, 'عزام الخريف'],
  ['21016', 'المنح الدراسية لطلاب الهندسة', '712', 'المنح النوعي', 'التعليم', 'المنح الدراسية الجامعية', 'اعتماد التقرير الختامي', 860_000, 40, 'عمر قاسم'],
  ['21017', 'تأثيث سكن الأرامل بأبها', '769', 'المنح الانتشاري', 'الإغاثة', 'كفالة الأيتام والأرامل', 'اعتماد التقرير الختامي', 350_000, 45, 'سعود البريكان'],
  ['21018', 'حملة التوعية بالأمراض المزمنة', '755', 'مسار تعميق الأثر', 'مجال الصحة', 'علاج مرضى الكلى', 'اعتماد التقرير الختامي', 270_000, 4_000, 'حصة النملة'],
  ['21019', 'ترجمة الكتيبات الدعوية لست لغات', '798', 'المنح النوعي', 'الدعوة', 'الدعوة', 'اعتماد التقرير الختامي', 140_000, 12_000, 'عزام الخريف'],
  ['21020', 'نادي البرمجة للموهوبين', '694', 'المنح النوعي', 'التعليم', 'المحفظة التعليمية المتنوعة', 'اعتماد التقرير الختامي', 450_000, 160, 'عمر قاسم'],
  ['21021', 'كسوة الشتاء لأسر حائل', '803', 'المنح الانتشاري', 'الإغاثة', 'كفالة الأيتام والأرامل', 'اعتماد التقرير الختامي', 120_000, 800, 'أحمد العبداللطيف'],
  ['21022', 'دورات الإدارة المالية للجمعيات', '781', 'المنح النوعي', 'التطوير', 'الدعم التشغيلي للجمعيات المتميزة', 'اعتماد التقرير الختامي', 230_000, 12, 'سعود البريكان'],
  ['21023', 'تجهيز مصلى النساء بجدة', '748', 'المنح النوعي', 'المساجد', 'عمارة المساجد', 'اعتماد التقرير الختامي', 190_000, 600, 'حصة النملة'],
  ['21024', 'برنامج الإرشاد الأسري ببريدة', '712', 'المنح النوعي', 'القيم', 'قرة الأعين', 'اعتماد التقرير الختامي', 210_000, 350, 'عمر قاسم'],

  /* Closing · evaluation cycle */
  ['21025', 'معهد إعداد معلمات القرآن', '733', 'المنح النوعي', 'القرآن', 'تطوير معلمي القرآن الكريم', 'تقييم المشروع', 640_000, 90, 'عزام الخريف'],
  ['21026', 'مشروع الإسكان التنموي بعسير', '769', 'مسار تعميق الأثر', 'التطوير', 'تهيئة السكن للمحتاجين', 'تقييم المشروع', 1_400_000, 25, 'سعود البريكان'],
  ['21027', 'مراكز الرعاية النهارية لكبار السن', '755', 'مسار تعميق الأثر', 'مجال الصحة', 'تأسيس المراكز الصحية', 'تقييم المشروع', 900_000, 220, 'حصة النملة'],
  ['21028', 'المكتبة الرقمية للطلاب', '694', 'المنح النوعي', 'التعليم', 'دروس التقوية الإلكترونية', 'تقييم المشروع', 330_000, 5_000, 'عمر قاسم'],
  ['21029', 'سقيا الماء في قرى الباحة', '846', 'المنح الانتشاري', 'الإغاثة', 'السلال الغذائية', 'تقييم المشروع', 260_000, 6_000, 'أحمد العبداللطيف'],
  ['21030', 'تأسيس جمعية أهلية بالخرج', '781', 'المنح النوعي', 'التطوير', 'تأسيس الجمعيات الأهلية', 'تقييم المشروع', 250_000, 1, 'سعود البريكان'],
  ['21031', 'برنامج العلم الشرعي الصيفي', '798', 'المنح النوعي', 'الدعوة', 'العلم الشرعي', 'تقييم المشروع', 170_000, 300, 'عزام الخريف'],
  ['21032', 'ترميم ثلاثة مساجد تاريخية بعنيزة', '815', 'المنح النوعي', 'المساجد', 'عمارة المساجد', 'تقييم المشروع', 720_000, 1_800, 'حصة النملة'],
  ['21033', 'دعم الطلاب المتعثرين دراسيًا بحائل', '803', 'المنح النوعي', 'التعليم', 'المحفظة التعليمية المتنوعة', 'تقييم المشروع', 200_000, 400, 'أحمد العبداللطيف'],
  ['21034', 'حاضنة المشاريع الأسرية بجدة', '748', 'المنح النوعي', 'التطوير', 'الدعم التشغيلي للجمعيات المتميزة', 'مشروع مكتمل', 480_000, 60, 'حصة النملة'],
  ['21035', 'برنامج الطفولة المبكرة ببريدة', '712', 'المنح النوعي', 'التعليم', 'روضات التبيان', 'مشروع مكتمل', 310_000, 260, 'عمر قاسم'],
  ['21036', 'كفالة طلاب العلم الوافدين', '798', 'المنح النوعي', 'الدعوة', 'العلم الشرعي', 'مشروع مكتمل', 150_000, 70, 'عزام الخريف'],
]

const scenarioRow = (
  [id, name, entityId, track, field, goal, stage, amount, beneficiaries, owner]: ScenarioSeed,
  i: number,
): ProjectRow => {
  const [region, city] = ENTITY_PLACE[entityId] ?? ['الرياض', 'الرياض']
  const done = stage === 'مشروع مكتمل'
  const late = i % 4 === 1
  const granted = Math.round((amount * (0.9 + (i % 3) * 0.05)) / 1000) * 1000
  const runs = !stage.includes('الإتفاقي')
  return mk({
    id, name, entityId, track, field, goal, region, city, stage, owner, beneficiaries,
    amountRequested: amount,
    amountGranted: granted,
    amountSpent: done ? granted : runs ? Math.round(granted * (0.55 + (i % 4) * 0.1)) : 0,
    hoursInStage: done ? 0 : late ? 900 + i * 13 : 48 + i * 11,
    weight: 60 + (i * 7) % 35,
    score: 55 + (i * 5) % 40,
    supportStatus: 'معتمد',
    hasInterimReport: runs,
    hasFinalReport: stage.includes('التقرير الختامي') && stage !== 'طلب التقرير الختامي' || stage === 'تقييم المشروع' || done,
    fieldVisit: i % 3 === 0,
    submittedAt: `2025-${String(1 + (i % 12)).padStart(2, '0')}-${String(3 + (i % 24)).padStart(2, '0')}`,
    decidedAt: `2025-${String(1 + ((i + 1) % 12)).padStart(2, '0')}-${String(5 + (i % 20)).padStart(2, '0')}`,
    durationDays: 180 + (i % 4) * 60,
  })
}

projectRows.push(...SCENARIO_SEEDS.map(scenarioRow))

/* Under study, one seat each · B-5: a project waiting at every decision-maker, with an amount that
   actually routes there (the committee only sees what's above the executive's cap). */
const STUDY: [string, string, string, string, string, string, number, NonNullable<ProjectRow['holder']>, string, number][] = [
  ['21037', 'تأهيل مشرفات الحلقات النسائية', '733', 'المنح النوعي', 'القرآن', 'تطوير معلمي القرآن الكريم', 140_000, 'supervisor', 'عزام الخريف', 260],
  ['21038', 'إسكان عشر أسر محتاجة بحائل', '803', 'المنح الانتشاري', 'التطوير', 'تهيئة السكن للمحتاجين', 230_000, 'manager', 'أحمد العبداللطيف', 10],
  ['21039', 'برنامج الإرشاد الطلابي في القصيم', '712', 'المنح النوعي', 'التعليم', 'المحفظة التعليمية المتنوعة', 340_000, 'manager', 'عمر قاسم', 1_200],
  ['21040', 'مركز غسيل الكلى الخيري بالأحساء', '755', 'مسار تعميق الأثر', 'مجال الصحة', 'علاج مرضى الكلى', 460_000, 'exec', 'حصة النملة', 90],
  ['21041', 'ترميم مسجدين في جدة التاريخية', '748', 'المنح النوعي', 'المساجد', 'عمارة المساجد', 880_000, 'exec', 'حصة النملة', 2_400],
  ['21042', 'برنامج تمكين الجمعيات الناشئة 2027', '781', 'المنح النوعي', 'التطوير', 'الدعم التشغيلي للجمعيات المتميزة', 760_000, 'committee', 'سعود البريكان', 20],
  ['21043', 'وقف تعليمي لطلاب المنح الجامعية', '694', 'المنح النوعي', 'التعليم', 'المنح الدراسية الجامعية', 940_000, 'committee', 'عمر قاسم', 60],
  /* Within the executive director's cap, entity active · the case he approves himself */
  ['21046', 'تأهيل معلمات التقوية الإلكترونية بالقصيم', '712', 'المنح النوعي', 'التعليم', 'دروس التقوية الإلكترونية', 380_000, 'exec', 'عمر قاسم', 150],
]
projectRows.push(...STUDY.map(([id, name, entityId, track, field, goal, amount, holder, owner, beneficiaries], i) => {
  const [region, city] = ENTITY_PLACE[entityId] ?? ['الرياض', 'الرياض']
  return mk({
    id, name, entityId, track, field, goal, region, city, holder, owner, beneficiaries,
    stage: 'دراسة المشروع',
    amountRequested: amount,
    hoursInStage: i % 3 === 1 ? 1_100 + i * 40 : 120 + i * 60,
    weight: 62 + i * 4,
    score: 60 + i * 5,
    submittedAt: `2026-0${7 + (i % 3)}-${String(4 + i * 3).padStart(2, '0')}`,
    durationDays: 180 + (i % 3) * 90,
  })
}))

/* Returned to the entity for completion · three in that state, like every other (A-6) */
projectRows.push(
  mk({
    id: '21044', name: 'حقيبة المعلم الرقمية', entityId: '694', track: 'المنح النوعي', field: 'التعليم',
    goal: 'دروس التقوية الإلكترونية', region: 'الرياض', city: 'الرياض', stage: 'استكمال بيانات المشروع',
    amountRequested: 210_000, hoursInStage: 260, owner: 'عمر قاسم', submittedAt: '2026-08-20', beneficiaries: 400,
  }),
  mk({
    id: '21045', name: 'صيانة دورات المياه في مساجد عنيزة', entityId: '815', track: 'المنح الانتشاري', field: 'المساجد',
    goal: 'عمارة المساجد', region: 'القصيم', city: 'عنيزة', stage: 'استكمال بيانات المشروع',
    amountRequested: 150_000, hoursInStage: 900, owner: 'حصة النملة', submittedAt: '2026-08-02', beneficiaries: 1_200,
  }),
)

/* Approved, hold final, no agreement yet · the supervisor's next agreement (8.2.1 – 8.2.3) ·
   kept out of the agreements fixture */
export const AWAITING_AGREEMENT = new Set(['21047', '21048'])
projectRows.push(
  mk({
    id: '21047', name: 'برنامج القراءة الصيفي لطلاب المرحلة الابتدائية', entityId: '694', track: 'المنح النوعي', field: 'التعليم',
    goal: 'دروس التقوية الإلكترونية', region: 'الرياض', city: 'الرياض', stage: 'اعتماد الإتفاقية',
    amountRequested: 260_000, amountGranted: 260_000, supportStatus: 'معتمد', decidedAt: '2026-09-28', hoursInStage: 96, owner: 'عمر قاسم',
    submittedAt: '2026-07-14', beneficiaries: 600, durationDays: 240, startAt: '2026-11-01', endAt: '2027-06-30',
  }),
  mk({
    id: '21048', name: 'ترميم مصلى النساء بجامع الحي', entityId: '815', track: 'المنح الانتشاري', field: 'المساجد',
    goal: 'عمارة المساجد', region: 'القصيم', city: 'عنيزة', stage: 'اعتماد الإتفاقية',
    amountRequested: 140_000, amountGranted: 140_000, supportStatus: 'معتمد', decidedAt: '2026-09-25', hoursInStage: 140, owner: 'عمر قاسم',
    submittedAt: '2026-07-02', beneficiaries: 350, durationDays: 120, startAt: '2026-11-15', endAt: '2027-03-15',
  }),
)

/* Supported through Ehsan (BPD-011) · the strategic partner's projects of their own, not a
   portfolio: one running (plan and schedule, no agreement · 11.2.16 · 11.2.17), one under study,
   where the routing decision is still the supervisor's (11.2.4 · 11.2.5) · kept out of the
   agreements and disbursements fixtures, which assume an entity on the portal */
export const VIA_EHSAN = new Set(['21060', '21061'])
projectRows.push(
  mk({
    id: '21060', name: 'ترميم منازل الأسر المتعففة في جيزان', entityId: '860', track: 'المنح الانتشاري', field: 'الإغاثة',
    goal: 'تهيئة السكن للمحتاجين', region: 'جيزان', city: 'جيزان', stage: 'رفع تقرير مرحلي',
    amountRequested: 1_200_000, amountGranted: 1_200_000, amountSpent: 400_000, supportStatus: 'معتمد', decidedAt: '2026-05-10', hoursInStage: 120,
    owner: 'عمر قاسم', submittedAt: '2026-03-18', beneficiaries: 90, durationDays: 300, startAt: '2026-06-01', endAt: '2027-03-31',
    platform: 'منصة إحسان', partnerType: 'مستقل',
  }),
  mk({
    id: '21061', name: 'سقيا المساجد في القرى النائية عبر منصة إحسان', entityId: '860', track: 'المنح الانتشاري', field: 'المساجد',
    goal: 'عمارة المساجد', region: 'عسير', city: 'أبها', stage: 'دراسة المشروع',
    amountRequested: 750_000, hoursInStage: 60, owner: 'عمر قاسم', submittedAt: '2026-09-14', beneficiaries: 5_000,
    platform: 'منصة إحسان', partnerType: 'مستقل',
  }),
)

/** Which scenario projects each procedure draws its extra records from */
export const SCENARIO = {
  agreements: SCENARIO_SEEDS.slice(0, 9).map((s) => s[0]),
  closing: SCENARIO_SEEDS.slice(9).map((s) => s[0]),
  /** Plans hang on running projects · the report-cycle ones are running */
  plans: SCENARIO_SEEDS.slice(9, 24).map((s) => s[0]),
  payments: SCENARIO_SEEDS.slice(11, 24).map((s) => s[0]),
}


/**
 * Bulk assignment · the only action that mutates data in this mock.
 * Exists so the "1,253 unowned projects" scenario can actually be tested, not just imagined; once
 * the backend is ready this becomes `PATCH /projects/bulk { ids, owner }`.
 */
export const assignOwner = (ids: readonly string[], owner: string): void => {
  for (const p of projectRows) if (ids.includes(p.id)) p.owner = owner
}

/* Bulk decisions.

   A decision on a single project happens on its page, with its full context. A bulk decision serves
   a different purpose: an officer facing twenty projects all in the same state (excused for the
   same reason, say) shouldn't have to open twenty pages to record the same decision — that's manual
   copy-paste.

   So the decisions available here are fewer than on the project page: anything needing a
   per-project target (transferring to a specific officer, returning to a level) isn't offered,
   because choosing it in bulk would just be guessing. Assigning an owner has its own separate field
   next to this. */

export type BulkDecision = 'approve' | 'complete' | 'decline' | 'escalate'

/** A snapshot before the decision, so "undo" is a real reversal, not a second, opposing decision */
interface Snapshot {
  id: string
  stage: ProjectRow['stage']
  statusGroup: ProjectRow['statusGroup']
  stageLimit: number
  supportStatus: ProjectRow['supportStatus']
  amountGranted: number
}

const snap = (p: ProjectRow): Snapshot => ({
  id: p.id,
  stage: p.stage,
  statusGroup: p.statusGroup,
  stageLimit: p.stageLimit,
  supportStatus: p.supportStatus,
  amountGranted: p.amountGranted,
})

const moveTo = (p: ProjectRow, stage: string) => {
  const meta = stageMeta(stage)
  p.stage = stage
  p.statusGroup = meta?.group ?? p.statusGroup
  p.stageLimit = meta?.limit ?? 0
  /* Time-in-department resets with the new department, otherwise the project would look overdue in
     a department it just entered */
  p.hoursInStage = 0
}

/** Executes the decision and returns an undo function */
export const applyDecision = (ids: readonly string[], d: BulkDecision): (() => void) => {
  const targets = projectRows.filter((p) => ids.includes(p.id))
  const before = targets.map(snap)

  for (const p of targets) {
    if (d === 'approve') {
      p.supportStatus = 'معتمد'
      if (p.amountGranted === 0) p.amountGranted = p.amountRequested
      moveTo(p, 'اعتماد الإتفاقية')
    } else if (d === 'complete') {
      moveTo(p, 'استكمال بيانات المشروع')
    } else if (d === 'decline') {
      p.supportStatus = 'مرفوض'
      p.amountGranted = 0
      moveTo(p, 'مشروع معتذر عنه')
    } else {
      /* Escalating to a higher level doesn't change the project's outcome, only its position within
         review */
      moveTo(p, 'دراسة المشروع')
    }
  }

  return () => {
    for (const b of before) {
      const p = projectRows.find((x) => x.id === b.id)
      if (p) Object.assign(p, b)
    }
  }
}

export const projectById = (id: string): ProjectRow | undefined =>
  projectRows.find((p) => p.id === id)

export const projectsOfEntity = (entityId: string): ProjectRow[] =>
  projectRows.filter((p) => p.entityId === entityId)

/** Project types · list filter order. */
export const PROJECT_TYPES: readonly ProjectType[] = ['مشروع عادي', 'مشروع خارجي', 'محفظة']

/**
 * Portfolio rows · shown in the projects list only (opt-in via `ProjectQuery.portfolios`), so
 * budgets, KPIs and reports keep counting projects alone. Each row opens its portfolio page.
 */
export const portfolioRows: ProjectRow[] = portfolios.map((p) => {
  const spent = p.items.reduce((a, x) => a + x.spent, 0)
  return mk({
    id: p.id,
    name: p.name,
    entityId: p.entityId,
    track: 'الشريك المنفّذ',
    field: 'محفظة',
    goal: `${p.items.length} مشاريع تحت المحفظة`,
    region: p.region ?? 'عموم المملكة',
    city: p.region ?? 'عموم المملكة',
    stage: 'تنفيذ المحفظة',
    statusGroup: 'في التشغيل',
    stageLimit: 0,
    entityName: implementerName(p.entityId),
    amountRequested: p.total,
    amountGranted: p.total,
    amountSpent: spent,
    owner: p.owner ?? 'عمر قاسم',
    year: `${p.year}-f`,
    submittedAt: p.openedAt,
    grantMethod: 'بحث واستجابة',
    weight: 0,
    type: 'محفظة',
    portfolioId: p.id,
  })
})
