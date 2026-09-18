import type {
  AgreementEvent, AgreementKind, AgreementPayment, AgreementRow, AgreementStage,
} from '@/types/domain'
import { projectRows } from './projects'
import { entityById } from './entities'

/* ═══════════════════════════════════════════════════════════
   الاتفاقيات · BPD-008 · 28 خطوة و26 قاعدة

   ⚠️ **الاتفاقية إجراء مستقل عن المشروع.** القاعدة 23 صريحة، والـ25
   بتشرح أثرها: انتقال الاتفاقية بين مراحلها **ما بيغيّرش حالة
   المشروع** · المشروع بيفضل «إعداد الاتفاقية» لحدّ الاعتماد النهائي.
   يعني اتفاقية عند المدير التنفيذي ومشروعها مكتوب عليه «إعداد
   الاتفاقية»، والاتنين صح. عشان كده الموديول ده له صندوقه وسجلّه
   وإصداراته، مش تابًا في صفحة المشروع.

   ═══ اللي اتبنى بالوثيقة ═══

   أربع محطات اعتماد من المخطط (9.6): مشرف المنح ← مدير المنح ←
   المدير التنفيذي ← الجهة المستفيدة. وكل محطة ليها إعادة، والإعادة
   بتروح لمكان محدّد في الوثيقة لا لواحدة قبلها: إعادة المدير
   التنفيذي بتروح **لمدير المنح** (خطوة 18)، وإعادة الجهة بتروح
   **لمشرف المنح** (خطوة 22). تلات مسارات رجوع مختلفة، مش واحد.

   ═══ الفرق عن النظام العامل · مسجَّل نوتة ═══

   النظام العامل فيه **سبعة أقسام** للاتفاقية، وفيها
   «اعتماد الإتفاقية (القسم المالي)» — محطة اعتماد **مش موجودة في
   مخطط الوثيقة خالص**. الوثيقة بتعدّي من مدير المنح للمدير التنفيذي
   مباشرة. ده أهم سؤال في الموديول ده، ومسجَّل في
   `AGREEMENTS_MODULE_BRIEF.md`.
   ═══════════════════════════════════════════════════════════ */

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
 * نبرة وسم المرحلة · **مكتوبة مرة واحدة**.
 *
 * ⚠️ كانت كل شاشة بتختار نبرتها بنفسها (الصندوق والكارت والجدول)
 * · فنفس المرحلة بتاخد لونًا هنا ولونًا هناك. والنبرة معلومة:
 * «مُعادة» تحذير، و«سارية» تمام، والباقي انتظار محايد.
 */
export const AGR_TONE: Record<AgreementStage, 'mute' | 'warn' | 'ret' | 'ok' | 'no' | 'teal'> = {
  draft: 'mute',
  manager: 'ret',
  executive: 'ret',
  entity: 'ret',
  returned: 'warn',
  active: 'ok',
  /* الملغاة موجودة في النوع · وسمها 'لا' زي أي حاجة اتقفلت */
  cancelled: 'no',
}

/**
 * حدّ المرحلة بالساعات · مؤقت زي كل مدة في السيستم.
 * الوثيقة ما دّتش مدة لكل محطة؛ المؤشر الأول بيقيس «متوسط مدة إعداد
 * الاتفاقية» والمستهدف **فاضي**، زي مؤشرات الصرف بالظبط.
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
 * قاعدة 8 · مجموع الدفعات لازم يساوي قيمة المنحة، أو مجموع النسب
 * يساوي 100% · والنظام بيمنع الإرسال للاعتماد قبل كده.
 */
export const agrPaymentsBalance = (a: AgreementRow): {
  sum: number; share: number; balanced: boolean
} => {
  const sum = a.payments.reduce((s, p) => s + p.amount, 0)
  const share = a.payments.reduce((s, p) => s + p.share, 0)
  return { sum, share, balanced: sum === a.amount && share === 100 }
}

/**
 * خطوة 11 · قيمة الاتفاقية لازم تطابق المبلغ المحجوز في الميزانية،
 * والنظام بيمنع الإرسال عند وجود فرق.
 */
export const agrReserveGap = (a: AgreementRow): number => a.amount - a.reserved

