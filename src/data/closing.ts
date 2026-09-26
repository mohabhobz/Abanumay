import { projectRows } from './mock/projects'

/**
 * Closing report · **planned vs. actual**.
 *
 * This is the most important finding from reading `reports1_12` in the live system: the closing
 * report has 18 columns and 976 rows, four of which appear nowhere else:
 *
 *   `actual project execution duration in days` · `actual beneficiary count`
 *   `actual project budget` · `actual project outputs`
 *
 * Meaning the Foundation **has** the gap between what an entity promised and what actually
 * happened, across 976 projects, and no screen computes it. The closing report is shown as a list
 * of attachments, not as a comparison.
 *
 * So these values are generated here with a deliberate bias: actual duration runs longer,
 * beneficiaries run lower, and budget comes close to what was approved. This is **not pessimism** —
 * it's the shape grants generally take, and the point is to show this question actually working.
 * Once the backend is ready, it's replaced with real values.
 *
 * Warning: a mock. `GET /reports/closing` with the same shape.
 */

export interface Closing {
  id: string
  name: string
  entityName: string
  track: string
  field: string
  goal: string
  region: string
  year: string
  /** Approved · planned */
  granted: number
  /** Actual project budget, from the closing report */
  actualBudget: number
  /** Planned duration in days */
  planDays: number
  /** Actual execution duration in days */
  actualDays: number
  /** Beneficiaries under contract */
  planBeneficiaries: number
  /** Actual beneficiary count */
  actualBeneficiaries: number
  /** Actual project outputs · free text from the entity */
  outputs: string
  /** Date the report was submitted */
  at: string
}

const seeded = (id: string) => {
  let h = 11
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return h / 0x100000000
  }
}

const OUTPUTS = [
  'نُفّذت الدورات كاملة وسُلّمت الأدلة، وتأخّر إصدار التقرير المصوَّر.',
  'تحقّقت المخرجات الأساسية، وأُلغي المخرج الرابع لتعذّر التزام الشريك.',
  'زادت المخرجات عن المتعاقد عليه بمخرَجين بلا تكلفة إضافية.',
  'نُفّذ المشروع في ثلاث مدن بدلًا من خمس بسبب تأخّر التصاريح.',
  'اكتملت المخرجات، وسُلّمت المنتجات المعرفية في موعدها.',
]

/** Projects that actually have a closing report · like the live system, this list is drawn only from those */
export const closingRows: Closing[] = projectRows
  .filter((p) => p.hasFinalReport && p.amountGranted > 0)
  .map((p) => {
    const rnd = seeded(p.id)
    const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))

    /* Duration runs longer for most projects and shorter for a few · the distribution isn't symmetric,
   which is exactly what makes the "average" meaningful. */
    const drift = rnd() < 0.72 ? int(5, 70) : -int(2, 25)
    const actualDays = Math.max(30, p.durationDays + drift)

    /* Beneficiaries usually come in below what was contracted */
    const bDrift = rnd() < 0.68 ? -int(3, 35) : int(2, 20)
    const actualBeneficiaries = Math.max(
      1,
      Math.round(p.beneficiaries * (1 + bDrift / 100)),
    )

    /* Actual budget comes close to what was approved and slightly under it · that shortfall is what the
   system calls a "surplus project." */
    const saving = rnd() < 0.35 ? int(1, 12) / 100 : 0
    const actualBudget = Math.round(p.amountGranted * (1 - saving))

    return {
      id: p.id,
      name: p.name,
      entityName: p.entityName,
      track: p.track,
      field: p.field,
      goal: p.goal,
      region: p.region,
      year: p.year,
      granted: p.amountGranted,
      actualBudget,
      planDays: p.durationDays,
      actualDays,
      planBeneficiaries: p.beneficiaries,
      actualBeneficiaries,
      outputs: OUTPUTS[Math.floor(rnd() * OUTPUTS.length)],
      at: p.decidedAt ?? p.submittedAt,
    }
  })

