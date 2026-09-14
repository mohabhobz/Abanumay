import type { PayCheck, PayEvent, PayRequest, PayState } from '@/types/domain'
import { projectRows } from './projects'
import { entityById } from './entities'

/* ═══════════════════════════════════════════════════════════
   Disbursement requests · built on BPD-009, not on the live system

   The document is the basis here. The live system runs seven
   sections and two extra documents (سند القبض والقيد) after the
   transfer; the document describes four stages ending at the
   transfer. Where they differ, the differences are recorded as
   numbered notes in `DISBURSEMENT_MODULE_BRIEF.md` (part B) with
   the design impact of each possible answer — so nothing is lost
   and nothing is guessed.

   What IS taken from the live system is the SIZE: about 72 open
   disbursement transactions, not thousands. That single number
   decides the screen: a decision card beats a table row, and full
   context beats density.

   Every request carries the checks the document actually names, so
   a blocked request says WHICH rule blocks it:
     rule 3  · attachments complete
     rule 6  · the payment's own condition met
     rule 10 · the agreement is in force
     rule 11 · the reserved amount is still available
   Plus the approved bank account, which the document names in its
   second output ("صرف الدفعة إلى الحساب البنكي المعتمد") and which
   the live system names as its only defined reason for sending a
   permit back.
   ═══════════════════════════════════════════════════════════ */

/** حالات الطلب · اللي بيقول مين واقف، لا «مدفوع / غير مدفوع» */
export const PAY_STATES: { key: PayState; label: string; who: string; steps: string }[] = [
  { key: 'supervisor', label: 'بانتظار مراجعة المشرف', who: 'مشرف المنح', steps: '4–7' },
  { key: 'returned', label: 'مُعاد للاستكمال', who: 'الجهة المستفيدة', steps: '10–11' },
  { key: 'manager', label: 'بانتظار مدير المنح', who: 'مدير المنح', steps: '12–13' },
  { key: 'finance', label: 'بانتظار المالية', who: 'الإدارة المالية', steps: '14–17' },
  { key: 'paid', label: 'تم الصرف', who: '', steps: '18–19' },
]

export const payStateLabel = (s: PayState): string =>
  PAY_STATES.find((x) => x.key === s)?.label ?? 'مغلق'

export const payStateWho = (s: PayState): string =>
  PAY_STATES.find((x) => x.key === s)?.who ?? ''

/**
 * حدّ المرحلة بالساعات · مصدره آلية التصعيد (9.5)، واللي بتقول إن
 * عدد الأيام لكل مرحلة **من الإعدادات**. الأرقام دي مؤقتة لحدّ ما
 * المؤسسة تدّينا المدد، زي «القيمة المستهدفة» الفاضية في المؤشرات.
 */
export const PAY_LIMIT: Record<PayState, number> = {
  supervisor: 120,
  returned: 240,
  manager: 96,
  finance: 72,
  paid: 0,
  closed: 0,
}

/** التصعيد · متأخر عند تجاوز الحدّ، ومتعثر عند تجاوز ضعفه */
export type PayHeat = 'ok' | 'late' | 'stuck'

export const payHeat = (r: PayRequest): PayHeat => {
  const lim = PAY_LIMIT[r.state]
  if (!lim) return 'ok'
  if (r.hoursInState > lim * 2) return 'stuck'
  if (r.hoursInState > lim) return 'late'
  return 'ok'
}

/** الطلب موقوف لو فيه شرط واحد مش مستوفى · rule 3 و6 و10 و11 */
export const payBlocked = (r: PayRequest): boolean =>
  r.checks.some((c) => !c.ok) || !r.bank.active

const BANKS = ['مصرف الراجحي', 'مصرف الإنماء', 'بنك البلاد', 'البنك الأهلي السعودي', 'بنك الرياض']

/** حالة الحساب البنكي كخيارَي فلتر · مخرج الوثيقة التاني بيشترط اعتماده */
export const BANK_STATES = ['معتمد', 'معطَّل']

const CONDITIONS = [
  'توقيع الاتفاقية واستلام سند التعهّد',
  'رفع التقرير المرحلي الأول',
  'اكتمال المرحلة الأولى من خطة التنفيذ',
  'تسليم كشف المستفيدين المسجَّلين',
  'رفع فواتير المرحلة السابقة',
]

