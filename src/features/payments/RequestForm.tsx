import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, Money, MoneyField, Mono, Num, Select, Tag, DockWhy,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, NOUN, nounAfter, MISSING_ITEM } from '@/lib/format'
import {
  PAY_SLOT_SAY, payProjects, payRequestById, paySchedule, type PaySlot,
} from '@/data/mock/disbursements'

const KEYS = ['project', 'pay'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* Disbursement request - screen 2, steps 1, 2, 3, 11 - rule 19.

   Note: this isn't a form, it's the approved payment schedule. An empty form asks the entity "how
   much?" and lets them type a wrong number before rejecting it. The spec works the other way: step
   1 says the system enables creation once due and eligible - meaning availability is shown before
   the click, not rejection after it.

   So the screen shows every payment on the agreement, each with its status and reason, and four
   rules are enforced through display rather than validation:

     Rule 1 - no request before the agreement is active   -> the whole screen is locked with the
     reason stated
     Rule 2 - due payments only                            -> "not yet due" is locked
     Rule 4 - one open request per payment                 -> "has an open request" links to it
     Rule 6 - a conditional payment can't be submitted      -> "held pending a condition"
     Rule 5 - amount can't exceed the approved value        -> validated live in the field
     Rule 3 - requirements before submission                -> a checklist, and submission stays
     locked until met

   Note: rule 3 is a checklist, not an error message. Step 3 says the system "rejects submission on
   missing items" - rejecting after the click leaves the entity to try and fail. The checklist
   before the click states what's missing up front.

   === Same screen for step 11 ===

   Step 11 - "complete the notes and resubmit the request" - same table, same field, same checklist,
   with the difference being the return notes appear on top and the payment is preselected. A
   separate screen would have been a near-duplicate. */

/** The requirements submission depends on - rule 3. */
const NEEDS = [
  'التقرير المرحلي للفترة السابقة',
  'كشف المستفيدين المسجَّلين',
  'فواتير ومستندات الصرف السابق',
  'إقرار ممثل الجهة المخوّل بالتوقيع',
]

const SLOT_TONE: Record<string, 'ok' | 'warn' | 'no' | 'mute' | 'teal'> = {
  open: 'teal',
  early: 'mute',
  pending: 'warn',
  paid: 'ok',
  held: 'no',
}

export default function RequestForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)

  /* Two modes: creating new, or resubmitting a returned request (step 11). */
  const resend = id ? payRequestById(id) : undefined
  /* Note: a wrong request ID isn't the same as a new request. `payRequestById` used to return
     `undefined` and the screen carried on as if it were a "new disbursement request" - meaning
     `/payments/SR-9999/edit` opened an empty form instead of stating the request doesn't exist.
     Worse, the page stayed looking healthy: no console error and no truncated text, so every check
     tool returned green while measuring the wrong screen. */
  const missingId = Boolean(id) && !resend
  const projectId = resend?.projectId ?? v.project
  const projects = useMemo(payProjects, [])
  const project = projects.find((p) => p.id === projectId)
  const slots = useMemo(() => (projectId ? paySchedule(projectId) : []), [projectId])

  const picked = resend
    ? slots.find((s) => s.no === resend.no)
    : slots.find((s) => String(s.no) === v.pay)

  const [amount, setAmount] = useState<string>('')
  const [done, setDone] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState(false)

  const value = amount === '' ? (picked?.amount ?? 0) : Number(amount) || 0
  /* Rule 5 - amount can't exceed the approved payment - validated in the field itself, not after
     submission, so the entity knows before they click. */
  const over = picked ? value > picked.amount : false
  const missing = NEEDS.filter((n) => !done.has(n))
  const canSend = Boolean(picked) && !over && value > 0 && missing.length === 0

  const toggle = (n: string) =>
    setDone((s) => {
      const next = new Set(s)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const title = resend ? 'إعادة إرسال طلب الصرف' : 'طلب صرف جديد'

  if (missingId) {
    return (
      <AppLayout assistantContext={assistFor.page('الصرف')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الصرف" onClick={() => navigate(ROUTES.payments)} />
            <Glass>
              <Empty
                title="الطلب غير موجود."
                note="ربما أُغلق الطلب، أو أن الرابط قديم."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.payments)}>
                    العودة إلى صندوق الصرف
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout assistantContext={assistFor.page(title, project?.name ?? '')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo
            label={resend ? 'الطلب' : 'الصرف'}
            onClick={() => navigate(resend ? ROUTES.payment(resend.id) : ROUTES.payments)}
          />

          <header>
            <div>
              <h1 className="ptitle">{title}</h1>
              <p className="sub mt-1">
                {project
                  ? <>{project.name} · {project.entity}</>
                  : 'اختر المشروع، ويحدّد جدول الدفعات المعتمد الدفعات المتاحة للطلب'}
              </p>
            </div>
          </header>

          {/* Step 11 - return notes appear on top, so the entity sees what's required before
              opening the table, not after. */}
          {resend?.note && (
            <Glass>
              <Head title="ملاحظات المشرف" meta={<Tag tone="warn">مطلوب استكمالها</Tag>} />
              <div className="payq-note">
                <Icon name={icons.chat} size="sm" />
                <span>{isolate(resend.note)}</span>
              </div>
            </Glass>
          )}

          {!resend && (
            <Glass className="ftoolbar">
              <div className="ftool-r">
                <div className="ftool-f">
                  <Select
                    icon={icons.doc}
                    value={projectId}
                    all="اختر المشروع"
                    options={projects.map((p) => ({
                      value: p.id,
                      label: p.open ? `${p.name} (${p.open})` : p.name,
                    }))}
                    onChange={(x) => set({ project: x, pay: undefined })}
                  />
                </div>
              </div>
            </Glass>
          )}

          {!project ? (
            <Glass>
              <Empty
                title="اختر المشروع أولًا."
                note="يحدّد جدول الدفعات المعتمد الدفعات المتاحة للطلب."
              />
            </Glass>
          ) : !project.can ? (
            /* Rule 1 - the screen is locked and the reason is stated, not hidden. */
            <Glass>
              <Empty
                title="لا يمكن إنشاء طلب صرف لهذا المشروع."
                note={project.why}
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.project(project.id))}>
                    افتح المشروع
                  </button>
                }
              />
            </Glass>
          ) : (
            <>
              {/* The spec's second entry point - the approved payment schedule. */}
              <Glass>
                <Head
                  title="جدول الدفعات المعتمد"
                  meta={<span className="sub"><Num>{slots.length}</Num> {nounAfter(slots.length, NOUN.payment)} في الاتفاقية</span>}
                />
                <ul className="payslots">
                  {slots.map((s) => (
                    <SlotRow
                      key={s.no}
                      slot={s}
                      picked={picked?.no === s.no}
                      locked={Boolean(resend)}
                      onPick={() => set({ pay: String(s.no) })}
                      onOpen={() => s.requestId && navigate(ROUTES.payment(s.requestId))}
                    />
                  ))}
                </ul>
              </Glass>

              {picked && (picked.state === 'open' || resend) && (
                <div className="g2">
                  <div className="col">
                    {/* Rule 3 - a checklist before submission, not a message after. */}
                    <Glass>
                      <Head
                        title="متطلبات الإرسال"
                        meta={
                          missing.length
                            ? <Tag tone="warn"><Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</Tag>
                            : <Tag tone="ok">مكتملة</Tag>
                        }
                      />
                      <ul className="paycheckl">
                        {NEEDS.map((n) => (
                          <li key={n}>
                            <label>
                              <input
                                type="checkbox"
                                checked={done.has(n)}
                                onChange={() => toggle(n)}
                              />
                              <span>{n}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <p className="sub cnote">
                        تشترط القاعدة 3 استيفاء كل المتطلبات <b>قبل</b> الإرسال، وترفض خطوة 3
                        الإرسال عند وجود نواقص، لذلك تظهر القائمة قبل زر الإرسال.
                      </p>
                    </Glass>

                    {/* Rule 6 - the payment's condition is shown next to it. */}
                    {picked.condition && (
                      <Glass>
                        <Head
                          title="شرط الدفعة"
                          meta={
                            picked.conditionMet
                              ? <Tag tone="ok">مستوفى</Tag>
                              : <Tag tone="no">غير مستوفى · قاعدة 6</Tag>
                          }
                        />
                        <p className="sub cnote">{isolate(picked.condition)}</p>
                      </Glass>
                    )}
                  </div>

                  <div className="col">
                    <Glass>
                      <Head title="قيمة الطلب" meta={<span className="sub">قاعدة 5</span>} />
                      <label className="payamt">
                        <span className="lb">المبلغ المطلوب</span>
                        <MoneyField
                          value={amount === '' ? picked.amount : amount}
                          onChange={setAmount}
                          label="المبلغ المطلوب"
                        />
                      </label>
                      <p className={over ? 'bad cnote' : 'sub cnote'}>
                        {over
                          ? <>المبلغ أعلى من الدفعة المعتمدة <Mono>{nf.format(picked.amount)}</Mono>. أدخل مبلغًا لا يتجاوزها (قاعدة 5)</>
                          : <>الدفعة المعتمدة في الجدول <Mono>{nf.format(picked.amount)}</Mono> · تستحق في <DateText>{picked.dueAt}</DateText></>}
                      </p>
                    </Glass>

                    <Glass>
                      <Head title="ملخّص الطلب" />
                      <ul className="paysum">
                        <li><span>المشروع</span><span className="trim1">{project.name}</span></li>
                        <li><span>الجهة</span><span className="trim1">{project.entity}</span></li>
                        <li>
                          <span>الدفعة</span>
                          <span className="num">{picked.no}/{picked.of}</span>
                        </li>
                        <li><span>القيمة</span><span><Money sm>{value}</Money></span></li>
                      </ul>
                    </Glass>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Submit - step 2 (or 11 on resubmission). */}
        {picked && (picked.state === 'open' || resend) && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">
                <span className="decsent">
                  {sent
                    ? <>أُرسل الطلب · <b>{resend ? 'أُعيد إرساله إلى المشرف' : 'أُحيل إلى مشرف المنح'}</b>، وأُرسل الإشعار (قاعدة 17)</>
                    : <>
                        الدفعة <b><Num>{picked.no}</Num> من <Num>{picked.of}</Num></b>
                        <span className="decsep" />
                        <Money>{value}</Money>
                        <DockWhy n={missing.length} />
                      </>}
                </span>
              </div>
              {!sent && (
                <button
                  className="btn btn-p"
                  disabled={!canSend}
                  title={
                    over ? 'القيمة أعلى من الدفعة المعتمدة · قاعدة 5'
                    : missing.length ? `ينقص ${missing.length} من المتطلبات · قاعدة 3`
                    : 'خطوة 2 في الوثيقة'
                  }
                  onClick={() => setSent(true)}
                >
                  {resend ? 'أعد إرسال الطلب' : 'أرسل الطلب'}
                </button>
              )}
              {sent && (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.payments)}>
                  العودة إلى صندوق الصرف
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function SlotRow({
  slot, picked, locked, onPick, onOpen,
}: {
  slot: PaySlot
  picked: boolean
  locked: boolean
  onPick: () => void
  onOpen: () => void
}) {
  const say = PAY_SLOT_SAY[slot.state]
  const can = slot.state === 'open' && !locked

  return (
    <li className={`payslot${picked ? ' on' : ''}${can ? '' : ' off'}`}>
      <button
        className="payslot-b"
        onClick={can ? onPick : slot.requestId ? onOpen : undefined}
        disabled={!can && !slot.requestId}
        /* The reason is written in `title`, not left to color alone - color says "something's
           wrong" and the text says what. */
        title={say.rule ? `${say.why} · قاعدة ${say.rule}` : say.why}
      >
        <span className="payslot-n">الدفعة <span className="num">{slot.no}</span></span>
        <span className="payslot-a num">{nf.format(slot.amount)}</span>
        <DateText>{slot.dueAt}</DateText>
        {/* Note: fixed-width cells - the condition used to float in the row's text after a flexible
            gap, and a row with no condition had its badge drift; the checkmark now has its own cell
            even when unselected. */}
        <span className="sub trim1 payslot-c">{slot.condition ? isolate(slot.condition) : ''}</span>
        <Tag tone={SLOT_TONE[slot.state] ?? 'mute'}>{say.label}</Tag>
        <span className="payslot-k">{picked && <Icon name={icons.check} size="sm" />}</span>
      </button>
    </li>
  )
}
