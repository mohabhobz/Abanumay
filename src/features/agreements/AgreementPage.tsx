import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, KV, Money, Mono, Num, Person, Riyal,
  Steps, Tag, type StepItem,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, readDate } from '@/lib/format'
import {
  AGR_LIMIT, AGREEMENT_STAGES, agrHeat, agrPaymentsBalance, agrReserveGap, agrStageWho,
  agreementById,
} from '@/data/mock/agreements'
import type { AgreementRow } from '@/types/domain'
import { AgrActionDock, agrActionsFor } from './AgrActionDock'
import { ScheduleEditor, asDraft } from './ScheduleEditor'

/* ═══════════════════════════════════════════════════════════
   اتفاقية واحدة · محطات الاعتماد الأربعة في مخطط الوثيقة (9.6)

   ⚠️ **شاشة واحدة لأربع محطات.** المخطط بيرسم أربعة مسارات — مشرف
   المنح، مدير المنح، المدير التنفيذي، الجهة المستفيدة — والأربعة
   بيشوفوا **نفس الاتفاقية بنفس البنود ونفس الجدول ونفس السجل**.
   اللي بيختلف هو المخارج، ودي في `agrActionsFor` وحدها.

   ⚠️ **والإعادة مالهاش مسار واحد.** ودي أهم تفصيلة في الإجراء ده:
     خطوة 14 · إعادة مدير المنح      → مشرف المنح
     خطوة 18 · إعادة المدير التنفيذي → **مدير المنح** لا المشرف
     خطوة 22 · إعادة الجهة           → **مشرف المنح** لا المدير
   تلات وجهات مختلفة. «رجّع للخطوة اللي قبلها» كان هيبقى غلط في
   اتنين منهم.

   ═══ اللي الوثيقة بتلزم الشاشة بيه ═══

   قاعدة 5  · البيانات المسترجعة ما تتعدّلش إلا في المشروع الأصلي
   قاعدة 7  · جدول الدفعات جزء من الاتفاقية لا ملحق
   قاعدة 8  · مجموع الدفعات = المنحة · والنسب = 100%
   خطوة 11 · قيمة الاتفاقية = المبلغ المحجوز في الميزانية
   قاعدة 11 · السجل ما يتحذفش ولا يتعدّل بعد تسجيله
   قاعدة 13 · ممنوع الإرسال للجهة قبل اكتمال اعتمادات المؤسسة
   قاعدة 16 · الورقية لازم تُرفق موقّعة قبل التفعيل
   قاعدة 17 · ممنوع التعديل بعد التوقيع · التعديل = إصدار جديد
   قاعدة 20 · إشعار لكل انتقال
   قاعدة 21 · مخرج الـAI استرشادي
   قاعدة 24 · إصدارات متعددة وواحد ساري
   قاعدة 25 · مرحلة الاتفاقية لا تغيّر حالة المشروع
   ═══════════════════════════════════════════════════════════ */

