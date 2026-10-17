import { useState } from 'react'
import { payBlock } from '@/data/entities/store'
import { portfolioAi } from '@/data/shared/ai'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BackTo, DateField, DateText, Empty, FieldSelect, Glass, Head, Icon, KV, Money, MoneyField, Person, Steps, Tag, icons, type StepItem,
} from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { REGIONS } from '@/data/mock/taxonomy'
import { entityById } from '@/data/mock/entities'
import { isolate, nf, pct } from '@/lib/format'
import { noteFirst } from '@/lib/dock'
import { HOLD_STAGE_SAY, linkOf, usableLines } from '@/data/budget/store'
import {
  PF_STAGE_SAY, PF_STAGE_TONE, SUB_STATE_SAY, SUB_STATE_TONE, actOnPfAgreement, actOnPfPlan, actOnPfReq, actOnPortfolio, addSub, capIssue,
  decideSubs, dropSub, pfActions, pfById, pfCloseChecks, pfIndicators, pfMoney, pfStops, savePfPlan, savePfSchedule,
  sendSubs, subsGate, submitPfReport, updateSubExec, usePartners, requestPfPay, pfReqIssue, profileOf,
  type PfPhase, type PortfolioRec, type SubExec, type SubProject, pfActivities, pfActivityProgress, PF_ACTIVITY_MODE, setPfActivityMode, linkSubActivity,
  PF_CLOSE_SAY, PF_REQ_SAY, SUB_FIELDS_DEFAULT, SUB_FIELD_SAY, actOnPfClose, actOnPfEval, attachPfCriteria, attachPfMinutes, cancelPortfolio, castPfVote, completeSub,
  excludeSub, isLiveSub, pfApproverOf, pfEvalScore, pfSessions, pfToSession, recommendSubs, recordPfReceipt, savePfEval, savePfForm, setPfReliable, stallSub, studySubs,
  type PfRequest, type SubField, type SubState,
} from '@/data/partners/store'
import { SESSIONS, voteTally } from '@/data/approvals/store'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import { Checks, Said, SlotsEditor } from '@/features/partners/parts'
import type { Reading } from '@/components/assistant/reading'

/* A portfolio · a strategic partner's parent record with sub-projects under it (BPD-013).

   The page follows the portfolio's life in order, and each card says what it waits on:
   · approval as a whole · supervisor → grants manager → CEO, the total held once on the budget
     when the supervisor recommends and fixed at the final approval (13.2.6 · 13.2.7)
   · then the plan and the agreement · nothing below opens before both (13.2.8 – 13.2.10)
   · the sub-projects · added gradually by the supervisor or the partner, sent one or many at a
     time, each decided on its own by the grants manager within the portfolio's ceiling; a pending
     one holds its value inside the portfolio, a rejected one gives it back (13.2.11 – 13.2.19)
   · the money · Ehsan executes and the supervisor records per sub-project, or the portfolio asks
     for its scheduled payments; finance confirms either; the sub-projects' values split the total,
     they are not what's paid against (13.2.23 – 13.2.25)
   · execution and results the partner reports, then its final report and the closing once every
     approved sub-project meets its requirements (13.2.20 – 13.2.30)
   The partner opens the same page with `?as=partner`: it adds and follows its own sub-projects,
   signs the agreement and files the final report · it decides nothing. */

const sumOf = (xs: { cost: number }[]) => xs.reduce((s, x) => s + x.cost, 0)

