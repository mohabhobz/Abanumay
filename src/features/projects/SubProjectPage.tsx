import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, FieldSelect, Glass, Head, Icon, KV, Money, MoneyField, Person, Steps, Tabs, Tag, icons, type StepItem,
} from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { entityById } from '@/data/mock/entities'
import { isolate, nf } from '@/lib/format'
import { noteFirst } from '@/lib/dock'
import {
  SUB_IMPL_SAY, SUB_STATE_SAY, SUB_STATE_TONE, SUB_STEPS, completeSub, decideSubs, pfActivities, pfMoney, profileOf, recommendSubs,
  rejectSubDirect, returnSub, saveSubInfo, sendSubs, studySubs, subIssues, subOf, subStep, submitSubResults, usePartners,
  type PortfolioRec, type SubImplementer, type SubProject,
} from '@/data/partners/store'
import { Said } from '@/features/partners/parts'
import type { Reading } from '@/components/assistant/reading'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { subOutcome } from '@/data/shared/outcome'

/* A portfolio's sub-project on a page of its own (client 20 Oct · #17 – #20 · #27).

   It reads like a regular project's page, lighter: the header carries its serial, value and the portfolio
   it belongs to; the path says who holds it; the tabs hold its data, the outputs and stages copied from the
   portfolio, its results and its own history; and the dock at the bottom carries the decision of whoever
   holds it now:
   · the entity · drafts and submits it, then records its results once it runs
   · the grants supervisor · recommends approval or rejection (to the grants manager), rejects outright,
     or returns it to the entity · later approves or returns the results
   · the grants manager · approves, rejects, or returns it to the supervisor for completion
   The partner opens the same page with `?as=partner`. */

type TabKey = 'data' | 'plan' | 'results' | 'log'
type Act = { key: string; label: string; kind: string; needsNote?: boolean; run: (note: string) => string[] }

