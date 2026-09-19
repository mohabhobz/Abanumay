import type {
  CloseAudit, CloseCycle, CloseRow, CloseStage, CloseVersion, FinalReport, ProjectEval,
} from '@/types/domain'
import { projectRows } from './projects'
import { planOfProject, planDone } from './plans'
import { payRequests } from './disbursements'

/* ═══════════════════════════════════════════════════════════
   إغلاق المشروع · BPD-011 · آخر إجراء في دورة حياة المنحة

   الوثيقة ص 62–67 · ١٨ خطوة رئيسية · **٢١** قاعدة عمل · أربعة
   مخرجات للذكاء الاصطناعي · أربعة مؤشرات أداء · مخططان.

   ═══ الفكرة اللي الموديول مبني عليها ═══

   ⚠️ **دورتان مستقلّتان لا دورة واحدة.** القاعدة 17 بالنصّ:
   «يخضع التقرير الختامي وتقييم المشروع **لدورتي اعتماد
   مستقلتين**، مع الاحتفاظ بسجل منفصل لجميع الملاحظات وقرارات
   الاعتماد الخاصة بكل منهما».

     التقرير  · الجهة بتكتبه   · 4 محطات (مشرف · اتصال · مدير · تنفيذي)
     التقييم  · المشرف بيكتبه  · 3 محطات (مدير · تنفيذي)

   ومصدرهم مختلف عن قصد: التقرير **إقرار من المنفِّذ**، والتقييم
   **حكم من المموِّل** · فاللي بيقرا لازم يعرف مين قال إيه.

   ⚠️ **والتاني ما يبدأش قبل ما الأول يخلص** · قاعدة 6: «لا يجوز
   البدء في إجراءات تقييم المشروع إلا بعد اعتماد التقرير الختامي
   **من المدير التنفيذي**». مش بعد اعتماد المشرف ولا المدير ·
   بعد التنفيذي.

   ⚠️ **وحالة المشروع ما بتتحرّكش أثناء الدورة كلها.** قاعدة 16:
   «لا يؤثر انتقال التقرير الختامي بين مراحل المراجعة والاعتماد
   على حالة المشروع، حيث **تبقى حالة المشروع «تحت التنفيذ»**».
   وقاعدة 8 و18 بيقولوا إن «مكتمل» بتحتاج **تلاتة** مع بعض:
   التقرير معتمد **و** التقييم معتمد **و** المتطلبات المالية
   والإدارية مكتملة.

   ده تطبيق ح-10 (فصل الإجراءات) للمرة التالتة في السيستم بعد
   الاتفاقية والخطة · والإغلاق **سجلّ مستقل** بحالته هو.

   ⚠️ **وإصدارات لا نسخة.** قاعدة 15: تقرير معتمد **واحد**
   للمشروع، وأكتر من إصدار أثناء المراجعة · وقاعدة 19: كل إعادة
   بتخلّي إصدارًا جديدًا والقديم بيفضل. من غير كده الجهة اللي
   رجعت لها ملاحظة بتعدّل مكانها والمراجع ما يعرفش اتغيّر إيه.

   ⚠️ **وبعد الإغلاق النهائي مفيش تعديل** · قاعدة 21: أي تعديل
   لاحق بيحتاج **إجراء جديد**.
   ═══════════════════════════════════════════════════════════ */

/** اليوم في النموذج · نفس تاريخ الخطط عشان الحسابات تتفق */
export const TODAY = '2026-09-18'

