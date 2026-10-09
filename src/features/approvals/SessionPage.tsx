import { useState } from 'react'
import { sessionReport } from '@/data/shared/ai'
import { AnalysisCard } from '@/components/assistant'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackTo, DateText, Empty, Glass, Head, Icon, KV, Money, Num, Person, Tag, icons } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { HOLD_STAGE_SAY, useBudget } from '@/data/budget/store'
import { BudgetLinkAction } from '@/features/budget/BudgetLink'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, pct } from '@/lib/format'
import { projectRows } from '@/data/mock/projects'
import { HOLDER_LABEL, type Holder } from '@/data/holders'
import { flowOf } from '@/data/intake/flow'
import { studyScore } from '@/data/intake/criteria'
import { fitOf } from '@/data/intake/insight'
import { meOf, readRole } from '@/data/roles'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import {
  conflictOf,
  OUTCOME_SAY, VERDICT_SAY, VOTE_SAY, appFlowOf, attachMinutes, awaitingSession, carried, castVote, closeSession,
  decideInSession, holdLine, levelCap, mayRecord, sessionById, sessionItemBlockers, setAgenda, strategyOf,
  useApprovals, voteTally, type Outcome, type Session, type SessionItem, type Vote,
} from '@/data/approvals/store'

/* One session of the executive committee or the board (6.2.2 – 6.2.9 · 7.2.2 – 7.2.11).

   The agenda's projects each carry their file for the members (the recommendations, the money and
   its hold, the fit, the assistant's executive summary · advisory only), every member's vote, the
   minutes, and the decision. The decision must match what the votes carry under the voting rule,
   and needs the minutes; approving checks the cap and the per-entity limits, a referral sends it to
   the board, a return names the stage it goes back to, a rejection releases the hold. Closing the
   session locks every decision in it (6.4.14 · 7.4.14); undecided items return to the queue. */

const VOTES: Vote[] = ['approve', 'reject', 'return', 'abstain']

