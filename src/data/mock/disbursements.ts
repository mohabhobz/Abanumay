import { CFG, hydrate } from '@/lib/config'
import type { PayCheck, PayEvent, PayRequest, PayState } from '@/types/domain'
import { AWAITING_AGREEMENT, SCENARIO, projectRows } from './projects'
import { entityById } from './entities'
import { agreements } from './agreements'

/* Disbursement requests · built on the procedures document, not on the live system

   The document is the basis here. The live system runs seven sections and two extra documents (the
   receipt voucher and the ledger entry) after the transfer; the document describes four stages
   ending at the transfer. Where they differ, the differences are recorded as numbered notes with
   the design impact of each possible answer, so nothing is lost and nothing is guessed.

   What IS taken from the live system is the size: about 72 open disbursement transactions, not
   thousands. That single number decides the screen: a decision card beats a table row, and full
   context beats density.

   Every request carries the checks the document actually names, so a blocked request says WHICH
   rule blocks it:
     rule 3  attachments complete
     rule 6  the payment's own condition met
     rule 10 the agreement is in force
     rule 11 the reserved amount is still available
   Plus the approved bank account, which the document names in its second output ("disbursing the
   payment to the approved bank account") and which the live system names as its only defined reason
   for sending a permit back. */

/** Request statuses · states who's holding it, not "paid / unpaid" */
export const PAY_STATES: { key: PayState; label: string; who: string; steps: string }[] = [
  { key: 'supervisor', label: 'بانتظار مشرف المنح', who: 'مشرف المنح', steps: '4–7' },
  { key: 'returned', label: 'مُعاد للاستكمال', who: 'الجهة المستفيدة', steps: '10–11' },
  { key: 'manager', label: 'بانتظار مدير المنح', who: 'مدير المنح', steps: '12–13' },
  { key: 'finance', label: 'بانتظار الإدارة المالية', who: 'الإدارة المالية', steps: '14–17' },
  { key: 'paid', label: 'تم الصرف', who: '', steps: '18–19' },
]

export const payStateLabel = (s: PayState): string =>
  PAY_STATES.find((x) => x.key === s)?.label ?? 'مغلق'

export const payStateWho = (s: PayState): string =>
  PAY_STATES.find((x) => x.key === s)?.who ?? ''

/**
 * Stage limit in hours · sourced from the escalation mechanism (9.5), which states that the day
 * count per stage comes **from settings**. These numbers are provisional until the Foundation gives
 * us the durations, like the empty "target value" in the indicators.
 */
export const PAY_LIMIT: Record<PayState, number> = hydrate(CFG.payLimits, {
  supervisor: 120,
  returned: 240,
  manager: 96,
  finance: 72,
  paid: 0,
  closed: 0,
})

/** Escalation · delayed once past the limit, stalled once past double it */
export type PayHeat = 'ok' | 'late' | 'stuck'

export const payHeat = (r: PayRequest): PayHeat => {
  const lim = PAY_LIMIT[r.state]
  if (!lim) return 'ok'
  if (r.hoursInState > lim * 2) return 'stuck'
  if (r.hoursInState > lim) return 'late'
  return 'ok'
}

/** A request is held if even one condition isn't met · rules 3, 6, 10, and 11 */
export const payBlocked = (r: PayRequest): boolean =>
  r.checks.some((c) => !c.ok) || !r.bank.active

const BANKS = ['مصرف الراجحي', 'مصرف الإنماء', 'بنك البلاد', 'البنك الأهلي السعودي', 'بنك الرياض']

/** Bank account status as two filter options · the document's second output requires it approved */
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
  'التنفيذ متقدّم على الجدول بأسبوعين',
  'الفواتير المرفقة لا تحمل رقم المشروع',
]

const RETURN_NOTES = [
  'التقرير المرفق ناقص · يلزم إرفاق كشف المستفيدين',
  'الفواتير غير مختومة من الجهة',
  'قيمة الطلب أعلى من الدفعة المعتمدة في الجدول',
  'المرفق صورة غير واضحة · يلزم رفعه مرة أخرى',
]

/* A fixed generator · same data on every run, so visual comparison works */
let seed = 909
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T,>(a: readonly T[]): T => a[int(0, a.length - 1)] as T

