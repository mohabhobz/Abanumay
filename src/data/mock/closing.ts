import { CFG, hydrate } from '@/lib/config'
import type {
  CloseAudit, CloseCycle, CloseRow, CloseStage, CloseVersion, FinalReport, ProjectEval,
} from '@/types/domain'
import { SCENARIO, projectRows } from './projects'
import { planOfProject, planDone } from './plans'
import { payRequests } from './disbursements'
import { NOUN, countOf } from '@/lib/format'
import { TONE } from '@/lib/tone'
import type { Tone } from '@/types/domain'

/* Closing a project · the last procedure in the grant lifecycle

   Document pages 62-67 · 18 main steps · **21** business rules · four AI outputs · four performance
   indicators · two diagrams.

   === The idea this module is built on ===

   Warning: **two independent cycles, not one.** Rule 17, verbatim: "the closing report and the
   project evaluation are each subject to **two independent approval cycles**, with a separate log
   kept for every note and approval decision on each."

     Report     written by the entity      4 stages (supervisor · outreach · manager · executive)
     Evaluation written by the supervisor  3 stages (manager · executive)

   And their sources differ on purpose: the report is **an acknowledgment from the implementer**,
   and the evaluation is **a judgment from the funder** — so whoever reads it needs to know who said
   what.

   Warning: **and the second doesn't start before the first is done** — rule 6: "project evaluation
   procedures may not begin until the closing report is approved **by the executive director**." Not
   after the supervisor's approval, not the manager's — after the executive's.

   Warning: **and the project's status doesn't move during the whole cycle.** Rule 16: "the closing
   report moving between review and approval stages doesn't affect the project's status, which
   **stays 'in progress'**." And rules 8 and 18 say "complete" needs **three things** together: the
   report approved, **and** the evaluation approved, **and** the financial and administrative
   requirements complete.

   This is the same separation-of-procedures principle applied for the third time in the system,
   after the agreement and the plan, and closing is **its own independent record** with its own
   status.

   Warning: **and versions, not one copy.** Rule 15: only **one** approved report per project, with
   more than one version during review; and rule 19: every send-back creates a new version and the
   old one stays. Without this, an entity acting on a note would edit in place and the reviewer
   wouldn't know what changed.

   Warning: **and after final closing there's no editing** — rule 21: any later change needs **a new
   procedure**. */

/** Today, in the mock · same date as the plans so the calculations line up */
export const TODAY = '2026-09-18'

export const CLOSE_STAGES: {
  key: CloseStage; label: string; who: string; note: string; cycle: CloseCycle
}[] = [
  { key: 'draft', label: 'عند الجهة', who: 'الجهة المستفيدة', note: 'تكتب التقرير الختامي وترفق شواهده', cycle: 'report' },
  { key: 'supervisor', label: 'مراجعة مشرف المنح', who: 'مشرف المنح', note: 'مقارنة المعتمد بالتنفيذ الفعلي', cycle: 'report' },
  { key: 'comms', label: 'مراجعة الاتصال المؤسسي', who: 'إدارة الاتصال المؤسسي', note: 'التحقّق من النشر الإعلامي · قاعدة 9', cycle: 'report' },
  { key: 'manager', label: 'اعتماد مدير المنح', who: 'مدير المنح', note: 'قرار اعتماد أو إعادة بملاحظات', cycle: 'report' },
  { key: 'executive', label: 'اعتماد المدير التنفيذي', who: 'المدير التنفيذي', note: 'باعتماده تُغلق دورة التقرير', cycle: 'report' },
  { key: 'reportDone', label: 'التقرير معتمد', who: 'مشرف المنح', note: 'يمكن بدء التقييم · قاعدة 6', cycle: 'eval' },
  { key: 'evalDraft', label: 'إعداد التقييم', who: 'مشرف المنح', note: 'الأثر والمؤشرات والدروس المستفادة', cycle: 'eval' },
  { key: 'evalManager', label: 'التقييم عند مدير المنح', who: 'مدير المنح', note: 'دورة اعتماد مستقلّة · قاعدة 17', cycle: 'eval' },
  { key: 'evalExecutive', label: 'التقييم عند المدير التنفيذي', who: 'المدير التنفيذي', note: 'آخر اعتماد قبل الإغلاق', cycle: 'eval' },
  { key: 'closed', label: 'مغلق · مكتمل', who: '', note: 'اكتمل التقرير والتقييم والمتطلبات كلها', cycle: 'eval' },
  { key: 'returned', label: 'مُعاد بملاحظات', who: 'حسب الإعادة', note: 'إصدار جديد بعد التعديل · قاعدة 19', cycle: 'report' },
]

