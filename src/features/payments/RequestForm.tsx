import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ButtonLink, FieldBox, Button, BackTo, DateText, Empty, Glass, Head, Icon, icons, Money, MoneyField, Mono, Num, Select, Tag, DockWhy,
} from '@/components/ui'
import { DocFile, DocReadNote, UploadButton, useDocReads } from '@/components/docs'
import { useRole } from '@/hooks/useRole'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, NOUN, nounAfter, MISSING_ITEM } from '@/lib/format'
import { PAY_SLOT_SAY, payRequestById, type PaySlot } from '@/data/mock/disbursements'
import {
  PROXY_ROLES, condConfirmed, confirmCondition, createPermit, createRequest, docFromFile, grantLeft, mayResubmit,
  needsFor, payableProjects, repOf, resubmitRequest, scheduleOf, usePayments,
} from '@/data/payments/store'
import { inForceOf } from '@/data/agreements/store'
import { AssistantAside } from '@/features/shared/AssistantAside'
import type { PayDoc } from '@/types/domain'

const KEYS = ['project', 'pay', 'as'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* A payment's requirements · v3 · 9.2.1 – 9.2.3 · 9.2.9 · 9.2.10 · 9.4.5 · 9.4.7 · 9.4.8.

   The screen is the approved payment schedule, not a form asking «how much?»: every payment of the
   agreement with its state and its reason, shown before the click.

   · the entity (`?as=entity`) raises a payment's requirements · the reports, documents and outputs
     the agreement ties it to, each a file · when they're ready, before the planned date too (9.4.7) ·
     no amount: the payment's value is the schedule's (9.2.2)
   · the authority raises them on an external party's behalf (9.4.5)
   · a first or only payment with no condition of its own is eligible from the activation · the
     supervisor creates its permit straight from here (9.2.2 · 9.2.10)
   · a payment tied to a report, an activity or a date not met yet is held (9.4.8)
   · step 9 · the same screen completes what the supervisor returned */

const SLOT_TONE: Record<string, 'ok' | 'warn' | 'no' | 'mute' | 'teal'> = {
  open: 'teal',
  eligible: 'ok',
  queued: 'mute',
  pending: 'warn',
  paid: 'ok',
  held: 'no',
  stopped: 'no',
  settled: 'mute',
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
  /* the mode the send was made in · the slot turns «قيد الصرف» right after it */
  const [sentPermit, setSentPermit] = useState(false)
  const picked = resend
    ? slots.find((s) => s.no === resend.no)
    : slots.find((s) => String(s.no) === v.pay)
  /* 9.2.10 · a payment eligible from the activation · the supervisor creates its permit here */
  const permit = sentPermit || (!asEntity && !resend && role.key === 'supervisor' && picked?.state === 'eligible')
  /* 9.4.5 · an external party's requirements are raised by the authority on its behalf */
  const external = Boolean(project?.external ?? (resend && resend.origin === 'proxy'))
  const proxy = !asEntity && external && PROXY_ROLES.includes(role.key)
  const mayOpen = permit || (external ? proxy : asEntity)

  const [amount, setAmount] = useState<string>('')
  const [files, setFiles] = useState<Record<string, PayDoc>>({})
  /* 10 Oct · the invoices are read for the previous payment's amount, the report for its period */
  const { reads, read } = useDocReads()
  const prevPaid = picked ? slots.filter((x) => x.no < picked.no && x.state === 'paid').slice(-1)[0] : undefined
  const [ack, setAck] = useState(false)
  const [sent, setSent] = useState<string>('')
  const [bad, setBad] = useState<string[]>([])
  const [condNote, setCondNote] = useState('')

  /* 9.4.4 · the permit's amount · the payment's value at most · it is the permit's alone, the
     requirements carry none */
  const cap = picked ? (picked.left ?? picked.amount) : 0
  const value = permit ? (amount === '' ? cap : Number(amount) || 0) : (resend?.due ?? picked?.amount ?? 0)
  const over = permit && picked ? value > cap : false
  /* 9.4.16 · nor what's left of the grant once the paid payments are counted */
  const left = projectId ? grantLeft(projectId, resend?.id) : 0
  const overGrant = permit && Boolean(picked) && value > left
  const have = (kind: string) => Boolean(files[kind]) || Boolean(resend?.docs.some((d) => d.kind === kind))
  const needs = resend ? needsFor(resend) : picked?.needs ?? []
  const missing = permit ? [] : needs.filter((n) => !have(n.kind))
  const rep = projectId ? (resend?.rep ?? repOf(projectId)) : undefined
  const needAck = asEntity && !ack
  const pickable = picked && (picked.state === 'open' || picked.state === 'held' || picked.state === 'eligible' || Boolean(resend) || Boolean(sent))
  /* 9.4.8 · a payment tied to a report, an activity or a date not met yet doesn't go up · the button says why */
  const held = !resend && picked?.state === 'held'
  /* a first or only payment with no condition is the supervisor's permit · nothing to raise */
  const noCycle = !resend && picked?.state === 'eligible'
  const canSend = mayOpen && Boolean(picked) && !held && !over && !overGrant && value > 0 && missing.length === 0 && !needAck && (permit || !noCycle) && !(permit && picked?.notBefore)

  const title = resend ? 'استكمال متطلبات الدفعة' : permit ? 'إذن صرف جديد' : 'متطلبات الدفعة'
  const back = asEntity ? `${ROUTES.entityPortal}?entity=${project?.entityId ?? resend?.entityId ?? ''}` : ROUTES.payments

  const send = () => {
    const docs = Object.values(files)
    if (resend) {
      const out = resubmitRequest(resend.id, docs, asEntity ? (rep?.name ?? user.name) : user.name, role.key, asEntity)
      setBad(out)
      if (!out.length) setSent(resend.id)
      return
    }
    if (!picked || !projectId) return
    const out = permit
      ? createPermit({ projectId, no: picked.no, asked: value }, user.name, role.key)
      : createRequest({ projectId, no: picked.no, docs, origin: proxy ? 'proxy' : 'entity' }, asEntity ? (rep?.name ?? user.name) : user.name, role.key)
    setBad(out.errors)
    if (out.id) { setSent(out.id); setSentPermit(permit) }
  }

  /* Rule 18 · after approval a change is a new request · the edit route states it, no form */
  if (resend && !mayResubmit(resend) && !sent) {
    return (
      <AppLayout assistantContext={assistFor.page('الصرف')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الدفعة" onClick={() => navigate(`${ROUTES.payment(resend.id)}${asEntity ? '?as=entity' : ''}`)} />
            <Glass>
              <Empty
                title="لا تُعدَّل متطلبات هذه الدفعة."

                actions={<Button variant="2" onClick={() => navigate(`${ROUTES.payment(resend.id)}${asEntity ? '?as=entity' : ''}`)}>العودة إلى الدفعة</Button>}
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
                title="السجل غير موجود."
                actions={
                  <Button variant="2" onClick={() => navigate(ROUTES.payments)}>
                    العودة إلى صندوق الصرف
                  </Button>
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
            label={resend ? 'الدفعة' : asEntity ? 'البوابة' : 'الصرف'}
            onClick={() => navigate(resend ? `${ROUTES.payment(resend.id)}${asEntity ? '?as=entity' : ''}` : back)}
          />

          <header>
            <div>
              <h1 className="ptitle">{title}</h1>
              {project && (
                <p className="sub mt-1">
                  {project.name} · {project.entity}
                  {proxy && <> · مشروع عبر جهة خارجية{/* doc 9.4.5 */}</>}
                </p>
              )}
            </div>
          </header>

          {bad.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}

          {/* Step 11 - return notes appear on top, so the entity sees what's required before
              opening the table, not after. */}
          {resend?.note && (
            <Glass>
              <Head title="ما ينقص المتطلبات" meta={<Tag tone="warn">مطلوب استكمالها</Tag>} />
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
              />
            </Glass>
          ) : !project.can ? (
            /* Rule 1 - the screen is locked and the reason is stated, not hidden. */
            <Glass>
              <Empty
                title="لا صرف لهذا المشروع الآن."
                note={project.why}
                actions={
                  <Button variant="2" onClick={() => navigate(ROUTES.project(project.id))}>
                    افتح المشروع
                  </Button>
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
                    {/* 9.2.2 · 9.2.3 · the requirements before the click, each a file */}
                    <Glass>
                      <Head
                        title="متطلبات الدفعة"
                        meta={
                          noCycle || permit
                            ? <Tag tone="ok">لا دورة متطلبات</Tag>
                            : missing.length
                              ? <Tag tone="warn"><Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</Tag>
                              : <Tag tone="ok">مكتملة</Tag>
                        }
                      />
                      {noCycle ? (
                        <p className="sub cnote">
                          {/* doc 9.2.2 · 9.2.10 */}
                          {picked.left !== undefined ? 'باقي دفعة صُرف جزء منها.' : <>{picked.of === 1 ? 'الدفعة الوحيدة' : 'الدفعة الأولى'} بلا شروط خاصة في الاتفاقية.</>}
                        </p>
                      ) : (
                        <>
                          <ul className="paycheckl">
                            {needs.map((n) => {
                              const f = files[n.kind] ?? resend?.docs.find((d) => d.kind === n.kind)
                              return (
                                <li key={n.kind} className="payneed">
                                  <Icon name={f ? icons.check : icons.doc} size="sm" className={f ? 'ok-ink' : ''} />
                                  <span className="payneed-t">
                                    <span>{isolate(n.label)}</span>
                                    {f && <span className="sub trim1">{f.name}</span>}
                                  </span>
                                  {mayOpen && !sent && (
                                    <UploadButton
                                      label={n.label}
                                      accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                                      onPick={(file) => {
                                        setFiles((x) => ({ ...x, [n.kind]: docFromFile(file, n.kind) }))
                                        if (n.kind === 'فواتير' && prevPaid) read(n.kind, file, 'invoice', { amount: String(prevPaid.amount) })
                                        else read(n.kind, file, n.kind.startsWith('report') || n.kind === 'تقرير' ? 'report' : 'list', {})
                                      }}
                                    />
                                  )}
                                  {files[n.kind] && <DocReadNote r={reads[n.kind]} />}
                                </li>
                              )
                            })}
                          </ul>
                          {Object.keys(files).length > 0 && (
                            <div className="docgrid mt-2">
                              {Object.values(files).map((d) => <DocFile key={d.kind} name={d.name} meta={d.size} />)}
                            </div>
                          )}

                        </>
                      )}
                    </Glass>

                    {/* Rule 6 - the payment's condition is shown next to it. */}
                    {picked.condition && (
                      <Glass>
                        <Head
                          title="شروط الدفعة"
                          meta={
                            picked.conditionMet
                              ? <Tag tone="ok">مستوفاة</Tag>
                              : held ? <Tag tone="no">غير مستوفاة{/* doc 9.4.8 */}</Tag> : <Tag tone="warn">يتحقق منها المشرف</Tag>
                          }
                        />
                        <p className="sub cnote">{isolate(picked.condition)}</p>
                        {/* Client meeting 20 Oct · the payment's basis */}
                        {picked.basis && <p className="sub cnote">أساس الدفعة · {picked.basis}</p>}
                        {condConfirmed(projectId ?? '', picked.no) && (
                          <p className="sub cnote">أكّد المشرف استيفاءه · {condConfirmed(projectId ?? '', picked.no)?.note}</p>
                        )}
                        {/* the supervisor confirms what the record can't read (an output, a note) */}
                        {!picked.conditionMet && !held && role.key === 'supervisor' && !asEntity && (
                          <div className="apv-row mt-3">
                            <FieldBox><input value={condNote} onChange={(e) => setCondNote(e.target.value)} placeholder="ما استُوفي به الشرط · إلزامي" aria-label="ما استُوفي به الشرط" /></FieldBox>
                            <Button type="button" variant="2" size="sm" disabled={!condNote.trim()} onClick={() => { const out = confirmCondition(projectId ?? '', picked.no, condNote, user.name); setBad(out); if (!out.length) setCondNote('') }}>
                              أكّد استيفاء الشرط
                            </Button>
                          </div>
                        )}
                        {held && <p className="bad cnote">لا تُرفع متطلبات الدفعة قبل استيفاء شرطها{/* doc 9.4.8 */}.</p>}
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

                    {/* 9.4.4 · the permit's amount · the payment's value at most */}
                    {permit && (
                      <Glass>
                        <Head title="قيمة إذن الصرف" />
                        <label className="payamt">
                          <span className="lb">قيمة الإذن</span>
                          <MoneyField value={amount === '' ? cap : amount} onChange={setAmount} label="قيمة الإذن" />
                        </label>
                        {(over || overGrant) && (
                          <p className="bad cnote">
                            {over
                              ? <>القيمة أعلى من {picked.left !== undefined ? 'باقي الدفعة' : 'الدفعة المعتمدة'} <Mono>{nf.format(cap)}</Mono>{/* doc 9.4.4 */}</>
                              : <>القيمة تتجاوز المتبقي من المنحة <Mono>{nf.format(Math.max(0, left))}</Mono>{/* doc 9.4.16 */}</>}
                          </p>
                        )}
                        {picked.notBefore && <p className="bad cnote">لا صرف قبل <DateText>{picked.notBefore}</DateText>{/* doc 9.4.7 */}</p>}
                      </Glass>
                    )}

                    <Glass>
                      <Head title="الدفعة" />
                      <ul className="paysum">
                        <li><span>المشروع</span><span className="trim1">{project.name}</span></li>
                        <li><span>الجهة</span><span className="trim1">{project.entity}</span></li>
                        <li>
                          <span>الدفعة</span>
                          <span className="num">{picked.no}/{picked.of}</span>
                        </li>
                        <li><span>القيمة</span><span><Money sm>{value}</Money></span></li>
                        <li><span>المخطط صرفها</span><span><DateText>{picked.dueAt}</DateText>{picked.ahead ? ' · قبل موعدها' : ''}</span></li>
                      </ul>
                    </Glass>
                  </div>

                  <AssistantAside
                    title="مراجعة المتطلبات"
                    cta="راجع المتطلبات"
                    empty="المتطلبات مكتملة · جاهزة للإرسال."
                    ask={!asEntity}
                    readings={[
                      ...(held ? [{ id: 'rf-held', kind: 'flag' as const, label: 'شروط الدفعة', text: `${picked.condition ?? ''} · لم يُستوفَ بعد.`, src: /* doc 9.4.8 */ '' }] : []),
                      ...missing.map((n) => ({ id: `rf-${n.kind}`, kind: 'flag' as const, label: 'ينقص قبل الإرسال', text: n.label, src: /* doc 9.2.3 */ '' })),
                      ...(over ? [{ id: 'rf-over', kind: 'flag' as const, label: 'قيمة الإذن', text: `أعلى من الدفعة المعتمدة ${nf.format(picked.amount)}.`, src: /* doc 9.4.4 */ '' }] : []),
                      ...(overGrant ? [{ id: 'rf-grant', kind: 'flag' as const, label: 'سقف المنحة', text: `يتجاوز المتبقي من المنحة ${nf.format(Math.max(0, left))}.`, src: /* doc 9.4.16 */ '' }] : []),
                      ...(needAck ? [{ id: 'rf-ack', kind: 'flag' as const, label: 'إقرار الممثل', text: 'أقرّ بصحة البيانات بصفتك ممثل الجهة المخوّل.', src: /* doc 9.1.input-3 */ '' }] : []),
                    ]}
                  />
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
                        {permit ? 'أُنشئ إذن الصرف' : 'رُفعت المتطلبات'} <Mono>{sent}</Mono> ·{' '}
                        <b>{permit ? 'أُحيل إلى مدير المنح' : 'أُحيلت إلى مشرف المنح'}</b>، وأُرسل الإشعار
                      </>
                    : !mayOpen
                      ? <>{noCycle ? 'مؤهلة للصرف · ينشئ مشرف المنح إذن الصرف' : external ? 'يرفع المتطلبات صاحب الصلاحية نيابةً عن الجهة الخارجية' : 'ترفع الجهة المتطلبات من بوابتها'}</>
                      : <>
                          الدفعة <b><Num>{picked?.no ?? 0}</Num> من <Num>{picked?.of ?? 0}</Num></b>
                          <span className="decsep" />
                          <Money>{value}</Money>
                          <DockWhy n={missing.length + (needAck ? 1 : 0) + (held ? 1 : 0)} />
                        </>}
                </span>
              </div>
              {!sent && mayOpen && (
                <Button
                  variant="p"
                  disabled={!canSend}
                  title={
                    held ? /* doc 9.4.8 */ 'شروط الدفعة غير مستوفاة'
                    : over ? /* doc 9.4.4 */ 'القيمة أعلى من الدفعة المعتمدة'
                    : overGrant ? /* doc 9.4.16 */ 'القيمة تتجاوز المتبقي من المنحة'
                    : missing.length ? /* doc 9.2.3 */ `ينقص ${missing.length} من المتطلبات`
                    : needAck ? 'أقرّ بصفتك ممثل الجهة المخوّل أولًا'
                    : ''
                  }
                  onClick={send}
                >
                  {resend ? 'أعد رفع المتطلبات' : permit ? 'أنشئ إذن الصرف' : 'ارفع المتطلبات'}
                </Button>
              )}
              {sent && (
                <ButtonLink variant="2" to={`${ROUTES.payment(sent)}${asEntity ? '?as=entity' : ''}`}>
                  افتح الدفعة
                </ButtonLink>
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
  /* A held payment is pickable · its condition card says why it doesn't go up (9.4.8) */
  const can = (slot.state === 'open' || slot.state === 'held' || slot.state === 'eligible') && !locked

  return (
    <li className={`payslot${picked ? ' on' : ''}${can ? '' : ' off'}`}>
      <Button plain
        className="payslot-b"
        onClick={can ? onPick : slot.requestId ? onOpen : undefined}
        disabled={!can && !slot.requestId}
        /* The reason is written in `title`, not left to color alone - color says "something's
           wrong" and the text says what. */
        title={say.why /* doc · say.rule */}
      >
        <span className="payslot-n">الدفعة <span className="num">{slot.no}</span></span>
        <span className="payslot-a num">{nf.format(slot.amount)}</span>
        <span className="payslot-d"><DateText>{slot.dueAt}</DateText>{slot.ahead && slot.state !== 'paid' ? <span className="sub"> · لم يحن</span> : null}{slot.overdue ? <span className="sub"> · حلّ موعدها ولم تُرفع</span> : null}</span>
        {/* Note: fixed-width cells - the condition used to float in the row's text after a flexible
            gap, and a row with no condition had its badge drift; the checkmark now has its own cell
            even when unselected. */}
        <span className="sub trim1 payslot-c">{slot.condition ? isolate(slot.condition) : ''}</span>
        <Tag tone={SLOT_TONE[slot.state] ?? 'mute'}>{say.label}</Tag>
        <span className="payslot-k">{picked && <Icon name={icons.check} size="sm" />}</span>
      </Button>
    </li>
  )
}
