import { CFG, hydrate } from '@/lib/config'
import type {
  ActivityState, PlanActivity, PlanChange, PlanPhase, PlanRow, PlanStage,
} from '@/types/domain'
import { nowStamp } from '@/lib/format'
import { TONE } from '@/lib/tone'
import type { Tone } from '@/types/domain'
import { SCENARIO, projectRows } from './projects'

/* Project execution plan · addresses a significant gap identified during review.

   Per spec: the plan is prepared by the beneficiary entity and approved by the grants officer and
   grants manager, for projects that require a work plan.

   In the live system, the "execution plan" is just an attachment inside the project — a PDF that
   gets uploaded and forgotten. No approval cycle, no activities, no evidence, no progress tracking.
   So the question "is the project on track per its plan?" had no answer anywhere in the system.

   The idea this module is built on

   The plan is an independent action, exactly like the agreement. The system used to treat the
   project as a single thing — the project is the plan is the agreement is the payment is the
   closure, and project status changed based on documents that were really part of something else.

   So the plan proceeds in parallel with the agreement, and its own stage transitions do not change
   the project's status — the same principle used for agreements. A plan can sit with the grants
   manager while its project shows "in progress", and both are correct.

   The most important rule in this module: the entity reports, the officer decides. An activity the
   entity has uploaded evidence for and marked done becomes `claimed`, not `accepted` — and it isn't
   counted toward the completion percentage. Without that separation, the completion percentage
   becomes self-reported, and the organization pays based on claims.

   And `Baseline` isn't a backup — it's the reference that deviation is measured against. Once
   approved, the structure locks, and any material change goes through a formal request approved by
   the grants manager, which bumps the version number. Otherwise an entity that has fallen behind
   could simply edit its own dates and always look compliant on paper. */

export const PLAN_STAGES: {
  key: PlanStage; label: string; who: string; note: string
}[] = [
  { key: 'draft', label: 'مسودة', who: 'الجهة المستفيدة', note: 'قيد الإعداد ولم تُرسل بعد' },
  { key: 'supervisor', label: 'مراجعة مشرف المنح', who: 'مشرف المنح', note: 'مراجعة فنية للمراحل والأنشطة' },
  { key: 'manager', label: 'اعتماد مدير المنح', who: 'مدير المنح', note: 'الاعتماد يثبّت النسخة المرجعية' },
  { key: 'returned', label: 'مُعادة للجهة', who: 'الجهة المستفيدة', note: 'بملاحظات مكتوبة' },
  { key: 'active', label: 'قيد التنفيذ', who: 'الجهة المستفيدة', note: 'أنشطة وشواهد ومراجعة' },
  { key: 'done', label: 'مكتملة', who: '', note: 'المشروع مؤهَّل للإغلاق' },
]

export const planStageLabel = (s: PlanStage): string =>
  PLAN_STAGES.find((x) => x.key === s)?.label ?? s

export const planStageWho = (s: PlanStage): string =>
  PLAN_STAGES.find((x) => x.key === s)?.who ?? ''

export const PLAN_TONE: Record<PlanStage, Tone> = {
  draft: TONE.draft,
  supervisor: TONE.review,
  manager: TONE.review,
  returned: TONE.returned,
  active: TONE.active,
  done: TONE.done,
}

/**
 * Stage time limit in hours · provisional like every duration in the system.
 * The spec gave no duration per milestone — these numbers are assumptions recorded during planning,
 * same as the agreement and disbursement durations.
 */
export const PLAN_LIMIT: Record<PlanStage, number> = hydrate(CFG.planLimits, {
  draft: 336,
  supervisor: 120,
  manager: 96,
  returned: 168,
  active: 0,
  done: 0,
})

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
 * Evidence types · master data.
 * Any dropdown in the system is master data, so it belongs in settings.
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

/* Calculation */

/**
 * Completion is calculated from `accepted` only.
 * `claimed` means "the entity says it's done" — counting it toward the percentage would turn review
 * into self-reporting. This percentage feeds the closure decision, so it must be reviewed, not just
 * announced.
 */
