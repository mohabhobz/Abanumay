import { AI_CFG, aiSourceSay } from '@/lib/ai/provider'
import { cachedRead, reportFindings } from '@/lib/docCache'
import { DECISIONS } from '@/data/shared/decisions'
import type { Reading } from '@/components/assistant/reading'
import type { AgreementRow, CloseRow, EntityRow, PlanRow, ProjectRow } from '@/types/domain'
import { ROUTES } from '@/app/routes'
import { projectRows } from '@/data/mock/projects'
import { agreements } from '@/data/mock/agreements'
import { entityRows } from '@/data/mock/entities'
import { regRows, type RegRequest } from '@/data/mock/registration'
import { CITIES_BY_REGION } from '@/data/mock/taxonomy'
import { planDone, planPlanned, planOfProject } from '@/data/mock/plans'
import { closeRows, reportGap } from '@/data/mock/closing'
import { TEMPLATES } from '@/data/mock/agreementNew'
import { MONEY_LIMITS } from '@/data/mock/settings'
import type { EntityDetail } from '@/data/mock/entityDetail'
import { budgetByTrack } from '@/data/budget'
import { flowOf } from '@/data/intake/flow'
import { CRITERIA, studyScore } from '@/data/intake/criteria'
import { addWorkingDays, fundingBlock, goalFunded, CYCLE } from '@/data/intake/cycle'
import { appFlowOf, strategyOf, VERDICT_SAY, OUTCOME_SAY, type Session } from '@/data/approvals/store'
import { DIRECTIONS, linkOf, priorityWeight } from '@/data/budget/store'
import { allBudgets } from '@/data/mock/chain'
import { childrenOf, leavesOf, type BudgetDoc, type BudgetNode } from '@/data/mock/budgetTree'
import { expiredMandatory } from '@/data/entities/store'
import { EHSAN_PAYS, ehCloseOf, ehExecLog, ehExecOf, isLiveSub, pfMoney, type PortfolioRec } from '@/data/partners/store'
import { scheduleOf } from '@/data/payments/store'
import { payRequests } from '@/data/mock/disbursements'
import { EXT_PRE_STAGE } from '@/data/mock/taxonomy'
import { HOLDER_LABEL, type Holder } from '@/data/holders'
import { countOf, nf, NOUN, pct, units } from '@/lib/format'
import { isDone } from '@/data/status'

/* Rule-based readings · cross «الذكاء الاصطناعي».

   Every reading here is computed from the records, with its source named, and every one is
   advisory: the decision stays the person's (the document repeats it in each procedure). They are
   the same `Reading` the assistant column renders on each page, so a page adds them to the list it
   already passes and nothing new is drawn. «Reading a document» in the prototype means reading
   what the system holds about the file (its name, type, size and the dates and numbers in its
   name) against the form · the production service reads the content with OCR; the comparison and
   the sentences stay the same. */

/* Batch 8 · each reading says what made it · local rules until the AI service is connected (settings › الذكاء الاصطناعي) */
const advisory = () => `قراءة استرشادية · ليست قرارًا · ${aiSourceSay(AI_CFG.mode === 'api' ? 'summary' : undefined)}`
const D = 86_400_000
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / D)
const todayIso = () => new Date().toISOString().slice(0, 10)
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const money = (n: number) => `${nf.format(Math.round(n))} ريال`
const perHead = (p: ProjectRow) => (p.beneficiaries ? (p.amountGranted || p.amountRequested) / p.beneficiaries : 0)

/* ── Strategic alignment (cross-ddb89caaf5) ── */

export interface Alignment { score: number; parts: { say: string; ok: boolean; weight: number }[] }

export function alignmentOf(p: ProjectRow): Alignment {
  const s = strategyOf(p)
  const reach = projectRows.filter((x) => x.track === p.track && x.beneficiaries)
  const parts = [
    { say: s.ok ? `يخدم توجهًا استراتيجيًا معتمدًا${s.direction ? ` · ${s.direction}` : ''}` : s.say, ok: s.ok, weight: 30 },
    { say: fundingBlock(p.field) ? `مجال «${p.field}» بلا تمويل في الميزانية` : `مجال «${p.field}» ممول في ميزانية الدورة`, ok: !fundingBlock(p.field), weight: 20 },
    { say: goalFunded(p.field, p.goal) ? `الهدف «${p.goal}» من أولويات الدورة` : `الهدف «${p.goal}» خارج أهداف الدورة الممولة`, ok: goalFunded(p.field, p.goal), weight: 20 },
    { say: CYCLE.domains[p.field]?.open ? 'المجال مفتوح للتقديم في الدورة الحالية' : 'المجال مغلق في الدورة الحالية', ok: Boolean(CYCLE.domains[p.field]?.open), weight: 10 },
    {
      say: perHead(p) && reach.length ? `تكلفة المستفيد ${money(perHead(p))} مقابل متوسط المسار ${money(avg(reach.map(perHead)))}` : 'لا بيانات مستفيدين للمقارنة',
      ok: !perHead(p) || perHead(p) <= avg(reach.map(perHead)) * 1.25, weight: 20,
    },
  ]
  const score = Math.round(parts.reduce((n, x) => n + (x.ok ? x.weight : 0), 0))
  return { score, parts }
}

export function readAlignment(p: ProjectRow): Reading {
  const a = alignmentOf(p)
  const miss = a.parts.filter((x) => !x.ok)
  return {
    id: 'ai-align', kind: a.score < 60 ? 'flag' : 'note', label: 'التوافق الاستراتيجي',
    metric: { value: pct(a.score), unit: 'نسبة التوافق' },
    text: miss.length
      ? `يتوافق في ${a.parts.length - miss.length} من ${a.parts.length} معايير. يضعف التوافق: ${miss.map((x) => x.say).join('، ')}.`
      : `يتوافق مع المعايير الخمسة: التوجه الاستراتيجي والمجال والهدف وفتح الدورة وتكلفة المستفيد.`,
    danger: miss.map((x) => x.say),
    src: `التوجهات الاستراتيجية · ميزانية الدورة · إعداد الدورة · ${advisory()}`,
  }
}

/* ── Executive summary per reviewer (cross-89ede270a5) ── */

export function readSummary(p: ProjectRow): Reading {
  const f = flowOf(p.id)
  const ap = appFlowOf(p.id)
  const st = f.study
  const recs = ap.recs.slice(-3)
  const seat = (p.holder ?? 'supervisor') as Holder
  const reader = p.stage === 'دراسة المشروع' ? HOLDER_LABEL[seat] : 'المراجع'
  /* Batch 8 · 6.6.1 · 7.6.1 · the goals, the target groups and the expected outputs head the summary */
  const vals = [...f.versions].reverse().find((v) => v.values)?.values ?? {}
  const targets = (vals.targets ?? '').split(/[,،\n]/).map((x) => x.trim()).filter(Boolean)
  const outs = (f.orgOutputs?.length ? f.orgOutputs : f.entityOutputs ?? []).slice(0, 3)
  const parts = [
    `${p.entityName} تطلب ${money(p.amountRequested)} لمشروع في ${p.field} · ${p.region}، مدته ${units.day(p.durationDays ?? 0)} ويستهدف ${nf.format(p.beneficiaries ?? 0)} مستفيد.`,
    `الهدف: ${p.goal}${f.objectives.length ? ` · الأهداف التفصيلية: ${f.objectives.slice(0, 3).join('، ')}` : ''}.`,
    targets.length ? `الفئة المستهدفة: ${targets.join('، ')}.` : 'لم تُحدَّد الفئة المستهدفة في الطلب.',
    outs.length ? `المخرجات المتوقعة: ${outs.map((o) => [o.text, o.target && `(${o.target})`].filter(Boolean).join(' ')).join('، ')}.` : 'لم تُسجَّل مخرجات للمشروع.',
    st ? `دراسة المشرف: ${studyScore(st.scores)} من 100، والتوصية ${st.recommendation === 'approve' ? `بالموافقة على ${money(st.amount)}` : st.recommendation === 'reject' ? 'بالاعتذار' : 'لم تُحدَّد'}${st.justification ? ` لأن ${st.justification}` : ''}.` : 'لم تُسجَّل دراسة المشرف بعد.',
    ...recs.map((r) => `${HOLDER_LABEL[r.level]}: ${VERDICT_SAY[r.verdict]}${r.note ? ` · ${r.note}` : ''}.`),
    `التوافق الاستراتيجي ${pct(alignmentOf(p).score)}.`,
  ]
  return {
    id: 'ai-summary', kind: 'note', label: `ملخص تنفيذي · ${reader}`,
    text: parts.join(' '),
    bold: [money(p.amountRequested)],
    src: `بيانات الطلب · الدراسة · توصيات المراحل السابقة · ${advisory()}`,
  }
}

/* ── Similar projects and expected impact (cross-29ef57a9d1) ── */

export function similarTo(p: ProjectRow, n = 3): ProjectRow[] {
  const amt = p.amountRequested || p.amountGranted
  return projectRows
    .filter((x) => x.id !== p.id && x.entityId !== p.entityId && x.field === p.field)
    .map((x) => ({ x, d: (x.goal === p.goal ? 0 : 1) + Math.abs((x.amountGranted || x.amountRequested) - amt) / Math.max(1, amt) + (x.region === p.region ? 0 : 0.3) }))
    .sort((a, b) => a.d - b.d).slice(0, n).map((y) => y.x)
}

