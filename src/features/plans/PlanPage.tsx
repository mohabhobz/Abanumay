import { useMemo, useRef, useState } from 'react'
import { forecastPlan } from '@/data/shared/ai'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TONE } from '@/lib/tone'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, KV, Money, Mono, Num, StepArc, Tag,
  icons, type GateStep,
} from '@/components/ui'
import { AnalysisCard } from '@/components/assistant/AnalysisCard'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { useFillHeight } from '@/hooks/useFillHeight'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, NOUN, nounAfter, pct, ver } from '@/lib/format'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  PLAN_LIMIT, PLAN_STAGES, lateActivities,
  planById, planClaimed, planDone, planIssues, planPlanned,
  planSpi, planStageLabel, planStageWho, readyToClose, spiSay,
  waitingReview,
} from '@/data/mock/plans'
import {
  acceptActivityBy, claimActivityBy, commentOn, saveActivityData, decideChangeBy, dropEvidence, mayDraft, projectWindow,
  rejectActivityBy, reviewPlan, sendPlanFor, startActivity, stuckActivities, uploadEvidence, usePlans,
  planLogOf,
} from '@/data/plans/store'
import { PlanDecisionCard } from './PlanDecisionCard'
import type { PlanAction } from './PlanActionDock'
import { projectById } from '@/data/mock/projects'
import { planReadings } from './readings'
import { PhaseTree } from './PhaseTree'
import { PlanBar } from './PlanBar'
import { PlanActionDock, planActionsFor } from './PlanActionDock'
import { EditableCard } from '@/features/shared/EditableCard'

/* Names inside the fan's sectors · who holds each step, like the project's roles */
const STEP_LABEL: Record<string, string> = {
  draft: 'الجهة المستفيدة',
  supervisor: 'مشرف المنح',
  manager: 'مدير المنح',
  active: 'التنفيذ',
  done: 'الاكتمال',
}
const STEP_CAP: Record<string, string> = {
  draft: 'إعداد الخطة',
  supervisor: 'المراجعة',
  manager: 'الاعتماد',
  active: 'الأنشطة والشواهد',
  done: 'مؤهَّلة للإغلاق',
}

/* Plan page.

   Note: the page is two parts - header plus phases - the same principle repeated across every
   screen in the system (budget, agreement, disbursement order).

   Note: its header answers one question: is it on track or not? Not "what's its data" - the data is
   in the table below. The header carries the comparison: accepted, declared, and
   planned-as-of-today, with the schedule performance between them. A number with no reference reads
   as a verdict with no basis, so the three appear together.

   Note: review happens on the activity, not on the plan. Rule 14 separates "the entity said" from
   "the supervisor accepted" - a single decision on the page's action dock would accept every piece
   of evidence with one click, and that's exactly what the rule exists to prevent. */

