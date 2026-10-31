import { KIND_SAY, LEVEL_RANK, LEVEL_SAY, floorOf, kindOf } from '@/data/shared/decisions'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FieldBox, Button, DockActions, DateText, Glass, Head, Icon, KV, Money, Num, Person, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, nf, pct } from '@/lib/format'
import type { ProjectRow } from '@/types/domain'
import { deciderFor } from '@/data/approval'
import { HOLDER_LABEL, holderOf, type Holder } from '@/data/holders'
import { flowOf, orgOutputsOf, outputLine } from '@/data/intake/flow'
import { GROUP_SAY, critMax, criteriaFor, studyScore } from '@/data/intake/criteria'
import { consultantByKey } from '@/data/intake/consultants'
import { fitOf, similarProjects } from '@/data/intake/insight'
import { expectedImpact } from '@/data/shared/ai'
import { docSources, moneyOf } from '@/data/mock/budgetTree'
import { HOLD_STAGE_SAY, planOf, shareSay } from '@/data/budget/store'
import { yearById } from '@/data/mock/budgetTree'
import { closeRows } from '@/data/mock/closing'
import { projectRows } from '@/data/mock/projects'
import { meOf, readRole } from '@/data/roles'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import {
  DEPT_SAY, OUTCOME_SAY, VERDICT_SAY, addCondition, addMandNote, amendDecision, answerOpinion,
  appFlowOf, askOpinion, conflictOf, declareConflict, entityBlock, entityLimitBlock, entityTally, holdLine,
  levelCap, makeOfficial, meetCondition, payPlanOf, planSuggested, resolveNote, sessionsOf, strategyOf, useApprovals,
  type Opinion, finPosition, supportAmount } from '@/data/approvals/store'
import { AmountCard, FinKV } from '@/features/approvals/AmountCard'
import { ApprovalOptions } from '@/features/approvals/ApprovalOptions'
import { consultantsFor } from '@/data/intake/consultants'
import { referConsultant } from '@/data/intake/flow'
import { FieldSelect } from '@/components/ui'
import { reasonSay } from '@/data/intake/reasons'

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


