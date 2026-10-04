import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Glass, Head, Icon, KV, Money, Num, Person, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, nf, pct } from '@/lib/format'
import type { ProjectRow } from '@/types/domain'
import { approverFor } from '@/data/approval'
import { HOLDER_LABEL, holderOf, type Holder } from '@/data/holders'
import { flowOf } from '@/data/intake/flow'
import { CRITERIA, studyScore } from '@/data/intake/criteria'
import { consultantByKey } from '@/data/intake/consultants'
import { fitOf, similarProjects } from '@/data/intake/insight'
import { docSources, moneyOf } from '@/data/mock/budgetTree'
import { FINANCE_ACTOR, shareSay } from '@/data/budget/store'
import { readRole, roleByKey } from '@/data/roles'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import {
  DEPT_SAY, OUTCOME_SAY, VERDICT_SAY, VOTE_SAY, addCondition, addMandNote, amendDecision, answerOpinion,
  appFlowOf, askOpinion, conflictOf, declareConflict, entityBlock, entityLimitBlock, entityTally, holdLine,
  levelCap, makeOfficial, meetCondition, planSuggested, resolveNote, sessionsOf, strategyOf, useApprovals,
  voteTally, type Opinion,
} from '@/data/approvals/store'

/* «الاعتماد» · the project's decision file on the approval path (BPD-004 – BPD-007).

   Everyone above the supervisor reads the same file: where the project stands and where it goes
   next by the matrix, every recommendation before this seat with its note (4.2.2 · 5.2.3), the
   executive panel — money, the budget line, sources, risks, the entity's standing and its
   approvals this period, the fit with the foundation's directions (5.2.2 · 5.2.4 · 5.2.5 · 5.2.7) —
   and the instruments a decision may need: special conditions (5.4.16), mandatory notes that stop
   a referral up until they're handled (5.4.14), a department's opinion (5.4.15), notes made
   official for the entity (5.4.22), a declared conflict of interest (5.4.24), and the committee
   and board sessions the project sat in. None of it edits the project's own data (4.4.7 · 5.4.17). */

/** The entity's view · only the notes the foundation made official reach it (5.4.22) */
export function OfficialNotes({ notes }: { notes: { id: string; text: string; by: string; at: string }[] }) {
  return (
    <Glass>
      <Head title="ملاحظات المؤسسة" meta={<span className="sub"><Num>{notes.length}</Num> ملاحظة رسمية</span>} />
      <ul className="apv-list">
        {notes.map((o) => <li key={o.id}><span className="apv-t"><b>{o.text}</b><span className="sub"><DateText>{o.at}</DateText></span></span></li>)}
      </ul>
    </Glass>
  )
}

const HOLD_SAY = { none: 'لا حجز', initial: 'حجز مبدئي', final: 'حجز نهائي' } as const