export const CLOSE_STAGES: {
  key: CloseStage; label: string; who: string; note: string; cycle: CloseCycle
}[] = [
  { key: 'draft', label: 'عند الجهة', who: 'الجهة المستفيدة', note: 'بتكتب التقرير الختامي وبترفق شواهده', cycle: 'report' },
  { key: 'supervisor', label: 'مراجعة مشرف المنح', who: 'مشرف المنح', note: 'مقارنة المعتمد بالتنفيذ الفعلي', cycle: 'report' },
  { key: 'comms', label: 'مراجعة الاتصال المؤسسي', who: 'إدارة الاتصال المؤسسي', note: 'التحقّق من النشر الإعلامي · قاعدة 9', cycle: 'report' },
  { key: 'manager', label: 'اعتماد مدير المنح', who: 'مدير المنح', note: 'قرار اعتماد أو إعادة بملاحظات', cycle: 'report' },
  { key: 'executive', label: 'اعتماد المدير التنفيذي', who: 'المدير التنفيذي', note: 'اعتماده بيقفل دورة التقرير', cycle: 'report' },
  { key: 'reportDone', label: 'التقرير معتمد', who: 'مشرف المنح', note: 'التقييم يقدر يبدأ · قاعدة 6', cycle: 'eval' },
  { key: 'evalDraft', label: 'إعداد التقييم', who: 'مشرف المنح', note: 'الأثر والمؤشرات والدروس المستفادة', cycle: 'eval' },
  { key: 'evalManager', label: 'التقييم عند مدير المنح', who: 'مدير المنح', note: 'دورة اعتماد مستقلّة · قاعدة 17', cycle: 'eval' },
  { key: 'evalExecutive', label: 'التقييم عند المدير التنفيذي', who: 'المدير التنفيذي', note: 'آخر اعتماد قبل الإغلاق', cycle: 'eval' },
  { key: 'closed', label: 'مغلق · مكتمل', who: '', note: 'التقرير والتقييم والمتطلبات كلها اكتملت', cycle: 'eval' },
  { key: 'returned', label: 'مُعاد بملاحظات', who: 'حسب الإعادة', note: 'إصدار جديد بعد التعديل · قاعدة 19', cycle: 'report' },
]

export const closeStageLabel = (s: CloseStage): string =>
  CLOSE_STAGES.find((x) => x.key === s)?.label ?? s

export const closeStageWho = (s: CloseStage): string =>
  CLOSE_STAGES.find((x) => x.key === s)?.who ?? ''

export const closeStageNote = (s: CloseStage): string =>
  CLOSE_STAGES.find((x) => x.key === s)?.note ?? ''

/**
 * نبرة الوسم · **مكتوبة مرة واحدة** زي `AGR_TONE` و`PLAN_TONE`.
 *
 * ⚠️ كل شاشة كانت بتختار نبرتها بنفسها في الاتفاقيات، فنفس
 * المرحلة أخدت لونًا هنا ولونًا هناك · الدرس اتسجّل هناك والنبرة
 * بقت في الداتا.
 */
export const CLOSE_TONE: Record<CloseStage, 'mute' | 'warn' | 'ret' | 'ok' | 'no' | 'teal'> = {
  draft: 'mute',
  supervisor: 'ret',
  comms: 'ret',
  manager: 'ret',
  executive: 'ret',
  reportDone: 'teal',
  evalDraft: 'ret',
  evalManager: 'ret',
  evalExecutive: 'ret',
  closed: 'ok',
  returned: 'warn',
}

/**
 * حدّ المحطة بالساعات · مؤقت زي كل مدة في السيستم.
 *
 * ⚠️ **الأرقام دي مش من الوثيقة** · الوثيقة بتقيس «متوسط مدة
 * إغلاق المشروع» (مؤشر 1) وما بتحطّش حدًّا لكل محطة. الأرقام هنا
 * مشتقّة من حدود المراحل الموجودة في `taxonomy` عشان شرائح
 * التأخير تشتغل · **والسؤال س-18 مفتوح عند العميل**.
 */
export const CLOSE_LIMIT: Record<CloseStage, number> = {
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
}

