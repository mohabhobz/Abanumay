import type {
  Agreement, Attachment, Correspondence, FollowUp, FollowUpType, Minute, Payment, ProjectRow,
} from '@/types/domain'
import { nf } from '@/lib/format'
import { OWNERS } from './taxonomy'

/**
 * تفاصيل المشروع المشتقّة — الاتفاقية والدفعات والمتابعات والمراسلات.
 *
 * **ليه مولَّدة لا مكتوبة:** الفيكستشر المفصّل كان مشروعًا واحدًا،
 * فأي مشروع تاني الكلاينت يفتحه كان بيلاقي التابات دي فاضية —
 * مش لأن التصميم ناقص، لكن لأن الداتا مش موجودة. الملف ده بيبني
 * التفاصيل من الصف نفسه، فكل مشروع في النموذج بيبقى قابلًا للتجربة.
 *
 * **وليه مطابقة للنظام العامل:** كل حقل هنا اتقرا من مشاريع حقيقية
 * (`12940` · `20191` · `12935` · `14982` · `14552`) — أسماء الحقول
 * وقيم الحالات ودورة الاعتماد وأسماء القوالب العشرة، كلها من هناك.
 * راجع `Abanumay_Project_Tabs_Data.md`.
 *
 * **القاعدة الحاكمة:** التفاصيل بتتبع **مرحلة المشروع**. المشروع في
 * الدراسة مالوش اتفاقية ولا دفعات — زي النظام بالظبط. اللي بيوصل
 * للاتفاقية له اتفاقية بلا دفعات مصروفة. واللي في التشغيل له دفعات
 * بعضها مدفوع. والمكتمل له الدورة كلها. المعتذر عنه مالوش غير قرار.
 *
 * ⚠️ نموذج. لما الباك اند يجهز، الملف ده بيتشال وبتتحطّ مكانه
 * `GET /projects/:id/detail` بنفس الشكل.
 */

/* بذرة ثابتة من رقم المشروع: نفس المشروع بيدّي نفس التفاصيل في كل
   تحميل، وإلا الكلاينت هيفتح نفس الشاشة مرتين ويلاقي رقمين. */
const seeded = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return h / 0x100000000
  }
}

/** ترتيب المراحل — بيحدّد المشروع وصل فين */
const ORDER = [
  'استكمال بيانات المشروع',
  'دراسة المشروع',
  'اعتماد الإتفاقية',
  'اعتماد الإتفاقية الكترونيًا',
  'الإتفاقيات الورقية',
  'المشرف إذن الصرف',
  'إذن صرف معاد',
  'اصدار سند الصرف',
  'رفع سند القبض والقيد',
  'رفع تقرير مرحلي',
  'طلب التقرير الختامي',
  'رفع التقرير الختامي',
  'اعتماد التقرير الختامي',
  'تقييم المشروع',
  'مشروع مكتمل',
]

const reached = (row: ProjectRow, stage: string) => {
  if (row.statusGroup === 'مكتمل') return true
  if (row.statusGroup === 'معتذر عنه') return false
  const at = ORDER.indexOf(row.stage)
  const want = ORDER.indexOf(stage)
  return at >= 0 && want >= 0 && at >= want
}

/* ═══════════════ الاتفاقية ═══════════════ */

/**
 * القوالب العشرة كما هي في النظام (`config_contract`).
 * الاسم مش وصفًا: هو **مصفوفة ثلاثية** — مصدر التمويل × حجم المنحة ×
 * الظهور الإعلامي. فالقالب بيتحدد حسابيًا لا بقائمة منسدلة.
 */
export const CONTRACT_TEMPLATES = [
  '(زكاة) أقل من 100 ألف بدون ظهور إعلامي',
  '(زكاة) أقل من 100 ألف ظهور إعلامي',
  '(زكاة) مشروع خيري أكبر من 100 ألف بدون ظهور إعلامي',
  'أقل من 100 ألف بدون ظهور إعلامي',
  'أقل من 100 ألف ظهور إعلامي',
  'مشروع خيري أكبر من 100 ألف ظهور إعلامي',
  'مشروع خيري أكبر من 100 ألف بدون ظهور إعلامي',
  'نموذج تجاري بدون ظهور إعلامي',
  'نموذج تجاري ظهور إعلامي',
] as const