export function ApprovalTab({ row }: { row: ProjectRow }) {
  useApprovals()
  const f = appFlowOf(row.id)
  const study = flowOf(row.id).study
  const ref = flowOf(row.id).referral
  const role = readRole()
  const me = roleByKey(role).name
  const holder = holderOf(row)
  const decider = approverFor(row.amountRequested)
  const hold = holdLine(row.id)
  const s = strategyOf(row)
  const eb = entityBlock(row)
  const tally = entityTally(row.entityId, row.id)
  const fit = fitOf(row)
  const similar = similarProjects(row, 3)
  const deciding = holder && holder !== 'supervisor' && holder !== 'confirm'
  const canDecide = deciding && ((holder === 'manager' && role === 'grants-manager') || (holder === 'exec' && role === 'ceo') ||
    (holder === 'committee' && APPROVAL_RULES.committeeBy.includes(role)) || (holder === 'board' && APPROVAL_RULES.boardBy.includes(role)))

  const [cond, setCond] = useState('')
  const [when, setWhen] = useState<'agreement' | 'firstPay'>('agreement')
  const [mand, setMand] = useState('')
  const [reply, setReply] = useState<Record<string, string>>({})
  const [ask, setAsk] = useState('')
  const [dept, setDept] = useState<Opinion['dept']>('finance')
  const [ans, setAns] = useState<Record<string, string>>({})
  const [conf, setConf] = useState('')
  const [amend, setAmend] = useState('')
  const per = row.beneficiaries > 0 ? Math.round(row.amountRequested / row.beneficiaries) : 0
  const m = hold?.doc && hold.node ? moneyOf(hold.doc.nodes, hold.node.id) : undefined
  const sessions = sessionsOf(row.id)
  const conflict = holder ? conflictOf(row, me) : undefined

  return (
    <>
      <Glass>
        <Head title="مسار القرار" meta={<Tag tone={holder === 'confirm' ? 'ok' : holder ? 'warn' : 'mute'}>{holder ? HOLDER_LABEL[holder] : row.stage}</Tag>} />
        <KV rows={[
          { k: 'صاحب القرار حسب المبلغ', v: <>{decider.role}{decider.upTo !== null && <span className="sub"> · حتى <Num>{decider.upTo}</Num></span>}</> },
          { k: 'حد المدير التنفيذي بالتجاوز المسموح', v: <><Num>{levelCap('exec')}</Num> <span className="sub">({pct(APPROVAL_RULES.execOverPct)})</span></> },
          { k: 'الحجز', v: <>{HOLD_SAY[f.hold]}{hold?.node && <span className="sub"> · {hold.node.label} · <Money sm>{hold.link.amount}</Money></span>}</> },
          ...(f.needsPlan !== undefined ? [{ k: 'الخطة', v: f.needsPlan ? 'يتطلب خطة' : 'لا يتطلب خطة' }] : [{ k: 'الخطة', v: <span className="sub">{planSuggested(row) ? 'مقترح: يتطلب خطة (وفق القاعدة)' : 'مقترح: لا يتطلب خطة'}</span> }]),
          ...(f.decided ? [{ k: 'القرار النهائي', v: <>{HOLDER_LABEL[f.decided.level]} · <Person name={f.decided.by} /> · <DateText>{f.decided.at}</DateText></> }] : []),
          ...(f.awaitingReview ? [{ k: 'بانتظار استكمال المراجعة', v: <span className="bad">{f.awaitingReview.note}</span> }] : []),
        ]} />
        {holder === 'confirm' && f.decided && role === 'ceo' && (
          <div className="apv-row mt-3">
            <span className="fld"><input value={amend} onChange={(e) => setAmend(e.target.value)} placeholder="سبب إعادة فتح القرار" aria-label="سبب تعديل القرار" /></span>
            <button className="btn btn-2 btn-sm" disabled={!amend.trim()} onClick={() => { amendDecision(row, amend.trim(), me); setAmend('') }}>عدّل القرار بإجراء رسمي</button>
          </div>
        )}
        <p className="sub cnote">لا يُحذف القرار بعد صدوره · يُعاد فتحه بإجراء رسمي موثّق في السجل (5.4.21).</p>
      </Glass>

      <Glass>
        <Head title="ملف المراجعة" meta={<span className="sub">التوصيات السابقة كما صدرت</span>} />
        {study && (
          <div className="apv-rec">
            <div className="apv-rec-h">
              <b>مشرف المنح · {study.recommendation === 'approve' ? 'توصية بالموافقة' : study.recommendation === 'reject' ? 'توصية بالرفض' : 'بلا توصية'}</b>
              <span className="pc-sp" />
              <Person name={study.by} /> <DateText>{study.at}</DateText>
            </div>
            <p className="sub cnote">{study.justification}</p>
            <ul className="apv-scores">
              {(['فني', 'إداري'] as const).map((g) => (
                <li key={g}>
                  <b>التقييم {g === 'فني' ? 'الفني' : 'الإداري'}</b>
                  {CRITERIA.list.filter((c) => c.group === g).map((c) => (
                    <span key={c.key} className="sub">{c.label} <span className="num">{study.scores[c.key] ?? '–'}</span>/5</span>
                  ))}
                </li>
              ))}
              <li><b>الدرجة</b><span className="num">{studyScore(study.scores)}</span> من <span className="num">100</span></li>
            </ul>
          </div>
        )}
        {ref && (
          <div className="apv-rec">
            <div className="apv-rec-h"><b>المستشار · {consultantByKey(ref.consultant)?.name}</b><span className="pc-sp" /><Tag tone={ref.opinion ? 'ok' : 'warn'}>{ref.opinion ? ref.verdict : 'بانتظار الرأي'}</Tag></div>
            {ref.opinion && <p className="sub cnote">{ref.opinion}</p>}
          </div>
        )}
        {[...f.recs].reverse().filter((r) => r.level !== 'supervisor' || !study).map((r, i) => (
          <div key={`${r.level}-${i}`} className="apv-rec">
            <div className="apv-rec-h">
              <b>{HOLDER_LABEL[r.level]} · {VERDICT_SAY[r.verdict]}</b>
              <span className="pc-sp" />
              <Person name={r.by} /> <DateText>{r.at}</DateText>
            </div>
            {r.note && <p className="sub cnote">{r.note}</p>}
            {r.needsPlan !== undefined && <p className="sub cnote">الخطة: {r.needsPlan ? 'يتطلب خطة' : 'لا يتطلب خطة'}</p>}
            {canDecide && r.note && (
              <button className="btn btn-ghost btn-sm" onClick={() => makeOfficial(row.id, r.note, me)}>
                <Icon name={icons.send} size="sm" />اعتمدها ملاحظة رسمية للجهة
              </button>
            )}
          </div>
        ))}
        <p className="sub cnote">مرات الإعادة: <Num>{f.recs.filter((r) => r.verdict === 'return').length}</Num> · لكل إعادة سببها في السجل.</p>
      </Glass>

      <Glass>
        <Head title="اللوحة التنفيذية" meta={<Tag tone="mute">للعرض · لا تعديل على بيانات المشروع</Tag>} />
        <KV rows={[
          { k: 'قيمة التمويل', v: <b><Money sm>{row.amountRequested}</Money></b> },
          { k: 'المستفيدون · تكلفة المستفيد', v: <><Num>{row.beneficiaries}</Num> · <Money sm>{per}</Money></> },
          { k: 'المدة', v: <><Num>{row.durationDays ?? 0}</Num> يومًا</> },
          ...(m && hold?.doc ? [
            { k: 'بند الميزانية', v: <Link className="lnk" to={`${ROUTES.budgetDoc(hold.doc.id)}?line=${hold.link.nodeId}#line-${hold.link.nodeId}`}>{hold.node?.label} · {hold.doc.name}</Link> },
            { k: 'المتاح في البند بعد الحجز', v: <Money sm>{m.available}</Money> },
            { k: 'مصادر التمويل', v: shareSay(docSources(hold.doc)) },
          ] : [{ k: 'بند الميزانية', v: <span className="bad">لم يُربط بعد</span> }]),
          { k: 'التوافق مع التوجهات', v: <span className={s.ok ? '' : 'bad'}>{s.say}</span> },
          { k: 'حالة الجهة ووثائقها', v: eb ? <span className="bad">{eb}</span> : 'نشطة ووثائقها سارية' },
          { k: 'اعتمادات الجهة في الفترة', v: <><Num>{tally.count}</Num> مشروع · <Money sm>{tally.total}</Money>{entityLimitBlock(row, 'exec') && <span className="bad"> · {entityLimitBlock(row, 'exec')}</span>}</> },
        ]} />
      </Glass>

      <Glass>
        <Head title="قراءة المساعد للقرار" meta={<Tag tone="mute">استرشادية · ليست قرارًا</Tag>} />
        <ul className="apv-sig">
          {fit.signals.map((x) => (
            <li key={x.text} className={x.tone === 'ok' ? 'ok' : 'no'}>
              <Icon name={x.tone === 'ok' ? icons.check : icons.alert} size="sm" />
              <span>{isolate(x.text)}</span>
            </li>
          ))}
          {!s.ok && <li className="no"><Icon name={icons.alert} size="sm" /><span>تعارض مع سياسات المنح: {s.say}</span></li>}
          {study && study.recommendation === 'approve' && f.recs.some((r) => r.verdict === 'recommend-reject') && (
            <li className="no"><Icon name={icons.alert} size="sm" /><span>تعارض بين توصية المشرف (موافقة) وتوصية مدير المنح (رفض)</span></li>
          )}
        </ul>
        {similar.length > 0 && (
          <p className="sub cnote">مشاريع مشابهة: {similar.map((x, i) => <span key={x.id}>{i > 0 && '، '}<Link className="lnk" to={ROUTES.project(x.id)}>{x.name}</Link> ({x.stage})</span>)}</p>
        )}
        <p className="sub cnote">التوافق <span className="num">{pct(fit.score)}</span> · مخرجات الذكاء الاصطناعي أداة دعم لا يترتب عليها أثر اعتمادي.</p>
      </Glass>

      <Glass>
        <Head title="الشروط الخاصة" meta={<span className="sub"><Num>{f.conditions.length}</Num> شرط · <bdi>5.4.16</bdi></span>} />
        {f.conditions.length === 0 && <p className="sub cnote">لا شروط على القرار.</p>}
        <ul className="apv-list">
          {f.conditions.map((c) => (
            <li key={c.id}>
              <span className="apv-t"><b>{c.text}</b><span className="sub">قبل {c.when === 'agreement' ? 'توقيع الاتفاقية' : 'صرف الدفعة الأولى'} · <Person name={c.by} /></span></span>
              <span className="pc-sp" />
              {c.met ? <Tag tone="ok">مستوفى · <DateText>{c.met.at}</DateText></Tag>
                : role === 'supervisor' ? <button className="btn btn-2 btn-sm" onClick={() => meetCondition(row.id, c.id, me)}>علّمه مستوفى</button>
                  : <Tag tone="warn">لم يُستوفَ</Tag>}
            </li>
          ))}
        </ul>
        {canDecide && holder !== 'manager' && (
          <div className="apv-row">
            <span className="fld"><input value={cond} onChange={(e) => setCond(e.target.value)} placeholder="شرط يُستوفى قبل التعاقد أو الصرف" aria-label="نص الشرط" /></span>
            <div className="cfgchips" role="radiogroup" aria-label="موعد الشرط">
              {(['agreement', 'firstPay'] as const).map((w) => (
                <button key={w} type="button" role="radio" aria-checked={when === w} className={`cfgchip${when === w ? ' on' : ''}`} onClick={() => setWhen(w)}>
                  {w === 'agreement' ? 'قبل الاتفاقية' : 'قبل الدفعة الأولى'}
                </button>
              ))}
            </div>
            <button className="btn btn-2 btn-sm" disabled={!cond.trim()} onClick={() => { addCondition(row.id, cond.trim(), when, me); setCond('') }}>أضف الشرط</button>
          </div>
        )}
      </Glass>

      <Glass>
        <Head title="الملاحظات الإلزامية" meta={<span className="sub"><bdi>5.4.14</bdi> · تمنع الإحالة لأعلى حتى تُعالج</span>} />
        {f.notes.length === 0 && <p className="sub cnote">لا ملاحظات إلزامية.</p>}
        <ul className="apv-list">
          {f.notes.map((n) => (
            <li key={n.id}>
              <span className="apv-t">
                <b>{n.text}</b>
                <span className="sub">{HOLDER_LABEL[n.level]} · <Person name={n.by} />{n.resolved && <> · عولجت: {n.resolved.reply}</>}</span>
              </span>
              <span className="pc-sp" />
              {n.resolved ? <Tag tone="ok">عولجت</Tag> : holder && holder !== n.level ? (
                <span className="apv-row">
                  <span className="fld"><input value={reply[n.id] ?? ''} onChange={(e) => setReply((x) => ({ ...x, [n.id]: e.target.value }))} placeholder="كيف عولجت" aria-label="المعالجة" /></span>
                  <button className="btn btn-2 btn-sm" disabled={!(reply[n.id] ?? '').trim()} onClick={() => resolveNote(row.id, n.id, (reply[n.id] ?? '').trim(), me)}>عولجت</button>
                </span>
              ) : <Tag tone="warn">مفتوحة</Tag>}
            </li>
          ))}
        </ul>
        {canDecide && (
          <div className="apv-row">
            <span className="fld"><input value={mand} onChange={(e) => setMand(e.target.value)} placeholder="ملاحظة يجب معالجتها قبل الإحالة" aria-label="الملاحظة الإلزامية" /></span>
            <button className="btn btn-2 btn-sm" disabled={!mand.trim()} onClick={() => { addMandNote(row.id, mand.trim(), holder as Holder, me); setMand('') }}>أضف ملاحظة إلزامية</button>
          </div>
        )}
      </Glass>

      <Glass>
        <Head title="رأي إدارة مختصة" meta={<span className="sub"><bdi>5.4.15</bdi> · استشاري</span>} />
        {f.opinions.length === 0 && <p className="sub cnote">لم يُطلب رأي.</p>}
        <ul className="apv-list">
          {f.opinions.map((o) => (
            <li key={o.id}>
              <span className="apv-t">
                <b>{DEPT_SAY[o.dept]} · {o.ask}</b>
                <span className="sub"><Person name={o.by} /> · <DateText>{o.at}</DateText>{o.answer && <> · الرأي: {o.answer}</>}</span>
              </span>
              <span className="pc-sp" />
              {o.answer ? <Tag tone="ok">ورد الرأي</Tag> : (
                <span className="apv-row">
                  <span className="fld"><input value={ans[o.id] ?? ''} onChange={(e) => setAns((x) => ({ ...x, [o.id]: e.target.value }))} placeholder={`رأي ${DEPT_SAY[o.dept]}`} aria-label="الرأي" /></span>
                  <button className="btn btn-2 btn-sm" disabled={!(ans[o.id] ?? '').trim()} onClick={() => answerOpinion(row.id, o.id, (ans[o.id] ?? '').trim(), o.dept === 'finance' ? FINANCE_ACTOR : me)}>سجّل الرأي</button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {canDecide && holder === 'exec' && (
          <div className="apv-row">
            <div className="cfgchips" role="radiogroup" aria-label="الإدارة">
              {(['finance', 'legal', 'other'] as const).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={dept === d} className={`cfgchip${dept === d ? ' on' : ''}`} onClick={() => setDept(d)}>{DEPT_SAY[d]}</button>
              ))}
            </div>
            <span className="fld"><input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="السؤال المطلوب الرأي فيه" aria-label="السؤال" /></span>
            <button className="btn btn-2 btn-sm" disabled={!ask.trim()} onClick={() => { askOpinion(row.id, dept, ask.trim(), me); setAsk('') }}>اطلب الرأي</button>
          </div>
        )}
      </Glass>

      <Glass>
        <Head title="الملاحظات الرسمية للجهة" meta={<span className="sub"><bdi>5.4.22</bdi></span>} />
        {f.official.length === 0
          ? <p className="sub cnote">لا ملاحظات رسمية · الملاحظات الداخلية لا تظهر للجهة إلا إذا اعتُمدت هنا.</p>
          : <ul className="apv-list">{f.official.map((o) => <li key={o.id}><span className="apv-t"><b>{o.text}</b><span className="sub"><Person name={o.by} /> · <DateText>{o.at}</DateText></span></span></li>)}</ul>}
      </Glass>

      {sessions.length > 0 && (
        <Glass>
          <Head title="جلسات اللجنة والمجلس" meta={<span className="sub"><Num>{sessions.length}</Num> عرض</span>} />
          <ul className="apv-list">
            {sessions.map((x) => {
              const it = x.items.find((i) => i.projectId === row.id)!
              const t = voteTally(it)
              return (
                <li key={x.id}>
                  <span className="apv-t">
                    <Link className="lnk" to={ROUTES.approvalSession(x.id)}><b>{x.title}</b></Link>
                    <span className="sub"><DateText>{x.date}</DateText> · موافقة {nf.format(t.approve)} · رفض {nf.format(t.reject)} · إعادة {nf.format(t.return)}{it.minutes && <> · المحضر: {it.minutes}</>}</span>
                  </span>
                  <span className="pc-sp" />
                  <Tag tone={it.outcome ? (it.outcome === 'reject' ? 'no' : 'ok') : 'warn'}>{it.outcome ? OUTCOME_SAY[it.outcome] : 'على جدول الأعمال'}</Tag>
                  {x.state === 'closed' && <Tag tone="mute">مقفلة</Tag>}
                </li>
              )
            })}
          </ul>
          <p className="sub cnote">لكل عرض محضره وتصويته · وتبقى العروض السابقة سجلًا تاريخيًا. أصوات الأعضاء: {Object.keys(VOTE_SAY).length} خيارات.</p>
        </Glass>
      )}

      {holder && holder !== 'supervisor' && holder !== 'confirm' && !conflict && canDecide && (
        <Glass>
          <Head title="تعارض المصالح" meta={<span className="sub"><bdi>5.4.24</bdi></span>} />
          <p className="sub cnote">إن كان لك تعارض مع الجهة فأعلنه · يُحوَّل القرار لصاحب الصلاحية التالي ولا تتخذه أنت.</p>
          <div className="apv-row">
            <span className="fld"><input value={conf} onChange={(e) => setConf(e.target.value)} placeholder="سبب التعارض" aria-label="سبب التعارض" /></span>
            <button className="btn btn-2 btn-sm" disabled={!conf.trim()} onClick={() => { declareConflict(row, holder, conf.trim(), me); setConf('') }}>أعلن التعارض وحوّل القرار</button>
          </div>
        </Glass>
      )}
    </>
  )
}
