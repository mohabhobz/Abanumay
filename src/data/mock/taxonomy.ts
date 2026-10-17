/**
 * Reference vocabulary · carried over verbatim from the live system.
 *
 * These aren't invented values: any track, area, goal, or tag name here actually exists in the
 * system, so the filters built on them match what the client sees.
 */
import { CFG, readJson } from '@/lib/config'
import { workDayLimit } from '@/lib/sla'

/** Years = two separately funded entities, each with its own budget and processes */
export const YEARS = [
  { id: '2026-f', label: '2026 · المؤسسة', budget: 73_700_000 },
  { id: '2025-f', label: '2025 · المؤسسة', budget: 55_800_000 },
  { id: '2024-f', label: '2024 · المؤسسة', budget: 47_200_000 },
  { id: '2023-f', label: '2023 · المؤسسة', budget: 1_000_000 },
  { id: '2023-w', label: '2023 · الوقف', budget: 2_849_573 },
] as const

export const TRACKS = [
  'المنح النوعي',
  'المنح الانتشاري',
  'مسار تعميق الأثر',
  'مسار التأثير',
  'مسار التنوع',
] as const

/** Area depends on track · a cascading filter matching the system */
export const FIELDS_BY_TRACK: Record<string, string[]> = {
  'المنح النوعي': ['التعليم', 'التطوير', 'القرآن', 'العلم الشرعي', 'القيم', 'الصحة'],
  'المنح الانتشاري': [
    'الإغاثة', 'الدعوة', 'المساجد', 'الحج ورمضان',
    'المصارف المقيدة والخاصة', 'المشاريع الخارجية',
  ],
  'مسار تعميق الأثر': ['مجال الصحة', 'مجال تطوير القطاع غير الربحي'],
  'مسار التأثير': ['مجال القيم والشخصية السعودية', 'مجال المساهمات العامة'],
  'مسار التنوع': ['مجال المساهمة في المنصات الوطنية'],
}

export const GOALS_BY_FIELD: Record<string, string[]> = {
  التعليم: ['المنح الدراسية الجامعية', 'دروس التقوية الإلكترونية', 'روضات التبيان', 'المحفظة التعليمية المتنوعة'],
  التطوير: ['الاستدامة المالية للجمعيات الأهلية', 'الدعم التشغيلي للجمعيات المتميزة', 'تأسيس الجمعيات الأهلية', 'احتضان الجمعيات'],
  القرآن: ['الدورات القرآنية الموسمية', 'تطوير معلمي القرآن الكريم', 'تعليم القرآن للأشبال', 'المحفظة القرآنية المتنوعة'],
  'العلم الشرعي': ['البناء العلمي الشرعي', 'المحفظة الشرعية المتنوعة'],
  القيم: ['الأندية الصيفية القيمية', 'الرحلات التطويرية للجمعيات الشبابية', 'المبادرات القيمية في البيئات التعليمية', 'المحفظة القيمية المتنوعة'],
  الصحة: ['علاج مرضى الكلى', 'تأسيس المراكز الصحية', 'علاج مرضى السرطان', 'المحفظة الصحية المتنوعة'],
  الإغاثة: ['السلال الغذائية', 'الأجهزة الكهربائية', 'كفالة الأيتام والأرامل', 'تهيئة السكن للمحتاجين', 'المحفظة الإغاثية المتنوعة'],
  الدعوة: ['الدعوة الإلكترونية', 'البرامج الثقافية لضيوف المملكة', 'المحفظة الدعوية المتنوعة'],
  المساجد: ['عمارة المساجد', 'قرة الأعين', 'المحفظة المتنوعة للمساجد'],
  'الحج ورمضان': ['محفظة مشاريع موسم الحج', 'محفظة مشاريع موسم رمضان'],
}

export const REGIONS = [
  'الرياض', 'مكة المكرمة', 'المدينة المنورة', 'القصيم', 'المنطقة الشرقية',
  'عسير', 'تبوك', 'حائل', 'الحدود الشمالية', 'جيزان', 'نجران', 'الباحة',
  'الجوف', 'عموم المملكة',
] as const