export default function PortfolioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const asPartner = params.get('as') === 'partner'
  usePartners()
  const { role, user } = useRole()
  const pf = id ? pfById(id) : undefined
  const [note, setNote] = useState('')
  const [line, setLine] = useState('')
  const [split, setSplit] = useState<{ key: string; amount: string }[]>([])
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})

  if (!pf) {
    return (
      <AppLayout assistantContext={assistFor.page('المحافظ')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="الشركاء" onClick={() => navigate(ROUTES.partners)} />
          <Glass><Empty title="المحفظة غير موجودة." note="تُسجَّل المحافظ للشركاء الاستراتيجيين المعتمدين." /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  const m = pfMoney(pf)
  const ind = pfIndicators(pf)
  const gate = subsGate(pf)
  const actions = pfActions(pf, role.key, asPartner)
  const needNote = actions.some((a) => a.needsNote)
  const lines = usableLines('fy-2026')
  /* the partners' portfolios allocation first · then the partnerships' other allocation · then any line that covers it */
  const preferred = lines.find((l) => l.node.id === 'tPg2' && l.free >= pf.total) ?? lines.find((l) => l.node.id === 'tPg1' && l.free >= pf.total) ?? lines.find((l) => l.free >= pf.total)
  const lineKey = line || preferred?.key || ''
  const pick = lines.find((l) => l.key === lineKey)
  /* Batch 6 · 8 Oct · the hold can split across lines, in one budget or several (13.2.7) · the parts
     add up to the portfolio's value */
  const splitShares = split.map((x) => { const l = lines.find((y) => y.key === x.key); return l ? { docId: l.doc.id, nodeId: l.node.id, amount: Number(x.amount) || 0 } : undefined }).filter((x): x is NonNullable<typeof x> => Boolean(x))
  const shares = split.length ? splitShares : pick ? [{ docId: pick.doc.id, nodeId: pick.node.id, amount: pf.total }] : undefined
  const link = linkOf(pf.id)
  const partner = pf.entityId

  const act = (a: (typeof actions)[number]) => {
    const out = actOnPortfolio(pf.id, a.act, note, user.name, a.act === 'recommend' ? shares : undefined)
    setSaid(out.length ? { bad: out } : { ok: a.label })
    if (!out.length) setNote('')
  }

  const steps: StepItem[] = [
    { label: 'الطلب', note: pf.origin === 'partner' ? 'من بوابة الشريك' : 'مشرف المنح', state: pf.stage === 'draft' || pf.stage === 'returned' ? 'now' : 'done' },
    { label: 'الدراسة والاعتماد', note: 'حسب مصفوفة الاعتماد', state: ['supervisor', 'manager', 'ceo', 'committee', 'board'].includes(pf.stage) ? 'now' : ['draft', 'returned', 'rejected'].includes(pf.stage) ? 'todo' : 'done' },
    { label: 'الخطة والاتفاقية', note: 'قبل أي مشروع فرعي', state: pf.stage !== 'approved' && pf.stage !== 'closing' && pf.stage !== 'closed' ? 'todo' : gate.ok || pf.stage !== 'approved' ? 'done' : 'now' },
    { label: 'المشاريع الفرعية', note: `${m.approvedCount} معتمد`, state: gate.ok ? 'now' : pf.stage === 'closing' || pf.stage === 'closed' ? 'done' : 'todo' },
    { label: pf.stage === 'cancelled' ? 'ملغاة' : 'الإغلاق', note: pf.stage === 'cancelled' ? 'استرداد على مستوى المحفظة' : 'التقرير الشامل والتقييم', state: pf.stage === 'closed' || pf.stage === 'cancelled' ? 'done' : pf.stage === 'closing' ? 'now' : 'todo' },
  ]

  const readings: Reading[] = [
    ...(pf.stage === 'supervisor' && !link ? [{ id: 'pf-hold', kind: 'flag' as const, label: 'الحجز', text: 'اختر بند الميزانية قبل التوصية · تُحجز القيمة كاملةً مرة واحدة.', src: /* doc 13.2.7 */ '' }] : []),
    ...(!gate.ok && pf.stage === 'approved' ? [{ id: 'pf-gate', kind: 'flag' as const, label: 'المشاريع الفرعية', text: gate.why, src: /* doc 13.2.10 */ '' }] : []),
    ...(m.pending ? [{ id: 'pf-pend', kind: 'note' as const, label: 'قيد الاعتماد', metric: { value: nf.format(m.pending), unit: 'ريال' }, text: `${pf.items.filter((x) => x.state === 'pending').length} مشروع بانتظار قرار مدير المنح · قيمتها محجوزة داخل المحفظة.`, src: /* doc 13.4.16 */ '' }] : []),
    { id: 'pf-avail', kind: m.available < 0 ? 'flag' as const : 'note' as const, label: 'الرصيد المتاح', metric: { value: nf.format(Math.max(0, m.available)), unit: 'ريال' }, text: `من ${nf.format(pf.total)} · معتمد ${nf.format(m.approved)} وقيد الاعتماد ${nf.format(m.pending)}.`, src: /* doc 13.2.18 */ '', bar: { value: m.approved + m.pending, limit: pf.total, valueLabel: 'المعتمد وقيد الاعتماد', limitLabel: 'المحفظة', unit: 'ريال' } },
    ...(m.recorded > m.confirmed ? [{ id: 'pf-fin', kind: 'flag' as const, label: 'المراجعة المالية', metric: { value: nf.format(m.recorded - m.confirmed), unit: 'ريال' }, text: 'دفعات مسجلة لم تؤكدها المالية بعد.', src: /* doc 11.2.13 */ '' }] : []),
    /* Cross · the periodic summary, the early delay forecast and the fit with the portfolio's goals */
    ...(asPartner ? [] : portfolioAi(pf)),
  ]

  return (
    <AppLayout assistantContext={assistFor.page(pf.name)}>
      <div className={`viewstack${actions.length ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo label={asPartner ? 'البوابة' : 'الشركاء'} onClick={() => navigate(asPartner ? `${ROUTES.entityPortal}?entity=${partner}` : ROUTES.partnersTab('portfolios'))} />
          <Said said={said} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{pf.name}</h1>
              <p className="sub mt-1">
                <span className="num">{pf.id}</span> · {asPartner ? 'محفظتك' : <Link className="tlink" to={ROUTES.entity(partner)}>{entityName(pf)}</Link>} · {pf.track} · {pf.field} · فُتحت <DateText>{pf.openedAt}</DateText>
              </p>
              <div className="gt-tag rowf gp-2">
                <Tag tone={PF_STAGE_TONE[pf.stage]}>{PF_STAGE_SAY[pf.stage]}</Tag>
                <Tag tone="mute">دفعات على مستوى المحفظة</Tag>
              </div>
            </div>
          </header>

          {pf.note && (pf.stage === 'returned' || pf.stage === 'rejected' || pf.stage === 'supervisor' || pf.stage === 'manager') && (
            <Glass>
              <Head title={pf.stage === 'rejected' ? 'سبب الرفض' : 'ملاحظات الإعادة'} meta={<Tag tone={pf.stage === 'rejected' ? 'no' : 'warn'}>{pf.stage === 'rejected' ? 'مرفوضة' : 'للاستكمال'}</Tag>} />
              <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(pf.note)}</span></div>
            </Glass>
          )}

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="مسار المحفظة" meta={<span className="sub">المسار المعتاد والصلاحيات المالية</span>} />
                <Steps items={steps} flow="ladder" />
              </Glass>

              <Glass>
                <Head title="بيانات المحفظة" />
                <KV rows={[
                  { k: 'الشريك', v: entityName(pf) },
                  { k: 'قيمة المحفظة', v: <Money>{pf.total}</Money> },
                  { k: 'المسار والمجال', v: `${pf.track} · ${pf.field} · يرثهما كل مشروع فرعي` },
                  { k: 'الأهداف', v: isolate(pf.goals) },
                  { k: 'المرفقات', v: pf.files.join(' · ') || '—' },
                  { k: 'مشرف المنح', v: <Person name={pf.owner} /> },
                ]} />
              </Glass>

              {!asPartner && <SettingsCard pf={pf} asPartner={asPartner} />}

              {!asPartner && <HoldCard pf={pf} lineKey={lineKey} setLine={setLine} lines={lines} link={link} split={split} setSplit={setSplit} />}

              {!asPartner && (pf.stage === 'committee' || pf.stage === 'board') && <SessionCard pf={pf} />}

              {(pf.stage === 'approved' || pf.stage === 'closing' || pf.stage === 'closed' || pf.stage === 'cancelled') && (
                <>
                  <PlanCard pf={pf} asPartner={asPartner} />
                  <AgreementCard pf={pf} asPartner={asPartner} />
                </>
              )}

              <SubsCard pf={pf} asPartner={asPartner} />

              {(pf.stage === 'approved' || pf.stage === 'closing' || pf.stage === 'closed' || pf.stage === 'cancelled') && (
                <>
                  <Glass>
                    <Head title="الموقف المالي" meta={<span className="sub">المحفظة ككل</span>} />
                    <KV rows={[
                      { k: 'المعتمد للمحفظة', v: <Money sm>{m.total}</Money> },
                      { k: 'المشاريع المعتمدة', v: <><Money sm>{m.approved}</Money> <span className="sub">· {m.approvedCount} مشروع</span></> },
                      { k: 'قيد الاعتماد', v: <Money sm>{m.pending}</Money> },
                      { k: 'الرصيد المتاح', v: <Money sm>{m.available}</Money> },
                      { k: 'الدفعات المسجلة', v: <Money sm>{m.recorded}</Money> },
                      { k: 'الدفعات المؤكدة · المصروف', v: <Money sm>{m.confirmed}</Money> },
                      { k: 'المتبقي', v: <Money sm>{m.remaining}</Money> },
                    ]} />
                  </Glass>

                  <Glass>
                    <Head title="مؤشرات التنفيذ" meta={<span className="sub">المشاريع المعتمدة</span>} />
                    <dl className="ptn-ind">
                      <div><dt>المشاريع</dt><dd className="num">{ind.count}</dd></div>
                      <div><dt>مكتمل · قيد الإغلاق · معتمد · متعثر</dt><dd className="num">{ind.done} · {ind.closing} · {ind.running} · {ind.stalled}</dd></div>
                      <div><dt>متوسط الإنجاز</dt><dd className="num">{pct(ind.progress)}</dd></div>
                      <div><dt>المستفيدون · فعلي من مستهدف</dt><dd className="num">{nf.format(ind.reached)} / {nf.format(ind.target)}</dd></div>
                    </dl>
                    <p className="sub cnote">التوزيع الجغرافي · {ind.regions.length ? ind.regions.map(([r, n]) => `${r} ${n}`).join(' · ') : 'لا مشاريع معتمدة بعد'}</p>
                  </Glass>

                  <PaysCard pf={pf} asPartner={asPartner} />
                  <ExecCard pf={pf} asPartner={asPartner} />
                  <CloseCard pf={pf} asPartner={asPartner} />
                  <CancelCard pf={pf} asPartner={asPartner} />
                </>
              )}

              <Glass>
                <Head title="سجلّ المحفظة" />
                <ul className="plchg">
                  {pf.log.slice().reverse().map((a, i) => (
                    <li key={`${a.at}-${i}`}>
                      <div className="plchg-h"><Tag tone="mute"><DateText>{a.at}</DateText></Tag><span className="sub">{a.by}</span></div>
                      <p className="plchg-t">{isolate(a.what)}</p>
                    </li>
                  ))}
                </ul>
              </Glass>
            </div>

            <AssistantAside title="قراءة المحفظة" cta="اقرأ المحفظة" empty="المحفظة في مسارها · لا ملاحظات." readings={readings} ask={!asPartner} />
          </div>
        </div>

        {actions.length > 0 && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">
                <Person name={user.name} size="lg" quiet={false} />
                <span className="decsent">قرارك في <b>المحفظة</b><span className="decsep" />{nf.format(pf.total)} ريال</span>
              </div>
              <div className="payact-g">
                {needNote && (
                  <label className="payact-n">
                    <span className="vis-h">الملاحظة</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب الإعادة أو الرفض · إلزامي" />
                  </label>
                )}
                <div className="rowf gp-2">
                  {noteFirst(actions).map((a) => {
                    const stop = a.needsNote && !note.trim() ? 'اكتب الملاحظة أولًا' : pfStops(pf, a.act, a.act === 'recommend' ? shares : undefined)[0] ?? ''
                    return (
                      <button key={a.label} type="button" className={`btn ${a.kind}`} data-needs-note={a.needsNote ? '' : undefined} disabled={Boolean(stop)} title={stop || /* doc 13.2.6 */ ''} onClick={() => act(a)}>
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

const entityName = (pf: PortfolioRec) => profileOf(pf.entityId)?.name ?? entityById(pf.entityId)?.name ?? pf.entityId

/* ── The budget hold · the total, once, from one line or more (13.2.7) ── */
function HoldCard({ pf, lineKey, setLine, lines, link, split, setSplit }: {
  pf: PortfolioRec; lineKey: string; setLine: (k: string) => void; lines: ReturnType<typeof usableLines>; link: ReturnType<typeof linkOf>
  split: { key: string; amount: string }[]; setSplit: (x: { key: string; amount: string }[]) => void
}) {
  const sum = split.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  const label = (k: string) => { const l = lines.find((y) => y.key === k); return l ? `${l.doc.name ?? l.doc.id} · ${l.node.label}` : k }
  const { role } = useRole()
  const pickable = pf.stage === 'supervisor' && role.key === 'supervisor'
  return (
    <Glass>
      <Head title="حجز قيمة المحفظة" meta={link ? <Tag tone={link.stage === 'final' ? 'ok' : 'warn'}>{HOLD_STAGE_SAY[link.stage]}</Tag> : <Tag tone="mute">لم يُحجز</Tag>} />
      {link ? (
        <KV rows={[
          { k: link.shares.length > 1 ? 'البنود' : 'البند', v: link.shares.map((s) => `${s.nodeId === 'tPg1' ? 'مخصص الشراكات' : s.nodeId === 'tPg2' ? 'مخصص محافظ الشركاء' : label(`${s.docId}/${s.nodeId}`)}${link.shares.length > 1 ? ` · ${nf.format(s.amount)}` : ''}`).join(' · ') },
          { k: 'المحجوز', v: <Money sm>{link.amount}</Money> },
          { k: 'المصروف منه', v: <Money sm>{link.shares.reduce((s, x) => s + x.paid, 0)}</Money> },
        ]} />
      ) : pickable && split.length ? (
        <div className="regfields">
          {split.map((x, i) => (
            <div className="rowf gp-2" key={i}>
              <label className="regf">
                <span className="lb">البند {i + 1}</span>
                <FieldSelect value={x.key} onChange={(k) => setSplit(split.map((y, j) => (j === i ? { ...y, key: k } : y)))} label={`بند الحجز ${i + 1}`}
                  options={lines.filter((l) => l.key === x.key || !split.some((y) => y.key === l.key)).map((l) => ({ value: l.key, label: `${l.doc.name ?? l.doc.id} · ${l.node.label} · متاح ${nf.format(l.free)}` }))} />
              </label>
              <label className="regf">
                <span className="lb">المبلغ</span>
                <span className="fld"><input inputMode="numeric" value={x.amount} onChange={(e) => setSplit(split.map((y, j) => (j === i ? { ...y, amount: e.target.value.replace(/[^\d]/g, '') } : y)))} aria-label={`مبلغ بند الحجز ${i + 1}`} /></span>
              </label>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف البند ${i + 1}`} onClick={() => setSplit(split.filter((_, j) => j !== i))}><Icon name={icons.close} size="sm" /></button>
            </div>
          ))}
          <div className="rowf gp-2">
            <button type="button" className="btn btn-2 btn-sm" onClick={() => setSplit([...split, { key: '', amount: '' }])}><Icon name={icons.plus} size="sm" />أضف بندًا</button>
            <span className={sum === pf.total ? 'sub' : 'bad'}>المجموع {nf.format(sum)} من {nf.format(pf.total)}</span>
          </div>
        </div>
      ) : pickable ? (
        <>
        <label className="regf">
          <span className="lb">بند الميزانية</span>
          <FieldSelect value={lineKey} onChange={setLine} label="بند الميزانية" options={lines.filter((l) => l.free >= pf.total).map((l) => ({ value: l.key, label: `${l.node.label} · متاح ${nf.format(l.free)}` }))} />
          <span className="sub regf-h">تُحجز القيمة كاملةً مرة واحدة مع التوصية · وقيم المشاريع الفرعية توزيع داخلي لا حجز جديد{/* doc 13.2.19 */}</span>
        </label>
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setSplit([{ key: lineKey, amount: '' }, { key: '', amount: '' }])}>وزّع الحجز على أكثر من بند أو ميزانية</button>
        </>
      ) : (
        <p className="sub cnote">يُحجز إجمالي المحفظة مع توصية المشرف ويُثبَّت بالاعتماد النهائي.</p>
      )}
    </Glass>
  )
}

