import type {
  AgreementEvent, AgreementKind, AgreementPayment, AgreementRow, AgreementStage,
} from '@/types/domain'
import { projectRows } from './projects'
import { entityById } from './entities'

/* Agreements · 28 steps and 26 rules

   Warning: **an agreement is a process independent of the project.** Rule 23 states this
   explicitly, and rule 25 explains its effect: the agreement moving between its stages **doesn't
   change the project's status** — the project stays at "drafting agreement" until final approval.
   So an agreement can be with the executive director while its project still shows "drafting
   agreement," and both are correct. That's why this module has its own inbox, log, and versions,
   rather than being a tab on the project page.

   === What was built from the document ===

   Four approval stages from the diagram (9.6): grants supervisor -> grants manager -> executive
   director -> beneficiary entity. Every stage has a send-back, and a send-back goes to a specific
   place in the document, not to the one before it: the executive director's send-back goes to **the
   grants manager** (step 18), and the entity's send-back goes to **the grants supervisor** (step
   22). Three different return paths, not one.

   === Difference from the live system · logged as a note ===

   The live system has **seven sections** for the agreement, including "agreement approval (finance
   department)" — an approval stage **that doesn't appear in the document's diagram at all**. The
   document goes straight from the grants manager to the executive director. This is the most
   important open question in this module, logged in `AGREEMENTS_MODULE_BRIEF.md`. */

export const AGREEMENT_STAGES: {
  key: AgreementStage; label: string; who: string; steps: string
}[] = [
  { key: 'draft', label: 'مسودة عند المشرف', who: 'مشرف المنح', steps: '3–11' },
  { key: 'manager', label: 'بانتظار مدير المنح', who: 'مدير المنح', steps: '12–13' },
  { key: 'executive', label: 'بانتظار المدير التنفيذي', who: 'المدير التنفيذي', steps: '16–17' },
  { key: 'entity', label: 'بانتظار توقيع الجهة', who: 'الجهة المستفيدة', steps: '20–21' },
  { key: 'returned', label: 'مُعادة للتعديل', who: 'مشرف المنح', steps: '14 · 18 · 22' },
  { key: 'active', label: 'سارية', who: '', steps: '24–28' },
]

export const agrStageLabel = (s: AgreementStage): string =>
  AGREEMENT_STAGES.find((x) => x.key === s)?.label ?? 'ملغاة'

export const agrStageWho = (s: AgreementStage): string =>
  AGREEMENT_STAGES.find((x) => x.key === s)?.who ?? ''

/**
 * Stage badge tone · **written once**.
 *
 * Warning: every screen used to pick its own tone (the inbox, the card, the table), so the same
 * stage got one color here and another there. The tone carries meaning: "sent back" is a warning,
 * "active" is good, and everything else is neutral waiting.
 */
export const AGR_TONE: Record<AgreementStage, 'mute' | 'warn' | 'ret' | 'ok' | 'no' | 'teal'> = {
  draft: 'mute',
  manager: 'teal',
  executive: 'teal',
  entity: 'teal',
  returned: 'warn',
  active: 'ok',
  /* Cancelled exists in the type · its badge is 'none,' like anything closed out */
  cancelled: 'no',
}

/**
 * Stage limit in hours · provisional like every duration in the system.
 * The document gives no duration per stage; the first indicator measures "average agreement
 * drafting time" and the target is **empty**, exactly like the disbursement indicators.
 */
export const AGR_LIMIT: Record<AgreementStage, number> = {
  draft: 168,
  manager: 96,
  executive: 96,
  entity: 240,
  returned: 120,
  active: 0,
  cancelled: 0,
}

export type AgrHeat = 'ok' | 'late' | 'stuck'

export const agrHeat = (a: AgreementRow): AgrHeat => {
  const lim = AGR_LIMIT[a.stage]
  if (!lim) return 'ok'
  if (a.hoursInStage > lim * 2) return 'stuck'
  if (a.hoursInStage > lim) return 'late'
  return 'ok'
}

/**
 * Rule 8 · disbursements must sum to the grant value, or their percentages must total 100% — the
 * system blocks submission for approval before that.
 */