export const closeStageLabel = (s: CloseStage): string =>
  CLOSE_STAGES.find((x) => x.key === s)?.label ?? s

export const closeStageWho = (s: CloseStage): string =>
  CLOSE_STAGES.find((x) => x.key === s)?.who ?? ''

export const closeStageNote = (s: CloseStage): string =>
  CLOSE_STAGES.find((x) => x.key === s)?.note ?? ''

/**
 * Badge tone · **written once**, like `AGR_TONE` and `PLAN_TONE`.
 *
 * Warning: every screen in agreements used to pick its own tone, so the same stage got one color
 * here and another there — the lesson was logged there, and the tone is now part of the data.
 */
export const CLOSE_TONE: Record<CloseStage, Tone> = {
  draft: TONE.draft,
  supervisor: TONE.review,
  comms: TONE.review,
  manager: TONE.review,
  executive: TONE.review,
  reportDone: TONE.review,
  evalDraft: TONE.review,
  evalManager: TONE.review,
  evalExecutive: TONE.review,
  closed: TONE.done,
  returned: TONE.returned,
}

/**
 * Stage limit in hours · provisional like every duration in the system.
 *
 * Warning: **these numbers aren't from the document** — the document measures "average project
 * closing time" (indicator 1) and sets no limit per stage. The numbers here are derived from the
 * stage limits already in `taxonomy` so the delay chips work — **and this is still an open question
 * with the client**.
 */
export const CLOSE_LIMIT: Record<CloseStage, number> = hydrate(CFG.closeLimits, {
  draft: 720,
  supervisor: 480,
  comms: 360,
  manager: 480,
  executive: 480,
  reportDone: 240,
  evalDraft: 480,
  evalManager: 480,
  evalExecutive: 480,
  closed: 0,
  returned: 720,
})

/** Supporting documents for the closing report · rule 5 */
export const CLOSE_DOCS: { key: string; label: string; req?: boolean }[] = [
  { key: 'final', label: 'التقرير الختامي التفصيلي', req: true },
  { key: 'photos', label: 'صور التنفيذ', req: true },
  { key: 'invoices', label: 'الفواتير والمستندات المالية', req: true },
  { key: 'media', label: 'المواد الإعلامية' },
  { key: 'handover', label: 'محاضر الاستلام' },
  { key: 'beneficiaries', label: 'كشف المستفيدين' },
]

/* Blockers · what makes the system refuse submission */

/**
 * Can we even open a closing for this project?
 *
 * Warning: **two rules together, not one:**
 *   Rule 1 · the duration is over, or the activities are complete, or there's a termination
 *   decision.
 *   Rule 2 · **every disbursement has been spent or obligations settled.**
 *
 * The second is the one that gets forgotten: a project with an unspent disbursement can't start
 * closing — otherwise a project gets closed while still owed money.
 */
/* The closing store registers the live gates (eligibility and the financial and administrative
   requirements) · a registry, so this mock doesn't import the stores */
let openGate: ((projectId: string) => { ok: boolean; why: string }) | null = null
export const setOpenGate = (f: (projectId: string) => { ok: boolean; why: string }) => { openGate = f }
let reqGate: ((c: CloseRow) => { ok: boolean; say: string }) | null = null
export const setReqGate = (f: (c: CloseRow) => { ok: boolean; say: string }) => { reqGate = f }

export const canOpenClose = (projectId: string): { ok: boolean; why: string } => {
  if (openGate) return openGate(projectId)
  const pr = projectRows.find((p) => p.id === projectId)
  if (!pr) return { ok: false, why: 'المشروع غير موجود' }

  /* Rule 1 · plan complete = activities complete */
  const plan = planOfProject(projectId)
  const activitiesDone = plan ? planDone(plan) >= 100 : false
  if (plan && !activitiesDone) {
    return { ok: false, why: 'لم تكتمل خطة التنفيذ بعد · قاعدة 1' }
  }

  /* Rule 2 · no outstanding disbursement left unspent */
  const open = payRequests.filter(
    (r) => r.projectId === projectId && r.state !== 'paid' && r.state !== 'closed',
  )
  if (open.length > 0) {
    return { ok: false, why: `${countOf(open.length, NOUN.payment)} لم تُسوَّ بعد · قاعدة 2` }
  }

  return { ok: true, why: 'المشروع مؤهَّل للإغلاق' }
}

/**
 * What blocks sending the report for review · rules 3, 4, and 10.
 *
 * Warning: **rule 4 states the minimum verbatim**: "actual beneficiary count, actual budget,
 * execution duration, and the key outputs and results achieved." These four aren't optional.
 */