/** Batch 7 · cross#28 · the expected impact from what was really reached · the final reports'
    beneficiaries against each project's own estimate, on the similar projects first, else on the
    field's closed projects · a stated default only when nothing has reported yet */
export function expectedImpact(p: ProjectRow): { expected: number; rate: number; basis: number; from: 'similar' | 'field' | 'default' } {
  const rateOf = (rows: ProjectRow[]) => rows.map((x) => {
    const c = closeRows.find((y) => y.projectId === x.id && y.stage !== 'draft')
    return c && typeof c.report.beneficiaries === 'number' && x.beneficiaries ? c.report.beneficiaries / x.beneficiaries : null
  }).filter((r): r is number => r !== null)
  /* Batch 8 · the foundation's decision: closed similar projects first, or the field's rate only */
  let rates = DECISIONS.impactBasis === 'similar' ? rateOf(similarTo(p, 6)) : []
  let from: 'similar' | 'field' | 'default' = 'similar'
  if (!rates.length) { rates = rateOf(projectRows.filter((x) => x.field === p.field && x.id !== p.id)); from = 'field' }
  if (!rates.length) from = 'default'
  const rate = rates.length ? Math.min(1.2, avg(rates)) : 0.8
  return { expected: Math.round((p.beneficiaries ?? 0) * rate), rate, basis: rates.length, from }
}

export function readSimilar(p: ProjectRow): Reading | null {
  const sim = similarTo(p)
  if (!sim.length) return null
  const done = sim.filter((x) => isDone(x.statusGroup))
  const ei = expectedImpact(p)
  const expected = ei.expected
  return {
    id: 'ai-similar', kind: 'note', label: 'مشاريع مشابهة من جهات أخرى',
    text: `${sim.map((x) => `«${x.name}» لدى ${x.entityName} (${x.goal === p.goal ? 'نفس الهدف' : 'هدف مختلف'} · ${money(x.amountGranted || x.amountRequested)} · ${x.statusGroup})`).join('، ')}. `
      + `${done.length ? `اكتمل منها ${done.length}، ` : 'لم يكتمل منها شيء بعد، '}والأثر المتوقع لهذا المشروع نحو ${nf.format(expected)} مستفيد فعلي من ${nf.format(p.beneficiaries ?? 0)} مستهدف `
      + `(${ei.from === 'default' ? 'تقدير افتراضي · لم يُرسل تقرير ختامي لمشروع مشابه بعد' : `بنسبة التحقّق ${pct(Math.round(ei.rate * 100))} في ${countOf(ei.basis, NOUN.project)} ${ei.from === 'similar' ? 'مشابهًا' : 'من المجال'} أرسل تقريره الختامي`}).`,
    src: `مشاريع المجال نفسه لدى جهات أخرى · نسب الإنجاز المسجّلة · ${advisory()}`,
    to: `${ROUTES.projects}?field=${encodeURIComponent(p.field)}`, toLabel: 'مشاريع المجال',
  }
}

/* ── The project's budget (cross-6d6ee3298a) ── */

export function readBudget(p: ProjectRow): Reading {
  const plan = planOfProject(p.id)
  const peers = projectRows.filter((x) => x.track === p.track && x.durationDays && (x.amountGranted || x.amountRequested))
  const daily = p.durationDays ? p.amountRequested / p.durationDays : 0
  const peerDaily = avg(peers.map((x) => (x.amountGranted || x.amountRequested) / (x.durationDays || 1)))
  const flags: string[] = []
  if (plan && plan.phases.length) {
    const sum = plan.phases.reduce((s, ph) => s + ph.cost, 0)
    const top = [...plan.phases].sort((a, b) => b.cost - a.cost)[0]
    if (Math.abs(sum - (p.amountGranted || p.amountRequested)) > 1) flags.push(`مجموع تكاليف المراحل ${money(sum)} لا يساوي قيمة المنحة`)
    if (sum && top.cost / sum > 0.6) flags.push(`مرحلة «${top.name}» تستهلك ${pct(Math.round((top.cost / sum) * 100))} من التكلفة`)
    const empty = plan.phases.filter((ph) => ph.cost > 0 && !ph.activities.length)
    if (empty.length) flags.push(`${empty.length} مرحلة لها تكلفة بلا أنشطة`)
  }
  if (peerDaily && daily > peerDaily * 1.5) flags.push(`التكلفة اليومية ${money(daily)} أعلى من متوسط المسار ${money(peerDaily)}`)
  const st = flowOf(p.id).study
  if (st?.amount && st.amount < p.amountRequested * 0.7) flags.push(`المبلغ الموصى به أقل من المطلوب بنسبة ${pct(Math.round((1 - st.amount / p.amountRequested) * 100))}`)
  if (perHead(p) && peers.length && perHead(p) > avg(peers.filter((x) => x.beneficiaries).map(perHead)) * 1.5) flags.push('تكلفة المستفيد أعلى من مرة ونصف متوسط المسار')
  return {
    id: 'ai-budget', kind: flags.length ? 'flag' : 'note', label: 'تحليل ميزانية المشروع',
    text: flags.length ? `${flags.join('. ')}. راجع البنود قبل التوصية بالمبلغ.` : `التكلفة اليومية ${money(daily)} ضمن نطاق المسار، ولا بنود غير منطقية في الخطة.`,
    danger: flags,
    src: `خطة المشروع ومراحلها · مشاريع المسار نفسه · ${advisory()}`,
  }
}

/* ── Decision rationale draft (cross-f4e989f58e) ── */

export function draftRationale(p: ProjectRow): string {
  const st = flowOf(p.id).study
  const recs = appFlowOf(p.id).recs
  const a = alignmentOf(p)
  const conds = [
    ...(linkOf(p.id) ? [] : ['ربط المشروع ببند ميزانية قبل الاتفاقية']),
    ...((() => { const e = entityRows.find((x) => x.id === p.entityId); return e ? expiredMandatory(e).length : 0 })() ? ['تحديث وثائق الجهة المنتهية قبل الدفعة الأولى'] : []),
    ...(a.score < 80 ? ['تقرير مرحلي بعد ثلث المدة يقيس المستفيدين الفعليين'] : []),
  ]
  const lean = recs.filter((r) => /approve|refer/.test(r.verdict)).length >= recs.filter((r) => /reject/.test(r.verdict)).length
  return [
    lean ? `نوصي باعتماد المشروع بمبلغ ${money(st?.amount || p.amountRequested)}` : 'نوصي بالاعتذار عن المشروع',
    `استنادًا إلى دراسة المشرف${st ? ` (${studyScore(st.scores)} من 100)` : ''}${recs.length ? ` وتوصيات ${recs.map((r) => HOLDER_LABEL[r.level]).join(' و')}` : ''}`,
    `وتوافقه الاستراتيجي ${pct(a.score)}.`,
    conds.length ? `بشرط: ${conds.join('، ')}.` : '',
  ].filter(Boolean).join(' ')
}

export function readRationale(p: ProjectRow): Reading {
  const recs = appFlowOf(p.id).recs
  return {
    id: 'ai-rationale', kind: 'note', label: 'مسودة مبررات القرار',
    text: draftRationale(p),
    src: `توصيات المراحل السابقة${recs.length ? ` (${recs.length})` : ''} · التوافق · وضع الجهة والحجز · ${advisory()}`,
  }
}

/* ── Strengths and risks from the recommendations (6.6.3 · batch 8) ──
   What the supervisor's study and the seats' notes add up to · the criteria that scored highest, those
   that scored lowest, the amount cut, the returns, the strategic gaps and the words a note raised as risk */
const RISK_WORDS = ['مخاطر', 'خطر', 'يتجاوز', 'تأخر', 'ضعف', 'نقص', 'غير واضح', 'لا تُقرأ', 'متعثر', 'تحفظ']
export function readRecAnalysis(p: ProjectRow): Reading | null {
  const f = flowOf(p.id)
  const ap = appFlowOf(p.id)
  const st = f.study
  if (!st && !ap.recs.length) return null
  const crit = st ? Object.entries(st.scores).map(([k, v]) => ({ k, v, label: CRITERIA.list.find((c) => c.key === k)?.label ?? k })) : []
  const strong = crit.filter((c) => c.v >= 4).sort((a, b) => b.v - a.v).slice(0, 3)
  const weak = crit.filter((c) => c.v <= 2).sort((a, b) => a.v - b.v).slice(0, 3)
  const notes = [st?.technical, st?.admin, st?.justification, ...ap.recs.map((r) => r.note)].filter((x): x is string => Boolean(x))
  const raised = notes.filter((n) => RISK_WORDS.some((w) => n.includes(w)))
  const cut = st?.recommendation === 'approve' && st.amount && st.amount < p.amountRequested ? p.amountRequested - st.amount : 0
  const gaps = alignmentOf(p).parts.filter((x) => !x.ok).map((x) => x.say)
  const returns = ap.recs.filter((r) => /return|إعادة/.test(r.verdict)).length
  const risks = [
    ...weak.map((c) => `${c.label} (${c.v} من 5)`),
    ...(cut ? [`خفّض المشرف المبلغ ${money(cut)}`] : []),
    ...gaps,
    ...(returns ? [`أُعيد ${nf.format(returns)} مرة`] : []),
    ...raised.slice(0, 2).map((n) => `«${n.length > 80 ? `${n.slice(0, 80)}…` : n}»`),
  ]
  return {
    id: 'ai-recs', kind: risks.length > 2 ? 'flag' : 'note', label: 'نقاط القوة والمخاطر',
    text: `${strong.length ? `نقاط القوة: ${strong.map((c) => `${c.label} (${c.v} من 5)`).join('، ')}.` : 'لم تبرز نقطة قوة بدرجة عالية في الدراسة.'} ${risks.length ? `المخاطر والملاحظات: ${risks.join('، ')}.` : 'لم تُرصد مخاطر في الدراسة ولا في توصيات المراحل.'}`,
    bold: strong.map((c) => c.label),
    danger: weak.map((c) => c.label),
    src: `دراسة مشرف المنح · توصيات المراحل (${ap.recs.length}) · التوافق الاستراتيجي · ${advisory()}`,
  }
}

