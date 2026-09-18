import type {
  ActivityState, PlanActivity, PlanChange, PlanPhase, PlanRow, PlanStage,
} from '@/types/domain'
import { projectRows } from './projects'

/* ═══════════════════════════════════════════════════════════
   خطة تنفيذ المشروع · BPD-012 · أخطر ناقص في التدقيق (أ-1)

   السند في BPD-009 §9.3 خطوة 1 بالنص: «اعداد خطة المشروع من قبل
   الجهة المستفيدة واعتمادها من قبل مشرف المنح ومدير المنح وذلك في
   حالة المشاريع التي تتطلب خطة عمل».

   وفي النظام العامل «الخطة التنفيذية» **مرفق** جوّه المشروع ·
   ملف PDF بيترفع ويتنسي. مفيش دورة اعتماد، مفيش أنشطة، مفيش
   شواهد، مفيش متابعة إنجاز. يعني السؤال «المشروع ماشي حسب خطته
   ولا لأ؟» ما كانش له إجابة في السيستم كله.

   ═══ الفكرة اللي الموديول مبني عليها ═══

   ⚠️ **الخطة إجراء مستقل، زي الاتفاقية بالظبط.** ده تطبيق ح-10
   (أهم فكرة في ميتنج مظفر · فصل الإجراءات): «المشكلة إن السيستم
   بيتعامل مع المشروع كأنه حاجة واحدة · المشروع هو الخطة هو
   الاتفاقية هو الدفع هو إغلاق المشروع، وحالة المشروع بتتغيّر
   تبعًا لمستند تاني جزء منه».

   فالخطة بتتعمل **بالتوازي** مع الاتفاقية، وانتقالها بين مراحلها
   **ما بيغيّرش حالة المشروع** · نفس قاعدة 25 في الاتفاقيات. خطة
   عند مدير المنح ومشروعها مكتوب عليه «قيد التنفيذ»، والاتنين صح.

   ⚠️ **وأهم قاعدة في الموديول هي 14: الجهة بتقول، والمشرف بيقرّر.**
   النشاط اللي الجهة رفعت شاهده وقالت خلص بيبقى `claimed` **لا
   `accepted`** · وما بيتحسبش في نسبة الإنجاز. من غير الفصل ده
   نسبة الإنجاز بتبقى إقرارًا ذاتيًا، والمؤسسة بتدفع على كلام.

   ⚠️ **و`Baseline` مش نسخة احتياطية · هو المرجع اللي الانحراف
   بيتقاس عليه.** بعد الاعتماد الهيكل بيتقفل، وأي تعديل جوهري
   بيعدّي بطلب رسمي يعتمده مدير المنح (قاعدة 21) وبيرفع رقم النسخة.
   من غير كده الجهة اللي اتأخرت بتعدّل تواريخها فتبقى منضبطة على
   الورق دايمًا.
   ═══════════════════════════════════════════════════════════ */

export const PLAN_STAGES: {
  key: PlanStage; label: string; who: string; note: string
}[] = [
  { key: 'draft', label: 'مسودة', who: 'الجهة المستفيدة', note: 'بتتكتب وما اتبعتتش' },
  { key: 'supervisor', label: 'مراجعة مشرف المنح', who: 'مشرف المنح', note: 'مراجعة فنية للمراحل والأنشطة' },
  { key: 'manager', label: 'اعتماد مدير المنح', who: 'مدير المنح', note: 'الاعتماد بيثبّت النسخة المرجعية' },
  { key: 'returned', label: 'مُعادة للجهة', who: 'الجهة المستفيدة', note: 'بملاحظات مكتوبة' },
  { key: 'active', label: 'قيد التنفيذ', who: 'الجهة المستفيدة', note: 'أنشطة وشواهد ومراجعة' },
  { key: 'done', label: 'مكتملة', who: '', note: 'المشروع مؤهَّل للإغلاق' },
]

export const planStageLabel = (s: PlanStage): string =>
  PLAN_STAGES.find((x) => x.key === s)?.label ?? s

export const planStageWho = (s: PlanStage): string =>
  PLAN_STAGES.find((x) => x.key === s)?.who ?? ''

export const PLAN_TONE: Record<PlanStage, 'mute' | 'warn' | 'ret' | 'ok' | 'no'> = {
  draft: 'mute',
  supervisor: 'warn',
  manager: 'warn',
  returned: 'no',
  active: 'ret',
  done: 'ok',
}