export const CITIES_BY_REGION: Record<string, string[]> = {
  الرياض: ['الرياض', 'الخرج', 'الدلم', 'المجمعة', 'الأفلاج', 'الحريق'],
  'مكة المكرمة': ['مكة المكرمة', 'جدة', 'الطائف', 'رنية', 'الجموم', 'أضم'],
  'المدينة المنورة': ['المدينة المنورة', 'ينبع', 'الحناكية', 'العلا'],
  القصيم: ['بريدة', 'عنيزة', 'الرس', 'البكيرية', 'البدائع', 'الأسياح'],
  'المنطقة الشرقية': ['الدمام', 'الخبر', 'الأحساء', 'الجبيل', 'الخفجي'],
  عسير: ['أبها', 'خميس مشيط', 'أحد رفيدة', 'بيشة'],
  تبوك: ['تبوك', 'أملج', 'البدع', 'ضباء'],
  حائل: ['حائل', 'بقعاء', 'الحائط'],
  'الحدود الشمالية': ['عرعر', 'رفحاء', 'طريف'],
  جيزان: ['جازان', 'صبيا', 'أبو عريش', 'الدرب', 'أحد المسارحة'],
  نجران: ['نجران', 'شرورة', 'حبونا'],
  الباحة: ['الباحة', 'بلجرشي', 'المندق'],
  الجوف: ['سكاكا', 'دومة الجندل', 'القريات'],
  'عموم المملكة': ['عموم المملكة'],
}

/** The eighteen project tags */
export const TAGS = [
  'الأجهزة الكهربائية', 'الدعوة الإلكترونية', 'الدعوة العامة', 'السلال الغذائية',
  'الطفولة المبكرة', 'القيم في التعليم', 'المجمعة', 'بناء وترميم منازل',
  'تعليم التربية الخاصة', 'تعليم الجاليات', 'تعليم الضمانيين', 'تعليم نخب القطاع',
  'دعوة للإسلام', 'رعاية الأيتام', 'سداد الإيجارات والفواتير', 'طلاب المنح',
  'كفالات الأيتام والأرامل', 'مبادرة الحج', 'محو الأمية',
] as const

/** v3 · the project status dictionary (0.status) in its order · «مسودة» stays out · it never reaches
    the list or the reports (0.status.1) */
export const STATUS_GROUPS = [
  'قيد الدراسة', 'معتمد', 'استكمال متطلبات ما قبل التنفيذ', 'تحت التنفيذ', 'قيد الإغلاق',
  'مكتمل', 'مغلق بوفر', 'أعيد توجيه الدعم', 'مرفوض', 'ملغى', 'متعثر',
] as const

export const GRANT_METHODS = ['بحث واستجابة', 'ابتكار وإنضاج'] as const
export const TRANSFER_METHODS = ['حساب الجهة مباشر', 'عبر منصة إحسان'] as const
export const SUPPORT_STATUS = ['معتمد', 'مرفوض'] as const

/** Standardized excusal justifications · rejection is picking a reason, not free text */
export const DECLINE_REASONS = [
  'الاكتفاء بالمشاريع المدعومة في الهدف',
  'الاكتفاء بدعم المشاريع الأخرى لنفس الجهة',
  'مشروع مكرر لنفس الجهة',
  'ضعف دراسة المشروع',
  'الاكتفاء بالمشاريع المدعومة في المنطقة',
  'نفاذ البند المخصص',
  'مشروع ليس ضمن تخصص الجهة',
  'خطأ في تعبئة البيانات',
  'أخرى',
] as const

/* Entity classification · two lists, not one.

   This isn't duplication, it's the difference between what's in the system and what the portal
   shows. The client's live screens list five registration classifications: civil association, civil
   foundation, non-profit company, endowment, civil councils — and no "government".

   But "government" does exist in the live system: at least one existing entity is registered that
   way — so removing it from the list entirely would leave a row with a classification that isn't on
   any list, and every filter and report would come up one short with no visible reason.

   So `REG_TYPES` is what the portal shows (the client's list verbatim), and `ENTITY_TYPES` is
   everything the system can actually contain — any filter over existing entities uses the latter. */