export default function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  return (
    <AppLayout assistantContext={assistFor.page(s.title)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label={HOLDER_LABEL[s.body]} onClick={() => navigate(s.body === 'committee' ? ROUTES.committee : ROUTES.board)} />
          <header>
            <div>
              <h1 className="ptitle">{s.title}</h1>
              <p className="sub mt-1"><DateText>{s.date}</DateText> · <Num>{s.members.length}</Num> عضو · النصاب <Num>{APPROVAL_RULES.quorum}</Num> · {APPROVAL_RULES.voting === 'majority' ? 'بالأغلبية' : 'بالإجماع'}</p>
            </div>
            <Tag tone={s.state === 'closed' ? 'mute' : 'warn'}>{s.state === 'closed' ? `مقفلة · ${s.closedAt ?? ''}` : 'مجدولة'}</Tag>
          </header>

          <Glass>
            <Head title="الأعضاء" />
            <ul className="apv-members">{s.members.map((m) => <li key={m}><Person name={m} /></li>)}</ul>
          </Glass>

          {/* Cross · the meeting's aggregate report and the projects' relative priority (7.4 · 6.4) */}
          {s.items.length > 0 && <AnalysisCard title="تقرير الجلسة" cta="اقرأ الجلسة" readings={sessionReport(s)} ask={false} onAsk={() => undefined} />}
          {s.items.length === 0 && <Glass><Empty title="جدول الأعمال فارغ." note="أضف المشاريع المحالة من القائمة أدناه." /></Glass>}
          {s.items.map((it) => <Item key={it.projectId} s={s} it={it} may={may} me={me} />)}

          {may && add.length > 0 && (
            <Glass>
              <Head title="أضف إلى جدول الأعمال" />
              <ul className="apv-list">
                {add.map((p) => (
                  <li key={p.id}>
                    <span className="apv-t"><b>{p.name}</b><span className="sub"><Money sm>{p.amountRequested}</Money> · {p.entityName}</span></span>
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
  const [target, setTarget] = useState<Holder>('exec')
  const [note, setNote] = useState('')
  const [count, setCount] = useState('3')
  const [plan, setPlan] = useState('')
  if (!p) return null
  const f = appFlowOf(p.id)
  const study = flowOf(p.id).study
  const t = voteTally(it)
  const c = carried(it)
  const hold = holdLine(p.id)
  const strat = strategyOf(p)
  const fit = fitOf(p)
  const last = f.recs[0]
  const above = p.amountRequested > levelCap(s.body)
  const outcomes: Outcome[] = s.body === 'committee' ? (above ? ['refer', 'return', 'reject'] : ['approve', 'refer', 'return', 'reject']) : ['approve', 'return', 'reject']
  const targets: Holder[] = s.body === 'committee' ? ['exec', 'manager', 'supervisor'] : ['committee', 'exec', 'manager', 'supervisor']
  const why = outcome ? sessionItemBlockers(s, it, outcome) : []
  const needsPay = outcome === 'approve' || (outcome === 'refer' && s.body === 'committee')
  /* The assistant's executive summary for the members (6.2.3 · 7.2.4) · deterministic from the file */
  const summary = isolate(`${p.name} · ${p.entityName} · ${nf.format(p.amountRequested)} ريال لـ${nf.format(p.beneficiaries)} مستفيد في ${p.field}. ` +
    `${study ? `درجة الدراسة ${studyScore(study.scores)} من 100 وتوصية المشرف ${study.recommendation === 'approve' ? 'بالموافقة' : 'بالرفض'}. ` : ''}` +
    `${strat.ok ? strat.say : `تنبيه: ${strat.say}`}.`)

  return (
    <Glass>
      <Head
        title={p.name}
        meta={<>{it.outcome ? <Tag tone={it.outcome === 'reject' ? 'no' : 'ok'}>{OUTCOME_SAY[it.outcome]}</Tag> : <Tag tone="warn">بانتظار القرار</Tag>} <Link className="lnk sub" to={ROUTES.projectTab(p.id, 'approval')}>ملف المشروع</Link></>}
      />
      <KV rows={[
        { k: 'المبلغ', v: <><Money sm>{p.amountRequested}</Money>{above && <span className="bad"> · فوق حد {HOLDER_LABEL[s.body]}</span>}</> },
        {
          k: 'الارتباط المالي',
          v: (
            <span className="rowf gp-2">
              {hold?.node
                ? <span>{HOLD_STAGE_SAY[hold.link.stage]} · {hold.link.shares.length > 1 ? `${nf.format(hold.link.shares.length)} بنود` : hold.node.label}</span>
                : <span className="bad">لا حجز · يُمنع العرض (6.2.10)</span>}
              {/* 6.4.2 · 7.4.2 · the body reviews the link and may change it before it decides */}
              {may && !it.outcome && <BudgetLinkAction project={{ id: p.id, name: p.name, year: p.year, goal: p.goal, amount: p.amountRequested }} label={hold ? 'راجع الارتباط' : 'ربط بالميزانية'} />}
            </span>
          ),
        },
        ...(last ? [{ k: 'آخر توصية', v: <>{HOLDER_LABEL[last.level]} · {VERDICT_SAY[last.verdict]} · {last.note}</> }] : []),
        { k: 'التوافق', v: <span className={strat.ok ? '' : 'bad'}>{strat.say}</span> },
      ]} />
      <p className="sub cnote"><Icon name={icons.spark} size="sm" /> <b>الملخص التنفيذي</b> · {summary} التوافق {pct(fit.score)}. <Tag tone="mute">استرشادي</Tag></p>

      <h3 className="stdy-h mt-3">التصويت · موافقة <span className="num">{t.approve}</span> · رفض <span className="num">{t.reject}</span> · إعادة <span className="num">{t.return}</span> · امتناع <span className="num">{t.abstain}</span></h3>
      <ul className="apv-votes">
        {s.members.map((m) => {
          const conflicted = Boolean(conflictOf(p, m))
          const own = m === me && s.state === 'planned' && !it.outcome && !conflicted
          return (
          <li key={m}>
            <Person name={m} />
            {conflicted && <Tag tone="warn">تعارض مصالح · لا يصوّت</Tag>}
            {m === me && !conflicted && <Tag tone="mute">صوتك</Tag>}
            <span className="pc-sp" />
            {own ? (
              <div className="cfgchips" role="radiogroup" aria-label={`صوت ${m}`}>
                {VOTES.map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={it.votes[m] === v} className={`cfgchip${it.votes[m] === v ? ' on' : ''}`} onClick={() => castVote(s.id, p.id, m, v, me)}>
                    {VOTE_SAY[v]}
                  </button>
                ))}
              </div>
            ) : !conflicted && (
              /* Another member's vote reads · it is cast from that member's own account */
              it.votes[m] ? <Tag tone={it.votes[m] === 'approve' ? 'ok' : it.votes[m] === 'reject' ? 'no' : 'mute'}>{VOTE_SAY[it.votes[m] as keyof typeof VOTE_SAY]}</Tag> : <span className="sub">لم يصوّت بعد</span>
            )}
          </li>
          )
        })}
      </ul>
      <p className="sub cnote">يصوّت كل عضو بنفسه من حسابه · يسجّل الأمين المحضر والقرار فقط</p>
      <p className="sub cnote">{c ? <>النتيجة بالتصويت: <b>{VOTE_SAY[c]}</b></> : t.cast < APPROVAL_RULES.quorum ? `لم يكتمل النصاب (${t.cast} من ${APPROVAL_RULES.quorum})` : 'لا أغلبية بعد'} · نسبة المشاركة <span className="num">{pct(Math.round((t.cast / Math.max(1, s.members.length)) * 100))}</span></p>

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
        <p className="sub cnote">القرار: <b>{OUTCOME_SAY[it.outcome]}</b>{it.target && ` إلى ${HOLDER_LABEL[it.target]}`} · {it.note}{it.payPlan && <> · آلية الدفعات: <Num>{it.payPlan.count}</Num> دفعات · {it.payPlan.note}</>} · <DateText>{it.decidedAt ?? ''}</DateText>{s.state === 'closed' && ' · مقفل'}</p>
      ) : may ? (
        <div className="apv-dec">
          <div className="cfgchips" role="radiogroup" aria-label="القرار">
            {outcomes.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={outcome === o} className={`cfgchip${outcome === o ? ' on' : ''}`} onClick={() => setOutcome(o)}>
                {o === 'refer' && s.body === 'committee' ? 'موافقة وإحالة للمجلس' : OUTCOME_SAY[o]}
              </button>
            ))}
          </div>
          {outcome === 'return' && (
            <div className="cfgchips" role="radiogroup" aria-label="الإعادة إلى">
              {targets.map((x) => (
                <button key={x} type="button" role="radio" aria-checked={target === x} className={`cfgchip${target === x ? ' on' : ''}`} onClick={() => setTarget(x)}>
                  {HOLDER_LABEL[x]}{x === 'supervisor' ? ' · يُلغى الحجز' : ''}
                </button>
              ))}
            </div>
          )}
          {needsPay && (
            <div className="regfields">
              <label className="regf"><span className="lb">عدد الدفعات</span><span className="fld"><input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, ''))} aria-label="عدد الدفعات" /></span></label>
              <label className="regf regf-w"><span className="lb">آلية وجدول الصرف</span><span className="fld"><input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="مثال: أربعون بالمئة عند التوقيع ثم دفعتان مرحليتان" aria-label="آلية الصرف" /></span></label>
            </div>
          )}
          <label className="regf regf-w">
            <span className="lb">نص القرار والملاحظات<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="نص القرار" /></span>
          </label>
          {why.length > 0 && <ul className="apv-sig">{why.map((w) => <li key={w} className="no"><Icon name={icons.alert} size="sm" /><span>{w}</span></li>)}</ul>}
          <button
            className={`btn ${outcome === 'reject' ? 'btn-d' : 'btn-p'}`}
            disabled={!outcome || !note.trim() || why.length > 0 || (needsPay && !(Number(count) > 0))}
            onClick={() => outcome && decideInSession(s.id, p.id, outcome, note.trim(), me, outcome === 'return' ? target : undefined, needsPay ? { count: Number(count), note: plan.trim() || 'وفق خطة التنفيذ' } : undefined)}
          >
            سجّل قرار {HOLDER_LABEL[s.body]}
          </button>
          {!it.outcome && <button className="btn btn-ghost btn-sm" onClick={() => setAgenda(s.id, p.id, false)}>أخرجه من جدول الأعمال</button>}
        </div>
      ) : null}
    </Glass>
  )
}