/* ── The portfolio's plan · prepared on the plans procedure's terms, approved by the grants manager (13.2.8 · 13.2.9) ── */
function PlanCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [rows, setRows] = useState<PfPhase[]>(() => (pf.plan.phases.length ? pf.plan.phases : [{ id: 'ph1', name: '', from: '', to: '', cost: 0 }]))
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  /* Batch 6 · the partner drafts its plan too (12.2.4) · its draft goes to the supervisor first */
  const mine = pf.plan.drafter === undefined || (pf.plan.drafter === 'partner') === asPartner
  const editable = pf.stage === 'approved' && (asPartner || role.key === 'supervisor')
    && (pf.plan.state === 'none' || ((pf.plan.state === 'draft' || pf.plan.state === 'returned') && mine))
  const who = asPartner ? (entityById(pf.entityId)?.name ?? profileOf(pf.entityId)?.name ?? user.name) : user.name
  const tone = pf.plan.state === 'approved' ? 'ok' : pf.plan.state === 'review' || pf.plan.state === 'supervisor' ? 'warn' : pf.plan.state === 'returned' ? 'ret' : 'mute'
  const say = { none: 'لم تُعدّ', draft: 'مسودة', supervisor: 'بانتظار مراجعة المشرف', review: 'بانتظار مدير المنح', approved: 'معتمدة', returned: 'معادة' }[pf.plan.state]
  return (
    <Glass>
      <Head title="خطة المحفظة" meta={<Tag tone={tone}>{say}</Tag>} />
      {pf.plan.note && pf.plan.state === 'returned' && <p className="bad cnote">{pf.plan.note}</p>}
      {editable ? (
        <div className="ptn-form">
          {rows.map((r, i) => (
            <div key={r.id} className="regfields">
              <label className="regf"><span className="lb">المرحلة {i + 1}</span><span className="fld"><input value={r.name} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} aria-label={`اسم المرحلة ${i + 1}`} /></span></label>
              <label className="regf"><span className="lb">من</span><DateField value={r.from} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, from: v } : y)))} label={`بداية المرحلة ${i + 1}`} /></label>
              <label className="regf"><span className="lb">إلى</span><DateField value={r.to} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, to: v } : y)))} label={`نهاية المرحلة ${i + 1}`} /></label>
              <label className="regf"><span className="lb">التكلفة</span><MoneyField value={r.cost ? String(r.cost) : ''} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, cost: Number(v) || 0 } : y)))} label={`تكلفة المرحلة ${i + 1}`} /></label>
              {/* Batch 7 · partners#11 · each phase's activities, with the output and the evidence each needs */}
              {(r.activities ?? []).map((ac, k) => (
                <div className="rowf gp-2" key={ac.id}>
                  <span className="fld"><input value={ac.name} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, activities: (y.activities ?? []).map((z, m) => (m === k ? { ...z, name: e.target.value } : z)) } : y)))} aria-label={`نشاط ${k + 1} في المرحلة ${i + 1}`} placeholder="النشاط" /></span>
                  <span className="fld"><input value={ac.output} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, activities: (y.activities ?? []).map((z, m) => (m === k ? { ...z, output: e.target.value } : z)) } : y)))} aria-label={`مخرج النشاط ${k + 1} في المرحلة ${i + 1}`} placeholder="المخرج" /></span>
                  <span className="fld"><input value={ac.evidence} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, activities: (y.activities ?? []).map((z, m) => (m === k ? { ...z, evidence: e.target.value } : z)) } : y)))} aria-label={`شاهد النشاط ${k + 1} في المرحلة ${i + 1}`} placeholder="الشاهد المطلوب" /></span>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((x) => x.map((y, j) => (j === i ? { ...y, activities: [...(y.activities ?? []), { id: `a${Date.now()}`, name: '', output: '', evidence: '' }] } : y)))}>أضف نشاطًا للمرحلة {i + 1}</button>
            </div>
          ))}
          <div className="apv-row mt-2">
            <span className={`sub${sumOf(rows) !== pf.total ? ' bad' : ''}`}>المجموع <span className="num">{nf.format(sumOf(rows))}</span> من <span className="num">{nf.format(pf.total)}</span></span>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => setRows((x) => [...x, { id: `ph${x.length + 1}`, name: '', from: '', to: '', cost: 0 }])}>مرحلة أخرى</button>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => { savePfPlan(pf.id, rows, who); setSaid({ ok: 'مسودة الخطة' }) }}>احفظ</button>
            <button type="button" className="btn btn-p btn-sm" onClick={() => { savePfPlan(pf.id, rows, who); const out = actOnPfPlan(pf.id, 'send', '', who); setSaid(out.length ? { bad: out } : { ok: asPartner ? 'إرسال الخطة لمشرف المنح' : 'إرسال الخطة لمدير المنح' }) }}>{asPartner ? 'أرسل لمشرف المنح' : 'أرسل للاعتماد'}</button>
          </div>
        </div>
      ) : (
        <ul className="ptn-slots">
          {pf.plan.phases.map((p) => <li key={p.id}><span>{p.name}</span><span className="sub"><DateText>{p.from}</DateText> – <DateText>{p.to}</DateText>{p.activities?.length ? ` · ${p.activities.map((a) => `${a.name}${a.output ? ` (${a.output})` : ''}`).join('، ')}` : ''}</span><Money sm>{p.cost}</Money></li>)}
          {/* v3 · 12.4.13 · each activity read from the sub-projects that serve it */}
          {pfActivities(pf).filter((a) => pfActivityProgress(pf, a.id).linked > 0).map((a) => <li key={`pr-${a.id}`}><span>{a.label}</span><span className="sub">{pfActivityProgress(pf, a.id).say}</span></li>)}
          {!pf.plan.phases.length && <li className="sub">يعدّها الشريك أو مشرف المنح بعد الاعتماد النهائي.</li>}
        </ul>
      )}
      {!asPartner && role.key === 'supervisor' && pf.plan.state === 'supervisor' && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة المشرف على الخطة" placeholder="سبب الإعادة للشريك" /></span>
          <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = actOnPfPlan(pf.id, 'return', note, user.name); setSaid(out.length ? { bad: out } : { ok: 'إعادة الخطة للشريك' }) }}>أعدها للشريك</button>
          <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = actOnPfPlan(pf.id, 'toManager', '', user.name); setSaid(out.length ? { bad: out } : { ok: 'إحالة الخطة لمدير المنح' }) }}>أحلها لمدير المنح</button>
        </div>
      )}
      {!asPartner && role.key === 'grants-manager' && pfActivities(pf).length > 0 && (
        <div className="cfgchips mt-2" role="radiogroup" aria-label="أثر اكتمال المشروع الفرعي على النشاط">
          {(['update', 'evidence'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={PF_ACTIVITY_MODE.mode === m} className={`cfgchip${PF_ACTIVITY_MODE.mode === m ? ' on' : ''}`} onClick={() => { setPfActivityMode(m); setSaid({ ok: 'الإعداد' }) }}>
              {m === 'update' ? 'اكتمال المشاريع الفرعية يحدّث إنجاز النشاط' : 'اكتمالها دليل على النشاط فقط'}
            </button>
          ))}
        </div>
      )}
      {!asPartner && role.key === 'grants-manager' && pf.plan.state === 'review' && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على الخطة" placeholder="سبب الإعادة" /></span>
          <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = actOnPfPlan(pf.id, 'return', note, user.name); setSaid(out.length ? { bad: out } : { ok: 'إعادة الخطة' }) }}>أعد الخطة</button>
          <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = actOnPfPlan(pf.id, 'approve', '', user.name); setSaid(out.length ? { bad: out } : { ok: 'اعتماد الخطة' }) }}>اعتمد الخطة</button>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── The agreement · drafted, approved, signed by the partner; the payment schedule rides on it (13.2.9 · 13.2.24) ── */
function AgreementCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const a = pf.agreement
  const say = { none: 'لم تُعدّ', draft: 'مسودة · مشرف المنح', manager: 'بانتظار مدير المنح', executive: 'بانتظار المدير التنفيذي', partner: 'بانتظار توقيع الشريك', foundation: 'بانتظار توقيع ممثل المؤسسة', signed: 'موقّعة وسارية', returned: 'معادة' }[a.state]
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })
  const sup = !asPartner && role.key === 'supervisor'
  return (
    <Glass>
      <Head title="اتفاقية المحفظة" meta={<Tag tone={a.state === 'signed' ? 'ok' : a.state === 'none' ? 'mute' : 'warn'}>{say}</Tag>} />
      <p className="sub cnote">اتفاقية على مستوى المحفظة ككل · تحكم المشاريع الفرعية كلها ولا تتكرر لكل مشروع.{a.file ? ` · ${a.file}` : ''}</p>
      {/* Batch 7 · partners#12 · the agreement's own text, from the template with the portfolio's terms */}
      {a.body && (
        <details className="mt-2">
          <summary className="lnk">نص الاتفاقية{a.versions && a.versions.length > 1 ? ` · الإصدار ${a.versions.length}` : ''}</summary>
          <ol className="rqobj">{a.body.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </details>
      )}
      {a.note && a.state === 'returned' && <p className="bad cnote">{a.note}</p>}
      {pf.channel === 'direct' && (
        <>
          <h4 className="ptn-sub">جدول دفعات المحفظة</h4>
          <SlotsEditor slots={pf.schedule} total={pf.total} locked={!sup || a.state === 'signed' || pf.requests.length > 0} onSave={(s) => savePfSchedule(pf.id, s, user.name)} />
        </>
      )}
      <div className="apv-row mt-3">
        {sup && (a.state === 'none' || a.state === 'returned') && <button type="button" className="btn btn-2 btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'draft', '', user.name), 'مسودة الاتفاقية')}>أعدّ المسودة من النموذج</button>}
        {sup && a.state === 'draft' && <button type="button" className="btn btn-p btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'send', '', user.name), 'إرسال الاتفاقية')}>أرسل لمدير المنح</button>}
        {!asPartner && ((role.key === 'grants-manager' && a.state === 'manager') || (role.key === 'ceo' && a.state === 'executive')) && (
          <>
            <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على الاتفاقية" placeholder="سبب الإعادة" /></span>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'return', note, user.name), 'إعادة الاتفاقية')}>أعد</button>
            <button type="button" className="btn btn-p btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'approve', '', user.name), 'اعتماد الاتفاقية')}>{a.state === 'manager' ? 'اعتمد وأحل للمدير التنفيذي' : 'اعتمد وأرسل للشريك'}</button>
          </>
        )}
        {!asPartner && (role.key === 'grants-manager' || role.key === 'ceo') && a.state === 'foundation' && (
          <button type="button" className="btn btn-p btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'countersign', '', user.name), 'توقيع ممثل المؤسسة')}>وقّع عن المؤسسة · تسري الاتفاقية</button>
        )}
        {asPartner && a.state === 'foundation' && <span className="sub">وقّعتها · بانتظار توقيع ممثل المؤسسة</span>}
        {asPartner && a.state === 'partner' && <UploadButton label="الاتفاقية الموقعة" onPick={(f) => r(actOnPfAgreement(pf.id, 'sign', '', user.name, f.name), 'توقيع الاتفاقية')} />}
        {!asPartner && a.state === 'partner' && <span className="sub">يوقّعها الشريك من بوابته</span>}
      </div>
      <Said said={said} />
    </Glass>
  )
}

/* ── Sub-projects · added, sent, studied, recommended and decided one by one within the ceiling (13.2.11 – 13.2.19) ── */
const EMPTY = { name: '', region: '', city: '', amount: '', beneficiaries: '', outputs: '', files: [] as string[], activityId: '' }
function SubsCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [d, setD] = useState(EMPTY)
  const [sel, setSel] = useState<string[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [why, setWhy] = useState('')
  const [one, setOne] = useState('')
  const [adding, setAdding] = useState(false)
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const gate = subsGate(pf)
  const adder = gate.ok && (asPartner || role.key === 'supervisor')
  const sup = !asPartner && role.key === 'supervisor'
  const mgr = !asPartner && role.key === 'grants-manager'
  const dropper = (asPartner || role.key === 'supervisor') && (gate.ok || pf.stage === 'closing')
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
  const count = (s: SubState) => pf.items.filter((x) => x.state === s).length
  /* v3 · 0.sub.1 – 0.sub.3 · each seat selects what waits on it */
  const selectable = (x: SubProject) => (mgr ? x.state === 'pending' : sup ? x.state === 'draft' || x.state === 'submitted' || x.state === 'study' : adder && x.state === 'draft')
  const pool = pf.items.filter(selectable)
  const picked = pf.items.filter((x) => sel.includes(x.id))
  const drafts = picked.filter((x) => x.state === 'draft')
  const sent = picked.filter((x) => x.state === 'submitted')
  const studied = picked.filter((x) => x.state === 'study' || x.state === 'submitted')
  const cap = capIssue(pf, drafts.map((x) => x.id))
  const req = pf.subFields ?? SUB_FIELDS_DEFAULT
  const r = (out: string[], ok: string) => { setSaid(out.length ? { bad: out } : { ok }); if (!out.length) { setSel([]); setWhy('') } }
  const add = () => {
    const out = addSub(pf.id, { name: d.name, region: d.region, city: d.city || undefined, amount: Number(d.amount) || 0, beneficiaries: Number(d.beneficiaries) || 0, outputs: d.outputs, files: d.files, activityId: d.activityId || undefined }, asPartner ? entityName(pf) : user.name)
    if (out.errors.length) { setSaid({ bad: [`ينقص: ${out.errors.join('، ')}`] }); return }
    setSaid({ ok: 'المشروع الفرعي · مسودة' })
    setD(EMPTY)
    setAdding(false)
  }
  const decide = (outcome: 'approve' | 'reject') => r(decideSubs(pf.id, sel.map((subId) => ({ subId, outcome, reason: reasons[subId], note: outcome === 'approve' ? reasons[subId] : undefined })), user.name, role.key), outcome === 'approve' ? 'اعتماد المحدد' : 'رفض المحدد')
  const recommend = (outcome: 'approve' | 'reject') => r(recommendSubs(pf.id, studied.map((x) => ({ subId: x.id, outcome, note: reasons[x.id] ?? '' })), user.name, role.key), outcome === 'approve' ? 'التوصية بالاعتماد' : 'التوصية بالرفض')
  return (
    <Glass className="tblcard">
      <Head title="المشاريع الفرعية" meta={<span className="sub">{pf.items.filter(isLiveSub).length} معتمد · {count('submitted') + count('study')} مرفوع وقيد الدراسة · {count('pending')} بانتظار الاعتماد · {count('draft')} مسودة</span>} />
      {!gate.ok && <p className="sub cnote"><Icon name={icons.lock} size="sm" /> {gate.why}</p>}
      {pf.items.length > 0 && (
        <div className="tblwrap">
          <table className="tbl subtbl" aria-label="المشاريع الفرعية">
            <thead>
              <tr>
                <th className="tchk">{pool.length > 0 && <input type="checkbox" aria-label="تحديد الكل" checked={sel.length === pool.length} onChange={(e) => setSel(e.target.checked ? pool.map((x) => x.id) : [])} />}</th>
                <th><span className="th-t">المشروع · المنطقة · المستهدف</span></th>
                <th className="n"><span className="th-t">القيمة</span></th>
                <th><span className="th-t">الحالة</span></th>
              </tr>
            </thead>
            <tbody>
              {pf.items.map((x) => (
                <tr key={x.id} id={x.id}>
                  <td className="tchk">{selectable(x) && <input type="checkbox" aria-label={`تحديد ${x.name}`} checked={sel.includes(x.id)} onChange={() => toggle(x.id)} />}</td>
                  <td><b>{x.name}</b><div className="sub">{x.field ?? pf.field} · {x.region}{x.city ? ` · ${x.city}` : ''} · {nf.format(x.beneficiaries)} مستفيد · {x.outputs} · {x.files.join('، ')}{x.activityId ? ` · النشاط: ${pfActivities(pf).find((a) => a.id === x.activityId)?.label ?? x.activityId}` : ''}</div>
                    {(asPartner || role.key === 'supervisor') && pfActivities(pf).length > 0 && x.state !== 'rejected' && x.state !== 'excluded' && (
                      <FieldSelect value={x.activityId ?? ''} label={`نشاط خطة المحفظة · ${x.name}`} placeholder="اربط بنشاط" options={[{ value: '', label: 'بلا نشاط' }, ...pfActivities(pf).map((a) => ({ value: a.id, label: a.label }))]} onChange={(v) => r(linkSubActivity(pf.id, x.id, v, asPartner ? entityName(pf) : user.name), 'ربط النشاط')} />
                    )}</td>
                  <td className="n"><Money sm>{x.amount}</Money></td>
                  <td>
                    <Tag tone={SUB_STATE_TONE[x.state]}>{SUB_STATE_SAY[x.state]}</Tag>
                    {x.rec && x.state === 'pending' && <span className="sub"> · توصية المشرف: {x.rec.outcome === 'approve' ? 'اعتماد' : 'رفض'}{x.rec.note ? ` · ${x.rec.note}` : ''}</span>}
                    {x.reason && <span className="sub"> · {x.reason}</span>}
                    {x.note && <span className="sub"> · {x.note}</span>}
                    {x.outcome && (x.state === 'stalled' || x.state === 'excluded') && <span className="sub"> · {x.outcome.note}</span>}
                    {(mgr || sup) && sel.includes(x.id) && x.state !== 'draft' && (
                      <span className="fld mt-1"><input value={reasons[x.id] ?? ''} onChange={(e) => setReasons((r0) => ({ ...r0, [x.id]: e.target.value }))} aria-label={`ملاحظة على ${x.name}`} placeholder={mgr ? 'سبب الرفض أو ملاحظة الاعتماد' : 'ملاحظة التوصية · إلزامية للرفض'} /></span>
                    )}
                    {dropper && x.state === 'draft' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { dropSub(pf.id, x.id, asPartner ? entityName(pf) : user.name); r([], 'حذف المسودة') }}>حذف المسودة</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sel.length > 0 && (
        <div className="apv-row mt-3">
          <span className="sub">{sel.length} محدد · <span className="num">{nf.format(picked.reduce((s, x) => s + x.amount, 0))}</span></span>
          {cap && drafts.length > 0 && <span className="bad">{cap}</span>}
          {(asPartner || sup) && drafts.length > 0 && <button type="button" className="btn btn-p btn-sm" disabled={Boolean(cap)} onClick={() => r(sendSubs(pf.id, drafts.map((x) => x.id), asPartner ? entityName(pf) : user.name), 'رفع المحدد للمراجعة')}>ارفع للمراجعة</button>}
          {sup && sent.length > 0 && <button type="button" className="btn btn-2 btn-sm" onClick={() => r(studySubs(pf.id, sent.map((x) => x.id), user.name, role.key), 'بدء الدراسة')}>ابدأ الدراسة</button>}
          {sup && studied.length > 0 && <button type="button" className="btn btn-2 btn-sm" onClick={() => recommend('reject')}>أوصِ بالرفض</button>}
          {sup && studied.length > 0 && <button type="button" className="btn btn-p btn-sm" onClick={() => recommend('approve')}>أوصِ بالاعتماد</button>}
          {mgr && <button type="button" className="btn btn-2 btn-sm" onClick={() => decide('reject')}>ارفض المحدد</button>}
          {mgr && <button type="button" className="btn btn-p btn-sm" onClick={() => decide('approve')}>اعتمد المحدد</button>}
        </div>
      )}
      {/* v3 · 0.sub.7 · 0.sub.8 · 13.4.14 · a substantive change · stalled, or excluded with its value back */}
      {(sup || mgr) && pf.items.some((x) => ['pending', 'approved', 'closing', 'stalled'].includes(x.state)) && (
        <div className="apv-row mt-3">
          <FieldSelect value={one} onChange={setOne} label="مشروع فرعي للاستبعاد أو التعثر" placeholder="اختر مشروعًا فرعيًّا" options={pf.items.filter((x) => ['pending', 'approved', 'closing', 'stalled'].includes(x.state)).map((x) => ({ value: x.id, label: `${x.name} · ${SUB_STATE_SAY[x.state]}` }))} />
          <span className="fld"><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="سبب الاستبعاد أو التعثر" placeholder="السبب · إلزامي" /></span>
          {['approved', 'closing'].includes(pf.items.find((x) => x.id === one)?.state ?? '') && <button type="button" className="btn btn-2 btn-sm" onClick={() => { r(stallSub(pf.id, one, why, user.name, role.key), 'متعثر'); setOne('') }}>متعثر</button>}
          <button type="button" className="btn btn-d btn-sm" disabled={!one} onClick={() => { r(excludeSub(pf.id, one, why, user.name, role.key), 'استبعاد المشروع الفرعي'); setOne('') }}>استبعد · تعود القيمة للرصيد</button>
        </div>
      )}
      {adder && !adding && <div className="apv-row mt-3"><button type="button" className="btn btn-2 btn-sm" onClick={() => setAdding(true)}>أضف مشروعًا فرعيًّا</button><span className="sub">الرصيد المتاح <span className="num">{nf.format(Math.max(0, pfMoney(pf).available))}</span> · المسودات قد تتجاوزه</span></div>}
      {adder && adding && (
        <div className="ptn-form mt-3">
          <div className="regfields">
            <label className="regf"><span className="lb">اسم المشروع الفرعي</span><span className="fld"><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} aria-label="اسم المشروع الفرعي" /></span></label>
            <label className="regf"><span className="lb">المنطقة</span><FieldSelect value={d.region} onChange={(v) => setD({ ...d, region: v })} label="المنطقة" options={[...new Set(['عموم المملكة', ...REGIONS])]} /></label>
            <label className="regf"><span className="lb">القيمة</span><MoneyField value={d.amount} onChange={(v) => setD({ ...d, amount: v })} label="قيمة المشروع الفرعي" /></label>
            <label className="regf"><span className="lb">المستفيدون المستهدفون{req.includes('beneficiaries') ? '' : ' · اختياري'}</span><span className="fld"><input inputMode="numeric" value={d.beneficiaries} onChange={(e) => setD({ ...d, beneficiaries: e.target.value.replace(/\D/g, '') })} aria-label="المستفيدون المستهدفون" /></span></label>
            <label className="regf"><span className="lb">المدينة{req.includes('city') ? '' : ' · اختياري'}</span><span className="fld"><input value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} aria-label="المدينة" /></span></label>
            <label className="regf ptn-wide"><span className="lb">المخرجات المستهدفة{req.includes('outputs') ? '' : ' · اختياري'}</span><span className="fld"><input value={d.outputs} onChange={(e) => setD({ ...d, outputs: e.target.value })} aria-label="المخرجات المستهدفة" /></span></label>
            {/* v3 · 12.4.13 · the plan activity it serves · several sub-projects may serve one */}
            {pfActivities(pf).length > 0 && (
              <label className="regf"><span className="lb">نشاط خطة المحفظة{req.includes('activity') ? '' : ' · اختياري'}</span><FieldSelect value={d.activityId} onChange={(v) => setD({ ...d, activityId: v })} label="نشاط خطة المحفظة" placeholder="اختياري" options={pfActivities(pf).map((a) => ({ value: a.id, label: a.label }))} /></label>
            )}
          </div>
          <div className="apv-row mt-2">
            <span className="sub">{d.files.length ? d.files.join(' · ') : `مرفقات المشروع الفرعي${req.includes('files') ? '' : ' · اختياري'}`}</span>
            <UploadButton label="مرفق" onPick={(f) => setD((x) => ({ ...x, files: [...x.files, f.name] }))} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setD(EMPTY) }}>إلغاء</button>
            <button type="button" className="btn btn-p btn-sm" onClick={add}>احفظ مسودة</button>
          </div>
          <p className="sub cnote">يرث المسار والمجال من المحفظة ({pf.track} · {pf.field}) · يُرفع للمراجعة وحده أو مع غيره · يدرسه المشرف ويوصي، ويقرّه مدير المنح.</p>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── v3 · 13.4.16 · 13.4.17 · 13.4.30 · the portfolio's own settings · its sub-project form, its criteria, its values' reliability ── */
function SettingsCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const may = !asPartner && (role.key === 'supervisor' || role.key === 'grants-manager')
  const [fields, setFields] = useState<SubField[]>(pf.subFields ?? SUB_FIELDS_DEFAULT)
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })
  return (
    <Glass>
      <Head title="إعدادات المحفظة" meta={<span className="sub">نموذج المشروع الفرعي · المعايير · موثوقية القيم</span>} />
      <KV rows={[
        { k: 'حقول المشروع الفرعي الإلزامية', v: <span className="rowf gp-2">{(Object.keys(SUB_FIELD_SAY) as SubField[]).map((f) => <button key={f} type="button" disabled={!may} className={`btn btn-sm ${fields.includes(f) ? 'btn-2' : 'btn-ghost'}`} aria-pressed={fields.includes(f)} onClick={() => setFields((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))}>{SUB_FIELD_SAY[f]}</button>)}</span> },
        { k: 'معايير المحفظة المعتمدة', v: <span className="rowf gp-2">{pf.criteria ? <Tag tone="ok"><Icon name={icons.clip} size="sm" /> {pf.criteria.file}</Tag> : <span className="sub">لم تُحفظ · يُتفق عليها خارج النظام</span>}{may && <UploadButton label="احفظ المعايير (PDF)" onPick={(f) => r(attachPfCriteria(pf.id, f.name, user.name, role.key), 'معايير المحفظة')} />}</span> },
        { k: 'قيم المشاريع الفرعية للتوزيع الجغرافي للتكلفة', v: may ? <button type="button" className={`btn btn-sm ${pf.reliable ? 'btn-2' : 'btn-ghost'}`} aria-pressed={Boolean(pf.reliable)} onClick={() => { setPfReliable(pf.id, !pf.reliable, user.name); setSaid({ ok: 'موثوقية القيم' }) }}>{pf.reliable ? 'موثوقة · تُستخدم' : 'غير موثوقة · لا تُستخدم'}</button> : <span className="sub">{pf.reliable ? 'موثوقة' : 'لا تُستخدم للتكلفة'}</span> },
      ]} />
      {may && <div className="apv-row mt-3"><button type="button" className="btn btn-p btn-sm" onClick={() => r(savePfForm(pf.id, fields, user.name, role.key), 'نموذج المشروع الفرعي')}>احفظ النموذج</button><span className="sub">الاسم والمنطقة والقيمة إلزامية دائمًا · ولا يلزم المشروع الفرعي حقول المشروع العادي{/* doc 13.4.16 */}</span></div>}
      <Said said={said} />
    </Glass>
  )
}

/* ── v3 · 13.2.6 · the body's session · the members' votes, the minutes, then the decision (6.2 · 7.2) ── */
function SessionCard({ pf }: { pf: PortfolioRec }) {
  const { role, user } = useRole()
  const [sid, setSid] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const body = pf.stage === 'board' ? 'board' : 'committee'
  const secretary = (body === 'committee' ? APPROVAL_RULES.committeeBy : APPROVAL_RULES.boardBy).includes(role.key)
  const it = pf.session
  const ss = it ? SESSIONS.find((x) => x.id === it.id) : undefined
  const t = it ? voteTally({ projectId: pf.id, votes: it.votes }) : undefined
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })
  const voters = ss ? ss.members.filter((m) => m === user.name || role.key === 'ceo') : []
  return (
    <Glass>
      <Head title={body === 'committee' ? 'جلسة اللجنة التنفيذية' : 'جلسة مجلس الأمناء'} meta={it ? <Tag tone="teal">{it.id}</Tag> : <Tag tone="warn">لم تُدرج</Tag>} />
      {!it ? (
        secretary ? (
          <div className="apv-row">
            <FieldSelect value={sid} onChange={setSid} label="الجلسة" placeholder="اختر جلسة قادمة" options={pfSessions(pf).map((x) => ({ value: x.id, label: `${x.title} · ${x.date}` }))} />
            <button type="button" className="btn btn-p btn-sm" onClick={() => r(pfToSession(pf.id, sid, user.name, role.key), 'الإدراج على الجلسة')}>أدرج على الجلسة</button>
          </div>
        ) : <p className="sub cnote">يُدرجها أمين الجلسة على جدول جلسة قادمة.</p>
      ) : (
        <>
          <KV rows={[
            { k: 'الأصوات', v: `${t!.approve} موافقة · ${t!.reject} رفض · ${t!.return} إعادة · ${t!.abstain} امتناع · النصاب ${APPROVAL_RULES.quorum}` },
            { k: 'المحضر', v: it.minutes ?? <span className="sub">لم يُرفق</span> },
          ]} />
          {voters.length > 0 && (
            <ul className="ptn-slots mt-2">
              {voters.map((m) => (
                <li key={m}>
                  <Person name={m} />
                  {it.votes[m] && <Tag tone="mute">{({ approve: 'موافقة', reject: 'رفض', return: 'إعادة', abstain: 'امتناع' } as const)[it.votes[m]!]}</Tag>}
                  {(['approve', 'reject', 'return', 'abstain'] as const).map((v) => <button key={v} type="button" className="btn btn-ghost btn-sm" onClick={() => r(castPfVote(pf.id, m, v, user.name, role.key), `صوت ${m}`)}>{({ approve: 'موافقة', reject: 'رفض', return: 'إعادة', abstain: 'امتناع' } as const)[v]}</button>)}
                </li>
              ))}
            </ul>
          )}
          {secretary && !it.minutes && <div className="apv-row mt-2"><UploadButton label="محضر الجلسة" onPick={(f) => r(attachPfMinutes(pf.id, f.name, user.name), 'المحضر')} /></div>}
        </>
      )}
      <p className="sub cnote">تخضع المحفظة لمسار الاعتماد نفسه · النصاب والأغلبية والمحضر قبل تسجيل القرار{/* doc 13.2.6 */}.</p>
      <Said said={said} />
    </Glass>
  )
}

/* ── The money · the portfolio's requests on its schedule, by the payment procedure (13.2.23 – 13.2.25 · BPD-009) ── */
function PaysCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [why, setWhy] = useState('')
  const [amt, setAmt] = useState('')
  const [docs, setDocs] = useState<string[]>([])
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const sup = !asPartner && role.key === 'supervisor'
  const open = pf.stage === 'approved'
  const act = (rq: PfRequest, a: 'qualify' | 'permit' | 'approve' | 'order' | 'pay' | 'return', ok: string) => {
    const out = actOnPfReq(pf.id, rq.id, a, note, user.name, ref, role.key, a === 'permit' ? (Number(amt) || rq.asked || rq.amount) : undefined)
    setSaid(out.length ? { bad: out } : { ok })
    if (!out.length) { setNote(''); setRef(''); setAmt('') }
  }
  const mine = (rq: PfRequest) => !asPartner && (
    ((rq.state === 'supervisor' || rq.state === 'eligible') && role.key === 'supervisor') || (rq.state === 'manager' && role.key === 'grants-manager')
    || (rq.state === 'exec' && role.key === 'ceo') || ((rq.state === 'finance' || rq.state === 'order') && role.key === 'finance'))
  const next = pf.schedule.find((s) => !pf.requests.some((r) => r.no === s.no && r.state !== 'returned'))
  return (
    <Glass>
      <Head title="دفعات المحفظة" meta={<span className="sub">على مستوى المحفظة وفق الجدول · بإجراء صرف الدفعات · لا لكل مشروع فرعي</span>} />
      <ul className="ptn-slots">
        {pf.schedule.map((s) => {
          const rq = pf.requests.filter((r) => r.no === s.no).at(-1)
          return (
            <li key={s.no}>
              <span>الدفعة <span className="num">{s.no}</span> · <DateText>{s.dueAt}</DateText></span>
              <Money sm>{s.amount}</Money>
              {rq ? <Tag tone={rq.state === 'paid' ? 'ok' : rq.state === 'returned' ? 'ret' : 'warn'}>{PF_REQ_SAY[rq.state]}{rq.state === 'paid' ? ` · ${rq.ref}` : rq.state === 'returned' && rq.note ? ` · ${rq.note}` : ''}</Tag> : <Tag tone="mute">لم تُطلب</Tag>}
              {rq?.why && <span className="sub">{rq.why}{rq.docs?.length ? ` · ${rq.docs.join('، ')}` : ''}</span>}
              {rq && mine(rq) && (
                <span className="rowf gp-2">
                  {rq.state === 'supervisor' && <button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'qualify', 'اعتماد المتطلبات')}>اعتمد المتطلبات</button>}
                  {rq.state === 'eligible' && <><MoneyField value={amt} onChange={setAmt} label={`قيمة إذن الدفعة ${rq.no}`} placeholder={nf.format(rq.asked ?? rq.amount)} /><button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'permit', 'إذن الصرف')}>أنشئ إذن الصرف</button></>}
                  {(rq.state === 'manager' || rq.state === 'exec') && <button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'approve', 'اعتماد الإذن')}>اعتمد الإذن</button>}
                  {rq.state === 'finance' && <button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'order', 'اعتماد أمر الصرف')}>اعتمد أمر الصرف</button>}
                  {rq.state === 'order' && <><span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="رقم أمر التحويل" placeholder="رقم أمر التحويل" /></span><button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'pay', 'صرف الدفعة')}>صرف</button></>}
                  <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="سبب الإعادة" placeholder="سبب الإعادة" /></span>
                  <button type="button" className="btn btn-2 btn-sm" onClick={() => act(rq, 'return', 'إعادة الطلب')}>أعد</button>
                </span>
              )}
            </li>
          )
        })}
        {!pf.schedule.length && <li className="sub">يُحدَّد الجدول مع الاتفاقية.</li>}
      </ul>
      {/* v3 · 0.ent.8 · 2.4.22 · the partner's account decides whether its portfolio is paid */}
      {payBlock(entityById(pf.entityId)) && <p className="bad cnote">{payBlock(entityById(pf.entityId))}</p>}
      {/* Re-audit 7 Oct · 13.2.23 · the partner asks for its portfolio's payment from its own account · the
          supervisor may still file it on its behalf */}
      {(sup || asPartner) && open && next && (
        <div className="apv-row mt-3">
          {pfReqIssue(pf, next.no, next.amount) ? <span className="sub">{pfReqIssue(pf, next.no, next.amount)}</span> : null}
          <span className="fld"><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="مبرّر طلب الدفعة" placeholder="مبرّر الطلب وما أُنجز" /></span>
          <UploadButton label="مستند الطلب" onPick={(f) => setDocs((x) => [...x, f.name])} />
          {docs.length > 0 && <span className="sub">{docs.join('، ')}</span>}
          <button type="button" className="btn btn-p btn-sm" disabled={Boolean(pfReqIssue(pf, next.no, next.amount)) || pf.agreement.state !== 'signed'} title={pf.agreement.state !== 'signed' ? 'بعد توقيع الاتفاقية' : ''} onClick={() => { const out = requestPfPay(pf.id, next.no, next.amount, asPartner ? entityName(pf) : user.name, why, docs); setSaid(out.length ? { bad: out } : { ok: `متطلبات الدفعة ${next.no}` }); if (!out.length) { setWhy(''); setDocs([]) } }}>ارفع متطلبات الدفعة {next.no}</button>
        </div>
      )}
      <p className="sub cnote">لا يُشترط توزيع الدفعة على المشاريع الفرعية ولا ربطها بتفاصيلها المالية · قيمها توزيع داخلي ومتابعة لا أساس للصرف{/* doc 13.4.37 · 13.4.38 */}.</p>
      <Said said={said} />
    </Glass>
  )
}

