import type {
  Agreement, Attachment, Correspondence, FollowUp, FollowUpType, Minute, Payment, ProjectRow,
} from '@/types/domain'
import { countOf, nf, NOUN } from '@/lib/format'
import { OWNERS } from './taxonomy'

/**
 * Derived project detail · agreement, disbursements, follow-ups, and correspondence.
 *
 * **Why generated, not hand-typed:** the detailed fixture was for one project only, so any other
 * project a client opened would find these tabs empty — not because the design is incomplete, but
 * because the data didn't exist. This file builds the detail from the row itself, so every project
 * in the mock becomes something you can actually try.
 *
 * **And why it matches the live system:** every field here was read from real projects (12940 ·
 * 20191 · 12935 · 14982 · 14552) — field names, status values, the approval cycle, and the ten
 * template names all come from there. See `Abanumay_Project_Tabs_Data.md`.
 *
 * **The governing rule:** the detail follows **the project's stage**. A project under review has no
 * agreement and no disbursements, exactly like the live system. One that's reached the agreement
 * stage has an agreement with no disbursements spent yet. One in progress has disbursements, some
 * paid. A completed one has the full cycle. A withdrawn one has nothing but a decision.
 *
 * Warning: a mock. Once the backend is ready, this file is removed and replaced with `GET
 * /projects/:id/detail` in the same shape.
 */

/* A seed fixed from the project number: the same project gives the same detail on every load,
   otherwise a client opening the same screen twice would see two different numbers. */
const seeded = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return h / 0x100000000
  }
}

/** Stage ordering · decides how far the project has gotten */
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

/* Agreement */

/**
 * The ten templates as they are in the system (`config_contract`). The name isn't descriptive —
 * it's a **three-way matrix**: funding source x grant size x publicity exposure. So the template is
 * determined computationally, not from a dropdown.
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

/** The template is computed from the amount, the funding, and publicity exposure · like the system */
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

/** Agreement approval steps · four stages, the last one being the entity */
export interface AgreementStep {
  role: string
  state: 'done' | 'now' | 'pending'
  at?: string
  note?: string
}

export interface AgreementDetail extends Agreement {
  template: string
  /** Generated agreement text */
  body: AgreementClause[]
  steps: AgreementStep[]
  /** The send-back link, if it happened */
  returned?: { by: string; at: string; note: string }
}

export interface AgreementClause {
  title: string
  items: string[]
}

/* Disbursements */

export interface PaymentDetail extends Payment {
  /** Disbursement condition written on the payment order · from the supervisor's notes */
  condition?: string
  /** Transfer made via */
  via?: string
  /** The entity uploaded the receipt voucher */
  receipt?: boolean
}

/* Outcome */

export interface ProjectDetail {
  /** Why the correspondence thread was opened · this channel doesn't open for no reason */
  threadWhy: string
  agreement: AgreementDetail | null
  payments: PaymentDetail[]
  followUps: FollowUp[]
  messages: ThreadMessage[]
  minutes: Minute[]
  correspondence: Correspondence[]
  /** Attachments generated from actions · not from the submission form */
  actionFiles: Attachment[]
}

export interface ThreadMessage {
  /** Employee name, or "the entity" */
  by: string
  from: 'staff' | 'entity'
  at: string
  body: string
}