/** القالب محسوب من المبلغ والتمويل والظهور الإعلامي — زي النظام */
export const pickTemplate = (row: ProjectRow, media: boolean): string => {
  const big = (row.amountGranted || row.amountRequested) >= 100_000
  const zakat = row.funding === 'waqf'
  const seen = media ? 'ظهور إعلامي' : 'بدون ظهور إعلامي'
  if (zakat) {
    return big
      ? '(زكاة) مشروع خيري أكبر من 100 ألف بدون ظهور إعلامي'
      : `(زكاة) أقل من 100 ألف ${seen}`
  }
  return big ? `مشروع خيري أكبر من 100 ألف ${seen}` : `أقل من 100 ألف ${seen}`
}

/** خطوات اعتماد الاتفاقية — أربع محطات، آخرها الجهة */
export interface AgreementStep {
  role: string
  state: 'done' | 'now' | 'pending'
  at?: string
  note?: string
}

export interface AgreementDetail extends Agreement {
  template: string
  /** نص الاتفاقية المولَّد */
  body: AgreementClause[]
  steps: AgreementStep[]
  /** حلقة الإرجاع لو حصلت */
  returned?: { by: string; at: string; note: string }
}

export interface AgreementClause {
  title: string
  items: string[]
}

/* ═══════════════ الدفعات ═══════════════ */

export interface PaymentDetail extends Payment {
  /** شرط الصرف المكتوب في إذن الصرف — من ملاحظات المشرف */
  condition?: string
  /** التحويل تم عبر */
  via?: string
  /** الجهة رفعت سند القبض */
  receipt?: boolean
}

/* ═══════════════ الحصيلة ═══════════════ */

export interface ProjectDetail {
  agreement: AgreementDetail | null
  payments: PaymentDetail[]
  followUps: FollowUp[]
  messages: ThreadMessage[]
  minutes: Minute[]
  correspondence: Correspondence[]
  /** المرفقات المولَّدة من الإجراءات — مش من نموذج التقديم */
  actionFiles: Attachment[]
}

export interface ThreadMessage {
  /** اسم الموظف، أو «الجهة» */
  by: string
  from: 'staff' | 'entity'
  at: string
  body: string
}

const d = (base: Date, add: number) => {
  const x = new Date(base)
  x.setDate(x.getDate() + add)
  return `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`
}

/* `d/m/yyyy` ما تترتّبش كنص: «5/4/2025» بتيجي قبل «13/4/2025» أبجديًا
   وبعدها زمنيًا. الترتيب لازم يبقى على تاريخ حقيقي. */
const ts = (date: string) => {
  const [dd, mm, yy] = date.split('/').map(Number)
  return new Date(yy, mm - 1, dd).getTime()
}

const FOLLOW_TYPES: FollowUpType[] = [
  'التواصل مع الشريك', 'تحديث الاتفاقية', 'تحديث تقرير المشروع', 'منتج معرفي',
  'رفع صورة أو فيديو', 'زيارة ميدانية', 'مخاطبات', 'أخرى',
]