/**
 * حدّ المرحلة بالساعات · مؤقت زي كل مدة في السيستم.
 * ⚠️ الوثيقة ما دّتش مدة لكل محطة · والأرقام دي **افتراضات**
 * مسجَّلة في البريف، زي مدد الاتفاقيات والصرف بالظبط.
 */
export const PLAN_LIMIT: Record<PlanStage, number> = {
  draft: 336,
  supervisor: 120,
  manager: 96,
  returned: 168,
  active: 0,
  done: 0,
}

export const ACTIVITY_SAY: Record<ActivityState, string> = {
  todo: 'لم يبدأ',
  doing: 'جارٍ',
  claimed: 'بانتظار قبول المشرف',
  accepted: 'مقبول',
  rejected: 'مرفوض · بملاحظة',
}

export const ACTIVITY_TONE: Record<ActivityState, 'mute' | 'warn' | 'ret' | 'ok' | 'no'> = {
  todo: 'mute',
  doing: 'ret',
  claimed: 'warn',
  accepted: 'ok',
  rejected: 'no',
}

/**
 * أنواع الشواهد · ماستر داتا (د-3).
 * أي قائمة منسدلة في السيستم = ماستر داتا، فمكانها الإعدادات.
 */
export const EVIDENCE_KINDS = [
  'تقرير مرحلي',
  'صور تنفيذ',
  'محضر استلام',
  'كشف مستفيدين',
  'فاتورة أو سند صرف',
  'مادة إعلامية',
  'شهادة أو إفادة جهة',
] as const

/* ═══════════════════ الحساب ═══════════════════ */

/**
 * ⚠️ **الإنجاز بيتحسب من `accepted` وحدها · قاعدة 14.**
 * `claimed` معناها «الجهة قالت خلص» · وحسابها في النسبة بيحوّل
 * المتابعة لإقرار ذاتي. النسبة دي هي اللي بيتبني عليها قرار
 * الإغلاق، فلازم تبقى **مراجَعة** لا مُعلَنة.
 */
export const phaseDone = (p: PlanPhase): number => {
  const w = p.activities.reduce((s, a) => s + a.weight, 0)
  if (w === 0) return 0
  const got = p.activities
    .filter((a) => a.state === 'accepted')
    .reduce((s, a) => s + a.weight, 0)
  return Math.round((got / w) * 100)
}

/** نسبة الإنجاز الكلية · موزونة بتكلفة المرحلة لا بعددها */
export const planDone = (p: PlanRow): number => {
  const total = p.phases.reduce((s, ph) => s + ph.cost, 0)
  if (total === 0) return 0
  const got = p.phases.reduce((s, ph) => s + (ph.cost * phaseDone(ph)) / 100, 0)
  return Math.round((got / total) * 100)
}

/**
 * ⚠️ **النسبة اللي الجهة بتقولها · معروضة جنب المراجَعة لا بدالها.**
 * الفرق بين الاتنين هو بالظبط «شغل مستنّي مراجعة»، وإخفاؤه بيخلّي
 * المشرف ما يعرفش إن عنده طابور.
 */
export const planClaimed = (p: PlanRow): number => {
  const total = p.phases.reduce((s, ph) => s + ph.cost, 0)
  if (total === 0) return 0
  const got = p.phases.reduce((s, ph) => {
    const w = ph.activities.reduce((x, a) => x + a.weight, 0)
    if (w === 0) return s
    const c = ph.activities
      .filter((a) => a.state === 'accepted' || a.state === 'claimed')
      .reduce((x, a) => x + a.weight, 0)
    return s + (ph.cost * (c / w))
  }, 0)
  return Math.round((got / total) * 100)
}

/**
 * النسبة **المخطَّطة** لليوم · كام المفروض يكون خلص لو الخطة ماشية.
 * بتتحسب من التواريخ المرجعية: النشاط اللي تاريخ نهايته عدّى
 * المفروض يكون خلص، واللي جوّه مداه بيتحسب بالتناسب.
 */
export const planPlanned = (p: PlanRow, today = TODAY): number => {
  const total = p.phases.reduce((s, ph) => s + ph.cost, 0)
  if (total === 0) return 0
  const now = new Date(today).getTime()
  const got = p.phases.reduce((s, ph) => {
    const w = ph.activities.reduce((x, a) => x + a.weight, 0)
    if (w === 0) return s
    const due = ph.activities.reduce((x, a) => {
      const a0 = new Date(a.from).getTime()
      const a1 = new Date(a.to).getTime()
      if (now >= a1) return x + a.weight
      if (now <= a0 || a1 === a0) return x
      return x + (a.weight * (now - a0)) / (a1 - a0)
    }, 0)
    return s + ph.cost * (due / w)
  }, 0)
  return Math.round((got / total) * 100)
}