const AI_NOTES = [
  'الإنجاز الفعلي يطابق خطة التنفيذ · لا ملاحظات',
  'التقرير المرفق لا يغطّي المرحلة الثانية المذكورة في الجدول',
  'قيمة الطلب تساوي الدفعة المعتمدة · لا فرق',
  'المرفقات أقلّ من المطلوب في شرط الدفعة',
  'مدة التنفيذ متقدّمة على الجدول بأسبوعين',
  'الفواتير المرفقة لا تحمل رقم المشروع',
]

const RETURN_NOTES = [
  'التقرير المرفق ناقص · مطلوب كشف المستفيدين',
  'الفواتير غير مختومة من الجهة',
  'قيمة الطلب أعلى من الدفعة المعتمدة في الجدول',
  'المرفق المرسل صورة غير واضحة · مطلوب إعادة الرفع',
]

/* مولّد ثابت · نفس الداتا في كل تشغيلة، فالمقارنة البصرية تنفع */
let seed = 909
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T,>(a: readonly T[]): T => a[int(0, a.length - 1)] as T

/* ⚠️ **النسب من النظام العامل، والعدد من سعة النموذج.**
   الأرقام الأصلية (26 · 6 · 9 · 12 · 19 = 72) هي أحجام النظام
   العامل، وهو فيه آلاف المشاريع. النموذج ده فيه ثلاثين مشروعًا،
   وكل اتفاقية دفعاتها من اتنين لأربعة، وآخر دفعة بتفضل بلا طلب ·
   فالسعة الحقيقية أقلّ من 72 بكتير.

   وحشر 72 في السعة دي كان بيدّي مشروعًا واحدًا تلات طلبات مفتوحة
   في نفس الوقت — رقم بيتقري صح في الصندوق وبيكدب على الواقع.
   والأسوأ إن المحاولة الفاضية كانت بتاكل من حصّة المرحلة، فالخطة
   طلعت 17/2/0/0/0: المراحل الأولى بلعت المشاريع والأخيرة فضيت
   خالص، والمؤشران 2 و3 طلعوا أصفارًا لأن مفيش ولا طلب مصروف.

   فالنسب هي اللي اتاخدت من النظام العامل (36% · 8% · 13% · 17% ·
   26%)، والعدد بيتحسب من السعة الفعلية وقت التشغيل. */
const MIX: { state: PayState; share: number }[] = [
  { state: 'supervisor', share: 0.36 },
  { state: 'returned', share: 0.08 },
  { state: 'manager', share: 0.13 },
  { state: 'finance', share: 0.17 },
  { state: 'paid', share: 0.26 },
]

const checksFor = (state: PayState, cond: boolean): PayCheck[] => {
  /* المرحلة بتحدّد الشروط اللي النظام بيتحقق منها · rule 10 و11
     بيتحققوا قبل الإحالة للمالية، فما بيظهروش على طلب لسّه عند
     المشرف إلا كمعلومة. */
  const base: PayCheck[] = [
    { label: 'المرفقات والمستندات مكتملة', ok: rnd() > 0.18, rule: 3 },
  ]
  if (cond) base.push({ label: 'شرط الدفعة مستوفى', ok: rnd() > 0.22, rule: 6 })
  base.push({ label: 'الاتفاقية سارية', ok: rnd() > 0.05, rule: 10 })
  base.push({ label: 'المبلغ المحجوز متوفّر', ok: rnd() > 0.08, rule: 11 })
  if (state === 'paid') return base.map((c) => ({ ...c, ok: true }))
  return base
}

/* ═══════════════ المرفقات وسجل التدقيق ═══════════════
   rule 21 بيقول المستندات تتحفظ **مربوطة بالطلب** لا في مكان تاني،
   وrule 16 بيطلب سجل تدقيق لكل العمليات. الاتنين دول مش زينة في
   صفحة الطلب · هما اللي بيخلّوا المراجِع يقدر يقول «ليه الطلب ده
   وصل لهنا» بدل ما يسأل اللي قبله. */