export const agrPaymentsBalance = (a: AgreementRow): {
  sum: number; share: number; balanced: boolean
} => {
  const sum = a.payments.reduce((s, p) => s + p.amount, 0)
  const share = a.payments.reduce((s, p) => s + p.share, 0)
  return { sum, share, balanced: sum === a.amount && share === 100 }
}

/**
 * Step 11 · the agreement value must match the amount held in the budget, and the system blocks
 * submission if there's a mismatch.
 */
export const agrReserveGap = (a: AgreementRow): number => a.amount - a.reserved

/** Agreement blocked from submission · rule 8, step 11, or rule 9 */
export const agrBlocked = (a: AgreementRow): boolean =>
  !agrPaymentsBalance(a).balanced || agrReserveGap(a) !== 0 || a.docs.length === 0

/* Templates · 13 in the live system
   `config_contract` in the system has thirteen templates with an HTML editor. These names are
   derived from grant tracks and areas until the templates themselves are opened · logged as a note. */

export const AGREEMENT_TEMPLATES = [
  'اتفاقية منحة تشغيلية · نموذج عام',
  'اتفاقية منحة مشروع تعليمي',
  'اتفاقية منحة مشروع صحي',
  'اتفاقية منحة مشروع إغاثي',
  'اتفاقية منحة بناء وترميم',
  'اتفاقية منحة تمكين وتأهيل',
  'اتفاقية منحة بحثية',
  'اتفاقية منحة متعددة السنوات',
  'اتفاقية منحة وقفية',
  'اتفاقية شراكة تشغيلية',
  'اتفاقية منحة طارئة',
  'اتفاقية منحة مشتركة بين جهتين',
  'ملحق تعديل اتفاقية',
]

const REQUIREMENTS = [
  'توقيع الاتفاقية واستلام سند التعهّد',
  'رفع التقرير المرحلي الأول',
  'اكتمال المرحلة الأولى من خطة التنفيذ',
  'تسليم كشف المستفيدين المسجَّلين',
  'رفع التقرير الختامي واعتماده',
]

const AI_NOTES = [
  'بنود الاتفاقية متوافقة مع خطة التنفيذ، ولا تعارض بينهما',
  'جدول الدفعات لا يغطّي المرحلة الثالثة في خطة التنفيذ',
  'بند المتابعة مكرّر في القسمين الرابع والسادس',
  'مدة التنفيذ في الاتفاقية أقصر من مدة خطة المشروع بشهر',
  'النموذج المقترح لهذا المجال هو «اتفاقية منحة تمكين وتأهيل»',
  'شرط الدفعة الأخيرة غير مرتبط بمخرج محدّد',
]

const RETURN_NOTES = [
  'جدول الدفعات لا يطابق خطة التنفيذ. راجع تواريخ الاستحقاق',
  'بند الالتزامات ناقص، ويلزم إضافة آلية المتابعة',
  'قيمة الاتفاقية أعلى من المخصص المحجوز في الميزانية',
  'بيانات ممثل الجهة المخوّل بالتوقيع غير محدَّثة في ملف الجهة',
]

const SIGNER_TITLES = ['الرئيس التنفيذي', 'المدير التنفيذي', 'رئيس مجلس الإدارة', 'المدير العام']
const SIGNERS = ['خالد الزهراني', 'منى العتيبي', 'سعد القحطاني', 'نورة الحربي', 'ماجد الشهري']

/* A fixed generator · same data on every run */
let seed = 4409
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T,>(a: readonly T[]): T => a[int(0, a.length - 1)] as T

const dayAfter = (iso: string, n: number): string => {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/* Warning: **the ratios come from the document's diagram, and the count comes from the projects
   that exist.** Rule 2: every agreement has one project, and rule 24: one active agreement per
   project — so the number of agreements is capped by the number of projects that passed approval,
   not by a chosen figure. The same lesson learned in disbursements when 72 got crammed into a
   smaller capacity. */
const MIX: { stage: AgreementStage; share: number }[] = [
  { stage: 'draft', share: 0.17 },
  { stage: 'manager', share: 0.13 },
  { stage: 'executive', share: 0.1 },
  { stage: 'entity', share: 0.13 },
  { stage: 'returned', share: 0.09 },
  { stage: 'active', share: 0.38 },
]

/** Rule 1 · no agreement before the project's approval is fully complete */
const eligible = projectRows.filter(
  (p) => p.statusGroup === 'في التشغيل' || p.statusGroup === 'مكتمل' || p.stage.includes('الإتفاقي'),
)

/** The steps each stage passes through · from the steps table itself */
const PASSED: Record<AgreementStage, number[]> = {
  draft: [1, 2, 3, 4, 5, 6, 7],
  manager: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  executive: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16],
  entity: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 20],
  returned: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  active: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 20, 21, 24, 25, 26, 28],
  cancelled: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
}