/**
 * `SPI` · مؤشر أداء الجدول (المنجَز ÷ المخطَّط).
 *
 * ⚠️ **واحد صحيح معناه «ماشي بالظبط»، لا «تمام».** الرقم لوحده
 * بيتقري تقييمًا، فالشاشة بتعرض معاه النسبتين اللي طلعوه ·
 * `SPI` من غير طرفيه بيبقى حكمًا بلا سند.
 */
export const planSpi = (p: PlanRow, today = TODAY): number | null => {
  const want = planPlanned(p, today)
  if (want === 0) return null
  return Math.round((planDone(p) / want) * 100) / 100
}

export const spiSay = (v: number | null): { say: string; tone: 'ok' | 'warn' | 'no' | 'mute' } => {
  if (v === null) return { say: 'ما بدأش', tone: 'mute' }
  if (v >= 0.95) return { say: 'ماشي مع الخطة', tone: 'ok' }
  if (v >= 0.8) return { say: 'متأخّر قليلًا', tone: 'warn' }
  return { say: 'متأخّر عن الخطة', tone: 'no' }
}

/** أنشطة مستنّية مراجعة المشرف · ده طابور شغله */
export const waitingReview = (p: PlanRow): PlanActivity[] =>
  p.phases.flatMap((ph) => ph.activities.filter((a) => a.state === 'claimed'))

/** أنشطة عدّى تاريخ نهايتها وما اتقبلتش */
export const lateActivities = (p: PlanRow, today = TODAY): PlanActivity[] =>
  p.phases.flatMap((ph) =>
    ph.activities.filter((a) => a.state !== 'accepted' && a.to < today))

/* ═══════════════════ القواعد قبل الأفعال ═══════════════════ */

/**
 * ⚠️ **الكونديشنز بتتشيّك عند الأكشن لا عند الكتابة (ج-8).**
 * والرسالة بتقول **إيه** و**ليه**، لأن «فيه خطأ» بتخلّي المستخدم
 * يدوّر بعينه على اللي هو مش شايفه.
 */
export interface PlanIssue { key: string; say: string; rule: string }

export const planIssues = (p: PlanRow, grant: number): PlanIssue[] => {
  const out: PlanIssue[] = []

  if (p.phases.length === 0) {
    out.push({ key: 'phases', say: 'الخطة بلا مراحل.', rule: 'BPD-012' })
    return out
  }

  p.phases.forEach((ph, i) => {
    if (!ph.name.trim()) {
      out.push({ key: `nm-${ph.id}`, say: `المرحلة ${i + 1} بلا اسم.`, rule: 'BPD-012' })
    }
    if (ph.activities.length === 0) {
      out.push({
        key: `ac-${ph.id}`,
        say: `«${ph.name || `المرحلة ${i + 1}`}» بلا أنشطة · المرحلة بتتقاس بأنشطتها.`,
        rule: 'قاعدة 14',
      })
    }
    if (ph.from && ph.to && ph.from > ph.to) {
      out.push({
        key: `dt-${ph.id}`,
        say: `«${ph.name}» بدايتها بعد نهايتها.`,
        rule: 'BPD-012',
      })
    }
    /* ⚠️ النشاط لازم يقع **جوّه** مدى مرحلته · نشاط بيخلص بعد
       مرحلته بيخلّي نسبة المرحلة تكمل وهي لسه شغّالة */
    for (const a of ph.activities) {
      if (ph.from && a.from && a.from < ph.from) {
        out.push({
          key: `ab-${a.id}`,
          say: `نشاط «${a.name}» بيبدأ قبل مرحلته.`,
          rule: 'BPD-012',
        })
      }
      if (ph.to && a.to && a.to > ph.to) {
        out.push({
          key: `aa-${a.id}`,
          say: `نشاط «${a.name}» بيخلص بعد مرحلته.`,
          rule: 'BPD-012',
        })
      }
      if (a.needs.length === 0) {
        out.push({
          key: `ev-${a.id}`,
          say: `نشاط «${a.name}» بلا شاهد مطلوب · مفيش حاجة تتراجع عليه.`,
          rule: 'قاعدة 14',
        })
      }
    }
    const w = ph.activities.reduce((s, a) => s + a.weight, 0)
    if (ph.activities.length > 0 && w !== 100) {
      out.push({
        key: `wt-${ph.id}`,
        say: `أوزان أنشطة «${ph.name}» مجموعها ${w} لا 100.`,
        rule: 'BPD-012',
      })
    }
  })

  /* ⚠️ **مجموع المراحل = قيمة المنحة** · نفس انضباط شجرة الميزانية
     وجدول الدفعات. خطة تكلفتها غير المنحة معناها إن جزءًا من المال
     مالوش شغل مكتوب، أو إن الخطة بتعد بشغل مالوش تمويل. */
  const cost = p.phases.reduce((s, ph) => s + ph.cost, 0)
  if (grant > 0 && cost !== grant) {
    out.push({
      key: 'cost',
      say: `مجموع تكلفة المراحل ${cost.toLocaleString('en-US')} وقيمة المنحة ${grant.toLocaleString('en-US')}.`,
      rule: 'BPD-012',
    })
  }

  return out
}

