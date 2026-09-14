import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, KV, Money, Mono, Num, Person, Riyal,
  Steps, Tag, type StepItem,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { PAY_LIMIT, PAY_STATES, payHeat, payRequestById, payStateWho } from '@/data/mock/disbursements'
import { isolate, pct } from '@/lib/format'
import type { PayRequest } from '@/types/domain'
import { ActionDock, actionsFor } from './ActionDock'

/* ═══════════════════════════════════════════════════════════
   طلب صرف واحد · شاشات 3 و4 و5 في وثيقة BPD-009

   ⚠️ **دي شاشة واحدة لتلات شاشات في الوثيقة.** الوثيقة بتوصف
   «مراجعة الطلب» (مشرف · خطوات 5–7) و«موافقة مدير المنح» (خطوة 13)
   و«أمر الصرف والتحويل» (المالية · خطوات 15–18) كتلات منفصلة، لأنها
   بتتكلم عن **الإجراء** لا عن الشاشة.

   لكن التلاتة بيعرضوا **نفس الطلب بنفس المرفقات ونفس الشروط ونفس
   السجل** · اللي بيختلف هو **المخارج** بس. تلات ملفات هيبقوا تلات
   نسخ من نفس العرض، وأول ما حقل يتضاف هيتضاف تلات مرات — أو اتنين
   وينسى التالت، وده اللي بيبان عند العميل. فالعرض واحد،
   و`actionsFor(role, state)` هي اللي بتقرّر المخارج.

   ═══ إيه اللي الشاشة ملزومة تعرضه بالوثيقة ═══

   قاعدة 10 · الاتفاقية وسريانها معروضة    → بطاقة «الاتفاقية»
   قاعدة 11 · المحجوز معروض لحظة التنفيذ  → بطاقة «أثر الصرف»
   قاعدة 12 · توزيع مصادر التمويل          → جدول المصادر
   قاعدة 13 · محجوز ← مصروف والأثر على الميزانية → نفس البطاقة
   قاعدة 14 · سقف صارم على قيمة المنحة     → شريط المنحة
   قاعدة 16 · سجل تدقيق لكل العمليات       → السجل الزمني بخطواته
   قاعدة 17 · إشعار لكل انتقال             → سطر الإشعار جوّه السجل
   قاعدة 18 · ممنوع التعديل بعد الاعتماد   → المخارج بتختفي بعد الصرف
   قاعدة 20 · مخرج الـAI استرشادي          → وسم «استرشادي»
   قاعدة 21 · المستندات مربوطة بالطلب      → بطاقة المرفقات

   ═══ اللي **مش** هنا بقرار ═══

   «طلب الصرف» (خطوات 1 و2 · شاشة الجهة) مش هنا: دي شاشة **الجهة
   المستفيدة** لا المؤسسة، وبورتال الجهة مش في نطاق النموذج ده.
   الخطوات دي بتبان في السجل كأحداث حصلت، وقاعدة 19 (متابعة الجهة
   لحالة الطلب) مسجَّلة نوتة في `DISBURSEMENT_MODULE_BRIEF.md`.
   ═══════════════════════════════════════════════════════════ */

/** الخطوات الأربعة اللي المستخدم بيشوفها · مصدرها جدول الخطوات */
const LADDER: { key: string; label: string; note: string; steps: number[] }[] = [
  { key: 'entity', label: 'إنشاء الطلب', note: 'الجهة المستفيدة', steps: [1, 2, 3, 4] },
  { key: 'supervisor', label: 'مراجعة المشرف', note: 'مشرف المنح', steps: [5, 6, 7] },
  { key: 'manager', label: 'موافقة مدير المنح', note: 'مدير المنح', steps: [12, 13, 14] },
  { key: 'finance', label: 'أمر الصرف والتحويل', note: 'الإدارة المالية', steps: [15, 16, 17, 18, 19] },
]

/** أي محطة الطلب واقف عندها دلوقتي */
const NOW_AT: Record<string, string> = {
  supervisor: 'supervisor',
  returned: 'entity',
  manager: 'manager',
  finance: 'finance',
  paid: '',
  closed: '',
}

function ladderFor(r: PayRequest): StepItem[] {
  const now = NOW_AT[r.state]
  const done = new Set(r.log.map((e) => e.step))
  return LADDER.map((s): StepItem => {
    const at = r.log.find((e) => e.step === s.steps[s.steps.length - 1])
    return {
      label: s.label,
      note: s.note,
      at: at ? <DateText>{at.at}</DateText> : undefined,
      state: s.key === now ? 'now' : s.steps.every((n) => done.has(n)) ? 'done' : 'todo',
    }
  })
}