export const reportBlockers = (c: CloseRow): string[] => {
  const out: string[] = []
  const r = c.report
  if (r.beneficiaries === null) out.push('عدد المستفيدين الفعلي')
  if (r.budget === null) out.push('الميزانية الفعلية')
  if (r.days === null) out.push('مدة التنفيذ')
  if (!r.outcomes.trim()) out.push('أبرز المخرجات والنتائج')
  for (const d of CLOSE_DOCS) {
    if (d.req && !r.docs.includes(d.key)) out.push(d.label)
  }
  return out
}

/** What blocks sending the evaluation · rule 10 on the second cycle */
export const evalBlockers = (c: CloseRow): string[] => {
  const out: string[] = []
  const e = c.evaluation
  if (!e) return ['لم يبدأ التقييم بعد']
  if (e.indicators.some((i) => i.actual === null)) out.push('مؤشرات بلا قيمة متحقّقة')
  if (!e.impact.trim()) out.push('الأثر المرصود')
  if (!e.lessons.trim()) out.push('الدروس المستفادة')
  if (e.score === null) out.push('التقدير العام')
  return out
}

/**
 * Can the evaluation start? · rule 6.
 *
 * Warning: **specifically after the executive director's approval** — not after the supervisor's or
 * the manager's. The `reportDone` stage is what confirms this condition is met.
 */
export const canStartEval = (c: CloseRow): boolean => c.stage === 'reportDone'

/**
 * Is the outreach stage required? · rule 9.
 *
 * Warning: **"when it was required"** — meaning when the agreement includes a publicity commitment.
 * A case where it isn't required still **states that the stage was skipped**, rather than hiding it
 * — absence isn't an answer (the same rule as the cards and the assistant).
 */
export const needsComms = (c: CloseRow): boolean => c.mediaRequired

/** The cycle we're currently in */
export const closeCycle = (c: CloseRow): CloseCycle =>
  CLOSE_STAGES.find((x) => x.key === c.stage)?.cycle ?? 'report'

/** Has the report been approved? · any stage past the executive */
export const reportApproved = (c: CloseRow): boolean =>
  ['reportDone', 'evalDraft', 'evalManager', 'evalExecutive', 'closed'].includes(c.stage)

/** Has the evaluation been approved? */
export const evalApproved = (c: CloseRow): boolean => c.stage === 'closed'

/**
 * Are the financial and administrative requirements complete? · rules 8 and 18.
 *
 * Warning: **this is still an open question** — the document says "completing all financial and
 * administrative requirements" without listing them. What's computed here is what the system
 * actually knows: no pending disbursement. Any other requirement gets added once the client defines
 * it.
 */
export const closeRequirements = (c: CloseRow): { ok: boolean; say: string } => {
  if (reqGate) return reqGate(c)
  const open = payRequests.filter(
    (r) => r.projectId === c.projectId && r.state !== 'paid' && r.state !== 'closed',
  )
  if (open.length > 0) return { ok: false, say: countOf(open.length, NOUN.pendingPayment) }
  return { ok: true, say: 'لا يوجد التزام مالي معلّق' }
}

/** Past its stage's limit? */
export const closeLate = (c: CloseRow): boolean =>
  CLOSE_LIMIT[c.stage] > 0 && c.hoursInStage > CLOSE_LIMIT[c.stage]

/**
 * The gap between planned and actual · this is **the heart of the review**.
 *
 * Warning: the number alone says nothing — "800 beneficiaries" isn't information, "800 against a
 * planned 1,000" is. So the function returns both plus the difference.
 */
export const reportGap = (c: CloseRow): {
  key: string; label: string; planned: number; actual: number | null; unit: string
}[] => {
  const pr = projectRows.find((p) => p.id === c.projectId)
  return [
    {
      key: 'ben',
      label: 'المستفيدون',
      planned: pr?.beneficiaries ?? 0,
      actual: c.report.beneficiaries,
      unit: 'مستفيد',
    },
    {
      key: 'budget',
      label: 'الميزانية',
      planned: pr?.amountGranted ?? 0,
      actual: c.report.budget,
      unit: 'ريال',
    },
  ]
}

/* Seeds · six genuinely different cases, not copies */

const mkReport = (over: Partial<FinalReport> = {}): FinalReport => ({
  beneficiaries: null,
  budget: null,
  days: null,
  outcomes: '',
  risks: '',
  docs: [],
  links: [],
  ...over,
})

