import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DateField, BackTo, DateText, Empty, Glass, Head, Icon, Money, MultiSelect, Num, Tag, icons,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, ver, countOf, NOUN } from '@/lib/format'
import {
  EVIDENCE_KINDS, askChange, canEditShape, evenWeights, newActivity, newPhase,
  planById, planIssues, planStageLabel, savePhases, sendPlan,
} from '@/data/mock/plans'
import { projectById } from '@/data/mock/projects'
import type { PlanPhase } from '@/types/domain'

/* Plan editor.

   Note: this screen has two entirely different states, not one state with permission checks:

     Before approval - structure is open   - add, delete, edit
     After approval  - structure is locked - the only exit is a formal amendment request

   This is the spec's decision (rule 21), not a design choice: without it, an entity running late
   could quietly extend its dates and always look on schedule on paper, and any drift would lose its
   reference point.

   Note: the lock appears as a different screen, not disabled fields. Twenty grayed-out fields leave
   the user testing them one by one until they understand why - a screen stating "the structure is
   locked, here's how to change it" conveys the same thing in one line.

   Note: weights summing correctly is a displayed rule, not an automatic fix. The stated
   requirement: keep the options available for the user to choose, and give an error message if they
   don't sum correctly - so equal distribution is a button, and an incorrect total is stated loudly.
   */

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
              <Empty title="لا توجد خطة بهذا الرقم." note="تحقّق من رقم الخطة، أو عُد إلى صندوق الخطط." />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const cost = phases.reduce((s, ph) => s + ph.cost, 0)
  const patch = (phId: string, next: Partial<PlanPhase>) =>
    setPhases((xs) => xs.map((x) => (x.id === phId ? { ...x, ...next } : x)))

  /* === Structure locked - formal amendment request === */
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
                  الخطة معتمدة · النسخة المرجعية <Num>{ver(p.baseline)}</Num>{' '}
                  من <DateText>{p.baselineAt ?? ''}</DateText>
                </p>
              </div>
              <Tag tone="mute">مغلقة · قاعدة <Num>21</Num></Tag>
            </header>

            <Glass>
              <Head
                title="الهيكل مغلق بعد الاعتماد"
                meta={<Tag tone="mute">قاعدة <Num>21</Num></Tag>}
              />
              {/* Note: the reason is stated, not assumed - a lock with no reason reads as a bug, sending the user
   looking for a way around it. */}
              <p className="sub cnote">
                ثُبّتت المراحل والأنشطة والتواريخ والتكلفة في النسخة المرجعية
                عند اعتماد مدير المنح للخطة، ويُقاس عليها كل انحراف. ولو عُدّلت
                هنا لفقدت عبارة «متأخر عن الخطة» معناها، لأن الخطة نفسها
                ستتغيّر مع التأخير.
              </p>
              <p className="sub cnote">
                {/* Note: asterisks don't render bold in JSX - this isn't Markdown, the text renders with its literal
   asterisks. `<b>` is the correct approach. */}
                المتاح الآن هو <b>تحديث التنفيذ</b>: حالة النشاط ورفع
                الشواهد، ومكانه{' '}
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
                    يُرسل الطلب إلى مدير المنح، واعتماده يرفع رقم النسخة
                    المرجعية إلى <Num>{ver(p.baseline + 1)}</Num>
                  </span>
                </label>
              </div>

              <div className="regfoot">
                <span className="decsent sub">
                  {p.changes.filter((c) => c.state === 'waiting').length > 0
                    ? 'يوجد طلب بانتظار مدير المنح بالفعل'
                    : 'لا توجد طلبات معلّقة'}
                </span>
                <div className="rowf gp-2">
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.plan(p.id))}>
                    العودة إلى الخطة
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={!ask.trim() || sent}
                    onClick={() => { askChange(p.id, ask.trim()); setSent(true) }}
                  >
                    {sent ? 'أُرسل الطلب' : 'أرسل طلب التعديل'}
                  </button>
                </div>
              </div>
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* === Structure open - the editor === */
  return (
    <AppLayout assistantContext={assistFor.page(`تحرير خطة ${p.projectName}`)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الخطة" onClick={() => navigate(ROUTES.plan(p.id))} />

          <header>
            <div>
              <h1 className="ptitle">تحرير خطة {p.projectName}</h1>
              <p className="sub mt-1">
                {planStageLabel(p.stage)} · الهيكل مفتوح حتى اعتماد مدير المنح ·{' '}
                قيمة المنحة <Money sm>{grant}</Money>
              </p>
            </div>
            {/* The count badge in the page header was removed - a single count now lives in the dock. */}
          </header>

          {phases.length === 0 ? (
            <Glass>
              <Empty
                art={{ done: 0, total: 3 }}
                title="الخطة بلا مراحل."
                note="المرحلة هي وحدة القياس، ومن دونها لا يُحتسب إنجاز ولا تُقارن نسبة."
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
                          <Icon name={icons.trash} size="sm" />
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
                      <DateField
                        value={ph.from}
                        onChange={(x) => patch(ph.id, { from: x })}
                        label={`بداية المرحلة ${i + 1}`}
                      />
                    </label>

                    <label className="regf">
                      <span className="lb">إلى تاريخ</span>
                      <DateField
                        value={ph.to}
                        onChange={(x) => patch(ph.id, { to: x })}
                        label={`نهاية المرحلة ${i + 1}`}
                        min={ph.from || undefined}
                      />
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
                      <span className="sub regf-h">يجب أن يساوي مجموع تكلفة المراحل قيمة المنحة</span>
                    </label>
                  </div>

                  {/* === Phase activities === */}
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
                            <DateField
                                value={a.from}
                                onChange={(v) => patch(ph.id, {
                                  activities: ph.activities.map((x) =>
                                    (x.id === a.id ? { ...x, from: v } : x)),
                                })}
                              label={`بداية النشاط ${j + 1}`}
                            />
                          </label>

                          <label className="regf">
                            <span className="lb">إلى تاريخ</span>
                            <DateField
                                value={a.to}
                                onChange={(v) => patch(ph.id, {
                                  activities: ph.activities.map((x) =>
                                    (x.id === a.id ? { ...x, to: v } : x)),
                                })}
                              label={`نهاية النشاط ${j + 1}`}
                              min={a.from || undefined}
                            />
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

                          {/* Note: required evidence isn't decoration - it's what makes review possible. An activity with no
   required evidence means the supervisor would be accepting it on word alone, and that's exactly
   what rule 14 exists to prevent. */}
                          <label className="regf regf-w">
                            <span className="lb">
                              الشواهد المطلوبة<b className="regf-r" aria-label="إلزامي">*</b>
                            </span>
                            <MultiSelect
                              wide
                              values={a.needs}
                              all={`اختر من ${countOf(EVIDENCE_KINDS.length, NOUN.kind)}`}
                              options={EVIDENCE_KINDS as unknown as string[]}
                              onChange={(next) => patch(ph.id, {
                                activities: ph.activities.map((x) =>
                                  (x.id === a.id ? { ...x, needs: next } : x)),
                              })}
                            />
                            <span className="sub regf-h">
                              ما يلزم الجهة رفعه قبل إعلان اكتمال النشاط
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
                            <Icon name={icons.trash} size="sm" />
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
                      <Icon name={icons.plus} size="sm" />
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
                  <Icon name={icons.plus} size="sm" />
                  أضف مرحلة
                </button>
                <span className="pc-sp" />
                <span className={`decsent${cost !== grant ? ' bad' : ''}`}>
                  مجموع المراحل <Money sm>{cost}</Money>
                  <span className="decsep" />
                  قيمة المنحة <Money sm>{grant}</Money>
                </span>
              </div>

              {/* Note: notes are shown by name, not count - "4 notes" makes the user search for them by eye (same
   lesson as the assistant). */}
              {issues.length > 0 && (
                <ul className="regmiss">
                  {issues.slice(0, 8).map((x) => (
                    <li key={x.key}>
                      <b className="bad">{x.say}</b>
                      <span className="sub"> · {x.rule}</span>
                    </li>
                  ))}
                  {issues.length > 8 && (
                    <li className="sub">و<span className="num">{issues.length - 8}</span> ملاحظات أخرى</li>
                  )}
                </ul>
              )}

              <div className="regfoot">
                <span className="decsent sub">
                  الحفظ يُبقي الخطة مسودة، والإرسال يرسلها إلى مشرف المنح للمراجعة
                </span>
                <div className="rowf gp-2">
                  <button
                    className="btn btn-2"
                    onClick={() => { savePhases(p.id, phases); navigate(ROUTES.plan(p.id)) }}
                  >
                    احفظ المسودة
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={issues.length > 0}
                    title={issues.length > 0 ? issues[0].say : 'الخطة مستوفية وستُرسل إلى مشرف المنح'}
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