/** الخطة تقدر تتبعت؟ · نفس الدالة للجهة وللمشرف */
export const canSend = (p: PlanRow, grant: number): boolean =>
  planIssues(p, grant).length === 0

/**
 * الخطة مكتملة ⇒ المشروع مؤهَّل للإغلاق.
 *
 * ⚠️ **مؤهَّل لا مُغلَق.** الإغلاق إجراء تاني له قواعده (BPD-011:
 * التقرير الختامي · الاتصال المؤسسي · التقييم). الخطة بترفع
 * **مانعًا**، ما بتعملش الإغلاق · وده فصل الإجراءات نفسه.
 */
export const readyToClose = (p: PlanRow): boolean =>
  p.phases.length > 0 && p.phases.every((ph) => phaseDone(ph) === 100)

/* ═══════════════════ الداتا ═══════════════════ */

/** اليوم في النموذج · نفس اللي باقي الموديولات بتقيس عليه */
export const TODAY = '2026-09-18'

const ev = (id: string, kind: string, fileName: string, at: string): {
  id: string; kind: string; fileName: string; uploadedAt: string; by: string
} => ({ id, kind, fileName, uploadedAt: at, by: 'الجهة المستفيدة' })

const act = (
  id: string, name: string, state: ActivityState, from: string, to: string,
  weight: number, needs: string[], evidence: PlanActivity['evidence'] = [],
  extra: Partial<PlanActivity> = {},
): PlanActivity => ({ id, name, state, from, to, weight, needs, evidence, ...extra })

const phase = (
  id: string, name: string, from: string, to: string, cost: number,
  activities: PlanActivity[],
): PlanPhase => ({ id, name, from, to, cost, activities })

const plan = (
  id: string, projectId: string, stage: PlanStage, baseline: number,
  phases: PlanPhase[], owner: string, openedAt: string, hoursInStage: number,
  extra: Partial<PlanRow> = {},
): PlanRow => {
  const pr = projectRows.find((x) => x.id === projectId)
  return {
    id,
    projectId,
    projectName: pr?.name ?? projectId,
    entityId: pr?.entityId ?? '',
    entityName: pr?.entityName ?? '',
    stage,
    baseline,
    phases,
    owner,
    drafter: 'entity',
    openedAt,
    hoursInStage,
    changes: [],
    ...extra,
  }
}