const mkEval = (over: Partial<ProjectEval> = {}): ProjectEval => ({
  indicators: [
    { name: 'عدد المستفيدين', target: 1000, actual: null, unit: 'مستفيد' },
    { name: 'نسبة رضا المستفيدين', target: 85, actual: null, unit: '%' },
    { name: 'عدد الجلسات المنفّذة', target: 48, actual: null, unit: 'جلسة' },
  ],
  impact: '',
  lessons: '',
  score: null,
  ...over,
})

const v = (no: number, at: string, by: string, say: string): CloseVersion =>
  ({ no, at, by, say })

const a = (at: string, by: string, what: string): CloseAudit => ({ at, by, what })

const row = (
  id: string,
  projectId: string,
  stage: CloseStage,
  over: Partial<CloseRow> = {},
): CloseRow => {
  const pr = projectRows.find((p) => p.id === projectId)
  return {
    id,
    projectId,
    projectName: pr?.name ?? projectId,
    entityId: pr?.entityId ?? '',
    entityName: pr?.entityName ?? '',
    stage,
    report: mkReport(),
    evaluation: null,
    versions: [v(1, '2026-08-01', 'عمر قاسم', 'طلب التقرير الختامي')],
    evalVersions: [],
    audit: [a('2026-08-01', 'عمر قاسم', 'إنشاء طلب التقرير الختامي')],
    mediaRequired: true,
    owner: pr?.owner ?? 'عمر قاسم',
    openedAt: '2026-08-01',
    hoursInStage: 120,
    ...over,
  }
}