export const phaseDone = (p: PlanPhase): number => {
  const w = p.activities.reduce((s, a) => s + a.weight, 0)
  if (w === 0) return 0
  const got = p.activities
    .filter((a) => a.state === 'accepted')
    .reduce((s, a) => s + a.weight, 0)
  return Math.round((got / w) * 100)
}

/** Overall completion percentage · weighted by stage cost, not stage count */
export const planDone = (p: PlanRow): number => {
  const total = p.phases.reduce((s, ph) => s + ph.cost, 0)
  if (total === 0) return 0
  const got = p.phases.reduce((s, ph) => s + (ph.cost * phaseDone(ph)) / 100, 0)
  return Math.round((got / total) * 100)
}

/**
 * The percentage the entity reports · shown next to the reviewed one, not in place of it.
 * The gap between the two is exactly "work waiting on review", and hiding it would leave the
 * officer unaware they have a backlog.
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
 * The **planned** percentage for today · what should be done if the plan is on schedule.
 * Calculated from reference dates: an activity whose end date has passed should be done, and one
 * within its window is calculated proportionally.
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
 * `SPI` · schedule performance index (actual ÷ planned).
 *
 * A value of exactly one means "on schedule", not "good". The number alone reads as a verdict, so
 * the screen shows both figures behind it — an `SPI` without its two components is a judgment with
 * no support.
 */
export const planSpi = (p: PlanRow, today = TODAY): number | null => {
  const want = planPlanned(p, today)
  if (want === 0) return null
  return Math.round((planDone(p) / want) * 100) / 100
}

export const spiSay = (v: number | null): { say: string; tone: 'ok' | 'warn' | 'no' | 'mute' } => {
  if (v === null) return { say: 'لم يبدأ', tone: 'mute' }
  if (v >= 0.95) return { say: 'وفق الخطة', tone: 'ok' }
  if (v >= 0.8) return { say: 'متأخّر قليلًا', tone: 'warn' }
  return { say: 'متأخّر عن الخطة', tone: TONE.late }
}

/** Activities waiting on officer review · this is their backlog */
export const waitingReview = (p: PlanRow): PlanActivity[] =>
  p.phases.flatMap((ph) => ph.activities.filter((a) => a.state === 'claimed'))

/** Activities past their end date and not yet accepted */
export const lateActivities = (p: PlanRow, today = TODAY): PlanActivity[] =>
  p.phases.flatMap((ph) =>
    ph.activities.filter((a) => a.state !== 'accepted' && a.to < today))

/* Rules checked before actions */

/**
 * Conditions are checked at the action, not at write time.
 * The message states both what and why, since "there's an error" makes the user hunt for what they
 * can't see.
 */
export interface PlanIssue { key: string; say: string; rule: string }

