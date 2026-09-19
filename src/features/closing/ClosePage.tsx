import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, KV, Mono, Num, Steps, Tag,
  icons, type StepItem,
} from '@/components/ui'
import { AnalysisCard } from '@/components/assistant/AnalysisCard'
import { DocList, type DocRow } from '@/components/docs'
import { Thread } from '@/components/thread/Thread'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { useFillHeight } from '@/hooks/useFillHeight'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf } from '@/lib/format'
import {
  CLOSE_DOCS, CLOSE_STAGES, CLOSE_TONE, approveEval, approveReport, canStartEval,
  closeById, closeCycle, closeRequirements, closeStageLabel, closeStageWho, evalApproved,
  evalBlockers, needsComms, reportBlockers, reportGap, returnReport,
  sendEval, sendReport, startEval,
} from '@/data/mock/closing'
import { projectById } from '@/data/mock/projects'
import { closeReadings } from './readings'
import { CloseActionDock, closeActionsFor } from './CloseActionDock'

/* ═══════════════════════════════════════════════════════════
   صفحة الإغلاق · BPD-011

   ⚠️ **الصفحة بتجاوب سؤالًا واحدًا: الفعلي قد إيه بعيد عن
   المعتمد.** مش «إيه بيانات التقرير» · دي في الجدول. القاعدة 4
   بتلزم المستفيدين الفعلي والميزانية ومدة التنفيذ والمخرجات ·
   والأربعة دول **معناهم في فرقهم عن المعتمد** لا في قيمتهم.
   «٧٨٠ مستفيدًا» مش معلومة · «٧٨٠ مقابل ١٠٠٠ معتمدًا» معلومة.

   ⚠️ **ودورتان لا سلّم واحد** · قاعدة 17. فالستيبر بيتقسم: محطات
   التقرير، وبعدها محطات التقييم · والقاعدة 6 هي الخطّ اللي بينهم
   (التقييم ما يبدأش قبل اعتماد المدير التنفيذي).

   ⚠️ **نفس الشاشة بعينَين لا شاشتان** · نفس مبدأ صفحة الخطة
   بالحرف: الجهة والمؤسسة بيبصّوا على نفس التقرير ونفس المرفقات ·
   اللي بيفرق هو **الأفعال**. الجهة بترفع وبتبعت، والمؤسسة بتراجع
   وبتعتمد.

   ⚠️ **وبعد `closed` الصفحة للقراءة** · قاعدة 21: أي تعديل بعد
   الإغلاق النهائي بيحتاج إجراء جديد · فمفيش رصيف ومفيش رفع.
   ═══════════════════════════════════════════════════════════ */

/** محطات دورة التقرير · للستيبر */
const REPORT_PATH = ['draft', 'supervisor', 'comms', 'manager', 'executive'] as const
/** محطات دورة التقييم · سجلّ منفصل (قاعدة 17) */
const EVAL_PATH = ['evalDraft', 'evalManager', 'evalExecutive', 'closed'] as const

