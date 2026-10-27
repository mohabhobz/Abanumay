/* 17 Oct · the assistant's «الحل المقترح» on every action point.

   The assistant reads the record's own checks and tells the employee what the best next step is,
   with why, and lays out the seat's options inside the assistant card. **It never acts on its
   own** (client, 17 Oct: it suggests, the employee decides) — an option runs only when the employee
   presses it, through the same store call as the dock's button, under the employee's own name. So
   every rule, seat and stop still holds.

   The rule: no issue found → the forward exit is the suggestion. Issues found → the return for
   completion, with the issues written as its note. Nothing fits → it says what holds the step.
   A final exit (rejection · cancellation · decline) is never the suggestion and stays in the dock,
   where its reason is written. */

export interface AgentAct { label: string; kind?: string; needsNote?: boolean; needsFile?: string | boolean; needsAmount?: boolean }

export interface SuggestOpt<A extends AgentAct> {
  action: A
  /** The suggested one */
  best: boolean
  /** Why it can't run from the assistant now · the dock is where it runs then */
  blocked?: string
  /** The note it carries when pressed here · the popup opens with it, editable */
  note: string
  /** Client 26 Oct · its reason is written in the decision popup the option opens */
  mustNote: boolean
}
export interface Suggestion<A extends AgentAct> {
  /** The suggested exit · absent when the step is held */
  best?: A
  /** What holds the step, when nothing can be suggested */
  hold?: string
  why: string[]
  /** 0..1 · how clear the reading is */
  confidence: number
  options: SuggestOpt<A>[]
}

const NEGATIVE = /رفض|إلغاء|اعتذار|إيقاف|استبعاد|إنهاء/
const RETURN = /^(إعادة|أعد إلى|أعده)|استكمال|طلب تعديل/

export function suggestNext<A extends AgentAct>(
  actions: A[],
  ctx: {
    issues: string[]
    /** What the system confirmed is in order · its reasons for going forward */
    good?: string[]
    /** The stops a given exit would hit right now (the store's own `…Stops`) */
    stops?: (a: A) => string[]
    /** Prefer this exit forward when several fit */
    forward?: RegExp
    /** Exits that read negative but aren't final · a recommendation to decline */
    allow?: RegExp
  },
): Suggestion<A> {
  const neg = (a: A) => NEGATIVE.test(a.label) && !ctx.allow?.test(a.label)
  const back = (a: A) => RETURN.test(a.label)
  const issues = [...new Set(ctx.issues.filter(Boolean))]
  const good = ctx.good?.filter(Boolean) ?? []
  const backNote = issues.join(' · ')

  let best: A | undefined
  let hold: string | undefined
  let why: string[] = []
  let confidence = 0
  if (!actions.length) hold = 'لا إجراء لدورك على هذا السجل الآن'
  else if (issues.length) {
    best = actions.find((a) => back(a) && !a.needsFile)
    why = [`${issues.length === 1 ? 'ملاحظة واحدة تمنع' : `${issues.length} ملاحظات تمنع`} التقدّم`, ...issues.slice(0, 4)]
    confidence = Math.min(0.95, 0.78 + 0.04 * issues.length)
    if (!best) hold = 'في السجل ملاحظات ولا إعادة من دورك · راجعها مع صاحبها'
  } else {
    const fwd = actions.filter((a) => !back(a) && !neg(a))
      .sort((a, b) => Number(ctx.forward?.test(b.label) ?? 0) - Number(ctx.forward?.test(a.label) ?? 0) || Number(b.kind === 'btn-p') - Number(a.kind === 'btn-p'))
    best = fwd.find((a) => !a.needsFile && !(ctx.stops?.(a).length) && !a.needsNote)
    if (best) { why = ['لم تجد فحوص النظام ما يمنع التقدّم', ...good.slice(0, 4)]; confidence = Math.min(0.97, 0.82 + 0.03 * good.length) }
    else if (!fwd.length) { hold = 'لم تجد الفحوص ما يستدعي الإعادة · والتقدّم ليس من إجراءات دورك هنا'; why = good.slice(0, 3) }
    else {
      const file = fwd.find((a) => a.needsFile)
      const st = [...new Set(fwd.flatMap((a) => ctx.stops?.(a) ?? []))]
      hold = st.length ? 'الخطوة التالية متوقفة على شرط لم يتحقق' : file ? `الخطوة التالية تحتاج ${typeof file.needsFile === 'string' ? file.needsFile : 'مرفقًا'} · ارفعه من شريط القرار` : 'الخطوة التالية تحتاج سببك · اضغطها واكتبه في نافذة القرار'
      why = st.slice(0, 4)
    }
  }

  const options = actions.map((a): SuggestOpt<A> => {
    const note = back(a) ? backNote : ''
    const stop = ctx.stops?.(a)?.[0]
    /* Client 26 Oct · a decision that needs a reason opens the same popup as the bar, the reason
       written there · only a file still sends it to the bar, where the file is attached */
    const blocked = a.needsFile ? `يحتاج ${typeof a.needsFile === 'string' ? a.needsFile : 'مرفقًا'} · من شريط القرار`
      : stop ? stop
      : undefined
    return { action: a, best: a === best, blocked, note, mustNote: Boolean(a.needsNote || back(a) || neg(a)) }
  }).sort((x, y) => Number(y.best) - Number(x.best))

  return { best, hold, why, confidence, options }
}