/** الاتفاقية مقفولة عن الإرسال · قاعدة 8 أو خطوة 11 أو قاعدة 9 */
export const agrBlocked = (a: AgreementRow): boolean =>
  !agrPaymentsBalance(a).balanced || agrReserveGap(a) !== 0 || a.docs.length === 0

/* ═══════════════ النماذج · 13 في النظام العامل ═══════════════
   `config_contract` في النظام فيه تلاتاشر نموذجًا بمحرر HTML.
   الأسماء دي مشتقّة من مسارات المنح ومجالاتها لحدّ ما نفتح النماذج
   نفسها · مسجَّل نوتة. */

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
  'بنود الاتفاقية متوافقة مع خطة التنفيذ · لا تعارض',
  'جدول الدفعات لا يغطّي المرحلة الثالثة في خطة التنفيذ',
  'بند المتابعة مكرّر في القسم الرابع والسادس',
  'مدة التنفيذ في الاتفاقية أقصر من خطة المشروع بشهر',
  'النموذج المقترح للمجال ده هو «اتفاقية منحة تمكين وتأهيل»',
  'شرط الدفعة الأخيرة غير مرتبط بمخرج محدّد',
]

const RETURN_NOTES = [
  'جدول الدفعات لا يطابق خطة التنفيذ · راجع تواريخ الاستحقاق',
  'بند الالتزامات ناقص · مطلوب إضافة آلية المتابعة',
  'قيمة الاتفاقية أعلى من المخصص المحجوز في الميزانية',
  'ممثل الجهة المخوّل بالتوقيع غير محدَّث في ملف الجهة',
]

const SIGNER_TITLES = ['الرئيس التنفيذي', 'المدير التنفيذي', 'رئيس مجلس الإدارة', 'المدير العام']
const SIGNERS = ['خالد الزهراني', 'منى العتيبي', 'سعد القحطاني', 'نورة الحربي', 'ماجد الشهري']

/* مولّد ثابت · نفس الداتا في كل تشغيلة */
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

/* ⚠️ **النسب من مخطط الوثيقة، والعدد من المشاريع الموجودة.**
   قاعدة 2: كل اتفاقية بمشروع واحد، وقاعدة 24: اتفاقية سارية واحدة
   للمشروع · فعدد الاتفاقيات مسقوف بعدد المشاريع اللي عدّت الاعتماد،
   لا برقم مختار. نفس الدرس اللي اتعلّمناه في الصرف لما 72 اتحشرت في
   سعة أقلّ منها. */
const MIX: { stage: AgreementStage; share: number }[] = [
  { stage: 'draft', share: 0.17 },
  { stage: 'manager', share: 0.13 },
  { stage: 'executive', share: 0.1 },
  { stage: 'entity', share: 0.13 },
  { stage: 'returned', share: 0.09 },
  { stage: 'active', share: 0.38 },
]

/** قاعدة 1 · مفيش اتفاقية قبل اكتمال اعتماد المشروع */
const eligible = projectRows.filter(
  (p) => p.statusGroup === 'في التشغيل' || p.statusGroup === 'مكتمل' || p.stage.includes('الإتفاقي'),
)