export const planRows: PlanRow[] = [
  /* خطة ماشية مع جدولها · ومعاها نشاطان مستنّيان مراجعة */
  plan('PL-1021', '20845', 'active', 1, [
    phase('ph1', 'التهيئة والتعاقد', '2026-03-01', '2026-04-30', 380_000, [
      act('a1', 'تشكيل فريق التنفيذ', 'accepted', '2026-03-01', '2026-03-15', 30,
        ['محضر استلام'], [ev('e1', 'محضر استلام', 'team-minutes.pdf', '2026-03-14')],
        { doneAt: '2026-03-16' }),
      act('a2', 'تجهيز المقر والمعدّات', 'accepted', '2026-03-10', '2026-04-10', 40,
        ['صور تنفيذ', 'فاتورة أو سند صرف'],
        [ev('e2', 'صور تنفيذ', 'site-photos.zip', '2026-04-08'),
          ev('e3', 'فاتورة أو سند صرف', 'invoice-1102.pdf', '2026-04-09')],
        { doneAt: '2026-04-11' }),
      act('a3', 'حصر المستفيدين الأوّلي', 'accepted', '2026-04-01', '2026-04-30', 30,
        ['كشف مستفيدين'], [ev('e4', 'كشف مستفيدين', 'benef-list-v1.xlsx', '2026-04-27')],
        { doneAt: '2026-04-29' }),
    ]),
    phase('ph2', 'التنفيذ · الدفعة الأولى', '2026-05-01', '2026-08-31', 1_180_000, [
      act('a4', 'تدريب الكوادر', 'accepted', '2026-05-01', '2026-06-15', 25,
        ['تقرير مرحلي', 'كشف مستفيدين'],
        [ev('e5', 'تقرير مرحلي', 'training-report.pdf', '2026-06-12'),
          ev('e6', 'كشف مستفيدين', 'trainees.xlsx', '2026-06-12')],
        { doneAt: '2026-06-18' }),
      act('a5', 'إطلاق البرنامج في الرياض', 'claimed', '2026-06-01', '2026-07-31', 35,
        ['تقرير مرحلي', 'صور تنفيذ'],
        [ev('e7', 'تقرير مرحلي', 'riyadh-launch.pdf', '2026-08-02'),
          ev('e8', 'صور تنفيذ', 'riyadh-photos.zip', '2026-08-02')]),
      act('a6', 'إطلاق البرنامج في القصيم', 'claimed', '2026-07-01', '2026-08-31', 25,
        ['تقرير مرحلي', 'صور تنفيذ'],
        [ev('e9', 'تقرير مرحلي', 'qassim-launch.pdf', '2026-09-03')]),
      act('a7', 'المتابعة الميدانية الأولى', 'doing', '2026-08-01', '2026-09-30', 15,
        ['تقرير مرحلي']),
    ]),
    phase('ph3', 'القياس والإغلاق', '2026-09-01', '2026-12-31', 240_000, [
      act('a8', 'قياس الأثر', 'todo', '2026-10-01', '2026-11-30', 60, ['تقرير مرحلي']),
      act('a9', 'التقرير الختامي', 'todo', '2026-12-01', '2026-12-31', 40,
        ['تقرير مرحلي', 'مادة إعلامية']),
    ]),
  ], 'سارة القحطاني', '2026-02-18', 36, { baselineAt: '2026-02-26' }),

  /* خطة متأخّرة · نشاطان عدّى موعدهم وما اتقبلوش */
  plan('PL-1018', '20852', 'active', 2, [
    phase('ph1', 'الإعداد', '2026-01-15', '2026-03-15', 700_000, [
      act('a1', 'دراسة الاحتياج', 'accepted', '2026-01-15', '2026-02-15', 50,
        ['تقرير مرحلي'], [ev('e1', 'تقرير مرحلي', 'need-study.pdf', '2026-02-11')],
        { doneAt: '2026-02-14' }),
      act('a2', 'اعتماد المنهجية', 'accepted', '2026-02-10', '2026-03-15', 50,
        ['شهادة أو إفادة جهة'],
        [ev('e2', 'شهادة أو إفادة جهة', 'method-approval.pdf', '2026-03-10')],
        { doneAt: '2026-03-12' }),
    ]),
    phase('ph2', 'التنفيذ', '2026-03-16', '2026-08-31', 1_350_000, [
      act('a3', 'الدفعة الأولى من الورش', 'accepted', '2026-03-16', '2026-05-31', 40,
        ['تقرير مرحلي', 'صور تنفيذ'],
        [ev('e3', 'تقرير مرحلي', 'ws-1.pdf', '2026-05-28'),
          ev('e4', 'صور تنفيذ', 'ws-1.zip', '2026-05-28')],
        { doneAt: '2026-06-02' }),
      act('a4', 'الدفعة الثانية من الورش', 'rejected', '2026-06-01', '2026-07-31', 40,
        ['تقرير مرحلي', 'كشف مستفيدين'],
        [ev('e5', 'تقرير مرحلي', 'ws-2-draft.pdf', '2026-08-05')],
        { note: 'التقرير بلا كشف مستفيدين · والقاعدة بتطلب الاتنين لإثبات العدد.' }),
      act('a5', 'المتابعة الميدانية', 'todo', '2026-07-01', '2026-08-31', 20,
        ['تقرير مرحلي']),
    ]),
  ], 'سارة القحطاني', '2025-12-20', 52, {
    baselineAt: '2026-06-20',
    changes: [{
      id: 'ch1', at: '2026-06-18', by: 'الجهة المستفيدة',
      say: 'تمديد مدة التنفيذ شهرين لتأخّر تسليم المقر من البلدية.',
      state: 'approved',
      note: 'موافقة · التأخير خارج عن الجهة، والنسخة المرجعية بقت 2.',
    }],
  }),

  /* خطة عند مدير المنح · اتراجعت من المشرف */
  plan('PL-1024', '20802', 'manager', 0, [
    phase('ph1', 'التهيئة', '2026-10-01', '2026-11-15', 450_000, [
      act('a1', 'التعاقد مع المدرّبين', 'todo', '2026-10-01', '2026-10-20', 50,
        ['محضر استلام']),
      act('a2', 'تجهيز المواد', 'todo', '2026-10-15', '2026-11-15', 50,
        ['صور تنفيذ']),
    ]),
    phase('ph2', 'التنفيذ', '2026-11-16', '2027-04-30', 1_000_000, [
      act('a3', 'الورش التدريبية', 'todo', '2026-11-16', '2027-03-31', 70,
        ['تقرير مرحلي', 'كشف مستفيدين']),
      act('a4', 'التقرير الختامي', 'todo', '2027-04-01', '2027-04-30', 30,
        ['تقرير مرحلي']),
    ]),
  ], 'سارة القحطاني', '2026-09-02', 78),

  /* خطة عند المشرف · أول مراجعة */
  plan('PL-1025', '20824', 'supervisor', 0, [
    phase('ph1', 'الإعداد', '2026-10-05', '2026-12-05', 750_000, [
      act('a1', 'حصر المستفيدين', 'todo', '2026-10-05', '2026-11-05', 60,
        ['كشف مستفيدين']),
      act('a2', 'تجهيز المقر', 'todo', '2026-11-01', '2026-12-05', 40,
        ['صور تنفيذ']),
    ]),
  ], 'سارة القحطاني', '2026-09-11', 26),

  /* خطة مُعادة للجهة بملاحظة */
  plan('PL-1026', '20831', 'returned', 0, [
    phase('ph1', 'التنفيذ', '2026-11-01', '2027-02-28', 640_000, [
      act('a1', 'الحملة التوعوية', 'todo', '2026-11-01', '2027-02-28', 100,
        ['مادة إعلامية']),
    ]),
  ], 'سارة القحطاني', '2026-09-06', 62, {
    note: 'مرحلة واحدة لأربعة شهور بنشاط واحد · قسّميها لمراحل يتقاس عليها إنجاز.',
  }),

  /* مسودة عند الجهة · لسه بتتكتب.
     ⚠️ ومشروعها **متعثّر** عن قصد: ده بالظبط المشروع اللي الخطة
     موجودة عشانه · ولو كل الأمثلة مشاريع سليمة، الشاشة بتتفحص في
     أحسن حالاتها وحدها. وجهته (774) ليها طلب تسجيل معتمد، فكارت
     «خطط مشاريعك» في بوّابة الجهة بيترسم فعلًا لا يفضل كودًا ميتًا. */
  plan('PL-1027', '20705', 'draft', 0, [
    phase('ph1', 'الإعداد', '2026-11-01', '2026-12-31', 0, []),
  ], 'سارة القحطاني', '2026-09-15', 70, { drafter: 'supervisor' }),

  /* خطة مكتملة · المشروع مؤهَّل للإغلاق */
  plan('PL-1009', '20611', 'done', 1, [
    phase('ph1', 'التنفيذ', '2025-09-01', '2026-05-31', 400_000, [
      act('a1', 'تجهيز المسجد', 'accepted', '2025-09-01', '2026-01-31', 60,
        ['صور تنفيذ', 'فاتورة أو سند صرف'],
        [ev('e1', 'صور تنفيذ', 'mosque.zip', '2026-01-20'),
          ev('e2', 'فاتورة أو سند صرف', 'inv-880.pdf', '2026-01-22')],
        { doneAt: '2026-01-28' }),
      act('a2', 'التشغيل والتسليم', 'accepted', '2026-02-01', '2026-05-31', 40,
        ['محضر استلام'], [ev('e3', 'محضر استلام', 'handover.pdf', '2026-05-18')],
        { doneAt: '2026-05-22' }),
    ]),
  ], 'سارة القحطاني', '2025-08-10', 12, { baselineAt: '2025-08-24' }),
]