/** The approval seat's readings · summary, alignment, similar, budget and the draft */
export function projectAi(p: ProjectRow): Reading[] {
  const out: Reading[] = [readSummary(p), readAlignment(p)]
  const ra = readRecAnalysis(p)
  if (ra) out.push(ra)
  const sim = readSimilar(p)
  if (sim) out.push(sim)
  out.push(readBudget(p))
  if (p.stage === 'دراسة المشروع' && p.holder && p.holder !== 'supervisor') out.push(readRationale(p))
  return out
}

/* ── Registration · spelling, illogical data, documents, cross-entity patterns, score ── */

const TYPO_DOMAINS: Record<string, string> = { 'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'outlok.com': 'outlook.com', 'yaho.com': 'yahoo.com' }

export function regIssues(r: RegRequest): string[] {
  const out: string[] = []
  const t = todayIso()
  if (/\s{2,}/.test(r.name) || r.name !== r.name.trim()) out.push('اسم الجهة فيه مسافات زائدة')
  if (/[a-zA-Z]/.test(r.name) && /[؀-ۿ]/.test(r.name)) out.push('اسم الجهة يخلط حروفًا عربية ولاتينية')
  if (r.foundedAt && r.foundedAt > t) out.push('تاريخ التأسيس في المستقبل')
  if (r.foundedAt && r.licenseEndsAt && r.licenseEndsAt < r.foundedAt) out.push('انتهاء الترخيص قبل التأسيس')
  if (r.boardEndsAt && r.boardEndsAt < t) out.push('ولاية مجلس الإدارة منتهية')
  for (const e of [r.email, r.clerkEmail]) {
    const dom = e?.split('@')[1]?.toLowerCase()
    if (dom && TYPO_DOMAINS[dom]) out.push(`نطاق البريد «${dom}» يبدو خطأ إملائيًا · المقصود ${TYPO_DOMAINS[dom]}`)
  }
  if (r.city && r.region && CITIES_BY_REGION[r.region] && !CITIES_BY_REGION[r.region].includes(r.city)) out.push(`المدينة «${r.city}» ليست في منطقة ${r.region}`)
  if (r.mobile && r.clerkMobile && r.mobile === r.clerkMobile && r.directorName === r.clerkName) out.push('المدير والمسؤول المفوَّض بالاسم والجوال نفسهما')
  return out
}

/** What the system reads from the attached files · type, size, and the content read at upload (the name's numbers and dates for older files) */
export function docReading(files: Record<string, { name: string; size: number; warn?: string }> | undefined, form: { licenseNo?: string; licenseEndsAt?: string }) {
  const out: { doc: string; got: string[]; clash?: string }[] = []
  for (const [k, f] of Object.entries(files ?? {})) {
    const got: string[] = [`${f.name.split('.').pop()?.toUpperCase() ?? ''} · ${nf.format(Math.round(f.size / 1024))} ك.ب`]
    let clash: string | undefined
    /* 18 Oct · audit 2.6.4 · the document's content when it was read at upload · its name otherwise */
    const c = cachedRead(f.name, f.size)
    if (c && c.how !== 'none') {
      got.push(c.how === 'ocr' ? 'قُرئ بالتعرف الضوئي' : 'قُرئ المحتوى')
      if (c.picked.dates.length) got.push(`تاريخ ${c.picked.dates[0]}`)
      if (c.picked.numbers.length) got.push(`رقم ${c.picked.numbers[0]}`)
      if (k.includes('license') && form.licenseNo && c.picked.numbers.length && !c.picked.numbers.includes(form.licenseNo)) clash = `رقم الترخيص في الوثيقة ${c.picked.numbers[0]} · المُدخَل ${form.licenseNo}`
      if (k.includes('license') && form.licenseEndsAt && c.picked.dates.length && !c.picked.dates.includes(form.licenseEndsAt)) clash = clash ?? `تاريخ الوثيقة ${c.picked.dates[0]} · نهاية الترخيص المُدخلة ${form.licenseEndsAt}`
    } else {
      if (c) got.push(c.note)
      const date = f.name.match(/(20\d\d)[-_]?(\d\d)[-_]?(\d\d)/)
      const num = f.name.match(/\d{5,}/)
      if (date) got.push(`تاريخ ${date[1]}-${date[2]}-${date[3]} (من الاسم)`)
      if (num) got.push(`رقم ${num[0]} (من الاسم)`)
      if (k.includes('license') && num && form.licenseNo && num[0] !== form.licenseNo) clash = `رقم الملف ${num[0]} لا يطابق رقم الترخيص في النموذج ${form.licenseNo}`
      if (k.includes('license') && date && form.licenseEndsAt && `${date[1]}-${date[2]}-${date[3]}` !== form.licenseEndsAt) clash = clash ?? 'تاريخ الملف لا يطابق تاريخ انتهاء الترخيص في النموذج'
    }
    if (f.warn) clash = clash ?? f.warn
    out.push({ doc: k, got, clash })
  }
  return out
}

const norm = (s?: string) => (s ?? '').replace(/\s/g, '').toLowerCase()
export function crossEntity(r: RegRequest): string[] {
  const out: string[] = []
  const ibans = r.banks.map((b) => norm(b.iban)).filter(Boolean)
  for (const e of entityRows) {
    if (e.id === r.entityId) continue
    if (norm(e.email) && [norm(r.email), norm(r.clerkEmail)].includes(norm(e.email))) out.push(`البريد مسجّل للجهة «${e.name}»`)
    if (norm(e.mobile) && !/x/i.test(e.mobile) && [norm(r.mobile), norm(r.clerkMobile)].includes(norm(e.mobile))) out.push(`الجوال مسجّل للجهة «${e.name}»`)
  }
  for (const o of regRows) {
    if (o.id === r.id || o.name === r.name) continue
    if (o.banks.some((b) => ibans.includes(norm(b.iban)))) out.push(`الآيبان نفسه في طلب «${o.name}»`)
    if (norm(o.licenseNo) && norm(o.licenseNo) === norm(r.licenseNo)) out.push(`رقم الترخيص نفسه في طلب «${o.name}»`)
    if (norm(o.clerkMobile) && norm(o.clerkMobile) === norm(r.clerkMobile) && !/x/i.test(o.clerkMobile)) out.push(`جوال المسؤول نفسه في طلب «${o.name}»`)
  }
  return [...new Set(out)]
}

export function acceptScore(r: RegRequest, missingDocs: number): { score: number; verdict: 'قبول' | 'استكمال' | 'مراجعة إضافية'; why: string[] } {
  const issues = regIssues(r)
  const cross = crossEntity(r)
  const docs = docReading(r.files, r).filter((d) => d.clash)
  let score = 100 - issues.length * 8 - missingDocs * 12 - cross.length * 20 - docs.length * 10 - ((r.version ?? 1) - 1) * 5
  score = Math.max(0, Math.min(100, score))
  const verdict = cross.length ? 'مراجعة إضافية' : missingDocs || issues.length || docs.length ? 'استكمال' : score >= 75 ? 'قبول' : 'مراجعة إضافية'
  const why = [
    ...(missingDocs ? [`${missingDocs} مستندات ناقصة`] : []),
    ...issues, ...docs.map((d) => d.clash!), ...cross,
  ]
  return { score, verdict, why }
}

export function registrationAi(r: RegRequest, missingDocs: number): Reading[] {
  const issues = regIssues(r)
  const docs = docReading(r.files, r)
  const cross = crossEntity(r)
  const a = acceptScore(r, missingDocs)
  return [
    {
      id: 'ai-reg-score', kind: a.verdict === 'قبول' ? 'note' : 'flag', label: 'درجة القبول الاسترشادية',
      metric: { value: nf.format(a.score), unit: 'من 100' },
      text: `التوصية: ${a.verdict}. ${a.why.length ? `الأسباب: ${a.why.join('، ')}.` : 'البيانات مكتملة ومتسقة ولا أنماط مكررة.'}`,
      bold: [a.verdict],
      src: `فحص البيانات والمستندات والأنماط · ${advisory()}`,
    },
    {
      id: 'ai-reg-data', kind: issues.length ? 'flag' : 'note', label: 'الإملاء والبيانات غير المنطقية',
      text: issues.length ? `${issues.join('. ')}. اطلب تصحيحها من الجهة مع الإعادة.` : 'لا أخطاء تنسيق ولا تواريخ متعارضة في الطلب.',
      danger: issues, src: 'حقول النموذج · قواعد التسجيل',
    },
    {
      id: 'ai-reg-docs', kind: docs.some((d) => d.clash) ? 'flag' : 'note', label: 'قراءة المستندات',
      text: docs.length
        ? docs.map((d) => `${d.got.join(' · ')}${d.clash ? ` · ${d.clash}` : ''}`).join('. ')
        : 'لم تُرفق ملفات يقرؤها النظام بعد.',
      danger: docs.flatMap((d) => (d.clash ? [d.clash] : [])), src: 'بيانات الملفات المرفقة مقابل النموذج',
    },
    {
      id: 'ai-reg-cross', kind: cross.length ? 'flag' : 'note', label: 'أنماط بين الجهات',
      text: cross.length ? `${cross.join('. ')}. تحقّق من استقلال الجهة قبل الاعتماد.` : 'لا تطابق في البريد أو الجوال أو الحساب البنكي أو الترخيص مع جهة أخرى.',
      danger: cross, src: 'سجل الجهات وطلبات التسجيل',
    },
  ]
}

/* ── Registration trends (cross-ce4a1820e9) ── */

export function regTrends(): Reading[] {
  const byMonth = new Map<string, { in: number; ok: number; no: number }>()
  for (const r of regRows) {
    const m = (r.submittedAt ?? '').slice(0, 7)
    if (!m) continue
    const x = byMonth.get(m) ?? { in: 0, ok: 0, no: 0 }
    x.in++
    if (r.state === 'approved') x.ok++
    if (r.state === 'rejected') x.no++
    byMonth.set(m, x)
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-4)
  const reasons = new Map<string, number>()
  for (const r of regRows.filter((x) => x.state === 'rejected' || (x.events ?? []).some((e) => e.kind === 'return'))) {
    const why = (r.note ?? '').split(/[·،.]/)[0].trim() || 'بلا سبب مكتوب'
    reasons.set(why, (reasons.get(why) ?? 0) + 1)
  }
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const decided = regRows.filter((r) => r.state === 'approved' || r.state === 'rejected')
  const firstPass = decided.filter((r) => r.state === 'approved' && !(r.events ?? []).some((e) => e.kind === 'return')).length
  return [
    {
      id: 'ai-reg-trend', kind: 'note', label: 'اتجاه التسجيل',
      text: months.length ? months.map(([m, x]) => `${m}: ${countOf(x.in, NOUN.request)}، اعتُمد ${x.ok} ورُفض ${x.no}`).join(' · ') : 'لا طلبات بتواريخ بعد.',
      src: 'طلبات التسجيل حسب شهر التقديم',
    },
    {
      id: 'ai-reg-reasons', kind: top.length ? 'flag' : 'note', label: 'أسباب الإعادة والرفض',
      text: top.length ? `${top.map(([w, n]) => `«${w}» (${n})`).join('، ')}. والاعتماد من أول مراجعة ${pct(decided.length ? Math.round((firstPass / decided.length) * 100) : 0)}.` : 'لا إعادات ولا رفض مسجّل.',
      src: `ملاحظات الإعادة والرفض · ${advisory()}`,
    },
  ]
}

/* ── Entity documents before they lapse (cross-7b7d925b29) ── */

export function expiryAhead(d: EntityDetail, e: EntityRow, within = 60): Reading | null {
  const t = todayIso()
  const soon = [
    ...d.docs.filter((x) => x.expires && x.expires >= t && daysBetween(t, x.expires) <= within).map((x) => ({ name: x.name, at: x.expires! })),
    ...(e.licenseEndsAt >= t && daysBetween(t, e.licenseEndsAt) <= within ? [{ name: 'الترخيص', at: e.licenseEndsAt }] : []),
    ...(d.boardMandateEndsAt >= t && daysBetween(t, d.boardMandateEndsAt) <= within ? [{ name: 'ولاية مجلس الإدارة', at: d.boardMandateEndsAt }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at))
  if (!soon.length) return null
  const first = soon[0]
  return {
    id: 'ai-expiry', kind: 'flag', label: 'ينتهي قريبًا',
    metric: { value: nf.format(daysBetween(t, first.at)), unit: 'يومًا حتى أول انتهاء' },
    text: `${soon.map((x) => `${x.name} في ${x.at}`).join('، ')}. ذكّر الجهة بالتجديد قبل أن يتوقف نشاطها.`,
    bold: soon.map((x) => x.name),
    src: `تواريخ انتهاء الوثائق · تنبيه قبل ${within} يومًا`,
    actions: [{ label: 'ذكّر الجهة', note: 'نص التذكير', done: 'أُرسل التذكير إلى الجهة' }],
  }
}

/* ── Closing · executed against approved, and a score (cross-7a879e5315 · cross-5198b6b362) ── */

export function closeScore(c: CloseRow): { score: number; parts: string[] } {
  const p = projectRows.find((x) => x.id === c.projectId)
  const gaps = reportGap(c)
  const parts: string[] = []
  let sum = 0
  let n = 0
  for (const g of gaps) {
    if (g.actual === null || !g.planned) continue
    const r = g.key === 'budget' ? Math.min(1, g.planned / Math.max(1, g.actual)) : Math.min(1.2, g.actual / g.planned)
    sum += Math.min(1, r); n++
    parts.push(`${g.label} ${nf.format(g.actual)} من ${nf.format(g.planned)}`)
  }
  if (c.report.days !== null && p?.durationDays) {
    const r = Math.min(1, p.durationDays / Math.max(1, c.report.days))
    sum += r; n++
    parts.push(`المدة ${c.report.days} يومًا مقابل ${p.durationDays}`)
  }
  const plan = planOfProject(c.projectId)
  if (plan) {
    const done = planDone(plan) / 100
    sum += done; n++
    parts.push(`أنشطة الخطة المنجزة ${pct(Math.round(done * 100))}`)
  }
  return { score: n ? Math.round((sum / n) * 50) / 10 : 0, parts }
}

export function closingAi(c: CloseRow): Reading[] {
  const s = closeScore(c)
  const out: Reading[] = []
  if (s.parts.length) {
    out.push({
      id: 'ai-close-score', kind: s.score < 3 ? 'flag' : 'note', label: 'تقييم استرشادي للنجاح',
      metric: { value: nf.format(s.score), unit: 'من 5' },
      text: `${s.parts.join('، ')}. التقدير محسوب من المقارنة بالمعتمد، والتقييم النهائي للمشرف.`,
      src: `التقرير الختامي · بيانات المشروع المعتمدة · الخطة · ${advisory()}`,
    })
  }
  const r = c.report
  if (r.outcomes || r.risks) {
    const first = (t: string) => t.split(/[.\n]/).map((x) => x.trim()).filter(Boolean)
    out.push({
      id: 'ai-close-brief', kind: 'note', label: 'ملخص التقرير الختامي',
      text: [
        first(r.outcomes).length ? `النتائج: ${first(r.outcomes).slice(0, 2).join('؛ ')}.` : '',
        first(r.risks).length ? `التحديات: ${first(r.risks).slice(0, 2).join('؛ ')}.` : '',
        `الشواهد المرفقة ${r.docs.length}.`,
      ].filter(Boolean).join(' '),
      src: 'نص التقرير الختامي ومرفقاته',
    })
  }
  /* Batch 8 · 10.6.1 · the performance indicators the report carries · reach, spend, time and outputs */
  const p = projectRows.find((x) => x.id === c.projectId)
  const outs = r.outputs ?? []
  const met = outs.filter((o) => o.achieved.trim()).length
  const kpis = [
    p?.beneficiaries && r.beneficiaries !== null ? `الوصول ${pct(Math.round((r.beneficiaries / p.beneficiaries) * 100))} من المستهدفين` : '',
    p?.amountGranted && r.budget !== null ? `الصرف ${pct(Math.round((r.budget / p.amountGranted) * 100))} من المنحة` : '',
    p?.durationDays && r.days !== null ? `المدة ${pct(Math.round((r.days / p.durationDays) * 100))} من المخطط` : '',
    outs.length ? `مخرجات تحقق منها ${met} من ${outs.length}` : '',
  ].filter(Boolean)
  if (kpis.length) out.push({
    id: 'ai-close-kpi', kind: met < outs.length ? 'flag' : 'note', label: 'مؤشرات الأداء من التقرير',
    text: `${kpis.join('، ')}.`,
    src: `التقرير الختامي · المستهدف المعتمد · ${advisory()}`,
  })
  /* Batch 8 · 10.6.2 · against the agreement too · its value, its schedule and its end */
  const ag = agreements.find((a) => a.projectId === c.projectId && a.stage === 'active') ?? agreements.find((a) => a.projectId === c.projectId)
  if (ag) {
    const dev: string[] = []
    if (r.budget !== null && ag.amount && Math.abs(r.budget - ag.amount) / ag.amount > 0.1) dev.push(`المصروف الفعلي ${money(r.budget)} مقابل قيمة الاتفاقية ${money(ag.amount)}`)
    const endAg = p?.endAt ?? ag.payments.map((x) => x.dueAt).sort().at(-1) ?? ''
    if (endAg && p?.startAt && r.days !== null) {
      const end = addWorkingDays(p.startAt, r.days)
      if (end > endAg) dev.push(`انتهى التنفيذ (${end}) بعد نهاية مدة الاتفاقية (${endAg})`)
    }
    out.push({
      id: 'ai-close-agr', kind: dev.length ? 'flag' : 'note', label: 'المقارنة بالاتفاقية',
      text: dev.length ? `${dev.join('، ')}.` : `يتسق التنفيذ مع الاتفاقية ${ag.id} في القيمة والمدة.`,
      danger: dev,
      src: `الاتفاقية ${ag.id} · التقرير الختامي · ${advisory()}`,
    })
  }
  return out
}

/* ── Plans, portfolios and Ehsan · forecast and periodic summary (cross-38e716de9b · cross-fe719be019) ── */

export function forecastPlan(p: PlanRow): Reading | null {
  const acts = p.phases.flatMap((ph) => ph.activities)
  if (!acts.length || p.stage !== 'active') return null
  const start = acts.map((a) => a.from).sort()[0]
  const end = acts.map((a) => a.to).sort().at(-1)!
  const t = todayIso()
  const elapsed = Math.max(1, daysBetween(start, t))
  const done = planDone(p)
  const planned = planPlanned(p)
  if (done >= 100) return null
  const rate = done / elapsed
  const finish = rate > 0 ? new Date(Date.parse(start) + (100 / rate) * D).toISOString().slice(0, 10) : null
  const slip = finish ? daysBetween(end, finish) : null
  const risky = slip !== null ? slip > 14 : planned > done + 20
  return {
    id: 'ai-forecast', kind: risky ? 'flag' : 'note', label: 'تنبؤ مبكر بالتأخر',
    text: finish
      ? `بمعدل الإنجاز الحالي (${pct(Math.round(done))} في ${units.day(elapsed)}) ينتهي التنفيذ نحو ${finish}${slip && slip > 0 ? `، أي بعد موعده بـ${units.day(slip)}` : ' ضمن موعده'}.`
      : `لم يُنجز نشاط بعد والمخطط حتى اليوم ${pct(Math.round(planned))} · خطر تعثر إن لم يبدأ التنفيذ.`,
    danger: risky && slip ? [units.day(slip)] : [],
    src: `تواريخ الأنشطة ونسبة القبول · ${advisory()}`,
  }
}

export function portfolioAi(pf: PortfolioRec): Reading[] {
  const m = pfMoney(pf)
  const items = pf.items
  const t = todayIso()
  const late = items.filter((s) => isLiveSub(s) && s.state !== 'done' && s.exec && s.exec.progress < 100 && pf.plan.phases.some((ph) => ph.to < t)).length
  const pays = EHSAN_PAYS.filter((x) => x.target.kind !== 'project' && x.target.pfId === pf.id)
  /* Duplicates among the proposed sub-projects · same region and close names or outputs */
  const dup: string[] = []
  const words = (s: string) => new Set(s.split(/\s+/).filter((w) => w.length > 2))
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i]; const b = items[j]
    if (a.region !== b.region) continue
    const wa = words(`${a.name} ${a.outputs}`); const wb = words(`${b.name} ${b.outputs}`)
    const common = [...wa].filter((w) => wb.has(w)).length
    if (common >= Math.max(2, Math.min(wa.size, wb.size) * 0.5)) dup.push(`«${a.name}» و«${b.name}»`)
  }
  const goalWords = words(pf.goals)
  const off = items.filter((s) => s.state !== 'rejected' && s.state !== 'excluded' && goalWords.size && ![...words(`${s.name} ${s.outputs}`)].some((w) => goalWords.has(w)))
  const progress = avg(items.filter(isLiveSub).map((s) => s.exec?.progress ?? 0))
  const phasesDone = pf.plan.phases.filter((ph) => ph.to < t).length
  const expected = pf.plan.phases.length ? (phasesDone / pf.plan.phases.length) * 100 : 0
  return [
    {
      id: 'ai-pf-summary', kind: 'note', label: 'ملخص دوري للمحفظة',
      text: `${m.approvedCount} مشروع فرعي معتمد من ${items.length}، متوسط الإنجاز ${pct(Math.round(progress))}، المصروف المؤكد ${money(m.confirmed)} من ${money(m.total)} والمتاح ${money(m.available)}. ${pays.filter((x) => x.state === 'review').length ? `${pays.filter((x) => x.state === 'review').length} دفعات بانتظار المالية.` : ''}`,
      src: 'المشاريع الفرعية · دفعات المنصة · المركز المالي',
    },
    {
      id: 'ai-pf-forecast', kind: progress + 15 < expected || late ? 'flag' : 'note', label: 'تنبؤ مبكر بالتأخر',
      text: pf.plan.phases.length
        ? `انقضت ${phasesDone} من ${pf.plan.phases.length} مراحل (${pct(Math.round(expected))} من المدة) والإنجاز ${pct(Math.round(progress))}${progress + 15 < expected ? ' · الإنجاز متأخر عن الزمن وقد تتعثر المحفظة' : ' · في المسار'}.`
        : 'لا خطة معتمدة للمحفظة يُقاس عليها التقدم.',
      src: `خطة المحفظة · تحديثات التنفيذ · ${advisory()}`,
    },
    {
      id: 'ai-pf-fit', kind: dup.length || off.length ? 'flag' : 'note', label: 'التوافق مع أهداف المحفظة',
      text: `${off.length ? `${off.length} مشروع لا يذكر أهداف المحفظة: ${off.slice(0, 3).map((s) => s.name).join('، ')}. ` : 'المشاريع الفرعية تخدم أهداف المحفظة. '}${dup.length ? `تكرار محتمل: ${dup.slice(0, 3).join('، ')}.` : 'لا تكرار بين المشاريع المقترحة.'}`,
      danger: dup,
      src: `أهداف المحفظة · أسماء المشاريع الفرعية ومخرجاتها · ${advisory()}`,
    },
  ]
}

