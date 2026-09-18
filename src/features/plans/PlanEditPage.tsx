import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, Money, MultiSelect, Num, Tag, icons,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf } from '@/lib/format'
import {
  EVIDENCE_KINDS, askChange, canEditShape, evenWeights, newActivity, newPhase,
  planById, planIssues, planStageLabel, savePhases, sendPlan,
} from '@/data/mock/plans'
import { projectById } from '@/data/mock/projects'
import type { PlanPhase } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   محرّر الخطة · BPD-012

   ⚠️ **الشاشة دي ليها حالتان مختلفتان تمامًا، مش حالة بصلاحيات.**

     قبل الاعتماد · الهيكل مفتوح · بتضيف وتمسح وتعدّل
     بعد الاعتماد · الهيكل **مقفول** · المخرج الوحيد طلب تعديل رسمي

   وده قرار الوثيقة (قاعدة 21) لا اختيار تصميم: من غيره الجهة اللي
   اتأخرت بتمدّد تواريخها بهدوء فتبقى منضبطة على الورق دايمًا،
   والانحراف يفقد مرجعه.

   ⚠️ **والقفل بيبان كشاشة مختلفة لا كحقول معطَّلة.** عشرين حقلًا
   رماديًّا بيخلّي المستخدم يجرّب واحدًا واحدًا لحدّ ما يفهم · وشاشة
   بتقول «الهيكل مقفول، ودي طريقة تغييره» بتوصّل نفس المعنى في سطر.

   ⚠️ **ومجموع الأوزان قاعدة معروضة لا تصحيح تلقائي (ج-15).** مظفر
   بالنص: «خلّي الأوبشنز موجودة عنده يختار، يجيب له رسالة خطأ» ·
   فالتوزيع بالتساوي زرار، والمجموع الغلط بيتقال بصوت عالٍ.
   ═══════════════════════════════════════════════════════════ */