export const planById = (id: string): PlanRow | undefined =>
  planRows.find((p) => p.id === id)

export const planOfProject = (projectId: string): PlanRow | undefined =>
  planRows.find((p) => p.projectId === projectId)

export const plansOfEntity = (entityId: string): PlanRow[] =>
  planRows.filter((p) => p.entityId === entityId)

/**
 * المشروع يتطلب خطة؟
 *
 * ⚠️ **قرار مدير المنح قبل الاعتماد، مش خاصية للمشروع.** الوثيقة
 * بتقول «في حالة المشاريع التي تتطلب خطة عمل» · فالقرار بيتاخد
 * مرة وبيحكم وجود إجراء كامل بعده. واللي مالوش خطة ما بينتظرش
 * حاجة، فالإغلاق عنده مانع أقل.
 *
 * في النموذج: المشروع اللي ليه خطة **هو اللي اتقرّر إنه يتطلبها**.
 */
export const needsPlan = (projectId: string): boolean =>
  planRows.some((p) => p.projectId === projectId)

/* ═══════════════════ الأفعال ═══════════════════ */

/**
 * ⚠️ **الأفعال بتغيّر الأراي في مكانه.** النموذج مالوش باك إند،
 * والشاشات بتقرا من نفس المصفوفة · فالفعل لازم يبان في الصندوق
 * وفي صفحة المشروع وفي بوّابة الجهة مرة واحدة.
 */