/* ── Results the partner records on each approved sub-project · the foundation approves them (13.2.20 · 13.2.21 · 0.sub.6) ── */
function ExecCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [open, setOpen] = useState<string | null>(null)
  const [e, setE] = useState<Omit<SubExec, 'at' | 'by'>>({ status: 'لم يبدأ', progress: 0, reached: 0, results: '', evidence: [] })
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const live = pf.items.filter(isLiveSub)
  const editor = (asPartner || role.key === 'supervisor') && pf.stage === 'approved'
  const sup = !asPartner && role.key === 'supervisor'
  if (!live.length) return null
  return (
    <Glass>
      <Head title="نتائج المشاريع الفرعية" meta={<span className="sub">يسجّلها الشريك · يعتمدها مشرف المنح · دون تقرير ختامي مستقل</span>} />
      <ul className="ptn-exec">
        {live.map((x) => (
          <li key={x.id}>
            <div className="ptn-exec-h">
              <b>{x.name}</b>
              <Tag tone={SUB_STATE_TONE[x.state]}>{SUB_STATE_SAY[x.state]}{x.ready && x.state === 'closing' ? ' · طلب اعتماد النتائج' : ''}</Tag>
              <span className="sub">إنجاز <span className="num">{pct(x.exec?.progress ?? 0)}</span> · مستفيدون <span className="num">{nf.format(x.exec?.reached ?? 0)}</span> من <span className="num">{nf.format(x.beneficiaries)}</span></span>
              {editor && (x.state === 'approved' || x.state === 'closing') && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(open === x.id ? null : x.id); setE({ status: x.exec?.status ?? 'لم يبدأ', progress: x.exec?.progress ?? 0, reached: x.exec?.reached ?? 0, results: x.exec?.results ?? '', evidence: x.exec?.evidence ?? [] }) }}>{open === x.id ? 'إغلاق' : 'سجّل النتائج'}</button>}
            </div>
            {x.exec?.results && <p className="sub">{isolate(x.exec.results)}{x.exec.evidence.length ? ` · ${x.exec.evidence.join('، ')}` : ''}</p>}
            {x.outcome && x.state === 'closing' && !x.ready && <p className="bad cnote">{x.outcome.note}</p>}
            {sup && x.state === 'closing' && x.ready && (
              <div className="apv-row mt-2">
                <span className="fld"><input value={note} onChange={(v) => setNote(v.target.value)} aria-label={`ملاحظة على نتائج ${x.name}`} placeholder="ما ينقص · عند الإعادة" /></span>
                <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = completeSub(pf.id, x.id, 'return', note, user.name, role.key); setSaid(out.length ? { bad: out } : { ok: 'إعادة النتائج للشريك' }); if (!out.length) setNote('') }}>أعد للشريك</button>
                <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = completeSub(pf.id, x.id, 'approve', note, user.name, role.key); setSaid(out.length ? { bad: out } : { ok: `«${x.name}» مكتمل` }) }}>اعتمد النتائج · مكتمل</button>
              </div>
            )}
            {open === x.id && (
              <div className="ptn-form mt-2">
                <div className="regfields">
                  <label className="regf"><span className="lb">نسبة الإنجاز</span><span className="fld"><input inputMode="numeric" value={String(e.progress)} onChange={(v) => setE({ ...e, progress: Number(v.target.value.replace(/\D/g, '')) || 0 })} aria-label="نسبة الإنجاز" /></span></label>
                  <label className="regf"><span className="lb">المستفيدون الفعليون</span><span className="fld"><input inputMode="numeric" value={String(e.reached)} onChange={(v) => setE({ ...e, reached: Number(v.target.value.replace(/\D/g, '')) || 0 })} aria-label="المستفيدون الفعليون" /></span></label>
                  <label className="regf ptn-wide"><span className="lb">النتائج الفعلية</span><span className="fld"><input value={e.results} onChange={(v) => setE({ ...e, results: v.target.value })} aria-label="النتائج الفعلية" placeholder={`المستهدف: ${x.outputs}`} /></span></label>
                </div>
                <div className="apv-row mt-2">
                  <span className="sub">{e.evidence.length ? e.evidence.join(' · ') : 'الشواهد'}</span>
                  <UploadButton label="شاهد" onPick={(f) => setE((y) => ({ ...y, evidence: [...y.evidence, f.name] }))} />
                  <label className="rowf gp-2"><input type="checkbox" checked={e.status === 'مكتمل'} onChange={(v) => setE({ ...e, status: v.target.checked ? 'مكتمل' : 'لم يبدأ' })} aria-label="اطلب اعتماد النتائج" /> <span className="sub">اكتمل التنفيذ · اطلب اعتماد النتائج</span></label>
                  <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = updateSubExec(pf.id, x.id, e, asPartner ? entityName(pf) : user.name); setSaid(out.length ? { bad: out } : { ok: `نتائج «${x.name}»` }); if (!out.length) setOpen(null) }}>احفظ</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Said said={said} />
    </Glass>
  )
}