/** المستندات الداعمة للتقرير الختامي · قاعدة 5 */
export const CLOSE_DOCS: { key: string; label: string; req?: boolean }[] = [
  { key: 'final', label: 'التقرير الختامي التفصيلي', req: true },
  { key: 'photos', label: 'صور التنفيذ', req: true },
  { key: 'invoices', label: 'الفواتير والمستندات المالية', req: true },
  { key: 'media', label: 'المواد الإعلامية' },
  { key: 'handover', label: 'محاضر الاستلام' },
  { key: 'beneficiaries', label: 'كشف المستفيدين' },
]

/* ═══════════════════════════════════════════════════════════
   الموانع · اللي النظام بيرفض الإرسال بسببه
   ═══════════════════════════════════════════════════════════ */

/**
 * هل نقدر نفتح إغلاقًا للمشروع ده أصلًا؟
 *
 * ⚠️ **قاعدتان مع بعض لا واحدة:**
 *   قاعدة 1 · المدة خلصت، أو الأنشطة اكتملت، أو فيه قرار إنهاء.
 *   قاعدة 2 · **كل الدفعات اتصرفت أو الالتزامات اتسوّت.**
 *
 * والتانية هي اللي بتتنسى: مشروع لسه عليه دفعة ما اتصرفتش
 * ما ينفعش يبدأ إغلاقه · وإلا بنقفل مشروعًا وإحنا مدينين له.
 */
export const canOpenClose = (projectId: string): { ok: boolean; why: string } => {
  const pr = projectRows.find((p) => p.id === projectId)
  if (!pr) return { ok: false, why: 'مشروع غير معروف' }

  /* قاعدة 1 · الخطة مكتملة = الأنشطة اكتملت */
  const plan = planOfProject(projectId)
  const activitiesDone = plan ? planDone(plan) >= 100 : false
  if (plan && !activitiesDone) {
    return { ok: false, why: 'الخطة لسه ما اكتملتش · قاعدة 1' }
  }

  /* قاعدة 2 · مفيش دفعة مستحقّة ما اتصرفتش */
  const open = payRequests.filter(
    (r) => r.projectId === projectId && r.state !== 'paid' && r.state !== 'closed',
  )
  if (open.length > 0) {
    return { ok: false, why: `${open.length} دفعة لسه ما اتسوّتش · قاعدة 2` }
  }

  return { ok: true, why: 'المشروع مؤهَّل للإغلاق' }
}

/**
 * اللي مانع إرسال التقرير للمراجعة · قاعدة 3 و4 و10.
 *
 * ⚠️ **قاعدة 4 بتحدّد الحدّ الأدنى بالحرف**: «عدد المستفيدين
 * الفعلي، والميزانية الفعلية، ومدة التنفيذ، وأبرز المخرجات
 * والنتائج المحققة». الأربعة دول مش اختيارات.
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

/** اللي مانع إرسال التقييم · قاعدة 10 على الدورة التانية */
export const evalBlockers = (c: CloseRow): string[] => {
  const out: string[] = []
  const e = c.evaluation
  if (!e) return ['التقييم ما اتفتحش']
  if (e.indicators.some((i) => i.actual === null)) out.push('مؤشرات بلا قيمة متحقّقة')
  if (!e.impact.trim()) out.push('الأثر المرصود')
  if (!e.lessons.trim()) out.push('الدروس المستفادة')
  if (e.score === null) out.push('التقدير العام')
  return out
}

/**
 * التقييم يقدر يبدأ؟ · قاعدة 6.
 *
 * ⚠️ **بعد اعتماد المدير التنفيذي تحديدًا** · مش بعد المشرف ولا
 * المدير. والمحطة `reportDone` هي اللي بتقول إن الشرط ده اتحقّق.
 */
export const canStartEval = (c: CloseRow): boolean => c.stage === 'reportDone'

/**
 * محطة الاتصال المؤسسي مطلوبة؟ · قاعدة 9.
 *
 * ⚠️ **«متى كانت مطلوبة»** · يعني لو الاتفاقية فيها التزام نشر
 * إعلامي. واللي مش مطلوبة فيه المحطة **بتتقال إنها اتخطّت** لا
 * بتختفي · الغياب مش إجابة (نفس قاعدة الكروت والمساعد).
 */