const touch = (p: PlanRow, stage: PlanStage, note?: string) => {
  p.stage = stage
  p.hoursInStage = 0
  p.note = note
}

export const sendPlan = (id: string): void => {
  const p = planById(id)
  if (p) touch(p, 'supervisor')
}

export const returnPlan = (id: string, note: string): void => {
  const p = planById(id)
  if (p) touch(p, 'returned', note)
}

export const toManager = (id: string): void => {
  const p = planById(id)
  if (p) touch(p, 'manager')
}

/**
 * الاعتماد · **وده اللي بيثبّت النسخة المرجعية**.
 * قبله الهيكل مفتوح، وبعده أي تعديل جوهري بطلب رسمي (قاعدة 21).
 */
export const approvePlan = (id: string): void => {
  const p = planById(id)
  if (!p) return
  p.baseline = p.baseline === 0 ? 1 : p.baseline
  p.baselineAt = TODAY
  touch(p, 'active')
}

/** الجهة بتقول إن النشاط خلص · `claimed` لا `accepted` (قاعدة 14) */
export const claimActivity = (planId: string, actId: string): void => {
  const a = planById(planId)?.phases.flatMap((ph) => ph.activities).find((x) => x.id === actId)
  if (a) { a.state = 'claimed'; a.note = undefined }
}

export const acceptActivity = (planId: string, actId: string): void => {
  const p = planById(planId)
  const a = p?.phases.flatMap((ph) => ph.activities).find((x) => x.id === actId)
  if (!a || !p) return
  a.state = 'accepted'
  a.doneAt = TODAY
  a.note = undefined
  if (readyToClose(p)) p.stage = 'done'
}

export const rejectActivity = (planId: string, actId: string, note: string): void => {
  const a = planById(planId)?.phases.flatMap((ph) => ph.activities).find((x) => x.id === actId)
  if (a) { a.state = 'rejected'; a.note = note }
}

export const addEvidence = (
  planId: string, actId: string, kind: string, fileName: string,
): void => {
  const a = planById(planId)?.phases.flatMap((ph) => ph.activities).find((x) => x.id === actId)
  if (!a) return
  a.evidence = [...a.evidence, {
    id: `ev-${Date.now()}`, kind, fileName, uploadedAt: TODAY, by: 'الجهة المستفيدة',
  }]
}

/** طلب تعديل جوهري · قاعدة 21 */
export const askChange = (planId: string, say: string): void => {
  const p = planById(planId)
  if (!p) return
  p.changes = [...p.changes, {
    id: `ch-${Date.now()}`, at: TODAY, by: 'الجهة المستفيدة', say, state: 'waiting',
  }]
}

export const decideChange = (
  planId: string, changeId: string, ok: boolean, note: string,
): void => {
  const p = planById(planId)
  const c = p?.changes.find((x) => x.id === changeId)
  if (!c || !p) return
  c.state = ok ? 'approved' : 'rejected'
  c.note = note
  /* ⚠️ الموافقة بترفع رقم النسخة · ده اللي بيخلّي «متأخّر عن
     الخطة» جملة لها مرجع معروف، لا مقارنة بخطة اتغيّرت بهدوء */
  if (ok) { p.baseline += 1; p.baselineAt = TODAY }
}

export type { PlanChange }