const STEP_SAY: Record<number, { role: string; what: string; notified?: string }> = {
  1: { role: 'النظام', what: 'أحال المشروع إلى مرحلة إعداد الاتفاقية بعد الاعتماد النهائي وتأكيد حجز المخصص' },
  2: { role: 'النظام', what: 'أشعر مشرف المنح ببدء إجراء الاتفاقية', notified: 'مشرف المنح · مشروع جاهز لإعداد الاتفاقية' },
  3: { role: 'مشرف المنح', what: 'أنشأ مسودة اتفاقية المنحة' },
  4: { role: 'مشرف المنح', what: 'حدّد طبيعة الاتفاقية' },
  5: { role: 'مشرف المنح', what: 'اختار النموذج المعتمد من قائمة النماذج' },
  6: { role: 'النظام', what: 'عرض نص الاتفاقية وأدرج بيانات المشروع والجهة والميزانية وخطة التنفيذ' },
  7: { role: 'الذكاء الاصطناعي', what: 'راجع البيانات المدرجة واقترح البنود المناسبة' },
  8: { role: 'مشرف المنح', what: 'استكمل البنود والشروط والالتزامات وآلية المتابعة' },
  9: { role: 'مشرف المنح', what: 'سجّل جدول صرف الدفعات ومتطلبات كل دفعة' },
  10: { role: 'النظام', what: 'تحقّق من أن مجموع الدفعات يساوي قيمة المنحة ومن توافق التواريخ مع خطة التنفيذ' },
  11: { role: 'النظام', what: 'تحقّق من اكتمال البيانات وتطابق قيمة الاتفاقية مع المبلغ المحجوز' },
  12: { role: 'النظام', what: 'أرسل المسودة إلى مدير المنح', notified: 'مدير المنح · اتفاقية بانتظار المراجعة' },
  13: { role: 'مدير المنح', what: 'راجع الاتفاقية واعتمدها' },
  14: { role: 'النظام', what: 'حدّث حالة الاتفاقية إلى «بانتظار التعديل» وأشعر مشرف المنح', notified: 'مشرف المنح · اتفاقية مُعادة للتعديل' },
  16: { role: 'النظام', what: 'أرسل الاتفاقية إلى المدير التنفيذي للاعتماد النهائي', notified: 'المدير التنفيذي · اتفاقية بانتظار الاعتماد' },
  17: { role: 'المدير التنفيذي', what: 'راجع الاتفاقية واعتمدها' },
  18: { role: 'النظام', what: 'أعاد الاتفاقية إلى مدير المنح مع حفظ سجل الاعتمادات', notified: 'مدير المنح · اتفاقية مُعادة من المدير التنفيذي' },
  20: { role: 'النظام', what: 'أرسل الاتفاقية إلى الجهة المستفيدة حسب نوعها', notified: 'الجهة المستفيدة · اتفاقية بانتظار التوقيع' },
  21: { role: 'الجهة المستفيدة', what: 'راجعت الاتفاقية ووقّعتها' },
  22: { role: 'النظام', what: 'أعاد الاتفاقية إلى مشرف المنح ووثّق أسباب الإعادة', notified: 'مشرف المنح · أعادت الجهة الاتفاقية بملاحظات' },
  24: { role: 'النظام', what: 'تحقّق من اكتمال الاعتمادات والتوقيعات واعتمد النسخة النهائية ومنع تعديلها' },
  25: { role: 'النظام', what: 'أرشف النسخة النهائية وملاحقها وربطها بالمشروع والميزانية وجدول الدفعات' },
  26: { role: 'النظام', what: 'فعّل الاتفاقية ومكّن إجراءات المتابعة وطلبات صرف الدفعات', notified: 'جميع الأطراف · الاتفاقية سارية' },
  28: { role: 'النظام', what: 'حوّل حالة المشروع إلى «تحت التنفيذ»' },
}