export const closeRows: CloseRow[] = [
  /* 1 · with the entity · not yet submitted, missing the minimum */
  row('CL-2041', '20852', 'draft', {
    report: mkReport({
      beneficiaries: 780,
      outcomes: 'نُفّذت 42 جلسة من 48، وأُجّل الباقي لظروف تتعلق بالمقر.',
      docs: ['final', 'photos'],
    }),
    hoursInStage: 800,
    mediaRequired: true,
  }),

  /* 2 · with the grants supervisor · complete and awaiting review */
  row('CL-2042', '20838', 'supervisor', {
    report: mkReport({
      beneficiaries: 1120,
      budget: 296_400,
      days: 214,
      outcomes: 'نُفّذ البرنامج بالكامل: 12 فعالية و3 ورش تدريبية.',
      risks: 'تأخّر التوريد شهرًا في المرحلة الثانية.',
      docs: ['final', 'photos', 'invoices', 'media'],
      links: [{ label: 'صور ومقاطع التنفيذ', url: 'https://drive.google.com/drive/folders/ab-20838' }],
    }),
    hoursInStage: 300,
    versions: [v(1, '2026-08-01', 'عمر قاسم', 'طلب التقرير الختامي')],
    audit: [
      a('2026-08-01', 'عمر قاسم', 'إنشاء طلب التقرير الختامي'),
      a('2026-09-06', 'جمعية الدعوة وتوعية الجاليات', 'إرسال التقرير الختامي'),
    ],
  }),

  /* 3 · with outreach · rule 9 */
  row('CL-2043', '20824', 'comms', {
    report: mkReport({
      beneficiaries: 640,
      budget: 512_000,
      days: 180,
      outcomes: 'ترميم ثمانية مساجد وتسليمها للجهة المشغّلة.',
      risks: 'احتاج مسجدان إلى أعمال إنشائية إضافية.',
      docs: ['final', 'photos', 'invoices', 'media', 'handover'],
    }),
    hoursInStage: 400,
    mediaRequired: true,
    audit: [
      a('2026-08-01', 'حصة النملة', 'إنشاء طلب التقرير الختامي'),
      a('2026-09-01', 'جمعية العناية بالمساجد بالقصيم', 'إرسال التقرير الختامي'),
      a('2026-09-09', 'حصة النملة', 'اعتماد مشرف المنح · إحالة إلى الاتصال المؤسسي'),
    ],
  }),

  /* 4 · sent back with notes · a second version · rule 19 */
  row('CL-2044', '20866', 'returned', {
    returnedTo: 'draft',
    note: 'الفواتير المرفوعة تغطي \u206660%\u2069 فقط من الميزانية الفعلية المذكورة. أرفق مستندات تغطي الفرق.',
    report: mkReport({
      beneficiaries: 410,
      budget: 338_000,
      days: 160,
      outcomes: 'نُفّذت الدورات القرآنية الموسمية في ستة مراكز.',
      docs: ['final', 'photos'],
    }),
    hoursInStage: 600,
    mediaRequired: false,
    versions: [
      v(1, '2026-08-01', 'عزام الخريف', 'طلب التقرير الختامي'),
      v(2, '2026-09-12', 'عزام الخريف', 'إعادة من مدير المنح لاستكمال الفواتير'),
    ],
    audit: [
      a('2026-08-01', 'عزام الخريف', 'إنشاء طلب التقرير الختامي'),
      a('2026-08-28', 'جمعية تحفيظ القرآن بالمدينة', 'إرسال التقرير الختامي'),
      a('2026-09-03', 'عزام الخريف', 'اعتماد مشرف المنح'),
      a('2026-09-12', 'مدير المنح', 'إعادة بملاحظات · إصدار 2'),
    ],
  }),

  /* 5 · report approved, and the evaluation in approval · rules 6 and 17 */
  row('CL-2045', '20802', 'evalManager', {
    report: mkReport({
      beneficiaries: 2300,
      budget: 1_940_000,
      days: 330,
      outcomes: 'نُفّذ برنامج الاستدامة لخمس جمعيات: 36 ورشة و5 خطط مالية.',
      risks: 'جمعيتان تأخّرتا في تسليم بياناتهما.',
      docs: ['final', 'photos', 'invoices', 'media', 'beneficiaries'],
      links: [{ label: 'أرشيف المشروع', url: 'https://drive.google.com/drive/folders/ab-20802' }],
    }),
    evaluation: mkEval({
      indicators: [
        { name: 'عدد الجمعيات المستفيدة', target: 5, actual: 5, unit: 'جمعية' },
        { name: 'ورش التدريب', target: 30, actual: 36, unit: 'ورشة' },
        { name: 'خطط مالية معتمدة', target: 5, actual: 4, unit: 'خطة' },
      ],
      impact: 'أصبح لدى أربع جمعيات من خمس خطة مالية معتمدة ومصدر دخل إضافي.',
      lessons: 'الورش الجماعية أنفع من الاستشارة الفردية في المرحلة الأولى.',
      score: 4,
    }),
    hoursInStage: 200,
    mediaRequired: true,
    versions: [v(1, '2026-06-01', 'عمر قاسم', 'طلب التقرير الختامي')],
    evalVersions: [v(1, '2026-09-10', 'عمر قاسم', 'إعداد التقييم')],
    audit: [
      a('2026-06-01', 'عمر قاسم', 'إنشاء طلب التقرير الختامي'),
      a('2026-07-20', 'مؤسسة تمكين القطاع غير الربحي', 'إرسال التقرير الختامي'),
      a('2026-08-02', 'عمر قاسم', 'اعتماد مشرف المنح'),
      a('2026-08-10', 'الاتصال المؤسسي', 'اعتماد النشر الإعلامي'),
      a('2026-08-20', 'مدير المنح', 'اعتماد التقرير'),
      a('2026-09-01', 'المدير التنفيذي', 'اعتماد التقرير الختامي · إقفال الدورة الأولى'),
      a('2026-09-10', 'عمر قاسم', 'إرسال التقييم إلى مدير المنح'),
    ],
  }),

  /* 6 · closed · complete */
  row('CL-2046', '20611', 'closed', {
    report: mkReport({
      beneficiaries: 150,
      budget: 240_000,
      days: 200,
      outcomes: 'تأسيس الجمعية واستخراج ترخيصها وتشكيل مجلس إدارتها.',
      risks: 'لا يوجد.',
      docs: ['final', 'photos', 'invoices', 'handover'],
    }),
    evaluation: mkEval({
      indicators: [
        { name: 'ترخيص صادر', target: 1, actual: 1, unit: 'ترخيص' },
        { name: 'أعضاء مجلس الإدارة', target: 7, actual: 7, unit: 'عضو' },
        { name: 'نسبة اكتمال الحوكمة', target: 80, actual: 92, unit: '%' },
      ],
      impact: 'جمعية أهلية جديدة تعمل في الخرج بمجلس مكتمل ولائحة معتمدة.',
      lessons: 'ربط الصرف بمراحل الترخيص قلّل التأخير إلى شهر واحد بدل ثلاثة.',
      score: 5,
    }),
    closedAt: '2026-09-05',
    hoursInStage: 0,
    mediaRequired: false,
    versions: [v(1, '2026-04-01', 'سعود البريكان', 'طلب التقرير الختامي')],
    evalVersions: [v(1, '2026-08-15', 'سعود البريكان', 'إعداد التقييم')],
    audit: [
      a('2026-04-01', 'سعود البريكان', 'إنشاء طلب التقرير الختامي'),
      a('2026-06-10', 'مؤسسة تمكين القطاع غير الربحي', 'إرسال التقرير الختامي'),
      a('2026-06-20', 'سعود البريكان', 'اعتماد مشرف المنح'),
      a('2026-07-01', 'مدير المنح', 'اعتماد التقرير'),
      a('2026-07-15', 'المدير التنفيذي', 'اعتماد التقرير الختامي'),
      a('2026-08-15', 'سعود البريكان', 'إعداد التقييم'),
      a('2026-08-25', 'مدير المنح', 'اعتماد التقييم'),
      a('2026-09-05', 'المدير التنفيذي', 'اعتماد التقييم · الإغلاق النهائي'),
    ],
  }),
]

