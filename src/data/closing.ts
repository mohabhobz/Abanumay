import { projectRows } from './mock/projects'

/**
 * التقرير الختامي — **المخطط مقابل الفعلي**.
 *
 * ده أهم اكتشاف من قراءة `reports1_12` في النظام العامل: التقرير
 * الختامي فيه ١٨ عمودًا و٩٧٦ صفًّا، وأربعة منهم مش موجودين في أي
 * شاشة تانية:
 *
 *   `مدة تنفيذ المشروع الفعلية بالأيام` · `عدد المستفيدين الفعلي`
 *   `موازنة المشروع الفعلية` · `مخرجات المشروع الفعلية`
 *
 * يعني المؤسسة **عندها** الفرق بين اللي وعدت بيه الجهة واللي حصل
 * فعلًا — على ٩٧٦ مشروعًا — وما فيش شاشة بتحسبه. التقرير الختامي
 * معروض كقايمة مرفقات لا كمقارنة.
 *
 * ولذلك القيم دي مولَّدة هنا بانحياز مقصود: المدة الفعلية بتطول،
 * والمستفيدون بيقلّوا، والموازنة بتقرب من المعتمد. ده **مش تشاؤمًا**
 * — ده الشكل اللي بيطلع في المنح عمومًا، والغرض إن الشاشة تورّي
 * السؤال ده شغّالًا. لما الباك اند يجهز بتتبدّل بالقيم الحقيقية.
 *
 * ⚠️ نموذج. `GET /reports/closing` بنفس الشكل.
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
  /** المعتمد — المخطط */
  granted: number
  /** موازنة المشروع الفعلية من التقرير الختامي */
  actualBudget: number
  /** المدة المخططة بالأيام */
  planDays: number
  /** مدة التنفيذ الفعلية بالأيام */
  actualDays: number
  /** المستفيدون في العقد */
  planBeneficiaries: number
  /** عدد المستفيدين الفعلي */
  actualBeneficiaries: number
  /** مخرجات المشروع الفعلية — نص من الجهة */
  outputs: string
  /** تاريخ رفع التقرير */
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
  'تحقّقت المخرجات الأساسية، وأُلغي المخرج الرابع لتعذّر الشريك.',
  'زادت المخرجات عن المتعاقد عليه بمخرَجين بلا تكلفة إضافية.',
  'نُفّذ المشروع في ثلاث مدن بدل خمس بسبب تأخّر التصاريح.',
  'اكتملت المخرجات، وسُلّمت المنتجات المعرفية في موعدها.',
]

/** مشاريع لها تقرير ختامي فعلًا — زي النظام، القايمة دي منها بس */
export const closingRows: Closing[] = projectRows
  .filter((p) => p.hasFinalReport && p.amountGranted > 0)
  .map((p) => {
    const rnd = seeded(p.id)
    const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))

    /* المدة بتطول في أغلب المشاريع وبتقصر في القليل — التوزيع مش
       متماثل، وده بالظبط اللي بيخلّي «المتوسط» يقول حاجة. */
    const drift = rnd() < 0.72 ? int(5, 70) : -int(2, 25)
    const actualDays = Math.max(30, p.durationDays + drift)

    /* المستفيدون بيقلّوا عن المتعاقد عليه في الغالب */
    const bDrift = rnd() < 0.68 ? -int(3, 35) : int(2, 20)
    const actualBeneficiaries = Math.max(
      1,
      Math.round(p.beneficiaries * (1 + bDrift / 100)),
    )

    /* الموازنة الفعلية بتقرب من المعتمد وبتقلّ عنه شويّة — الوفر
       ده هو «مشروع وفرة» في النظام. */
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
  /** متوسط الانحراف بالنسبة المئوية — موجب يعني زيادة عن المخطط */
  days: number
  beneficiaries: number
  budget: number
  /** كام مشروع تجاوز مدته المخططة */
  lateCount: number
  /** كام مشروع وصل لعدد المستفيدين المتعاقد عليه */
  metTarget: number
  total: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** الفجوة بين المخطط والفعلي على مجموعة تقارير ختامية */
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

/* ═══════════════════ المعرفة ═══════════════════ */

/**
 * تقرير المعرفة — ونتيجة فحصه في النظام العامل.
 *
 * ٩٤٦ قيدًا، نوعان: `دروس مستفادة` (٨٢٤) و`رفض` (١٢٢). وقياس طول
 * النصّ قال الآتي: **٤٤٠ قيدًا نصّهم ثلاثة أحرف أو أقل** (أغلبهم
 * نقطة واحدة)، و٣١٨ أقل من أربعين حرفًا، و**١٨٨ بس فيهم درس
 * مكتوب فعلًا**.
 *
 * يعني ٨٠٪ من حقل المعرفة بيتملّى عشان يعدّي حقلًا إلزاميًا. والرقم
 * ده هو الرسالة: المشكلة مش إن الحقل ناقص، المشكلة إنه **إلزامي بلا
 * قيمة راجعة لمن بيملاه**. القايمة اللي تحت بتحاكي التوزيع ده.
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
  /** فاضٍ فعليًا — نقطة أو حرفان */
  empty: boolean
  /** فيه درس مكتوب — أربعون حرفًا فأكثر */
  real: boolean
}

const LESSONS = [
  'كان دعم المشروع في منتصف السنة بلا اجتماع تمهيدي مع الجهة. الدرس: المشاريع ذات المخرجات المتعددة تحتاج اجتماعًا قبل الاعتماد لا بعده.',
  'تأخّر المشروع لأن الجهة اعتمدت على شريك واحد للتنفيذ. الدرس: اشتراط بديل معتمد في الاتفاقية للمشاريع اللي تنفيذها عند طرف ثالث.',
  'عدد المستفيدين الفعلي أقل من المتعاقد عليه بالثلث لأن التقدير بُني على قوائم قديمة. الدرس: طلب مصدر التقدير مع الطلب.',
  'المشروع اكتمل قبل موعده بشهر لأن الجهة بدأت التجهيز قبل توقيع الاتفاقية. الدرس: قابل للتعميم مع تحمّل الجهة للمخاطرة.',
  'صُرفت الدفعة الأولى قبل اكتمال ملف الجهة، فتعطّلت الثانية أربعة أشهر. الدرس: ربط الصرف باكتمال الملف لا بتاريخ التوقيع.',
]

const REJECTS = [
  'الفكرة مكرّرة لنفس الجهة في نفس الهدف خلال أقل من سنة.',
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
    /* نفس نسب النظام: ٤٦٪ فاضي · ٣٤٪ قصير · ٢٠٪ حقيقي */
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
      owner: p.owner ?? '—',
      at: p.decidedAt ?? p.submittedAt,
      granted: p.amountGranted,
      spent: p.amountSpent,
      kind,
      text,
      empty: text.length <= 3,
      real: text.length >= 40,
    }
  })