/* Batch 8 · 11.6 · the external project's readings, over any external party (v3) · its money through
   BPD-009's permits, the proofs on file, the next step to take · advisory, nothing is done on its own */
const extMoney = (p: ProjectRow) => {
  const reqs = payRequests.filter((r) => r.projectId === p.id)
  const paid = reqs.filter((r) => r.state === 'paid').reduce((n, r) => n + r.asked, 0)
  const open = reqs.filter((r) => r.state !== 'paid' && r.state !== 'closed').reduce((n, r) => n + r.asked, 0)
  return { value: p.amountGranted, paid, open, left: Math.max(0, p.amountGranted - paid), reqs }
}

export function ehsanAi(p: ProjectRow): Reading[] {
  const m = extMoney(p)
  const t = todayIso()
  const elapsed = p.startAt ? Math.max(0, daysBetween(p.startAt, t)) : 0
  const span = p.durationDays || 1
  const timePct = Math.min(100, Math.round((elapsed / span) * 100))
  const paidPct = m.value ? Math.round((m.paid / m.value) * 100) : 0
  const ex = ehExecOf(p.id)
  /* 11.6.1 · the proofs against the payments · a transfer without its proof, a third party without its document */
  const paidReqs = m.reqs.filter((r) => r.state === 'paid')
  const noProof = paidReqs.filter((r) => !(r.transfer?.proof || r.docs.some((d) => d.kind === 'إثبات التحويل'))).map((r) => r.no)
  const noDoc = m.reqs.filter((r) => r.payee && !r.payee.doc.trim()).map((r) => r.no)
  const execFiles = ehExecLog(p.id).flatMap((x) => x.files).length
  const issues = [
    ...(noProof.length ? [`الدفعة ${noProof.join('، ')} صُرفت بلا إثبات تحويل`] : []),
    ...(noDoc.length ? [`الدفعة ${noDoc.join('، ')} لطرف ثالث بلا مستند مبرّر`] : []),
    ...(ex && ex.progress >= 100 && paidPct < 100 ? [`أُبلغ التنفيذ منجزًا والمصروف ${pct(paidPct)} من القيمة`] : []),
    ...(ex && ex.progress < 100 && paidPct >= 100 ? [`صُرفت القيمة كاملة والتنفيذ ${pct(ex.progress)}`] : []),
  ]
  /* 11.6.2 · the next step the supervisor may take · suggested, not taken */
  const slots = scheduleOf(p.id)
  const ready = slots.find((x) => x.state === 'open' || x.state === 'eligible')
  const eligible = m.reqs.find((r) => r.state === 'eligible')
  const ended = (p.endAt ?? '9999') <= t
  const next = p.stage === EXT_PRE_STAGE ? 'سجّل جدول دفعات الوثيقة الخارجية · يبدأ التنفيذ بعده'
    : eligible ? `أنشئ إذن صرف الدفعة ${eligible.no}`
      : ended && !ehCloseOf(p.id)?.closedAt ? 'انتهت المدة · اجمع إثباتات التحويل والتنفيذ وابدأ الإغلاق'
        : ready ? `ارفع متطلبات الدفعة ${ready.no} نيابةً عن الجهة (موعدها ${ready.dueAt})`
          : 'لا إجراء مستحق الآن'
  return [
    {
      id: 'ai-eh-summary', kind: 'note', label: 'ملخص المشروع الخارجي',
      text: `المعتمد ${money(m.value)}، صُرف ${money(m.paid)} (${pct(paidPct)})، وقيد الصرف ${money(m.open)}، والمتبقي ${money(m.left)}. انقضى من المدة ${pct(timePct)}${ex ? ` · التنفيذ «${ex.status}» ${pct(ex.progress)}` : ''}.`,
      src: 'أذونات الصرف (BPD-009) · حالة التنفيذ · مدة المشروع',
    },
    {
      id: 'ai-eh-proofs', kind: issues.length ? 'flag' : 'note', label: 'الإثباتات مقابل الدفعات',
      text: issues.length ? `${issues.join('، ')}.` : `الدفعات المصروفة (${paidReqs.length}) موثقة بإثبات تحويل · ${countOf(execFiles, NOUN.doc)} من إثباتات التنفيذ مرفقة.`,
      danger: issues,
      src: `أذونات الصرف ومرفقاتها · إثباتات التنفيذ · ${advisory()}`,
    },
    {
      id: 'ai-eh-forecast', kind: timePct > paidPct + 25 || next !== 'لا إجراء مستحق الآن' ? 'flag' : 'note', label: 'الإجراء المقترح',
      text: `${next}.${timePct > paidPct + 25 ? ` الصرف متأخر عن الزمن بفارق ${pct(timePct - paidPct)}.` : ''} لا يُنفَّذ شيء تلقائيًا.`,
      src: `جدول الدفعات · نهاية المدة · ${advisory()}`,
    },
  ]
}