/* ═══ Scenario records (meeting 1 Oct, A-6) ═══
   The six seeds above are hand-written cases; these top every stage up to three so each state of
   both cycles can be opened in a workshop. Built from the stage's own position in the journey:
   the audit trail, the report's completeness and the evaluation all follow from how far along
   the record is, not from a copy of another record. */

const SC_ORDER: CloseStage[] = [
  'draft', 'supervisor', 'returned', 'comms', 'manager', 'executive',
  'reportDone', 'evalDraft', 'evalManager', 'evalExecutive', 'closed',
]

/** How many journey steps each stage has passed · indexes into SC_STEPS */
const SC_PASSED: Record<CloseStage, number> = {
  draft: 1, supervisor: 2, returned: 3, comms: 3, manager: 4, executive: 5,
  reportDone: 6, evalDraft: 6, evalManager: 7, evalExecutive: 8, closed: 9,
}

const SC_STEPS: { by: 'owner' | 'entity' | string; what: string }[] = [
  { by: 'owner', what: 'إنشاء طلب التقرير الختامي' },
  { by: 'entity', what: 'إرسال التقرير الختامي' },
  { by: 'owner', what: 'اعتماد مشرف المنح · إحالة إلى الاتصال المؤسسي' },
  { by: 'الاتصال المؤسسي', what: 'اعتماد النشر الإعلامي' },
  { by: 'مدير المنح', what: 'اعتماد التقرير' },
  { by: 'المدير التنفيذي', what: 'اعتماد التقرير الختامي · إقفال الدورة الأولى' },
  { by: 'owner', what: 'إرسال التقييم إلى مدير المنح' },
  { by: 'مدير المنح', what: 'اعتماد التقييم' },
  { by: 'المدير التنفيذي', what: 'اعتماد التقييم · الإغلاق النهائي' },
]

const SC_OUTCOMES = [
  'نُفّذت الأنشطة المخطّطة كاملة وسُلّمت المخرجات للجهة المشغّلة.',
  'اكتمل التنفيذ في موعده مع زيادة طفيفة في عدد المستفيدين عن المستهدف.',
  'نُفّذ البرنامج على مرحلتين بعد تأجيل المرحلة الثانية شهرًا لظروف الموسم.',
  'أُنجزت المخرجات الرئيسة وبقي نشاط تكميلي واحد نُقل إلى خطة الجهة التشغيلية.',
]
const SC_RISKS = [
  'تأخّر التوريد في المرحلة الأولى.',
  'ارتفاع أسعار المواد عن تقدير الميزانية.',
  'لا يوجد.',
  'صعوبة الوصول إلى بعض المستفيدين في القرى البعيدة.',
]
const SC_RETURNS = [
  'صور التنفيذ لا تغطي جميع المواقع المذكورة في التقرير · أرفق صورًا لكل موقع.',
  'عدد المستفيدين في التقرير يختلف عن كشف المستفيدين المرفق · وحّد الرقمين.',
]