const DOC_KINDS = [
  { name: 'نص الاتفاقية.pdf', kind: 'اتفاقية' },
  { name: 'خطة التنفيذ.xlsx', kind: 'ملحق' },
  { name: 'جدول الدفعات.xlsx', kind: 'ملحق' },
  { name: 'تفويض ممثل الجهة.pdf', kind: 'تفويض' },
  { name: 'النسخة الموقّعة.pdf', kind: 'موقّعة' },
]

/**
 * A balanced disbursement schedule · rule 8 requires the total to equal the grant and percentages
 * to total 100
 */
function scheduleFor(amount: number, openedAt: string): AgreementPayment[] {
  const n = pick([2, 2, 3, 3, 4])
  const even = Math.round(amount / n / 1000) * 1000
  const evenShare = Math.floor(100 / n)
  return Array.from({ length: n }, (_, i) => {
    const last = i === n - 1
    return {
      no: i + 1,
      /* The last one takes the remainder · so the total equals the grant exactly rather than
         approximately, and percentages sum to 100, not 99 */
      amount: last ? amount - even * (n - 1) : even,
      share: last ? 100 - evenShare * (n - 1) : evenShare,
      dueAt: dayAfter(openedAt, 30 + i * 60),
      requirement: i === 0 ? REQUIREMENTS[0] : pick(REQUIREMENTS.slice(1)),
    }
  })
}

export const agreements: AgreementRow[] = (() => {
  const out: AgreementRow[] = []
  const capacity = eligible.length
  const PLAN = MIX.map((m) => ({ stage: m.stage, n: Math.floor(capacity * m.share) }))
  const spare = capacity - PLAN.reduce((s, x) => s + x.n, 0)
  if (PLAN[PLAN.length - 1]) PLAN[PLAN.length - 1]!.n += spare

  let n = 0
  for (const { stage, n: count } of PLAN) {
    for (let i = 0; i < count; i++) {
      const p = eligible[n]
      if (!p) break
      n++
      const e = entityById(p.entityId)
      const amount = p.amountGranted || p.amountRequested
      const openedAt = `2026-0${int(1, 6)}-${String(int(1, 28)).padStart(2, '0')}`
      /* Rule 3 · the type is set at creation · paper agreements are less common in the live system
         (2 vs 11 in the section inventory) */
      const kind: AgreementKind = rnd() > 0.82 ? 'ورقية' : 'إلكترونية'
      const lim = AGR_LIMIT[stage] || 168
      const h = rnd() > 0.74 ? int(lim + 1, lim * 3) : int(4, lim)
      /* Rule 24 · multiple versions · one sent back becomes version 2 */
      const version = stage === 'returned' ? 2 : rnd() > 0.82 ? 2 : 1
      /* Step 11 · a mismatch between the agreement value and the held amount blocks submission ·
         happens only in drafts, since ones past that stage were already validated */
      const gap = stage === 'draft' && rnd() > 0.78 ? int(5, 40) * 1000 : 0

      out.push({
        id: `AG-2026-${String(3100 + n).padStart(4, '0')}`,
        projectId: p.id,
        projectName: p.name,
        entityId: p.entityId,
        entityName: e?.name ?? p.entityName,
        kind,
        template: kind === 'ورقية' ? 'نسخة ورقية · خارج النماذج' : pick(AGREEMENT_TEMPLATES),
        stage,
        version,
        amount,
        reserved: amount - gap,
        payments: scheduleFor(amount, openedAt),
        signer: { name: pick(SIGNERS), title: pick(SIGNER_TITLES) },
        owner: p.owner ?? 'عمر قاسم',
        openedAt,
        hoursInStage: stage === 'active' ? 0 : h,
        note: stage === 'returned' ? pick(RETURN_NOTES) : undefined,
        ai: stage === 'active' ? undefined : pick(AI_NOTES),
        log: [],
        docs: [],
      })
    }
  }

  for (const a of out) {
    /* Attachments · the signed copy shows up only on active ones, and rule 16 requires the paper
       agreement to have the signed copy attached before activation */
    const base = DOC_KINDS.slice(0, a.stage === 'draft' ? 2 : 4)
    a.docs = (a.stage === 'active' ? [...base, DOC_KINDS[4]!] : base).map((d, i) => ({
      name: d.name,
      kind: d.kind,
      at: dayAfter(a.openedAt, i * 2),
      size: `${int(180, 5200)} ك.ب`,
    }))

    /* Log · human steps take days and system steps happen instantly · the same rule as the
       disbursement timeline */
    const HUMAN = new Set([3, 4, 5, 8, 9, 13, 17, 21])
    const offsets: number[] = []
    let cursor = 0
    for (const step of PASSED[a.stage]) {
      offsets.push(cursor)
      if (HUMAN.has(step)) cursor += int(1, 4)
    }

    a.log = PASSED[a.stage].map((step, i): AgreementEvent => {
      const say = STEP_SAY[step]!
      const who =
        say.role === 'مشرف المنح' ? a.owner
        : say.role === 'الجهة المستفيدة' ? a.entityName
        : say.role === 'مدير المنح' ? 'عبدالله الدوسري'
        : say.role === 'المدير التنفيذي' ? 'فهد العمري'
        : say.role
      /* Step 4 says "specify the agreement's nature" · the text shows the type actually chosen, not
         the generic phrasing */
      const what =
        step === 4 ? `حدّد طبيعة الاتفاقية · ${a.kind}`
        : step === 5 ? `اختار النموذج · ${a.template}`
        : step === 13 && a.stage === 'returned' ? 'أعاد الاتفاقية إلى مشرف المنح مع توضيح الملاحظات'
        : say.what
      return {
        at: dayAfter(a.openedAt, offsets[i] ?? 0),
        who,
        role: say.role,
        what,
        note: step === 14 ? a.note : undefined,
        step,
        notified: say.notified,
        version: step >= 14 && a.version > 1 ? a.version : 1,
      }
    })

    if (a.stage === 'active') a.activeAt = a.log[a.log.length - 1]?.at
  }

  return out
})()