export function ApprovalTab({ row }: { row: ProjectRow }) {
  useApprovals()
  const f = appFlowOf(row.id)
  const study = flowOf(row.id).study
  const ref = flowOf(row.id).referral
  const role = readRole()
  const me = meOf(role)
  const holder = holderOf(row)
  const amount = supportAmount(row)
  const decider = deciderFor(amount)
  const fin = finPosition(row)
  const hold = holdLine(row.id)
  const s = strategyOf(row)
  /* Batch 6 · the executive panel's targets and plan */
  const objectives = flowOf(row.id).objectives
  const ei = expectedImpact(row)
  const fplan = planOf(row.id)?.kind === 'multi' ? planOf(row.id) : undefined
  const payPlan = payPlanOf(row.id)
  const needsPlan = f.needsPlan
  const past = (() => {
    const mine = closeRows.filter((c) => c.stage === 'closed' && projectRows.find((p) => p.id === c.projectId)?.entityId === row.entityId)
    const scores = mine.map((c) => c.evaluation?.score).filter((x): x is number => typeof x === 'number')
    const reach = mine.map((c) => {
      const est = projectRows.find((p) => p.id === c.projectId)?.beneficiaries ?? 0
      return est && typeof c.report.beneficiaries === 'number' ? c.report.beneficiaries / est : null
    }).filter((x): x is number => x !== null)
    return {
      n: mine.length,
      score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      reach: reach.length ? Math.round((reach.reduce((a, b) => a + b, 0) / reach.length) * 100) : null,
    }
  })()
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
  const per = row.beneficiaries > 0 ? Math.round(amount / row.beneficiaries) : 0
  const [cons, setCons] = useState('')
  const consOpts = consultantsFor(row.field)
  const m = hold?.doc && hold.node ? moneyOf(hold.doc.nodes, hold.node.id) : undefined
  const sessions = sessionsOf(row.id)
  const conflict = holder ? conflictOf(row, me) : undefined

  return (
    <>
      {/* Client 21 Oct (#27) · whatever level decided, the file comes back to the supervisor last · he
          reads what the decision changed (the amount, the outputs, the conditions) and confirms «اعتماد مكتمل» */}
      {holder === 'confirm' && f.decided && <ReviewCard row={row} />}
      <Glass>
        <Head title="مسار القرار" meta={<Tag tone={holder === 'confirm' ? 'ok' : holder ? 'warn' : 'mute'}>{holder ? HOLDER_LABEL[holder] : row.stage}</Tag>} />
        {/* Client 21 Oct (#23) · a recommendation to refuse doesn't bind the levels above · it stays on file */}
        {study?.recommendation === 'reject' && holder && holder !== 'supervisor' && (
          <p className="sub cnote">
            <Tag tone="no">أوصى مشرف المنح بالرفض</Tag>{' '}
            {study.rejectReason ? reasonSay(study.rejectReason, study.rejectOther) : null}
          </p>
        )}
        <KV rows={[
          { k: 'صاحب القرار حسب المبلغ', v: <>{decider.role}{decider.upTo !== null && <span className="sub"> · حتى <Num>{decider.upTo}</Num></span>}</> },
          ...(floorOf(row) && LEVEL_RANK[floorOf(row)!] > LEVEL_RANK[decider.key] ? [{ k: 'صاحب القرار حسب النوع', v: <>{LEVEL_SAY[floorOf(row)!]} فأعلى <span className="sub">· {KIND_SAY[kindOf(row)]}</span></> }] : []),
          { k: 'حد المدير التنفيذي بالتجاوز المسموح', v: <><Num>{levelCap('exec')}</Num> <span className="sub">({pct(APPROVAL_RULES.execOverPct)})</span></> },
          { k: 'الحجز', v: <>{/* Re-audit 17 Oct · one source · the budget link (or the multi-year plan), never the path's own flag */ hold ? HOLD_STAGE_SAY[hold.link.stage] : fplan ? (f.hold === 'none' ? 'لا حجز' : 'على خطة التمويل متعددة السنوات') : 'لا حجز · لا ارتباط بالميزانية بعد'}{hold?.node && <span className="sub"> · {hold.link.shares.length > 1 ? `${nf.format(hold.link.shares.length)} بنود` : hold.node.label} · <Money sm>{hold.link.amount}</Money></span>}</> },
          ...(f.needsPlan !== undefined ? [{ k: 'الخطة', v: f.needsPlan ? 'يتطلب خطة' : 'لا يتطلب خطة' }] : [{ k: 'الخطة', v: <span className="sub">{planSuggested(row) ? 'مقترح: يتطلب خطة' : 'مقترح: لا يتطلب خطة'}</span> }]),
          ...(f.source ? [{ k: 'مصدر التمويل', v: <>{f.source.name} <span className="sub">· <Person name={f.source.by} /></span></> }] : []),
          ...(f.levelNotes?.length ? [{ k: 'ملاحظات مستويات الاعتماد', v: <span className="sub">{f.levelNotes.map((n) => `${HOLDER_LABEL[n.level]}: ${n.text}`).join(' · ')}</span> }] : []),
          ...(f.decided ? [{ k: 'القرار النهائي', v: <>{HOLDER_LABEL[f.decided.level]} · <Person name={f.decided.by} /> · <DateText>{f.decided.at}</DateText></> }] : []),
          ...(f.awaitingReview ? [{ k: 'بانتظار استكمال المراجعة', v: <span className="bad">{f.awaitingReview.note}</span> }] : []),
        ]} />
        {/* v3 · 5.4.21 · an approved decision is reopened by a documented act until the agreement work starts */}
        {(holder === 'confirm' || row.statusGroup === 'معتمد') && f.decided && role === 'ceo' && (
          <div className="apv-row mt-3">
            {/* Client 26 Oct · the reason in the decision's popup */}
            <DockActions
              actions={[{ label: 'عدّل القرار بإجراء رسمي', kind: 'btn-2 btn-sm', needsNote: true }]}
              subject={row.name}
              placeholder="سبب إعادة فتح القرار"
              onRun={(_a, n) => { amendDecision(row, n, me) }}
            />
          </div>
        )}
      </Glass>

      {/* Client 24 Oct (#82 · #83) · what the seat may change with its decision */}
      <ApprovalOptions row={row} />
      {/* Client 24 Oct (#85) · the financial link reads in its own tab «الربط المالي» */}
      <AmountCard row={row} />

      <Glass>
        <Head title="ملف المراجعة" />
        {study && (
          <div className="apv-rec">
            <div className="apv-rec-h">
              <b>مشرف المنح · {study.recommendation === 'approve' ? 'توصية بالموافقة' : study.recommendation === 'reject' ? 'توصية بالرفض' : 'بلا توصية'}</b>
              <span className="pc-sp" />
              <Person name={study.by} /> <DateText>{study.at}</DateText>
            </div>
            <p className="sub cnote">{study.justification}</p>
            {study.recommendation === 'reject' && study.rejectReason && <p className="sub cnote">سبب التوصية بالرفض: {reasonSay(study.rejectReason, study.rejectOther)}</p>}
            {/* v3 · 3.4.45 · the foundation's outputs go up with the file · the entity's stay readable */}
            {orgOutputsOf(row.id).length > 0 && (
              <details className="mt-1" open>
                <summary className="lnk">مخرجات المؤسسة · <Num>{orgOutputsOf(row.id).length}</Num></summary>
                <ul className="outs-ro mt-1">{orgOutputsOf(row.id).map((o, i) => <li key={i}>{outputLine(o)}</li>)}</ul>
                {(flowOf(row.id).entityOutputs ?? []).length > 0 && <p className="sub cnote">الأصل كما قدّمته الجهة: {(flowOf(row.id).entityOutputs ?? []).map(outputLine).join(' ؛ ')}</p>}
              </details>
            )}
            <ul className="apv-scores">
              {(['فني', 'مالي', 'إداري'] as const).map((g) => (
                <li key={g}>
                  <b>التقييم {GROUP_SAY[g].eval}</b>
                  {/* the criteria wrap inside their own column, never back under the label (UI-129) */}
                  <span className="apv-sc">
                    {criteriaFor(study.scores).filter((c) => c.group === g).map((c) => (
                      <span key={c.key} className="sub">{c.label} <span className="num">{study.scores[c.key] ?? '–'}</span>/{critMax(c)}</span>
                    ))}
                  </span>
                </li>
              ))}
              <li><b>الدرجة</b><span><span className="num">{studyScore(study.scores)}</span> من <span className="num">100</span></span></li>
            </ul>
          </div>
        )}
        {ref && (
          <div className="apv-rec">
            <div className="apv-rec-h"><b>المستشار · {consultantByKey(ref.consultant)?.name}</b><span className="pc-sp" /><Tag tone={ref.opinion ? 'ok' : 'warn'}>{ref.opinion ? ref.verdict : 'بانتظار الرأي'}</Tag></div>
            {ref.opinion && <p className="sub cnote">{ref.opinion}</p>}
          </div>
        )}
        {/* v3 · 4.2.8 · 4.4.7 · the grants manager asks a consultant himself · the path goes on */}
        {holder === 'manager' && role === 'grants-manager' && !(ref && !ref.opinion) && (
          consOpts.length ? (
            <div className="cfgrow">
              <FieldSelect value={cons} label="مستشار مختص" options={consOpts.map((c) => ({ value: c.key, label: `${c.name} · ${c.accessDays} أيام` }))} onChange={setCons} />
              <Button type="button" variant="2" className="cfgadd" disabled={!cons} onClick={() => { referConsultant(row.id, cons, me); setCons('') }}>اطلب رأي المستشار</Button>
            </div>
          ) : <p className="sub cnote">لا مستشار مرتبط بمجال «{row.field}».</p>
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
              <Button variant="ghost" size="sm" onClick={() => makeOfficial(row.id, r.note, me)}>
                <Icon name={icons.send} size="sm" />اعتمدها ملاحظة رسمية للجهة
              </Button>
            )}
          </div>
        ))}
        <p className="sub cnote">مرات الإعادة: <Num>{f.recs.filter((r) => r.verdict === 'return').length}</Num></p>
      </Glass>

      <Glass>
        <Head title="اللوحة التنفيذية" />
        <KV rows={[
          { k: 'مبلغ الدعم', v: <b><Money sm>{amount}</Money></b> },
          { k: 'المستفيدون · تكلفة المستفيد', v: <><Num>{row.beneficiaries}</Num> · <Money sm>{per}</Money></> },
          { k: 'المدة', v: <><Num>{row.durationDays ?? 0}</Num> يومًا</> },
          ...(m && hold?.doc ? [
            { k: 'بند الميزانية', v: <Link className="lnk" to={`${ROUTES.budgetDoc(hold.doc.id)}?line=${hold.link.nodeId}#line-${hold.link.nodeId}`}>{hold.node?.label} · {hold.doc.name}</Link> },
            { k: 'مصادر التمويل', v: shareSay(docSources(hold.doc)) },
          ] : [{ k: 'بند الميزانية', v: <span className="bad">لم يُربط بعد</span> }]),
          { k: 'التوافق مع التوجهات', v: <span className={s.ok ? '' : 'bad'}>{s.say}</span> },
          { k: 'حالة الجهة ووثائقها', v: eb ? <span className="bad">{eb}</span> : 'نشطة ووثائقها سارية' },
          { k: 'اعتمادات الجهة في الفترة', v: <><Num>{tally.count}</Num> مشروع · <Money sm>{tally.total}</Money>{entityLimitBlock(row, 'exec') && <span className="bad"> · {entityLimitBlock(row, 'exec')}</span>}</> },
        ]} />
        {/* v3 · 5.4.8 · the financial card, live · holds, balances and what the decision leaves */}
        {fin && <><h3 className="stdy-h mt-3">الموقف المالي اللحظي</h3><FinKV fin={fin} /></>}
        {/* Batch 6 · 8 Oct · the panel carries the project's expected results and its plan (5.2.2 ·
            5.2.4) · the targets the request states, the entity's record on its closed projects, the
            funding plan across the years and the payment plan a body approved */}
        <h3 className="stdy-h mt-3">المؤشرات المستهدفة</h3>
        <KV rows={[
          { k: 'المستفيدون المستهدفون', v: <Num>{row.beneficiaries}</Num> },
          /* Batch 7 · approvals#8 · the expected impact from the reach really reported (cross#28) */
          { k: 'الأثر المتوقع', v: <><Num>{ei.expected}</Num> مستفيد · {ei.from === 'default' ? 'تقدير افتراضي' : <>بنسبة تحقّق <span className="num">{pct(Math.round(ei.rate * 100))}</span> في <Num>{ei.basis}</Num> {ei.from === 'similar' ? 'مشابهًا' : 'من المجال'}</>}</> },
          /* Client 21 Oct (#28) · the end is a date the entity gave (moved with the actual start) · the duration the days between */
          { k: 'نهاية التنفيذ', v: row.endAt ? <><DateText>{row.endAt}</DateText>{row.durationDays ? <span className="sub"> · <Num>{row.durationDays}</Num> يومًا</span> : null}</> : '—' },
          { k: 'الأهداف التفصيلية', v: objectives.length ? <><Num>{objectives.length}</Num> · {objectives.slice(0, 2).join('، ')}{objectives.length > 2 ? '…' : ''}</> : '—' },
          { k: 'سجلّ الجهة في المشاريع المغلقة', v: past.n ? <><Num>{past.n}</Num> مشروع · متوسط التقييم {past.score === null ? '—' : <Num>{past.score}</Num>} · تحقق المستفيدين {past.reach === null ? '—' : <span className="num">{pct(past.reach)}</span>}</> : 'لا مشاريع مغلقة للجهة بعد' },
        ]} />
        <h3 className="stdy-h mt-3">الخطة</h3>
        <KV rows={[
          { k: 'الخطة المالية', v: fplan ? fplan.years.map((y) => `${yearById(y.yearId)?.name ?? y.yearId}: ${nf.format(y.amount)}`).join(' · ') : 'سنة واحدة · من بند الحجز' },
          { k: 'توجيهات الصرف', v: payPlan?.note ? <>{payPlan.count ? <><Num>{payPlan.count}</Num> دفعات · </> : null}{payPlan.note}</> : '—' },
          { k: 'خطة التنفيذ', v: needsPlan === undefined ? 'يُقرَّر مع الاعتماد' : needsPlan ? 'يتطلب خطة تنفيذ' : 'لا يتطلب خطة' },
        ]} />
      </Glass>

      <Glass>
        <Head title="قراءة المساعد للقرار" />
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
        <p className="sub cnote">التوافق <span className="num">{pct(fit.score)}</span></p>
      </Glass>

      <Glass>
        <Head title="الشروط الخاصة" meta={<span className="sub"><Num>{f.conditions.length}</Num> شرط{/* doc 5.4.16 */}</span>} />
        {f.conditions.length === 0 && <p className="sub cnote">لا شروط على القرار.</p>}
        <ul className="apv-list">
          {f.conditions.map((c) => (
            <li key={c.id}>
              <span className="apv-t"><b>{c.text}</b><span className="sub">قبل {c.when === 'agreement' ? 'توقيع الاتفاقية' : 'صرف الدفعة الأولى'} · <Person name={c.by} />{c.by === study?.by ? ' · من دراسة مشرف المنح' : ''}</span></span>
              <span className="pc-sp" />
              {c.met ? <Tag tone="ok">مستوفى · <DateText>{c.met.at}</DateText></Tag>
                : role === 'supervisor' ? <Button variant="2" size="sm" onClick={() => meetCondition(row.id, c.id, me)}>علّمه مستوفى</Button>
                  : <Tag tone="warn">لم يُستوفَ</Tag>}
            </li>
          ))}
        </ul>
        {canDecide && holder !== 'manager' && (
          <div className="apv-row">
            <FieldBox><input value={cond} onChange={(e) => setCond(e.target.value)} placeholder="شرط يُستوفى قبل التعاقد أو الصرف" aria-label="نص الشرط" /></FieldBox>
            <div className="cfgchips" role="radiogroup" aria-label="موعد الشرط">
              {(['agreement', 'firstPay'] as const).map((w) => (
                <Button plain key={w} type="button" role="radio" aria-checked={when === w} className={`cfgchip${when === w ? ' on' : ''}`} onClick={() => setWhen(w)}>
                  {w === 'agreement' ? 'قبل الاتفاقية' : 'قبل الدفعة الأولى'}
                </Button>
              ))}
            </div>
            <Button variant="2" size="sm" disabled={!cond.trim()} onClick={() => { addCondition(row.id, cond.trim(), when, me); setCond('') }}>أضف الشرط</Button>
          </div>
        )}
      </Glass>

      <Glass>
        <Head title="الملاحظات الإلزامية" />
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
                  <FieldBox><input value={reply[n.id] ?? ''} onChange={(e) => setReply((x) => ({ ...x, [n.id]: e.target.value }))} placeholder="كيف عولجت" aria-label="المعالجة" /></FieldBox>
                  <Button variant="2" size="sm" disabled={!(reply[n.id] ?? '').trim()} onClick={() => resolveNote(row.id, n.id, (reply[n.id] ?? '').trim(), me)}>عولجت</Button>
                </span>
              ) : <Tag tone="warn">مفتوحة</Tag>}
            </li>
          ))}
        </ul>
        {canDecide && (
          <div className="apv-row">
            <FieldBox><input value={mand} onChange={(e) => setMand(e.target.value)} placeholder="ملاحظة يجب معالجتها قبل الإحالة" aria-label="الملاحظة الإلزامية" /></FieldBox>
            <Button variant="2" size="sm" disabled={!mand.trim()} onClick={() => { addMandNote(row.id, mand.trim(), holder as Holder, me); setMand('') }}>أضف ملاحظة إلزامية</Button>
          </div>
        )}
      </Glass>

      <Glass>
        <Head title="رأي إدارة مختصة" />
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
                  <FieldBox><input value={ans[o.id] ?? ''} onChange={(e) => setAns((x) => ({ ...x, [o.id]: e.target.value }))} placeholder={`رأي ${DEPT_SAY[o.dept]}`} aria-label="الرأي" /></FieldBox>
                  <Button variant="2" size="sm" disabled={!(ans[o.id] ?? '').trim()} onClick={() => answerOpinion(row.id, o.id, (ans[o.id] ?? '').trim(), me)}>سجّل الرأي</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {canDecide && holder === 'exec' && (
          <div className="apv-row">
            <div className="cfgchips" role="radiogroup" aria-label="الإدارة">
              {(['finance', 'legal', 'other'] as const).map((d) => (
                <Button plain key={d} type="button" role="radio" aria-checked={dept === d} className={`cfgchip${dept === d ? ' on' : ''}`} onClick={() => setDept(d)}>{DEPT_SAY[d]}</Button>
              ))}
            </div>
            <FieldBox><input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="السؤال المطلوب الرأي فيه" aria-label="السؤال" /></FieldBox>
            <Button variant="2" size="sm" disabled={!ask.trim()} onClick={() => { askOpinion(row.id, dept, ask.trim(), me); setAsk('') }}>اطلب الرأي</Button>
          </div>
        )}
      </Glass>

      <Glass>
        <Head title="الملاحظات الرسمية للجهة" />
        {f.official.length === 0
          ? <p className="sub cnote">لا ملاحظات رسمية.</p>
          : <ul className="apv-list">{f.official.map((o) => <li key={o.id}><span className="apv-t"><b>{o.text}</b><span className="sub"><Person name={o.by} /> · <DateText>{o.at}</DateText></span></span></li>)}</ul>}
      </Glass>

      {sessions.length > 0 && (
        <Glass>
          <Head title="جلسات اللجنة والمجلس" meta={<span className="sub"><Num>{sessions.length}</Num> عرض</span>} />
          <ul className="apv-list">
            {sessions.map((x) => {
              const it = x.items.find((i) => i.projectId === row.id)!
              return (
                <li key={x.id}>
                  <span className="apv-t">
                    <Link className="lnk" to={ROUTES.approvalSession(x.id)}><b>{x.title}</b></Link>
                    <span className="sub"><DateText>{x.date}</DateText>{it.minutes ? <> · المحضر: {it.minutes}</> : ' · لا محضر بعد'}</span>
                  </span>
                  <span className="pc-sp" />
                  <Tag tone={it.outcome ? (it.outcome === 'reject' ? 'no' : 'ok') : 'warn'}>{it.outcome ? OUTCOME_SAY[it.outcome] : 'على جدول الأعمال'}</Tag>
                  {x.state === 'closed' && <Tag tone="mute">مقفلة</Tag>}
                </li>
              )
            })}
          </ul>
        </Glass>
      )}

      {holder && holder !== 'supervisor' && holder !== 'confirm' && !conflict && canDecide && (
        <Glass>
          <Head title="تعارض المصالح" />
          <div className="apv-row">
            {/* Client 26 Oct · the reason in the decision's popup */}
            <DockActions
              actions={[{ label: 'أعلن التعارض وحوّل القرار', kind: 'btn-2 btn-sm', needsNote: true }]}
              subject={row.name}
              placeholder="سبب التعارض"
              onRun={(_a, n) => { declareConflict(row, holder, n, me) }}
            />
          </div>
        </Glass>
      )}
    </>
  )
}