export interface Gap {
  /** Average deviation as a percentage · positive means over the plan */
  days: number
  beneficiaries: number
  budget: number
  /** How many projects exceeded their planned duration */
  lateCount: number
  /** How many projects reached the contracted beneficiary count */
  metTarget: number
  total: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** The gap between planned and actual across a set of closing reports */
export const gapOf = (rows: Closing[]): Gap => ({
  days: Math.round(avg(rows.map((r) => ((r.actualDays - r.planDays) / r.planDays) * 100))),
  beneficiaries: Math.round(
    avg(rows.map((r) => ((r.actualBeneficiaries - r.planBeneficiaries) / r.planBeneficiaries) * 100)),
  ),
  budget: Math.round(avg(rows.map((r) => ((r.actualBudget - r.granted) / r.granted) * 100))),
  lateCount: rows.filter((r) => r.actualDays > r.planDays).length,
  metTarget: rows.filter((r) => r.actualBeneficiaries >= r.planBeneficiaries).length,
  total: rows.length,
})

/* Knowledge */

/**
 * Knowledge report · and what checking it in the live system found.
 *
 * 946 entries, of two kinds: "lessons learned" (824) and "rejection" (122). Measuring text length
 * showed: **440 entries with three characters or fewer** (mostly a single dot), 318 under forty
 * characters, and **only 188 with an actual lesson written**.
 *
 * Meaning 80% of the knowledge field gets filled in just to get past a required field. That number
 * is the point: the problem isn't that the field is missing, it's that it's **required with no
 * value returned to whoever fills it in**. The list below mirrors this distribution.
 */
export type KnowledgeKind = 'دروس مستفادة' | 'رفض'

export interface Knowledge {
  id: string
  projectId: string
  projectName: string
  entityName: string
  region: string
  track: string
  field: string
  goal: string
  owner: string
  at: string
  granted: number
  spent: number
  kind: KnowledgeKind
  text: string
  /** Effectively empty · a dot or two characters */
  empty: boolean
  /** Has an actual lesson written · forty characters or more */
  real: boolean
}

const LESSONS = [
  'اعتُمد دعم المشروع في منتصف السنة دون اجتماع تمهيدي مع الجهة. الدرس: تحتاج المشاريع متعددة المخرجات إلى اجتماع قبل الاعتماد لا بعده.',
  'تأخّر المشروع لأن الجهة اعتمدت على شريك واحد للتنفيذ. الدرس: اشتراط بديل معتمد في الاتفاقية للمشاريع التي ينفّذها طرف ثالث.',
  'عدد المستفيدين الفعلي أقل من المتعاقد عليه بالثلث لأن التقدير بُني على قوائم قديمة. الدرس: طلب مصدر التقدير ضمن طلب المشروع.',
  'اكتمل المشروع قبل موعده بشهر لأن الجهة بدأت التجهيز قبل توقيع الاتفاقية. الدرس: الممارسة قابلة للتعميم على أن تتحمّل الجهة المخاطرة.',
  'صُرفت الدفعة الأولى قبل اكتمال ملف الجهة، فتعطّلت الثانية أربعة أشهر. الدرس: ربط الصرف باكتمال الملف لا بتاريخ التوقيع.',
]

const REJECTS = [
  'الفكرة مكرّرة للجهة نفسها في الهدف نفسه خلال أقل من سنة.',
  'الموازنة المرفوعة صورة ممسوحة لا تُقرأ آليًا ولم تُستكمل بعد الطلب.',
  'الجهة لديها مشروع متعثّر لم يُغلق، والاعتماد الجديد يزيد الحمل.',
  'تكلفة المستفيد أعلى من متوسط المسار بأكثر من الضعف بلا مبرر.',
]

export const knowledgeRows: Knowledge[] = projectRows
  .filter((p) => p.hasKnowledgeProduct || p.supportStatus === 'مرفوض' || p.hasFinalReport)
  .map((p, i) => {
    const rnd = seeded(`k${p.id}`)
    const kind: KnowledgeKind = p.supportStatus === 'مرفوض' ? 'رفض' : 'دروس مستفادة'
    const r = rnd()
    /* Same ratios as the live system: 46% empty, 34% short, 20% substantial */
    const text =
      r < 0.46 ? '.'
        : r < 0.8 ? (kind === 'رفض' ? 'غير مطابق' : 'لا يوجد')
          : kind === 'رفض'
            ? REJECTS[i % REJECTS.length]
            : LESSONS[i % LESSONS.length]
    return {
      id: `k-${p.id}`,
      projectId: p.id,
      projectName: p.name,
      entityName: p.entityName,
      region: p.region,
      track: p.track,
      field: p.field,
      goal: p.goal,
      owner: p.owner ?? 'بلا مالك',
      at: p.decidedAt ?? p.submittedAt,
      granted: p.amountGranted,
      spent: p.amountSpent,
      kind,
      text,
      empty: text.length <= 3,
      real: text.length >= 40,
    }
  })