export const planIssues = (p: PlanRow, grant: number): PlanIssue[] => {
  const out: PlanIssue[] = []

  if (p.phases.length === 0) {
    out.push({ key: 'phases', say: 'الخطة بلا مراحل. أضف مرحلة واحدة على الأقل.', rule: 'BPD-012' })
    return out
  }

  p.phases.forEach((ph, i) => {
    if (!ph.name.trim()) {
      out.push({ key: `nm-${ph.id}`, say: `المرحلة ${i + 1} بلا اسم. اكتب اسمًا لها.`, rule: 'BPD-012' })
    }
    if (ph.activities.length === 0) {
      out.push({
        key: `ac-${ph.id}`,
        say: `«${ph.name || `المرحلة ${i + 1}`}» بلا أنشطة · يُقاس إنجاز المرحلة بأنشطتها.`,
        rule: 'قاعدة 14',
      })
    }
    if (ph.from && ph.to && ph.from > ph.to) {
      out.push({
        key: `dt-${ph.id}`,
        say: `تاريخ بداية «${ph.name}» بعد تاريخ نهايتها.`,
        rule: 'BPD-012',
      })
    }
    /* An activity must fall **within** its stage's date range — an activity ending after its stage
       would let the stage's percentage keep climbing while it's supposedly still running */
    for (const a of ph.activities) {
      if (ph.from && a.from && a.from < ph.from) {
        out.push({
          key: `ab-${a.id}`,
          say: `يبدأ نشاط «${a.name}» قبل بداية مرحلته.`,
          rule: 'BPD-012',
        })
      }
      if (ph.to && a.to && a.to > ph.to) {
        out.push({
          key: `aa-${a.id}`,
          say: `ينتهي نشاط «${a.name}» بعد نهاية مرحلته.`,
          rule: 'BPD-012',
        })
      }
      if (a.needs.length === 0) {
        out.push({
          key: `ev-${a.id}`,
          say: `نشاط «${a.name}» بلا شاهد مطلوب · فلا يمكن مراجعة إنجازه.`,
          rule: 'قاعدة 14',
        })
      }
    }
    const w = ph.activities.reduce((s, a) => s + a.weight, 0)
    if (ph.activities.length > 0 && w !== 100) {
      out.push({
        key: `wt-${ph.id}`,
        say: `مجموع أوزان أنشطة «${ph.name}» ${w}، ويلزم أن يساوي 100.`,
        rule: 'BPD-012',
      })
    }
  })

  /* The sum of stages must equal the grant amount — same discipline as the budget tree and payment
     schedule. A plan costing more or less than the grant means either unaccounted-for money or a
     plan promising work with no funding. */
  const cost = p.phases.reduce((s, ph) => s + ph.cost, 0)
  if (grant > 0 && cost !== grant) {
    out.push({
      key: 'cost',
      say: `مجموع تكلفة المراحل ${cost.toLocaleString('en-US')} لا يساوي قيمة المنحة ${grant.toLocaleString('en-US')}.`,
      rule: 'BPD-012',
    })
  }

  return out
}

/** Can the plan be submitted? · same function for both the entity and the officer */
export const canSend = (p: PlanRow, grant: number): boolean =>
  planIssues(p, grant).length === 0

/**
 * Plan complete ⇒ project eligible for closure.
 *
 * Eligible, not closed. Closure is a separate action with its own rules (final report,
 * institutional contact, evaluation). The plan lifts a blocker, it doesn't perform the closure —
 * the same separation of actions as elsewhere.
 */
export const readyToClose = (p: PlanRow): boolean =>
  p.phases.length > 0 && p.phases.every((ph) => phaseDone(ph) === 100)

/* Data */

/** "Today" in the mock · the same reference date every module measures against */
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
  /* An on-track plan with its schedule · two activities waiting on review */
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

  /* A delayed plan · two activities past due and not accepted */
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
        {
          notes: [{
            kind: 'reject',
            by: 'سارة القحطاني',
            at: '2026-08-06T10:20',
            say: 'التقرير بلا كشف مستفيدين · والقاعدة تشترط الاثنين لإثبات العدد.',
          }],
        }),
      act('a5', 'المتابعة الميدانية', 'todo', '2026-07-01', '2026-08-31', 20,
        ['تقرير مرحلي']),
    ]),
  ], 'سارة القحطاني', '2025-12-20', 52, {
    baselineAt: '2026-06-20',
    changes: [{
      id: 'ch1', at: '2026-06-18', by: 'الجهة المستفيدة',
      say: 'تمديد مدة التنفيذ شهرين لتأخّر تسليم المقر من البلدية.',
      state: 'approved',
      note: 'معتمد · التأخير خارج عن إرادة الجهة، وأصبحت النسخة المرجعية 2.',
    }],
  }),

  /* A plan with the grants manager · returned by the officer */
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

  /* A plan with the officer · first review */
  plan('PL-1025', '20824', 'supervisor', 0, [
    phase('ph1', 'الإعداد', '2026-10-05', '2026-12-05', 750_000, [
      act('a1', 'حصر المستفيدين', 'todo', '2026-10-05', '2026-11-05', 60,
        ['كشف مستفيدين']),
      act('a2', 'تجهيز المقر', 'todo', '2026-11-01', '2026-12-05', 40,
        ['صور تنفيذ']),
    ]),
  ], 'سارة القحطاني', '2026-09-11', 26),

  /* A plan returned to the entity with a note */
  plan('PL-1026', '20831', 'returned', 0, [
    phase('ph1', 'التنفيذ', '2026-11-01', '2027-02-28', 640_000, [
      act('a1', 'الحملة التوعوية', 'todo', '2026-11-01', '2027-02-28', 100,
        ['مادة إعلامية']),
    ]),
  ], 'سارة القحطاني', '2026-09-06', 62, {
    note: 'مرحلة واحدة لأربعة أشهر بنشاط واحد · يلزم تقسيمها إلى مراحل يُقاس عليها الإنجاز.',
  }),

  /* A draft still being written by the entity.
     Its project is deliberately stalled: this is exactly the project this feature exists for — if
     every example were a healthy project, the screen would only ever be tested at its best. Its
     entity has an approved registration request, so the "your project plans" card in the entity
     portal actually renders instead of staying dead code. */
  plan('PL-1027', '20705', 'draft', 0, [
    phase('ph1', 'الإعداد', '2026-11-01', '2026-12-31', 0, []),
  ], 'سارة القحطاني', '2026-09-15', 70, { drafter: 'supervisor' }),

  /* A completed plan · project eligible for closure */
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