export const needsComms = (c: CloseRow): boolean => c.mediaRequired

/** الدورة اللي إحنا فيها دلوقتي */
export const closeCycle = (c: CloseRow): CloseCycle =>
  CLOSE_STAGES.find((x) => x.key === c.stage)?.cycle ?? 'report'

/** التقرير اتعتمد؟ · أي محطة بعد التنفيذي */
export const reportApproved = (c: CloseRow): boolean =>
  ['reportDone', 'evalDraft', 'evalManager', 'evalExecutive', 'closed'].includes(c.stage)

/** التقييم اتعتمد؟ */
export const evalApproved = (c: CloseRow): boolean => c.stage === 'closed'

/**
 * المتطلبات المالية والإدارية اكتملت؟ · قاعدة 8 و18.
 *
 * ⚠️ **السؤال س-15 مفتوح** · الوثيقة بتقول «استكمال جميع
 * المتطلبات المالية والإدارية» وما بتعدّدهاش. اللي محسوب هنا
 * هو اللي السيستم يعرفه فعلًا: مفيش دفعة معلّقة. وأي متطلب
 * تاني هيتزوّد لمّا العميل يحدّده.
 */
export const closeRequirements = (c: CloseRow): { ok: boolean; say: string } => {
  const open = payRequests.filter(
    (r) => r.projectId === c.projectId && r.state !== 'paid' && r.state !== 'closed',
  )
  if (open.length > 0) return { ok: false, say: `${open.length} دفعة معلّقة` }
  return { ok: true, say: 'مفيش التزام مالي معلّق' }
}

/** متأخّر عن حدّ محطته؟ */
export const closeLate = (c: CloseRow): boolean =>
  CLOSE_LIMIT[c.stage] > 0 && c.hoursInStage > CLOSE_LIMIT[c.stage]