/** الخطوات اللي كل مرحلة بتعدّي عليها · من جدول الخطوات نفسه */
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
  1: { role: 'النظام', what: 'أحال المشروع لمرحلة إعداد الاتفاقية بعد الاعتماد النهائي وتأكيد حجز المخصص' },
  2: { role: 'النظام', what: 'أشعر مشرف المنح بالبدء في إجراء الاتفاقية', notified: 'مشرف المنح · مشروع جاهز للاتفاقية' },
  3: { role: 'مشرف المنح', what: 'أنشأ مسودة اتفاقية المنحة' },
  4: { role: 'مشرف المنح', what: 'حدّد طبيعة الاتفاقية' },
  5: { role: 'مشرف المنح', what: 'اختار النموذج المعتمد من قائمة النماذج' },
  6: { role: 'النظام', what: 'عرض نص الاتفاقية وعبّأ بيانات المشروع والجهة والميزانية وخطة التنفيذ' },
  7: { role: 'الذكاء الاصطناعي', what: 'راجع البيانات المدرجة واقترح البنود المناسبة' },
  8: { role: 'مشرف المنح', what: 'استكمل البنود والشروط والالتزامات وآلية المتابعة' },
  9: { role: 'مشرف المنح', what: 'سجّل جدول صرف الدفعات ومتطلبات كل دفعة' },
  10: { role: 'النظام', what: 'تحقّق من أن مجموع الدفعات يساوي قيمة المنحة ومن توافق التواريخ مع خطة التنفيذ' },
  11: { role: 'النظام', what: 'تحقّق من اكتمال البيانات وتطابق قيمة الاتفاقية مع المبلغ المحجوز' },
  12: { role: 'النظام', what: 'أحال المسودة لمدير المنح', notified: 'مدير المنح · اتفاقية بانتظار المراجعة' },
  13: { role: 'مدير المنح', what: 'راجع الاتفاقية واعتمدها' },
  14: { role: 'النظام', what: 'حدّث حالة الاتفاقية إلى بانتظار التعديل وأشعر المشرف', notified: 'مشرف المنح · اتفاقية معادة للتعديل' },
  16: { role: 'النظام', what: 'أحال الاتفاقية للمدير التنفيذي للاعتماد النهائي', notified: 'المدير التنفيذي · اتفاقية بانتظار الاعتماد' },
  17: { role: 'المدير التنفيذي', what: 'راجع الاتفاقية واعتمدها' },
  18: { role: 'النظام', what: 'أعاد الاتفاقية لمدير المنح مع حفظ سجل الاعتمادات', notified: 'مدير المنح · اتفاقية معادة من المدير التنفيذي' },
  20: { role: 'النظام', what: 'أرسل الاتفاقية للجهة المستفيدة وفق نوعها', notified: 'الجهة المستفيدة · اتفاقية بانتظار التوقيع' },
  21: { role: 'الجهة المستفيدة', what: 'راجعت الاتفاقية ووقّعتها' },
  22: { role: 'النظام', what: 'أعاد الاتفاقية لمشرف المنح ووثّق أسباب الإعادة', notified: 'مشرف المنح · الجهة أعادت الاتفاقية بملاحظات' },
  24: { role: 'النظام', what: 'تحقّق من اكتمال الاعتمادات والتوقيعات واعتمد النسخة النهائية ومنع تعديلها' },
  25: { role: 'النظام', what: 'أرشف النسخة النهائية وملاحقها وربطها بالمشروع والميزانية وجدول الدفعات' },
  26: { role: 'النظام', what: 'فعّل الاتفاقية ومكّن إجراءات المتابعة وطلبات صرف الدفعات', notified: 'جميع الأطراف · الاتفاقية مفعّلة' },
  28: { role: 'النظام', what: 'حوّل حالة المشروع إلى (تحت التنفيذ)' },
}

const DOC_KINDS = [
  { name: 'نص الاتفاقية.pdf', kind: 'اتفاقية' },
  { name: 'خطة التنفيذ.xlsx', kind: 'ملحق' },
  { name: 'جدول الدفعات.xlsx', kind: 'ملحق' },
  { name: 'تفويض ممثل الجهة.pdf', kind: 'تفويض' },
  { name: 'النسخة الموقّعة.pdf', kind: 'موقّعة' },
]