export default function SubProjectPage() {
  const { id = '', sid = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const asPartner = params.get('as') === 'partner'
  usePartners()
  const { role, user } = useRole()
  const [tab, setTab] = useState<TabKey>('data')
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const found = subOf(id, sid)
  const back = `${ROUTES.portfolio(id)}${asPartner ? '?as=partner' : ''}`

  if (!found) {
    return (
      <AppLayout assistantContext={assistFor.page('المشروع الفرعي')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="المحفظة" onClick={() => navigate(back)} />
          <Glass><Empty title="المشروع الفرعي غير موجود." note="تُفتح المشاريع الفرعية من محفظتها." /></Glass>
        </div></div>
      </AppLayout>
    )
  }
  const { pf, sub: x } = found
  const by = asPartner ? entityName(pf) : user.name
  const sup = !asPartner && role.key === 'supervisor'
  const mgr = !asPartner && role.key === 'grants-manager'
  const entity = asPartner || sup
  const at = subStep(x)
  const off = x.state === 'rejected' || x.state === 'excluded'
  const steps: StepItem[] = SUB_STEPS.map((label, i) => ({
    label,
    note: STEP_NOTE[i],
    state: off ? (i < at ? 'done' : i === at ? 'no' : 'skip') : x.state === 'done' || i < at ? 'done' : i === at ? 'now' : 'todo',
  }))

  const r = (out: string[], ok: string) => { setSaid(out.length ? { bad: out } : { ok }); if (!out.length) setNote('') }
  const acts: Act[] = []
  if (asPartner && x.state === 'draft') acts.push({ key: 'send', label: 'ارفعه لمشرف المنح', kind: 'btn-p', run: () => sendSubs(pf.id, [x.id], by) })
  if (sup && x.state === 'submitted') acts.push({ key: 'study', label: 'ابدأ الدراسة', kind: 'btn-2', run: () => studySubs(pf.id, [x.id], by, role.key) })
  if (sup && (x.state === 'submitted' || x.state === 'study')) {
    acts.push(
      { key: 'return', label: 'إعادة للجهة', kind: 'btn-2', needsNote: true, run: (n) => returnSub(pf.id, x.id, n, by, role.key) },
      { key: 'reject', label: 'رفض مباشر', kind: 'btn-d', needsNote: true, run: (n) => rejectSubDirect(pf.id, x.id, n, by, role.key) },
      { key: 'recNo', label: 'توصية بالرفض', kind: 'btn-2', needsNote: true, run: (n) => recommendSubs(pf.id, [{ subId: x.id, outcome: 'reject', note: n }], by, role.key) },
      { key: 'recOk', label: 'توصية بالموافقة', kind: 'btn-p', run: (n) => recommendSubs(pf.id, [{ subId: x.id, outcome: 'approve', note: n }], by, role.key) },
    )
  }
  if (mgr && x.state === 'pending') {
    acts.push(
      { key: 'back', label: 'إعادة للاستكمال', kind: 'btn-2', needsNote: true, run: (n) => returnSub(pf.id, x.id, n, by, role.key) },
      { key: 'no', label: 'رفض', kind: 'btn-d', needsNote: true, run: (n) => decideSubs(pf.id, [{ subId: x.id, outcome: 'reject', reason: n }], by, role.key) },
      { key: 'ok', label: 'موافقة', kind: 'btn-p', run: (n) => decideSubs(pf.id, [{ subId: x.id, outcome: 'approve', note: n }], by, role.key) },
    )
  }
  if (sup && x.state === 'closing' && x.ready) {
    acts.push(
      { key: 'resBack', label: 'أعد النتائج للجهة', kind: 'btn-2', needsNote: true, run: (n) => completeSub(pf.id, x.id, 'return', n, by, role.key) },
      { key: 'resOk', label: 'اعتمد النتائج · مغلق', kind: 'btn-p', run: (n) => completeSub(pf.id, x.id, 'approve', n, by, role.key) },
    )
  }
  const recording = entity && (x.state === 'approved' || (x.state === 'closing' && !x.ready))
  const needNote = acts.some((a) => a.needsNote)
  const holder = HOLDER[at]

  const readings: Reading[] = [
    ...(x.returned && (x.state === 'draft' || x.state === 'study') ? [{ id: 'sp-ret', kind: 'flag' as const, label: 'معاد للاستكمال', text: x.returned.note, src: '' }] : []),
    ...(x.state === 'draft' ? subIssues(pf, x, x.id).map((t, i) => ({ id: `sp-miss-${i}`, kind: 'flag' as const, label: 'ينقص قبل الرفع', text: t, src: '' })) : []),
    ...(x.rec && x.state === 'pending' ? [{ id: 'sp-rec', kind: 'note' as const, label: 'توصية المشرف', text: `${x.rec.outcome === 'approve' ? 'بالموافقة' : 'بالرفض'}${x.rec.note ? ` · ${x.rec.note}` : ''}`, src: '' }] : []),
    { id: 'sp-bal', kind: 'note' as const, label: 'رصيد المحفظة', metric: { value: nf.format(Math.max(0, pfMoney(pf).available)), unit: 'ريال' }, text: `من ${nf.format(pf.total)} · قيمة هذا المشروع ${nf.format(x.amount)}.`, src: '' },
  ]

  return (
    <AppLayout assistantContext={assistFor.page(x.name)}>
      <div className={`viewstack${acts.length ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo label={pf.name} onClick={() => navigate(back)} />
          <Said said={said} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{x.name}</h1>
              <p className="sub mt-1">
                <span className="num">{x.serial ?? x.id}</span> · مشروع فرعي في <Link className="tlink" to={back}>{pf.name}</Link> · {x.track ?? pf.track} · {x.field ?? pf.field}
              </p>
              <div className="gt-tag rowf gp-2">
                <Tag tone={SUB_STATE_TONE[x.state]}>{SUB_STATE_SAY[x.state]}{x.state === 'closing' && x.ready ? ' · النتائج عند المشرف' : ''}</Tag>
                {/* Client sheet 24 Oct (#95) · the sub-project's outcome once it ends */}
                <OutcomeTag outcome={subOutcome(x.state)} />
                <span className="sub">عند {holder}</span>
              </div>
            </div>
            <div className="spj-amt">
              <span className="sub">قيمة المنحة</span>
              <Money>{x.amount}</Money>
            </div>
          </header>

          {x.returned && (x.state === 'draft' || x.state === 'study') && (
            <Glass>
              <Head title="ملاحظات الإعادة" meta={<Tag tone="warn">للاستكمال</Tag>} />
              <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(x.returned.note)} · <Person name={x.returned.by} /></span></div>
            </Glass>
          )}
          {x.state === 'rejected' && x.reason && (
            <Glass>
              <Head title="سبب الرفض" meta={<Tag tone="no">مرفوض</Tag>} />
              <p className="prose">{isolate(x.reason)}</p>
            </Glass>
          )}

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="مسار المشروع الفرعي" meta={<span className="sub">الجهة · المشرف · المدير · التنفيذ · النتائج</span>} />
                <Steps items={steps} flow="row" />
              </Glass>

              <Tabs
                items={[
                  { slug: 'data', label: 'البيانات' },
                  { slug: 'plan', label: 'المخرجات ومراحل التنفيذ' },
                  { slug: 'results', label: 'النتائج' },
                  { slug: 'log', label: 'السجل', count: x.log?.length ?? 0 },
                ]}
                active={tab}
                onChange={(s) => setTab(s as TabKey)}
              />

              {tab === 'data' && <DataCard pf={pf} x={x} edit={entity && !['rejected', 'excluded', 'done'].includes(x.state)} by={by} />}
              {tab === 'plan' && <PlanCard x={x} />}
              {tab === 'results' && <ResultsCard pf={pf} x={x} recording={recording} by={by} />}
              {tab === 'log' && (
                <Glass>
                  <Head title="سجلّ المشروع الفرعي" />
                  {x.log?.length ? (
                    <ul className="plchg">
                      {x.log.slice().reverse().map((a, i) => (
                        <li key={`${a.at}-${i}`}>
                          <div className="plchg-h"><Tag tone="mute"><DateText>{a.at}</DateText></Tag><span className="sub">{a.by}</span></div>
                          <p className="plchg-t">{isolate(a.what)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <Empty title="لا سجل بعد." />}
                </Glass>
              )}
            </div>

            <AssistantAside title="قراءة المشروع الفرعي" cta="اقرأ المشروع" empty="المشروع الفرعي في مساره · لا ملاحظات." readings={readings} ask={!asPartner} />
          </div>
        </div>

        {(acts.length > 0 || recording) && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">
                <Person name={user.name} size="lg" quiet={false} />
                <span className="decsent">قرارك في <b>{x.name}</b><span className="decsep" />{nf.format(x.amount)} ريال</span>
              </div>
              <div className="payact-g">
                {needNote && (
                  <label className="payact-n">
                    <span className="vis-h">الملاحظة</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب الإعادة أو الرفض · إلزامي" />
                  </label>
                )}
                <div className="rowf gp-2">
                  {recording && acts.length === 0 && <button type="button" className="btn btn-p" onClick={() => setTab('results')}>سجّل النتائج</button>}
                  {noteFirst(acts).map((a) => {
                    const stop = a.needsNote && !note.trim() ? 'اكتب الملاحظة أولًا' : ''
                    return (
                      <button key={a.key} type="button" className={`btn ${a.kind}`} data-needs-note={a.needsNote ? '' : undefined} disabled={Boolean(stop)} title={stop} onClick={() => r(a.run(note), a.label)}>
                        {a.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

const STEP_NOTE = ['ترفعه', 'دراسة وتوصية', 'القرار', 'تسجيل النتائج', 'مشرف المنح', 'مكتمل']
const HOLDER = ['الجهة', 'مشرف المنح', 'مدير المنح', 'الجهة · التنفيذ', 'مشرف المنح · النتائج', '—']
const entityName = (pf: PortfolioRec) => profileOf(pf.entityId)?.name ?? entityById(pf.entityId)?.name ?? pf.entityId

/* ── The data · the client's sheet: the implementer, region, city, beneficiaries, end beneficiaries, cost, the evaluation file ── */
function DataCard({ pf, x, edit, by }: { pf: PortfolioRec; x: SubProject; edit: boolean; by: string }) {
  const [open, setOpen] = useState(false)
  const [d, setD] = useState({ implementer: x.implementer ?? '', implementerName: x.implementerName ?? '', city: x.city ?? '', finalBeneficiaries: String(x.finalBeneficiaries ?? ''), cost: String(x.cost ?? ''), evalFile: x.evalFile ?? '' })
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const act = pfActivities(pf).find((a) => a.id === x.activityId)
  const save = () => {
    const out = saveSubInfo(pf.id, x.id, {
      implementer: (d.implementer || undefined) as SubImplementer | undefined, implementerName: d.implementerName.trim() || undefined, city: d.city.trim() || undefined,
      finalBeneficiaries: d.finalBeneficiaries ? Number(d.finalBeneficiaries) : undefined, cost: d.cost ? Number(d.cost) : undefined, evalFile: d.evalFile || undefined,
    }, by)
    setSaid(out.length ? { bad: out } : { ok: 'بيانات المشروع الفرعي' })
    if (!out.length) setOpen(false)
  }
  return (
    <Glass>
      <Head title="بيانات المشروع الفرعي" meta={edit && !open ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>عدّل البيانات</button> : undefined} />
      {!open && (
        <KV rows={[
          { k: 'الرقم', v: <span className="num">{x.serial ?? x.id}</span> },
          { k: 'المنفذ', v: x.implementer ? `${SUB_IMPL_SAY[x.implementer]}${x.implementerName ? ` · ${x.implementerName}` : ''}` : '—' },
          { k: 'المنطقة', v: x.region },
          { k: 'المدينة', v: x.city || '—' },
          { k: 'عدد المستفيدين', v: <span className="num">{nf.format(x.beneficiaries)}</span> },
          { k: 'عدد المستفيد النهائي', v: x.finalBeneficiaries !== undefined ? <span className="num">{nf.format(x.finalBeneficiaries)}</span> : '—' },
          { k: 'قيمة المنحة', v: <Money sm>{x.amount}</Money> },
          { k: 'التكلفة', v: x.cost ? <Money sm>{x.cost}</Money> : '—' },
          { k: 'المخرجات المستهدفة', v: x.outputs || '—' },
          { k: 'التقييم التفصيلي', v: x.evalFile ?? <span className="sub">ملف حسب نموذج التقييم المعتمد للمحفظة</span> },
          { k: 'المرفقات', v: x.files.join(' · ') || '—' },
          ...(act ? [{ k: 'نشاط خطة المحفظة', v: act.label }] : []),
          { k: 'أضافه', v: <><Person name={x.addedBy} /> <span className="sub">· <DateText>{x.addedAt}</DateText></span></> },
        ]} />
      )}
      {open && (
        <div className="ptn-form">
          <div className="regfields">
            <label className="regf"><span className="lb">المنفذ</span><FieldSelect value={d.implementer} onChange={(v) => setD({ ...d, implementer: v })} label="المنفذ" placeholder="اختر" options={(Object.keys(SUB_IMPL_SAY) as SubImplementer[]).map((k) => ({ value: k, label: SUB_IMPL_SAY[k] }))} /></label>
            <label className="regf"><span className="lb">اسم المنفذ</span><span className="fld"><input value={d.implementerName} onChange={(e) => setD({ ...d, implementerName: e.target.value })} aria-label="اسم المنفذ" /></span></label>
            <label className="regf"><span className="lb">المدينة</span><span className="fld"><input value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} aria-label="المدينة" /></span></label>
            <label className="regf"><span className="lb">عدد المستفيد النهائي</span><span className="fld"><input inputMode="numeric" value={d.finalBeneficiaries} onChange={(e) => setD({ ...d, finalBeneficiaries: e.target.value.replace(/\D/g, '') })} aria-label="عدد المستفيد النهائي" /></span></label>
            <label className="regf"><span className="lb">التكلفة</span><MoneyField value={d.cost} onChange={(v) => setD({ ...d, cost: v })} label="التكلفة" /></label>
          </div>
          <div className="apv-row">
            <span className="sub">{d.evalFile || 'التقييم التفصيلي · ملف'}</span>
            <UploadButton label="ملف التقييم" onPick={(f) => setD((y) => ({ ...y, evalFile: f.name }))} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>إلغاء</button>
            <button type="button" className="btn btn-p btn-sm" onClick={save}>احفظ</button>
          </div>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── The outputs and stages · copied from the portfolio when it was created (#20) ── */
function PlanCard({ x }: { x: SubProject }) {
  return (
    <>
      <Glass>
        <Head title="المخرجات" meta={<span className="sub">منسوخة من المحفظة عند الإنشاء</span>} />
        {x.outputsCopy?.length ? <ul className="spj-list">{x.outputsCopy.map((o) => <li key={o}>{isolate(o)}</li>)}</ul> : <Empty title="لا مخرجات في المحفظة." />}
      </Glass>
      <Glass className="tblcard">
        <Head title="مراحل التنفيذ" meta={<span className="sub">{x.phasesCopy?.length ?? 0} مراحل · من خطة المحفظة</span>} />
        {x.phasesCopy?.length ? (
          <div className="tblwrap">
            <table className="tbl" aria-label="مراحل التنفيذ">
              <thead><tr><th><span className="th-t">المرحلة</span></th><th><span className="th-t">من</span></th><th><span className="th-t">إلى</span></th></tr></thead>
              <tbody>
                {x.phasesCopy.map((p) => (
                  <tr key={p.name}><td>{p.name}</td><td><DateText>{p.from}</DateText></td><td><DateText>{p.to}</DateText></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="لا مراحل · خطة المحفظة لم تُعتمد عند إنشائه." />}
      </Glass>
    </>
  )
}

/* ── The results · the entity sends them, the supervisor approves (#27) ── */
function ResultsCard({ pf, x, recording, by }: { pf: PortfolioRec; x: SubProject; recording: boolean; by: string }) {
  const [v, setV] = useState({ cost: String(x.results?.cost ?? ''), reached: String(x.results?.reached ?? ''), files: x.results?.files ?? [], note: x.results?.note ?? '' })
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const send = () => {
    const out = submitSubResults(pf.id, x.id, { cost: Number(v.cost) || 0, reached: Number(v.reached) || 0, files: v.files, note: v.note }, by)
    setSaid(out.length ? { bad: out } : { ok: 'أُرسلت النتائج لمشرف المنح' })
  }
  return (
    <Glass>
      <Head title="نتائج المشروع الفرعي" meta={x.results ? <Tag tone={x.state === 'done' ? 'ok' : 'warn'}>{x.state === 'done' ? 'معتمدة' : x.ready ? 'عند مشرف المنح' : 'معادة'}</Tag> : <span className="sub">تسجّلها الجهة بعد الاعتماد · يعتمدها مشرف المنح</span>} />
      {x.results && (
        <KV rows={[
          { k: 'التكلفة الفعلية', v: <Money sm>{x.results.cost}</Money> },
          { k: 'المستفيدون الفعليون', v: <><span className="num">{nf.format(x.results.reached)}</span> <span className="sub">من {nf.format(x.beneficiaries)} مستهدف</span></> },
          { k: 'المرفقات', v: x.results.files.join(' · ') },
          ...(x.results.note ? [{ k: 'ملاحظات', v: isolate(x.results.note) }] : []),
          { k: 'أرسلها', v: <><Person name={x.results.by} /> <span className="sub">· <DateText>{x.results.at}</DateText></span></> },
        ]} />
      )}
      {x.outcome && x.state === 'closing' && !x.ready && <p className="bad cnote">أُعيدت · {isolate(x.outcome.note)}</p>}
      {!x.results && !recording && <p className="sub">{['draft', 'submitted', 'study', 'pending'].includes(x.state) ? 'تُسجَّل النتائج بعد اعتماد المشروع الفرعي.' : 'لا نتائج مسجّلة.'}</p>}
      {recording && (
        <div className="ptn-form">
          <div className="regfields">
            <label className="regf"><span className="lb">التكلفة الفعلية</span><MoneyField value={v.cost} onChange={(c) => setV({ ...v, cost: c })} label="التكلفة الفعلية" /></label>
            <label className="regf"><span className="lb">المستفيدون الفعليون</span><span className="fld"><input inputMode="numeric" value={v.reached} onChange={(e) => setV({ ...v, reached: e.target.value.replace(/\D/g, '') })} aria-label="المستفيدون الفعليون" /></span></label>
            <label className="regf ptn-wide"><span className="lb">ملاحظات · اختياري</span><span className="fld"><input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} aria-label="ملاحظات النتائج" placeholder={`المستهدف: ${x.outputs}`} /></span></label>
          </div>
          <div className="apv-row">
            <span className="sub">{v.files.length ? v.files.join(' · ') : 'المرفقات · واحد أو أكثر'}</span>
            <UploadButton label="مرفق" onPick={(f) => setV((y) => ({ ...y, files: [...y.files, f.name] }))} />
            {v.files.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setV((y) => ({ ...y, files: y.files.slice(0, -1) }))}>احذف آخر مرفق</button>}
            <button type="button" className="btn btn-p btn-sm" onClick={send}>أرسل النتائج لمشرف المنح</button>
          </div>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}
