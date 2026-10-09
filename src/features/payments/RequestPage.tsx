import { useMemo, useState } from 'react'
import { readFiles } from '@/data/shared/ai'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, KV, Money, Mono, Num, Person, Riyal,
  Steps, Tag, type StepItem,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { DocFile } from '@/components/docs'
import { assistFor } from '@/data/mock/assistant'
import { PAY_LIMIT, PAY_STATES, payRequestById, payStateWho } from '@/data/mock/disbursements'
import { isolate, NOUN, nounAfter, pct, readDate } from '@/lib/format'
import {
  BANK_CHANGE_DENIED, BANK_CHANGE_ROLES, ENTITY_STATES, ORIGINS, PAY_PROOFS,
  bankIssues, banksOf, entityStateOf, originOf, type PayOrigin,
} from '@/data/mock/payEntity'
import type { PayRequest } from '@/types/domain'
import { ActionDock } from './ActionDock'
import { PayExceptions } from './PayExceptions'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { readPayRequest } from '@/data/recordReadings'
import { actOnPay, grantLeft, mayResubmit, payActions, usePayments, type PayAction } from '@/data/payments/store'
import { EditableCard } from '@/features/shared/EditableCard'

/* A single disbursement request - screens 3, 4 and 5 in the disbursement spec.

   Note: this is one screen for three screens in the spec. The spec describes "request review"
   (supervisor, steps 5-7), "grants manager approval" (step 13), and "disbursement order and
   transfer" (finance, steps 15-18) as separate sections, because it's describing the process, not
   the screen.

   But all three show the same request, with the same attachments, conditions, and log - the only
   difference is the exits. Three files would have become three copies of the same view, and adding
   a field would mean adding it three times - or twice, forgetting the third, which is exactly what
   happened before. So the view is one, and `actionsFor(role, state)` decides the exits.

   === What the spec requires the screen to show ===

   Rule 10 - agreement and its validity shown        -> the "agreement" card
   Rule 11 - the reserved amount shown at execution   -> the "disbursement impact" card
   Rule 12 - funding source breakdown                 -> the sources table
   Rule 13 - reserved -> spent and budget impact       -> same card
   Rule 14 - a hard cap on the grant amount            -> the grant bar
   Rule 16 - an audit log for every operation          -> the timeline with its steps
   Rule 17 - a notification for every transition       -> the notice line inside the log
   Rule 18 - no edits after approval                   -> exits disappear after disbursement
   Rule 20 - the AI output is advisory                 -> the "advisory" tag
   Rule 21 - documents tied to the request             -> the attachments card

   === What is deliberately NOT here ===

   "Disbursement request" (steps 1 and 2) is the request form. The entity opens this same page from
   its portal (`?as=entity`) to follow its request (9.4.19): its own five states, the notes to
   complete, the attachments and the log - without the institution's internal cards or exits. */

/** The four steps the user sees - sourced from the steps table. */
const LADDER: { key: string; label: string; note: string; steps: number[] }[] = [
  { key: 'entity', label: 'إنشاء الطلب', note: 'الجهة المستفيدة', steps: [1, 2, 3, 4] },
  { key: 'supervisor', label: 'مراجعة المشرف', note: 'مشرف المنح', steps: [5, 6, 7] },
  { key: 'manager', label: 'موافقة مدير المنح', note: 'مدير المنح', steps: [12, 13] },
  { key: 'exec', label: 'اعتماد المدير التنفيذي', note: 'فوق حد صرف المدير', steps: [13] },
  { key: 'finance', label: 'أمر الصرف والتحويل', note: 'الإدارة المالية', steps: [15, 16, 17, 18, 19] },
]

/** Which stage the request is currently at. */
const NOW_AT: Record<string, string> = {
  supervisor: 'supervisor',
  returned: 'entity',
  manager: 'manager',
  exec: 'exec',
  finance: 'finance',
  paid: '',
  closed: '',
}

/* Re-audit 7 Oct · a stage reads done once the request is past it · it used to need every step of
   the stage logged, and step 6 is never logged, so «مراجعة المشرف» read «لم تبدأ» to the end */