export function projectDetail(row: ProjectRow, entityName: string): ProjectDetail {
  const rnd = seeded(row.id)
  const start = new Date(row.submittedAt || '2026-01-15')
  const owner = row.owner ?? OWNERS[0]
  const finance = 'محمد المطيري'
  const grant = row.amountGranted || row.amountRequested
  const media = row.impact || grant >= 500_000

  /* ── الاتفاقية ── */
  const hasAgreement = reached(row, 'اعتماد الإتفاقية')
  const signed = reached(row, 'المشرف إذن الصرف')
  const paper = row.stage === 'الإتفاقيات الورقية'
  const returned = rnd() < 0.4

  const agreement: AgreementDetail | null = hasAgreement
    ? {
        /* السنة في الداتا `2025-f` (سنة + مصدر تمويل) — الرقم
           المعروض ياخد السنة بس، زي كود المشروع. */
        no: `AG-${row.year.slice(0, 4)}-${row.id}`,
        kind: paper ? 'ورقية' : 'إلكترونية',
        status: signed ? 'موقّعة ونافذة' : 'بانتظار اعتماد الجهة',
        signedAt: signed ? d(start, 42) : undefined,
        template: pickTemplate(row, media),
        returned: returned
          ? {
              by: 'عبدالرحمن الهليل',
              at: d(start, 33),
              note: 'الاتفاقية فيها كلمات إنجليزية غير مفهومة، آمل النظر في الإشكال.',
            }
          : undefined,
        steps: [
          { role: 'مشرف المنح', state: 'done', at: d(start, 30), note: 'وَلّد الاتفاقية من القالب' },
          { role: 'مدير المنح', state: 'done', at: d(start, 35) },
          { role: 'القسم المالي', state: signed ? 'done' : 'now', at: signed ? d(start, 38) : undefined },
          { role: 'المدير التنفيذي', state: signed ? 'done' : 'pending', at: signed ? d(start, 40) : undefined },
          { role: entityName, state: signed ? 'done' : 'pending', at: signed ? d(start, 42) : undefined },
        ],
        body: contractBody(row, entityName, grant, media),
      }
    : null

  /* ── الدفعات ──
     عدد الدفعات من المبلغ زي النظام: الصغير دفعة، والكبير تلاتة. */
  const count = grant >= 500_000 ? 3 : grant >= 150_000 ? 2 : 1
  const split = count === 3 ? [0.5, 0.4, 0.1] : count === 2 ? [0.6, 0.4] : [1]
  const paidUpTo = !signed
    ? 0
    : row.statusGroup === 'مكتمل'
      ? count
      : Math.max(1, Math.min(count - 1, Math.round(rnd() * count) || 1))

  const CONDITIONS = [
    'صرف مباشر بعد توقيع الاتفاقية.',
    'حققت الجهة متطلب الدفعة: إنجاز 50% من الأنشطة (التقرير المرحلي).',
    'بعد اعتماد التقرير الختامي واستيفاء المخرجات.',
  ]

  const payments: PaymentDetail[] = signed
    ? split.map((f, i) => ({
        no: i + 1,
        amount: Math.round((grant * f) / 1000) * 1000,
        date: d(start, 45 + i * 120),
        status: i < paidUpTo ? 'مدفوع' : 'غير مدفوع',
        voucher: i < paidUpTo ? `SV-${row.year.slice(0, 4)}-${row.id}-${i + 1}` : undefined,
        condition: CONDITIONS[Math.min(i, CONDITIONS.length - 1)],
        via: i < paidUpTo ? 'حساب الجهة مباشر' : undefined,
        receipt: i < paidUpTo,
      }))
    : []

  /* ── المتابعات ──
     في النظام المتابعة بتوثّق **شرط الدفعة** غالبًا، وبتيجي قبل إذن
     الصرف بأيام. فالمولَّد هنا بيربطها بالدفعات لا بيرميها عشوائيًا. */
  const followUps: FollowUp[] = []
  if (hasAgreement) {
    followUps.push({
      type: 'أخرى',
      body: `كراسة مواصفات ${row.name}`,
      at: d(start, 26),
      by: owner,
      attachment: 'كراسة المواصفات.pdf',
    })
  }
  payments.slice(1, paidUpTo + 1).forEach((p, i) => {
    followUps.push({
      type: 'تحديث تقرير المشروع',
      body: `متطلب الدفعة ${p.no}: ${p.condition}`,
      at: d(start, 40 + (i + 1) * 118),
      by: owner,
      attachment: 'تقرير الإنجاز.pdf',
    })
  })
  if (row.fieldVisit) {
    followUps.push({
      type: 'زيارة ميدانية',
      body: `زيارة موقع التنفيذ في ${row.city} ومقابلة فريق المشروع.`,
      at: d(start, 150),
      by: owner,
      attachment: 'صور الزيارة.zip',
    })
  }
  if (row.hasKnowledgeProduct) {
    followUps.push({
      type: 'منتج معرفي',
      body: 'تسليم الدليل الإرشادي الناتج عن المشروع للاتصال المؤسسي.',
      at: d(start, 240),
      by: owner,
      attachment: 'الدليل.pdf',
    })
  }
  if (followUps.length === 0 && reached(row, 'دراسة المشروع')) {
    followUps.push({
      type: FOLLOW_TYPES[Math.floor(rnd() * FOLLOW_TYPES.length)],
      body: 'تواصل مع الجهة لاستيضاح بنود الموازنة التفصيلية.',
      at: d(start, 12),
      by: owner,
      attachment: undefined,
    })
  }
  followUps.sort((a, b) => ts(b.at) - ts(a.at))

  /* ── المراسلة ──
     في النظام دي قناة بتتفتح لما إجراء يتعطّل، مش تواصل عام —
     ٣٨ مشروعًا مفحوصًا فيهم ثريد واحد، وكله عن سند واحد اتعطّل. */
  const stuckOnEntity =
    row.stage === 'رفع سند القبض والقيد' ||
    row.stage === 'استكمال بيانات المشروع' ||
    row.stage === 'رفع التقرير الختامي' ||
    row.stage === 'رفع تقرير مرحلي'

  const messages: ThreadMessage[] = stuckOnEntity
    ? [
        {
          by: finance, from: 'staff', at: d(start, 60),
          body: `السلام عليكم، نأمل منكم ${
            row.stage === 'رفع سند القبض والقيد'
              ? 'رفع سند قبض المبلغ لاستكمال إجراءات سير المشروع'
              : row.stage === 'استكمال بيانات المشروع'
                ? 'استكمال بيانات المشروع وإرفاق الموازنة التفصيلية'
                : 'رفع التقرير المطلوب لاستكمال إجراءات سير المشروع'
          }.`,
        },
        {
          by: 'الجهة', from: 'entity', at: d(start, 73),
          body: 'وعليكم السلام ورحمة الله وبركاته، تم الإرفاق والملفات موجودة في خانة أرشيف المرفقات.',
        },
        {
          by: finance, from: 'staff', at: d(start, 87),
          body: `نأمل منكم تعديل اسم الجهة في المرفق إلى (${entityName}) حيث تم رفض المرفق السابق بسبب وجود اسم الجهة خطأ.`,
        },
      ]
    : []

  /* ── المحاضر ──
     في الأرشيف ١٤٩ محضرًا، اتنين بس مربوطين بمشروع. فالندرة مقصودة. */
  const minutes: Minute[] = row.impact && hasAgreement
    ? [{ no: String(20 + Math.floor(rnd() * 40)), date: d(start, 20), file: `عرض ${row.field} على اللجنة` }]
    : []

  /* ── الصادر والوارد ──
     صفر من ٢٧ قيدًا مربوط بمشروع في النظام العامل. بنسيبها فاضية
     عمدًا: عرض كيان ميّت كأنه شغّال بيضلّل الكلاينت. */
  const correspondence: Correspondence[] = []

  /* ── مرفقات الإجراءات ──
     المرفق في النظام عنوانه **اسم الإجراء** اللي ولّده. */
  const actionFiles: Attachment[] = []
  payments.forEach((p) => {
    if (p.status !== 'مدفوع') return
    actionFiles.push({ name: `صرف الدفعة ${p.no}`, uploaded: true, required: true })
    actionFiles.push({ name: `رفع سند القبض والقيد — الدفعة ${p.no}`, uploaded: true, required: true })
  })
  if (row.hasInterimReport) actionFiles.push({ name: 'رفع التقرير المرحلي', uploaded: true, required: true })
  if (row.hasFinalReport) actionFiles.push({ name: 'رفع التقرير الختامي', uploaded: true, required: true })

  return { agreement, payments, followUps, messages, minutes, correspondence, actionFiles }
}

