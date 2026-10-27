import { NextStep } from '@/components/assistant/NextStep'
import { suggestNext } from '@/data/shared/agent'
import { Related } from '@/components/related/Related'
import { mayApprovePlan } from '@/data/plans/auth'
import { useMemo, useRef, useState } from 'react'
import { forecastPlan } from '@/data/shared/ai'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TONE } from '@/lib/tone'
import { ButtonLink, FormField, FieldBox, Modal, ModalHead, Button, DockActions,
  BackTo, DateText, Empty, Glass, Head, KV, Money, Mono, Num, StepArc, Tabs, Tag,
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
  planCounts, planExecution, planSpi, planStageLabel, planStageWho, spiSay,
  waitingReview } from '@/data/mock/plans'
import {
  acceptActivityBy, claimActivityBy, commentOn, saveActivityData, decideChangeBy, dropEvidence, mayDraft, projectWindow,
  rejectActivityBy, reviewPlan, sendPlanFor, startActivity, stuckActivities, uploadEvidence, usePlans,
  planLogOf, annexAfter, execStop, planGrantOf, planTargetOf, forwardChange, planVersions, diffPhases } from '@/data/plans/store'
import { PlanDecisionCard } from './PlanDecisionCard'
import type { PlanAction } from './PlanActionDock'
import { projectById } from '@/data/mock/projects'
import { planReadings } from './readings'
import { PhaseTree } from './PhaseTree'
import { PlanBar } from './PlanBar'
import { PlanActionDock, planActionsFor } from './PlanActionDock'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { planOutcome, planChangeOutcome } from '@/data/shared/outcome'

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
  const [focus, setFocus] = useState<string | undefined>()
  const [tick, setTick] = useState(0)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [reject, setReject] = useState<{ id: string; note: string } | null>(null)
  /* #37 · the plan card's two tabs · the active version, then the cancelled versions and the requests */
  /* a request waiting on the supervisor or the grants manager opens the requests tab · that's where their step is */
  const [pane, setPane] = useState<'active' | 'history'>(() => {
    const ch = p?.changes ?? []
    const waiting = ch.some((c) => c.state === 'waiting' || c.state === 'toAgreement')
    const back = ch.some((c) => c.state === 'returned' && (c.from ?? 'entity') === 'entity')
    return (waiting && !asEntity) || (back && asEntity) ? 'history' : 'active'
  })
  const [cmp, setCmp] = useState<string | null>(null)

  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 320 })

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
                actions={
                  <Button variant="2" onClick={() => navigate(ROUTES.plans)}>
                    العودة إلى صندوق الخطط
                  </Button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const pr = projectById(p.projectId)
  /* client 18 Oct (#32) · a portfolio's plan · its value and its page are the portfolio's */
  const pfT = planTargetOf(p.projectId)
  const grant = planGrantOf(p.projectId)
  const done = planDone(p)
  const claim = planClaimed(p)
  const want = planPlanned(p)
  const spi = planSpi(p)
  const say = spiSay(spi)
  const queue = waitingReview(p)
  const late = lateActivities(p)
  const issues = planIssues(p, grant)
  const live = p.stage === 'active' || p.stage === 'done'
  const actions = planActionsFor(role.key, p.stage, asEntity, user.name)
  const stuck = stuckActivities(p)
  const win = projectWindow(p.projectId)
  const who = asEntity ? p.entityName : user.name
  const canDraft = mayDraft(p, asEntity) || (!asEntity && role.key === 'supervisor' && (p.stage === 'draft' || p.stage === 'returned'))
  const cost = p.phases.reduce((s, ph) => s + ph.cost, 0)
  /* #36 · who may ask to change or cancel an approved plan · the entity, the supervisor, the manager */
  const mayAsk = p.baseline > 0 && p.stage === 'active' && (asEntity || role.key === 'supervisor' || mayApprovePlan(role.key, user.name))
  const versions = planVersions(p)
  const oldVersions = versions.filter((v) => v.state === 'cancelled' && v.change)

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
              ? <>نسبة اكتمال المشروع <b>{pct(done)}</b> مقابل المخطَّط <b>{pct(want)}</b></>
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
      ? <>نسبة اكتمال المشروع <b className="num">{pct(done)}</b> · المخطَّط <b className="num">{pct(want)}</b></>
      : null,
    p.baseline > 0
      ? <>النسخة المرجعية <b className="num">{ver(p.baseline)}</b></>
      : null,
  ]

  const take = (x: PlanAction, n?: string) => {
    if (x.key === 'send') sendPlanFor(p.id, asEntity ? 'entity' : 'supervisor', who)
    else if (x.key === 'approve' || x.key === 'toManager' || x.key === 'returnEntity' || x.key === 'managerReturn') reviewPlan(p.id, x.key, (n ?? note).trim(), who, role.key)
    setNote('')
    setSaid(`سُجّل: ${x.label}`)
    setTick((t) => t + 1)
  }

  /* 17 Oct · the assistant suggests · the plan's own checks decide · a gated exit needs a clean plan */
  const nextPlan = suggestNext(actions, {
    issues: issues.map((x) => x.say),
    stops: (x) => (x.gated && issues.length ? ['الخطة فيها مخالفات'] : []),
    good: [`${p.phases.length} مراحل بأنشطتها`, cost <= grant ? 'التكلفة ضمن قيمة المنحة' : ''],
  })
  const nextExec = (x: PlanAction, n: string) => {
    const out = x.key === 'send' ? (sendPlanFor(p.id, 'supervisor', who) ?? []) : reviewPlan(p.id, x.key, n, who, role.key)
    if (!out?.length) { setNote(''); setTick((t) => t + 1) }
    return out ?? []
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
                    {p.baselineAt && <>من <DateText>{p.baselineAt}</DateText></>}
                    {p.approvedBy && <> · اعتمدها {p.approvedBy}{p.approvedAs ? ` (${p.approvedAs})` : ''}</>}</>
                  : 'لم تُعتمد بعد'}
              </p>
              {pfT
                ? <p className="sub mt-2">خطة محفظة · {asEntity ? p.projectName : <Link className="lnk" to={ROUTES.portfolio(pfT.id)}>{p.projectName}</Link>} · {p.entityName}</p>
                : <Related plain={asEntity} links={[{ kind: 'project', id: p.projectId, label: p.projectName }, { kind: 'entity', id: p.entityId, label: p.entityName }]} />}
              <div className="gt-tag rowf gp-2">
                <Tag tone="mute">{planStageLabel(p.stage)}</Tag>
                {/* Client sheet 24 Oct (#95) · the plan's outcome once it ends */}
                <OutcomeTag outcome={planOutcome(p.stage)} />
              </div>

              {(pr || pfT) && (
                <div className="pamt">
                  <div className="lb">{pfT ? 'قيمة المحفظة' : 'قيمة المنحة'}</div>
                  <div className="v"><Money sm>{grant || pr?.amountRequested || 0}</Money></div>
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
          {/* re-audit 17 Oct · 12.2.12 · an approved plan waits for its agreement before it runs */}
          {p.stage === 'active' && execStop(p.id) && <p className="sub cnote tcen">{execStop(p.id)}</p>}

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
              <Head title={p.stage === 'returned' ? 'الخطة مُعادة للتعديل' : 'مسودة الخطة'} meta={<ButtonLink variant="p" size="sm" to={`${ROUTES.planEdit(p.id)}${asEntity ? '?as=entity' : ''}`}>{p.stage === 'returned' ? 'عدّل الخطة' : 'حرّر الخطة'}</ButtonLink>} />
              {p.note && <p className="sub cnote">{isolate(p.note)}</p>}
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
                    : <span className="sub">لم تبدأ</span>}
                />

                {live && (
                  <>
                    {/* Note: the number with its two reference points - SPI alone is a verdict with
                        no basis. */}
                    <PlanBar done={done} claim={claim} want={want} />

                    <KV
                      rows={[
                        {
                          /* Client sheet 24 Oct (#96) · accepted activities ÷ all activities */
                          k: 'نسبة اكتمال المشروع',
                          v: <span><span className="num">{pct(done)}</span>
                            <span className="sub"> · {(() => { const c = planCounts(p); return `${nf.format(c.accepted)} مقبولة من ${nf.format(c.total)} ${nounAfter(c.total, NOUN.activity)}` })()}</span></span>,
                        },
                        {
                          /* Client sheet 24 Oct (#97) */
                          k: 'نسبة تنفيذ المشروع',
                          v: spi === null
                            ? <span className="sub">لم يحن موعد أي نشاط بعد</span>
                            : <span className={spi < 0.8 ? 'bad' : undefined}>
                              <span className="num">{pct(Math.round(spi * 100))}</span>
                              <span className="sub"> · {(() => { const e = planExecution(p); return `${nf.format(e.accepted)} مقبولة من ${nf.format(e.due)} ${nounAfter(e.due, NOUN.activity)} حلّ موعدها` })()} · {say.say}</span>
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

                  </>
                )}
              </Glass>

            </div>

            {/* Side column - one sticky card, like the project page. */}
            <div className="col aiside" ref={aside}>
              <AnalysisCard
                suggest={!asEntity && actions.length > 0 ? <NextStep s={nextPlan} exec={nextExec} /> : undefined}
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
          {/* client 20 Oct (#31) · the activity table runs the full width · ten columns beside the reading column were cut */}
          {/* === Phases and activities · client 20 Oct (#36 · #37) ===
              One card, two tabs: the active version of the plan, and everything that came
              before it · the versions an approved change cancelled and the requests on the plan.
              Only one version is ever active. The requests to change or cancel the plan start
              from the card's head, for the entity, the supervisor and the manager. */}
          <Glass>
            <Head
              title="المراحل والأنشطة"
              meta={
                <span className="rowf gp-2">
                  <span className="sub">
                    {p.baseline > 0 && <>النسخة <Num>{ver(p.baseline)}</Num> · </>}
                    <Num>{p.phases.length}</Num> {nounAfter(p.phases.length, NOUN.phase)} ·{' '}
                    <Num>{p.phases.reduce((s, ph) => s + ph.activities.length, 0)}</Num> {nounAfter(p.phases.reduce((s, ph) => s + ph.activities.length, 0), NOUN.activity)} ·{' '}
                    <Money sm>{cost}</Money>
                  </span>
                  {mayAsk && <ButtonLink variant="2" size="sm" to={`${ROUTES.planEdit(p.id)}?mode=change${asEntity ? '&as=entity' : ''}`}>طلب تعديل الخطة</ButtonLink>}
                  {mayAsk && <ButtonLink variant="ghost" size="sm" to={`${ROUTES.planEdit(p.id)}?mode=cancel${asEntity ? '&as=entity' : ''}`}>طلب إلغاء الخطة</ButtonLink>}
                </span>
              }
            />
            {(p.baseline > 0 || p.changes.length > 0) && (
              <Tabs
                pin={false}
                items={[
                  { slug: 'active', label: p.stage === 'cancelled' ? 'الخطة' : 'الخطة النشطة' },
                  { slug: 'history', label: 'الملغاة وطلبات التعديل', count: oldVersions.length + p.changes.length },
                ]}
                active={pane}
                onChange={(x) => setPane(x === 'history' ? 'history' : 'active')}
              />
            )}

            {pane === 'active' ? (<>
            {p.phases.length === 0 ? (
              <Empty
                title="الخطة بلا مراحل."
              />
            ) : (
              <PhaseTree
                planId={p.id}
                phases={p.phases}
                live={live}
                canReview={!asEntity && role.key === 'supervisor'}
                canClaim={asEntity}
                onClaim={(actId) => { const e = claimActivityBy(p.id, actId, who); if (e.length) setSaid(e[0]!); setTick((x) => x + 1) }}
                /* A real file picker · the evidence row knows its kind, and a replaced file
                   stays in the activity's log (12.2.20 · 12.4.19) */
                onUpload={(actId, kind, fileName, replace) => { uploadEvidence(p.id, actId, kind, fileName, who, replace); setTick((x) => x + 1) }}
                onDrop={(actId, evId) => { dropEvidence(p.id, actId, evId, who); setTick((x) => x + 1) }}
                onStart={(actId) => { const e = startActivity(p.id, actId, who); if (e.length) setSaid(e[0]!); setTick((x) => x + 1) }}
                onData={(actId, d) => { const e = saveActivityData(p.id, actId, d, who); setTick((x) => x + 1); return e }}
                open={shown}
                focus={focus}
                onToggle={(phId) => setOpen(() => {
                  const next = new Set(shown)
                  if (next.has(phId)) next.delete(phId)
                  else next.add(phId)
                  return next
                })}
                onAccept={(actId) => { const e = acceptActivityBy(p.id, actId, user.name); if (e.length) setSaid(e[0]!); setTick((x) => x + 1) }}
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

            {/* Client 26 Oct · guidance lines removed · the mismatch alone stays, it blocks approval */}
            {grant > 0 && cost !== grant && (
              <p className="bad cnote">
                مجموع تكلفة المراحل <Money sm>{cost}</Money> لا يساوي قيمة المنحة <Money sm>{grant}</Money>
              </p>
            )}
            </>) : (
              <>
                <h4 className="fnd-h">النسخ الملغاة</h4>
                {oldVersions.length === 0 ? (
                  <p className="sub cnote">لا توجد نسخ ملغاة.</p>
                ) : (
                  <ul className="plver">
                    {oldVersions.map((v) => {
                      const next = versions.find((x) => x.no === v.no + 1) ?? versions[0]
                      const diff = cmp === `v${v.no}` && next ? diffPhases(v.phases, next.phases) : []
                      return (
                        <li key={`v${v.no}-${v.change ?? ''}`}>
                          <div className="plver-h">
                            <b>النسخة <Num>{ver(v.no)}</Num></b>
                            <Tag tone="no">ملغاة</Tag>
                            {v.at && <span className="sub">أُلغيت <DateText>{v.at}</DateText>{v.by ? ` · ${v.by}` : ''}</span>}
                            <span className="pc-sp" />
                            <span className="sub"><Num>{v.phases.reduce((n, ph) => n + ph.activities.length, 0)}</Num> {nounAfter(v.phases.reduce((n, ph) => n + ph.activities.length, 0), NOUN.activity)}</span>
                            {next && (
                              <Button type="button" variant="ghost" size="sm" aria-expanded={cmp === `v${v.no}`} onClick={() => setCmp(cmp === `v${v.no}` ? null : `v${v.no}`)}>
                                {cmp === `v${v.no}` ? 'أخفِ المقارنة' : `قارن بالنسخة ${ver(next.no)}`}
                              </Button>
                            )}
                          </div>
                          {cmp === `v${v.no}` && (diff.length === 0
                            ? <p className="sub">لا فرق في الأنشطة بين النسختين · الفرق في المراحل أو التكلفة</p>
                            : (
                              <ul className="pldiff">
                                {diff.map((d, i) => (
                                  <li key={i}><b>{d.name}</b><span className="sub">{d.say.map((x) => isolate(x)).join(' · ')}</span></li>
                                ))}
                              </ul>
                            ))}
                        </li>
                      )
                    })}
                  </ul>
                )}

                <h4 className="fnd-h">طلبات التعديل والإلغاء</h4>
                {p.changes.length === 0 ? (
                  <p className="sub cnote">لا توجد طلبات.</p>
                ) : (
                  <ul className="plchg">
                    {[...p.changes].reverse().map((c) => {
                      const atSup = c.state === 'waiting' && c.step === 'supervisor'
                      const atMgr = (c.state === 'waiting' || c.state === 'toAgreement') && c.step !== 'supervisor'
                      return (
                        <li key={c.id}>
                          <div className="plchg-h">
                            <Tag tone={c.mode === 'cancel' ? 'no' : 'mute'}>{c.mode === 'cancel' ? 'طلب إلغاء' : 'طلب تعديل'}</Tag>
                            {/* Client sheet 24 Oct (#95) · a decided request reads its outcome (مكتمل · مرفوض) */}
                            {planChangeOutcome(c.state)
                              ? <><OutcomeTag outcome={planChangeOutcome(c.state)} />{c.state === 'approved' && <span className="sub">معتمَد</span>}</>
                              : (
                                <Tag tone="warn">
                                  {c.state === 'returned' ? 'أُعيد للاستكمال' : c.state === 'toAgreement' ? 'بانتظار ملحق الاتفاقية' : atSup ? 'بانتظار مشرف المنح' : 'بانتظار مدير المنح'}
                                </Tag>
                              )}
                            <span className="sub"><DateText>{c.at}</DateText> · {c.by}</span>
                            {c.state === 'approved' && c.toVersion && <span className="sub">ألغى النسخة <Num>{ver(c.fromVersion ?? c.toVersion - 1)}</Num> وأنشأ <Num>{ver(c.toVersion)}</Num></span>}
                          </div>
                          <p className="plchg-t">{isolate(c.say)}</p>
                          {c.why && <p className="sub">المبررات: {isolate(c.why)}</p>}
                          {c.note && <p className="sub">{isolate(c.note)}</p>}
                          {c.decidedAt && <p className="sub">قرار {c.decidedBy} · <DateText>{c.decidedAt}</DateText></p>}
                          {c.proposed && <p className="sub">بهيكل مقترح · <Num>{c.proposed.length}</Num> {nounAfter(c.proposed.length, NOUN.phase)}{c.before && <> · حُفظ الهيكل السابق (<Num>{c.before.length}</Num> {nounAfter(c.before.length, NOUN.phase)})</>}</p>}
                          {c.proposed && c.state !== 'approved' && (() => {
                            const d = diffPhases(p.phases, c.proposed)
                            return d.length > 0 && (
                              <ul className="pldiff">
                                {d.slice(0, 6).map((x, i) => <li key={i}><b>{x.name}</b><span className="sub">{x.say.map((y) => isolate(y)).join(' · ')}</span></li>)}
                                {d.length > 6 && <li className="sub">و<Num>{d.length - 6}</Num> تغييرات أخرى</li>}
                              </ul>
                            )
                          })()}
                          {c.state === 'returned' && (asEntity || c.from !== 'entity') && (
                            <div className="act-a">
                              <ButtonLink variant="2" size="sm" to={`${ROUTES.planEdit(p.id)}?change=${c.id}&mode=${c.mode ?? 'change'}${asEntity ? '&as=entity' : ''}`}>استكمل الطلب وأعد إرساله</ButtonLink>
                            </div>
                          )}
                          {/* v3 · 12.4.15 · operational changes are made in the plan · contractual ones go to the agreement */}
                          {c.kind && c.mode !== 'cancel' && <p className="sub"><Tag tone={c.kind === 'contractual' ? 'warn' : 'mute'}>{c.kind === 'contractual' ? 'تغيير تعاقدي' : 'تغيير تشغيلي'}</Tag>{c.contractual?.length ? <> · {c.contractual.join(' · ')}</> : null}</p>}
                          {c.state === 'toAgreement' && <p className="sub">أُحيل لملحق تعديلي في الاتفاقية{annexAfter(p.projectId, c.at) ? ' · اعتُمد الملحق' : ''}</p>}
                          {/* #36 · the supervisor's step on the entity's request */}
                          {atSup && !asEntity && role.key === 'supervisor' && (
                            <div className="act-a">
                              {/* Client 26 Oct · the note in the decision's popup */}
                              <DockActions
                                actions={[
                                  { label: 'أعده للجهة', kind: 'btn-2 btn-sm', needsNote: true, to: 'returnEntity' as const },
                                  { label: 'ارفعه لمدير المنح', kind: 'btn-p btn-sm', to: 'toManager' as const },
                                ]}
                                subject={<>{c.mode === 'cancel' ? 'طلب إلغاء الخطة' : 'طلب تعديل الخطة'} · {p.projectName}</>}
                                placeholder="ما يلزم الجهة استكماله"
                                onRun={(a, n) => { const w = forwardChange(p.id, c.id, a.to, n, user.name, role.key); setTick((x) => x + 1); return w }}
                              />
                            </div>
                          )}
                          {atMgr && mayApprovePlan(role.key, user.name) && !asEntity && (
                            <div className="act-a">
                              {/* Client 26 Oct · the decision's note (required) in its popup */}
                              <DockActions
                                actions={([...(c.kind === 'contractual' && c.mode !== 'cancel' && c.state === 'waiting' ? ['toAgreement'] as const : []), 'approve', 'return', 'reject'] as const).map((o) => {
                                  const blocked = o === 'approve' && c.kind === 'contractual' && c.mode !== 'cancel' && !annexAfter(p.projectId, c.at)
                                  return {
                                    o, needsNote: true, kind: `${o === 'approve' || o === 'toAgreement' ? 'btn-p' : o === 'reject' ? 'btn-d' : 'btn-2'} btn-sm`,
                                    stops: blocked ? ['يُعدَّل أولًا بملحق في الاتفاقية'] : [],
                                    label: o === 'approve' ? (c.mode === 'cancel' ? 'اعتمد الإلغاء' : 'اعتمد التعديل') : o === 'toAgreement' ? 'أحله لملحق الاتفاقية' : o === 'return' ? 'أعده للاستكمال' : 'ارفض الطلب',
                                  }
                                })}
                                subject={<>{c.mode === 'cancel' ? 'طلب إلغاء الخطة' : 'طلب تعديل الخطة'} · {p.projectName}</>}
                                placeholder="ملاحظة القرار · تُسجَّل في سجل الخطة"
                                onRun={(a, n) => { const w = decideChangeBy(p.id, c.id, a.o, n, user.name, role.key); setTick((x) => x + 1); return w }}
                              />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </Glass>
          {/* The plan decision and what can change · in the main column, the end column is the assistant's alone */}
          {!asEntity && !pfT && <PlanDecisionCard projectId={p.projectId} approved />}
          {/* Cross · the plan's history · every operation in order, who and when (12.4.30) */}
          {!asEntity && planLogOf(p.id).length > 0 && (
            <Glass>
              <Head title="سجل الخطة" meta={<span className="sub"><Num>{planLogOf(p.id).length}</Num> عملية</span>} />
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

        </div>

        {/* === Return an activity - modal ===
            Note: a modal, not a field next to the button. The note is required and the button stays
            locked without it - a small field in the activity row would make the tree shift under
            the user's hand as they type. Same modal shape as the budget line item exactly (`.bmask`
            + `.chrome.modal`). */}
        {reject && (
          <Modal label="إعادة النشاط إلى الجهة" onClose={() => setReject(null)}>
              <ModalHead icon={icons.chat} title="إعادة النشاط إلى الجهة" />

              <div className="mb col">
                <FormField label="سبب الإعادة" required>
                  <FieldBox>
                    <input
                      autoFocus
                      value={reject.note}
                      onChange={(e) => setReject({ ...reject, note: e.target.value })}
                      aria-label="سبب الإعادة"
                      placeholder="مثال: التقرير لا يتضمن كشف المستفيدين"
                    />
                  </FieldBox>
                </FormField>
              </div>

              <div className="mf">
                <Button
                  variant="p"
                  disabled={!reject.note.trim()}
                  onClick={() => {
                    const e = rejectActivityBy(p.id, reject.id, reject.note.trim(), user.name)
                    if (e.length) setSaid(e[0]!)
                    setReject(null)
                    setTick((x) => x + 1)
                  }}
                >
                  أعد النشاط
                </Button>
                <Button variant="2" onClick={() => setReject(null)}>إلغاء</Button>
              </div>
            </Modal>
        )}

        {/* Note: the decision dock belongs to the institution alone - the entity has no approval
            decision; its actions live on the activity itself, in the tree. */}
        {(!asEntity || actions.length > 0) && (
        <PlanActionDock
          user={asEntity ? { ...user, name: p.entityName } : user}
          plan={p}
          grant={grant}
          actions={actions}
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
