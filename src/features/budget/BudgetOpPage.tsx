import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BackTo, Blockers, DateText, Empty, FieldSelect, Glass, Head, Icon, KV, Money, Person, Riyal, Tag, icons,
} from '@/components/ui'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf } from '@/lib/format'
import {
  docSources, docTitle, fiscalYears, leavesOf, lineUsable, moneyOf, pathOf, yearById, type BudgetDoc,
} from '@/data/mock/budgetTree'
import { readRole, roleByKey } from '@/data/roles'
import {
  FINANCE_ACTOR, REQ_KIND_SAY, REQ_STATE_SAY, decideRequest, docOf, freeOf, liveBudgets, mayAct, nextReqId,
  reqById, reqIssues, reqTone, saveRequest, sourceName, stepOf, useBudget, whoActs,
  type BudgetRequest, type ReqKind,
} from '@/data/budget/store'
import { BUDGET_RULES } from '@/data/budget/rules'
import { FlowSteps, History, NoteModal } from './doc/DocFlow'

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
  finance: { ok: 'وافق وأحِل إلى المدير التنفيذي', back: 'أعد إلى مدير المنح' },
  exec: { ok: 'اعتمد ونفّذ', back: 'أعد إلى الإدارة المالية' },
} as const

const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

type Form = Omit<BudgetRequest, 'events' | 'state' | 'createdAt' | 'submittedAt' | 'result'>

export default function BudgetOpPage() {
  const { id } = useParams()
  const [q] = useSearchParams()
  const navigate = useNavigate()
  useBudget()
  const role = readRole()
  const me = roleByKey(role).name

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

  const budgets = liveBudgets().filter((d) => !f.yearId || d.yearId === f.yearId)
  const leaves = (d?: BudgetDoc) => (d ? leavesOf(d.nodes).filter((n) => n.parentId !== null) : [])
  const opt = (d: BudgetDoc, nid: string) => {
    const n = d.nodes.find((x) => x.id === nid)!
    return { value: nid, label: isolate(`${pathOf(d.nodes, nid).split(' · ').slice(1).join(' · ')} · متاح ${nf.format(freeOf(d, nid))}${lineUsable(d.nodes, n.id) ? '' : ' · موقوف'}`) }
  }
  const put = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const send = (go: boolean) => {
    const rid = f.id || nextReqId()
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
      out.push({ k: `«${from.label}»`, v: <span className="sub">مخصص <Money sm>{from.allocated}</Money> ← <b><Money sm>{from.allocated - r.amount}</Money></b> · متاح <Money sm>{m.available}</Money> ← <Money sm>{m.available - r.amount}</Money></span> })
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

  return (
    <AppLayout assistantContext={assistFor.page(title)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <BackTo label="طلبات العمليات" onClick={() => navigate(ROUTES.budgetOps)} />
          <header>
            <div>
              <h1 className="ptitle">{title}</h1>
              <p className="sub mt-1">مناقلة أو تعزيز أو تخفيض على ميزانية معتمدة · يُعتمد بمسار الميزانية نفسه ويُنفَّذ آليًا عند الاعتماد النهائي</p>
            </div>
            {existing && <Tag tone={reqTone(existing.state)}>{REQ_STATE_SAY[existing.state]}</Tag>}
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
                <Head title="بيانات الطلب" meta={<span className="sub"><bdi>1.3.1–1.3.3</bdi></span>} />
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
              {(editable || myStep === 'exec') && (
                <Blockers
                  title={editable ? 'ما يمنع الإرسال' : 'ما يمنع التنفيذ'}
                  items={issues.map((t) => ({ text: t, why: 'تحقّق النظام' }))}
                  ready={editable ? 'الأرصدة والسياسة تسمح · الطلب جاهز للإرسال.' : 'الأرصدة ما زالت تسمح · يُنفَّذ عند اعتمادك.'}
                />
              )}
              {impact.length > 0 && existing?.state !== 'executed' && (
                <Glass>
                  <Head title="الأثر عند التنفيذ" />
                  <KV rows={impact} />
                  <p className="sub cnote">وتتحرك معها البنود التي فوقها حتى البند المشترك بينهما · فيبقى كل أب مساويًا لمجموع أبنائه.</p>
                </Glass>
              )}
              {existing && (
                <Glass>
                  <Head title="مسار الاعتماد" meta={<Tag tone={reqTone(existing.state)}>{REQ_STATE_SAY[existing.state]}</Tag>} />
                  <FlowSteps state={existing.state} last="التنفيذ" />
                  <h3 className="stdy-h mt-3">السجل</h3>
                  <History events={existing.events} />
                </Glass>
              )}
            </div>

            <AssistantAside
              title="قراءة طلب الميزانية"
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
                {editable ? (issues.length ? <>{issues.length} ملاحظة قبل الإرسال</> : <>جاهز · <Money>{f.amount}</Money></>)
                  : myStep ? <>بانتظار قرارك · <b>{STEP_SAY[myStep].ok}</b></>
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
                  <button className="btn btn-p" disabled={execBlocked.length > 0} title={execBlocked[0]} onClick={() => setDecide('ok')}>{STEP_SAY[myStep].ok}</button>
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
          title={`${decide === 'reject' ? 'ارفض الطلب' : STEP_SAY[myStep][decide]} · ${existing.id}`}
          cta={decide === 'reject' ? 'ارفض الطلب' : STEP_SAY[myStep][decide]}
          tone={decide === 'ok' ? 'btn-p' : decide === 'reject' ? 'btn-d' : 'btn-2'}
          required={decide !== 'ok'}
          hint={decide === 'ok' && myStep === 'exec' ? 'الاعتماد النهائي ينفّذ العملية آليًا ويحدّث أرصدة البنود المتأثرة.' : undefined}
          onClose={() => setDecide(null)}
          onDone={(note) => decideRequest(existing.id, decide === 'ok' ? 'approve' : decide === 'back' ? 'return' : 'reject', note, myStep === 'finance' ? FINANCE_ACTOR : me)}
        />
      )}
    </AppLayout>
  )
}