/* ═══════════════════ مؤشرات الموديول ═══════════════════ */

/**
 * ⚠️ **الوثيقة ما دّتش مؤشرات لـBPD-012** · دول مشتقّون من قواعده
 * نفسها، ومسجَّلون في البريف كـ**افتراض** زي مؤشرات الصرف اللي
 * مستهدفها فاضي. الرقم بيتعرض قيمةً لا حالةً.
 */
export const planKpi = () => {
  const live = planRows.filter((p) => p.stage === 'active' || p.stage === 'done')
  const open = planRows.filter(
    (p) => p.stage === 'supervisor' || p.stage === 'manager' || p.stage === 'returned',
  )

  const spis = live.map((p) => planSpi(p)).filter((v): v is number => v !== null)
  const onTrack = spis.filter((v) => v >= 0.95).length

  const waiting = planRows.reduce((s, p) => s + waitingReview(p).length, 0)
  const late = planRows.reduce((s, p) => s + lateActivities(p).length, 0)
  const acts = planRows.reduce(
    (s, p) => s + p.phases.reduce((x, ph) => x + ph.activities.length, 0), 0,
  )

  /** متوسط مدة الاعتماد بالأيام · من الفتح لتثبيت النسخة المرجعية */
  const approved = planRows.filter((p) => p.baselineAt)
  const days = approved.length === 0 ? 0 : Math.round(
    approved.reduce((s, p) => {
      const a = new Date(p.openedAt).getTime()
      const b = new Date(p.baselineAt as string).getTime()
      return s + (b - a) / 86_400_000
    }, 0) / approved.length,
  )

  return {
    total: planRows.length,
    live: live.length,
    open: open.length,
    waiting,
    late,
    acts,
    approveDays: days,
    onTrackPct: spis.length === 0 ? 0 : Math.round((onTrack / spis.length) * 100),
    latePct: acts === 0 ? 0 : Math.round((late / acts) * 100),
    /** الخطط اللي كل أنشطتها اتقبلت · يعني مشاريع مؤهّلة للإغلاق */
    closable: planRows.filter((p) => readyToClose(p) && p.stage !== 'done').length,
  }
}

/* ═══════════════════ المحرّر ═══════════════════ */

/**
 * ⚠️ **الهيكل بيتقفل بعد الاعتماد · قاعدة 21.**
 * قبل النسخة المرجعية أي حاجة تتعدّل · وبعدها المسموح هو تحديث
 * التنفيذ (حالة النشاط والشواهد) لا تغيير الهيكل. اللي عايز يغيّر
 * مرحلة أو تاريخًا أو تكلفة بيعدّي من طلب تعديل رسمي.
 *
 * والدالة دي هي **المصدر الوحيد** للقرار ده · لو كل شاشة حسبته
 * بنفسها، واحدة منهم هتنساه وتسمح بتعديل صامت على خطة معتمدة.
 */
export const canEditShape = (p: PlanRow): boolean => p.baseline === 0

export const newPhase = (n: number): PlanPhase => ({
  id: `ph-${Date.now()}-${n}`,
  name: '',
  from: '',
  to: '',
  cost: 0,
  activities: [],
})

export const newActivity = (n: number): PlanActivity => ({
  id: `a-${Date.now()}-${n}`,
  name: '',
  state: 'todo',
  from: '',
  to: '',
  weight: 0,
  needs: [],
  evidence: [],
})

/** يكتب الهيكل الجديد · بيتنادى من المحرّر عند الحفظ */
export const savePhases = (id: string, phases: PlanPhase[]): void => {
  const p = planById(id)
  if (p) p.phases = phases
}

/**
 * ⚠️ **توزيع الأوزان بالتساوي · زرار لا سلوك تلقائي.**
 * القاعدة إن مجموع أوزان أنشطة المرحلة = 100، والتلقائي كان
 * هيدوس على وزن كتبه المستخدم بإيده. الزرار بيخلّي التوزيع
 * **قرارًا**، والرسالة بتقول إن المجموع غلط لحدّ ما يتصلّح.
 */
export const evenWeights = (ph: PlanPhase): PlanPhase => {
  const n = ph.activities.length
  if (n === 0) return ph
  const base = Math.floor(100 / n)
  return {
    ...ph,
    activities: ph.activities.map((a, i) => ({
      ...a,
      /* الباقي بيروح لأول نشاط · المجموع لازم يبقى 100 بالظبط */
      weight: i === 0 ? base + (100 - base * n) : base,
    })),
  }
}