/** المحطات الأربعة اللي المستخدم بيشوفها · من مخطط 9.6 */
const LADDER: { key: string; label: string; note: string; steps: number[] }[] = [
  { key: 'draft', label: 'إعداد الاتفاقية', note: 'مشرف المنح', steps: [3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { key: 'manager', label: 'مراجعة مدير المنح', note: 'مدير المنح', steps: [12, 13] },
  { key: 'executive', label: 'اعتماد المدير التنفيذي', note: 'المدير التنفيذي', steps: [16, 17] },
  { key: 'entity', label: 'توقيع الجهة', note: 'الجهة المستفيدة', steps: [20, 21] },
]

/** أي محطة الاتفاقية واقفة عندها · المعادة بترجع لصاحب الإعادة */
const NOW_AT: Record<string, string> = {
  draft: 'draft',
  returned: 'draft',
  manager: 'manager',
  executive: 'executive',
  entity: 'entity',
  active: '',
  cancelled: '',
}

function ladderFor(a: AgreementRow): StepItem[] {
  const now = NOW_AT[a.stage]
  const done = new Set(a.log.map((e) => e.step))
  return LADDER.map((s): StepItem => {
    const last = a.log.find((e) => e.step === s.steps[s.steps.length - 1])
    return {
      label: s.label,
      note: s.note,
      at: last ? <DateText>{last.at}</DateText> : undefined,
      state: s.key === now ? 'now' : s.steps.every((n) => done.has(n)) ? 'done' : 'todo',
    }
  })
}

export default function AgreementPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { role, user } = useRole()
  const a = agreementById(id)
  const [note, setNote] = useState('')
  const [taken, setTaken] = useState<string | null>(null)

  const ladder = useMemo(() => (a ? ladderFor(a) : []), [a])

  if (!a) {
    return (
      <AppLayout assistantContext={assistFor.page('الاتفاقيات')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الاتفاقيات" onClick={() => navigate(ROUTES.agreements)} />
            <Glass>
              <Empty
                title="الاتفاقية غير موجودة."
                note="يمكن تكون ملغاة أو الرابط قديم."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.agreements)}>
                    ارجع للصندوق
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const heat = agrHeat(a)
  const days = Math.round(a.hoursInStage / 24)
  const limitDays = Math.round(AGR_LIMIT[a.stage] / 24)
  const meta = AGREEMENT_STAGES.find((s) => s.key === a.stage)
  const balance = agrPaymentsBalance(a)
  const gap = agrReserveGap(a)
  const actions = agrActionsFor(role.key, a.stage)

  return (
    <AppLayout assistantContext={assistFor.page(`اتفاقية ${a.id}`, a.projectName)}>
      <div className={`viewstack${actions.length > 0 ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo label="الاتفاقيات" onClick={() => navigate(ROUTES.agreements)} />

          <header className="phead phead-g2">
            <div className="pmain">
              <h1 className="ptitle">{a.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{a.id}</Mono> · {a.entityName} · {a.kind}
                {a.version > 1 && <> · الإصدار <span className="num">{a.version}</span></>}
              </p>

              <div className="pamt">
                <div className="lb">قيمة المنحة</div>
                <div className="v"><Money sm>{a.amount}</Money></div>
                <div className="sub">
                  {/* خطوة 11 · الفرق عن المحجوز بيمنع الإرسال للاعتماد */}
                  {gap === 0
                    ? <>مطابقة للمخصص المحجوز في الميزانية · على <Num>{a.payments.length}</Num> دفعات</>
                    : <span className="bad">
                        المحجوز <Mono>{nf.format(a.reserved)}</Mono> · فرق{' '}
                        <Mono>{nf.format(Math.abs(gap))}</Mono> يمنع الإرسال للاعتماد
                      </span>}
                </div>
              </div>
            </div>

            <div className="col">
              <Steps items={ladder} flow="ladder" />
            </div>
          </header>

          <div className="prow">
            <Tag tone={heat === 'stuck' ? 'no' : heat === 'late' ? 'warn' : 'mute'}>
              {meta?.label ?? 'ملغاة'}
            </Tag>
            {a.stage !== 'active' && (
              <span className="sub">
                عند {agrStageWho(a.stage)} من <Num>{days}</Num> يومًا
                {limitDays > 0 && <> · حدّ المرحلة <Num>{limitDays}</Num> يومًا</>}
              </span>
            )}
            {a.stage === 'active' && a.activeAt && (
              <span className="sub">فُعّلت في <DateText>{a.activeAt}</DateText></span>
            )}
            <span className="pc-sp" />
            <Person name={a.owner} />
            <Link className="btn btn-2 btn-sm" to={ROUTES.project(a.projectId)}>
              <Icon name={icons.doc} size={14} />
              المشروع
            </Link>
          </div>

          {/* ⚠️ قاعدة 25 · مكتوبة في الشاشة لأنها أكتر حاجة بتلخبط:
              اتفاقية «بانتظار المدير التنفيذي» ومشروعها مكتوب عليه
              «إعداد الاتفاقية» · والاتنين صح. */}
          {a.stage !== 'active' && (
            <p className="sub cnote tcen">
              مرحلة الاتفاقية لا تغيّر حالة المشروع · يبقى «إعداد الاتفاقية» حتى
              الاعتماد النهائي، والقاعدة <span className="num">25</span> في الوثيقة.
            </p>
          )}

          <div className="g2">
            <div className="col">
              {/* جدول الدفعات · قاعدة 7: جزء من الاتفاقية لا ملحق ليها */}
              <Glass className="tblcard">
                <Head
                  title="جدول صرف الدفعات"
                  meta={
                    balance.balanced
                      ? <Tag tone="ok">متوازن</Tag>
                      : <Tag tone="no">غير متوازن · قاعدة 8</Tag>
                  }
                />
                {/* ⚠️ **نفس المكوّن اللي في بانِي المسودة، بـ`readOnly`.**
                    قبل كده كان هنا جدول تالت (`.agrpay`) بتحقّقه
                    الخاص · فنفس جدول الدفعات كان ليه تلات أشكال في
                    تلات شاشات، وتصليح في واحد ما بيوصلش للتانيين. */}
                <ScheduleEditor rows={asDraft(a.payments)} amount={a.amount} readOnly />
              </Glass>

              {/* مخرج الذكاء الاصطناعي · 9.5 · والوسم من قاعدة 21 */}
              {a.ai && (
                <Glass>
                  <Head title="تحليل الذكاء الاصطناعي" meta={<Tag tone="mute">استرشادي</Tag>} />
                  <div className="payq-ai">
                    <Icon name={icons.spark} size={15} />
                    <span>{a.ai}</span>
                  </div>
                  <p className="sub cnote">
                    الذكاء الاصطناعي بيقترح النموذج وبيعبّي المسودة وبيكتشف التعارض
                    والنقص في البنود (البند 9.5) · والقاعدة 21 بتقول إن مخرجاته
                    <b> أدوات دعم</b> ولا تُعتمد الاتفاقية بناءً عليها وحدها.
                  </p>
                </Glass>
              )}

              {/* ملاحظة الإعادة · قاعدة 10 بتلزم توضيح السبب */}
              {a.note && (
                <Glass>
                  <Head title="ملاحظات الإعادة" meta={<Tag tone="warn">مطلوب استكمالها</Tag>} />
                  <div className="payq-note">
                    <Icon name={icons.chat} size={15} />
                    <span>{isolate(a.note)}</span>
                  </div>
                </Glass>
              )}

              {/* المرفقات والملاحق · قاعدة 18 بتربطها بالمشروع والميزانية */}
              <Glass>
                <Head
                  title="الاتفاقية وملاحقها"
                  meta={<span className="sub"><Num>{a.docs.length}</Num> مستندًا</span>}
                />
                <div className="docgrid">
                  {a.docs.map((d) => (
                    <DocFile key={d.name} name={d.name} meta={readDate(d.at)} />
                  ))}
                </div>
              </Glass>

              {/* سجل التدقيق · قاعدة 22 · وقاعدة 11: ما يتحذفش ولا يتعدّل */}
              <Glass>
                <Head
                  title="سجل التدقيق"
                  meta={<span className="sub">كل انتقال بخطوته في الوثيقة</span>}
                />
                <ol className="paylog">
                  {[...a.log].reverse().map((e, i) => (
                    <li key={`${e.step}-${i}`}>
                      <span className="paylog-s num">{e.step}</span>
                      <div className="paylog-b">
                        <div className="paylog-t">{e.what}</div>
                        <div className="sub">
                          {e.who}
                          {e.role !== e.who && <> · {e.role}</>}
                          <span className="pc-dot" />
                          <DateText>{e.at}</DateText>
                          {/* قاعدة 24 · الإصدار جزء من السجل لأن
                              الاعتمادات السابقة بتتحفظ مع الإعادة */}
                          {e.version > 1 && (
                            <>
                              <span className="pc-dot" />
                              الإصدار <span className="num">{e.version}</span>
                            </>
                          )}
                        </div>
                        {e.note && <div className="paylog-n">{isolate(e.note)}</div>}
                        {e.notified && (
                          <div className="paylog-i sub">
                            <Icon name={icons.send} size={13} />
                            إشعار · {e.notified}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Glass>
            </div>

            <div className="col">
              {/* النموذج والنوع · قاعدتا 3 و4 */}
              <Glass>
                <Head
                  title="النموذج والنوع"
                  meta={<span className="sub">قواعد 3 · 4</span>}
                />
                <KV
                  rows={[
                    { k: 'نوع الاتفاقية', v: a.kind },
                    { k: 'النموذج المعتمد', v: a.template },
                    { k: 'الإصدار', v: <><Num>{a.version}</Num> · واحد ساري</> },
                    { k: 'بدء الإعداد', v: <DateText>{a.openedAt}</DateText> },
                  ]}
                />
                <p className="sub cnote">
                  القاعدة 3 بتثبّت النوع عند الإنشاء · تغييره بعد بدء دورة الاعتماد
                  يستلزم <b>إصدارًا جديدًا</b>.
                </p>
              </Glass>

              {/* المشروع والجهة · قاعدة 5: مسترجعة ولا تُعدّل هنا */}
              <Glass>
                <Head title="البيانات المسترجعة" meta={<span className="sub">قاعدة 5</span>} />
                <KV
                  rows={[
                    /* ك-2 · العلاقة اللي ليها صفحة بتبقى رابطًا */
                    {
                      k: 'المشروع',
                      v: <Link className="tlink" to={ROUTES.project(a.projectId)}><Mono>{a.projectId}</Mono></Link>,
                    },
                    {
                      k: 'الجهة المستفيدة',
                      v: <Link className="tlink" to={ROUTES.entity(a.entityId)}>{a.entityName}</Link>,
                    },
                    { k: 'ممثل الجهة', v: a.signer.name },
                    { k: 'صفته', v: a.signer.title },
                    { k: 'المخصص المحجوز', v: <><Num>{a.reserved}</Num> <Riyal /></> },
                  ]}
                />
                <p className="sub cnote">
                  النظام بيسترجعها من المشروع والجهة والميزانية · تعديلها يتمّ في
                  <b> المشروع الأصلي</b> لا هنا، والقاعدة 5 في الوثيقة.
                </p>
              </Glass>

              {/* قاعدة 13 و16 · اللي بيمنع الإرسال للجهة والتفعيل */}
              <Glass>
                <Head title="شروط التفعيل" meta={<span className="sub">قواعد 13 · 16 · 19</span>} />
                <ul className="payq-ck">
                  <li className={balance.balanced ? 'ok' : 'no'}>
                    <Icon name={balance.balanced ? icons.check : icons.alert} size={14} />
                    <span>جدول الدفعات متوازن</span>
                    <span className="payq-r">قاعدة <Num>8</Num></span>
                  </li>
                  <li className={gap === 0 ? 'ok' : 'no'}>
                    <Icon name={gap === 0 ? icons.check : icons.alert} size={14} />
                    <span>مطابقة للمخصص المحجوز</span>
                    <span className="payq-r">خطوة <Num>11</Num></span>
                  </li>
                  <li className={a.docs.length > 0 ? 'ok' : 'no'}>
                    <Icon name={a.docs.length > 0 ? icons.check : icons.alert} size={14} />
                    <span>المرفقات والملاحق مكتملة</span>
                    <span className="payq-r">قاعدة <Num>9</Num></span>
                  </li>
                  {a.kind === 'ورقية' && (
                    <li className={a.stage === 'active' ? 'ok' : 'no'}>
                      <Icon name={a.stage === 'active' ? icons.check : icons.alert} size={14} />
                      <span>النسخة الورقية الموقّعة مرفقة</span>
                      <span className="payq-r">قاعدة <Num>16</Num></span>
                    </li>
                  )}
                </ul>
                <p className="sub cnote">
                  القاعدة 19 بتمنع التفعيل وتمكين طلبات الصرف قبل اكتمال كل
                  الاعتمادات والتوقيعات واعتماد النسخة النهائية.
                </p>
              </Glass>
            </div>
          </div>
        </div>

        {actions.length > 0 && (
          <AgrActionDock
            user={user}
            agreement={a}
            actions={actions}
            note={note}
            onNote={setNote}
            taken={taken}
            onTake={setTaken}
          />
        )}
      </div>
    </AppLayout>
  )
}