/** 11.6.3 · a periodic digest over every external project · approved, paid, left, and what to watch */
export function externalDigest(rows: ProjectRow[]): Reading | null {
  const live = rows.filter((p) => p.supportStatus === 'معتمد')
  if (!live.length) return null
  const ms = live.map((p) => ({ p, m: extMoney(p) }))
  const value = ms.reduce((n, x) => n + x.m.value, 0)
  const paid = ms.reduce((n, x) => n + x.m.paid, 0)
  const t = todayIso()
  const ended = live.filter((p) => (p.endAt ?? '9999') <= t && !ehCloseOf(p.id)?.closedAt)
  const noProof = ms.filter((x) => x.m.reqs.some((r) => r.state === 'paid' && !(r.transfer?.proof || r.docs.some((d) => d.kind === 'إثبات التحويل'))))
  const pre = live.filter((p) => p.stage === EXT_PRE_STAGE)
  return {
    id: 'ai-ext-digest', kind: ended.length || noProof.length ? 'flag' : 'note', label: 'ملخص دوري · المشاريع عبر جهات خارجية',
    text: `${countOf(live.length, NOUN.project)} معتمدة بقيمة ${money(value)} · صُرف ${money(paid)} (${pct(value ? Math.round((paid / value) * 100) : 0)}) والمتبقي ${money(Math.max(0, value - paid))}.${pre.length ? ` بانتظار جدول الدفعات: ${pre.map((p) => p.name).slice(0, 3).join('، ')}.` : ''}${ended.length ? ` انتهت مدتها دون إغلاق: ${ended.map((p) => p.name).slice(0, 3).join('، ')}.` : ''}${noProof.length ? ` دفعات بلا إثبات تحويل في: ${noProof.map((x) => x.p.name).slice(0, 3).join('، ')}.` : ''}`,
    src: `أذونات الصرف · حالة المشاريع · ${advisory()}`,
  }
}