/** Client 21 Oct (#27) · the supervisor's closing review · what the decision left on the file, read
    before «اعتماد مكتمل» · a review of the result, not a second approval */
function ReviewCard({ row }: { row: ProjectRow }) {
  const f = appFlowOf(row.id)
  const study = flowOf(row.id).study
  const outputs = orgOutputsOf(row.id)
  const unmet = f.conditions.filter((c) => !c.met)
  const open = f.notes.filter((n) => !n.resolved)
  const decided = f.decided
  return (
    <Glass>
      <Head title="مراجعة المشرف" meta={<Tag tone={unmet.length || open.length ? 'warn' : 'ok'}>{unmet.length || open.length ? 'قبل التأكيد' : 'جاهزة للتأكيد'}</Tag>} />
      <KV rows={[
        ...(decided ? [{ k: 'القرار', v: <>{HOLDER_LABEL[decided.level]} · اعتماد · <Person name={decided.by} /> · <DateText>{decided.at}</DateText></> }] : []),
        { k: 'المبلغ', v: <>المطلوب <Money sm>{row.amountRequested}</Money>{study?.recommendation === 'approve' ? <> · الموصى به <Money sm>{study.amount}</Money></> : null} · المعتمد <b><Money sm>{supportAmount(row)}</Money></b></> },
        { k: 'تعديلات المبلغ على المسار', v: f.amounts.filter((a) => a.level !== 'supervisor').length ? f.amounts.filter((a) => a.level !== 'supervisor').map((a) => `${HOLDER_LABEL[a.level]}: ${nf.format(a.from)} ← ${nf.format(a.to)}`).join(' · ') : <span className="sub">لا تعديل</span> },
        { k: 'مخرجات المؤسسة', v: outputs.length ? <><Num>{outputs.length}</Num> · {outputs.slice(0, 2).map(outputLine).join(' ؛ ')}{outputs.length > 2 ? '…' : ''}</> : <span className="sub">لا مخرجات مسجّلة</span> },
        { k: 'الشروط الخاصة', v: f.conditions.length ? <>{unmet.length ? <span className="bad"><Num>{unmet.length}</Num> لم تُستوفَ</span> : 'مستوفاة'} · <Num>{f.conditions.length}</Num> شرط</> : <span className="sub">لا شروط</span> },
        { k: 'الملاحظات الإلزامية', v: open.length ? <span className="bad"><Num>{open.length}</Num> لم تُعالج</span> : <span className="sub">لا ملاحظات مفتوحة</span> },
      ]} />
    </Glass>
  )
}