/* Warning: **the ratios come from the live system, and the count from the mock's capacity.**
   The original numbers (26 · 6 · 9 · 12 · 19 = 72) are the live system's sizes, and it has
   thousands of projects. This mock has thirty projects, and each agreement's disbursements run from
   two to four, with the last one left with no request, so the real capacity is much smaller than
   72.

   Cramming 72 into that capacity would give one project three open requests at once — a number that
   reads fine in a box and lies about reality. Worse, an empty attempt was eating into the stage's
   share, so the plan came out 17/2/0/0/0: the early stages swallowed the projects and the last ones
   ended up completely empty, and indicators 2 and 3 came out as zeros because not a single request
   was spent.

   So the ratios are the ones taken from the live system (36% · 8% · 13% · 17% · 26%), and the count
   is computed from the actual capacity at run time. */
const MIX: { state: PayState; share: number }[] = [
  { state: 'supervisor', share: 0.36 },
  { state: 'returned', share: 0.08 },
  { state: 'manager', share: 0.13 },
  { state: 'finance', share: 0.17 },
  { state: 'paid', share: 0.26 },
]

const checksFor = (state: PayState, cond: boolean): PayCheck[] => {
  /* The stage decides which conditions the system checks · rules 10 and 11 are checked before
     referral to finance, so they only show as information on a request still with the supervisor. */
  const base: PayCheck[] = [
    { label: 'المرفقات والمستندات مكتملة', ok: rnd() > 0.18, rule: 3 },
  ]
  if (cond) base.push({ label: 'شرط الدفعة مستوفى', ok: rnd() > 0.22, rule: 6 })
  base.push({ label: 'الاتفاقية سارية', ok: rnd() > 0.05, rule: 10 })
  base.push({ label: 'المبلغ المحجوز متوفّر', ok: rnd() > 0.08, rule: 11 })
  if (state === 'paid') return base.map((c) => ({ ...c, ok: true }))
  return base
}

/* -- Attachments and audit log --
   Rule 21 requires documents to be stored **tied to the request**, not somewhere else, and rule 16
   requires an audit log for every action. Neither of these is decoration on the request page —
   they're what lets a reviewer say "why did this request end up here" instead of asking the person
   before them. */

/* Warning: **the name, with its extension.** `DocFile` reads content type from the extension and
   draws a thumbnail accordingly: a lined page for a document, a grid for a spreadsheet, an image
   block for a picture. A name with no extension makes every attachment show as a PDF, so a reviewer
   doesn't know "beneficiary list" is a spreadsheet and "execution photos" are images until they
   open them. Same rule as the project and entity attachments. */
const DOC_KINDS = [
  { name: 'التقرير المرحلي.pdf', kind: 'تقرير' },
  { name: 'كشف المستفيدين.xlsx', kind: 'كشف' },
  { name: 'فواتير المرحلة السابقة.pdf', kind: 'فواتير' },
  { name: 'صور التنفيذ.jpg', kind: 'صور' },
  { name: 'سند التعهّد الموقّع.pdf', kind: 'سند' },
]

/** The steps each stage passes through · sourced from the steps table itself */
const PASSED: Record<PayState, number[]> = {
  supervisor: [1, 2, 3, 4],
  returned: [1, 2, 3, 4, 5, 6, 7, 10],
  manager: [1, 2, 3, 4, 5, 6, 7, 12],
  finance: [1, 2, 3, 4, 5, 6, 7, 12, 13, 14],
  paid: [1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15, 16, 17, 18, 19],
  closed: [1, 2, 3, 4, 15],
}