export default function RequestPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { role, user } = useRole()
  const r = payRequestById(id)
  const [note, setNote] = useState('')
  const [taken, setTaken] = useState<string | null>(null)

  const ladder = useMemo(() => (r ? ladderFor(r) : []), [r])

  if (!r) {
    return (
      <AppLayout assistantContext={assistFor.page('الصرف')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الصرف" onClick={() => navigate(ROUTES.payments)} />
            <Glass>
              <Empty
                title="الطلب غير موجود."
                note="يمكن يكون اتقفل أو الرابط قديم."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.payments)}>
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

  const heat = payHeat(r)
  const days = Math.round(r.hoursInState / 24)
  const limitDays = Math.round(PAY_LIMIT[r.state] / 24)
  const meta = PAY_STATES.find((s) => s.key === r.state)
  const blocked = r.checks.filter((c) => !c.ok)
  const bankOk = r.bank.active
  const actions = actionsFor(role.key, r.state)

  /* قاعدة 14 · السقف الصارم · المصروف + الدفعة دي مقابل المنحة */
  const after = r.spent + r.asked
  const left = r.granted - after

  return (
    <AppLayout assistantContext={assistFor.page(`طلب ${r.id}`, r.projectName)}>
      <div className={`viewstack${actions.length > 0 ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo label="الصرف" onClick={() => navigate(ROUTES.payments)} />

          {/* الترويسة بعمودين · نفس تركيب صفحة المشروع والجهة:
              الاسم والمبلغ يمين، والسُّلّم قصاده */}
          <header className="phead phead-g2">
            <div className="pmain">
              <h1 className="ptitle">{r.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{r.id}</Mono> · {r.entityName} ·{' '}
                الدفعة <Num>{r.no}</Num> من <Num>{r.of}</Num>
              </p>

              <div className="pamt">
                <div className="lb">قيمة الطلب</div>
                <div className="v"><Money sm>{r.asked}</Money></div>
                <div className="sub">
                  {/* قاعدة 5 · قيمة الطلب ما تتجاوزش الدفعة المعتمدة */}
                  {r.asked === r.due
                    ? <>مطابقة للدفعة المعتمدة · استحقاقها <DateText>{r.dueAt}</DateText></>
                    : <span className="bad">
                        أعلى من الدفعة المعتمدة <Money sm>{r.due}</Money> · مخالفة القاعدة 5
                      </span>}
                </div>
              </div>
            </div>

            <div className="col">
              <Steps items={ladder} flow="ladder" />
            </div>
          </header>

          {/* قاعدة 15 · المقفول بيقول إنه مقفول، وسجله باقٍ تحته */}
          {r.state === 'closed' && (
            <Glass>
              <Head title="الطلب مغلق" meta={<Tag tone="no">رفض نهائي</Tag>} />
              <p className="sub cnote">
                القاعدة 15 بتقول إن النظام يغلق الطلب عند الرفض النهائي
                <b> مع الاحتفاظ بسجل إجراءاته</b> · السجل تحت كامل، والتعديل مقفول.
              </p>
            </Glass>
          )}

          {/* شريط الحالة · مين واقف وبقاله قد إيه مقابل حدّه */}
          <div className="prow">
            <Tag tone={heat === 'stuck' ? 'no' : heat === 'late' ? 'warn' : 'mute'}>
              {meta?.label ?? 'مغلق'}
            </Tag>
            {r.state !== 'paid' && (
              <span className="sub">
                عند {payStateWho(r.state)} من <Num>{days}</Num> يومًا
                {limitDays > 0 && <> · حدّ المرحلة <Num>{limitDays}</Num> يومًا</>}
              </span>
            )}
            {r.state === 'paid' && r.paidAt && (
              <span className="sub">اتصرفت في <DateText>{r.paidAt}</DateText></span>
            )}
            <span className="pc-sp" />
            <Person name={r.owner} />
            {/* المخرج الأول · الورقة اللي المالية بتحوّل بناءً عليها */}
            <Link className="btn btn-2 btn-sm" to={ROUTES.paymentOrder(r.id)}>
              <Icon name={icons.doc} size={14} />
              أمر الصرف
            </Link>
            {/* خطوة 11 · الجهة بتستكمل وتعيد الإرسال */}
            {r.state === 'returned' && (
              <Link className="btn btn-p btn-sm" to={ROUTES.paymentEdit(r.id)}>
                استكمال وإعادة إرسال
              </Link>
            )}
          </div>

          <div className="g2">
            {/* ═══ العمود الرئيسي · اللي بيتاخد عليه القرار ═══ */}
            <div className="col">
              {/* الشروط اللي بتمنع الانتقال · كل واحدة بقاعدتها */}
              <Glass>
                <Head
                  title="شروط الصرف"
                  meta={
                    blocked.length || !bankOk
                      ? <Tag tone="warn">
                          <Num>{blocked.length + (bankOk ? 0 : 1)}</Num> غير مستوفى
                        </Tag>
                      : <Tag tone="ok">مستوفاة</Tag>
                  }
                />
                {r.condition && (
                  <div className="payq-cond">
                    <span className="lb">شرط الدفعة</span>
                    <span>{isolate(r.condition)}</span>
                  </div>
                )}
                <ul className="payq-ck">
                  {r.checks.map((c) => (
                    <li key={c.rule} className={c.ok ? 'ok' : 'no'}>
                      <Icon name={c.ok ? icons.check : icons.alert} size={14} />
                      <span>{c.label}</span>
                      <span className="payq-r">قاعدة <Num>{c.rule}</Num></span>
                    </li>
                  ))}
                  <li className={bankOk ? 'ok' : 'no'}>
                    <Icon name={bankOk ? icons.check : icons.alert} size={14} />
                    <span>{r.bank.name}{bankOk ? '' : ' · الحساب معطَّل'}</span>
                    <span className="payq-r">الحساب المعتمد</span>
                  </li>
                </ul>
                {/* قاعدة 9 · ممنوع التنفيذ قبل اكتمال الاعتمادات */}
                {(blocked.length > 0 || !bankOk) && (
                  <p className="sub cnote">
                    الطلب ما يتحرّكش قبل استيفاء دي · القاعدة 9 بتمنع التنفيذ قبل
                    اكتمال كل الاعتمادات.
                  </p>
                )}
              </Glass>

              {/* مخرج الذكاء الاصطناعي · خطوة 6 · وسمه من القاعدة 20 */}
              {r.ai && (
                <Glass>
                  <Head
                    title="تحليل الذكاء الاصطناعي"
                    meta={<Tag tone="mute">استرشادي</Tag>}
                  />
                  <div className="payq-ai">
                    <Icon name={icons.spark} size={15} />
                    <span>{r.ai}</span>
                  </div>
                  <p className="sub cnote">
                    التحليل بيقارن التقارير والمرفقات ببنود الاتفاقية وجدول الدفعات
                    (البند 9.6) · والقاعدة 20 بتقول إنه ما يغنيش عن اعتماد صاحب
                    الصلاحية.
                  </p>
                </Glass>
              )}

              {/* ملاحظة آخر إعادة · قواعد 7 و8 بيلزموا توضيحها */}
              {r.note && (
                <Glass>
                  <Head title="ملاحظات الإعادة" meta={<Tag tone="warn">للاستكمال</Tag>} />
                  <div className="payq-note">
                    <Icon name={icons.chat} size={15} />
                    <span>{isolate(r.note)}</span>
                  </div>
                </Glass>
              )}

              {/* المرفقات · قاعدة 21: مربوطة بالطلب لا في مكان تاني */}
              <Glass>
                <Head
                  title="المرفقات"
                  meta={<span className="sub"><Num>{r.docs.length}</Num> مستندًا</span>}
                />
                <ul className="paydocs">
                  {r.docs.map((d) => (
                    <li key={d.name}>
                      <Icon name={icons.doc} size={15} />
                      <span className="trim1">{d.name}</span>
                      <span className="sub">{d.kind}</span>
                      <span className="pc-sp" />
                      <span className="sub num">{d.size}</span>
                      <DateText>{d.at}</DateText>
                    </li>
                  ))}
                </ul>
              </Glass>

              {/* سجل التدقيق · قاعدة 16 · وكل انتقال بإشعاره (قاعدة 17) */}
              <Glass>
                <Head
                  title="سجل التدقيق"
                  meta={<span className="sub">كل انتقال بخطوته في الوثيقة</span>}
                />
                <ol className="paylog">
                  {[...r.log].reverse().map((e, i) => (
                    <li key={`${e.step}-${i}`}>
                      <span className="paylog-s num">{e.step}</span>
                      <div className="paylog-b">
                        <div className="paylog-t">{e.what}</div>
                        <div className="sub">
                          {e.who}
                          {e.role !== e.who && <> · {e.role}</>}
                          <span className="pc-dot" />
                          <DateText>{e.at}</DateText>
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

            {/* ═══ العمود الجانبي · اللي بيسند القرار ═══ */}
            <div className="col">
              {/* قاعدة 10 · الاتفاقية وسريانها معروضة في الطلب */}
              <Glass>
                <Head
                  title="الاتفاقية"
                  meta={
                    r.agreement.active
                      ? <Tag tone="ok">سارية</Tag>
                      : <Tag tone="no">غير سارية</Tag>
                  }
                />
                <KV
                  rows={[
                    { k: 'رقم الاتفاقية', v: <Mono>{r.agreement.id}</Mono> },
                    { k: 'تنتهي في', v: <DateText>{r.agreement.endsAt}</DateText> },
                    { k: 'المشروع', v: <Mono>{r.projectId}</Mono> },
                    { k: 'الجهة', v: r.entityName },
                  ]}
                />
              </Glass>

              {/* قواعد 11 و13 و14 · المحجوز، والأثر، والسقف */}
              <Glass>
                <Head title="أثر الصرف" meta={<span className="sub">قواعد 11 · 13 · 14</span>} />
                <KV
                  rows={[
                    { k: 'المحجوز على الدفعة', v: <><Num>{r.reserved}</Num> <Riyal /></> },
                    { k: 'يتحوّل إلى', v: <span className="ok-ink">مصروف</span> },
                    { k: 'قيمة المنحة', v: <><Num>{r.granted}</Num> <Riyal /></> },
                    { k: 'المصروف قبل الدفعة', v: <><Num>{r.spent}</Num> <Riyal /></> },
                    {
                      k: 'المتبقي بعد الصرف',
                      v: left < 0
                        ? <b className="bad"><Num>{left}</Num> <Riyal /></b>
                        : <><Num>{left}</Num> <Riyal /></>,
                    },
                  ]}
                />
                <div className="paybar">
                  <span style={{ width: `${Math.min(100, Math.round((after / r.granted) * 100))}%` }} />
                </div>
                <p className="sub cnote">
                  {pct(Math.round((after / r.granted) * 100))} من المنحة بعد تنفيذ الدفعة دي ·
                  القاعدة 14 بتمنع أي صرف يتجاوز قيمة المنحة.
                </p>
              </Glass>

              {/* ⚠️ قاعدة 17 · «إشعارات تلقائية في كل مراحل الطلب».
                  الإشعارات موجودة جوّه السجل كسطر تحت كل انتقال،
                  بس السجل بيتقري بالترتيب الزمني والسؤال «مين
                  اتبلّغ؟» بيتقري بالمستقبِل · نفس الداتا مقروءة
                  بمحورين، فبطاقة مستقلة بتجاوب السؤال التاني بلا
                  تكرار في التخزين. */}
              <Glass>
                <Head
                  title="الإشعارات"
                  meta={<span className="sub">قاعدة 17 · لكل انتقال إشعار</span>}
                />
                <ul className="paynotif">
                  {r.log.filter((e) => e.notified).map((e, i) => (
                    <li key={`${e.step}-${i}`}>
                      <Icon name={icons.send} size={14} />
                      <span className="trim1">{e.notified}</span>
                      <span className="pc-sp" />
                      <DateText>{e.at}</DateText>
                    </li>
                  ))}
                  {r.log.every((e) => !e.notified) && (
                    <li className="sub">لا إشعارات بعد · الطلب لسّه في أول مرحلة.</li>
                  )}
                </ul>
              </Glass>

              {/* قاعدة 12 · الصرف وفق التوزيع المعتمد للمصادر */}
              <Glass>
                <Head
                  title="مصادر التمويل"
                  meta={
                    r.sources.length > 1
                      ? <Tag tone="teal">مصدران</Tag>
                      : <span className="sub">مصدر واحد</span>
                  }
                />
                <ul className="paysrc">
                  {r.sources.map((s) => (
                    <li key={s.name}>
                      <span className="trim1">{s.name}</span>
                      <span className="num">{pct(s.share)}</span>
                      <span className="paysrc-v num">
                        {Math.round((r.asked * s.share) / 100).toLocaleString('en-US')}
                      </span>
                    </li>
                  ))}
                </ul>
                {r.sources.length > 1 && (
                  <p className="sub cnote">
                    القاعدة 12 بتلزم الصرف بالتوزيع ده، وأمر الصرف بيتولد بيه.
                  </p>
                )}
              </Glass>
            </div>
          </div>
        </div>

        {/* مخارج الدور · هي اللي بتفرّق بين شاشات 3 و4 و5 */}
        {actions.length > 0 && (
          <ActionDock
            user={user}
            request={r}
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