/* ═══════════════ نص الاتفاقية ═══════════════ */

/**
 * النص المولَّد — مبني من نفس القالب اللي في النظام حرفيًّا، بمتغيّراته
 * معبّاة من الصف. البنود مش زينة: دي اللي الجهة بتوقّع عليها.
 */
function contractBody(
  row: ProjectRow, entityName: string, grant: number, media: boolean,
): AgreementClause[] {
  const out: AgreementClause[] = [
    {
      title: 'تلتزم المؤسسة',
      items: [
        'الإجابة على استفسارات الجهة الممنوحة ومخاطباتها خلال مدة أقصاها 5 أيام عمل من تاريخ الاستلام.',
        `منح ${entityName} مبلغًا وقدره (${nf.format(grant)}) ريال وفقًا لجدول الدفعات المرفق.`,
      ],
    },
    {
      title: 'تلتزم الجهة',
      items: [
        'اعتبار المخاطبات ومحاضر الاجتماعات اللاحقة المتعلقة بنطاق المشروع والمتفق عليها من الطرفين جزءًا من المشروع.',
        'الالتزام باستكمال متطلبات المشروع — في حال نقصها — الخطة التنفيذية والموازنة التفصيلية، والعمل وفقها.',
        'إنجاز أنشطة المشروع وتسليم مخرجاته وفق المواصفات المتفق عليها وفي الوقت المحدد.',
        'إفادة المؤسسة باستلام المبالغ فور استلام كل دفعة، وإثبات مبلغ الدعم ضمن التبرعات المقيدة في سجل الحسابات وباسم المشروع المدعوم.',
        'الالتزام بالقوانين والأنظمة واللوائح ومبادئ السلوك الوظيفي المعمول بها داخل المملكة، والمحافظة على حقوق الطرف الآخر فيما يتعلق بكتمان أسراره.',
        'الإجابة على استفسارات المؤسسة ومخاطباتها خلال مدة أقصاها 5 أيام عمل.',
        'إفادة المؤسسة بأي تغيّر في نطاق المشروع أو وقته أو تكاليفه، وللمؤسسة اتخاذ ما تراه مناسبًا.',
        'صرف مبلغ الدعم على المشروع المحدد في الاتفاقية، وإفادة المؤسسة في حال وجود فائض.',
        'رفع التقارير الدورية التي تفيد بتحديث حالة المشروع والأنشطة المنفذة ونتائجها.',
        'أخذ الموافقات والتصاريح على كافة أنشطة المشروع وتحمّل كامل المسؤولية عن أي مخالفات.',
      ],
    },
  ]

  if (media) {
    out.push({
      title: 'سياسة الظهور الإعلامي',
      items: [
        'إبراز شعار المؤسسة في جميع أنشطة المشروع.',
        'الإشارة لحساب المؤسسة في منصات التواصل.',
        'عدم الإشارة لمبلغ الدعم في مواقع التواصل الاجتماعي.',
        'نشر الخبر في صحيفة إلكترونية واحدة على الأقل (خاص بمشاريع الرعاية الكاملة).',
        'رفع 5 صور بدقة 1152×828 بكسل من خلال الصفحة المخصصة برفع التقارير.',
        'تقرير عن المشروع (مطبوع أو موشن جرافيك بدقة كاملة ومدة لا تزيد عن دقيقتين) يحتوي على: وصف المشروع وهدفه وفئته المستهدفة ومكان تنفيذه · إنجازاته وأثره · ميزانيته الكلية ومبلغ دعم المؤسسة · صور واقعية موضّح فيها شعار المؤسسة.',
      ],
    })
  }

  out.push({
    title: 'تعريف',
    items: [
      'المقصود بمصطلح «المؤسسة» في هذه الورقة هي مؤسسة سليمان أبانمي الأهلية.',
      `ومدة تنفيذ المشروع ${nf.format(row.durationDays)} يومًا من تاريخ صرف الدفعة الأولى.`,
    ],
  })

  return out
}

/* ═══════════════ مثال للعرض ═══════════════ */

/**
 * أول مشروع في النموذج فيه الحاجة دي فعلًا.
 *
 * التابات بتفضى حسب المرحلة — وده صح، النظام كده. لكن الكلاينت وهو
 * بيجرّب ممكن يفتح مشروعًا في الدراسة ويلاقي ثلاث تابات فاضية
 * ويفتكر التصميم ناقص. فالحالة الفارغة بتوديه لمشروع وصل للمرحلة
 * دي، بدل ما تسيبه يدوّر.
 */
export function exampleWith(
  rows: ProjectRow[],
  kind: 'agreement' | 'payments' | 'followUps' | 'messages',
  notId?: string,
): ProjectRow | undefined {
  return rows.find((r) => {
    if (r.id === notId) return false
    const dt = projectDetail(r, '')
    if (kind === 'agreement') return Boolean(dt.agreement)
    return dt[kind].length > 0
  })
}