/** The text for each log step · the actor, the action, and the notification sent with it */
const STEP_SAY: Record<number, { role: string; what: string; notified?: string }> = {
  1: { role: 'النظام', what: 'أتاح إنشاء طلب الصرف · استحقت الدفعة واستُوفيت شروط التقديم' },
  2: { role: 'الجهة المستفيدة', what: 'أنشأت طلب الصرف وأرفقت التقارير والمستندات' },
  3: { role: 'النظام', what: 'تحقّق من اكتمال البيانات والمتطلبات الإلزامية' },
  4: { role: 'النظام', what: 'أرسل الطلب إلى مشرف المنح', notified: 'مشرف المنح · طلب صرف جديد' },
  5: { role: 'مشرف المنح', what: 'راجع الطلب وتحقّق من المتطلبات والتقارير' },
  6: { role: 'الذكاء الاصطناعي', what: 'حلّل التقارير وقارن الإنجاز بخطة التنفيذ' },
  7: { role: 'مشرف المنح', what: 'سجّل التوصية' },
  10: { role: 'النظام', what: 'حدّث حالة الطلب وأشعر الجهة بالملاحظات', notified: 'الجهة المستفيدة · الطلب مُعاد للاستكمال' },
  12: { role: 'النظام', what: 'أرسل الطلب إلى مدير المنح', notified: 'مدير المنح · طلب بانتظار الاعتماد' },
  13: { role: 'مدير المنح', what: 'راجع الطلب واعتمده' },
  14: { role: 'النظام', what: 'تحقّق من سريان الاتفاقية وتوفّر المبلغ المحجوز، ثم أرسل الطلب إلى الإدارة المالية', notified: 'الإدارة المالية · طلب بانتظار أمر الصرف' },
  15: { role: 'الإدارة المالية', what: 'راجعت الطلب واعتمدت أمر الصرف' },
  16: { role: 'النظام', what: 'أنشأ أمر الصرف وربطه بالمشروع والاتفاقية والدفعة ومصادر التمويل' },
  17: { role: 'الإدارة المالية', what: 'نفّذت التحويل إلى الحساب البنكي المعتمد' },
  18: { role: 'النظام', what: 'حدّث حالة الدفعة إلى (تم الصرف) وحوّل المبلغ من محجوز إلى مصروف' },
  19: { role: 'النظام', what: 'أشعر الجهة بتنفيذ الصرف', notified: 'الجهة المستفيدة · نُفّذ الصرف' },
}