const DOC_KINDS = [
  { name: 'التقرير المرحلي', kind: 'تقرير' },
  { name: 'كشف المستفيدين', kind: 'كشف' },
  { name: 'فواتير المرحلة السابقة', kind: 'فواتير' },
  { name: 'صور التنفيذ', kind: 'صور' },
  { name: 'سند التعهّد الموقّع', kind: 'سند' },
]

/** الخطوات اللي كل مرحلة بتعدّي عليها · مصدرها جدول الخطوات نفسه */
const PASSED: Record<PayState, number[]> = {
  supervisor: [1, 2, 3, 4],
  returned: [1, 2, 3, 4, 5, 6, 7, 10],
  manager: [1, 2, 3, 4, 5, 6, 7, 12],
  finance: [1, 2, 3, 4, 5, 6, 7, 12, 13, 14],
  paid: [1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15, 16, 17, 18, 19],
  closed: [1, 2, 3, 4, 15],
}

/** نصّ كل خطوة في السجل · الفاعل والفعل والإشعار اللي اتبعت معاه */
const STEP_SAY: Record<number, { role: string; what: string; notified?: string }> = {
  1: { role: 'النظام', what: 'أتاح إنشاء طلب صرف · الدفعة استحقّت وشروط التقديم مستوفاة' },
  2: { role: 'الجهة المستفيدة', what: 'أنشأت طلب الصرف وأرفقت التقارير والمستندات' },
  3: { role: 'النظام', what: 'تحقّق من اكتمال البيانات والمتطلبات الإلزامية' },
  4: { role: 'النظام', what: 'أحال الطلب لمشرف المنح', notified: 'مشرف المنح · طلب صرف جديد' },
  5: { role: 'مشرف المنح', what: 'راجع الطلب وتحقّق من المتطلبات والتقارير' },
  6: { role: 'الذكاء الاصطناعي', what: 'حلّل التقارير وقارن الإنجاز بخطة التنفيذ' },
  7: { role: 'مشرف المنح', what: 'سجّل التوصية' },
  10: { role: 'النظام', what: 'حدّث حالة الطلب وأشعر الجهة بالملاحظات', notified: 'الجهة المستفيدة · الطلب معاد للاستكمال' },
  12: { role: 'النظام', what: 'أحال الطلب لمدير المنح', notified: 'مدير المنح · طلب بانتظار الموافقة' },
  13: { role: 'مدير المنح', what: 'راجع الطلب ووافق عليه' },
  14: { role: 'النظام', what: 'تحقّق من سريان الاتفاقية وتوفّر المبلغ المحجوز ثم أحال للمالية', notified: 'الإدارة المالية · طلب بانتظار أمر الصرف' },
  15: { role: 'الإدارة المالية', what: 'راجعت الطلب واعتمدت أمر الصرف' },
  16: { role: 'النظام', what: 'أنشأ أمر الصرف وربطه بالمشروع والاتفاقية والدفعة ومصادر التمويل' },
  17: { role: 'الإدارة المالية', what: 'نفّذت التحويل المالي للحساب البنكي المعتمد' },
  18: { role: 'النظام', what: 'حدّث حالة الدفعة إلى (تم الصرف) وحوّل المبلغ من محجوز إلى مصروف' },
  19: { role: 'النظام', what: 'أرسل إشعارًا للجهة بتنفيذ عملية الصرف', notified: 'الجهة المستفيدة · تم تنفيذ الصرف' },
}