const d = (base: Date, add: number) => {
  const x = new Date(base)
  x.setDate(x.getDate() + add)
  /* Warning: **ISO, not `d/m/yyyy`.** The raw format used to show up as-is in a card — "next
   disbursement 14/8/2025" next to "16 April 2025" in the table below it. The date is now stored as
   ISO and shown only through `<DateText>`. */
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/* Sorted by a real date, not by the text */
const ts = (date: string) => new Date(date).getTime()

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

  /* -- Agreement -- */
  const hasAgreement = reached(row, 'اعتماد الإتفاقية')
  const signed = reached(row, 'المشرف إذن الصرف')
  const paper = row.stage === 'الإتفاقيات الورقية'
  const returned = rnd() < 0.4

  const agreement: AgreementDetail | null = hasAgreement
    ? {
        /* The year in the data is `2025-f` (year + funding source) · the displayed number takes just the
   year, like the project code. */
        no: `AG-${row.year.slice(0, 4)}-${row.id}`,
        kind: paper ? 'ورقية' : 'إلكترونية',
        status: signed ? 'موقّعة ونافذة' : 'بانتظار اعتماد الجهة',
        signedAt: signed ? d(start, 42) : undefined,
        template: pickTemplate(row, media),
        returned: returned
          ? {
              by: 'عبدالرحمن الهليل',
              at: d(start, 33),
              note: 'في الاتفاقية كلمات إنجليزية غير مفهومة، نأمل معالجة ذلك.',
            }
          : undefined,
        steps: [
          { role: 'مشرف المنح', state: 'done', at: d(start, 30), note: 'أنشأ الاتفاقية من القالب' },
          { role: 'مدير المنح', state: 'done', at: d(start, 35) },
          { role: 'القسم المالي', state: signed ? 'done' : 'now', at: signed ? d(start, 38) : undefined },
          { role: 'المدير التنفيذي', state: signed ? 'done' : 'pending', at: signed ? d(start, 40) : undefined },
          { role: entityName, state: signed ? 'done' : 'pending', at: signed ? d(start, 42) : undefined },
        ],
        body: contractBody(row, entityName, grant, media),
      }
    : null

  /* -- Disbursements --
     Disbursement count is derived from the amount, like the system: small amounts get one, large
     ones get three. */
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

  /* -- Follow-ups --
     In the system a follow-up usually documents **a disbursement condition**, coming a few days
     before the payment order. So the generator here ties it to the disbursements rather than
     throwing it in at random. */
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
      body: 'تسليم الدليل الإرشادي الناتج عن المشروع إلى الاتصال المؤسسي.',
      at: d(start, 240),
      by: owner,
      attachment: 'الدليل.pdf',
    })
  }
  if (followUps.length === 0 && reached(row, 'دراسة المشروع')) {
    followUps.push({
      type: FOLLOW_TYPES[Math.floor(rnd() * FOLLOW_TYPES.length)],
      body: 'التواصل مع الجهة لاستيضاح بنود الموازنة التفصيلية.',
      at: d(start, 12),
      by: owner,
      attachment: undefined,
    })
  }
  followUps.sort((a, b) => ts(b.at) - ts(a.at))

  /* -- Correspondence --
     In the system this channel opens when a step stalls, not for general contact — out of 38
     projects checked, only one thread exists, and it's entirely about one voucher that stalled. */
  const STUCK: Record<string, string> = {
    'رفع سند القبض والقيد': 'رفع سند قبض المبلغ لاستكمال إجراءات سير المشروع',
    'استكمال بيانات المشروع': 'استكمال بيانات المشروع وإرفاق الموازنة التفصيلية',
    'رفع التقرير الختامي': 'رفع التقرير الختامي لاستكمال إجراءات إغلاق المشروع',
    'رفع تقرير مرحلي': 'رفع تقرير الإنجاز المرحلي',
  }
  /* The action currently pending with the entity, or a voucher from a spent disbursement · every
   thread read in the system was about an attachment from the entity that stalled. */
  const ask = STUCK[row.stage] ?? (paidUpTo > 0 ? 'رفع سند قبض الدفعة لاستكمال إجراءات الصرف' : null)
  const why = STUCK[row.stage]
    ? `الإجراء متوقف لدى الجهة في مرحلة «${row.stage}».`
    : 'فُتحت المراسلة عند الصرف: رُفض سند القبض مرة ثم عُدّل.'

  const messages: ThreadMessage[] = ask
    ? [
        {
          by: finance, from: 'staff', at: d(start, 60),
          body: `السلام عليكم، نأمل منكم ${ask}.`,
        },
        {
          by: 'الجهة', from: 'entity', at: d(start, 73),
          body: 'وعليكم السلام ورحمة الله وبركاته، أرفقنا الملفات، وهي في خانة أرشيف المرفقات.',
        },
        {
          by: finance, from: 'staff', at: d(start, 87),
          body: `نأمل تعديل اسم الجهة في المرفق إلى (${entityName})، فقد رُفض المرفق السابق لخطأ في اسم الجهة.`,
        },
        ...(row.statusGroup === 'مكتمل'
          ? [{
              by: 'الجهة' as const, from: 'entity' as const, at: d(start, 95),
              body: 'عدّلنا السند وأعدنا رفعه، جزاكم الله خيرًا.',
            }]
          : []),
      ]
    : []

  /* -- Minutes --
     The archive has 149 minutes, only two tied to a project. So the rarity is intentional. */
  const minutes: Minute[] = row.impact && hasAgreement
    ? [{ no: String(20 + Math.floor(rnd() * 40)), date: d(start, 20), file: `عرض ${row.field} على اللجنة` }]
    : []

  /* -- Correspondence log --
     Zero out of 27 entries tied to a project in the live system. Left empty on purpose: showing a
     dead entity as if it were active would mislead the client. */
  const correspondence: Correspondence[] = []

  /* -- Action attachments --
     An attachment's title in the system is **the name of the action** that generated it. */
  const actionFiles: Attachment[] = []
  payments.forEach((p) => {
    if (p.status !== 'مدفوع') return
    actionFiles.push({ name: `صرف الدفعة ${p.no}`, uploaded: true, required: true })
    actionFiles.push({ name: `رفع سند القبض والقيد، الدفعة ${p.no}`, uploaded: true, required: true })
  })
  if (row.hasInterimReport) actionFiles.push({ name: 'رفع التقرير المرحلي', uploaded: true, required: true })
  if (row.hasFinalReport) actionFiles.push({ name: 'رفع التقرير الختامي', uploaded: true, required: true })

  return { threadWhy: why, agreement, payments, followUps, messages, minutes, correspondence, actionFiles }
}