/** Classifications the registration portal shows · the client's list verbatim */
export const REG_TYPES = [
  'جمعية أهلية',
  'مؤسسة أهلية',
  'شركة غير ربحية',
  'وقف',
  'المجالس الأهلية',
] as const

/** Every classification the system can contain · for filtering and reports */
export const ENTITY_TYPES = [...REG_TYPES, 'حكومي'] as const

export const LICENSORS = [
  'المركز الوطني لتنمية القطاع غير الربحي',
  'الهيئة العامة للأوقاف',
  'وزارة التعليم',
  'وزارة التجارة',
  'وزارة الموارد البشرية والتنمية الاجتماعية',
  'أخرى',
] as const

/** v3 · 0.ent.6–9 · the entity account · «مؤرشف» is the archive flag, searched on the archive page */
export const ACTIVATIONS = ['نشط', 'معلق', 'غير نشط'] as const

/** Governance score · "not assessed" is the most common value in the system */
export const GOVERNANCE = ['ممتازة', 'جيدة', 'مقبولة', 'ضعيفة', 'لم تُقيَّم'] as const

/**
 * Required entity file · 8 documents, and their absence is the most common reason an entity gets
 * suspended
 */
export const ENTITY_DOCS = [
  'الترخيص ساري المفعول',
  'السجل التجاري أو قرار التأسيس',
  'شهادة الزكاة والضريبة',
  'شهادة التأمينات الاجتماعية',
  'اللائحة الأساسية',
  'محضر تشكيل مجلس الإدارة',
  'القوائم المالية المدققة',
  'خطاب تفويض الحساب البنكي',
] as const

/** Bank names · one closed list for registration, the entity file and update requests (2.4.27), so a
    bank is never written two ways and the same account reads the same everywhere */
export const BANKS = [
  'مصرف الراجحي',
  'البنك الأهلي السعودي',
  'بنك الرياض',
  'البنك السعودي الفرنسي',
  'بنك البلاد',
  'البنك السعودي للاستثمار',
  'بنك الجزيرة',
  'البنك العربي الوطني',
  'مصرف الإنماء',
  'بنك الخليج الدولي',
] as const

/**
 * Bank account rejection reasons · the seven coded values of the live system, one list for the
 * registration review and the entity file (2.4.27). A reason picked from a closed set can be counted;
 * free text stays locked in its row.
 */
export const BANK_REJECT_REASONS = [
  'إلغاء الحساب بناءً على طلب الجمعية',
  'الحساب لا يعود للجمعية',
  'الحساب مفعل مسبقًا',
  'عدم تطابق اسم الحساب مع الشهادة',
  'عدم تطابق الآيبان مع الشهادة',
  'عدم وجود الآيبان في المرفق',
  'عدم وضوح المرفق',
] as const

/**
 * Process departments that appear as project status, along with the group used to filter them and
 * the time limit in hours.
 *
 * The limits are provisional — the system does measure duration, but no defined limit per
 * department was found. An open question.
 */
export interface StageMeta {
  stage: string
  group: (typeof STATUS_GROUPS)[number]
  /** Limit in hours · provisional */
  limit: number
}

