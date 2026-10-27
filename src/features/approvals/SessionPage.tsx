import { NextStep } from '@/components/assistant/NextStep'
import { suggestNext } from '@/data/shared/agent'
import { useAi } from '@/lib/ai/provider'
import { useState } from 'react'
import { expectedImpact, sessionReport } from '@/data/shared/ai'
import { AnalysisCard } from '@/components/assistant'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Tabs, BackTo, DateText, Empty, Glass, Head, Icon, KV, Money, Num, Person, Tag, icons } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { HOLD_STAGE_SAY, useBudget } from '@/data/budget/store'
import { BudgetLinkAction } from '@/features/budget/BudgetLink'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, pct } from '@/lib/format'
import { projectRows } from '@/data/mock/projects'
import { PORTFOLIOS } from '@/data/partners/store'
import { HOLDER_LABEL, type Holder } from '@/data/holders'
import { flowOf } from '@/data/intake/flow'
import { CRITERIA, studyScore } from '@/data/intake/criteria'
import { consultantByKey } from '@/data/intake/consultants'
import { fundingIssues } from '@/data/budget/store'
import { fitOf } from '@/data/intake/insight'
import { meOf, readRole } from '@/data/roles'
import { FOLLOW_SAY, FOLLOW_TONE, followUp } from '@/data/approvals/followup'
import {
  conflictOf, DEPT_SAY, SESSIONS, entityLimitBlock,
  OUTCOME_SAY, VERDICT_SAY, appFlowOf, attachMinutes, awaitingSession, closeSession,
  decideInSession, holdLine, levelCap, mayRecord, sessionById, sessionItemBlockers, setAgenda, strategyOf,
  useApprovals, type Outcome, type Session, type SessionItem, finPosition, supportAmount,
} from '@/data/approvals/store'
import { FinKV } from '@/features/approvals/AmountCard'
import { MoneyField } from '@/components/ui'

/* One session of the executive committee or the board (6.2.2 – 6.2.9 · 7.2.2 – 7.2.11).

   The agenda's projects each carry their file for the members (the recommendations, the money and
   its hold, the fit, the assistant's executive summary · advisory only), the minutes, and the
   decision. Client 18 Oct (decision 14): no per-member votes · the CEO records the body's final
   decision, and it needs the minutes; approving checks the cap and the per-entity limits, a referral sends it to
   the board, a return names the stage it goes back to, a rejection releases the hold. Closing the
   session locks every decision in it (6.4.14 · 7.4.14); undecided items return to the queue. */

