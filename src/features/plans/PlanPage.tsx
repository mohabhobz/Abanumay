import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TONE } from '@/lib/tone'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, KV, Money, Mono, Num, Steps, Tag,
  icons, type StepItem,
} from '@/components/ui'
import { AnalysisCard } from '@/components/assistant/AnalysisCard'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { useFillHeight } from '@/hooks/useFillHeight'
import { assistFor } from '@/data/mock/assistant'
import { isolate, NOUN, nounAfter, ver } from '@/lib/format'
import {
  PLAN_STAGES, acceptActivity, approvePlan, decideChange, lateActivities,
  addEvidence, claimActivity, commentActivity, planById, planClaimed, planDone, planIssues, planPlanned,
  planSpi, planStageLabel, readyToClose, rejectActivity, returnPlan, sendPlan, spiSay,
  toManager, waitingReview,
} from '@/data/mock/plans'
import { projectById } from '@/data/mock/projects'
import { planReadings } from './readings'
import { PhaseTree } from './PhaseTree'
import { PlanBar } from './PlanBar'
import { PlanActionDock, planActionsFor } from './PlanActionDock'

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
  /* Note: the same screen through two lenses, not two screens. The entity and the supervisor look at
   the same phases, activities and evidence - what differs is the actions: the entity marks things
   done and uploads, the supervisor accepts or rejects. Two separate screens would have drifted
   apart at the first edit, which is what happened before on the registration flow. */
  const asEntity = params.get('as') === 'entity'
  const p = planById(id)
  const [note, setNote] = useState('')
  const [taken, setTaken] = useState<string | null>(null)
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
    () => (p ? planReadings(p, (actId) => {
      setFocus(actId)
      document.getElementById(`act-${actId}`)?.scrollIntoView({ block: 'center' })
    }) : []),
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
  const actions = asEntity ? [] : planActionsFor(role.key, p.stage)
  const cost = p.phases.reduce((s, ph) => s + ph.cost, 0)

  /* Note: the journey's stages come from the spec, not from screen states - and "completed" is its
   own stage since it's what lifts the block on closing. */
  const steps: StepItem[] = PLAN_STAGES
    .filter((s) => s.key !== 'returned')
    /* Note: deliberately no `note` on the stepper. The stepper is a row that compresses, and a note
   line under each step would turn five stages into two crowded lines - the explanation lives on the
   screen itself. The note is for the vertical ladder instead. */
    .map((s) => ({
      label: s.label,
      state: s.key === p.stage
        ? 'now'
        : PLAN_STAGES.findIndex((x) => x.key === s.key)
          < PLAN_STAGES.findIndex((x) => x.key === p.stage)
          ? 'done' : 'todo',
    }))

  const take = (label: string) => {
    if (label.includes('إرسال لمراجعة')) sendPlan(p.id)
    else if (label.includes('إحالة لمدير')) toManager(p.id)
    else if (label.includes('تثبيت النسخة')) approvePlan(p.id)
    else if (label.includes('إعادة للجهة')) returnPlan(p.id, note)
    setTaken(label)
    setTick((x) => x + 1)
  }

  return (
    <AppLayout assistantContext={assistFor.page(`خطة ${p.projectName}`)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />

          <header>
            <div>
              <h1 className="ptitle">خطة {p.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{p.id}</Mono> ·{' '}
                <Link to={ROUTES.entity(p.entityId)} className="tlink">{p.entityName}</Link> ·{' '}
                {p.baseline > 0
                  ? <>النسخة المرجعية <Num>{ver(p.baseline)}</Num>{' '}
                    {p.baselineAt && <>من <DateText>{p.baselineAt}</DateText></>}</>
                  : 'لم تُعتمد بعد · الهيكل مفتوح للتعديل'}
              </p>
            </div>
            <Tag tone="mute">{planStageLabel(p.stage)}</Tag>
          </header>

          {/* Note: the entity needs to know that "done" isn't "counted". This is the biggest possible
   misunderstanding on this screen: the entity uploads evidence, marks it done, and assumes the
   percentage went up - but rule 14 says it doesn't rise until the supervisor accepts it. The
   sentence is stated up top, not left to be inferred from a small badge next to the activity. */}
          {asEntity && (
            <Glass>
              <Head
                title="صفحة خطة الجهة"
                meta={<Tag tone="mute">الجهة المستفيدة</Tag>}
              />
              <p className="sub cnote">
                ترفع الجهة الشواهد وتعلن اكتمال النشاط، فيتحوّل إلى
                «بانتظار قبول المشرف»، ولا يُحتسب في نسبة الإنجاز قبل أن
                يراجعه مشرف المنح ويقبله (القاعدة <span className="num">14</span>).
                وإن أُعيد النشاط، يظهر سبب الإعادة مكتوبًا تحته.
              </p>
            </Glass>
          )}

          <Glass className="regsteps">
            <Steps flow="stepper" items={steps} />
          </Glass>

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
                    {/* Note: the number with its two reference points - SPI alone is a verdict with no basis. */}
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
                          k: 'تجاوز موعده ولم يُقبل',
                          v: late.length === 0
                            ? <span className="sub">لا شيء</span>
                            : <Tag tone={TONE.late}><Num>{late.length}</Num> {nounAfter(late.length, NOUN.activity)}</Tag>,
                        },
                      ]}
                    />

                    {/* Note: this sentence is the whole module in one line - the gap between the two numbers isn't a
   display detail, it's pending work. */}
                    {claim > done && (
                      <p className="sub cnote">
                        الفرق بين المُعلَن والمقبول{' '}
                        <span className="num">{claim - done}</span> نقطة · وهي أنشطة
                        أعلنت الجهة اكتمالها ولم تُراجع بعد، ولا تُحتسب إنجازًا
                        قبل القبول (القاعدة <span className="num">14</span>).
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
                    onClaim={(actId) => { claimActivity(p.id, actId); setTick((x) => x + 1) }}
                    /* Note: the file name is generated in the demo. In the real system this is an actual file picker,
   and its validation is the same as the registration attachment check (`docAdvice`). */
                    onUpload={(actId, kind) => {
                      addEvidence(p.id, actId, kind, `${kind.replace(/ /g, '-')}.pdf`)
                      setTick((x) => x + 1)
                    }}
                    open={shown}
                    focus={focus}
                    onToggle={(phId) => setOpen(() => {
                      const next = new Set(shown)
                      if (next.has(phId)) next.delete(phId)
                      else next.add(phId)
                      return next
                    })}
                    onAccept={(actId) => { acceptActivity(p.id, actId); setTick((x) => x + 1) }}
                    onReject={(actId) => setReject({ id: actId, note: '' })}
                    /* The entity comments under its own name, the institution under the signed-in user's. */
                    me={asEntity ? p.entityName : user.name}
                    onComment={(actId, say) => {
                      commentActivity(
                        p.id, actId, say,
                        asEntity ? p.entityName : user.name,
                        asEntity ? 'entity' : 'staff',
                      )
                      setTick((x) => x + 1)
                    }}
                  />
                )}

                {/* Note: phase totals against the grant - same discipline as the budget tree and the payment
   schedule, and it's written below the table since it's a property of the total, not of any single
   row. */}
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
                    meta={<Tag tone="mute">قاعدة <Num>21</Num></Tag>}
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
                              {c.state === 'approved' ? 'معتمَد' : c.state === 'rejected' ? 'مرفوض' : 'بانتظار مدير المنح'}
                            </Tag>
                            <span className="sub">
                              <DateText>{c.at}</DateText> · {c.by}
                            </span>
                          </div>
                          <p className="plchg-t">{isolate(c.say)}</p>
                          {c.note && <p className="sub">{isolate(c.note)}</p>}
                          {c.state === 'waiting' && role.key === 'grants-manager' && (
                            <div className="act-a">
                              <button
                                className="btn btn-p btn-sm"
                                onClick={() => {
                                  decideChange(p.id, c.id, true, 'اعتُمد التعديل · ارتفع رقم النسخة المرجعية.')
                                  setTick((x) => x + 1)
                                }}
                              >
                                اعتمد التعديل
                              </button>
                              <button
                                className="btn btn-2 btn-sm"
                                onClick={() => {
                                  decideChange(p.id, c.id, false, 'رُفض التعديل · تُنفَّذ الخطة كما اعتُمدت.')
                                  setTick((x) => x + 1)
                                }}
                              >
                                ارفض التعديل
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Glass>
              )}
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

          {/* Note: the rule is documented on the screen, not only in a comment - this is the most confusing
   thing to see: a plan "in progress" whose project sits at an entirely different stage. */}
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
           locked without it - a small field in the activity row would make the tree shift under the
           user's hand as they type. Same modal shape as the budget line item exactly (`.bmask` +
           `.chrome.modal`). */}
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
                {/* Note: rule 14 returns it as "rejected", not "not started" - so the entity knows work was done and
   needs correcting, not redone from scratch. */}
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
                    rejectActivity(p.id, reject.id, reject.note.trim(), user.name)
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

        {/* Note: the decision dock belongs to the institution alone - the entity has no approval decision;
   its actions live on the activity itself, in the tree. */}
        {!asEntity && (
        <PlanActionDock
          user={user}
          plan={p}
          grant={grant}
          actions={actions}
          note={note}
          onNote={setNote}
          taken={taken}
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