const scDay = (start: string, d: number): string => {
  const t = new Date(`${start}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}

;(() => {
  const pool = SCENARIO.closing.slice()
  let seq = 0
  for (const stage of SC_ORDER) {
    while (closeRows.filter((c) => c.stage === stage).length < 3 && pool.length) {
      const pid = pool.shift()!
      const pr = projectRows.find((p) => p.id === pid)
      if (!pr) continue
      const i = seq++
      const owner = pr.owner ?? 'عمر قاسم'
      const start = scDay('2026-06-01', (i * 3) % 45)
      const passed = SC_PASSED[stage]
      const audit = SC_STEPS.slice(0, passed).map((st, k) =>
        a(scDay(start, k * 7 + 2), st.by === 'owner' ? owner : st.by === 'entity' ? pr.entityName : st.by, st.what))
      if (stage === 'returned') audit.push(a(scDay(start, passed * 7 + 2), 'مدير المنح', 'إعادة بملاحظات · إصدار 2'))
      const sent = passed >= 2
      const ben = Math.round(pr.beneficiaries * (0.92 + (i % 4) * 0.04))
      const budget = Math.round((pr.amountGranted * (0.94 + (i % 3) * 0.03)) / 100) * 100
      const report = mkReport(sent
        ? {
            beneficiaries: ben, budget, days: pr.durationDays - 10 + (i % 5) * 6,
            outcomes: SC_OUTCOMES[i % SC_OUTCOMES.length], risks: SC_RISKS[i % SC_RISKS.length],
            docs: ['final', 'photos', 'invoices', 'media', ...(i % 2 ? ['beneficiaries'] : [])],
          }
        : { beneficiaries: i % 2 ? ben : null, outcomes: i % 2 ? SC_OUTCOMES[0] : '', docs: i % 2 ? ['final'] : [] })
      const evalOn = ['evalDraft', 'evalManager', 'evalExecutive', 'closed'].includes(stage)
      const full = stage !== 'evalDraft'
      const evaluation = evalOn
        ? mkEval({
            indicators: [
              { name: 'عدد المستفيدين', target: pr.beneficiaries, actual: ben, unit: 'مستفيد' },
              { name: 'نسبة رضا المستفيدين', target: 85, actual: full ? 82 + (i % 4) * 4 : null, unit: '%' },
              { name: 'نسبة إنجاز الأنشطة', target: 100, actual: full ? 90 + (i % 3) * 5 : null, unit: '%' },
            ],
            impact: full ? 'تحقّق الأثر المستهدف في الفئة المخدومة وأبدت الجهة استعدادها للاستمرار ذاتيًّا.' : '',
            lessons: full ? 'التخطيط المرحلي للصرف قلّل التأخير وسهّل المتابعة.' : '',
            score: full ? 3 + (i % 3) : null,
          })
        : null
      closeRows.push(row(`CL-${2100 + i}`, pid, stage, {
        report,
        evaluation,
        hoursInStage: stage === 'closed' ? 0 : 60 + ((i * 97) % 700),
        mediaRequired: i % 3 !== 2,
        openedAt: start,
        versions: [
          v(1, start, owner, 'طلب التقرير الختامي'),
          ...(stage === 'returned' ? [v(2, scDay(start, passed * 7 + 2), owner, 'إعادة من مدير المنح بملاحظات')] : []),
        ],
        evalVersions: evalOn ? [v(1, scDay(start, 44), owner, 'إعداد التقييم')] : [],
        audit,
        ...(stage === 'returned' ? { returnedTo: 'draft' as CloseStage, note: SC_RETURNS[i % SC_RETURNS.length] } : {}),
        ...(stage === 'closed' ? { closedAt: scDay(start, 63) } : {}),
      }))
    }
  }
})()

export const closeById = (id: string): CloseRow | undefined =>
  closeRows.find((c) => c.id === id)

export const closeOfProject = (projectId: string): CloseRow | undefined =>
  closeRows.find((c) => c.projectId === projectId)

/* Actions · each one logs to the audit trail (rule 11) */

const log = (c: CloseRow, by: string, what: string) => {
  c.audit.push({ at: TODAY, by, what })
}

/** Registered by the budget store · the unused balance goes back to the project's lines on final
    closing (1.4.32) · a registry, so this mock doesn't import the store */
let closeHook: ((projectId: string, by: string) => void) | null = null
export const setCloseHook = (f: (projectId: string, by: string) => void) => { closeHook = f }

/** Grants supervisor opens the closing-report request · step 1 */
export const openClose = (projectId: string): string => {
  const has = closeOfProject(projectId)
  if (has) return has.id
  const pr = projectRows.find((p) => p.id === projectId)
  const id = `CL-${2050 + closeRows.length}`
  closeRows.push(row(id, projectId, 'draft', {
    openedAt: TODAY,
    hoursInStage: 0,
    versions: [v(1, TODAY, pr?.owner ?? 'مشرف المنح', 'طلب التقرير الختامي')],
    audit: [a(TODAY, pr?.owner ?? 'مشرف المنح', 'إنشاء طلب التقرير الختامي')],
  }))
  return id
}

/** The entity submits the report · step 5 · the system blocks it if incomplete (step 6) */
export const sendReport = (c: CloseRow): void => {
  if (reportBlockers(c).length > 0) return
  c.stage = 'supervisor'
  c.hoursInStage = 0
  log(c, c.entityName, 'إرسال التقرير الختامي')
}

/**
 * Sent back with notes · rule 19.
 *
 * Warning: **a send-back creates a new version** · the old one stays in the log.
 */
export const returnReport = (c: CloseRow, by: string, say: string, to: CloseStage): void => {
  c.stage = 'returned'
  c.returnedTo = to
  c.note = say
  c.hoursInStage = 0
  c.versions.push(v(c.versions.length + 1, TODAY, by, `إعادة من ${by}`))
  log(c, by, `إعادة بملاحظات · إصدار ${c.versions.length}`)
}

/** Approving a stage in the report cycle · moves to the next stage */
export const approveReport = (c: CloseRow, by: string): void => {
  const next: Partial<Record<CloseStage, CloseStage>> = {
    /* Warning: outreach is skipped if publicity isn't required · rule 9 */
    supervisor: needsComms(c) ? 'comms' : 'manager',
    comms: 'manager',
    manager: 'executive',
    executive: 'reportDone',
  }
  const to = next[c.stage]
  if (!to) return
  c.stage = to
  c.hoursInStage = 0
  log(c, by, to === 'reportDone' ? 'اعتماد التقرير الختامي · إقفال الدورة الأولى' : `اعتماد · إحالة إلى ${closeStageLabel(to)}`)
}

/** Grants supervisor starts the evaluation · rule 6 */
export const startEval = (c: CloseRow, by: string): void => {
  if (!canStartEval(c)) return
  c.stage = 'evalDraft'
  c.evaluation = mkEval()
  c.evalVersions.push(v(1, TODAY, by, 'إعداد التقييم'))
  c.hoursInStage = 0
  log(c, by, 'بدء إعداد تقييم المشروع')
}

export const sendEval = (c: CloseRow, by: string): void => {
  if (evalBlockers(c).length > 0) return
  c.stage = 'evalManager'
  c.hoursInStage = 0
  log(c, by, 'إرسال التقييم إلى مدير المنح')
}

export const approveEval = (c: CloseRow, by: string): void => {
  if (c.stage === 'evalManager') {
    c.stage = 'evalExecutive'
    c.hoursInStage = 0
    log(c, by, 'اعتماد التقييم · إحالة إلى المدير التنفيذي')
    return
  }
  if (c.stage !== 'evalExecutive') return
  /* Warning: **final closing needs all three** · rules 8 and 18 */
  if (!closeRequirements(c).ok) return
  c.stage = 'closed'
  c.closedAt = TODAY
  c.hoursInStage = 0
  log(c, by, 'اعتماد التقييم · الإغلاق النهائي')
  closeHook?.(c.projectId, by)
}

/* Performance indicators · 11.7 · four */

/** Target duration for closing · sum of the stage limits in days */
export const CLOSE_TARGET_DAYS = Math.round(
  Object.values(CLOSE_LIMIT).reduce((s, h) => s + h, 0) / 24,
)

export const closeKpi = () => {
  const closed = closeRows.filter((c) => c.stage === 'closed')
  const open = closeRows.filter((c) => c.stage !== 'closed')

  /* Indicator 1 · average closing duration · from opening the request to closing */
  const days = closed.map((c) => {
    const from = new Date(c.openedAt).getTime()
    const to = new Date(c.closedAt ?? TODAY).getTime()
    return Math.round((to - from) / 86_400_000)
  })
  const avg = days.length > 0 ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : 0

  /* Indicator 2 · share closed within the target duration */
  const inTime = days.filter((d) => d <= CLOSE_TARGET_DAYS).length
  const inTimePct = closed.length > 0 ? Math.round((inTime / closed.length) * 100) : 0

  /* Indicator 3 · average report drafting time · from opening the request until the entity submits
     it · the "closing report submitted" line in the audit log is the only source for this date
     (rule 11 is what keeps it there) */
  const sent = closeRows
    .map((c) => {
      const at = c.audit.find((x) => x.what.startsWith('إرسال التقرير'))?.at
      if (!at) return null
      return Math.round(
        (new Date(at).getTime() - new Date(c.openedAt).getTime()) / 86_400_000,
      )
    })
    .filter((d): d is number => d !== null)
  const prepDays = sent.length > 0
    ? Math.round(sent.reduce((s, d) => s + d, 0) / sent.length)
    : 0

  /* Indicator 4 · share closed after completing the requirements */
  const full = closed.filter((c) => closeRequirements(c).ok).length
  const fullPct = closed.length > 0 ? Math.round((full / closed.length) * 100) : 0

  return {
    avg,
    inTimePct,
    prepDays,
    fullPct,
    closed: closed.length,
    open: open.length,
    late: open.filter(closeLate).length,
  }
}
