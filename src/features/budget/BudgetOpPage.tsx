import { budgetReqOutcome } from '@/data/shared/outcome'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { NextStep } from '@/components/assistant/NextStep'
import { suggestNext } from '@/data/shared/agent'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BackTo, DateText, DockWhy, Empty, FieldSelect, Glass, Head, Icon, KV, Money, Person, Riyal, StepArc, Tag, icons,
  type GateStep,
} from '@/components/ui'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { NOUN, isolate, nf } from '@/lib/format'
import {
  docSources, docTitle, fiscalYears, leavesOf, lineUsable, moneyOf, pathOf, yearById, type BudgetDoc,
} from '@/data/mock/budgetTree'
import { meOf, readRole } from '@/data/roles'
import {
  REQ_KIND_SAY, REQ_STATE_SAY, decideRequest, docOf, financeDecides, freeOf, liveBudgets, mayAct, nextReqId,
  reqById, reqIssues, reqTone, saveRequest, sourceName, stepOf, useBudget, whoActs,
  type BudgetRequest, type ReqKind,
} from '@/data/budget/store'
import { BUDGET_RULES, noReviewStep } from '@/data/budget/rules'
import { History, NoteModal } from './doc/DocFlow'

/* A budget operation request (1.3) · transfer between two lines of one budget, an increase, or a
   decrease · prepared, then the grants manager, finance and the executive director in turn.

   The checks run before the request goes anywhere and again before it executes (1.3.4 · 1.3.5):
   the line it takes from has the balance without touching what is held, committed or paid; the
   amount sits inside the transfer policy; a large one carries a supporting document; and the two
   lines of a transfer belong to the same budget, because the request carries one budget and its
   lines are drawn from it alone (1.4.34). On the final approval it executes on its own: the lines
   and every line above them move, and the budget's ledger records each change with the figure
   before and after (1.3.10 · 1.3.11 · 1.4.36). */

const KINDS: ReqKind[] = ['transfer', 'increase', 'decrease']
const KIND_NOTE: Record<ReqKind, string> = {
  transfer: 'من بند إلى بند في الميزانية نفسها · لا يتغيّر إجماليها',
  increase: 'مبلغ جديد يدخل البند · ويرتفع إجمالي الميزانية ومصدرها',
  decrease: 'مبلغ يخرج من البند · وينخفض إجمالي الميزانية ومصدرها',
}
const STEP_SAY = {
  manager: { ok: 'وافق وأحِل إلى الإدارة المالية', back: 'أعد إلى المُعِدّ' },
  finance: { ok: 'وافق وأحِل إلى المدير التنفيذي', back: 'أعد إلى المُعِدّ' },
  exec: { ok: 'اعتمد ونفّذ', back: 'أعد إلى الإدارة المالية' },
} as const
/* Client 24 Oct (#87) · finance holds the final word up to its amount · its approve executes */
const okSay = (step: keyof typeof STEP_SAY, amount: number): string =>
  step === 'finance' && financeDecides(amount) ? 'اعتمد ونفّذ' : STEP_SAY[step].ok

/* Client 24 Oct (#87) · a budget operation reads its approvals like every other procedure · the same
   arc (StepArc) the project, the payment, the agreement and the plan carry · the preparer, the first
   review when settings name one, finance, and the executive director unless finance decides the
   amount · each sector names the step, hovering reads who did it and when (from the request's log) */