/** تواريخ السجل بتتولّد للورا من تاريخ الإنشاء، بيوم لكل خطوة */
const dayAfter = (iso: string, n: number): string => {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** المشاريع اللي عدّت الاتفاقية · rule 1: الصرف بعد التفعيل بس */
const eligible = projectRows.filter(
  (p) => p.statusGroup === 'في التشغيل' || p.statusGroup === 'مكتمل',
)

/* ⚠️ **عدد الدفعات صفة في الاتفاقية، لا في الطلب.**
   كان `of` بيتولّد مع كل طلب لوحده، فالمشروع الواحد بيطلع بطلب
   «الدفعة 2 من 2» وجنبه «الدفعة 1 من 4» · يعني جدولان للاتفاقية
   الواحدة. الباج ده ما كانش بيبان في صندوق الصرف خالص (كل كارت
   بيتقري لوحده وكل واحد فيهم متّسق مع نفسه)، وبان أول ما شاشة
   إنشاء الطلب طلبت **الجدول كله** فلقت نفسها بتقرا `of` من أول طلب
   وتتجاهل الباقي. الجدول بيتعرّف مرة واحدة للمشروع هنا. */
const SCHEDULE = new Map<string, number>()
const scheduleOf = (projectId: string): number => {
  const known = SCHEDULE.get(projectId)
  if (known) return known
  const of = pick([2, 2, 3, 3, 4, 4])
  SCHEDULE.set(projectId, of)
  return of
}

/** الدفعات اللي اتحجزت لكل مشروع · قاعدة 4: واحدة لكل رقم */
const TAKEN = new Map<string, Set<number>>()

export const payRequests: PayRequest[] = (() => {
  const out: PayRequest[] = []

  /* السعة الفعلية · مجموع الدفعات القابلة للطلب في كل المشاريع
     المؤهّلة، بعد ما آخر دفعة تتحجز في الاتفاقيات المتعددة */
  const capacity = eligible.reduce((sum, p) => {
    const of = scheduleOf(p.id)
    return sum + (of > 1 ? of - 1 : of)
  }, 0)

  /* الخطة = النسب × السعة · والباقي من القسمة بيروح لأكبر شريحة
     عشان المجموع يطابق السعة بالظبط لا يقلّ عنها */
  const PLAN = MIX.map((m) => ({ state: m.state, n: Math.floor(capacity * m.share) }))
  const spare = capacity - PLAN.reduce((s, x) => s + x.n, 0)
  if (PLAN[0]) PLAN[0].n += spare

  let n = 0
  for (const { state, n: count } of PLAN) {
    for (let i = 0; i < count; i++) {
      /* ⚠️ **بندوّر على مشروع لسّه عنده دفعة فاضية، ما بنتخطّاش.**
         الأول كان `continue` لما المشروع يبقى ملْيان · والنتيجة إن
         المحاولة الفاضية بتاكل من حصّة المرحلة، فالخطة 26/6/9/12/19
         طلعت 17/2/0/0/0: المراحل الأولى بلعت المشاريع والأخيرة
         فضيت خالص، والمؤشران 2 و3 طلعوا أصفارًا لأن مفيش ولا طلب
         مصروف. العدّاد اللي بيتقري من حلقة بتتخطّى بيكدب على
         الخطة، ومفيش تحقّق بيمسك ده · الخطة بتقول 72 والشاشة
         بتعرض 19 والاتنين «شغّالين». */
      let p = null as (typeof eligible)[number] | null
      let taken = new Set<number>()
      let of = 0
      let cap = 0
      for (let k = 0; k < eligible.length; k++) {
        const cand = eligible[(n * 7 + i * 3 + k) % eligible.length]
        if (!cand) continue
        const candOf = scheduleOf(cand.id)
        const candTaken = TAKEN.get(cand.id) ?? new Set<number>()
        TAKEN.set(cand.id, candTaken)
        /* ⚠️ الدفعة الأخيرة بتفضل **بلا طلب** في الاتفاقيات المتعددة.
           مش تزويقًا للنموذج: الدفعة الختامية بتيجي بعد التقرير
           الختامي، فالاتفاقية اللي كل دفعاتها ليها طلب مفتوح حالة
           نادرة لا القاعدة. ولولا ده كانت شاشة إنشاء الطلب بتفتح
           على جدول كل صفوفه مقفولة — شاشة سليمة بتوصف عالمًا
           مستحيلًا. */
        const candCap = candOf > 1 ? candOf - 1 : candOf
        if (candTaken.size >= candCap) continue
        p = cand; taken = candTaken; of = candOf; cap = candCap
        break
      }
      if (!p) break
      const e = entityById(p.entityId)
      /* قاعدة 4 · طلب واحد مفتوح لكل دفعة · فالرقم ما يتكرّرش */
      let no = int(1, cap)
      while (taken.has(no)) no = (no % cap) + 1
      taken.add(no)
      const granted = p.amountGranted || p.amountRequested
      /* الدفعة = نصيبها من المعتمد · والأخيرة بتاخد الباقي فالمجموع
         يساوي قيمة المنحة بالظبط (rule 14 وقاعدة الاتفاقية 8) */
      const even = Math.round(granted / of / 1000) * 1000
      const due = no === of ? granted - even * (of - 1) : even
      const cond = rnd() > 0.35
      const lim = PAY_LIMIT[state] || 120
      /* التوزيع مقصود: أغلب الطلبات جوّه الحدّ، وشوية متأخرة، وأقل
         متعثرة · الصندوق الحقيقي مش كله أحمر */
      const h = rnd() > 0.72 ? int(lim + 1, lim * 3) : int(2, lim)
      const dueMonth = int(6, 9)
      const dueDay = int(1, 28)

      out.push({
        id: `SR-2026-${String(11_400 + n).padStart(5, '0')}`,
        projectId: p.id,
        projectName: p.name,
        entityId: p.entityId,
        entityName: e?.name ?? p.entityName,
        no,
        of,
        due,
        asked: due,
        dueAt: `2026-0${dueMonth}-${String(dueDay).padStart(2, '0')}`,
        state,
        hoursInState: state === 'paid' ? 0 : h,
        condition: cond ? pick(CONDITIONS) : undefined,
        checks: checksFor(state, cond),
        bank: { name: pick(BANKS), active: rnd() > 0.07 },
        /* مصدر واحد في الأغلب · وتعدّد المصادر هو اللي rule 12 بيخصّه */
        sources:
          rnd() > 0.8
            ? [
                { name: 'ميزانية المنح 2026', share: 70 },
                { name: 'وقف سليمان أبانمي', share: 30 },
              ]
            : [{ name: 'ميزانية المنح 2026', share: 100 }],
        ai: state === 'paid' ? undefined : pick(AI_NOTES),
        note: state === 'returned' ? pick(RETURN_NOTES) : undefined,
        owner: p.owner ?? 'عمر قاسم',
        /* ⚠️ تاريخ الإنشاء **مربوط بالاستحقاق**: الجهة بتطلب الصرف
           قبل موعد الدفعة بأسبوعين لتلاتة، مش في شهر عشوائي.
           لما كان مستقلًّا كان بيطلع طلبات اتعملت **بعد** ما
           الدفعة استحقّت بشهرين، والمؤشرات كلها بتتحسب من المسافة
           دي. */
        at: dayAfter(
          `2026-0${dueMonth}-${String(dueDay).padStart(2, '0')}`,
          /* المدى واسع عن قصد: الجهة اللي بتطلب قبل الاستحقاق
             بأسبوعين بتتصرف في موعدها، واللي بتطلب قبله بيومين
             بتتأخر مهما كانت المعالجة سريعة · ومؤشر 4 بيقيس ده
             بالظبط. مدى ضيّق كان بيدّي 100% في موعدها، وهي نسبة
             ما بتحصلش ولا في نظام. */
          -int(2, 26),
        ),
        /* rule 10 · الاتفاقية وسريانها معروضة في الطلب لا مستنتجة */
        agreement: {
          id: `AG-${p.id.replace(/\D/g, '').slice(-5)}`,
          active: rnd() > 0.05,
          endsAt: `2027-0${int(1, 9)}-${String(int(1, 28)).padStart(2, '0')}`,
        },
        granted,
        /* المصروف قبل الدفعة دي · rule 14 بيقيس السقف عليه */
        spent: even * (no - 1),
        reserved: due,
        docs: [],
        log: [],
        /* تاريخ التحويل مشتَقّ من الاستحقاق لا مستقلًّا عنه · كان
           تاريخًا ثابتًا في سبتمبر، فكل دفعة مستحقة في يونيو طلعت
           متأخرة و«نسبة الالتزام بجدول الدفعات» نزلت 16% · رقم
           بيتقري كارثة وهو أثر جانبي للمولّد لا معلومة. */
        paidAt: undefined,
      })
      n++
    }
  }
  /* المرفقات وسجل التدقيق · بيتبنوا بعد ما الطلب يكتمل عشان
     السجل يقرأ من حالة الطلب نفسها لا من قيم منفصلة */
  for (const r of out) {
    const n = 2 + Math.floor(rnd() * 3)
    r.docs = DOC_KINDS.slice(0, n).map((d, i) => ({
      name: d.name,
      kind: d.kind,
      at: dayAfter(r.at, i),
      size: `${int(120, 4800)} ك.ب`,
    }))

    /* ⚠️ **خط زمني واحد للطلب، والسجل والتحويل بيقروا منه.**
       كان كل واحد فيهم بيتولّد لوحده: السجل يوم لكل خطوة من تاريخ
       الإنشاء، وتاريخ التحويل مشتقًّا من الاستحقاق · فمؤشر 3 (من
       اعتماد المدير حتى التحويل) طلع **64 يومًا**، وهو مسافة بين
       تاريخين مالهمش علاقة ببعض أصلًا. الرقم بيتقري كارثة تشغيلية
       وهو أثر جانبي للمولّد. نفس عيلة الباج اللي ضربت «الالتزام
       بجدول الدفعات» قبل كده.

       والخطوات مش بتاخد نفس الوقت كمان: خطوات النظام (إحالة ·
       تحقّق · تحديث حالة) بتحصل في نفس اللحظة، واللي بتاخد أيام هي
       خطوات البني آدمين. فالمسافة بتتحسب بالخطوة لا بالفهرس. */
    const HUMAN = new Set([2, 5, 7, 11, 13, 15, 17])
    const offsets: number[] = []
    let cursor = 0
    for (const step of PASSED[r.state]) {
      offsets.push(cursor)
      if (HUMAN.has(step)) cursor += int(1, 3)
    }

    const steps = PASSED[r.state]
    r.log = steps.map((step, i): PayEvent => {
      const say = STEP_SAY[step]!
      const who =
        say.role === 'مشرف المنح' ? r.owner
        : say.role === 'الجهة المستفيدة' ? r.entityName
        : say.role === 'مدير المنح' ? 'عبدالله الدوسري'
        : say.role === 'الإدارة المالية' ? 'ريم الشمري'
        : say.role
      /* خطوة 7 ليها مخرجان · النص بيتبع اللي حصل فعلًا لا ثابتًا */
      const what =
        step === 7 && r.state === 'returned'
          ? 'أعاد الطلب للجهة مع توضيح الملاحظات'
          : step === 7
            ? 'سجّل التوصية بالموافقة'
            : say.what
      return {
        at: dayAfter(r.at, offsets[i] ?? 0),
        who,
        role: say.role,
        what,
        note: step === 7 && r.state === 'returned' ? r.note : undefined,
        step,
        notified: say.notified,
      }
    })
  }

  /* تاريخ التحويل = آخر يوم في سجل الطلب · مش رقمًا تاني جنبه.
     والالتزام بجدول الدفعات (مؤشر 4) بيتقاس بمقارنته بالاستحقاق،
     فالمؤشر بقى بيقيس **الفرق بين الخط الزمني والجدول** لا فرقًا
     بين رقمين مولَّدين. */
  for (const r of out) {
    if (r.state !== 'paid') continue
    r.paidAt = r.log[r.log.length - 1]?.at
  }
  return out
})()

/* ═══════════════ مؤشرات الأداء · 9.8 ═══════════════
   الأربعة كلها من الوثيقة، و**عمود «القيمة المستهدفة» فاضي فيها
   كلها** · فالرقم بيتعرض قيمةً لا حالةً، ولا بيتلوّن، لحد ما
   المؤسسة تدّينا الأهداف. */

/**
 * المدة المستهدفة لمعالجة الطلب كاملًا · مجموع حدود المراحل الأربعة.
 * مؤقتة زي كل مدة في الإجراء، لأن آلية التصعيد بتقول إن الأيام
 * **من الإعدادات** والمؤسسة لسّه ما دّتناش الأرقام.
 */
export const PAY_TARGET_DAYS = Math.round(
  (PAY_LIMIT.supervisor + PAY_LIMIT.manager + PAY_LIMIT.finance) / 24,
)

/** أيام بين تاريخين بصيغة YYYY-MM-DD */
const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

export const payKpi = () => {
  const open = payRequests.filter((r) => r.state !== 'paid' && r.state !== 'closed')
  const paid = payRequests.filter((r) => r.state === 'paid')
  const onTime = paid.filter((r) => (r.paidAt ?? '') <= r.dueAt).length
  /* مؤشر 2 · المنجزة **ضمن المدة المستهدفة** · من الإنشاء للتحويل،
     مش مقابل تاريخ الاستحقاق (ده مؤشر 4) · مؤشران مختلفان بيتخلطوا
     بسهولة لأن الاتنين نسبة على المصروف */
  const inTarget = paid.filter(
    (r) => r.paidAt && daysBetween(r.at, r.paidAt) <= PAY_TARGET_DAYS,
  ).length
  /* مؤشر 3 · من **اعتماد مدير المنح** (خطوة 13) لحد تنفيذ التحويل
     (خطوة 17) · مش من إنشاء الطلب */
  const finance = paid
    .map((r) => {
      const approved = r.log.find((e) => e.step === 13)
      return approved && r.paidAt ? daysBetween(approved.at, r.paidAt) : null
    })
    .filter((x): x is number => x !== null && x >= 0)
  return {
    /** عدد الطلبات المفتوحة · مش مؤشرًا في الوثيقة، لكنه حجم الصندوق */
    open: open.length,
    /** قيمة الطلبات المفتوحة */
    openSum: open.reduce((s, r) => s + r.asked, 0),
    /** مؤشر 1 · متوسط مدة معالجة طلب الصرف (أيام) */
    avgDays: Math.round(
      payRequests.reduce((s, r) => s + r.hoursInState, 0) / payRequests.length / 24,
    ),
    /** مؤشر 2 · نسبة الطلبات المنجزة ضمن المدة المستهدفة */
    inTarget: paid.length ? Math.round((inTarget / paid.length) * 100) : 0,
    /** مؤشر 3 · متوسط مدة تنفيذ الصرف المالي · اعتماد المدير ← التحويل */
    financeDays: finance.length
      ? Math.round(finance.reduce((s, d) => s + d, 0) / finance.length)
      : 0,
    /** مؤشر 4 · نسبة الالتزام بجدول الدفعات */
    onSchedule: paid.length ? Math.round((onTime / paid.length) * 100) : 0,
    /** المتأخر والمتعثر · التصعيد 9.5 بند 3 */
    late: open.filter((r) => payHeat(r) === 'late').length,
    stuck: open.filter((r) => payHeat(r) === 'stuck').length,
    /** الموقوف بشرط · rule 3 و6 و10 و11 */
    blocked: open.filter(payBlocked).length,
  }
}

/* ═══════════════ جدول الدفعات · شاشة إنشاء الطلب ═══════════════
   الشاشة اللي الجهة بتنشئ منها الطلب مش فورم فاضي · هي **جدول
   الدفعات المعتمد** (المدخل التاني في الوثيقة) وكل دفعة فيه بحالتها.
   وده اللي بيخلّي أربع قواعد يتنفّذوا بالعرض لا بالتحقّق:

     قاعدة 1 · مفيش طلب قبل تفعيل الاتفاقية وحالة «تحت التنفيذ»
     قاعدة 2 · الطلب للدفعات **المستحقة** بس، والباقي معروض ومقفول
     قاعدة 4 · دفعة لها طلب مفتوح ما تقبلش تاني
     قاعدة 6 · الدفعة المشروطة ما تترسلش قبل استيفاء شرطها

   خطوة 1 بتقول «النظام **يتيح** الإنشاء عند حلول الاستحقاق واستيفاء
   الشروط» · فالإتاحة نفسها معلومة معروضة، لا زرار بيرفض بعد الضغط.
   ═══════════════════════════════════════════════════════════ */

export type PaySlotState =
  /** مستحقة وجاهزة للطلب */
  | 'open'
  /** لسّه ما استحقّتش · قاعدة 2 */
  | 'early'
  /** ليها طلب مفتوح · قاعدة 4 */
  | 'pending'
  /** اتصرفت */
  | 'paid'
  /** مستحقة بس شرطها مش مستوفى · قاعدة 6 */
  | 'held'

export interface PaySlot {
  no: number
  of: number
  amount: number
  dueAt: string
  condition?: string
  conditionMet: boolean
  state: PaySlotState
  /** الطلب المرتبط بالدفعة، لو موجود */
  requestId?: string
}

/** النهارده في النموذج · ثابت عشان الجدول ما يتغيّرش كل تشغيلة */
export const TODAY = '2026-09-14'

/**
 * جدول دفعات مشروع · مبني من طلباته الموجودة + الدفعات الباقية.
 * الدفعة اللي ليها طلب بتاخد حالته، واللي مالهاش بتتحسب من تاريخ
 * استحقاقها وشرطها.
 */
export function paySchedule(projectId: string): PaySlot[] {
  const mine = payRequests.filter((r) => r.projectId === projectId)
  const first = mine[0]
  if (!first) return []

  const of = first.of
  const even = Math.round(first.granted / of / 1000) * 1000
  const out: PaySlot[] = []

  for (let no = 1; no <= of; no++) {
    const req = mine.find((r) => r.no === no)
    const amount = no === of ? first.granted - even * (of - 1) : even
    /* الاستحقاق بيتباعد شهرين بين الدفعة والتانية · جدول الاتفاقية */
    const base = new Date(first.dueAt)
    base.setMonth(base.getMonth() + (no - first.no) * 2)
    const dueAt = req?.dueAt ?? base.toISOString().slice(0, 10)
    const condition = req?.condition
    const conditionMet = req ? (req.checks.find((c) => c.rule === 6)?.ok ?? true) : true

    const state: PaySlotState =
      req?.state === 'paid' ? 'paid'
      : req ? 'pending'
      : dueAt > TODAY ? 'early'
      : condition && !conditionMet ? 'held'
      : 'open'

    out.push({ no, of, amount, dueAt, condition, conditionMet, state, requestId: req?.id })
  }
  return out
}

export const PAY_SLOT_SAY: Record<PaySlotState, { label: string; why: string; rule?: number }> = {
  open: { label: 'مستحقة', why: 'جاهزة لإنشاء طلب صرف' },
  early: { label: 'لم تستحق', why: 'الطلب للدفعات المستحقة وفق الجدول المعتمد', rule: 2 },
  pending: { label: 'لها طلب مفتوح', why: 'طلب صرف واحد مفتوح لكل دفعة', rule: 4 },
  paid: { label: 'مصروفة', why: 'اكتمل تحويلها' },
  held: { label: 'موقوفة بشرط', why: 'الدفعة المرتبطة بتقارير لا تُرسل قبل استيفائها', rule: 6 },
}

/**
 * المشاريع اللي تقدر تطلب صرفًا · قاعدة 1.
 * المشروع اللي اتفاقيته مش سارية بيفضل معروضًا ومعاه السبب، لأن
 * إخفاءه بيخلّي الجهة تدوّر على حاجة مش موجودة بدل ما تعرف ليه.
 */
export function payProjects(): {
  id: string; name: string; entity: string; can: boolean; why?: string; open: number
}[] {
  const seen = new Map<string, PayRequest>()
  for (const r of payRequests) if (!seen.has(r.projectId)) seen.set(r.projectId, r)
  const out = [...seen.values()].map((r) => ({
    id: r.projectId,
    name: r.projectName,
    entity: r.entityName,
    can: r.agreement.active,
    why: r.agreement.active ? undefined : 'الاتفاقية غير سارية · القاعدة 1',
    /* كام دفعة مستحقة وجاهزة للطلب · ده اللي بيرتّب القائمة */
    open: paySchedule(r.projectId).filter((x) => x.state === 'open').length,
  }))
  /* اللي عنده دفعة مستحقة فوق · القائمة بتبدأ باللي **ينفع تعمل
     عليه حاجة**، لا بأول مشروع في الداتا · الجهة اللي فاتحة الشاشة
     دي جاية تطلب صرفًا، مش تتصفّح مشاريعها. */
  return out.sort((a, b) => Number(b.can) - Number(a.can) || b.open - a.open)
}

export const payByState = (s: PayState): PayRequest[] =>
  payRequests.filter((r) => r.state === s)

export const payRequestById = (id: string): PayRequest | undefined =>
  payRequests.find((r) => r.id === id)