/**
 * الفرق بين المعتمد والفعلي · وده **قلب المراجعة**.
 *
 * ⚠️ الرقم لوحده ما بيقولش حاجة · «٨٠٠ مستفيد» مش معلومة، و«٨٠٠
 * مقابل ١٠٠٠ مخطَّط» معلومة. فالدالة بترجّع الاتنين والفرق.
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

/* ═══════════════════════════════════════════════════════════
   البذور · ست حالات مختلفة فعلًا لا نسخ
   ═══════════════════════════════════════════════════════════ */

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
  /* ١ · عند الجهة · لسه ما بعتتش وناقصها الحدّ الأدنى */
  row('CL-2041', '20852', 'draft', {
    report: mkReport({
      beneficiaries: 780,
      outcomes: 'اتنفّذت ٤٢ جلسة من ٤٨ · والباقي اتأجّل لظروف المقر.',
      docs: ['final', 'photos'],
    }),
    hoursInStage: 800,
    mediaRequired: true,
  }),

  /* ٢ · عند مشرف المنح · مكتمل ومستنّي مراجعة */
  row('CL-2042', '20838', 'supervisor', {
    report: mkReport({
      beneficiaries: 1120,
      budget: 296_400,
      days: 214,
      outcomes: 'البرنامج اتنفّذ بالكامل · ١٢ فعالية و٣ ورش تدريبية.',
      risks: 'تأخّر التوريد شهرًا في المرحلة التانية.',
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

  /* ٣ · عند الاتصال المؤسسي · قاعدة 9 */
  row('CL-2043', '20824', 'comms', {
    report: mkReport({
      beneficiaries: 640,
      budget: 512_000,
      days: 180,
      outcomes: 'ترميم ثمانية مساجد وتسليمها للجهة المشغّلة.',
      risks: 'مسجدان احتاجوا أعمالًا إنشائية زيادة.',
      docs: ['final', 'photos', 'invoices', 'media', 'handover'],
    }),
    hoursInStage: 400,
    mediaRequired: true,
    audit: [
      a('2026-08-01', 'حصة النملة', 'إنشاء طلب التقرير الختامي'),
      a('2026-09-01', 'جمعية العناية بالمساجد بالقصيم', 'إرسال التقرير الختامي'),
      a('2026-09-09', 'حصة النملة', 'اعتماد مشرف المنح · إحالة للاتصال المؤسسي'),
    ],
  }),

  /* ٤ · مُعاد بملاحظات · إصدار تاني · قاعدة 19 */
  row('CL-2044', '20866', 'returned', {
    returnedTo: 'draft',
    note: 'الفواتير المرفوعة بتغطّي ٦٠٪ من الميزانية الفعلية المكتوبة · الفرق محتاج مستندات.',
    report: mkReport({
      beneficiaries: 410,
      budget: 338_000,
      days: 160,
      outcomes: 'الدورات القرآنية الموسمية اتنفّذت في ستة مراكز.',
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

  /* ٥ · التقرير اتعتمد والتقييم في الاعتماد · قاعدة 6 و17 */
  row('CL-2045', '20802', 'evalManager', {
    report: mkReport({
      beneficiaries: 2300,
      budget: 1_940_000,
      days: 330,
      outcomes: 'برنامج الاستدامة اتنفّذ لخمس جمعيات · ٣٦ ورشة و٥ خطط مالية.',
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
      impact: 'أربع جمعيات من خمسة بقى عندها خطة مالية معتمدة ومصدر دخل تاني.',
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
      a('2026-09-01', 'المدير التنفيذي', 'اعتماد التقرير الختامي · قفل الدورة الأولى'),
      a('2026-09-10', 'عمر قاسم', 'إرسال التقييم لمدير المنح'),
    ],
  }),

  /* ٦ · مغلق · مكتمل */
  row('CL-2046', '20611', 'closed', {
    report: mkReport({
      beneficiaries: 150,
      budget: 240_000,
      days: 200,
      outcomes: 'تأسيس الجمعية واستخراج ترخيصها وتشكيل مجلس إدارتها.',
      risks: 'مفيش.',
      docs: ['final', 'photos', 'invoices', 'handover'],
    }),
    evaluation: mkEval({
      indicators: [
        { name: 'ترخيص صادر', target: 1, actual: 1, unit: 'ترخيص' },
        { name: 'أعضاء مجلس الإدارة', target: 7, actual: 7, unit: 'عضو' },
        { name: 'نسبة اكتمال الحوكمة', target: 80, actual: 92, unit: '%' },
      ],
      impact: 'جمعية أهلية جديدة شغّالة في الخرج بمجلس مكتمل ولائحة معتمدة.',
      lessons: 'ربط الصرف بمراحل الترخيص قلّل التأخير لشهر واحد بدل تلاتة.',
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

export const closeById = (id: string): CloseRow | undefined =>
  closeRows.find((c) => c.id === id)

export const closeOfProject = (projectId: string): CloseRow | undefined =>
  closeRows.find((c) => c.projectId === projectId)

/* ═══════════════════════════════════════════════════════════
   الأفعال · كل واحد بيكتب في سجلّ التدقيق (قاعدة 11)
   ═══════════════════════════════════════════════════════════ */

const log = (c: CloseRow, by: string, what: string) => {
  c.audit.push({ at: TODAY, by, what })
}

/** مشرف المنح بيفتح طلب التقرير الختامي · خطوة 1 */
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

/** الجهة بتبعت التقرير · خطوة 5 · والنظام بيمنع لو ناقص (خطوة 6) */
export const sendReport = (c: CloseRow): void => {
  if (reportBlockers(c).length > 0) return
  c.stage = 'supervisor'
  c.hoursInStage = 0
  log(c, c.entityName, 'إرسال التقرير الختامي')
}

/**
 * إعادة بملاحظات · قاعدة 19.
 *
 * ⚠️ **الإعادة بتخلّي إصدارًا جديدًا** · والقديم بيفضل في السجلّ.
 */
export const returnReport = (c: CloseRow, by: string, say: string, to: CloseStage): void => {
  c.stage = 'returned'
  c.returnedTo = to
  c.note = say
  c.hoursInStage = 0
  c.versions.push(v(c.versions.length + 1, TODAY, by, `إعادة من ${by}`))
  log(c, by, `إعادة بملاحظات · إصدار ${c.versions.length}`)
}

/** اعتماد محطة في دورة التقرير · بيودّي للمحطة اللي بعدها */
export const approveReport = (c: CloseRow, by: string): void => {
  const next: Partial<Record<CloseStage, CloseStage>> = {
    /* ⚠️ الاتصال المؤسسي بيتخطّى لو النشر مش مطلوب · قاعدة 9 */
    supervisor: needsComms(c) ? 'comms' : 'manager',
    comms: 'manager',
    manager: 'executive',
    executive: 'reportDone',
  }
  const to = next[c.stage]
  if (!to) return
  c.stage = to
  c.hoursInStage = 0
  log(c, by, to === 'reportDone' ? 'اعتماد التقرير الختامي · قفل الدورة الأولى' : `اعتماد · إحالة لـ${closeStageLabel(to)}`)
}

/** مشرف المنح بيبدأ التقييم · قاعدة 6 */
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
  log(c, by, 'إرسال التقييم لمدير المنح')
}

export const approveEval = (c: CloseRow, by: string): void => {
  if (c.stage === 'evalManager') {
    c.stage = 'evalExecutive'
    c.hoursInStage = 0
    log(c, by, 'اعتماد التقييم · إحالة للمدير التنفيذي')
    return
  }
  if (c.stage !== 'evalExecutive') return
  /* ⚠️ **الإغلاق النهائي محتاج التلاتة** · قاعدة 8 و18 */
  if (!closeRequirements(c).ok) return
  c.stage = 'closed'
  c.closedAt = TODAY
  c.hoursInStage = 0
  log(c, by, 'اعتماد التقييم · الإغلاق النهائي')
}

/* ═══════════════════════════════════════════════════════════
   مؤشرات الأداء · 11.7 · أربعة
   ═══════════════════════════════════════════════════════════ */

/** المدة المستهدفة للإغلاق · مجموع حدود المحطات بالأيام */
export const CLOSE_TARGET_DAYS = Math.round(
  Object.values(CLOSE_LIMIT).reduce((s, h) => s + h, 0) / 24,
)

export const closeKpi = () => {
  const closed = closeRows.filter((c) => c.stage === 'closed')
  const open = closeRows.filter((c) => c.stage !== 'closed')

  /* مؤشر 1 · متوسط مدة الإغلاق · من فتح الطلب لحدّ الإغلاق */
  const days = closed.map((c) => {
    const from = new Date(c.openedAt).getTime()
    const to = new Date(c.closedAt ?? TODAY).getTime()
    return Math.round((to - from) / 86_400_000)
  })
  const avg = days.length > 0 ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : 0

  /* مؤشر 2 · نسبة اللي اتقفل ضمن المدة المستهدفة */
  const inTime = days.filter((d) => d <= CLOSE_TARGET_DAYS).length
  const inTimePct = closed.length > 0 ? Math.round((inTime / closed.length) * 100) : 0

  /* مؤشر 3 · متوسط مدة إعداد التقرير · من فتح الطلب لحدّ ما الجهة
     بعتته · وسطر «إرسال التقرير الختامي» في سجلّ التدقيق هو
     المصدر الوحيد للتاريخ ده (قاعدة 11 هي اللي بتخلّيه موجودًا) */
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

  /* مؤشر 4 · نسبة اللي اتقفل بعد استكمال المتطلبات */
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