/* ── Agreements · template and clause review (cross-19be8e4a2a · cross-ac4f84fe1a) ── */

export function suggestTemplate(p: ProjectRow): { template: string; why: string } {
  const amt = p.amountGranted || p.amountRequested
  if (p.partnerType) return { template: 'اتفاقية شراكة استراتيجية', why: 'المشروع عبر شريك استراتيجي' }
  if ((p.durationDays ?? 0) > 260) return { template: 'اتفاقية منحة متعددة السنوات', why: 'مدته تتجاوز سنة عمل' }
  if (amt > 1_000_000) return { template: 'اتفاقية منحة كبرى (فوق مليون)', why: `قيمته ${money(amt)}` }
  if (p.impact) return { template: 'اتفاقية منحة بظهور إعلامي', why: 'مشروع أثر بظهور إعلامي' }
  if (/تشغيل/.test(p.track)) return { template: 'اتفاقية منحة تشغيلية', why: 'مساره تشغيلي' }
  return { template: TEMPLATES[0], why: 'منحة عادية دون مليون ريال ومدة أقل من سنة' }
}

export function readTemplate(p: ProjectRow, chosen?: string): Reading {
  const s = suggestTemplate(p)
  const plan = planOfProject(p.id)
  return {
    id: 'ai-template', kind: chosen && chosen !== s.template ? 'flag' : 'note', label: 'النموذج الأنسب',
    text: `نقترح «${s.template}» لأن ${s.why}.${chosen && chosen !== s.template ? ` المختار «${chosen}» مختلف · تأكد من ملاءمته.` : ''} تُملأ المسودة من بيانات الطلب${plan ? ` وخطة التنفيذ (${plan.phases.length} مراحل)` : ''}.`,
    bold: [s.template],
    src: `قاعدة اختيار النماذج: المبلغ × المدة × الظهور × الشراكة · ${advisory()}`,
  }
}

export function agreementIssues(a: AgreementRow): string[] {
  const out: string[] = []
  const p = projectRows.find((x) => x.id === a.projectId)
  const sum = a.payments.reduce((s, x) => s + x.amount, 0)
  const share = a.payments.reduce((s, x) => s + x.share, 0)
  if (Math.abs(sum - a.amount) > 1) out.push(`مجموع الدفعات ${money(sum)} لا يساوي قيمة المنحة ${money(a.amount)}`)
  if (Math.round(share) !== 100) out.push(`نسب الدفعات مجموعها ${pct(Math.round(share))} لا مئة`)
  const firstMax = MONEY_LIMITS.find((l) => l.key === 'firstPayPct')?.value ?? 40
  if (a.payments[0] && a.payments[0].share > firstMax) out.push(`الدفعة الأولى ${pct(a.payments[0].share)} تتجاوز الحد ${pct(firstMax)}`)
  const noReq = a.payments.filter((x, i) => i > 0 && !x.requirement)
  if (noReq.length) out.push(`${noReq.length} دفعات بلا شرط صرف مرتبط بإنجاز`)
  if (p?.endAt && a.payments.some((x) => x.dueAt > p.endAt!)) out.push('دفعة مستحقة بعد نهاية مدة المشروع')
  const plan = planOfProject(a.projectId)
  if (plan && plan.phases.length && a.payments.length > plan.phases.length + 1) out.push(`عدد الدفعات ${a.payments.length} أكثر من مراحل الخطة ${plan.phases.length}`)
  if (plan) for (const x of a.payments) if (x.dueAt && plan.phases.length && x.dueAt < plan.phases[0].from) { out.push(`الدفعة ${x.no} قبل بدء المرحلة الأولى`); break }
  if (a.reserved !== a.amount) out.push(`المحجوز في الميزانية ${money(a.reserved)} لا يطابق قيمة المنحة`)
  return out
}

export function readClauses(a: AgreementRow): Reading {
  const issues = agreementIssues(a)
  return {
    id: 'ai-clauses', kind: issues.length ? 'flag' : 'note', label: 'مراجعة البنود وجدول الدفعات',
    text: issues.length ? `${issues.join('. ')}. اقتراح: اربط كل دفعة بمرحلة من الخطة وبشرط إنجاز.` : 'الجدول يطابق القيمة ومراحل الخطة، والدفعة الأولى ضمن الحد، ولكل دفعة شرط.',
    danger: issues,
    src: `جدول الدفعات · خطة التنفيذ · حدود الصرف في الإعدادات · ${advisory()}`,
  }
}

/* ── Budget · allocation for a new budget from the years before (cross-93dd998215) ── */

/* 1.6.2 · the strategic direction a track, field or goal serves · read from the budget trees: the
   line with that label, then up its parents to the track that carries a direction */
function directionOfLabel(label: string): { name: string; w: number; p: number } | undefined {
  for (const d of allBudgets) {
    let n: BudgetNode | undefined = d.nodes.find((x) => x.label === label)
    while (n && !n.directionId) n = n.parentId ? d.nodes.find((x) => x.id === n!.parentId) : undefined
    const dir = n?.directionId ? DIRECTIONS.find((x) => x.id === n!.directionId) : undefined
    if (dir) return { name: dir.name, w: priorityWeight(dir.priority), p: dir.priority ?? 3 }
  }
  return undefined
}
const dirWhy = (label: string) => {
  const d = directionOfLabel(label)
  return d ? ` · التوجه «${d.name}» بأولوية ${d.p} من 5 (وزن ×${d.w.toFixed(2)})` : ' · بلا توجه مرتبط (وزن ×1)'
}

