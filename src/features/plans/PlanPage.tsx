import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import { isolate } from '@/lib/format'
import {
  PLAN_STAGES, PLAN_TONE, acceptActivity, approvePlan, decideChange, lateActivities,
  addEvidence, claimActivity, planById, planClaimed, planDone, planIssues, planPlanned,
  planSpi, planStageLabel, readyToClose, rejectActivity, returnPlan, sendPlan, spiSay,
  toManager, waitingReview,
} from '@/data/mock/plans'
import { projectById } from '@/data/mock/projects'
import { planReadings } from './readings'
import { PhaseTree } from './PhaseTree'
import { PlanBar } from './PlanBar'
import { PlanActionDock, planActionsFor } from './PlanActionDock'

/* ═══════════════════════════════════════════════════════════
   صفحة الخطة · BPD-012

   ⚠️ **الصفحة قسمان: ترويسة + مراحل** · نفس مبدأ ج-9 اللي بيتكرّر
   في كل شاشة في السيستم (الميزانية · الاتفاقية · أمر الصرف).

   ⚠️ **وترويستها بتجاوب سؤالًا واحدًا: ماشية ولا لأ.** مش «إيه
   بياناتها» · البيانات في الجدول تحت. فالترويسة فيها المقارنة:
   المقبول والمُعلَن والمخطَّط لليوم، وأداء الجدول بينهم. والرقم
   اللي مالوش طرفيه بيتقري حكمًا بلا سند، فالتلاتة مع بعض.

   ⚠️ **والمراجعة على النشاط لا على الخطة.** القاعدة 14 بتفصل
   «الجهة قالت» عن «المشرف قبل» · فقرار واحد في رصيف الصفحة كان
   هيقبل كل الشواهد بضغطة، وده اللي القاعدة موجودة تمنعه.
   ═══════════════════════════════════════════════════════════ */