export const agreementById = (id: string): AgreementRow | undefined =>
  agreements.find((a) => a.id === id)

export const agreementForProject = (projectId: string): AgreementRow | undefined =>
  agreements.find((a) => a.projectId === projectId)

/* Performance indicators · 9.7
   The four from the document, and **the target-value column is empty in all of them** — so the
   number is shown as a value, not a status, exactly like the disbursement indicators. */

/** Target duration for drafting the agreement · provisional until the Foundation sets it */
export const AGR_TARGET_DAYS = 21

const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export const agrKpi = () => {
  const open = agreements.filter((a) => a.stage !== 'active' && a.stage !== 'cancelled')
  const done = agreements.filter((a) => a.stage === 'active')
  /* Indicator 1 · from the project's referral to the agreement stage until approval */
  const prep = done
    .map((a) => (a.activeAt ? daysBetween(a.openedAt, a.activeAt) : null))
    .filter((x): x is number => x !== null && x >= 0)
  /* Indicator 3 · from sending the agreement for approval (step 12) until it's complete */
  const cycle = done
    .map((a) => {
      const sent = a.log.find((e) => e.step === 12)
      return sent && a.activeAt ? daysBetween(sent.at, a.activeAt) : null
    })
    .filter((x): x is number => x !== null && x >= 0)
  /* Indicator 4 · sent back for revision · a second version is evidence a send-back happened */
  const returned = agreements.filter((a) => a.stage === 'returned' || a.version > 1).length

  return {
    open: open.length,
    active: done.length,
    openSum: open.reduce((s, a) => s + a.amount, 0),
    /** Indicator 1 · average agreement drafting time (days) */
    prepDays: prep.length ? Math.round(prep.reduce((s, d) => s + d, 0) / prep.length) : 0,
    /** Indicator 2 · share completed within the target duration */
    inTarget: prep.length
      ? Math.round((prep.filter((d) => d <= AGR_TARGET_DAYS).length / prep.length) * 100)
      : 0,
    /** Indicator 3 · average approval cycle time */
    cycleDays: cycle.length ? Math.round(cycle.reduce((s, d) => s + d, 0) / cycle.length) : 0,
    /** Indicator 4 · share sent back for revision */
    returnedPct: agreements.length
      ? Math.round((returned / agreements.length) * 100)
      : 0,
    late: open.filter((a) => agrHeat(a) === 'late').length,
    stuck: open.filter((a) => agrHeat(a) === 'stuck').length,
    blocked: open.filter(agrBlocked).length,
  }
}