/** جدول دفعات متوازن · قاعدة 8 بتلزم المجموع بقيمة المنحة والنسب بـ100 */
function scheduleFor(amount: number, openedAt: string): AgreementPayment[] {
  const n = pick([2, 2, 3, 3, 4])
  const even = Math.round(amount / n / 1000) * 1000
  const evenShare = Math.floor(100 / n)
  return Array.from({ length: n }, (_, i) => {
    const last = i === n - 1
    return {
      no: i + 1,
      /* الأخيرة بتاخد الباقي · فالمجموع يساوي المنحة بالظبط لا
         يقاربها، والنِّسب تجمع 100 لا 99 */
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
      /* قاعدة 3 · النوع بيتحدد عند الإنشاء · الورقية أقلّ في النظام
         العامل (٢ مقابل ١١ في جرد الأقسام) */
      const kind: AgreementKind = rnd() > 0.82 ? 'ورقية' : 'إلكترونية'
      const lim = AGR_LIMIT[stage] || 168
      const h = rnd() > 0.74 ? int(lim + 1, lim * 3) : int(4, lim)
      /* قاعدة 24 · إصدارات متعددة · اللي اترجّع مرة بيبقى إصداره 2 */
      const version = stage === 'returned' ? 2 : rnd() > 0.82 ? 2 : 1
      /* خطوة 11 · فرق بين قيمة الاتفاقية والمحجوز بيمنع الإرسال ·
         بيحصل في المسودات بس، لأن اللي عدّاها اتحقّق منها */
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
    /* المرفقات · النسخة الموقّعة بتبان في السارية بس، والورقية
       قاعدة 16 بتلزمها بإرفاق النسخة الموقّعة قبل التفعيل */
    const base = DOC_KINDS.slice(0, a.stage === 'draft' ? 2 : 4)
    a.docs = (a.stage === 'active' ? [...base, DOC_KINDS[4]!] : base).map((d, i) => ({
      name: d.name,
      kind: d.kind,
      at: dayAfter(a.openedAt, i * 2),
      size: `${int(180, 5200)} ك.ب`,
    }))

    /* السجل · الخطوات البشرية بتاخد أيام والنظامية بتحصل في نفس
       اللحظة · نفس قاعدة الخط الزمني في الصرف */
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
      /* خطوة 4 بتقول «حدّد طبيعة الاتفاقية» · النصّ بيقول النوع
         اللي اتحدّد فعلًا لا الجملة العامة */
      const what =
        step === 4 ? `حدّد طبيعة الاتفاقية · ${a.kind}`
        : step === 5 ? `اختار النموذج · ${a.template}`
        : step === 13 && a.stage === 'returned' ? 'أعاد الاتفاقية للمشرف مع توضيح الملاحظات'
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

/* ═══════════════ مؤشرات الأداء · 9.7 ═══════════════
   الأربعة من الوثيقة، و**عمود القيمة المستهدفة فاضي فيها كلها** ·
   فالرقم بيتعرض قيمةً لا حالةً، زي مؤشرات الصرف بالظبط. */

/** المدة المستهدفة لإعداد الاتفاقية · مؤقتة لحدّ ما المؤسسة تحدّدها */
export const AGR_TARGET_DAYS = 21

const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export const agrKpi = () => {
  const open = agreements.filter((a) => a.stage !== 'active' && a.stage !== 'cancelled')
  const done = agreements.filter((a) => a.stage === 'active')
  /* مؤشر 1 · من إحالة المشروع لمرحلة الاتفاقية حتى الاعتماد */
  const prep = done
    .map((a) => (a.activeAt ? daysBetween(a.openedAt, a.activeAt) : null))
    .filter((x): x is number => x !== null && x >= 0)
  /* مؤشر 3 · من إرسال الاتفاقية للاعتماد (خطوة 12) حتى اكتمالها */
  const cycle = done
    .map((a) => {
      const sent = a.log.find((e) => e.step === 12)
      return sent && a.activeAt ? daysBetween(sent.at, a.activeAt) : null
    })
    .filter((x): x is number => x !== null && x >= 0)
  /* مؤشر 4 · المعادة للتعديل · الإصدار التاني دليل إعادة حصلت */
  const returned = agreements.filter((a) => a.stage === 'returned' || a.version > 1).length

  return {
    open: open.length,
    active: done.length,
    openSum: open.reduce((s, a) => s + a.amount, 0),
    /** مؤشر 1 · متوسط مدة إعداد الاتفاقية (أيام) */
    prepDays: prep.length ? Math.round(prep.reduce((s, d) => s + d, 0) / prep.length) : 0,
    /** مؤشر 2 · نسبة المنجزة ضمن المدة المستهدفة */
    inTarget: prep.length
      ? Math.round((prep.filter((d) => d <= AGR_TARGET_DAYS).length / prep.length) * 100)
      : 0,
    /** مؤشر 3 · متوسط مدة دورة الاعتماد */
    cycleDays: cycle.length ? Math.round(cycle.reduce((s, d) => s + d, 0) / cycle.length) : 0,
    /** مؤشر 4 · نسبة المعادة للتعديل */
    returnedPct: agreements.length
      ? Math.round((returned / agreements.length) * 100)
      : 0,
    late: open.filter((a) => agrHeat(a) === 'late').length,
    stuck: open.filter((a) => agrHeat(a) === 'stuck').length,
    blocked: open.filter(agrBlocked).length,
  }
}