/* ── Closing · the comprehensive report, the evaluation, the requirements · by the closing procedure (13.2.28 – 13.2.31) ── */
function CloseCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [report, setReport] = useState(pf.close.report)
  const [evidence, setEvidence] = useState<string[]>(pf.close.evidence)
  const [note, setNote] = useState('')
  const [crit, setCrit] = useState(() => pf.close.evaluation?.criteria ?? [])
  const [evNotes, setEvNotes] = useState(pf.close.evaluation?.notes ?? '')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const checks = pfCloseChecks(pf)
  const st = pf.close.stage
  const r = (out: string[], ok: string) => { setSaid(out.length ? { bad: out } : { ok }); if (!out.length) setNote('') }
  const seat = st === 'supervisor' || st === 'evalDraft' ? 'supervisor' : st === 'manager' || st === 'evalManager' ? 'grants-manager' : st === 'executive' || st === 'evalExecutive' ? 'ceo' : ''
  const mine = !asPartner && role.key === seat
  const evalStage = st === 'evalDraft' || st === 'evalManager' || st === 'evalExecutive'
  const criteria = pf.close.evaluation?.criteria ?? []
  return (
    <Glass>
      <Head title="إغلاق المحفظة" meta={pf.stage === 'closed' ? <Tag tone="ok">أُغلقت <DateText>{pf.close.closedAt!}</DateText></Tag> : st ? <Tag tone="warn">{PF_CLOSE_SAY[st]}</Tag> : <Tag tone="mute">بعد آخر مشروع</Tag>} />
      <Checks items={checks} />
      {pf.close.note && (st === 'returned' || st === 'evalDraft' || st === 'evalManager') && <p className="bad cnote">{pf.close.note}</p>}
      {asPartner && (pf.stage === 'approved' || (pf.stage === 'closing' && st === 'returned')) && (
        <>
          <label className="regf mt-3"><span className="lb">التقرير الشامل للمحفظة</span><span className="fld"><textarea rows={3} value={report} onChange={(e) => setReport(e.target.value)} aria-label="التقرير الختامي للمحفظة" /></span></label>
          <div className="apv-row mt-2">
            <span className="sub">{evidence.length ? evidence.join(' · ') : 'الشواهد'}</span>
            <UploadButton label="شاهد" onPick={(f) => setEvidence((x) => [...x, f.name])} />
            <button type="button" className="btn btn-p btn-sm" onClick={() => r(submitPfReport(pf.id, report, evidence, entityName(pf)), 'التقرير الشامل')}>ارفع التقرير</button>
          </div>
        </>
      )}
      {!asPartner && pf.close.report && <p className="prose mt-2">{isolate(pf.close.report)}{pf.close.evidence.length ? ` · ${pf.close.evidence.join('، ')}` : ''}</p>}
      {mine && !evalStage && st && st !== 'returned' && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على التقرير الشامل" placeholder="سبب الإعادة" /></span>
          <button type="button" className="btn btn-2 btn-sm" onClick={() => r(actOnPfClose(pf.id, 'return', note, user.name, role.key), 'إعادة التقرير للشريك')}>أعده للشريك</button>
          <button type="button" className="btn btn-p btn-sm" onClick={() => r(actOnPfClose(pf.id, 'approve', '', user.name, role.key), 'اعتماد التقرير الشامل')}>اعتمد التقرير الشامل</button>
        </div>
      )}
      {/* v3 · 13.2.30 · the portfolio's evaluation · the closing procedure's questions and weights, out of 100 */}
      {evalStage && (
        <>
          <h4 className="ptn-sub">تقييم المحفظة{pfEvalScore(pf) !== null ? ` · ${pfEvalScore(pf)} من 100` : ''}</h4>
          {mine && st === 'evalDraft' ? (
            <div className="regfields">
              {(crit.length ? crit : criteria).map((c, i) => (
                <label key={c.key} className="regf"><span className="lb">{c.label} · الوزن {nf.format(c.weight)}</span><FieldSelect value={c.rating ? String(c.rating) : ''} onChange={(v) => setCrit((x) => (x.length ? x : criteria).map((y, j) => (j === i ? { ...y, rating: Number(v) || null } : y)))} label={`تقييم ${c.label}`} placeholder="من 5" options={['1', '2', '3', '4', '5']} /></label>
              ))}
              <label className="regf ptn-wide"><span className="lb">ملاحظات التقييم</span><span className="fld"><input value={evNotes} onChange={(e) => setEvNotes(e.target.value)} aria-label="ملاحظات تقييم المحفظة" /></span></label>
            </div>
          ) : (
            <KV rows={criteria.map((c) => ({ k: `${c.label} · الوزن ${nf.format(c.weight)}`, v: c.rating === null ? <span className="sub">لم يُقيَّم</span> : `${c.rating} من 5` }))} />
          )}
          {mine && (
            <div className="apv-row mt-3">
              {st === 'evalDraft' && <button type="button" className="btn btn-2 btn-sm" onClick={() => r(savePfEval(pf.id, crit.length ? crit : criteria, evNotes, user.name, role.key), 'حفظ التقييم')}>احفظ التقييم</button>}
              {st === 'evalDraft' && <button type="button" className="btn btn-p btn-sm" onClick={() => { savePfEval(pf.id, crit.length ? crit : criteria, evNotes, user.name, role.key); r(actOnPfEval(pf.id, 'send', '', user.name, role.key), 'إرسال التقييم لمدير المنح') }}>أرسل لمدير المنح</button>}
              {st !== 'evalDraft' && <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على التقييم" placeholder="سبب الإعادة" /></span>}
              {st !== 'evalDraft' && <button type="button" className="btn btn-2 btn-sm" onClick={() => r(actOnPfEval(pf.id, 'return', note, user.name, role.key), 'إعادة التقييم')}>أعد التقييم</button>}
              {st !== 'evalDraft' && <button type="button" className="btn btn-p btn-sm" onClick={() => r(actOnPfEval(pf.id, 'approve', '', user.name, role.key), 'اعتماد التقييم')}>{st === 'evalManager' && pfApproverOf(pf, 'eval') === 'ceo' ? 'اعتمد وأحل للمدير التنفيذي' : 'اعتمد التقييم والإغلاق النهائي'}</button>}
            </div>
          )}
        </>
      )}
      <p className="sub cnote">يُعتمد التقرير الشامل والتقييم وفق مصفوفة صلاحيات الإغلاق · ثم تُغلق المحفظة مع حفظ بياناتها ومشاريعها الفرعية ونتائجها{/* doc 13.2.30 · 13.2.31 */}.</p>
      <Said said={said} />
    </Glass>
  )
}