export default function ClosePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { role, user } = useRole()
  const asEntity = params.get('as') === 'entity'
  const c = closeById(id)
  const [note, setNote] = useState('')
  const [taken, setTaken] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 240 })

  const readings = useMemo(() => (c ? closeReadings(c) : []), [c, tick])

  if (!c) {
    return (
      <AppLayout assistantContext={assistFor.page('طلب إغلاق غير موجود')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />
            <Glass>
              <Empty
                title="لا يوجد طلب إغلاق بهذا الرقم."
                note="ارجع لصندوق الإغلاق واختر واحدًا."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.closings)}>
                    صندوق الإغلاق
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const pr = projectById(c.projectId)
  const cycle = closeCycle(c)
  const missing = reportBlockers(c)
  const evalShort = evalBlockers(c)
  const req = closeRequirements(c)
  const closed = evalApproved(c)
  const gaps = reportGap(c)
  const actions = asEntity ? [] : closeActionsFor(role.key, c.stage)

  /* ⚠️ **المانع محسوب هنا مرة واحدة وبيتبعت للرصيف** · الرصيف كان
     بيحسبه بنفسه في الخطة، وهنا المانع بيختلف بالدورة · فالحساب
     في الشاشة اللي عارفة إحنا في أنهي دورة. */
  const stop = cycle === 'report'
    ? (missing.length > 0 ? `${missing[0]} ناقص (قاعدة 4)` : '')
    : (evalShort.length > 0 ? `${evalShort[0]} (قاعدة 10)` : '')
  const finalStop = c.stage === 'evalExecutive' && !req.ok ? `${req.say} · قاعدة 18` : stop

  /* ⚠️ **الستيبر محطاته من الوثيقة لا من حالات الشاشة** · و`comms`
     بتتخطّى لمّا النشر مش مطلوب · **وبتتقال إنها اتخطّت** لا
     بتختفي (قاعدة الغياب بتاعتنا + قاعدة 9 «متى كانت مطلوبة»). */
  const path: readonly string[] = cycle === 'report' ? REPORT_PATH : EVAL_PATH
  const here: string = c.stage === 'returned' ? (c.returnedTo ?? 'draft') : c.stage
  const at = path.indexOf(here)

  const steps: StepItem[] = path.map((k, i) => {
    const meta = CLOSE_STAGES.find((s) => s.key === k)
    const skipped = k === 'comms' && !needsComms(c)
    return {
      label: skipped ? 'الاتصال المؤسسي · ما بينطبقش' : meta?.label ?? k,
      state: skipped
        ? 'skip'
        : i === at ? 'now' : i < at ? 'done' : 'todo',
    }
  })

  /* المرفقات · **قائمة واحدة من `DocList`** لا جدول مكتوب بالإيد */
  const docRows: DocRow[] = CLOSE_DOCS.map((d) => ({
    name: `${d.label}.pdf`,
    meta: d.req ? 'مستند إلزامي · قاعدة 4' : 'مستند داعم · قاعدة 5',
    uploaded: c.report.docs.includes(d.key),
    required: d.req,
    action: !c.report.docs.includes(d.key) && asEntity && !closed
      ? <button className="btn btn-2 btn-sm">ارفع</button>
      : undefined,
  }))

  const take = (label: string) => {
    if (label.includes('ابدأ تقييم')) startEval(c, user.name)
    else if (label.includes('إرسال التقييم')) sendEval(c, user.name)
    else if (label.includes('اعتماد التقييم')) approveEval(c, user.name)
    else if (label.startsWith('إعادة')) {
      returnReport(c, user.name, note, cycle === 'report' ? 'draft' : 'evalDraft')
    } else approveReport(c, user.name)
    setTaken(label)
    setTick((x) => x + 1)
  }

  return (
    <AppLayout assistantContext={assistFor.page(`إغلاق ${c.projectName}`)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />

          <header>
            <div>
              <h1 className="ptitle">إغلاق {c.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{c.id}</Mono> ·{' '}
                <Link to={ROUTES.entity(c.entityId)} className="tlink">{c.entityName}</Link> ·{' '}
                فُتح الطلب <DateText>{c.openedAt}</DateText>
                {c.versions.length > 1 && (
                  <> · الإصدار <span className="num">{c.versions.length}</span></>
                )}
              </p>
            </div>
            <Tag tone={CLOSE_TONE[c.stage]}>{closeStageLabel(c.stage)}</Tag>
          </header>

          {/* ⚠️ **الجهة لازم تعرف إن المؤسسة بتقارن لا بتستلم.**
              ده أهم سوء فهم ممكن هنا: الجهة بترفع أرقامها الفعلية
              وتفتكر إن الإجراء إداري · والمراجعة فعلًا بتقارنها
              بالمعتمد في الاتفاقية والخطة (مخرج 2). الجملة مكتوبة
              فوق لا مستنتَجة من وسم صغير. */}
          {asEntity && (
            <Glass>
              <Head
                title="أنت في صفحة تقريرك الختامي"
                meta={<Tag tone="ret">الجهة المستفيدة</Tag>}
              />
              <p className="sub cnote">
                القاعدة <span className="num">4</span> بتلزم أربع بيانات كحدّ أدنى:
                المستفيدون الفعلي، والميزانية الفعلية، ومدة التنفيذ، وأبرز المخرجات ·
                والمؤسسة بتقارنهم باللي اتعتمد في الاتفاقية والخطة. والقاعدة{' '}
                <span className="num">3</span> بتمنع الإرسال قبل اكتمالهم مع
                المستندات الداعمة.
              </p>
            </Glass>
          )}

          <Glass className="regsteps">
            <Head
              title={cycle === 'report' ? 'مسار التقرير الختامي' : 'مسار تقييم المشروع'}
              meta={
                <span className="sub">
                  دورة <Num>{cycle === 'report' ? 1 : 2}</Num> من <Num>2</Num> ·
                  سجلّان منفصلان · قاعدة <Num>17</Num>
                </span>
              }
            />
            <Steps flow="stepper" items={steps} />
            {/* ⚠️ القاعدة 6 هي الخطّ بين الدورتين · مكتوبة تحت
                الستيبر لأنها بتشرح ليه الدورة التانية ما بدأتش */}
            <p className="sub cnote">
              {cycle === 'report'
                ? <>تقييم المشروع ما يبدأش قبل اعتماد المدير التنفيذي للتقرير ·
                  القاعدة <span className="num">6</span>.</>
                : <>التقرير الختامي اتعتمد، ودورة التقييم سجلّها منفصل · بيعدّه
                  مشرف المنح لا الجهة.</>}
            </p>
          </Glass>

          <div className="g2">
            <div className="col">
              {/* ═══ الفعلي مقابل المعتمد · قلب الشاشة ═══ */}
              <Glass>
                <Head
                  title="الفعلي مقابل المعتمد"
                  meta={missing.length > 0
                    ? <Tag tone="no"><Num>{missing.length}</Num> بند ناقص</Tag>
                    : <Tag tone="ok">الحدّ الأدنى مكتمل</Tag>}
                />

                <KV
                  rows={gaps.map((g) => ({
                    k: `${g.label} · المعتمد ${nf.format(g.planned)}`,
                    v: g.actual === null
                      ? <span className="sub">ما اتكتبش بعد</span>
                      : (() => {
                        const diff = g.planned > 0
                          ? Math.round(((g.actual - g.planned) / g.planned) * 100)
                          : 0
                        return (
                          <span className={Math.abs(diff) >= 10 ? 'bad' : undefined}>
                            <span className="num">{nf.format(g.actual)}</span>
                            <span className="sub"> {g.unit} · </span>
                            <span className="num">{diff > 0 ? '+' : ''}{diff}%</span>
                          </span>
                        )
                      })(),
                  })).concat([
                    {
                      k: 'مدة التنفيذ الفعلية',
                      v: c.report.days === null
                        ? <span className="sub">ما اتكتبتش بعد</span>
                        : <><span className="num">{c.report.days}</span>
                          <span className="sub"> يومًا</span></>,
                    },
                  ])}
                />

                {c.report.outcomes ? (
                  <div className="payq-cond">
                    <span className="lb">أبرز المخرجات</span>
                    <span>{isolate(c.report.outcomes)}</span>
                  </div>
                ) : (
                  <p className="sub cnote">
                    «أبرز المخرجات والنتائج» ما اتكتبتش · والقاعدة{' '}
                    <span className="num">4</span> بتحسبها من الحدّ الأدنى.
                  </p>
                )}

                {c.report.risks && (
                  <div className="payq-cond">
                    <span className="lb">التحديات</span>
                    <span>{isolate(c.report.risks)}</span>
                  </div>
                )}

                {(!asEntity || !closed) && (
                  <div className="act-a">
                    <Link className="btn btn-2 btn-sm" to={ROUTES.closingReport(c.id)}>
                      {closed ? 'اعرض التقرير' : 'حرّر التقرير الختامي'}
                      <Icon name={icons.chevron} size={14} />
                    </Link>
                  </div>
                )}
              </Glass>

              {/* ═══ المستندات الداعمة · قاعدة 5 ═══ */}
              <Glass>
                <Head
                  title="المستندات الداعمة"
                  meta={
                    <span className="sub">
                      <Num>{c.report.docs.length}</Num> من <Num>{CLOSE_DOCS.length}</Num>
                      {c.report.links.length > 0 && (
                        <> · <Num>{c.report.links.length}</Num> رابط سحابي</>
                      )}
                    </span>
                  }
                />
                <DocList rows={docRows} label="المستندات الداعمة للتقرير الختامي وحالتها" />

                {/* ⚠️ **الرابط السحابي نوع تاني من المرفق لا بديل
                    عنه** · قاعدة 5 بتسمّي «روابط التخزين السحابي
                    المعتمدة (مثل Google Drive)» بالنصّ، والسبب عملي:
                    الفيديوهات والمواد الإعلامية أكبر من أي حدّ رفع. */}
                {c.report.links.length > 0 ? (
                  <ul className="plchg">
                    {c.report.links.map((l) => (
                      <li key={l.url}>
                        <div className="plchg-h">
                          <Tag tone="teal">رابط سحابي</Tag>
                          <span className="sub">قاعدة <Num>5</Num></span>
                        </div>
                        <p className="plchg-t">{isolate(l.label)}</p>
                        <p className="sub">{l.url}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sub cnote">
                    مفيش روابط سحابية · القاعدة <span className="num">5</span> بتسمح
                    بإرفاق المواد الإعلامية والفيديوهات كروابط تخزين معتمدة، وهي
                    عادةً أكبر من أي حدّ رفع.
                  </p>
                )}
              </Glass>

              {/* ═══ التقييم · الدورة التانية ═══ */}
              <Glass>
                <Head
                  title="تقييم المشروع"
                  meta={c.evaluation
                    ? <Tag tone={closed ? 'ok' : 'ret'}>
                      {closed ? 'معتمَد' : closeStageLabel(c.stage)}
                    </Tag>
                    : <Tag tone="mute">ما بدأش</Tag>}
                />

                {c.evaluation ? (
                  <>
                    <KV
                      rows={c.evaluation.indicators.map((i) => ({
                        k: `${i.name} · المستهدف ${nf.format(i.target)} ${i.unit}`,
                        v: i.actual === null
                          ? <span className="sub">بلا قيمة متحقّقة</span>
                          : <span className={i.actual < i.target ? 'bad' : undefined}>
                            <span className="num">{nf.format(i.actual)}</span>
                            <span className="sub"> {i.unit}</span>
                          </span>,
                      })).concat([
                        {
                          k: 'التقدير العام · استرشادي',
                          v: c.evaluation.score === null
                            ? <span className="sub">ما اتحدّدش</span>
                            : <><span className="num">{c.evaluation.score}</span>
                              <span className="sub"> من 5 · قاعدة 13</span></>,
                        },
                      ])}
                    />
                    {c.evaluation.impact && (
                      <div className="payq-cond">
                        <span className="lb">الأثر المرصود</span>
                        <span>{isolate(c.evaluation.impact)}</span>
                      </div>
                    )}
                    {c.evaluation.lessons && (
                      <div className="payq-cond">
                        <span className="lb">الدروس المستفادة</span>
                        <span>{isolate(c.evaluation.lessons)}</span>
                      </div>
                    )}
                    {!asEntity && !closed && (
                      <div className="act-a">
                        <Link className="btn btn-2 btn-sm" to={ROUTES.closingEval(c.id)}>
                          حرّر التقييم
                          <Icon name={icons.chevron} size={14} />
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  /* ⚠️ **الغياب بيتقال** · نفس قاعدة الكروت: «ما
                     بدأش» مع سببه، لا سكشن مختفي يخلّي الصفحة أقصر
                     وسؤال «فين التقييم» بلا إجابة. */
                  <p className="sub cnote">
                    {canStartEval(c)
                      ? <>التقرير اتعتمد، فالتقييم يقدر يبدأ دلوقتي · بيعدّه مشرف
                        المنح ودورته سجلّ منفصل (القاعدة{' '}
                        <span className="num">17</span>).</>
                      : <>القاعدة <span className="num">6</span> بتمنع بدء التقييم قبل
                        اعتماد المدير التنفيذي للتقرير الختامي · فهو مستنّي دوره لا
                        متأخّر.</>}
                  </p>
                )}
              </Glass>

              {/* ═══ الإصدارات وسجلّ التدقيق · قاعدة 11 و15 و19 ═══ */}
              <Glass>
                <Head
                  title="الإصدارات وسجلّ الإجراء"
                  meta={
                    <span className="sub">
                      <Num>{c.versions.length}</Num> إصدار للتقرير ·{' '}
                      <Num>{c.evalVersions.length}</Num> للتقييم · سجلّان منفصلان
                    </span>
                  }
                />
                <ul className="plchg">
                  {c.audit.map((a, i) => (
                    <li key={`${a.at}-${i}`}>
                      <div className="plchg-h">
                        <Tag tone="mute">
                          <DateText>{a.at}</DateText>
                        </Tag>
                        <span className="sub">{a.by}</span>
                      </div>
                      <p className="plchg-t">{isolate(a.what)}</p>
                    </li>
                  ))}
                </ul>
                <p className="sub cnote">
                  القاعدة <span className="num">15</span> بتخلّي تقريرًا معتمدًا
                  واحدًا للمشروع وبتحتفظ بكل الإصدارات اللي قبله · والقاعدة{' '}
                  <span className="num">21</span> بتمنع أي تعديل بعد الإغلاق النهائي،
                  فأي تغيير بعده بيحتاج إجراءً جديدًا.
                </p>
              </Glass>

              {/* ═══ المراسلة · نفس الكمبوننت الواحد ═══ */}
              <Glass>
                <Head title="التواصل مع الجهة" />
                <Thread
                  messages={[]}
                  entityName={c.entityName}
                  me={asEntity ? 'entity' : 'staff'}
                  placeholder="اكتب ملاحظتك على التقرير الختامي…"
                  emptyTitle="مفيش مراسلات على الإغلاق"
                  emptyNote="القناة بتتفتح لمّا إجراء يقف على طرف · ملاحظة على التقرير أو مستند ناقص."
                />
              </Glass>
            </div>

            <div className="col aiside" ref={aside}>
              <AnalysisCard
                title="قراءة التقرير الختامي"
                cta="اقرأ التقرير"
                empty="مفيش ملاحظات على الطلب ده دلوقتي."
                readings={readings}
                onAsk={() => window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
                )}
              />
            </div>
          </div>

          {/* ⚠️ القاعدة 16 مكتوبة في الشاشة لا في التعليق بس */}
          <p className="sub tcen">
            محطة الإغلاق لا تغيّر حالة المشروع ·{' '}
            <Link to={ROUTES.project(c.projectId)} className="lnk">{c.projectName}</Link>{' '}
            في «{pr?.stage ?? ''}»
            {closed
              ? <> والإغلاق اكتمل في <DateText>{c.closedAt ?? ''}</DateText>.</>
              : <> والإغلاق في «{closeStageLabel(c.stage)}»، وكلاهما صحيح · القاعدة{' '}
                <span className="num">16</span>.</>}
            {' '}والمشروع يتحوّل «مكتمل» باعتماد التقرير والتقييم واستكمال المتطلبات
            المالية والإدارية معًا · القاعدة <span className="num">8</span> و
            <span className="num">18</span>.
            {!req.ok && <> ودلوقتي {req.say}.</>}
          </p>
        </div>

        {/* ⚠️ **الجهة أفعالها في الشاشة لا في الرصيف** · نفس صفحة
            الخطة: الجهة بترفع وبتبعت، والرصيف للقرار الإداري. */}
        {asEntity ? (
          !closed && (
            <div className="decdock">
              <div className="chrome decbar">
                <div className="rowf gp-3">
                  <Icon name={icons.doc} size={18} />
                  <span className="decsent">
                    {missing.length === 0
                      ? <>التقرير مكتمل · تقدر تبعته لمراجعة مشرف المنح</>
                      : <><b><Num>{missing.length}</Num> بند</b> ناقص قبل الإرسال
                        <span className="decsep" />
                        {missing[0]}</>}
                  </span>
                </div>
                <button
                  className="btn btn-p"
                  disabled={missing.length > 0 || (c.stage !== 'draft' && c.stage !== 'returned')}
                  title={missing.length > 0 ? `${missing[0]} ناقص (قاعدة 3)` : 'إرسال التقرير للمراجعة'}
                  onClick={() => { sendReport(c); setTick((x) => x + 1) }}
                >
                  أرسل التقرير للمراجعة
                </button>
              </div>
            </div>
          )
        ) : (
          <CloseActionDock
            user={user}
            row={c}
            actions={actions}
            stop={finalStop}
            note={note}
            onNote={setNote}
            taken={taken}
            onTake={take}
          />
        )}
      </div>
    </AppLayout>
  )
}

/** مجموع المرفقات المرفوعة · للعرض السريع */
export const docsDone = (uploaded: string[]): string =>
  `${uploaded.length} من ${CLOSE_DOCS.length}`

/** اسم المحطة وصاحبها في سطر · للاستعمال في التاب والبوّابة */
export const closeWhere = (stage: string): string => {
  const who = closeStageWho(stage as never)
  return who ? `${closeStageLabel(stage as never)} · عند ${who}` : closeStageLabel(stage as never)
}

/** قيمة المنحة · لمقارنة سريعة بره الشاشة */
export const grantOf = (projectId: string): number =>
  projectById(projectId)?.amountGranted ?? 0