export default function PlanPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { role, user } = useRole()
  /* ⚠️ **نفس الشاشة بعينَين، لا شاشتان.** الجهة والمشرف بيبصّوا على
     نفس المراحل والأنشطة والشواهد · اللي بيفرق هو **الأفعال**:
     الجهة بتقول «خلصت» وبترفع، والمشرف بيقبل ويرفض. شاشتان كانوا
     هيفترقوا مع أول تعديل، وده اللي حصل في مساعد التسجيل قبل كده. */
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

  /* ⚠️ المرحلة اللي فيها شغل بتتفتح لوحدها · المطوي الافتراضي
     صحّ في الجداول (سؤالها «كام») وغلط هنا (سؤالها «أنهي نشاط») */
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
                note="ارجع لصندوق الخطط واختر واحدة."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.plans)}>
                    صندوق الخطط
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

  /* ⚠️ الرحلة محطاتها من الوثيقة لا من حالات الشاشة · والمكتملة
     محطة بذاتها لأنها اللي بترفع مانع الإغلاق */
  const steps: StepItem[] = PLAN_STAGES
    .filter((s) => s.key !== 'returned')
    /* ⚠️ **بلا `note` في الستيبر عن قصد.** الستيبر صفّ بيتضغط،
       والنوتة تحت كل خطوة بتخلّي الخمس محطات سطرين متلاصقين ·
       والشرح موجود في الشاشة نفسها. النوتة للسُلّم الرأسي. */
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
                  ? <>النسخة المرجعية V<span className="num">{p.baseline}</span>{' '}
                    {p.baselineAt && <>من <DateText>{p.baselineAt}</DateText></>}</>
                  : 'لم تُعتمد بعد · الهيكل مفتوح للتعديل'}
              </p>
            </div>
            <Tag tone={PLAN_TONE[p.stage]}>{planStageLabel(p.stage)}</Tag>
          </header>

          {/* ⚠️ **الجهة لازم تعرف إن «خلصت» مش «اتحسبت».** ده أهم
              سوء فهم ممكن في الشاشة دي: الجهة بترفع شاهد وتقول خلص
              فتفتكر إن النسبة زادت · والقاعدة 14 بتقول إنها ما
              بتزيدش قبل ما المشرف يقبل. الجملة مكتوبة فوق، مش
              مستنتَجة من وسم صغير جنب النشاط. */}
          {asEntity && (
            <Glass>
              <Head
                title="أنت في صفحة خطتك"
                meta={<Tag tone="ret">الجهة المستفيدة</Tag>}
              />
              <p className="sub cnote">
                بترفع الشواهد وبتقول إن النشاط خلص · والنشاط بيتحوّل
                «بانتظار قبول المشرف»، وما بيتحسبش في نسبة الإنجاز قبل ما
                مشرف المنح يراجعه ويقبله (القاعدة <span className="num">14</span>).
                ولو رجّعه هتلاقي سبب الإعادة مكتوبًا تحت النشاط.
              </p>
            </Glass>
          )}

          <Glass className="regsteps">
            <Steps flow="stepper" items={steps} />
          </Glass>

          <div className="g2">
            <div className="col">
              {/* ═══ الترويسة · ماشية ولا لأ ═══ */}
              <Glass>
                <Head
                  title="حالة التنفيذ"
                  meta={live
                    ? <Tag tone={say.tone === 'mute' ? 'mute' : say.tone}>{say.say}</Tag>
                    : <span className="sub">تبدأ بعد الاعتماد</span>}
                />

                {live ? (
                  <>
                    {/* ⚠️ الرقم مع طرفيه · SPI لوحده حكم بلا سند */}
                    <PlanBar done={done} claim={claim} want={want} />

                    <KV
                      rows={[
                        {
                          k: 'أداء الجدول · SPI',
                          v: spi === null
                            ? <span className="sub">ما بدأش</span>
                            : <span className={spi < 0.8 ? 'bad' : undefined}>
                              <span className="num">{spi.toFixed(2)}</span>
                              <span className="sub"> · المقبول ÷ المخطَّط</span>
                            </span>,
                        },
                        {
                          k: 'مستنّي مراجعة مشرف المنح',
                          v: queue.length === 0
                            ? <span className="sub">لا شيء</span>
                            : <Tag tone="warn"><Num>{queue.length}</Num> نشاطًا</Tag>,
                        },
                        {
                          k: 'عدّى موعده ولم يُقبل',
                          v: late.length === 0
                            ? <span className="sub">لا شيء</span>
                            : <Tag tone="no"><Num>{late.length}</Num> نشاطًا</Tag>,
                        },
                      ]}
                    />

                    {/* ⚠️ الجملة دي هي كل الموديول في سطر · والفرق
                        بين الرقمين مش تفصيلة عرض، هو شغل واقف */}
                    {claim > done && (
                      <p className="sub cnote">
                        الفرق بين المُعلَن والمقبول{' '}
                        <span className="num">{claim - done}</span> نقطة · دي أنشطة
                        قالت الجهة إنها خلصت ولسه ما اتراجعتش، وما بتتحسبش إنجازًا
                        قبل القبول (القاعدة <span className="num">14</span>).
                      </p>
                    )}
                  </>
                ) : (
                  <p className="sub cnote">
                    القياس بيبدأ من تثبيت النسخة المرجعية · قبلها مفيش مرجع
                    يتقاس عليه الانحراف، والنسبة تبقى رأيًا.
                  </p>
                )}
              </Glass>

              {/* ═══ المراحل والأنشطة ═══ */}
              <Glass>
                <Head
                  title="المراحل والأنشطة"
                  meta={
                    <span className="sub">
                      <Num>{p.phases.length}</Num> مراحل ·{' '}
                      <Num>{p.phases.reduce((s, ph) => s + ph.activities.length, 0)}</Num> نشاطًا ·{' '}
                      <Money sm>{cost}</Money>
                    </span>
                  }
                />

                {p.phases.length === 0 ? (
                  <Empty
                    title="الخطة بلا مراحل."
                    note="المرحلة هي وحدة القياس · من غيرها مفيش إنجاز يتحسب."
                  />
                ) : (
                  <PhaseTree
                    phases={p.phases}
                    live={live}
                    canReview={!asEntity && role.key === 'supervisor'}
                    canClaim={asEntity}
                    onClaim={(actId) => { claimActivity(p.id, actId); setTick((x) => x + 1) }}
                    /* ⚠️ اسم الملف مولَّد في النموذج · في السيستم
                       الحقيقي ده منتقي ملفات، والفحص الشكلي عليه
                       هو نفس فحص مرفقات التسجيل (`docAdvice`). */
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
                  />
                )}

                {/* ⚠️ مجموع المراحل مقابل المنحة · نفس انضباط شجرة
                    الميزانية وجدول الدفعات، ومكتوب تحت الجدول لأنه
                    خاصية للمجموع لا لصفّ */}
                {grant > 0 && (
                  <p className={`sub cnote${cost !== grant ? ' bad' : ''}`}>
                    مجموع تكلفة المراحل <Money sm>{cost}</Money> وقيمة المنحة{' '}
                    <Money sm>{grant}</Money>
                    {cost !== grant
                      ? ' · لازم يتساووا قبل الاعتماد.'
                      : ' · متطابقان.'}
                  </p>
                )}
              </Glass>

              {/* ═══ طلبات التعديل الجوهري · قاعدة 21 ═══ */}
              {(p.changes.length > 0 || p.baseline > 0) && (
                <Glass>
                  <Head
                    title="طلبات التعديل الجوهري"
                    meta={<Tag tone="ret">قاعدة <Num>21</Num></Tag>}
                  />
                  {p.changes.length === 0 ? (
                    <p className="sub cnote">
                      مفيش طلبات · أي تعديل على المراحل أو التواريخ أو التكلفة بعد
                      الاعتماد بيعدّي من هنا، وبيرفع رقم النسخة المرجعية لمّا
                      يتوافق عليه. من غير كده الانحراف ما يبقاش له مرجع.
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
                                  decideChange(p.id, c.id, true, 'موافقة · النسخة المرجعية ارتفعت.')
                                  setTick((x) => x + 1)
                                }}
                              >
                                اعتمد التعديل
                              </button>
                              <button
                                className="btn btn-2 btn-sm"
                                onClick={() => {
                                  decideChange(p.id, c.id, false, 'رفض · الخطة تُنفَّذ كما اعتُمدت.')
                                  setTick((x) => x + 1)
                                }}
                              >
                                ارفض
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

            {/* العمود الجانبي · كارت واحد لازق زي صفحة المشروع */}
            <div className="col aiside" ref={aside}>
              <AnalysisCard
                title="قراءة الخطة"
                cta="اقرأ الخطة"
                readings={readings}
                onAsk={() => window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
                )}
              />
            </div>
          </div>

          {/* ⚠️ القاعدة مكتوبة في الشاشة لا في التعليق بس · دي أكتر
              حاجة بتلخبط لما تشوف خطة «قيد التنفيذ» ومشروعها في
              مرحلة تانية خالص */}
          <p className="sub tcen">
            مرحلة الخطة لا تغيّر حالة المشروع ·{' '}
            <Link to={ROUTES.project(p.projectId)} className="lnk">{p.projectName}</Link>{' '}
            في «{pr?.stage ?? ''}» والخطة في «{planStageLabel(p.stage)}»، وكلاهما صحيح.
            {readyToClose(p) && ' وكل أنشطة الخطة قُبلت، فالمشروع مؤهَّل للإغلاق.'}
            {issues.length > 0 && !live && (
              <> · وفي <span className="num">{issues.length}</span> ملاحظة تمنع الإرسال.</>
            )}
          </p>
        </div>

        {/* ═══ إعادة النشاط · مودال ═══
            ⚠️ **مودال لا حقل جنب الزرار.** الملاحظة إلزامية والزرار
            بيقفل من غيرها · وحقل صغير في صفّ النشاط بيخلّي الشجرة
            تتحرّك تحت إيد المستخدم وهو بيكتب. ونفس شكل مودال بند
            الميزانية بالحرف (`.bmask` + `.chrome.modal`). */}
        {reject && (
          <div className="bmask" role="presentation" onClick={() => setReject(null)}>
            <div
              className="chrome modal"
              role="dialog"
              aria-modal="true"
              aria-label="إعادة النشاط للجهة"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mh">
                <Icon name={icons.chat} size={18} />
                <b>إعادة النشاط للجهة</b>
              </div>

              <div className="mb col">
                {/* ⚠️ القاعدة 14 بترجّعه «مرفوض» لا «لم يبدأ» · عشان
                    الجهة تعرف إن في شغل اتعمل ومحتاج تصحيح لا إعادة
                    من الصفر */}
                <p className="sub cnote">
                  الملاحظة بتوصل للجهة مع النشاط · والنشاط بيرجع
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
                      placeholder="التقرير بلا كشف مستفيدين"
                    />
                  </span>
                </label>
              </div>

              <div className="mf">
                <button
                  className="btn btn-p"
                  disabled={!reject.note.trim()}
                  onClick={() => {
                    rejectActivity(p.id, reject.id, reject.note.trim())
                    setReject(null)
                    setTick((x) => x + 1)
                  }}
                >
                  أعِد النشاط
                </button>
                <button className="btn btn-2" onClick={() => setReject(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* ⚠️ رصيف القرار للمؤسسة وحدها · الجهة مالهاش قرار
            اعتماد، وأفعالها على النشاط نفسه في الشجرة */}
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