type Stage = 'prepare' | 'manager' | 'finance' | 'exec'
const STAGE_OF: Partial<Record<BudgetRequest['state'], Stage>> = {
  draft: 'prepare', returned: 'prepare', submitted: 'manager', finance: 'finance', exec: 'exec',
}
function ladderFor(r: Pick<BudgetRequest, 'state' | 'amount' | 'events' | 'by'>): GateStep[] {
  const stages: Stage[] = ['prepare', ...(noReviewStep() ? [] : ['manager' as const]), 'finance', ...(financeDecides(r.amount) ? [] : ['exec' as const])]
  const raw = STAGE_OF[r.state]
  const now = raw === 'manager' && noReviewStep() ? 'finance' : raw
  const nowAt = r.state === 'executed' ? stages.length : r.state === 'rejected' ? -1 : stages.indexOf(now ?? 'prepare')
  const say: Record<Stage, { label: string; cap: string }> = {
    prepare: { label: 'المُعِدّ', cap: 'الإعداد والإرسال' },
    manager: { label: whoActs('submitted') || 'صاحب الصلاحية', cap: 'المراجعة' },
    finance: { label: 'الإدارة المالية', cap: financeDecides(r.amount) ? 'الاعتماد والتنفيذ' : 'المراجعة المالية' },
    exec: { label: whoActs('exec') || 'المدير التنفيذي', cap: 'الاعتماد والتنفيذ' },
  }
  const steps = stages.map((st, i): GateStep => {
    const state: GateStep['state'] = r.state === 'rejected' ? (i === 0 ? 'done' : 'pending') : i === nowAt ? 'now' : i < nowAt ? 'done' : 'pending'
    const ev = r.events.find((e) => (st === 'prepare' ? /أُرسل|أُنشئ/ : st === 'finance' ? /الإدارة المالية/ : st === 'exec' ? /اعتمده/ : /وافق|أعاده/).test(e.text))
    return {
      label: say[st].label, cap: say[st].cap, state,
      lines: state === 'done' && ev ? [<><Person name={ev.by} /> · <DateText>{ev.at.slice(0, 10)}</DateText></>, isolate(ev.text)]
        : state === 'now' ? [st === 'prepare' ? <>بيد <Person name={r.by} /></> : 'ينتظر قرار هذه المرحلة']
          : ['تبدأ بعد اكتمال المرحلة السابقة'],
      src: state === 'pending' ? 'المصدر: مسار اعتماد العمليات · إعدادات الميزانية' : 'المصدر: سجل الطلب',
    }
  })
  if (r.state === 'rejected') steps.push({ label: 'مرفوض', title: 'مرفوض · أُغلق الطلب', cap: 'رفض', state: 'now', lines: ['يبقى في السجل للاطلاع'] })
  return steps
}

const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

type Form = Omit<BudgetRequest, 'events' | 'state' | 'createdAt' | 'submittedAt' | 'result'>