/** Log dates are generated backward from the creation date, a day per step */
const dayAfter = (iso: string, n: number): string => {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Projects that have passed the agreement stage · rule 1: disbursement only after activation */
/* Scenario projects (meeting 1 Oct, A-6) stay out of the share-based mix · they only top up a
   state left with fewer than three requests, so the sample's own requests keep their ids */
const SCENARIO_IDS = new Set([...SCENARIO.agreements, ...SCENARIO.closing])
const MIN_PER_STATE = 4

/* 9.1.input-1 · 9.4.1 · a request sits only on a project in execution whose agreement is in force ·
   a project still at its agreement stage, or whose agreement row isn't active, never carries one */
const agreementActive = (id: string): boolean => {
  const rows = agreements.filter((a) => a.projectId === id)
  return !rows.length || rows.some((a) => a.stage === 'active')
}
const eligible = projectRows.filter(
  (p) => !SCENARIO_IDS.has(p.id) && !AWAITING_AGREEMENT.has(p.id) && p.statusGroup === 'في التشغيل' &&
    !p.stage.includes('الإتفاقي') && agreementActive(p.id),
)

/* Warning: **the disbursement count is a property of the agreement, not of the request.**
   `of` used to be generated per request independently, so the same project would show a request
   labeled "disbursement 2 of 2" next to "disbursement 1 of 4" — two different schedules for one
   agreement. This bug never showed up in the disbursements inbox at all (each card reads on its own
   and each one is internally consistent), and it showed up only once the request-creation screen
   asked for **the whole schedule** and found itself reading `of` from the first request and
   ignoring the rest. The schedule is now defined once per project, here. */
const SCHEDULE = new Map<string, number>()
const scheduleOf = (projectId: string): number => {
  const known = SCHEDULE.get(projectId)
  if (known) return known
  const of = pick([2, 2, 3, 3, 4, 4])
  SCHEDULE.set(projectId, of)
  return of
}

/** Disbursements held per project · rule 4: one per number */
const TAKEN = new Map<string, Set<number>>()

export const payRequests: PayRequest[] = (() => {
  const out: PayRequest[] = []

  /* Actual capacity · the total requestable disbursements across all eligible projects, once the
     last disbursement is reserved in multi-disbursement agreements */
  const capacity = eligible.reduce((sum, p) => {
    const of = scheduleOf(p.id)
    return sum + (of > 1 ? of - 1 : of)
  }, 0)

  /* Plan = ratios x capacity · the remainder from the division goes to the largest bucket so the
     total matches the capacity exactly rather than falling short */
  const PLAN = MIX.map((m) => ({ state: m.state, n: Math.floor(capacity * m.share) }))
  const spare = capacity - PLAN.reduce((s, x) => s + x.n, 0)
  if (PLAN[0]) PLAN[0].n += spare

  let n = 0
  for (const { state, n: count } of PLAN) {
    for (let i = 0; i < count; i++) {
      /* Warning: **looking for a project that still has an open disbursement slot, not skipping
         ahead.**
         It used to `continue` once a project filled up — the result being that an empty attempt was
         eating into the stage's share, so the plan of 26/6/9/12/19 came out 17/2/0/0/0: the early
         stages swallowed the projects and the last ones ended up completely empty, and indicators 2
         and 3 came out as zeros because not a single request was spent. A counter read from a loop
         that skips ahead lies about the plan, and nothing checks for that — the plan says 72 and
         the screen shows 19, and both are 'working.' */
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
        /* Warning: the last disbursement stays **with no request** in multi-disbursement
           agreements. Not a mock embellishment: the final disbursement comes after the closing
           report, so an agreement where every disbursement has an open request is the rare case,
           not the rule. Without this, the request-creation screen would open on a schedule with
           every row already closed, a correct screen describing an impossible world. */
        const candCap = candOf > 1 ? candOf - 1 : candOf
        if (candTaken.size >= candCap) continue
        p = cand; taken = candTaken; of = candOf; cap = candCap
        break
      }
      if (!p) break
      const e = entityById(p.entityId)
      /* Rule 4 · one open request per disbursement · so the number never repeats */
      let no = int(1, cap)
      while (taken.has(no)) no = (no % cap) + 1
      taken.add(no)
      const granted = p.amountGranted || p.amountRequested
      /* Disbursement = its share of the approved amount · the last one takes the remainder so the
         total equals the grant exactly (rule 14 and agreement rule 8) */
      const even = Math.round(granted / of / 1000) * 1000
      const due = no === of ? granted - even * (of - 1) : even
      const cond = rnd() > 0.35
      const lim = PAY_LIMIT[state] || 120
      /* The distribution is deliberate: most requests within the limit, a few delayed, and fewer
         stalled — a real inbox isn't all red */
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
        /* Usually a single source · multiple sources is exactly what rule 12 addresses */
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
        /* Warning: the creation date is **tied to the due date**: an entity requests disbursement
           two to three weeks before the disbursement is due, not in some random month. When it was
           independent, requests came out **after** the disbursement was already two months overdue,
           and every indicator is computed from that gap. */
        at: dayAfter(
          `2026-0${dueMonth}-${String(dueDay).padStart(2, '0')}`,
          /* The range is deliberately wide: an entity that requests two weeks ahead pays on time,
             and one that requests two days ahead runs late no matter how fast processing is —
             indicator 4 measures exactly this. A narrow range would give 100% on time, a ratio that
             never happens in any real system. */
          -int(2, 26),
        ),
        /* Rule 10 · the agreement and whether it's in force are shown on the request, not inferred */
        agreement: {
          id: `AG-${p.id.replace(/\D/g, '').slice(-5)}`,
          active: rnd() > 0.05,
          endsAt: `2027-0${int(1, 9)}-${String(int(1, 28)).padStart(2, '0')}`,
        },
        granted,
        /* Amount spent before this disbursement · rule 14 measures the ceiling against it */
        spent: even * (no - 1),
        reserved: due,
        docs: [],
        log: [],
        /* Warning: the transfer date is derived from the due date, not independent of it · it used
           to be a fixed date in September, so every disbursement due in June came out late and
           "disbursement-schedule compliance" dropped to 16% — a number that reads as a disaster and
           is really a side effect of the generator, not information. */
        paidAt: undefined,
      })
      n++
    }
  }
  /* Top-up · a state short of three takes a copy of one of its own requests, moved onto a
     scenario project with that project's own amounts */
  const pool = SCENARIO.payments.map((id) => projectRows.find((p) => p.id === id)).filter((p) => !!p)
  for (const { state } of MIX) {
    /* A state the mix left empty borrows any request as its shape · its own state, checks and note */
    const own = out.find((r) => r.state === state)
    const tpl = own ?? out[0]
    while (tpl && out.filter((r) => r.state === state).length < MIN_PER_STATE && pool.length) {
      const p = pool.shift()!
      const granted = p.amountGranted || p.amountRequested
      const due = Math.round(granted / tpl.of / 1000) * 1000
      const cond = Boolean(tpl.condition)
      out.push({
        ...structuredClone(tpl),
        state,
        hoursInState: state === 'paid' ? 0 : tpl.hoursInState,
        checks: own ? structuredClone(tpl.checks) : checksFor(state, cond),
        note: state === 'returned' ? (tpl.note ?? pick(RETURN_NOTES)) : undefined,
        ai: state === 'paid' ? undefined : (tpl.ai ?? pick(AI_NOTES)),
        id: `SR-2026-${String(11_400 + n).padStart(5, '0')}`,
        projectId: p.id,
        projectName: p.name,
        entityId: p.entityId,
        entityName: entityById(p.entityId)?.name ?? p.entityName,
        owner: p.owner ?? tpl.owner,
        granted, due, asked: due, reserved: due,
        spent: due * (tpl.no - 1),
        agreement: { ...tpl.agreement, id: `AG-${p.id}` },
      })
      n++
    }
  }
  /* Attachments and the audit log · built after the request is complete, so the log reads from the
     request's own status rather than separate values */
  for (const r of out) {
    const n = 2 + Math.floor(rnd() * 3)
    r.docs = DOC_KINDS.slice(0, n).map((d, i) => ({
      name: d.name,
      kind: d.kind,
      at: dayAfter(r.at, i),
      size: `${int(120, 4800)} ك.ب`,
    }))

    /* Warning: **one timeline for the request, with the log and the transfer reading from it.**
       Each one used to be generated independently: the log a day per step from the creation date,
       and the transfer date derived from the due date, so indicator 3 (from manager approval to
       transfer) came out as **64 days**, a gap between two dates with no relation to each other at
       all. The number reads as an operational disaster and is a side effect of the generator. Same
       family of bug that hit "disbursement-schedule compliance" earlier.

       And steps don't take the same time either: system steps (referral, validation, status update)
       happen instantly, while the ones taking days are the human steps. So the gap is computed per
       step, not by index. */
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
      /* Step 7 has two outputs · the text follows what actually happened, not a fixed one */
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

  /* Transfer date = the last day in the request's log, not a separate number next to it. And
     disbursement-schedule compliance (indicator 4) is measured by comparing it to the due date, so
     the indicator now measures **the gap between the timeline and the schedule**, not a gap between
     two generated numbers. */
  for (const r of out) {
    if (r.state !== 'paid') continue
    r.paidAt = r.log[r.log.length - 1]?.at
  }
  return out
})()

