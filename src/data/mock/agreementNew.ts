import { agreements } from './agreements'
import { projectRows } from './projects'
import type { AgreementKind, AgreementPayment, ProjectRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   إنشاء الاتفاقية · BPD-008 · هـ-4 و هـ-5

   ⚠️ **الاتفاقية ما بتتعملش من الصندوق، بتتعمل لمشروع.** عشان كده
   مدخلها تاب «الاتفاقية» في صفحة المشروع لا زرار في ترويسة
   الصندوق · والصندوق بيجاوب «إيه اللي واقف عندي» (وده مكتوب في
   `AgreementsPage` عشان محدش يضيف زرارًا «للاتّساق»).

   ═══ القواعد اللي بتشكّل الشاشة ═══

   **قاعدة 1 · مفيش اتفاقية قبل اكتمال اعتماد المشروع** واستمرار حجز
   المخصص · فقايمة المشاريع مش كل المشاريع، هي **المؤهَّلة**.
   ⚠️ وغير المؤهَّل **بيفضل معروضًا ومعاه سببه** لا بيختفي · نفس
   درس ج-15: الاختفاء بيخلّي المستخدم يدوّر على مشروع مش لاقيه.

   **قاعدة 2 · مشروع واحد بالظبط** · حقل واحد لا قائمة متعددة.

   **قاعدة 3 · النوع بيتحدّد عند الإنشاء وما يتغيّرش** إلا بإصدار
   جديد · فالشاشة بتقول ده وقت الاختيار لا بعده.

   **خطوة 11 · قيمة الاتفاقية = المبلغ المحجوز في الميزانية** ·
   والفرق بينهم بيمنع الإرسال.

   **قاعدة 7 · جدول الدفعات جزء من الاتفاقية قبل إرسالها** لا ملحق
   بيها · فالمحرّر جوّه الشاشة لا في صفحة تانية.

   **قاعدة 8 · مجموع الدفعات = المنحة، والنسب = 100%** · وده
   **تحقّق لا تلخيص**: صفّ الإجمالي بيقول «مطابق» أو «الفرق كذا».
   ═══════════════════════════════════════════════════════════ */

/* ═══ النماذج المعتمدة · قاعدة 4 ═══
   عشرة في النظام العامل، والاسم نفسه بيقول قاعدة الاختيار:
   مصدر التمويل × حجم المنحة × الظهور الإعلامي. */
export const TEMPLATES = [
  'اتفاقية منحة عامة',
  'اتفاقية منحة كبرى (فوق مليون)',
  'اتفاقية منحة تشغيلية',
  'اتفاقية منحة بظهور إعلامي',
  'اتفاقية منحة متعددة السنوات',
  'اتفاقية شراكة استراتيجية',
] as const

export const KINDS: { key: AgreementKind; label: string; note: string }[] = [
  {
    key: 'إلكترونية',
    label: 'إلكترونية',
    note: 'بتتبنى على نموذج معتمد مسبقًا · والتوقيع من بوّابة الجهة (قاعدة 4)',
  },
  {
    key: 'ورقية',
    label: 'ورقية',
    note: 'لازم تُرفق موقّعة قبل التفعيل · شرط زيادة في التفعيل (قاعدة 16)',
  },
]

/* ═══ المشاريع المؤهَّلة · قاعدة 1 ═══ */
export interface ProjectOption {
  id: string
  name: string
  entityName: string
  amount: number
  /** السبب اللي بيمنع · فاضي يعني مؤهَّل */
  blocked: string
}

/**
 * المشروع اللي ليه اتفاقية ما ياخدش تانية · قاعدة 2.
 *
 * ⚠️ الملغاة ما بتتعدّش · قاعدة 26 بتقول إن الإلغاء ما بيحوّلش
 * المشروع لـ«تحت التنفيذ»، يعني المشروع بيرجع قابلًا لاتفاقية
 * جديدة · وإلا مشروع اتلغت اتفاقيته بيفضل مقفولًا للأبد.
 */
const hasAgreement = (id: string) =>
  agreements.some((a) => a.projectId === id && a.stage !== 'cancelled')

export const projectOptions = (): ProjectOption[] =>
  projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    entityName: p.entityName,
    amount: p.amountGranted,
    blocked:
      hasAgreement(p.id) ? 'له اتفاقية بالفعل'
        : p.amountGranted <= 0 ? 'ما اتحجزش له مخصص'
          : p.statusGroup === 'في الدراسة' ? 'لسه في الدراسة · الاعتماد ما اكتملش'
            : p.statusGroup === 'معتذر عنه' ? 'معتذر عنه'
              : '',
  }))

export const projectById = (id: string): ProjectRow | undefined =>
  projectRows.find((p) => p.id === id)

/* ═══════════════════════════════════════════════════════════
   جدول الدفعات · محرّر · هـ-5

   ⚠️ **المبلغ والنسبة وشان واحد لا اتنين.** لو المستخدم كتب
   الاتنين بإيده، هيقع في تناقض: دفعة مكتوب عليها 40% ومبلغها
   ربع المنحة · والشاشة ساعتها بتعرض غلطًا وبتسيبه يعدّي.
   فالنسبة **محسوبة** من المبلغ دايمًا، ومعروضة للقراية بس.
   ═══════════════════════════════════════════════════════════ */