function ladderFor(r: PayRequest): StepItem[] {
  const viaExec = r.state === 'exec' || r.log.some((e) => e.role === 'المدير التنفيذي' && e.step === 13)
  const stages = LADDER.filter((s) => s.key !== 'exec' || viaExec)
  const now = NOW_AT[r.state]
  const nowAt = r.state === 'paid' ? stages.length : stages.findIndex((s) => s.key === now)
  const steps = stages.map((s, i): StepItem => {
    const at = [...r.log].reverse().find((e) => s.steps.includes(e.step) && (s.key !== 'exec' || e.role === 'المدير التنفيذي'))
    return {
      label: s.label,
      note: s.note,
      at: at ? <DateText>{at.at}</DateText> : undefined,
      /* Batch 7 · payments#10 · a closed (finally rejected) request reads the stages it passed as
         done, then its closing · it read every stage «لم تبدأ» */
      state: r.state === 'closed' ? (at ? 'done' : 'todo') : i === nowAt ? 'now' : nowAt >= 0 && i < nowAt ? 'done' : 'todo',
    }
  })
  if (r.state === 'closed') steps.push({ label: 'مغلق · رفض نهائي', note: 'يبقى للاطلاع (القاعدة 15)', state: 'now' })
  return steps
}

export default function RequestPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { role, user } = useRole()
  const [params] = useSearchParams()
  const asEntity = params.get('as') === 'entity'
  const ver = usePayments()
  const r = payRequestById(id)
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})

  /* `ver` re-reads the ladder after every move · the request object itself is mutated in place */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ladder = useMemo(() => (r ? ladderFor(r) : []), [r, ver])

  /* Note: these hooks sit above the early `return` because they must. The first version placed them
     below, next to other computations - the rules-of-hooks require a consistent order on every
     render, and a request that isn't found exits early, so the hooks got skipped. The commit gate
     caught it (`rules-of-hooks`) before it reached the device - that's exactly the gate's job. The
     `r?.` is necessary: the hook runs even when the request doesn't exist. */
  const entBanks = useMemo(() => banksOf(r?.entityId ?? ''), [r?.entityId])
  const payBank = useMemo(
    () => entBanks.find((b) => b.bank === r?.bank.name) ?? entBanks[0],
    [entBanks, r?.bank.name],
  )
  const bankBad = useMemo(() => (r ? bankIssues(r, payBank) : []), [r, payBank])

  if (!r) {
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

  const days = Math.round(r.hoursInState / 24)
  const limitDays = Math.round(PAY_LIMIT[r.state] / 24)
  const meta = PAY_STATES.find((s) => s.key === r.state)
  const blocked = r.checks.filter((c) => !c.ok)
  const bankOk = r.bank.active
  const actions = payActions(r, role.key, asEntity)
  /* Cross · the attachments read against the request's amount */
  const readings = [...readPayRequest(r), ...(asEntity ? [] : [readFiles('ai-pay-docs', 'قراءة مرفقات الطلب', r.docs.map((d) => d.name), { amount: r.asked })])]
  const onAct = (a: PayAction, file?: string) => {
    const out = actOnPay(r.id, a.act, note, user.name, role.key, file)
    if (out.length) { setSaid({ bad: out }); return }
    setSaid({ ok: a.label })
    setNote('')
  }

  /* Rule 14 - the hard cap - spent plus this payment, against the grant. */
  const after = r.spent + r.asked
  const left = r.state === 'paid' ? r.granted - after : grantLeft(r.projectId, r.id) - r.asked

  /* H-3 - status from the entity's point of view - not a hook, so it belongs here normally. */
  const ent = entityStateOf(r.state)

  /* H-2 - request direction - the entity's by default, or a supervisor's permit (9.1.input-4). */
  const origin: PayOrigin = r.origin ?? 'entity'

  return (
    <AppLayout assistantContext={assistFor.page(`طلب ${r.id}`, r.projectName)}>
      <div className={`viewstack${actions.length > 0 ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo
            label={asEntity ? 'البوابة' : 'الصرف'}
            onClick={() => navigate(asEntity ? `${ROUTES.entityPortal}?entity=${r.entityId}` : ROUTES.payments)}
          />

          {said.ok && (
            <p className="ok-ink cnote" role="status">
              سُجّل الإجراء: <b>{said.ok}</b> · أُرسل الإشعار (القاعدة 17)
            </p>
          )}
          {said.bad?.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}

          {/* Two-column header - same layout as the project and entity pages: name and amount on
              the right, the ladder opposite. */}
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
                  {/* Rule 5 - request amount can't exceed the approved payment. */}
                  {r.asked === r.due
                    ? <>مطابقة للدفعة المعتمدة · تستحق في <DateText>{r.dueAt}</DateText></>
                    : <span className="bad">
                        أعلى من الدفعة المعتمدة <Money sm>{r.due}</Money> · مخالفة للقاعدة 5
                      </span>}
                </div>
              </div>
            </div>

            <div className="col">
              <Steps items={ladder} flow="ladder" />
            </div>
          </header>

          {/* Rule 15 - a closed request states that it's closed, with its log remaining beneath it. */}
          {r.state === 'closed' && (
            <Glass>
              <Head title="الطلب مغلق" meta={<Tag tone="no">رفض نهائي</Tag>} />
              <p className="sub cnote">
                تنص القاعدة 15 على أن يُغلق النظام الطلب عند الرفض النهائي
                <b> مع الاحتفاظ بسجل إجراءاته</b> · السجل كامل أدناه، والتعديل مغلق.
              </p>
              {r.note && <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(r.note)}</span></div>}
            </Glass>
          )}

          {/* Status bar - who it's with, how long, against their threshold. */}
          <div className="prow">
            {/* Status bar outside the card - the badge is neutral and delay is stated in the text
                beside it. */}
            <Tag tone={asEntity ? ent.tone : 'mute'}>
              {asEntity ? ent.label : r.permit ? 'إذن صرف بانتظار مسوّغات الجهة' : meta?.label ?? 'مغلق'}
            </Tag>
            {r.state !== 'paid' && r.state !== 'closed' && !asEntity && (
              <span className="sub">
                عند {payStateWho(r.state)} من <Num>{days}</Num> {nounAfter(days, NOUN.day)}
                {limitDays > 0 && <> · حدّ المرحلة <Num>{limitDays}</Num> {nounAfter(limitDays, NOUN.day)}</>}
              </span>
            )}
            {r.state === 'paid' && r.paidAt && (
              <span className="sub">صُرفت في <DateText>{r.paidAt}</DateText></span>
            )}
            {asEntity && ent.act && <span className="sub">{ent.act}</span>}
            <span className="pc-sp" />
            <Person name={r.owner} />
            {/* The first output - the document finance transfers against. */}
            {!asEntity && (
              <Link className="btn btn-2 btn-sm" to={ROUTES.paymentOrder(r.id)}>
                <Icon name={icons.doc} size="sm" />
                أمر الصرف
              </Link>
            )}
            {/* Step 11 - the entity completes and resubmits · rule 18: only while returned to it. */}
            {asEntity && mayResubmit(r) && (
              <Link className="btn btn-p btn-sm" to={`${ROUTES.paymentEdit(r.id)}?as=entity`}>
                {r.permit ? 'أرفق المسوّغات وأرسل الطلب' : 'أكمل الطلب وأعد إرساله'}
              </Link>
            )}
            {!asEntity && r.state === 'returned' && <span className="sub">عند الجهة لاستكماله</span>}
          </div>

          <div className="g2">
            {/* === Main column - what the decision is made on === */}
            <div className="col">
              {/* === H-2 - who initiates the request ===
                  Note: this isn't an extra screen, it's a reversed direction. The difference isn't
                  step count, it's who's waiting on whom: in the current app the supervisor has to
                  remember to create the request; in the spec, the queue comes to them. The card
                  places both side by side because that difference is what needs a decision from the
                  institution. */}
              {!asEntity && <Glass>
                <Head
                  title="من يُصدر طلب الدفعة"
                  meta={<Tag tone="warn">يختلف عن النظام الحالي</Tag>}
                />
                <div className="payorig">
                  {ORIGINS.map((o) => (
                    <div key={o.key} className={`payorig-c${o.key === origin ? ' on' : ''}`}>
                      <span className="payorig-h">
                        <b>{o.label}</b>
                        {o.key === 'entity' && <Tag tone="ok">المستهدف</Tag>}
                      </span>
                      <ol className="payorig-f">
                        {o.flow.map((f, i) => (
                          <li key={f}>
                            <span className="num">{i + 1}</span>
                            <span className="trim1">{f}</span>
                          </li>
                        ))}
                      </ol>
                      <span className="sub">{o.note}</span>
                    </div>
                  ))}
                </div>
                <p className="sub cnote">
                  بدأ هذا الطلب في النموذج من <b>{originOf(origin).who}</b> ·
                  والانتقال إلى الاتجاه المستهدف يفتح بوابة المنح للجهة، فتصل
                  المسوّغات من البداية لا في منتصف الطريق.
                </p>
              </Glass>}

              {/* The conditions blocking progress - each with its rule cited. */}
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
                      <Icon name={c.ok ? icons.check : icons.alert} size="sm" />
                      <span>{c.label}</span>
                      <span className="payq-r">قاعدة <Num>{c.rule}</Num></span>
                    </li>
                  ))}
                  <li className={bankOk ? 'ok' : 'no'}>
                    <Icon name={bankOk ? icons.check : icons.alert} size="sm" />
                    <span>{r.bank.name}{bankOk ? '' : ' · الحساب غير نشط'}</span>
                    <span className="payq-r">الحساب المعتمد</span>
                  </li>
                </ul>
                {/* Rule 9 - execution is forbidden before every approval is complete. */}
                {(blocked.length > 0 || !bankOk) && (
                  <p className="sub cnote">
                    لا ينتقل الطلب قبل استيفاء هذه الشروط · تمنع القاعدة 9 التنفيذ
                    قبل اكتمال كل الاعتمادات.
                  </p>
                )}
              </Glass>

              {/* 9.1.input-6 - special approvals and exceptions recorded before disbursing. */}
              {!asEntity && <PayExceptions request={r} />}

              {/* AI-assist output - step 6 · read by the assistant in the end column (rule 20 · advisory) */}

              {/* Last return note - rules 7 and 8 require it to be explicit. */}
              {r.note && r.state !== 'closed' && (
                <Glass>
                  <Head
                    title={r.permit ? 'ملاحظة إذن الصرف' : 'ملاحظات الإعادة'}
                    meta={<Tag tone="warn">{r.returnedBy === 'manager' ? 'من مدير المنح' : r.returnedBy === 'finance' ? 'من الإدارة المالية' : 'للاستكمال'}</Tag>}
                  />
                  <div className="payq-note">
                    <Icon name={icons.chat} size="sm" />
                    <span>{isolate(r.note)}</span>
                  </div>
                </Glass>
              )}

              {/* Attachments - rule 21: tied to the request, not stored elsewhere.

                  Note: `DocFile` is the single shape for any file in the system - this used to be a
                  hand-written list (a single paper icon plus name and size), meaning a fourth shape
                  for something already unified on the project, entity, and tracking pages. The
                  thumbnail isn't decorative: it states the content type before opening, so the
                  reviewer knows a "beneficiary list" is a spreadsheet straight from the row. */}
              <Glass>
                <Head
                  title="المرفقات"
                  meta={<span className="sub"><Num>{r.docs.length}</Num> {nounAfter(r.docs.length, NOUN.doc)}</span>}
                />
                <div className="docgrid">
                  {r.docs.map((d, i) => (
                    <DocFile key={`${i}-${d.name}`} name={d.name} meta={readDate(d.at)} />
                  ))}
                </div>
              </Glass>

              {/* What supports the decision · in the main column, the end column is the assistant's alone */}
              {!asEntity && <EditableCard module="payment" state={r.state} label={meta?.label} />}

              {/* 9.2.17 · 9.1.output-2 - the executed transfer, with its proof. */}
              {r.transfer && (
                <Glass>
                  <Head title="التحويل المنفَّذ" meta={<Tag tone="ok">تم الصرف</Tag>} />
                  <KV
                    rows={[
                      { k: 'تاريخ التحويل', v: <DateText>{r.transfer.at}</DateText> },
                      { k: 'البنك', v: r.transfer.bank },
                      { k: 'الحساب', v: <span className="num">{r.transfer.iban}</span> },
                      { k: 'نفّذه', v: <Person name={r.transfer.by} /> },
                      { k: 'إثبات التحويل', v: <span className="trim1">{r.transfer.proof}</span> },
                    ]}
                  />
                </Glass>
              )}
              {/* Rule 10 - the agreement and its validity shown on the request. */}
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
                    /* K-2 - a related record that has its own page becomes a link, not text the
                       user copies and searches with. */
                    {
                      k: 'المشروع',
                      v: <Link className="tlink" to={ROUTES.project(r.projectId)}><Mono>{r.projectId}</Mono></Link>,
                    },
                    {
                      k: 'الجهة',
                      v: asEntity ? r.entityName : <Link className="tlink" to={ROUTES.entity(r.entityId)}>{r.entityName}</Link>,
                    },
                    /* 9.1.input-3 - the representative authorized to sign, from the agreement in force */
                    ...(r.rep ? [{ k: 'ممثل الجهة المخوّل', v: <>{r.rep.name} <span className="sub">· {r.rep.title}</span></> }] : []),
                  ]}
                />
              </Glass>

              {/* Rules 11, 13 and 14 - the reserved amount, its impact, and the cap. */}
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
                <p className={left < 0 ? 'bad cnote' : 'sub cnote'}>
                  {pct(Math.round((after / r.granted) * 100))} من المنحة بعد تنفيذ هذه الدفعة ·
                  {left < 0 ? ' تتجاوز الدفعة قيمة المنحة فيتوقّف الاعتماد والتنفيذ (القاعدة 14).' : ' تمنع القاعدة 14 أي صرف يتجاوز قيمة المنحة.'}
                </p>
              </Glass>

              {/* Note: rule 17 - "automatic notifications at every request stage". Notifications
                  live inside the log as a line under each transition, but the log reads in
                  chronological order while the question "who was notified" reads by recipient - the
                  same data read along two different axes, so a separate card answers the second
                  question without duplicating storage. */}
              <Glass>
                <Head
                  title="الإشعارات"
                  meta={<span className="sub">قاعدة 17 · لكل انتقال إشعار</span>}
                />
                <ul className="paynotif">
                  {r.log.filter((e) => e.notified).map((e, i) => (
                    <li key={`${e.step}-${i}`}>
                      <Icon name={icons.send} size="sm" />
                      <span className="trim1">{e.notified}</span>
                      <span className="pc-sp" />
                      <DateText>{e.at}</DateText>
                    </li>
                  ))}
                  {r.log.every((e) => !e.notified) && (
                    <li className="sub">لا توجد إشعارات بعد، فالطلب ما زال في مرحلته الأولى.</li>
                  )}
                </ul>
              </Glass>

              {/* === H-3 - what the entity sees ===
                  Note: the entity doesn't see all seven statuses. "Awaiting grants manager" and
                  "awaiting finance" tell the entity who's holding it up on our side, which isn't
                  theirs and they can't act on it - so it reads as worry, not information. The five
                  shown here are the ones the entity can actually act on. */}
              <Glass>
                <Head
                  title="كما تراه الجهة"
                  meta={<Tag tone={ent.tone}>{ent.label}</Tag>}
                />
                <ul className="payeye">
                  {ENTITY_STATES.map((x) => (
                    <li key={x.key} className={x.key === ent.key ? 'on' : ''}>
                      <span className="payeye-h">
                        <b>{x.label}</b>
                        <span className="pc-sp" />
                        {x.act
                          ? <span className="payeye-a">{x.act}</span>
                          : x.waiting
                            ? <span className="sub">بالانتظار</span>
                            : <span className="sub">اكتملت</span>}
                      </span>
                      <span className="sub">{x.inner}</span>
                    </li>
                  ))}
                </ul>
                <p className="sub cnote">
                  للدورة في المؤسسة <b><Num>7</Num> مراحل</b>، وترى الجهة منها{' '}
                  <b><Num>{ENTITY_STATES.length}</Num></b> · وتُجمع ثلاث منها في
                  «تحت إجراء الدفع» لأن الجهة لا تملك أي إجراء فيها.
                </p>
              </Glass>

              {/* === H-5, H-6, H-7 - bank account === */}
              {!asEntity && <Glass>
                <Head
                  title="حساب الدفع"
                  meta={
                    bankBad.length
                      ? <Tag tone="warn"><Num>{bankBad.length}</Num> ملاحظة</Tag>
                      : <Tag tone="ok">جاهز</Tag>
                  }
                />
                {/* Note: the entity has one account per beneficiary purpose (Quran memorization,
                    iftar, sacrifices) - so the list isn't decorative, it's the reason the rule
                    exists. */}
                <ul className="paybank">
                  {entBanks.map((b) => (
                    <li key={b.id} className={b.id === payBank?.id ? 'on' : ''}>
                      <span className="paybank-h">
                        <b>{b.purpose}</b>
                        <span className="sub trim1">· {b.bank}</span>
                        <span className="pc-sp" />
                        {b.id === payBank?.id && <Tag tone="mute">حساب الدفعة</Tag>}
                        {!b.active && <Tag tone="warn">غير نشط</Tag>}
                      </span>
                      <span className="sub num">{b.iban}</span>
                    </li>
                  ))}
                </ul>

                {bankBad.map((b, i) => (
                  <p key={i} className="bad cnote">
                    {b.say} <span className="sub">· {b.rule}</span>
                  </p>
                ))}

                <p className="sub cnote">
                  تُصرف الدفعة إلى <b>حساب واحد</b> ولا تُقسَّم. وتغيير الحساب من صلاحية{' '}
                  <b>{BANK_CHANGE_ROLES.join(' أو ')}</b> لا{' '}
                  <b>{BANK_CHANGE_DENIED}</b>، إذ يصله كل شيء جاهزًا
                  للتنفيذ، ولا يتواصل مباشرة مع الجهات.
                </p>
              </Glass>}

              {/* === H-4 - the two documents aren't the same type === */}
              <Glass>
                <Head title="إثبات الصرف" meta={<span className="sub">مستندان بوزنين مختلفين</span>} />
                <ul className="payproof">
                  {PAY_PROOFS.map((x) => (
                    <li key={x.key}>
                      <span className="payproof-h">
                        <b>{x.label}</b>
                        <span className="sub">· {x.by}</span>
                        <span className="pc-sp" />
                        <Tag tone={x.required ? 'warn' : 'mute'}>
                          {x.required ? 'إلزامي' : 'اختياري'}
                        </Tag>
                      </span>
                      <span className="sub">{x.why}</span>
                    </li>
                  ))}
                </ul>
                <p className="sub cnote">
                  الأهم أن <b>تُثبت المؤسسة أنها حوّلت المبلغ</b> · أما إقرار الجهة
                  بالاستلام فيُغلق الدورة من جهتها، ولا يوقف الدفعة.
                </p>
              </Glass>

              {/* Rule 12 - disbursement follows the approved source breakdown. */}
              {!asEntity && <Glass>
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
                    تُلزم القاعدة 12 بالصرف وفق هذا التوزيع، ويُنشأ أمر الصرف على أساسه.
                  </p>
                )}
              </Glass>}

              {/* Audit log - rule 16 - with a notification on every transition (rule 17). */}
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
                            <Icon name={icons.send} size="sm" />
                            إشعار · {e.notified}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Glass>
            </div>

            <AssistantAside title="قراءة طلب الصرف" cta="اقرأ الطلب" empty="لا ملاحظات على هذا الطلب الآن." readings={readings} />
          </div>
        </div>

        {/* Role exits - what distinguishes screens 3, 4 and 5. */}
        {actions.length > 0 && (
          <ActionDock
            user={user}
            request={r}
            actions={actions}
            note={note}
            onNote={setNote}
            onAct={onAct}
          />
        )}
      </div>
    </AppLayout>
  )
}