export function suggestAllocation(total: number): { track: string; share: number; amount: number; why: string }[] {
  const prev = budgetByTrack('2025-f')
  const cur = budgetByTrack('2026-f')
  const demand = new Map<string, number>()
  for (const p of projectRows.filter((x) => x.statusGroup === 'قيد الدراسة')) demand.set(p.track, (demand.get(p.track) ?? 0) + p.amountRequested)
  const tracks = [...new Set([...prev, ...cur].map((l) => l.label))]
  const weight = tracks.map((t) => {
    const a = prev.find((l) => l.label === t); const b = cur.find((l) => l.label === t)
    const used = (a?.spent ?? 0) + (b?.spent ?? 0) + (b?.committed ?? 0)
    /* 1.6.2 · past use and demand, weighed by the strategic priority of the direction the track serves */
    return { t, w: (used * 0.7 + (demand.get(t) ?? 0) * 0.3) * (directionOfLabel(t)?.w ?? 1), used }
  })
  const W = weight.reduce((s, x) => s + x.w, 0) || 1
  return weight.map((x) => ({
    track: x.t, share: Math.round((x.w / W) * 100), amount: Math.round((total * x.w) / W / 1000) * 1000,
    why: `صرف والتزام سابق ${money(x.used)} · طلب قيد الدراسة ${money(demand.get(x.t) ?? 0)}${dirWhy(x.t)}`,
  })).sort((a, b) => b.amount - a.amount)
}

export function readAllocation(total: number): Reading {
  const s = suggestAllocation(total)
  return {
    id: 'ai-alloc', kind: 'note', label: 'اقتراح توزيع المخصصات',
    text: `حسب المسار: ${s.slice(0, 4).map((x) => `${x.track} ${pct(x.share)} (${money(x.amount)}${dirWhy(x.track).replace(' · التوجه', ' · توجه')})`).join('، ')}. حسب المجال: ${suggestAllocationBy(total, 'field').slice(0, 3).map((x) => `${x.key} ${pct(x.share)} (${x.why})`).join('، ')}. حسب الهدف: ${suggestAllocationBy(total, 'goal').slice(0, 3).map((x) => `${x.key} ${pct(x.share)}`).join('، ')}. الوزن: ${pct(70)} للصرف والالتزام و${pct(30)} للطلب قيد الدراسة، مضروبًا في أولوية التوجه الاستراتيجي (${DIRECTIONS.filter((d) => d.active).map((d) => `${d.name} ${d.priority ?? 3}/5`).join('، ')}).`,
    src: `ميزانيتا 2025 و2026 · الطلبات قيد الدراسة · ${advisory()}`,
  }
}

/* ── Budget · efficiency, balance and next year's need (1.6.1 – 1.6.4 · batch 8) ──
   Read from the budgets before this one: each line's use (paid and held over allocated), the demand
   of the requests in its field, and how the doc spreads its money · advisory, the finance team decides */
const shareOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
export function readBudgetAdvice(doc: BudgetDoc): Reading[] {
  const leaves = leavesOf(doc.nodes).filter((n) => n.active)
  if (!leaves.length || doc.total <= 0) return []
  const before = allBudgets.filter((d) => d.id !== doc.id && d.yearId < doc.yearId && d.state === 'approved')
  const pastOf = (label: string) => before.flatMap((d) => leavesOf(d.nodes)).filter((n) => n.label === label)
  const used = (n: BudgetNode) => (n.paid ?? 0) + (n.held ?? 0) + Math.max(0, n.allocated - n.available - (n.paid ?? 0) - (n.held ?? 0))
  const demandOf = (label: string) => projectRows.filter((x) => x.statusGroup === 'قيد الدراسة' && (label.includes(x.field) || label.includes(x.goal))).reduce((n, x) => n + x.amountRequested, 0)
  const out: Reading[] = []
  /* 1.6.1 · lines the earlier years left mostly unused, and lines they ran out of */
  const rates = leaves.map((n) => {
    const past = pastOf(n.label)
    const a = past.reduce((x, y) => x + y.allocated, 0)
    return { n, rate: a ? shareOf(past.reduce((x, y) => x + used(y), 0), a) : null, a }
  }).filter((x) => x.rate !== null) as { n: BudgetNode; rate: number; a: number }[]
  const low = rates.filter((x) => x.rate < 40)
  const high = rates.filter((x) => x.rate > 90)
  out.push({
    id: 'ai-bd-eff', kind: low.length || high.length ? 'flag' : 'note', label: 'كفاءة التوزيع من السنوات السابقة',
    text: rates.length
      ? `${low.length ? `استُخدم أقل من ${pct(40)} من: ${low.slice(0, 3).map((x) => `${x.n.label} (${pct(x.rate)})`).join('، ')} · يُقترح خفضها. ` : ''}${high.length ? `نفدت تقريبًا: ${high.slice(0, 3).map((x) => `${x.n.label} (${pct(x.rate)})`).join('، ')} · يُقترح رفعها. ` : ''}${!low.length && !high.length ? 'استخدام البنود في السنوات السابقة متوازن بين 40 و90 بالمئة.' : ''}`
      : 'لا ميزانية معتمدة سابقة بنفس البنود للمقارنة.',
    danger: low.map((x) => x.n.label),
    src: `ميزانيات معتمدة سابقة (${before.length}) · المصروف والمحجوز على كل بند · ${advisory()}`,
  })
  /* 1.6.3 · next year's need per line · the past use grown by the trend, plus the demand under study */
  const need = leaves.map((n) => {
    const past = pastOf(n.label)
    const last = past.at(-1)
    const prev = past.at(-2)
    const trend = last && prev && used(prev) > 0 ? Math.max(-0.3, Math.min(0.5, used(last) / used(prev) - 1)) : 0
    const est = Math.round(((last ? used(last) : 0) * (1 + trend) + demandOf(n.label)) / 1000) * 1000
    return { n, est, gap: est - n.allocated }
  }).filter((x) => x.est > 0).sort((a, b) => b.gap - a.gap)
  if (need.length) out.push({
    id: 'ai-bd-need', kind: 'note', label: 'الاحتياج المتوقع لكل بند',
    text: `${need.slice(0, 4).map((x) => `${x.n.label}: ${money(x.est)} (${x.gap >= 0 ? `يزيد ${money(x.gap)}` : `يقل ${money(-x.gap)}`} عن المخصص)`).join('، ')}.`,
    src: `اتجاه الاستخدام بين آخر سنتين · الطلبات قيد الدراسة في مجال البند · ${advisory()}`,
  })
  /* 1.6.4 · an uneven spread · a line's share of the money against its share of the demand, and a line
     that takes most of its parent */
  const allDemand = leaves.reduce((n, x) => n + demandOf(x.label), 0)
  const off = allDemand > 0 ? leaves.map((n) => ({ n, d: shareOf(n.allocated, doc.total) - shareOf(demandOf(n.label), allDemand) })).filter((x) => Math.abs(x.d) >= 15) : []
  const heavy = doc.nodes.filter((p) => childrenOf(doc.nodes, p.id).length >= 3).flatMap((p) => childrenOf(doc.nodes, p.id).filter((c) => p.allocated > 0 && c.allocated / p.allocated > 0.6).map((c) => ({ c, p })))
  const zero = leaves.filter((n) => n.allocated <= 0)
  out.push({
    id: 'ai-bd-bal', kind: off.length || heavy.length || zero.length ? 'flag' : 'note', label: 'توازن التوزيع',
    text: off.length || heavy.length || zero.length
      ? [
        ...off.slice(0, 3).map((x) => `${x.n.label} ${x.d > 0 ? 'يأخذ أكثر' : 'يأخذ أقل'} من حصته من الطلب بـ${pct(Math.abs(x.d))}`),
        ...heavy.slice(0, 2).map((x) => `${x.c.label} يأخذ ${pct(shareOf(x.c.allocated, x.p.allocated))} من ${x.p.label}`),
        ...(zero.length ? [`${countOf(zero.length, NOUN.line)} بلا مخصص`] : []),
      ].join('، ') + ' · راجع هذه البنود.'
      : 'التوزيع قريب من حصص الطلب ولا بند يستأثر بأبيه.',
    danger: [...off.map((x) => x.n.label), ...heavy.map((x) => x.c.label)],
    src: `حصة كل بند من الإجمالي مقابل حصته من الطلب قيد الدراسة · ${advisory()}`,
  })
  return out
}