/* ── v3 · 13.4.43 · cancelling an approved portfolio · its recovery on the portfolio's relationship ── */
function CancelCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [reason, setReason] = useState('')
  const [recover, setRecover] = useState('')
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [file, setFile] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const rc = pf.recovery
  const ceo = !asPartner && role.key === 'ceo' && (pf.stage === 'approved' || pf.stage === 'closing')
  if (!ceo && !pf.cancel) return null
  const got = rc ? rc.receipts.reduce((n, x) => n + x.amount, 0) : 0
  return (
    <Glass>
      <Head title="إلغاء المحفظة والاسترداد" meta={pf.cancel ? <Tag tone="no">ملغاة</Tag> : <span className="sub">للمدير التنفيذي</span>} />
      {pf.cancel ? (
        <KV rows={[
          { k: 'السبب', v: pf.cancel.reason },
          { k: 'ألغاها', v: <><Person name={pf.cancel.by} /> · <DateText>{pf.cancel.at}</DateText></> },
          ...(rc ? [{ k: 'المسترد على مستوى المحفظة', v: <><Money sm>{got}</Money> <span className="sub">من <Money sm>{rc.due}</Money></span></> }] : []),
        ]} />
      ) : (
        <div className="apv-row">
          <span className="fld"><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب إلغاء المحفظة" placeholder="سبب الإلغاء" /></span>
          <MoneyField value={recover} onChange={setRecover} label="المبلغ المطلوب استرداده" placeholder="0" />
          <button type="button" className="btn btn-d btn-sm" onClick={() => { const out = cancelPortfolio(pf.id, reason, Number(recover) || 0, user.name, role.key); setSaid(out.length ? { bad: out } : { ok: 'إلغاء المحفظة' }) }}>ألغِ المحفظة</button>
        </div>
      )}
      {rc && got < rc.due && !asPartner && (role.key === 'finance' || role.key === 'supervisor') && (
        <div className="apv-row mt-3">
          <MoneyField value={amount} onChange={setAmount} label="المبلغ المستلم" />
          <span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="مرجع التحويل" placeholder="مرجع التحويل" /></span>
          <UploadButton label={file || 'إشعار التحويل'} onPick={(f) => setFile(f.name)} />
          <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = recordPfReceipt(pf.id, Number(amount) || 0, ref, file, user.name, role.key); setSaid(out.length ? { bad: out } : { ok: 'استلام المبلغ' }) }}>سجّل الاستلام</button>
        </div>
      )}
      <p className="sub cnote">الإلغاء والاسترداد على مستوى العلاقة المالية للمحفظة الرئيسية · لا استرداد مستقل لكل مشروع فرعي{/* doc 13.4.43 */}.</p>
      <Said said={said} />
    </Glass>
  )
}
