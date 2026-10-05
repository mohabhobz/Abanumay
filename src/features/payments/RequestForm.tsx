import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, Money, MoneyField, Mono, Num, Select, Tag, DockWhy,
} from '@/components/ui'
import { DocFile, UploadButton } from '@/components/docs'
import { useRole } from '@/hooks/useRole'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, NOUN, nounAfter, MISSING_ITEM } from '@/lib/format'
import { PAY_SLOT_SAY, payRequestById, type PaySlot } from '@/data/mock/disbursements'
import {
  REQUEST_NEEDS, condConfirmed, confirmCondition, createRequest, docFromFile, grantLeft, mayResubmit,
  payableProjects, repOf, resubmitRequest, scheduleOf, usePayments,
} from '@/data/payments/store'
import { inForceOf } from '@/data/agreements/store'
import type { PayDoc } from '@/types/domain'

const KEYS = ['project', 'pay', 'as'] as const
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
   separate screen would have been a near-duplicate.

   === Three openers, one screen ===

   · the entity, from its portal (`?as=entity`) · uploads each requirement as a file and the
     representative's acknowledgment, and sends it to the supervisor (9.2.2)
   · the grants supervisor · issues a disbursement permit (9.1.input-4) that waits for the entity's
     justification, the live system's direction kept beside the document's
   · anyone else reads the schedule · the request is the entity's or the supervisor's to open

   Rule 18 · the edit route opens only on a request returned to the entity; after approval a change
   is a new request, and the screen says so instead of opening a form. */

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
  const { role, user } = useRole()
  usePayments()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const asEntity = v.as === 'entity'

  /* Two modes: creating new, or resubmitting a returned request (step 11). */
  const resend = id ? payRequestById(id) : undefined
  /* Note: a wrong request ID isn't the same as a new request. `payRequestById` used to return
     `undefined` and the screen carried on as if it were a "new disbursement request" - meaning
     `/payments/SR-9999/edit` opened an empty form instead of stating the request doesn't exist.
     Worse, the page stayed looking healthy: no console error and no truncated text, so every check
     tool returned green while measuring the wrong screen. */
  const missingId = Boolean(id) && !resend
  const projectId = resend?.projectId ?? v.project
  /* The entity sees its own projects only · the one in the link names it */
  const all = payableProjects()
  const entityId = asEntity ? all.find((p) => p.id === projectId)?.entityId : undefined
  const projects = entityId ? all.filter((p) => p.entityId === entityId) : all
  const project = projects.find((p) => p.id === projectId)
  const slots = projectId ? scheduleOf(projectId) : []
  /* 9.1.input-4 · the supervisor's permit · the entity attaches the justification afterwards */
  const permit = !asEntity && !resend && role.key === 'supervisor'
  const mayOpen = asEntity || permit

  const picked = resend
    ? slots.find((s) => s.no === resend.no)
    : slots.find((s) => String(s.no) === v.pay)

  const [amount, setAmount] = useState<string>('')
  const [files, setFiles] = useState<Record<string, PayDoc>>({})
  const [ack, setAck] = useState(false)
  const [sent, setSent] = useState<string>('')
  const [bad, setBad] = useState<string[]>([])
  const [condNote, setCondNote] = useState('')

  const value = amount === '' ? (resend?.asked ?? picked?.amount ?? 0) : Number(amount) || 0
  /* Rule 5 - amount can't exceed the approved payment - validated in the field itself, not after
     submission, so the entity knows before they click. */
  const over = picked ? value > picked.amount : false
  /* Rule 14 · 9.4.14 · nor what's left of the grant once the paid payments are counted */
  const left = projectId ? grantLeft(projectId, resend?.id) : 0
  const overGrant = Boolean(picked) && value > left
  const have = (kind: string) => Boolean(files[kind]) || Boolean(resend?.docs.some((d) => d.kind === kind))
  const missing = permit ? [] : REQUEST_NEEDS.filter((n) => !have(n.kind))
  const rep = projectId ? (resend?.rep ?? repOf(projectId)) : undefined
  const needAck = asEntity && !ack
  const pickable = picked && (picked.state === 'open' || picked.state === 'held' || Boolean(resend) || Boolean(sent))
  /* 9.4.6 · a payment held by its condition doesn't send · the button says why */
  const held = !resend && picked?.state === 'held'
  const canSend = mayOpen && Boolean(picked) && !held && !over && !overGrant && value > 0 && missing.length === 0 && !needAck

  const title = resend ? (resend.permit ? 'استكمال إذن الصرف' : 'إعادة إرسال طلب الصرف') : permit ? 'إذن صرف جديد' : 'طلب صرف جديد'
  const back = asEntity ? `${ROUTES.entityPortal}?entity=${project?.entityId ?? resend?.entityId ?? ''}` : ROUTES.payments

  const send = () => {
    const docs = Object.values(files)
    if (resend) {
      const out = resubmitRequest(resend.id, value, docs, rep?.name ?? user.name)
      setBad(out)
      if (!out.length) setSent(resend.id)
      return
    }
    if (!picked || !projectId) return
    const out = createRequest({ projectId, no: picked.no, asked: value, docs, origin: permit ? 'supervisor' : 'entity' }, asEntity ? (rep?.name ?? user.name) : user.name)
    setBad(out.errors)
    if (out.id) setSent(out.id)
  }

  /* Rule 18 · after approval a change is a new request · the edit route states it, no form */
  if (resend && !mayResubmit(resend) && !sent) {
    return (
      <AppLayout assistantContext={assistFor.page('الصرف')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الطلب" onClick={() => navigate(`${ROUTES.payment(resend.id)}${asEntity ? '?as=entity' : ''}`)} />
            <Glass>
              <Empty
                title="لا يُعدَّل هذا الطلب."
                note="يُعدَّل الطلب ما دام مُعادًا للجهة لاستكماله فقط · وبعد اعتماده يكون التعديل بطلب جديد (القاعدة 18)."
                actions={<button className="btn btn-2" onClick={() => navigate(`${ROUTES.payment(resend.id)}${asEntity ? '?as=entity' : ''}`)}>العودة إلى الطلب</button>}
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

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
            label={resend ? 'الطلب' : asEntity ? 'البوابة' : 'الصرف'}
            onClick={() => navigate(resend ? `${ROUTES.payment(resend.id)}${asEntity ? '?as=entity' : ''}` : back)}
          />

          <header>
            <div>
              <h1 className="ptitle">{title}</h1>
              <p className="sub mt-1">
                {project
                  ? <>{project.name} · {project.entity}</>
                  : 'اختر المشروع، ويحدّد جدول الدفعات المعتمد الدفعات المتاحة للطلب'}
                {permit && <> · يصدر المشرف الإذن، وترفق الجهة مسوّغاته من بوابتها</>}
              </p>
            </div>
          </header>

          {bad.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}

          {/* Step 11 - return notes appear on top, so the entity sees what's required before
              opening the table, not after. */}
          {resend?.note && (
            <Glass>
              <Head title={resend.permit ? 'ملاحظة إذن الصرف' : 'ملاحظات المشرف'} meta={<Tag tone="warn">مطلوب استكمالها</Tag>} />
              <div className="payq-note">
                <Icon name={icons.chat} size="sm" />
                <span>{isolate(resend.note)}</span>
              </div>
            </Glass>
          )}

          {!resend && (!asEntity || !project) && (
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
                      locked={Boolean(resend) || Boolean(sent)}
                      onPick={() => set({ pay: String(s.no) })}
                      onOpen={() => s.requestId && navigate(`${ROUTES.payment(s.requestId)}${asEntity ? '?as=entity' : ''}`)}
                    />
                  ))}
                </ul>
              </Glass>

              {pickable && picked && (
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
                      {permit ? (
                        <p className="sub cnote">
                          يصدر الإذن دون مرفقات · ترفع الجهة التقارير والمستندات من بوابتها، ثم يعود
                          الطلب إلى مشرف المنح (<bdi>9.1.input-4</bdi>).
                        </p>
                      ) : (
                        <>
                          {/* 9.2.2 · each requirement is a file, uploaded and kept on the request (rule 21) */}
                          <ul className="paycheckl">
                            {REQUEST_NEEDS.map((n) => {
                              const f = files[n.kind] ?? resend?.docs.find((d) => d.kind === n.kind)
                              return (
                                <li key={n.kind} className="payneed">
                                  <Icon name={f ? icons.check : icons.doc} size="sm" className={f ? 'ok-ink' : ''} />
                                  <span className="payneed-t">
                                    <span>{n.label}</span>
                                    {f && <span className="sub trim1">{f.name}</span>}
                                  </span>
                                  {mayOpen && !sent && (
                                    <UploadButton
                                      label={n.label}
                                      accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                                      onPick={(file) => setFiles((x) => ({ ...x, [n.kind]: docFromFile(file, n.kind) }))}
                                    />
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                          {Object.keys(files).length > 0 && (
                            <div className="docgrid mt-2">
                              {Object.values(files).map((d) => <DocFile key={d.kind} name={d.name} meta={d.size} />)}
                            </div>
                          )}
                          <p className="sub cnote">
                            تشترط القاعدة 3 استيفاء كل المتطلبات <b>قبل</b> الإرسال، وترفض خطوة 3
                            الإرسال عند وجود نواقص، لذلك تظهر القائمة قبل زر الإرسال.
                          </p>
                        </>
                      )}
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
                        {condConfirmed(projectId ?? '', picked.no) && (
                          <p className="sub cnote">أكّد المشرف استيفاءه · {condConfirmed(projectId ?? '', picked.no)?.note}</p>
                        )}
                        {/* 9.4.6 · the supervisor confirms the condition · the entity waits for it */}
                        {held && role.key === 'supervisor' && !asEntity && (
                          <div className="apv-row mt-3">
                            <span className="fld"><input value={condNote} onChange={(e) => setCondNote(e.target.value)} placeholder="ما استُوفي به الشرط · إلزامي" aria-label="ما استُوفي به الشرط" /></span>
                            <button type="button" className="btn btn-2 btn-sm" disabled={!condNote.trim()} onClick={() => { const out = confirmCondition(projectId ?? '', picked.no, condNote, user.name); setBad(out); if (!out.length) setCondNote('') }}>
                              أكّد استيفاء الشرط
                            </button>
                          </div>
                        )}
                        {held && asEntity && <p className="bad cnote">لا يُرسل الطلب قبل أن يؤكّد مشرف المنح استيفاء الشرط (القاعدة 6).</p>}
                      </Glass>
                    )}

                    {/* 9.1.input-3 · the representative authorized to sign, from the agreement in force */}
                    {rep && (
                      <Glass>
                        <Head title="ممثل الجهة المخوّل بالتوقيع" meta={<span className="sub">{projectId && inForceOf(projectId) ? 'من الاتفاقية السارية' : 'من بيانات الجهة'}</span>} />
                        <ul className="paysum">
                          <li><span>الاسم</span><span>{rep.name}</span></li>
                          <li><span>الصفة</span><span>{rep.title}</span></li>
                        </ul>
                        {asEntity && !sent && (
                          <label className="paycheckl-ack">
                            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                            <span>أُقرّ بصحة البيانات والمرفقات بصفتي ممثل الجهة المخوّل بالتوقيع</span>
                          </label>
                        )}
                      </Glass>
                    )}
                  </div>

                  <div className="col">
                    <Glass>
                      <Head title="قيمة الطلب" meta={<span className="sub">قاعدة 5</span>} />
                      <label className="payamt">
                        <span className="lb">المبلغ المطلوب</span>
                        <MoneyField
                          value={amount === '' ? (resend?.asked ?? picked.amount) : amount}
                          onChange={setAmount}
                          label="المبلغ المطلوب"
                        />
                      </label>
                      <p className={over || overGrant ? 'bad cnote' : 'sub cnote'}>
                        {over
                          ? <>المبلغ أعلى من الدفعة المعتمدة <Mono>{nf.format(picked.amount)}</Mono>. أدخل مبلغًا لا يتجاوزها (قاعدة 5)</>
                          : overGrant
                            ? <>المبلغ يتجاوز المتبقي من المنحة <Mono>{nf.format(Math.max(0, left))}</Mono> (قاعدة 14)</>
                            : <>الدفعة المعتمدة في الجدول <Mono>{nf.format(picked.amount)}</Mono> · تستحق في <DateText>{picked.dueAt}</DateText> · المتبقي من المنحة <Mono>{nf.format(left)}</Mono></>}
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
        {pickable && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">
                <span className="decsent">
                  {sent
                    ? <>
                        {permit ? 'صدر الإذن' : 'أُرسل الطلب'} <Mono>{sent}</Mono> ·{' '}
                        <b>{permit ? 'أُرسل إلى الجهة لإرفاق المسوّغات' : resend ? 'أُعيد إرساله إلى المشرف' : 'أُحيل إلى مشرف المنح'}</b>، وأُرسل الإشعار (قاعدة 17)
                      </>
                    : !mayOpen
                      ? <>ينشئ الطلبَ الجهةُ من بوابتها، أو مشرفُ المنح بإذن صرف</>
                      : <>
                          الدفعة <b><Num>{picked?.no ?? 0}</Num> من <Num>{picked?.of ?? 0}</Num></b>
                          <span className="decsep" />
                          <Money>{value}</Money>
                          <DockWhy n={missing.length + (needAck ? 1 : 0) + (held ? 1 : 0)} />
                        </>}
                </span>
              </div>
              {!sent && mayOpen && (
                <button
                  className="btn btn-p"
                  disabled={!canSend}
                  title={
                    held ? 'شرط الدفعة غير مستوفى · قاعدة 6'
                    : over ? 'القيمة أعلى من الدفعة المعتمدة · قاعدة 5'
                    : overGrant ? 'القيمة تتجاوز المتبقي من المنحة · قاعدة 14'
                    : missing.length ? `ينقص ${missing.length} من المتطلبات · قاعدة 3`
                    : needAck ? 'أقرّ بصفتك ممثل الجهة المخوّل أولًا'
                    : permit ? '9.1.input-4' : 'خطوة 2 في الوثيقة'
                  }
                  onClick={send}
                >
                  {resend ? 'أعد إرسال الطلب' : permit ? 'أصدر إذن الصرف' : 'أرسل الطلب'}
                </button>
              )}
              {sent && (
                <Link className="btn btn-2" to={`${ROUTES.payment(sent)}${asEntity ? '?as=entity' : ''}`}>
                  افتح الطلب
                </Link>
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
  /* A held payment is pickable · its condition card says why it doesn't send (9.4.6) */
  const can = (slot.state === 'open' || slot.state === 'held') && !locked

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