/* 1.6.2 · the split by field and by goal, not only by track · the same weighting (past use and demand) */
export function suggestAllocationBy(total: number, by: 'field' | 'goal'): { key: string; share: number; amount: number; why: string }[] {
  const w = new Map<string, number>()
  const trackOf = new Map<string, string>()
  for (const p of projectRows) {
    const k = by === 'field' ? p.field : p.goal
    if (!k) continue
    const x = p.statusGroup === 'قيد الدراسة' ? p.amountRequested * 0.3 : (p.amountSpent + (p.supportStatus === 'معتمد' ? p.amountGranted - p.amountSpent : 0)) * 0.7
    w.set(k, (w.get(k) ?? 0) + x)
    if (!trackOf.has(k)) trackOf.set(k, p.track)
  }
  /* 1.6.2 · weighed by the strategic priority of the direction the key serves (its own line, or its track's) */
  const dirOf = (k: string) => directionOfLabel(k) ?? directionOfLabel(trackOf.get(k) ?? '')
  for (const [k, v] of w) w.set(k, v * (dirOf(k)?.w ?? 1))
  const W = [...w.values()].reduce((a, b) => a + b, 0) || 1
  return [...w.entries()].map(([key, v]) => {
    const d = dirOf(key)
    return { key, share: Math.round((v / W) * 100), amount: Math.round((total * v) / W / 1000) * 1000, why: d ? `التوجه «${d.name}» بأولوية ${d.p} من 5 (وزن ×${d.w.toFixed(2)})` : 'بلا توجه مرتبط (وزن ×1)' }
  }).sort((a, b) => b.amount - a.amount)
}

/* ── The board's session · an aggregate report with relative priority (cross-f65e0b21da) ── */

export function sessionReport(s: Session): Reading[] {
  const rows = s.items.map((it) => projectRows.find((p) => p.id === it.projectId)).filter((p): p is ProjectRow => Boolean(p))
  if (!rows.length) return []
  const total = rows.reduce((n, p) => n + (p.amountRequested || p.amountGranted), 0)
  const byField = new Map<string, number>()
  for (const p of rows) byField.set(p.field, (byField.get(p.field) ?? 0) + 1)
  const ranked = rows.map((p) => ({ p, score: Math.round(alignmentOf(p).score * 0.6 + (flowOf(p.id).study ? studyScore(flowOf(p.id).study!.scores) : 50) * 0.4) }))
    .sort((a, b) => b.score - a.score)
  const decided = s.items.filter((i) => i.outcome)
  return [
    {
      id: 'ai-session', kind: 'note', label: `تقرير ${s.body === 'board' ? 'اجتماع المجلس' : 'جلسة اللجنة'}`,
      text: `${rows.length} مشروع بقيمة ${money(total)} في ${[...byField.entries()].map(([f, n]) => `${f} (${n})`).join('، ')}. ${decided.length ? `صدر القرار في ${decided.length}: ${decided.map((i) => OUTCOME_SAY[i.outcome!]).join('، ')}.` : 'لم يصدر قرار بعد.'}`,
      src: 'جدول الجلسة · بيانات المشاريع',
    },
    {
      id: 'ai-priority', kind: 'note', label: 'الأولوية النسبية',
      text: ranked.map((x, i) => `${i + 1}. ${x.p.name} (${x.score})`).join(' · '),
      src: `${pct(60)} التوافق الاستراتيجي و${pct(40)} درجة الدراسة · ${advisory()}`,
    },
  ]
}

/* ── Attachments of a payment or an Ehsan operation, read against the record (cross-5198b6b362) ── */

/** Batch 8 · 9.6.2 · the attachments against the payment's own requirements (the agreement's list) */
export function readNeeds(r: { needs?: { kind: string; label: string }[]; docs: { kind: string; name: string }[]; condition?: string }): Reading {
  const needs = r.needs ?? []
  const missing = needs.filter((n) => !r.docs.some((d) => d.kind === n.kind || d.kind === n.label))
  const extra = r.docs.filter((d) => needs.length && !needs.some((n) => d.kind === n.kind || d.kind === n.label) && d.kind !== 'إثبات التحويل')
  return {
    id: 'ai-pay-needs', kind: missing.length ? 'flag' : 'note', label: 'المرفقات مقابل متطلبات الدفعة',
    text: needs.length
      ? `${missing.length ? `ينقص: ${missing.map((n) => n.label).join('، ')}.` : `المتطلبات ${needs.length} كلها مرفقة.`}${extra.length ? ` مرفقات خارج المتطلبات: ${extra.map((d) => d.name).slice(0, 3).join('، ')}.` : ''}${r.condition ? ` شرط الدفعة: ${r.condition}.` : ''}`
      : 'لا تسمّي الاتفاقية متطلبات لهذه الدفعة.',
    danger: missing.map((n) => n.label),
    src: `متطلبات الدفعة في الاتفاقية · مرفقات الطلب · ${advisory()}`,
  }
}

export function readFiles(id: string, label: string, files: string[], expect: { amount?: number; ref?: string; date?: string; iban?: string; findings?: boolean }): Reading {
  const found: string[] = []
  const clash: string[] = []
  const seen: string[] = []
  let byContent = 0
  for (const f of files) {
    /* 18 Oct · audit 2.6.4 · 9.6.2 · 11.6.1 · the file's CONTENT when it was read at upload */
    const c = cachedRead(f)
    if (c && c.how !== 'none') {
      byContent++
      const v = c.picked
      const bits: string[] = []
      if (v.amounts.length) bits.push(`مبلغ ${v.amounts.slice(0, 2).map((n) => nf.format(n)).join('، ')}`)
      if (v.dates.length) bits.push(`تاريخ ${v.dates[0]}`)
      if (v.ibans.length) bits.push(`آيبان ${v.ibans[0]}`)
      if (v.numbers.length) bits.push(`رقم ${v.numbers[0]}`)
      found.push(`«${f}» (${c.how === 'ocr' ? 'بالتعرف الضوئي' : 'من المحتوى'}${bits.length ? ` · ${bits.join('، ')}` : ' · لا قيم'})`)
      const want = expect.amount ? Math.round(expect.amount) : 0
      if (want && v.amounts.length) {
        if (v.amounts.includes(want)) seen.push(`المبلغ ${nf.format(want)} مطابق في «${f}»`)
        /* a report carries many figures · its not naming the amount is a note, a proof's is a clash */
        else if (expect.findings) seen.push(`لا يذكر «${f}» المبلغ المسجّل ${nf.format(want)}`)
        else clash.push(`المبلغ في المستند ${nf.format(v.amounts[0]!)} · المسجّل ${nf.format(want)}`)
      }
      if (expect.ref && /\d{4,}/.test(expect.ref)) {
        const ref = expect.ref.replace(/\D/g, '')
        if (c.text.replace(/\D/g, ' ').split(/\s+/).some((x) => x && (x === ref || x.endsWith(ref)))) seen.push(`رقم العملية ${expect.ref} في «${f}»`)
        else if (v.numbers.length) clash.push(`رقم العملية في المستند ${v.numbers[0]} · المسجّل ${expect.ref}`)
      }
      if (expect.iban && v.ibans.length && !v.ibans.includes(expect.iban.replace(/\s+/g, '').toUpperCase())) clash.push(`الآيبان في المستند ${v.ibans[0]} · المسجّل ${expect.iban}`)
      if (expect.date && v.dates.length && v.dates.every((d) => d > expect.date!)) clash.push(`تاريخ «${f}» ${v.dates[0]} بعد تاريخ العملية ${expect.date}`)
      if (expect.findings) {
        const fi = reportFindings(c.text)
        if (fi.length) seen.push(`أبرز ما في «${f}»: ${fi.map((x) => `${x.label} ${x.value}`).join('، ')}`)
      }
      continue
    }
    if (c && c.how === 'none') { found.push(`«${f}» (${c.note})`); continue }
    /* a seeded file or one picked before this reading existed · its name only */
    const nums = f.match(/\d[\d,]{3,}/g)?.map((x) => Number(x.replace(/,/g, ''))) ?? []
    const date = f.match(/(20\d\d)[-_]?(\d\d)[-_]?(\d\d)/)
    const bits: string[] = []
    if (date) bits.push(`تاريخ ${date[1]}-${date[2]}-${date[3]}`)
    if (nums.length) bits.push(`رقم ${nf.format(nums[0])}`)
    found.push(`«${f}» (من اسم الملف${bits.length ? ` · ${bits.join('، ')}` : ''})`)
    if (expect.amount && nums.some((n) => n > 1000) && !nums.includes(Math.round(expect.amount))) clash.push(`مبلغ في «${f}» لا يطابق ${money(expect.amount)}`)
    if (expect.ref && /\d{4,}/.test(expect.ref) && nums.length && !f.includes(expect.ref)) clash.push(`«${f}» لا يحمل رقم العملية ${expect.ref}`)
    if (expect.date && date && `${date[1]}-${date[2]}-${date[3]}` > expect.date) clash.push(`«${f}» مؤرخ بعد تاريخ العملية`)
  }
  const how = byContent ? (byContent === files.length ? 'محتوى الملفات' : `محتوى ${byContent} من ${files.length} · والباقي من أسمائها`) : 'أسماء الملفات (لم يُقرأ محتواها · ملفات سابقة)'
  return {
    id, kind: clash.length || !files.length ? 'flag' : 'note', label,
    text: files.length ? `قرأ النظام ${files.length} مرفقات: ${found.join('، ')}. ${clash.length ? clash.join('. ') + '.' : 'لا تعارض مع بيانات العملية.'}${seen.length ? ` ${seen.join('. ')}.` : ''}` : 'لا مرفقات يقرؤها النظام · الطلب بلا مستند.',
    danger: clash,
    src: `${how} مقابل المبلغ والمرجع والتاريخ · ${advisory()}`,
  }
}