export interface DraftPay {
  no: number
  amount: number
  dueAt: string
  requirement: string
}

/** جدول مبدئي · دفعتان بالنص · نقطة بداية بتتعدّل لا قيمة نهائية */
export const seedSchedule = (amount: number, from: string): DraftPay[] => {
  const half = Math.round(amount / 2)
  const later = (d: string, days: number) => {
    const t = new Date(d || new Date().toISOString().slice(0, 10))
    t.setDate(t.getDate() + days)
    return t.toISOString().slice(0, 10)
  }
  return [
    { no: 1, amount: half, dueAt: later(from, 14), requirement: 'توقيع الاتفاقية' },
    { no: 2, amount: amount - half, dueAt: later(from, 120), requirement: 'التقرير النهائي ومخرجات المشروع' },
  ]
}

export const scheduleTotal = (rows: DraftPay[]): number =>
  rows.reduce((a, r) => a + (r.amount || 0), 0)

/** نسبة الدفعة من المنحة · محسوبة لا مكتوبة */
export const shareOf = (amount: number, total: number): number =>
  total > 0 ? Math.round((amount / total) * 1000) / 10 : 0

export const toPayments = (rows: DraftPay[], amount: number): AgreementPayment[] =>
  rows.map((r) => ({
    no: r.no,
    amount: r.amount,
    share: shareOf(r.amount, amount),
    dueAt: r.dueAt,
    requirement: r.requirement || undefined,
  }))

/* ═══ التحقّق · القواعد اللي بتتقال قبل الإرسال ═══ */
export interface AgIssue { key: string; say: string; rule: string }

export const agreementIssues = (v: {
  projectId: string
  template: string
  kind: AgreementKind | ''
  signerName: string
  signerTitle: string
  rows: DraftPay[]
  amount: number
  reserved: number
}): AgIssue[] => {
  const out: AgIssue[] = []

  const opt = projectOptions().find((p) => p.id === v.projectId)
  if (opt?.blocked) {
    out.push({ key: 'project', say: `«${opt.name}» ${opt.blocked}.`, rule: 'قاعدة 1' })
  }

  /* خطوة 11 · القيمة لازم تساوي المحجوز · والفرق بيمنع الإرسال */
  if (v.projectId && v.amount !== v.reserved) {
    out.push({
      key: 'reserved',
      say: `قيمة الاتفاقية ${v.amount.toLocaleString('en-US')} والمحجوز في الميزانية ${v.reserved.toLocaleString('en-US')}.`,
      rule: 'خطوة 11',
    })
  }

  /* قاعدة 8 · المجموع = المنحة · تحقّق لا تلخيص */
  const total = scheduleTotal(v.rows)
  if (v.rows.length > 0 && v.amount > 0 && total !== v.amount) {
    const gap = v.amount - total
    out.push({
      key: 'sum',
      say: gap > 0
        ? `مجموع الدفعات ناقص ${gap.toLocaleString('en-US')} عن قيمة المنحة.`
        : `مجموع الدفعات زايد ${Math.abs(gap).toLocaleString('en-US')} عن قيمة المنحة.`,
      rule: 'قاعدة 8',
    })
  }

  if (v.rows.length === 0) {
    out.push({ key: 'empty', say: 'مفيش دفعات · الجدول جزء من الاتفاقية لا ملحق بيها.', rule: 'قاعدة 7' })
  }

  /* الدفعة بلا شرط استحقاق · المخرج الرابع بيقول «مرتبط بشروط
     الاستحقاق والإنجاز»، فدفعة بلا شرط بتخلّي الصرف بلا سبب */
  const noReq = v.rows.filter((r) => !r.requirement.trim()).map((r) => r.no)
  if (noReq.length) {
    out.push({
      key: 'req',
      say: `الدفعة ${noReq.join('، ')} بلا شرط استحقاق.`,
      rule: 'المخرج 4',
    })
  }

  /* التواريخ لازم تكون متصاعدة · دفعة تانية قبل الأولى بتقلب
     الجدول من خطة لقايمة */
  for (let i = 1; i < v.rows.length; i++) {
    const a = v.rows[i - 1], b = v.rows[i]
    if (a.dueAt && b.dueAt && b.dueAt < a.dueAt) {
      out.push({
        key: 'order',
        say: `تاريخ الدفعة ${b.no} قبل الدفعة ${a.no}.`,
        rule: 'ترتيب الجدول',
      })
      break
    }
  }

  if (!v.template) out.push({ key: 'template', say: 'النموذج ما اتحدّدش.', rule: 'قاعدة 4' })
  if (!v.kind) out.push({ key: 'kind', say: 'نوع الاتفاقية ما اتحدّدش.', rule: 'قاعدة 3' })
  if (!v.signerName.trim() || !v.signerTitle.trim()) {
    out.push({ key: 'signer', say: 'ممثل الجهة المخوّل بالتوقيع ناقص.', rule: 'المدخل 3' })
  }

  return out
}