export default function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [qp, setQp] = useSearchParams()
  useApprovals()
  useBudget()
  const s = id ? sessionById(id) : undefined
  const role = readRole()
  const me = meOf(role)
  if (!s) {
    return (
      <AppLayout assistantContext={assistFor.page('جلسة')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="اللجنة التنفيذية" onClick={() => navigate(ROUTES.committee)} />
          <Glass><Empty title="الجلسة غير موجودة." note="ربما يكون الرابط قديمًا." /></Glass>
        </div></div>
      </AppLayout>
    )
  }
  const may = mayRecord(s.body, role) && s.state === 'planned'
  const add = awaitingSession(s.body).filter((p) => !s.items.some((i) => i.projectId === p.id))
  const decided = s.items.filter((i) => i.outcome).length
  const sTab = ['follow', 'members'].includes(qp.get('tab') ?? '') ? qp.get('tab')! : 'agenda'
  /* 17 Oct · the assistant suggests putting what awaits this body on the agenda · the employee presses it */
  type SesAct = { label: string; kind: string }
  const nextPlan = suggestNext<SesAct>(may ? [{ label: `إدراج ${add.length} مشاريع منتظرة في جدول الأعمال`, kind: 'btn-p' }] : [], {
    issues: [],
    stops: () => (add.length ? [] : ['لا مشاريع منتظرة خارج جدول الأعمال']),
    good: add.slice(0, 3).map((p) => `${p.name} ينتظر قرار ${HOLDER_LABEL[s.body]}`),
  })
  const nextExec = () => { add.forEach((p) => setAgenda(s.id, p.id, true)); return [] }

  return (
    <AppLayout assistantContext={assistFor.page(s.title)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label={HOLDER_LABEL[s.body]} onClick={() => navigate(s.body === 'committee' ? ROUTES.committee : ROUTES.board)} />
          <header>
            <div>
              <h1 className="ptitle">{s.title}</h1>
              <p className="sub mt-1"><DateText>{s.date}</DateText> · <Num>{s.members.length}</Num> عضو</p>
            </div>
            <Tag tone={s.state === 'closed' ? 'mute' : 'warn'}>{s.state === 'closed' ? `مقفلة · ${s.closedAt ?? ''}` : 'مجدولة'}</Tag>
          </header>

          {/* Client 26 Oct · the session reads in tabs · its agenda · the follow-up of its decisions · its members */}
          <Tabs items={[
            { slug: 'agenda', label: 'جدول الأعمال', count: s.items.length || undefined },
            { slug: 'follow', label: 'متابعة القرارات', count: decided || undefined },
            { slug: 'members', label: 'الأعضاء', count: s.members.length || undefined },
          ]} active={sTab} onChange={(x) => { const n = new URLSearchParams(qp); if (x === 'agenda') n.delete('tab'); else n.set('tab', x); setQp(n, { replace: true }) }} />

          {sTab === 'members' && (
            <Glass>
              <Head title="الأعضاء" />
              <ul className="apv-members">{s.members.map((m) => <li key={m}><Person name={m} /></li>)}</ul>
            </Glass>
          )}

          {sTab === 'agenda' && <>

          {/* Cross · the meeting's aggregate report and the projects' relative priority (7.4 · 6.4) */}
          {(s.items.length > 0 || may) && <AnalysisCard title="تقرير الجلسة" cta="اقرأ الجلسة" readings={sessionReport(s)} ask={false} onAsk={() => undefined} suggest={may ? <NextStep s={nextPlan} exec={nextExec} /> : undefined} />}
          {s.items.length === 0 && <Glass><Empty title="جدول الأعمال فارغ." /></Glass>}
          {s.items.map((it) => <Item key={it.projectId} s={s} it={it} may={may} me={me} />)}
          {/* v3 · 13.2.6 · a portfolio on the same session · its votes, minutes and decision on its own page */}
          {PORTFOLIOS.some((pf) => pf.session?.id === s.id) && (
            <Glass>
              <Head title="محافظ على جدول الجلسة" />
              <ul className="apv-list">
                {PORTFOLIOS.filter((pf) => pf.session?.id === s.id).map((pf) => (
                  <li key={pf.id}><span className="apv-t"><Link className="tlink" to={ROUTES.portfolio(pf.id)}>{pf.name}</Link><span className="sub">{nf.format(pf.total)} ريال{pf.stage === 'committee' || pf.stage === 'board' ? ' · بانتظار القرار' : ' · القرار مسجّل'}</span></span></li>
                ))}
              </ul>
            </Glass>
          )}

          </>}

          {/* 10 Oct · each decision followed through to its execution (7.1.output-4) */}
          {sTab === 'follow' && decided === 0 && <Glass><Empty title="لا قرارات مسجّلة بعد." /></Glass>}
          {sTab === 'follow' && decided > 0 && (
            <Glass>
              <Head title="متابعة تنفيذ القرارات" />
              <ul className="apv-list">
                {s.items.filter((i) => i.outcome).map((i) => {
                  const f = followUp(s, i)
                  const p = projectRows.find((x) => x.id === i.projectId)
                  if (!f || !p) return null
                  return (
                    <li key={i.projectId}>
                      <span className="apv-t">
                        <b>{p.name}</b>
                        <span className="sub">{OUTCOME_SAY[i.outcome!]} · {f.say}{f.next ? <> · التالي: {f.next}</> : null}</span>
                      </span>
                      <span className="pc-sp" />
                      <Tag tone={FOLLOW_TONE[f.state]}>{FOLLOW_SAY[f.state]}</Tag>
                      {f.href && <Link className="lnk" to={f.href}>افتح</Link>}
                    </li>
                  )
                })}
              </ul>
            </Glass>
          )}

          {sTab === 'agenda' && may && add.length > 0 && (
            <Glass>
              <Head title="أضف إلى جدول الأعمال" />
              <ul className="apv-list">
                {add.map((p) => (
                  <li key={p.id}>
                    <span className="apv-t"><b>{p.name}</b><span className="sub"><Money sm>{supportAmount(p)}</Money> · {p.entityName}</span></span>
                    <span className="pc-sp" />
                    <button className="btn btn-2 btn-sm" onClick={() => setAgenda(s.id, p.id, true)}><Icon name={icons.plus} size="sm" />أدرج</button>
                  </li>
                ))}
              </ul>
            </Glass>
          )}
        </div>

        {may && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <span className="decsent">قُرّر <b className="num">{decided}</b> من <b className="num">{s.items.length}</b> · الإقفال يثبّت القرارات ولا تُعدَّل إلا بجلسة جديدة</span>
              <button className="btn btn-p" disabled={decided === 0} onClick={() => closeSession(s.id, me)}>
                <Icon name={icons.lock} size="sm" />أقفل الجلسة
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function Item({ s, it, may, me }: { s: Session; it: SessionItem; may: boolean; me: string }) {
  const p = projectRows.find((x) => x.id === it.projectId)
  const [outcome, setOutcome] = useState<Outcome | ''>('')
  const [note, setNote] = useState('')
  const [plan, setPlan] = useState('')
  const [amt, setAmt] = useState(0)
  const [amtWhy, setAmtWhy] = useState('')
  /* Client 24 Oct (#84) · the body's options with its decision · the beneficiaries and its notes */
  const [ben, setBen] = useState(0)
  const [benWhy, setBenWhy] = useState('')
  const [extra, setExtra] = useState('')
  const [said, setSaid] = useState<string[]>([])
  /* Batch 8 · the model's summary when the AI service is connected (settings › الذكاء الاصطناعي) */
  const ai = useAi('summary', { projectId: it.projectId, body: s.body }, () => ({ text: '' }))
  if (!p) return null
  const f = appFlowOf(p.id)
  const study = flowOf(p.id).study
  const hold = holdLine(p.id)
  const strat = strategyOf(p)
  const fit = fitOf(p)
  const last = f.recs[0]
  const amount = supportAmount(p)
  const fin = finPosition(p)
  /* v3 · 6.4.5 · 7.4.7 · the amount the body decides · the current one unless it fixes another */
  const decided = amt > 0 ? amt : amount
  const above = decided > levelCap(s.body)
  const outcomes: Outcome[] = s.body === 'committee' ? (above ? ['refer', 'return', 'reject'] : ['approve', 'refer', 'return', 'reject']) : ['approve', 'return', 'reject']
  /* Client 18 Oct · decision 15 · a return from the session goes to the level just before it only (the
     general flowchart) · the committee returns to the executive, the board to the committee */
  const target: Holder = s.body === 'committee' ? 'exec' : 'committee'
  const why = outcome ? sessionItemBlockers(s, it, outcome, decided) : []
  /* v3 · 6.4.4 · 7.4.6 · the body may give payment guidance · the detailed schedule is the agreement's */
  const needsPay = outcome === 'approve' || (outcome === 'refer' && s.body === 'committee')
  const amtMoved = amt > 0 && amt !== amount && (outcome === 'approve' || outcome === 'refer')
  const benMoved = ben > 0 && ben !== p.beneficiaries && (outcome === 'approve' || outcome === 'refer')
  /* The assistant's executive summary for the members (6.2.3 · 7.2.4) · deterministic from the file */
  /* Batch 7 · approvals#59 · the summary carries the risks and the expected impact */
  const ei = expectedImpact(p)
  const risks = [
    ...fit.signals.filter((x) => x.tone !== 'ok').map((x) => x.text),
    s.body === 'committee' ? entityLimitBlock(p, 'committee') : '',
    fundingIssues(p.id, amount)[0],
    ...f.conditions.filter((x) => !x.met).map((x) => `شرط لم يُستوفَ: ${x.text}`),
  ].filter((x): x is string => Boolean(x))
  const summary = isolate(`${p.name} · ${p.entityName} · ${nf.format(amount)} ريال لـ${nf.format(p.beneficiaries)} مستفيد في ${p.field}. ` +
    `${study ? `درجة الدراسة ${studyScore(study.scores)} من 100 وتوصية المشرف ${study.recommendation === 'approve' ? 'بالموافقة' : 'بالرفض'}. ` : ''}` +
    `${strat.ok ? strat.say : `تنبيه: ${strat.say}`}. ` +
    `الأثر المتوقع نحو ${nf.format(ei.expected)} مستفيد فعلي${ei.from === 'default' ? ' (تقدير افتراضي)' : ` بنسبة تحقّق ${Math.round(ei.rate * 100)} بالمئة في ${ei.basis} مشاريع`}. ` +
    `${risks.length ? `المخاطر: ${risks.slice(0, 3).join('؛ ')}.` : 'لا مخاطر مرصودة في الملف.'}`)
  /* Batch 7 · approvals#45 · on the board, the plan the committee passed up with the project */
  const committeePlan = s.body === 'board'
    ? SESSIONS.filter((x) => x.body === 'committee').flatMap((x) => x.items).filter((x) => x.projectId === p.id && x.outcome === 'refer' && x.payPlan).pop()?.payPlan
    : undefined
  /* the study by its groups, the consultant's opinion, the departments' opinions */
  const groupScore = (g: string) => {
    if (!study) return null
    const list = CRITERIA.list.filter((x) => x.group === g)
    const w = list.reduce((a, x) => a + x.weight, 0)
    return w ? Math.round(list.reduce((a, x) => a + ((study.scores[x.key] ?? 0) / 5) * x.weight, 0) / w * 100) : null
  }
  const ref = flowOf(p.id).referral
  const docs = flowOf(p.id).docs

  return (
    <Glass>
      <Head
        title={p.name}
        meta={<span className="rowf gp-2">{/* Re-audit 17 Oct · an approval waiting for its cover isn't financially in force · the tag says so */ it.outcome ? (it.uncovered && !f.coverage?.done ? <Tag tone="warn">{OUTCOME_SAY[it.outcome]} · بانتظار التغطية</Tag> : <Tag tone={it.outcome === 'reject' ? 'no' : 'ok'}>{OUTCOME_SAY[it.outcome]}</Tag>) : <Tag tone="warn">بانتظار القرار</Tag>}<Link className="lnk sub" to={ROUTES.projectTab(p.id, 'approval')}>ملف المشروع</Link></span>}
      />
      <KV rows={[
        { k: 'مبلغ الدعم', v: <><Money sm>{amount}</Money>{amount !== p.amountRequested && <span className="sub"> · المطلوب <Money sm>{p.amountRequested}</Money></span>}{above && <span className="bad"> · فوق حد {HOLDER_LABEL[s.body]}</span>}</> },
        {
          k: 'الارتباط المالي',
          v: (
            <span className="rowf gp-2">
              {hold?.node
                ? <span>{HOLD_STAGE_SAY[hold.link.stage]} · {hold.link.shares.length > 1 ? `${nf.format(hold.link.shares.length)} بنود` : hold.node.label}</span>
                : <span className="bad">لا حجز · يُمنع العرض{/* doc 6.2.10 */}</span>}
              {/* 6.4.2 · 7.4.2 · the body reviews the link and may change it before it decides */}
              {may && !it.outcome && <BudgetLinkAction project={{ id: p.id, name: p.name, year: p.year, goal: p.goal, amount }} label={hold ? 'راجع الارتباط' : 'ربط بالميزانية'} />}
            </span>
          ),
        },
        ...(last ? [{ k: 'آخر توصية', v: <>{HOLDER_LABEL[last.level]} · {VERDICT_SAY[last.verdict]} · {last.note}</> }] : []),
        { k: 'التوافق', v: <span className={strat.ok ? '' : 'bad'}>{strat.say}</span> },
      ]} />
      <p className="sub cnote"><Icon name={icons.spark} size="sm" /> <b>الملخص التنفيذي</b> · {ai.source === 'model' ? ai.text : <>{summary} التوافق {pct(fit.score)}.</>} <Tag tone="mute">استرشادي · {ai.source === 'model' ? 'من النموذج' : 'قواعد محلية'}</Tag>{ai.note && <span className="sub"> · {ai.note}</span>}</p>
      <details className="mt-2">
        <summary className="lnk">ملف المشروع للأعضاء · الدراسة والآراء والوثائق والإجراءات</summary>
        <KV rows={[
          ...(study ? [{ k: 'الدراسة بمحاورها', v: <>فني <Num>{groupScore('فني') ?? 0}</Num> · مالي <Num>{groupScore('مالي') ?? 0}</Num> · إداري <Num>{groupScore('إداري') ?? 0}</Num> · الإجمالي <Num>{studyScore(study.scores)}</Num> من <Num>{100}</Num></> }] : []),
          ...(ref ? [{ k: 'رأي المستشار', v: ref.opinion ? `${consultantByKey(ref.consultant)?.name ?? ''} · ${ref.verdict ?? ''} · ${ref.opinion}` : 'بانتظار الرأي' }] : []),
          ...f.opinions.map((o) => ({ k: `رأي ${DEPT_SAY[o.dept]}`, v: o.answer ?? 'بانتظار الرد' })),
          ...(committeePlan ? [{ k: 'خطة الصرف المقرّة من اللجنة', v: <>{committeePlan.count ? <><Num>{committeePlan.count}</Num> دفعات · </> : null}{committeePlan.note}</> }] : []),
          { k: 'الوثائق', v: docs.length ? docs.map((d) => d.name).join(' · ') : '—' },
        ]} />
        {fin && <><h4 className="ptn-sub">الموقف المالي</h4><FinKV fin={fin} /></>}
        {f.briefs.some((b) => b.level === s.body) && (
          <p className="sub cnote"><Link className="lnk" to={ROUTES.projectBrief(p.id, f.briefs.find((b) => b.level === s.body)!.id)}>ملف العرض PDF للأعضاء</Link></p>
        )}
        <h4 className="ptn-sub">آخر الإجراءات</h4>
        <ul className="apv-list">
          {f.recs.slice(0, 5).map((r, i) => <li key={i}><span className="apv-t"><b>{HOLDER_LABEL[r.level]} · {VERDICT_SAY[r.verdict]}</b><span className="sub"><Person name={r.by} /> · <DateText>{r.at}</DateText>{r.note ? ` · ${r.note}` : ''}</span></span></li>)}
          {!f.recs.length && <li className="sub">لا إجراءات مسجّلة على مسار الاعتماد بعد.</li>}
        </ul>
      </details>

      {/* Client 18 Oct · decision 14 · no per-member votes · the CEO records the body's final decision
          with the minutes · the members read the file and the conflicts still stand */}
      <h3 className="stdy-h mt-3">قرار {HOLDER_LABEL[s.body]}</h3>
      {s.members.some((m) => conflictOf(p, m)) && (
        <p className="sub cnote">تعارض مصالح معلن: {s.members.filter((m) => conflictOf(p, m)).map((m) => <Tag key={m} tone="warn">{m}</Tag>)}</p>
      )}

      <div className="apv-row">
        {it.minutes ? <Tag tone="ok"><Icon name={icons.clip} size="sm" /> {it.minutes}</Tag> : <span className="sub">لا محضر بعد</span>}
        {may && !it.outcome && (
          <label className="btn btn-2 btn-sm">
            <Icon name={icons.upload} size="sm" />{it.minutes ? 'استبدل المحضر' : 'أرفق المحضر'}
            <input className="vis-h" type="file" accept=".pdf,.doc,.docx" onChange={(e) => { const x = e.target.files?.[0]; if (x) attachMinutes(s.id, p.id, x.name, me); e.target.value = '' }} />
          </label>
        )}
      </div>

      {it.outcome ? (
        <p className="sub cnote">القرار: <b>{OUTCOME_SAY[it.outcome]}</b>{it.uncovered && !f.coverage?.done && <span className="bad"> · حُفظ كما صدر بانتظار التغطية المالية: {it.uncovered}</span>}{it.target && ` إلى ${HOLDER_LABEL[it.target]}`} · {it.note}{it.payPlan?.note && <> · توجيهات الصرف: {it.payPlan.count ? <><Num>{it.payPlan.count}</Num> دفعات · </> : null}{it.payPlan.note}</>} · <DateText>{it.decidedAt ?? ''}</DateText>{s.state === 'closed' && ' · مقفل'}</p>
      ) : may ? (
        <div className="apv-dec">
          <div className="cfgchips" role="radiogroup" aria-label="القرار">
            {outcomes.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={outcome === o} className={`cfgchip${outcome === o ? ' on' : ''}`} onClick={() => { setOutcome(o); setAmt(0); setAmtWhy(''); setBen(0); setBenWhy(''); setSaid([]) }}>
                {o === 'refer' && s.body === 'committee' ? 'موافقة وإحالة للمجلس' : OUTCOME_SAY[o]}
              </button>
            ))}
          </div>
          {outcome === 'return' && (
            <p className="sub cnote">تُعاد إلى المستوى السابق: <b>{HOLDER_LABEL[target]}</b></p>
          )}
          {(outcome === 'approve' || outcome === 'refer') && (
            <div className="regfields">
              <label className="regf">
                <span className="lb">مبلغ الدعم المقرر</span>
                <MoneyField value={String(decided)} label="مبلغ الدعم المقرر" onChange={(x) => setAmt(Number(x) || 0)} />
              </label>
              {amtMoved && (
                <label className="regf regf-w">
                  <span className="lb">مبررات تعديل المبلغ<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <span className="fld"><input value={amtWhy} onChange={(e) => setAmtWhy(e.target.value)} aria-label="مبررات تعديل المبلغ في الجلسة" /></span>
                </label>
              )}
              <label className="regf">
                <span className="lb">عدد المستفيدين المقرر</span>
                <span className="fld"><input className="num" inputMode="numeric" value={nf.format(ben > 0 ? ben : p.beneficiaries)} aria-label="عدد المستفيدين المقرر" onChange={(e) => setBen(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} /></span>
              </label>
              {benMoved && (
                <label className="regf regf-w">
                  <span className="lb">مبررات تعديل عدد المستفيدين<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <span className="fld"><input value={benWhy} onChange={(e) => setBenWhy(e.target.value)} aria-label="مبررات تعديل عدد المستفيدين في الجلسة" /></span>
                </label>
              )}
            </div>
          )}
          {outcome === 'approve' && amtMoved && fin && decided - amount > fin.maxRaise && <p className="bad cnote">{/* doc 6.4.3 */}المبلغ المقرر يتجاوز الرصيد المتاح.</p>}
          {needsPay && (
            <label className="regf regf-w"><span className="lb">توجيهات الصرف <span className="sub">اختيارية</span></span><span className="fld"><input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="مثال: ربط الدفعة الثانية بالتقرير المرحلي" aria-label="توجيهات الصرف" /></span></label>
          )}
          <label className="regf regf-w">
            <span className="lb">نص القرار<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="نص القرار" /></span>
          </label>
          <label className="regf regf-w">
            <span className="lb">ملاحظات {HOLDER_LABEL[s.body]} <span className="sub">اختيارية</span></span>
            <span className="fld"><input value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="ملاحظات على القرار" /></span>
          </label>
          {[...why, ...said].length > 0 && <ul className="apv-sig">{[...new Set([...why, ...said])].map((w) => <li key={w} className="no"><Icon name={icons.alert} size="sm" /><span>{w}</span></li>)}</ul>}
          <button
            className={`btn ${outcome === 'reject' ? 'btn-d' : 'btn-p'}`}
            disabled={!outcome || !note.trim() || why.length > 0 || (amtMoved && !amtWhy.trim()) || (benMoved && !benWhy.trim())}
            onClick={() => outcome && setSaid(decideInSession(s.id, p.id, outcome, note.trim(), me, outcome === 'return' ? target : undefined, needsPay && plan.trim() ? { note: plan.trim() } : undefined, amtMoved ? { to: amt, reason: amtWhy.trim() } : undefined,
              { benef: benMoved ? { to: ben, reason: benWhy.trim() } : undefined, note: extra.trim() || undefined }))}
          >
            سجّل قرار {HOLDER_LABEL[s.body]}
          </button>
          {!it.outcome && <button className="btn btn-ghost btn-sm" onClick={() => setAgenda(s.id, p.id, false)}>أخرجه من جدول الأعمال</button>}
        </div>
      ) : null}
    </Glass>
  )
}