/* ═══ Scenario plans (meeting 1 Oct, A-6) ═══
   Tops every stage up to three plans. Each one is built for its own project: three phases sized
   from that project's grant, and activity states that follow from the plan's stage — nothing is
   started before approval, a running plan is part-accepted, a done plan is fully accepted. */

const SC_STAGES: PlanStage[] = ['draft', 'supervisor', 'manager', 'returned', 'active', 'done']
const SC_RETURNS = [
  'المرحلة الثانية بلا شاهد محدد لنشاط «التنفيذ الميداني» · أضف نوع الشاهد المطلوب.',
  'تكلفة المرحلة الأولى تتجاوز 40% من المنحة · راجع التوزيع مع جدول الدفعات.',
]

const scDate = (start: string, d: number): string => {
  const t = new Date(`${start}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}

;(() => {
  const pool = SCENARIO.plans.filter((id) => !planRows.some((p) => p.projectId === id))
  let i = 0
  for (const stage of SC_STAGES) {
    while (planRows.filter((p) => p.stage === stage).length < 3 && pool.length) {
      const pid = pool.shift()!
      const pr = projectRows.find((x) => x.id === pid)
      if (!pr) continue
      const k = i++
      const granted = pr.amountGranted || pr.amountRequested
      const approved = stage === 'active' || stage === 'done'
      /* A plan not yet approved starts after "today", or every activity in it reads overdue */
      const start = approved ? scDate(stage === 'done' ? '2025-11-01' : '2026-04-01', (k * 9) % 40) : scDate('2026-10-05', (k * 9) % 40)
      /* Accepted share of each phase · by stage, so the progress bar has something to say */
      const st = (ph: number, a: number): ActivityState =>
        !approved ? 'todo'
          : stage === 'done' ? 'accepted'
            : ph === 0 ? 'accepted'
              : ph === 1 ? (a === 0 ? 'accepted' : k % 2 ? 'claimed' : 'doing')
                : 'todo'
      const evs = (id: string, kind: string, s: ActivityState, at: string) =>
        s === 'accepted' || s === 'claimed' ? [ev(id, kind, `${id}.pdf`, at)] : []
      const shares = [0.25, 0.55, 0.2]
      const names = [
        ['التهيئة والتعاقد', ['تشكيل فريق التنفيذ', 'تجهيز المتطلبات والتوريد']],
        ['التنفيذ', ['التنفيذ الميداني', 'المتابعة والقياس']],
        ['الإغلاق والتسليم', ['تسليم المخرجات', 'إعداد التقرير الختامي']],
      ] as const
      const phases = names.map(([pname, acts], ph) => {
        const from = scDate(start, ph * 60)
        const to = scDate(start, ph * 60 + 55)
        const even = (x: number) => Math.round((granted * x) / 1000) * 1000
        /* The last phase takes the remainder · the phases must sum to the grant exactly */
        const cost = ph < 2 ? even(shares[ph]!) : granted - even(shares[0]!) - even(shares[1]!)
        return phase(`ph${ph + 1}`, pname, from, to, cost,
          acts.map((aname, a) => {
            const s = st(ph, a)
            const at = scDate(from, 20 + a * 15)
            return act(`a${ph * 2 + a + 1}`, aname, s, scDate(from, a * 20), scDate(from, a * 20 + 30), 50,
              [a === 0 ? 'محضر استلام' : 'صور تنفيذ'], evs(`e${ph * 2 + a + 1}`, a === 0 ? 'محضر استلام' : 'صور تنفيذ', s, at),
              s === 'accepted' ? { doneAt: scDate(at, 2) } : {})
          }))
      })
      planRows.push(plan(`PL-${1100 + k}`, pid, stage, approved ? 1 : 0, phases, pr.owner ?? 'عمر قاسم', start,
        stage === 'done' ? 0 : 24 + ((k * 61) % 400), {
          ...(approved ? { baselineAt: scDate(start, -10) } : {}),
          ...(stage === 'returned' ? { note: SC_RETURNS[k % SC_RETURNS.length] } : {}),
          drafter: k % 4 === 3 ? 'supervisor' : 'entity',
        }))
    }
  }
})()

export const planById = (id: string): PlanRow | undefined =>
  planRows.find((p) => p.id === id)

export const planOfProject = (projectId: string): PlanRow | undefined =>
  planRows.find((p) => p.projectId === projectId)

export const plansOfEntity = (entityId: string): PlanRow[] =>
  planRows.filter((p) => p.entityId === entityId)

/**
 * Does the project require a plan?
 *
 * A decision made by the grants manager before approval, not a property of the project. The spec
 * applies it for projects that require a work plan — the decision is made once and governs a whole
 * subsequent action. A project without a plan has one less thing to wait on, so it has fewer
 * blockers to closure.
 *
 * In the mock: a project has a plan because it was decided that it requires one.
 */
export const needsPlan = (projectId: string): boolean =>
  planRows.some((p) => p.projectId === projectId)

/* Actions */

/**
 * Actions mutate the array in place. This mock has no backend, and every screen reads from the same
 * array — an action must be reflected in the card, the project page, and the entity portal all at
 * once.
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
 * Approval · this is what locks in the baseline. Before it the structure stays open; after it, any
 * material change requires a formal request.
 */
export const approvePlan = (id: string): void => {
  const p = planById(id)
  if (!p) return
  p.baseline = p.baseline === 0 ? 1 : p.baseline
  p.baselineAt = TODAY
  touch(p, 'active')
}

/** The entity marks an activity done · `claimed`, not `accepted` */
export const claimActivity = (planId: string, actId: string): void => {
  const a = planById(planId)?.phases.flatMap((ph) => ph.activities).find((x) => x.id === actId)
  /* Notes aren't cleared when the activity is resubmitted — they're a record, and the officer
     reviewing the second submission needs to see why the first was rejected */
  if (a) a.state = 'claimed'
}

export const acceptActivity = (planId: string, actId: string): void => {
  const p = planById(planId)
  const a = p?.phases.flatMap((ph) => ph.activities).find((x) => x.id === actId)
  if (!a || !p) return
  a.state = 'accepted'
  a.doneAt = TODAY
  if (readyToClose(p)) p.stage = 'done'
}

/** Rejection with its reason · recorded with who rejected it and when */
export const rejectActivity = (planId: string, actId: string, note: string, by: string): void => {
  const a = planById(planId)?.phases.flatMap((ph) => ph.activities).find((x) => x.id === actId)
  if (!a) return
  a.state = 'rejected'
  a.notes = [...(a.notes ?? []), { kind: 'reject', by, at: nowStamp(), say: note, from: 'staff' }]
}

/**
 * A comment on the activity · from either side.
 *
 * A comment doesn't change the activity's status. Rejection is a decision, a comment is discussion
 * — the entity can respond to a rejection reason, a manager can add their view, and the activity
 * stays in its state until someone makes a decision.
 */
export const commentActivity = (
  planId: string, actId: string, say: string, by: string, from: 'staff' | 'entity' = 'staff',
): void => {
  const a = planById(planId)?.phases.flatMap((ph) => ph.activities).find((x) => x.id === actId)
  if (!a) return
  a.notes = [...(a.notes ?? []), { kind: 'comment', by, at: nowStamp(), say, from }]
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

/** Request for a material change */
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
  /* Approval bumps the version number — this is what makes "behind the plan" a statement with a
     known reference point, rather than a comparison against a plan that quietly changed */
  if (ok) { p.baseline += 1; p.baselineAt = TODAY }
}

export type { PlanChange }

/* Module indicators */

/**
 * The spec gave no indicators for this feature — these are derived from its own rules and recorded
 * as an assumption, same as the disbursement indicators with an empty target. The number is
 * displayed as a value, not a verdict.
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

  /** Average approval duration in days · from opening to locking in the baseline */
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
    /** Plans whose activities are all accepted · i.e. projects eligible for closure */
    closable: planRows.filter((p) => readyToClose(p) && p.stage !== 'done').length,
  }
}

/* Editor */

/**
 * The structure locks after approval.
 * Before the baseline, anything can be edited; after it, only execution updates are allowed
 * (activity status and evidence), not structural changes. Changing a stage, date, or cost requires
 * a formal change request.
 *
 * This function is the single source of that decision — if every screen computed it independently,
 * one of them would eventually forget and allow a silent edit to an approved plan.
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

/** Writes the new structure · called by the editor on save */
export const savePhases = (id: string, phases: PlanPhase[]): void => {
  const p = planById(id)
  if (p) p.phases = phases
}

/**
 * Equal weight distribution is a button, not automatic behavior.
 * The rule is that a stage's activity weights sum to 100, and doing this automatically would
 * overwrite a weight the user typed in by hand. The button makes distribution a deliberate action,
 * and the message states the total is wrong until it's fixed.
 */
export const evenWeights = (ph: PlanPhase): PlanPhase => {
  const n = ph.activities.length
  if (n === 0) return ph
  const base = Math.floor(100 / n)
  return {
    ...ph,
    activities: ph.activities.map((a, i) => ({
      ...a,
      /* The remainder goes to the first activity · the total must equal exactly 100 */
      weight: i === 0 ? base + (100 - base * n) : base,
    })),
  }
}

/**
 * Opens a plan for a project · returns its id.
 *
 * Opens an empty draft, not a complete plan. The decision made here is "this project requires a
 * work plan" — stages and activities are filled in afterward, in the editor, by the entity or by
 * the officer on its behalf. Combining the decision with the data entry would turn the screen into
 * a long form before anyone has actually decided anything.
 *
 * A project has only one plan. If one already exists, its id is returned instead of opening another
 * — two plans for one project would mean two baselines, and deviation would end up measured against
 * whichever one is convenient.
 */
export const openPlan = (projectId: string, drafter: 'entity' | 'supervisor'): string => {
  const has = planOfProject(projectId)
  if (has) return has.id

  const pr = projectRows.find((x) => x.id === projectId)
  const id = `PL-${1030 + planRows.length}`
  planRows.push({
    id,
    projectId,
    projectName: pr?.name ?? projectId,
    entityId: pr?.entityId ?? '',
    entityName: pr?.entityName ?? '',
    stage: 'draft',
    baseline: 0,
    phases: [],
    owner: pr?.owner ?? 'سارة القحطاني',
    drafter,
    openedAt: TODAY,
    hoursInStage: 0,
    changes: [],
  })
  return id
}