/* Performance indicators · 9.8
   All four are from the document, and **the "target value" column is empty in all of them** — so
   the number is shown as a value, not a status, and isn't colored, until the Foundation gives us
   the targets. */

/**
 * Target duration for processing a request fully · the sum of the four stage limits. Provisional
 * like every duration in the procedure, since the escalation mechanism says the day counts come
 * **from settings** and the Foundation hasn't given us the numbers yet.
 */
export const PAY_TARGET_DAYS = Math.round(
  (PAY_LIMIT.supervisor + PAY_LIMIT.manager + PAY_LIMIT.finance) / 24,
)

/** Days between two dates in YYYY-MM-DD format */
const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** The four indicators over a scope · the whole inbox by default, or a filtered slice of it
    (e.g. one entity's requests). */
export const payKpi = (list: PayRequest[] = payRequests) => {
  const open = list.filter((r) => r.state !== 'paid' && r.state !== 'closed')
  const paid = list.filter((r) => r.state === 'paid')
  const onTime = paid.filter((r) => (r.paidAt ?? '') <= r.dueAt).length
  /* Indicator 2 · completed **within the target duration** · from creation to transfer, not against
     the due date (that's indicator 4) · two different indicators that are easy to mix up because
     both are a ratio over what's been spent */
  const inTarget = paid.filter(
    (r) => r.paidAt && daysBetween(r.at, r.paidAt) <= PAY_TARGET_DAYS,
  ).length
  /* Indicator 3 · from **the grants manager's approval** (step 13) to executing the transfer (step
     17) · not from the request's creation */
  const finance = paid
    .map((r) => {
      const approved = r.log.find((e) => e.step === 13)
      return approved && r.paidAt ? daysBetween(approved.at, r.paidAt) : null
    })
    .filter((x): x is number => x !== null && x >= 0)
  return {
    /** Count of open requests · not an indicator in the document, but it's the inbox's size */
    open: open.length,
    /** Value of open requests */
    openSum: open.reduce((s, r) => s + r.asked, 0),
    /** Indicator 1 · average disbursement-request processing time (days) */
    avgDays: list.length
      ? Math.round(list.reduce((s, r) => s + r.hoursInState, 0) / list.length / 24)
      : 0,
    /** Indicator 2 · share of requests completed within the target duration */
    inTarget: paid.length ? Math.round((inTarget / paid.length) * 100) : 0,
    /**
     * Indicator 3 · average time to execute the financial disbursement · manager approval ->
     * transfer
     */
    financeDays: finance.length
      ? Math.round(finance.reduce((s, d) => s + d, 0) / finance.length)
      : 0,
    /** Indicator 4 · disbursement-schedule compliance rate */
    onSchedule: paid.length ? Math.round((onTime / paid.length) * 100) : 0,
    /** Delayed and stalled · escalation 9.5, item 3 */
    late: open.filter((r) => payHeat(r) === 'late').length,
    stuck: open.filter((r) => payHeat(r) === 'stuck').length,
    /** Held pending a condition · rules 3, 6, 10, and 11 */
    blocked: open.filter(payBlocked).length,
  }
}

/* Disbursement schedule · request-creation screen
   The screen where the entity creates a request isn't a blank form — it's **the approved
   disbursement schedule** (the document's second output), with every disbursement shown by its
   status. That's what lets four rules be enforced through the display rather than through
   validation:

     Rule 1 · no request before the agreement is activated and "in progress"
     Rule 2 · the request is for **due** disbursements only, the rest are shown and disabled
     Rule 4 · a disbursement with an open request can't take another
     Rule 6 · a conditional disbursement isn't sent before its condition is met

   Step 1 says "the system **allows** creation once due and conditions are met" — so availability
   itself is information that's shown, not a button that rejects after being clicked. */

export type PaySlotState =
  /** Due and ready to request */
  | 'open'
  /** Not yet due · rule 2 */
  | 'early'
  /** Has an open request · rule 4 */
  | 'pending'
  /** Spent */
  | 'paid'
  /** Due but its condition isn't met · rule 6 */
  | 'held'
  /** The project was stopped by an approved decision · 10.9.1 · 10.9.4 */
  | 'stopped'
  /** Won't be paid · the obligation was settled before closing · 10.4.2 */
  | 'settled'

export interface PaySlot {
  no: number
  of: number
  amount: number
  dueAt: string
  condition?: string
  conditionMet: boolean
  state: PaySlotState
  /** The request tied to the disbursement, if any */
  requestId?: string
}

/** "Today" in the mock · fixed so the schedule doesn't change on every run */
export const TODAY = '2026-09-14'

export const PAY_SLOT_SAY: Record<PaySlotState, { label: string; why: string; rule?: number }> = {
  open: { label: 'مستحقة', why: 'جاهزة لإنشاء طلب صرف' },
  early: { label: 'لم تستحق', why: 'يُقدَّم الطلب للدفعات المستحقة وفق الجدول المعتمد فقط', rule: 2 },
  pending: { label: 'لها طلب مفتوح', why: 'لا يُفتح لكل دفعة أكثر من طلب صرف واحد', rule: 4 },
  paid: { label: 'مصروفة', why: 'اكتمل تحويلها' },
  held: { label: 'موقوفة بشرط', why: 'لا يُرسل طلب الدفعة المرتبطة بتقارير قبل استيفائها', rule: 6 },
  stopped: { label: 'موقوفة بقرار', why: 'أُوقف المشروع بقرار معتمد من الرئيس التنفيذي · لا صرف بعده (10.9.1)' },
  settled: { label: 'مسوّاة', why: 'سُوّي الالتزام فلا تُصرف الدفعة · يُحرَّر محجوزها عند الإغلاق (10.4.2)' },
}

/* 8.2.31 · an agreement activated in the system opens disbursement · registered by the agreements
   store, so this mock doesn't import it */
let agreementGate: (projectId: string) => boolean = () => false
export const setAgreementGate = (f: (projectId: string) => boolean): void => { agreementGate = f }
export const agreementInForce = (projectId: string): boolean => agreementGate(projectId)

export const payByState = (s: PayState): PayRequest[] =>
  payRequests.filter((r) => r.state === s)

export const payRequestById = (id: string): PayRequest | undefined =>
  payRequests.find((r) => r.id === id)