export default function BudgetOpPage() {
  const { id } = useParams()
  const [q] = useSearchParams()
  const navigate = useNavigate()
  const mobile = useIsMobile()
  useBudget()
  const role = readRole()
  const me = meOf(role)

  const existing = id ? reqById(id) : undefined
  const startDoc = docOf(q.get('doc') ?? '') ?? undefined
  const editable = (!existing || existing.state === 'draft' || existing.state === 'returned') && mayAct('prepare', role)

  const [f, setF] = useState<Form>(() => existing
    ? { id: existing.id, yearId: existing.yearId, docId: existing.docId, kind: existing.kind, fromId: existing.fromId, toId: existing.toId, amount: existing.amount, source: existing.source, reason: existing.reason, files: [...existing.files], by: existing.by }
    : { id: '', yearId: startDoc?.yearId ?? '', docId: startDoc?.state === 'approved' ? startDoc.id : '', kind: 'transfer', amount: 0, reason: '', files: [], by: me })
  const [decide, setDecide] = useState<'ok' | 'back' | 'reject' | null>(null)

  const r = editable ? f : existing ?? f
  const doc = docOf(r.docId)
  const issues = useMemo(() => reqIssues(r), [r])
  const step = existing ? stepOf(existing.state) : null
  const myStep = step === 'manager' || step === 'finance' || step === 'exec' ? (mayAct(step, role) ? step : null) : null
  const execBlocked = myStep === 'exec' ? issues : []

  if (id && !existing) {
    return (
      <AppLayout assistantContext={assistFor.page('طلب عملية ميزانية')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="طلبات العمليات" onClick={() => navigate(ROUTES.budgetOps)} />
          <Glass><Empty title="الطلب غير موجود." note="ربما يكون الرابط قديمًا." /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  /* v3 · 1.1.desc-4 · a new request is prepared by the authority holders settings name */
  if (!id && !mayAct('prepare', role)) {
    return (
      <AppLayout assistantContext={assistFor.page('طلب عملية ميزانية')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="طلبات العمليات" onClick={() => navigate(ROUTES.budgetOps)} />
          <Glass><Empty title="طلبات العمليات لأصحاب الصلاحية" note={`يُعدّ طلب المناقلة أو التعزيز أو التخفيض ويرسله: ${whoActs('draft') || 'لا أحد بعد'} · يُضبط من إعدادات الميزانية.`} /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  const budgets = liveBudgets().filter((d) => !f.yearId || d.yearId === f.yearId)
  const leaves = (d?: BudgetDoc) => (d ? leavesOf(d.nodes).filter((n) => n.parentId !== null) : [])
  const opt = (d: BudgetDoc, nid: string) => {
    const n = d.nodes.find((x) => x.id === nid)!
    return { value: nid, label: isolate(`${pathOf(d.nodes, nid).split(' · ').slice(1).join(' · ')} · متاح ${nf.format(freeOf(d, nid))}${lineUsable(d.nodes, n.id) ? '' : ' · موقوف'}`) }
  }
  const put = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const send = (go: boolean) => {
    const rid = f.id || nextReqId(f.docId)
    saveRequest({ ...f, id: rid, by: me }, go)
    if (!id) navigate(ROUTES.budgetOp(rid), { replace: true })
  }

  /* What the request will do · the lines it touches, before and after */
  const impact = (() => {
    if (!doc) return []
    const out: { k: string; v: ReactNode }[] = []
    const line = (nid?: string) => (nid ? doc.nodes.find((x) => x.id === nid) : undefined)
    const from = line(r.fromId)
    const to = line(r.toId)
    if (from && r.kind !== 'increase') {
      const m = moneyOf(doc.nodes, from.id)
      out.push({ k: `«${from.label}»`, v: <span className="sub"><span className="nobr">مخصص <Money sm>{from.allocated}</Money> ← <b><Money sm>{from.allocated - r.amount}</Money></b></span> · <span className="nobr">متاح <Money sm>{m.available}</Money> ← <Money sm>{m.available - r.amount}</Money></span></span> })
    }
    if (to && r.kind !== 'decrease') {
      out.push({ k: `«${to.label}»`, v: <span className="sub">مخصص <Money sm>{to.allocated}</Money> ← <b><Money sm>{to.allocated + r.amount}</Money></b></span> })
    }
    if (r.kind !== 'transfer') {
      out.push({ k: 'إجمالي الميزانية', v: <span className="sub"><Money sm>{doc.total}</Money> ← <b><Money sm>{doc.total + (r.kind === 'increase' ? r.amount : -r.amount)}</Money></b></span> })
    }
    return out
  })()

  const title = existing ? `${REQ_KIND_SAY[existing.kind]} · ${existing.id}` : 'طلب عملية ميزانية'
  /* 17 Oct · the assistant suggests · the request's own issues decide at each approval step · a rejection stays human */
  type OpAct = { label: string; kind: string; d: 'ok' | 'back' }
  const nextPlan = suggestNext<OpAct>(myStep && existing ? [{ label: okSay(myStep, existing.amount), kind: 'btn-p', d: 'ok' }, { label: STEP_SAY[myStep].back, kind: 'btn-2', d: 'back' }] : [], {
    issues,
    good: [`${REQ_KIND_SAY[r.kind]} بمبلغ ${nf.format(r.amount)} · فحوص الطلب سليمة`],
  })
  const nextExec = (a: OpAct, n: string) => { if (existing) decideRequest(existing.id, a.d === 'ok' ? 'approve' : 'return', n, me); return [] }

  return (
    <AppLayout assistantContext={assistFor.page(title)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <BackTo label="طلبات العمليات" onClick={() => navigate(ROUTES.budgetOps)} />
          {/* Client 24 Oct (#87) · the two-column header of every procedure · name and amount opposite
              the approval arc */}
          <header className="phead">
            <div className="pmain">
              <div className="ehead-t">
                <h1 className="ptitle">{title}</h1>
                {existing && <span className="ehead-st"><Tag tone={reqTone(existing.state)}>{REQ_STATE_SAY[existing.state]}</Tag></span>}
                {/* Client sheet 24 Oct (#95) · the outcome once the request ends */}
                {existing && <OutcomeTag outcome={budgetReqOutcome(existing.state)} />}
              </div>
              <p className="sub mt-1">
                {doc ? <>{docTitle(doc)} · </> : null}
                مناقلة أو تعزيز أو تخفيض على ميزانية معتمدة · يُنفَّذ آليًا عند الاعتماد النهائي
              </p>
              {r.amount > 0 && (
                <div className="pamt">
                  <div className="lb">مبلغ العملية</div>
                  <div className="v"><Money sm>{r.amount}</Money></div>
                  <div className="sub">{financeDecides(r.amount) ? <>ضمن صلاحية الإدارة المالية · حتى <Money sm>{BUDGET_RULES.opFinanceUpTo}</Money></> : 'يعتمده المدير التنفيذي بعد الإدارة المالية'}</div>
                </div>
              )}
            </div>
            <div className="pgates">
              <StepArc
                steps={ladderFor({ state: existing?.state ?? 'draft', amount: r.amount, events: existing?.events ?? [], by: existing?.by ?? me })}
                compact={mobile}
                aria="مسار اعتماد عملية الميزانية"
                holderKey={existing?.state === 'executed' ? 'نُفِّذ' : existing?.state === 'rejected' ? 'مرفوض' : 'صاحب القرار الآن'}
                holder={existing?.state === 'executed' ? 'اكتمل المسار' : existing?.state === 'rejected' ? 'أُغلق الطلب' : existing ? whoActs(existing.state) || 'المُعِدّ' : 'المُعِدّ'}
              />
            </div>
          </header>


          {existing?.state === 'returned' && existing.note && (
            <Glass>
              <Head title="ملاحظات الإعادة" meta={<Tag tone="ret">للاستكمال</Tag>} />
              <p className="sub cnote">«{existing.note}»</p>
            </Glass>
          )}

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="بيانات الطلب" meta={<span className="sub"><bdi>{/* doc 1.3.1–1.3.3 */}</bdi></span>} />
                {editable ? (
                  <div className="regfields">
                    <label className="regf">
                      <span className="lb">السنة المالية<b className="regf-r" aria-label="إلزامي">*</b></span>
                      <FieldSelect value={f.yearId} label="السنة المالية" options={fiscalYears.map((y) => ({ value: y.id, label: y.name }))} onChange={(v) => setF((x) => ({ ...x, yearId: v, docId: '', fromId: undefined, toId: undefined }))} />
                    </label>
                    <label className="regf">
                      <span className="lb">الميزانية<b className="regf-r" aria-label="إلزامي">*</b></span>
                      <FieldSelect
                        value={f.docId}
                        label="الميزانية"
                        placeholder={budgets.length ? 'اختر الميزانية' : 'لا ميزانية معتمدة للسنة'}
                        disabled={!budgets.length}
                        options={budgets.map((d) => ({ value: d.id, label: docTitle(d) }))}
                        onChange={(v) => setF((x) => ({ ...x, docId: v, yearId: docOf(v)?.yearId ?? x.yearId, fromId: undefined, toId: undefined, source: undefined }))}
                      />
                      <span className="sub regf-h">الميزانيات المعتمدة وحدها · والبندان من الميزانية المختارة</span>
                    </label>
                    <div className="regf regf-w">
                      <span className="lb">العملية<b className="regf-r" aria-label="إلزامي">*</b></span>
                      <div className="cfgchips" role="radiogroup" aria-label="العملية">
                        {KINDS.map((k) => (
                          <button key={k} type="button" role="radio" aria-checked={f.kind === k} className={`cfgchip${f.kind === k ? ' on' : ''}`} onClick={() => setF((x) => ({ ...x, kind: k, fromId: k === 'increase' ? undefined : x.fromId, toId: k === 'decrease' ? undefined : x.toId }))}>
                            {REQ_KIND_SAY[k]}
                          </button>
                        ))}
                      </div>
                      <span className="sub regf-h">{KIND_NOTE[f.kind]}</span>
                    </div>
                    {f.kind !== 'increase' && (
                      <label className="regf regf-w">
                        <span className="lb">{f.kind === 'transfer' ? 'من البند' : 'البند'}<b className="regf-r" aria-label="إلزامي">*</b></span>
                        <FieldSelect value={f.fromId ?? ''} label="البند المنقول منه" searchAt={6} disabled={!doc} options={doc ? leaves(doc).map((n) => opt(doc, n.id)) : []} onChange={(v) => put('fromId', v)} />
                      </label>
                    )}
                    {f.kind !== 'decrease' && (
                      <label className="regf regf-w">
                        <span className="lb">{f.kind === 'transfer' ? 'إلى البند' : 'البند'}<b className="regf-r" aria-label="إلزامي">*</b></span>
                        <FieldSelect value={f.toId ?? ''} label="البند المنقول إليه" searchAt={6} disabled={!doc} options={doc ? leaves(doc).filter((n) => n.id !== f.fromId).map((n) => opt(doc, n.id)) : []} onChange={(v) => put('toId', v)} />
                      </label>
                    )}
                    <label className="regf">
                      <span className="lb">المبلغ<b className="regf-r" aria-label="إلزامي">*</b></span>
                      <span className="fld">
                        <input type="text" inputMode="numeric" value={f.amount ? nf.format(f.amount) : ''} onChange={(e) => put('amount', digits(e.target.value))} aria-label="مبلغ العملية" />
                        <Riyal />
                      </span>
                    </label>
                    {doc && docSources(doc).length > 1 && f.kind !== 'transfer' && (
                      <label className="regf">
                        <span className="lb">مصدر التمويل<b className="regf-r" aria-label="إلزامي">*</b></span>
                        <FieldSelect value={f.source ?? ''} label="مصدر التمويل" options={docSources(doc).map((s) => ({ value: s.code, label: sourceName(s.code) }))} onChange={(v) => put('source', v)} />
                      </label>
                    )}
                    <label className="regf regf-w">
                      <span className="lb">سبب العملية<b className="regf-r" aria-label="إلزامي">*</b></span>
                      <span className="fld fld-a">
                        <textarea rows={3} value={f.reason} onChange={(e) => put('reason', e.target.value)} aria-label="سبب العملية" />
                      </span>
                    </label>
                    <div className="regf regf-w">
                      <span className="lb">المرفقات الداعمة{f.amount >= BUDGET_RULES.attachAbove && <b className="regf-r" aria-label="إلزامي">*</b>}</span>
                      {f.files.length > 0 && (
                        <ul className="eprq">
                          {f.files.map((file, i) => (
                            <li key={`${file}-${i}`} className="eprq-r">
                              <Icon name={icons.clip} size="sm" />
                              <span className="eprq-b"><b>{file}</b></span>
                              <span className="pc-sp" />
                              <button className="btn btn-ghost btn-sm" aria-label={`أزل ${file}`} onClick={() => put('files', f.files.filter((_, j) => j !== i))}>
                                <Icon name={icons.close} size="sm" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <label className="regdrop">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { const x = e.target.files?.[0]; if (x) put('files', [...f.files, x.name]); e.target.value = '' }} />
                        <Icon name={icons.upload} size="sm" />
                        <span>أرفق مستندًا داعمًا</span>
                        <span className="pc-sp" />
                        <span className="sub regdocs-m">إلزامي من <span className="num">{nf.format(BUDGET_RULES.attachAbove)}</span> فأكثر</span>
                      </label>
                    </div>
                  </div>
                ) : existing && doc ? (
                  <KV rows={[
                    { k: 'الميزانية', v: <Link className="lnk" to={ROUTES.budgetDoc(doc.id)}>{docTitle(doc)}</Link> },
                    { k: 'السنة المالية', v: yearById(existing.yearId)?.name ?? '' },
                    { k: 'العملية', v: REQ_KIND_SAY[existing.kind] },
                    ...(existing.fromId ? [{ k: 'من البند', v: pathOf(doc.nodes, existing.fromId) }] : []),
                    ...(existing.toId ? [{ k: 'إلى البند', v: pathOf(doc.nodes, existing.toId) }] : []),
                    { k: 'المبلغ', v: <b><Money sm>{existing.amount}</Money></b> },
                    ...(existing.source ? [{ k: 'مصدر التمويل', v: sourceName(existing.source) }] : []),
                    { k: 'السبب', v: existing.reason },
                    { k: 'المرفقات', v: existing.files.length ? existing.files.join('، ') : 'بلا مرفقات' },
                    { k: 'أعدّه', v: <Person name={existing.by} /> },
                    { k: 'تاريخ الطلب', v: <DateText>{existing.createdAt.slice(0, 10)}</DateText> },
                  ]} />
                ) : null}
              </Glass>

              {existing?.result?.length ? (
                <Glass className="tblcard">
                  <Head title="ما نُفِّذ" meta={<span className="sub">القيمة قبل التنفيذ وبعده</span>} />
                  <div className="tblwrap">
                    <table className="tbl">
                      <thead><tr><th>البند</th><th className="n">قبل</th><th className="n">بعد</th></tr></thead>
                      <tbody>
                        {existing.result.map((x) => (
                          <tr key={x.nodeId}><td>{x.label}</td><td className="n"><Money sm>{x.before}</Money></td><td className="n"><Money sm>{x.after}</Money></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Glass>
              ) : null}

              {/* Blockers, impact and the approval path · in the main column, the end column is the assistant's alone */}
              {/* Client 23 Oct · «ما يمنع» opens from the action bar · not a card in the page */}
              {impact.length > 0 && existing?.state !== 'executed' && (
                <Glass>
                  <Head title="الأثر عند التنفيذ" />
                  <KV rows={impact} />
                  <p className="sub cnote">وتتحرك معها البنود التي فوقها حتى البند المشترك بينهما · فيبقى كل أب مساويًا لمجموع أبنائه.</p>
                </Glass>
              )}
              {existing && (
                <Glass>
                  <Head title="سجل الطلب" meta={<span className="sub">كل إجراء بصاحبه ووقته وسببه</span>} />
                  <History events={existing.events} />
                </Glass>
              )}
            </div>

            <AssistantAside
              title="قراءة طلب الميزانية"
              suggest={myStep && existing ? <NextStep s={nextPlan} exec={nextExec} /> : undefined}
              cta="اقرأ الطلب"
              empty="لا ملاحظات · الأرصدة والسياسة تسمح بهذا الطلب."
              readings={issues.map((t, i) => ({ id: `bo-${i}`, kind: 'flag' as const, label: editable ? 'يمنع الإرسال' : 'يمنع التنفيذ', text: t, src: 'تحقّق النظام من الأرصدة والسياسة' }))}
            />
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {editable ? (issues.length ? <>جاهز بعد المعالجة<DockWhy n={issues.length} noun={NOUN.note} items={issues.map((t) => ({ text: t, why: 'تحقّق النظام' }))} /></> : <>جاهز · <Money>{f.amount}</Money></>)
                  : myStep && existing ? <>بانتظار قرارك · <b>{okSay(myStep, existing.amount)}</b>{myStep === 'exec' && issues.length > 0 && <DockWhy n={issues.length} noun={NOUN.note} title="ما يمنع التنفيذ" items={issues.map((t) => ({ text: t, why: 'تحقّق النظام' }))} />}</>
                    : existing?.state === 'executed' ? 'نُفِّذ · انعكس على أرصدة البنود وسجل الحركات'
                      : existing ? <>بانتظار <b>{whoActs(existing.state) || 'المُعِدّ'}</b></> : null}
              </span>
            </div>
            <div className="rowf gp-2">
              {editable && (
                <>
                  <button className="btn btn-2" disabled={!f.docId} onClick={() => send(false)}>احفظ المسودة</button>
                  <button className="btn btn-p" disabled={issues.length > 0} title={issues[0] ?? 'أرسل للاعتماد'} onClick={() => send(true)}>أرسل للاعتماد</button>
                </>
              )}
              {myStep && existing && (
                <>
                  <button className="btn btn-p" disabled={execBlocked.length > 0} title={execBlocked[0]} onClick={() => setDecide('ok')}>{okSay(myStep, existing.amount)}</button>
                  <button className="btn btn-2" onClick={() => setDecide('back')}>{STEP_SAY[myStep].back}</button>
                  <button className="btn btn-d" onClick={() => setDecide('reject')}>ارفض الطلب</button>
                </>
              )}
              {!editable && !myStep && (
                <Link className="btn btn-2" to={ROUTES.budgetOps}>كل الطلبات</Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {decide && myStep && existing && (
        <NoteModal
          title={`${decide === 'reject' ? 'ارفض الطلب' : decide === 'ok' ? okSay(myStep, existing.amount) : STEP_SAY[myStep].back} · ${existing.id}`}
          cta={decide === 'reject' ? 'ارفض الطلب' : decide === 'ok' ? okSay(myStep, existing.amount) : STEP_SAY[myStep].back}
          reasons={decide === 'reject' ? BUDGET_RULES.opRejectReasons : decide === 'back' ? BUDGET_RULES.opReturnReasons : undefined}
          tone={decide === 'ok' ? 'btn-p' : decide === 'reject' ? 'btn-d' : 'btn-2'}
          required={decide !== 'ok'}
          hint={decide === 'ok' && (myStep === 'exec' || (myStep === 'finance' && financeDecides(existing.amount))) ? 'الاعتماد النهائي ينفّذ العملية آليًا ويحدّث أرصدة البنود المتأثرة.' : undefined}
          onClose={() => setDecide(null)}
          onDone={(note) => decideRequest(existing.id, decide === 'ok' ? 'approve' : decide === 'back' ? 'return' : 'reject', note, me)}
        />
      )}
    </AppLayout>
  )
}