export default function PlanEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const p = planById(id)
  const [phases, setPhases] = useState<PlanPhase[]>(() => p?.phases ?? [])
  const [ask, setAsk] = useState('')
  const [sent, setSent] = useState(false)

  const grant = p ? projectById(p.projectId)?.amountGranted ?? 0 : 0
  const issues = useMemo(
    () => (p ? planIssues({ ...p, phases }, grant) : []),
    [p, phases, grant],
  )

  if (!p) {
    return (
      <AppLayout assistantContext={assistFor.page('خطة غير موجودة')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />
            <Glass>
              <Empty title="لا توجد خطة بهذا الرقم." note="ارجع لصندوق الخطط." />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const cost = phases.reduce((s, ph) => s + ph.cost, 0)
  const patch = (phId: string, next: Partial<PlanPhase>) =>
    setPhases((xs) => xs.map((x) => (x.id === phId ? { ...x, ...next } : x)))

  /* ═══ الهيكل مقفول · طلب تعديل رسمي ═══ */
  if (!canEditShape(p)) {
    return (
      <AppLayout assistantContext={assistFor.page(`تعديل خطة ${p.projectName}`)}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الخطة" onClick={() => navigate(ROUTES.plan(p.id))} />

            <header>
              <div>
                <h1 className="ptitle">تعديل خطة {p.projectName}</h1>
                <p className="sub mt-1">
                  الخطة معتمدة · النسخة المرجعية V<span className="num">{p.baseline}</span>{' '}
                  من <DateText>{p.baselineAt ?? ''}</DateText>
                </p>
              </div>
              <Tag tone="ret">مقفولة · قاعدة <Num>21</Num></Tag>
            </header>

            <Glass>
              <Head
                title="الهيكل مقفول بعد الاعتماد"
                meta={<Tag tone="ret">قاعدة <Num>21</Num></Tag>}
              />
              {/* ⚠️ السبب مكتوب لا مفترَض · القفل من غير سبب بيتقري
                  عطلًا، والمستخدم بيدوّر على طريقة يلفّ حواليها */}
              <p className="sub cnote">
                المراحل والأنشطة والتواريخ والتكلفة اتثبّتوا في النسخة المرجعية
                لما مدير المنح اعتمد الخطة · والانحراف كله بيتقاس عليها. لو
                عدّلناها هنا، «متأخّر عن الخطة» تفقد معناها لأن الخطة نفسها
                بتتغيّر مع التأخير.
              </p>
              <p className="sub cnote">
                {/* ⚠️ النجمتان ما بيبقوش عريضًا في JSX · ده مش
                    ماركداون، والنصّ بيطلع بنجومه. `<b>` هي الصح. */}
                اللي مفتوح دلوقتي هو <b>تحديث التنفيذ</b>: حالة النشاط ورفع
                الشواهد · وده مكانه{' '}
                <Link to={ROUTES.plan(p.id)} className="lnk">صفحة الخطة</Link>.
              </p>

              <div className="regfields">
                <label className="regf regf-w">
                  <span className="lb">
                    التعديل المطلوب<b className="regf-r" aria-label="إلزامي">*</b>
                  </span>
                  <span className="fld fld-a">
                    <textarea
                      rows={3}
                      value={ask}
                      onChange={(e) => setAsk(e.target.value)}
                      placeholder="تمديد مدة التنفيذ شهرين لتأخّر تسليم المقر من البلدية"
                      aria-label="التعديل المطلوب"
                    />
                  </span>
                  <span className="sub regf-h">
                    الطلب بيروح لمدير المنح · والموافقة بترفع رقم النسخة
                    المرجعية لـV<span className="num">{p.baseline + 1}</span>
                  </span>
                </label>
              </div>

              <div className="regfoot">
                <span className="decsent sub">
                  {p.changes.filter((c) => c.state === 'waiting').length > 0
                    ? 'فيه طلب مستنّي مدير المنح بالفعل'
                    : 'مفيش طلبات مستنّية'}
                </span>
                <div className="rowf gp-2">
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.plan(p.id))}>
                    رجوع للخطة
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={!ask.trim() || sent}
                    onClick={() => { askChange(p.id, ask.trim()); setSent(true) }}
                  >
                    {sent ? 'الطلب اتبعت' : 'ابعت طلب التعديل'}
                  </button>
                </div>
              </div>
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* ═══ الهيكل مفتوح · المحرّر ═══ */
  return (
    <AppLayout assistantContext={assistFor.page(`تحرير خطة ${p.projectName}`)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الخطة" onClick={() => navigate(ROUTES.plan(p.id))} />

          <header>
            <div>
              <h1 className="ptitle">تحرير خطة {p.projectName}</h1>
              <p className="sub mt-1">
                {planStageLabel(p.stage)} · الهيكل مفتوح لحدّ اعتماد مدير المنح ·{' '}
                قيمة المنحة <Money sm>{grant}</Money>
              </p>
            </div>
            <Tag tone={issues.length ? 'warn' : 'ok'}>
              {issues.length
                ? <><Num>{issues.length}</Num> ملاحظة</>
                : 'جاهزة للإرسال'}
            </Tag>
          </header>

          {phases.length === 0 ? (
            <Glass>
              <Empty
                title="الخطة بلا مراحل."
                note="المرحلة هي وحدة القياس · ومن غيرها مفيش إنجاز يتحسب ولا نسبة تتقارن."
                actions={
                  <button
                    className="btn btn-p"
                    onClick={() => setPhases([newPhase(0)])}
                  >
                    أضف أول مرحلة
                  </button>
                }
              />
            </Glass>
          ) : (
            phases.map((ph, i) => {
              const w = ph.activities.reduce((s, a) => s + a.weight, 0)
              return (
                <Glass key={ph.id}>
                  <Head
                    title={`المرحلة ${i + 1}`}
                    meta={
                      <div className="rowf gp-2">
                        <Tag tone={w === 100 ? 'ok' : 'warn'}>
                          الأوزان <Num>{w}</Num>
                        </Tag>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPhases((xs) =>
                            xs.map((x) => (x.id === ph.id ? evenWeights(x) : x)))}
                        >
                          وزّع بالتساوي
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPhases((xs) => xs.filter((x) => x.id !== ph.id))}
                        >
                          <Icon name={icons.trash} size={14} />
                          احذف المرحلة
                        </button>
                      </div>
                    }
                  />

                  <div className="regfields">
                    <label className="regf regf-w">
                      <span className="lb">
                        اسم المرحلة<b className="regf-r" aria-label="إلزامي">*</b>
                      </span>
                      <span className="fld">
                        <input
                          value={ph.name}
                          onChange={(e) => patch(ph.id, { name: e.target.value })}
                          placeholder="التهيئة والتعاقد"
                          aria-label={`اسم المرحلة ${i + 1}`}
                        />
                      </span>
                    </label>

                    <label className="regf">
                      <span className="lb">من تاريخ</span>
                      <span className="fld">
                        <input
                          type="date"
                          value={ph.from}
                          onChange={(e) => patch(ph.id, { from: e.target.value })}
                          aria-label={`بداية المرحلة ${i + 1}`}
                        />
                      </span>
                    </label>

                    <label className="regf">
                      <span className="lb">إلى تاريخ</span>
                      <span className="fld">
                        <input
                          type="date"
                          value={ph.to}
                          onChange={(e) => patch(ph.id, { to: e.target.value })}
                          aria-label={`نهاية المرحلة ${i + 1}`}
                        />
                      </span>
                    </label>

                    <label className="regf">
                      <span className="lb">تكلفة المرحلة</span>
                      <span className="fld">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={ph.cost ? nf.format(ph.cost) : ''}
                          onChange={(e) => patch(ph.id, {
                            cost: Number(e.target.value.replace(/[^\d]/g, '')) || 0,
                          })}
                          aria-label={`تكلفة المرحلة ${i + 1}`}
                        />
                      </span>
                      <span className="sub regf-h">مجموع المراحل لازم يساوي قيمة المنحة</span>
                    </label>
                  </div>

                  {/* ═══ أنشطة المرحلة ═══ */}
                  <ul className="acts pledit-a">
                    {ph.activities.map((a, j) => (
                      <li className="act" key={a.id}>
                        <div className="regfields">
                          <label className="regf regf-w">
                            <span className="lb">
                              اسم النشاط<b className="regf-r" aria-label="إلزامي">*</b>
                            </span>
                            <span className="fld">
                              <input
                                value={a.name}
                                onChange={(e) => patch(ph.id, {
                                  activities: ph.activities.map((x) =>
                                    (x.id === a.id ? { ...x, name: e.target.value } : x)),
                                })}
                                placeholder="تدريب الكوادر"
                                aria-label={`اسم النشاط ${j + 1}`}
                              />
                            </span>
                          </label>

                          <label className="regf">
                            <span className="lb">من تاريخ</span>
                            <span className="fld">
                              <input
                                type="date"
                                value={a.from}
                                onChange={(e) => patch(ph.id, {
                                  activities: ph.activities.map((x) =>
                                    (x.id === a.id ? { ...x, from: e.target.value } : x)),
                                })}
                                aria-label={`بداية النشاط ${j + 1}`}
                              />
                            </span>
                          </label>

                          <label className="regf">
                            <span className="lb">إلى تاريخ</span>
                            <span className="fld">
                              <input
                                type="date"
                                value={a.to}
                                onChange={(e) => patch(ph.id, {
                                  activities: ph.activities.map((x) =>
                                    (x.id === a.id ? { ...x, to: e.target.value } : x)),
                                })}
                                aria-label={`نهاية النشاط ${j + 1}`}
                              />
                            </span>
                          </label>

                          <label className="regf">
                            <span className="lb">الوزن في المرحلة</span>
                            <span className="fld">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={a.weight || ''}
                                onChange={(e) => patch(ph.id, {
                                  activities: ph.activities.map((x) => (x.id === a.id
                                    ? { ...x, weight: Number(e.target.value.replace(/[^\d]/g, '')) || 0 }
                                    : x)),
                                })}
                                aria-label={`وزن النشاط ${j + 1}`}
                              />
                            </span>
                          </label>

                          {/* ⚠️ **الشواهد المطلوبة مش تزويق · هي اللي
                              بتخلّي المراجعة ممكنة.** نشاط بلا شاهد
                              مطلوب معناه إن المشرف هيقبله على كلام،
                              وده اللي قاعدة 14 موجودة تمنعه. */}
                          <label className="regf regf-w">
                            <span className="lb">
                              الشواهد المطلوبة<b className="regf-r" aria-label="إلزامي">*</b>
                            </span>
                            <MultiSelect
                              wide
                              values={a.needs}
                              all={`اختر من ${EVIDENCE_KINDS.length} نوعًا`}
                              options={EVIDENCE_KINDS as unknown as string[]}
                              onChange={(next) => patch(ph.id, {
                                activities: ph.activities.map((x) =>
                                  (x.id === a.id ? { ...x, needs: next } : x)),
                              })}
                            />
                            <span className="sub regf-h">
                              اللي الجهة لازم ترفعه قبل ما تقول إن النشاط خلص
                            </span>
                          </label>
                        </div>

                        <div className="act-a">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => patch(ph.id, {
                              activities: ph.activities.filter((x) => x.id !== a.id),
                            })}
                          >
                            <Icon name={icons.trash} size={14} />
                            احذف النشاط
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="rowf gp-2">
                    <button
                      className="btn btn-2 btn-sm"
                      onClick={() => patch(ph.id, {
                        activities: [...ph.activities, newActivity(ph.activities.length)],
                      })}
                    >
                      <Icon name={icons.plus} size={14} />
                      أضف نشاطًا
                    </button>
                  </div>
                </Glass>
              )
            })
          )}

          {phases.length > 0 && (
            <Glass>
              <div className="rowf gp-3">
                <button
                  className="btn btn-2"
                  onClick={() => setPhases((xs) => [...xs, newPhase(xs.length)])}
                >
                  <Icon name={icons.plus} size={15} />
                  أضف مرحلة
                </button>
                <span className="pc-sp" />
                <span className={`decsent${cost !== grant ? ' bad' : ''}`}>
                  مجموع المراحل <Money sm>{cost}</Money>
                  <span className="decsep" />
                  قيمة المنحة <Money sm>{grant}</Money>
                </span>
              </div>

              {/* ⚠️ الملاحظات بالاسم لا بالعدد · «فيه 4 ملاحظات»
                  بتخلّي المستخدم يدوّر بعينه (نفس درس المساعد) */}
              {issues.length > 0 && (
                <ul className="regmiss">
                  {issues.slice(0, 8).map((x) => (
                    <li key={x.key}>
                      <b className="bad">{x.say}</b>
                      <span className="sub"> · {x.rule}</span>
                    </li>
                  ))}
                  {issues.length > 8 && (
                    <li className="sub">و<span className="num">{issues.length - 8}</span> كمان</li>
                  )}
                </ul>
              )}

              <div className="regfoot">
                <span className="decsent sub">
                  الحفظ بيسيب الخطة مسودة · والإرسال بيوديها لمراجعة مشرف المنح
                </span>
                <div className="rowf gp-2">
                  <button
                    className="btn btn-2"
                    onClick={() => { savePhases(p.id, phases); navigate(ROUTES.plan(p.id)) }}
                  >
                    احفظ كمسودة
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={issues.length > 0}
                    title={issues.length > 0 ? issues[0].say : 'الخطة مستوفية · تروح لمشرف المنح'}
                    onClick={() => {
                      savePhases(p.id, phases)
                      sendPlan(p.id)
                      navigate(ROUTES.plan(p.id))
                    }}
                  >
                    احفظ وأرسل للمراجعة
                  </button>
                </div>
              </div>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