export default function PlanPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { role, user } = useRole()
  const mobile = useIsMobile()
  /* Note: the same screen through two lenses, not two screens. The entity and the supervisor look
     at the same phases, activities and evidence - what differs is the actions: the entity marks
     things done and uploads, the supervisor accepts or rejects. Two separate screens would have
     drifted apart at the first edit, which is what happened before on the registration flow. */
  const asEntity = params.get('as') === 'entity'
  const p = planById(id)
  usePlans()
  const [note, setNote] = useState('')
  const [said, setSaid] = useState('')
  const [chNote, setChNote] = useState<Record<string, string>>({})
  const [focus, setFocus] = useState<string | undefined>()
  const [tick, setTick] = useState(0)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [reject, setReject] = useState<{ id: string; note: string } | null>(null)

  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 240 })

  /* Note: a phase with pending work expands on its own - collapsed-by-default is right for tables
     (their question is "how many") and wrong here (the question is "which activity"). */
  const first = useMemo(() => {
    if (!p) return new Set<string>()
    const s = new Set<string>()
    for (const ph of p.phases) {
      const busy = ph.activities.some((a) => a.state !== 'accepted')
      if (busy) s.add(ph.id)
    }
    return s.size ? s : new Set(p.phases.map((x) => x.id))
  }, [p])

  const shown = open.size ? open : first

  const readings = useMemo(
    () => {
      if (!p) return []
      const f = forecastPlan(p)
      return [...planReadings(p, (actId) => {
        setFocus(actId)
        document.getElementById(`act-${actId}`)?.scrollIntoView({ block: 'center' })
      }), ...(f ? [f] : [])]
    },
    [p, tick],
  )

  if (!p) {
    return (
      <AppLayout assistantContext={assistFor.page('خطة غير موجودة')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />
            <Glass>
              <Empty
                title="لا توجد خطة بهذا الرقم."
                note="عُد إلى صندوق الخطط واختر خطة منه."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.plans)}>
                    العودة إلى صندوق الخطط
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const pr = projectById(p.projectId)
  const grant = pr?.amountGranted ?? 0
  const done = planDone(p)
  const claim = planClaimed(p)
  const want = planPlanned(p)
  const spi = planSpi(p)
  const say = spiSay(spi)
  const queue = waitingReview(p)
  const late = lateActivities(p)
  const issues = planIssues(p, grant)
  const live = p.stage === 'active' || p.stage === 'done'
  const actions = planActionsFor(role.key, p.stage, asEntity)
  const stuck = stuckActivities(p)
  const win = projectWindow(p.projectId)
  const who = asEntity ? p.entityName : user.name
  const canDraft = mayDraft(p, asEntity) || (!asEntity && role.key === 'supervisor' && (p.stage === 'draft' || p.stage === 'returned'))
  const cost = p.phases.reduce((s, ph) => s + ph.cost, 0)

  /* The same fan as the project, agreement and closing headers, driven by the plan's own path.
     «مُعادة للجهة» isn't a step on the path: a returned plan sits back with the entity, at the
     draft step, and says so in the hover reading and under the arc. */
  const path = PLAN_STAGES.filter((s) => s.key !== 'returned')
  const returned = p.stage === 'returned'
  const finished = p.stage === 'done'
  const at = finished ? path.length : path.findIndex((s) => s.key === (returned ? 'draft' : p.stage))
  const openDays = Math.round(p.hoursInStage / 24)
  const limit = PLAN_LIMIT[p.stage]

  const steps: GateStep[] = path.map((s, i): GateStep => {
    const base = { label: STEP_LABEL[s.key] ?? s.who, title: s.label, cap: STEP_CAP[s.key] ?? '' }
    if (i === at) {
      return {
        ...base,
        state: 'now',
        lines: [
          returned
            ? <>أُعيدت للجهة بملاحظات مكتوبة · منذ <b>{openDays}</b> {nounAfter(openDays, NOUN.day)}</>
            : <><b>{s.who}</b> · منذ <b>{openDays}</b> {nounAfter(openDays, NOUN.day)}</>,
          limit > 0
            ? <><b>{nf.format(p.hoursInStage)}</b> ساعة مقابل حدّ <b>{nf.format(limit)}</b></>
            : s.key === 'active'
              ? <>الإنجاز المقبول <b>{pct(done)}</b> مقابل المخطَّط <b>{pct(want)}</b></>
              : s.note,
        ],
        src: 'المصدر: سجل الخطة',
      }
    }
    return {
      ...base,
      state: i < at ? 'done' : 'pending',
      lines: [s.note, i < at ? null : 'تبدأ بعد اكتمال المرحلة السابقة'],
      src: i < at ? 'المصدر: سجل الخطة' : 'المصدر: مسار الخطة',
    }
  })

  /* During execution nobody is deciding: the entity is doing the work, so the center says that. */
  const holder = finished
    ? { k: 'اكتملت الخطة', t: 'مؤهَّلة للإغلاق' }
    : p.stage === 'active'
      ? { k: 'يعمل عليها الآن', t: planStageWho('active') }
      : { k: 'صاحب القرار الآن', t: steps[at]?.label ?? planStageWho(p.stage) }
  const holderRest = [
    live
      ? <>الإنجاز المقبول <b className="num">{pct(done)}</b> · المخطَّط <b className="num">{pct(want)}</b></>
      : returned
        ? <>أُعيدت للجهة · تعود للمراجعة بعد التعديل</>
        : <>الاعتماد يثبّت النسخة المرجعية · وبعده يُقاس الانحراف</>,
    p.baseline > 0
      ? <>النسخة المرجعية <b className="num">{ver(p.baseline)}</b></>
      : null,
  ]

  const take = (x: PlanAction) => {
    if (x.key === 'send') sendPlanFor(p.id, asEntity ? 'entity' : 'supervisor', who)
    else if (x.key === 'approve' || x.key === 'toManager' || x.key === 'returnEntity' || x.key === 'managerReturn') reviewPlan(p.id, x.key, note.trim(), who)
    setNote('')
    setSaid(`سُجّل: ${x.label}`)
    setTick((t) => t + 1)
  }

  return (
    <AppLayout assistantContext={assistFor.page(`خطة ${p.projectName}`)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />

          {/* Header laid out like the project and closing pages: title and grant, the fan at the
              end. It replaces the flat stepper card that sat under the header. */}
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">خطة {p.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{p.id}</Mono> ·{' '}
                <Link to={ROUTES.entity(p.entityId)} className="tlink">{p.entityName}</Link> ·{' '}
                {p.baseline > 0
                  ? <>النسخة المرجعية <Num>{ver(p.baseline)}</Num>{' '}
                    {p.baselineAt && <>من <DateText>{p.baselineAt}</DateText></>}</>
                  : 'لم تُعتمد بعد · الهيكل مفتوح للتعديل'}
              </p>
              <div className="gt-tag">
                <Tag tone="mute">{planStageLabel(p.stage)}</Tag>
              </div>

              {pr && (
                <div className="pamt">
                  <div className="lb">قيمة المنحة</div>
                  <div className="v"><Money sm>{grant || pr.amountRequested}</Money></div>
                  <div className="sub">
                    تكلفة المراحل <Num>{cost}</Num> · <Num>{p.phases.length}</Num> {nounAfter(p.phases.length, NOUN.phase)}
                    {win.days > 0 && <> · مدة المشروع <Num>{win.days}</Num> يومًا</>}
                  </div>
                </div>
              )}
            </div>

            <div className="pgates">
              <StepArc
                steps={steps}
                compact={mobile}
                aria={`مسار الخطة، ${holder.t}`}
                holderKey={holder.k}
                holder={holder.t}
                rest={holderRest}
              />
            </div>
          </header>
          {said && <p className="sub cnote tcen" aria-live="polite">{said}</p>}

          {/* Note: the entity needs to know that "done" isn't "counted". This is the biggest
              possible misunderstanding on this screen: the entity uploads evidence, marks it done,
              and assumes the percentage went up - but rule 14 says it doesn't rise until the
              supervisor accepts it. The sentence is stated up top, not left to be inferred from a
              small badge next to the activity. */}
          {p.stage === 'cancelled' && (
            <Glass>
              <Head title="الخطة ملغاة" meta={<Tag tone="no">ملغاة</Tag>} />
              <p className="sub cnote">{p.note ?? /* doc 12.4.32 */ 'تحوّل المشروع إلى «لا يتطلب خطة» · توقفت إجراءات الخطة.'}</p>
            </Glass>
          )}

          {!canDraft && p.note && (p.stage === 'supervisor' || p.stage === 'returned') && (
            <Glass>
              <Head title="ملاحظات الإعادة" meta={<Tag tone="warn">{planStageLabel(p.stage)}</Tag>} />
              <p className="sub cnote">{isolate(p.note)}</p>
            </Glass>
          )}

          {canDraft && (
            <Glass>
              <Head title={p.stage === 'returned' ? 'الخطة مُعادة للتعديل' : 'مسودة الخطة'} meta={<Link className="btn btn-p btn-sm" to={`${ROUTES.planEdit(p.id)}${asEntity ? '?as=entity' : ''}`}>{p.stage === 'returned' ? 'عدّل الخطة' : 'حرّر الخطة'}</Link>} />
              {p.note && <p className="sub cnote">{isolate(p.note)}</p>}
              <p className="sub cnote">{asEntity ? 'تكتب الجهة المراحل والأنشطة والشواهد ثم ترسلها لمشرف المنح.' : 'يكتبها المشرف بالنيابة عن الجهة عند الحاجة.'}</p>
            </Glass>
          )}

          {asEntity && (
            <Glass>
              <Head
                title="صفحة خطة الجهة"
                meta={<Tag tone="mute">الجهة المستفيدة</Tag>}
              />
              <p className="sub cnote">
                ترفع الجهة الشواهد وتعلن اكتمال النشاط، فيتحوّل إلى
                «بانتظار قبول المشرف»، ولا يُحتسب في نسبة الإنجاز قبل أن
                يراجعه مشرف المنح ويقبله{/* doc rule 14 */}.
                وإن أُعيد النشاط، يظهر سبب الإعادة مكتوبًا تحته.
              </p>
            </Glass>
          )}

          <div className="g2">
            <div className="col">
              {/* === Header - on track or not === */}
              <Glass>
                <Head
                  title="حالة التنفيذ"
                  meta={live
                    ? <Tag tone={say.tone === 'mute' ? 'mute' : say.tone}>{say.say}</Tag>
                    : <span className="sub">تبدأ بعد الاعتماد</span>}
                />

                {live ? (
                  <>
                    {/* Note: the number with its two reference points - SPI alone is a verdict with
                        no basis. */}
                    <PlanBar done={done} claim={claim} want={want} />

                    <KV
                      rows={[
                        {
                          k: 'أداء الجدول · SPI',
                          v: spi === null
                            ? <span className="sub">لم يبدأ</span>
                            : <span className={spi < 0.8 ? 'bad' : undefined}>
                              <span className="num">{spi.toFixed(2)}</span>
                              <span className="sub"> · المقبول ÷ المخطَّط</span>
                            </span>,
                        },
                        {
                          k: 'بانتظار مراجعة مشرف المنح',
                          v: queue.length === 0
                            ? <span className="sub">لا شيء</span>
                            : <Tag tone="warn"><Num>{queue.length}</Num> {nounAfter(queue.length, NOUN.activity)}</Tag>,
                        },
                        {
                          k: 'متعثّر',
                          v: stuck.length === 0
                            ? <span className="sub">لا شيء</span>
                            : <Tag tone="no"><Num>{stuck.length}</Num> {nounAfter(stuck.length, NOUN.activity)}</Tag>,
                        },
                        {
                          k: 'تجاوز موعده ولم يُقبل',
                          v: late.length === 0
                            ? <span className="sub">لا شيء</span>
                            : <Tag tone={TONE.late}><Num>{late.length}</Num> {nounAfter(late.length, NOUN.activity)}</Tag>,
                        },
                      ]}
                    />

                    {/* Note: this sentence is the whole module in one line - the gap between the
                        two numbers isn't a display detail, it's pending work. */}
                    {claim > done && (
                      <p className="sub cnote">
                        الفرق بين المُعلَن والمقبول{' '}
                        <span className="num">{claim - done}</span> نقطة · وهي أنشطة
                        أعلنت الجهة اكتمالها ولم تُراجع بعد، ولا تُحتسب إنجازًا
                        قبل القبول{/* doc rule 14 */}.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="sub cnote">
                    يبدأ القياس من تثبيت النسخة المرجعية، فقبلها لا يوجد مرجع
                    يُقاس عليه الانحراف، وتصبح النسبة مجرد تقدير.
                  </p>
                )}
              </Glass>

              {/* === Phases and activities === */}
              <Glass>
                <Head
                  title="المراحل والأنشطة"
                  meta={
                    <span className="sub">
                      <Num>{p.phases.length}</Num> {nounAfter(p.phases.length, NOUN.phase)} ·{' '}
                      <Num>{p.phases.reduce((s, ph) => s + ph.activities.length, 0)}</Num> {nounAfter(p.phases.reduce((s, ph) => s + ph.activities.length, 0), NOUN.activity)} ·{' '}
                      <Money sm>{cost}</Money>
                    </span>
                  }
                />

                {p.phases.length === 0 ? (
                  <Empty
                    title="الخطة بلا مراحل."
                    note="المرحلة هي وحدة القياس، ومن دونها لا يُحتسب أي إنجاز."
                  />
                ) : (
                  <PhaseTree
                    phases={p.phases}
                    live={live}
                    canReview={!asEntity && role.key === 'supervisor'}
                    canClaim={asEntity}
                    onClaim={(actId) => { claimActivityBy(p.id, actId, who); setTick((x) => x + 1) }}
                    /* A real file picker · the evidence row knows its kind, and a replaced file
                       stays in the activity's log (12.2.20 · 12.4.19) */
                    onUpload={(actId, kind, fileName, replace) => { uploadEvidence(p.id, actId, kind, fileName, who, replace); setTick((x) => x + 1) }}
                    onDrop={(actId, evId) => { dropEvidence(p.id, actId, evId, who); setTick((x) => x + 1) }}
                    onStart={(actId) => { startActivity(p.id, actId, who); setTick((x) => x + 1) }}
                    onData={(actId, d) => { const e = saveActivityData(p.id, actId, d, who); setTick((x) => x + 1); return e }}
                    open={shown}
                    focus={focus}
                    onToggle={(phId) => setOpen(() => {
                      const next = new Set(shown)
                      if (next.has(phId)) next.delete(phId)
                      else next.add(phId)
                      return next
                    })}
                    onAccept={(actId) => { acceptActivityBy(p.id, actId, user.name); setTick((x) => x + 1) }}
                    onReject={(actId) => setReject({ id: actId, note: '' })}
                    /* The entity comments under its own name, the institution under the signed-in
                       user's. */
                    me={asEntity ? p.entityName : user.name}
                    onComment={(actId, say) => {
                      commentOn(p.id, actId, say, who, asEntity ? 'entity' : 'staff')
                      setTick((x) => x + 1)
                    }}
                  />
                )}

                {/* Note: phase totals against the grant - same discipline as the budget tree and
                    the payment schedule, and it's written below the table since it's a property of
                    the total, not of any single row. */}
                {grant > 0 && (
                  <p className={`sub cnote${cost !== grant ? ' bad' : ''}`}>
                    مجموع تكلفة المراحل <Money sm>{cost}</Money> وقيمة المنحة{' '}
                    <Money sm>{grant}</Money>
                    {cost !== grant
                      ? ' · يجب أن يتساويا قبل الاعتماد.'
                      : ' · متطابقان.'}
                  </p>
                )}
              </Glass>

              {/* === Substantive amendment requests - rule 21 === */}
              {(p.changes.length > 0 || p.baseline > 0) && (
                <Glass>
                  <Head
                    title="طلبات التعديل الجوهري"
                    meta={p.stage === 'active' && (asEntity || role.key === 'supervisor')
                      ? <Link className="btn btn-2 btn-sm" to={`${ROUTES.planEdit(p.id)}${asEntity ? '?as=entity' : ''}`}>اطلب تعديلًا</Link>
                      : null /* doc rule 21 */}
                  />
                  {p.changes.length === 0 ? (
                    <p className="sub cnote">
                      لا توجد طلبات · أي تعديل على المراحل أو التواريخ أو التكلفة بعد
                      الاعتماد يمرّ من هنا، ويرفع رقم النسخة المرجعية عند
                      اعتماده. ومن دون ذلك يفقد الانحراف مرجعه.
                    </p>
                  ) : (
                    <ul className="plchg">
                      {p.changes.map((c) => (
                        <li key={c.id}>
                          <div className="plchg-h">
                            <Tag tone={c.state === 'approved' ? 'ok' : c.state === 'rejected' ? 'no' : 'warn'}>
                              {c.state === 'approved' ? 'معتمَد' : c.state === 'rejected' ? 'مرفوض' : c.state === 'returned' ? 'أُعيد للاستكمال' : 'بانتظار مدير المنح'}
                            </Tag>
                            <span className="sub">
                              <DateText>{c.at}</DateText> · {c.by}
                            </span>
                          </div>
                          <p className="plchg-t">{isolate(c.say)}</p>
                          {c.note && <p className="sub">{isolate(c.note)}</p>}
                          {c.decidedAt && <p className="sub">قرار {c.decidedBy} · <DateText>{c.decidedAt}</DateText></p>}
                          {c.proposed && <p className="sub">بهيكل مقترح · <Num>{c.proposed.length}</Num> {nounAfter(c.proposed.length, NOUN.phase)}{c.before && <> · حُفظ الهيكل السابق (<Num>{c.before.length}</Num> {nounAfter(c.before.length, NOUN.phase)})</>}</p>}
                          {c.state === 'returned' && (
                            <div className="act-a">
                              <Link className="btn btn-2 btn-sm" to={`${ROUTES.planEdit(p.id)}?change=${c.id}${asEntity ? '&as=entity' : ''}`}>استكمل الطلب وأعد إرساله</Link>
                            </div>
                          )}
                          {c.state === 'waiting' && role.key === 'grants-manager' && !asEntity && (
                            <div className="act-a">
                              <span className="fld"><input value={chNote[c.id] ?? ''} onChange={(e) => setChNote({ ...chNote, [c.id]: e.target.value })} placeholder="ملاحظة القرار · إلزامية" aria-label="ملاحظة قرار التعديل" /></span>
                              {(['approve', 'return', 'reject'] as const).map((o) => (
                                <button key={o} className={`btn ${o === 'approve' ? 'btn-p' : 'btn-2'} btn-sm`} disabled={!(chNote[c.id] ?? '').trim()}
                                  onClick={() => { decideChangeBy(p.id, c.id, o, chNote[c.id] ?? '', user.name); setTick((x) => x + 1) }}>
                                  {o === 'approve' ? 'اعتمد التعديل' : o === 'return' ? 'أعده للاستكمال' : 'ارفض التعديل'}
                                </button>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Glass>
              )}
              {/* The plan decision and what can change · in the main column, the end column is the assistant's alone */}
              {!asEntity && <PlanDecisionCard projectId={p.projectId} approved />}
              {/* Cross · the plan's history · every operation in order, who and when (12.4.30) */}
              {!asEntity && planLogOf(p.id).length > 0 && (
                <Glass>
                  <Head title="سجل الخطة" meta={<span className="sub"><Num>{planLogOf(p.id).length}</Num> عملية · لا يُعدَّل</span>} />
                  <ul className="xs-notes">
                    {planLogOf(p.id).slice(0, 12).map((e, i) => (
                      <li key={`${e.at}-${i}`}>
                        <b>{e.what}</b>
                        <span className="sub">{e.by} · <DateText>{e.at.slice(0, 10)}</DateText>{e.note ? ` · ${e.note}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}
              <EditableCard module="plan" state={p.stage} label={planStageLabel(p.stage)} />
            </div>

            {/* Side column - one sticky card, like the project page. */}
            <div className="col aiside" ref={aside}>
              <AnalysisCard
                title="قراءة الخطة"
                cta="اقرأ الخطة"
                empty="لا توجد ملاحظات على هذه الخطة الآن."
                readings={readings}
                onAsk={() => window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
                )}
              />
            </div>
          </div>

          {/* Note: the rule is documented on the screen, not only in a comment - this is the most
              confusing thing to see: a plan "in progress" whose project sits at an entirely
              different stage. */}
          <p className="sub tcen">
            مرحلة الخطة لا تغيّر حالة المشروع ·{' '}
            <Link to={ROUTES.project(p.projectId)} className="lnk">{p.projectName}</Link>{' '}
            في «{pr?.stage ?? ''}» والخطة في «{planStageLabel(p.stage)}»، وكلاهما صحيح.
            {readyToClose(p) && ' وكل أنشطة الخطة قُبلت، فالمشروع مؤهَّل للإغلاق.'}
            {issues.length > 0 && !live && (
              <> · وتوجد <span className="num">{issues.length}</span> ملاحظة تمنع الإرسال.</>
            )}
          </p>
        </div>

        {/* === Return an activity - modal ===
            Note: a modal, not a field next to the button. The note is required and the button stays
            locked without it - a small field in the activity row would make the tree shift under
            the user's hand as they type. Same modal shape as the budget line item exactly (`.bmask`
            + `.chrome.modal`). */}
        {reject && (
          <div className="bmask" role="presentation" onClick={() => setReject(null)}>
            <div
              className="chrome modal"
              role="dialog"
              aria-modal="true"
              aria-label="إعادة النشاط إلى الجهة"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mh">
                <Icon name={icons.chat} size="md" />
                <b>إعادة النشاط إلى الجهة</b>
              </div>

              <div className="mb col">
                {/* Note: rule 14 returns it as "rejected", not "not started" - so the entity knows
                    work was done and needs correcting, not redone from scratch. */}
                <p className="sub cnote">
                  تصل الملاحظة إلى الجهة مع النشاط، ويعود النشاط بحالة
                  «مرفوض · بملاحظة» لا «لم يبدأ».
                </p>
                <label className="regf">
                  <span className="lb">
                    سبب الإعادة<b className="regf-r" aria-label="إلزامي">*</b>
                  </span>
                  <span className="fld">
                    <input
                      autoFocus
                      value={reject.note}
                      onChange={(e) => setReject({ ...reject, note: e.target.value })}
                      aria-label="سبب الإعادة"
                      placeholder="مثال: التقرير لا يتضمن كشف المستفيدين"
                    />
                  </span>
                </label>
              </div>

              <div className="mf">
                <button
                  className="btn btn-p"
                  disabled={!reject.note.trim()}
                  onClick={() => {
                    rejectActivityBy(p.id, reject.id, reject.note.trim(), user.name)
                    setReject(null)
                    setTick((x) => x + 1)
                  }}
                >
                  أعد النشاط
                </button>
                <button className="btn btn-2" onClick={() => setReject(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* Note: the decision dock belongs to the institution alone - the entity has no approval
            decision; its actions live on the activity itself, in the tree. */}
        {(!asEntity || actions.length > 0) && (
        <PlanActionDock
          user={asEntity ? { ...user, name: p.entityName } : user}
          plan={p}
          grant={grant}
          actions={actions}
          note={note}
          onNote={setNote}
          onTake={take}
          onReview={() => {
            const a = queue[0]
            if (!a) return
            setFocus(a.id)
            document.getElementById(`act-${a.id}`)?.scrollIntoView({ block: 'center' })
          }}
        />
        )}
      </div>
    </AppLayout>
  )
}