/* v3 · 3.4.15 · the limits are working days (lib/sla.ts) · written here as their calendar hours */
const wd = workDayLimit
/** v3 · BPD-011 · the external project's own stages */
export const EXT_PRE_STAGE = 'متطلبات المشروع الخارجي'
export const EXT_CLOSE_STAGE = 'اعتماد إغلاق المشروع الخارجي'
export const STAGES: StageMeta[] = [
  /* v3 · 0.status.2 · under study from sending until the final decision · the level is the sub-status */
  { stage: 'دراسة المشروع', group: 'قيد الدراسة', limit: wd(900) },
  { stage: 'استكمال بيانات المشروع', group: 'قيد الدراسة', limit: wd(720) },
  /* 0.status.3 · 0.status.4 · approved, then the pre-execution requirements · the status module tells
     the two apart by whether the agreement work has started */
  { stage: 'اعتماد الإتفاقية', group: 'استكمال متطلبات ما قبل التنفيذ', limit: wd(480) },
  { stage: 'الإتفاقيات الورقية', group: 'استكمال متطلبات ما قبل التنفيذ', limit: wd(480) },
  /* Re-audit 7 Oct · named in the data, missing here · it read «في الدراسة» */
  { stage: 'اعتماد الإتفاقية الكترونيًا', group: 'استكمال متطلبات ما قبل التنفيذ', limit: wd(480) },
  /* v3 · 11.2.5 · 11.2.8 · a project supported through an external party · its document and schedule are
     registered before it runs · no internal agreement */
  { stage: 'متطلبات المشروع الخارجي', group: 'استكمال متطلبات ما قبل التنفيذ', limit: wd(480) },
  /* 0.status.5 · execution · the only status a payment runs in */
  { stage: 'المشرف إذن الصرف', group: 'تحت التنفيذ', limit: wd(240) },
  { stage: 'اصدار سند الصرف', group: 'تحت التنفيذ', limit: wd(240) },
  { stage: 'رفع سند القبض والقيد', group: 'تحت التنفيذ', limit: wd(360) },
  { stage: 'رفع تقرير مرحلي', group: 'تحت التنفيذ', limit: wd(720) },
  /* 0.status.6 · from the final report's request until the closing requirements are approved */
  { stage: 'طلب التقرير الختامي', group: 'قيد الإغلاق', limit: wd(720) },
  { stage: 'رفع التقرير الختامي', group: 'قيد الإغلاق', limit: wd(720) },
  { stage: 'اعتماد التقرير الختامي', group: 'قيد الإغلاق', limit: wd(480) },
  { stage: 'تقييم المشروع', group: 'قيد الإغلاق', limit: wd(480) },
  /* v3 · 11.2.14 · the external project's closing at the grants manager · no final report, no evaluation */
  { stage: 'اعتماد إغلاق المشروع الخارجي', group: 'قيد الإغلاق', limit: wd(240) },
  /* 0.status.7–9 · complete · or closed with a saving · or its support redirected (the module reads which) */
  { stage: 'مشروع مكتمل', group: 'مكتمل', limit: 0 },
  /* 0.status.12 · a project whose execution can't go on · not a stage past its SLA */
  { stage: 'مشروع متعثر', group: 'متعثر', limit: 0 },
  /* 0.status.11 · 10.9.1 · a stop approved by the CEO ends as «ملغى» in v3 */
  { stage: 'مشروع موقوف', group: 'ملغى', limit: 0 },
  { stage: 'مشروع ملغي', group: 'ملغى', limit: 0 },
  /* 0.status.10 · a refusal at any level · the level is kept in the decision's details */
  { stage: 'مشروع معتذر عنه', group: 'مرفوض', limit: 0 },
  { stage: 'مرفوض - اللجنة التنفيذية', group: 'مرفوض', limit: 0 },
  { stage: 'مرفوض - مجلس الأمناء', group: 'مرفوض', limit: 0 },
]

/* Meeting 1 Oct, item 9 · the study and completion limits come from the escalation settings now.
   Saved hours lay over the defaults before any project row is built, so every row reads them. */
{
  const saved = readJson<Record<string, number>>(CFG.stageLimits, {})
  for (const s of STAGES) {
    const n = saved[s.stage]
    if (s.limit > 0 && typeof n === 'number' && Number.isFinite(n) && n > 0) s.limit = n
  }
}

export const stageMeta = (stage: string): StageMeta | undefined =>
  STAGES.find((s) => s.stage === stage)

/** Grants officers · the real distribution across them is heavily unbalanced */
export const OWNERS = [
  'عمر قاسم',
  'سعود البريكان',
  'عزام الخريف',
  'أحمد العبداللطيف',
  'حصة النملة',
] as const