/* Agreement text */

/**
 * Generated text · built from the same template used in the system, verbatim, with its variables
 * filled from the row. The clauses aren't decoration — they're what the entity signs.
 */
function contractBody(
  row: ProjectRow, entityName: string, grant: number, media: boolean,
): AgreementClause[] {
  const out: AgreementClause[] = [
    {
      title: 'تلتزم المؤسسة',
      items: [
        'الإجابة على استفسارات الجهة الممنوحة ومخاطباتها خلال مدة أقصاها 5 أيام عمل من تاريخ الاستلام.',
        `منح ${entityName} مبلغًا وقدره (${nf.format(grant)}) ⃁ وفقًا لجدول الدفعات المرفق.`,
      ],
    },
    {
      title: 'تلتزم الجهة',
      items: [
        'اعتبار المخاطبات ومحاضر الاجتماعات اللاحقة المتعلقة بنطاق المشروع والمتفق عليها من الطرفين جزءًا من المشروع.',
        'الالتزام باستكمال متطلبات المشروع، في حال نقصها، الخطة التنفيذية والموازنة التفصيلية، والعمل وفقها.',
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
      `ومدة تنفيذ المشروع ${countOf(row.durationDays, NOUN.day)} من تاريخ صرف الدفعة الأولى.`,
    ],
  })

  return out
}

/* A display example */

/**
 * The first project in the mock actually has this.
 *
 * Tabs go empty depending on the stage, and that's correct, that's how the system behaves. But a
 * client trying it out might open a project under review and find three empty tabs and assume the
 * design is incomplete. So the empty state points them to a project that has reached that stage,
 * instead of leaving them to go looking.
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
